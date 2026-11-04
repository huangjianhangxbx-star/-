using System.Diagnostics;
using System.Text.Json;
using XingHai.BridgeReplica;

// Exercises exactly CurveSketch.Build -> CurveSolver used by Window.DragDraw,
// including last-valid prefix semantics. No replacement solver or Unity mock.
static class Program
{
    sealed record Fixture(string Name,string Shape,float Radius,float Jitter,bool SmallBacktrack,List<RouteNode> Samples);
    sealed record RunResult(string Name,string Shape,float Radius,float Jitter,bool SmallBacktrack,int Samples,int PreviewAttempts,int ValidPreviews,int RejectedPreviews,int EligibleAttempts,int EligibleValid,int InitialPendingSamples,float MaxEligibleLag,float MaxPathDeviation,float InputLength,float LastValidLength,float EndpointError,bool FinalSampleAccepted,bool ReachedFinalEndpoint,string FirstRejection,string FinalRejection,int LastValidSample,float RuntimeMs);
    static float Distance(RouteNode a,RouteNode b)=>(float)Math.Sqrt((a.X-b.X)*(a.X-b.X)+(a.Z-b.Z)*(a.Z-b.Z));
    static float Length(List<RouteNode> ns){float n=0;for(int i=1;i<ns.Count;i++)n+=Distance(ns[i-1],ns[i]);return n;}
    static float PointSegment(RouteNode p,RouteNode a,RouteNode b){float dx=b.X-a.X,dz=b.Z-a.Z,den=dx*dx+dz*dz,t=den<.000001f?0:Math.Clamp(((p.X-a.X)*dx+(p.Z-a.Z)*dz)/den,0,1);return Distance(p,new RouteNode{X=a.X+dx*t,Z=a.Z+dz*t});}
    static List<RouteNode> Path(string shape,float amp,int seed,bool backtrack)
    {
        var random=new Random(seed);var result=new List<RouteNode>();float s=0,length=shape=="line"?18:shape=="arc"?(float)(6*Math.PI*2/3):24;
        int i=0;
        while(s<length)
        {
            // 0.05–0.16m per captured sample, a normal dense pointer trace.
            float x,z,nx,nz;
            if(shape=="line"){x=s*.813f;z=s*.582f;nx=-.582f;nz=.813f;}
            else if(shape=="arc"){double a=s/6;x=(float)(6*Math.Sin(a));z=(float)(6*(1-Math.Cos(a)));nx=-(float)Math.Sin(a);nz=(float)Math.Cos(a);}
            else {x=s;z=(float)(1.6*Math.Sin(s/4));double dz=.4*Math.Cos(s/4),norm=Math.Sqrt(1+dz*dz);nx=(float)(-dz/norm);nz=(float)(1/norm);}
            float noise=i==0?0:(float)((random.NextDouble()*2-1)*amp);
            result.Add(new RouteNode{Id="s"+i,X=x+nx*noise,Z=z+nz*noise});
            if(backtrack&&i>0&&i%47==0){var previous=result[^2];result.Add(new RouteNode{Id="b"+i,X=result[^1].X+(previous.X-result[^1].X)*.2f,Z=result[^1].Z+(previous.Z-result[^1].Z)*.2f});}
            s+=.05f+(float)random.NextDouble()*.11f;i++;
        }
        if(shape=="line")result.Add(new RouteNode{Id="end",X=length*.813f,Z=length*.582f});
        else if(shape=="arc"){double a=length/6;result.Add(new RouteNode{Id="end",X=(float)(6*Math.Sin(a)),Z=(float)(6*(1-Math.Cos(a)))});}
        else result.Add(new RouteNode{Id="end",X=length,Z=(float)(1.6*Math.Sin(length/4))});
        return result;
    }
    static RunResult Run(Fixture f)
    {
        var clock=Stopwatch.StartNew();RouteDocument last=null;int valid=0,rejected=0,lastSample=0,eligible=0,eligibleValid=0,initialPending=0;string first="",final="";bool finalAccepted=false;float maxLag=0;
        for(int n=2;n<=f.Samples.Count;n++)
        {
            bool enough=Length(f.Samples.Take(n).ToList())>=.5f;if(enough)eligible++;
            try{last=CurveSketch.Build(f.Samples.Take(n).Select(x=>x.Clone()).ToList(),2,2);valid++;if(enough)eligibleValid++;lastSample=n-1;final="";if(n==f.Samples.Count)finalAccepted=true;}
            catch(ArgumentException e){rejected++;if(first==""&&Length(f.Samples.Take(n).ToList())>=.5f)first=e.Message;final=e.Message;}
            // No visible route exists before the first >=0.5m valid candidate.
            // Raw jitter can inflate the captured perimeter just beyond 0.5m
            // while its actual footprint is still shorter. Report startup
            // pending separately from a preview that stops following the pen.
            if(enough&&last==null)initialPending++;
            if(enough&&last!=null)maxLag=Math.Max(maxLag,Distance(last.Nodes[^1],f.Samples[n-1]));
        }
        clock.Stop();float error=last==null?float.PositiveInfinity:Distance(last.Nodes[^1],f.Samples[^1]);
        float deviation=last==null?float.PositiveInfinity:f.Samples.Max(p=>Enumerable.Range(0,last.Nodes.Count-1).Min(i=>PointSegment(p,last.Nodes[i],last.Nodes[i+1])));
        return new(f.Name,f.Shape,f.Radius,f.Jitter,f.SmallBacktrack,f.Samples.Count,f.Samples.Count-1,valid,rejected,eligible,eligibleValid,initialPending,maxLag,deviation,Length(f.Samples),last==null?0:Length(last.Nodes),error,finalAccepted,error<=.1f,first,final,lastSample,(float)clock.Elapsed.TotalMilliseconds);
    }
    static string Failure(List<RouteNode> nodes,float height)
    {try{CurveSketch.Build(nodes,height,2);return "PASS";}catch(ArgumentException e){return e.Message;}}
    static List<RouteNode> Minimize(List<RouteNode> input,float height,string reason)
    {
        var result=input.Select(x=>x.Clone()).ToList();bool changed=true;
        while(changed){changed=false;for(int i=1;i<result.Count-1;i++){var trial=result.Select(x=>x.Clone()).ToList();trial.RemoveAt(i);if(Failure(trial,height).Contains(reason)){result=trial;changed=true;break;}}}
        return result;
    }
    static int Diagnose(List<Fixture> fixtures,string file)
    {
        // Probes change one input variable; production thresholds and code are untouched.
        var clean=fixtures[4];var noisy=fixtures[7];
        var a=Minimize(clean.Samples,2,"偏移边界");var b=Minimize(noisy.Samples,2,"内侧空间不足");
        int earlyCount=Enumerable.Range(2,noisy.Samples.Count-1).First(n=>Length(noisy.Samples.Take(n).ToList())>=.5f&&Failure(noisy.Samples.Take(n).ToList(),2).Contains("内侧空间不足"));
        var early=Minimize(noisy.Samples.Take(earlyCount).ToList(),2,"内侧空间不足");
        var direct=new RouteDocument{SchemaVersion=2,Id="three-point-miter",KitId="workshop.bridge.A",KitVersion="1",Width=2};
        direct.Nodes.Add(new RouteNode{Id="a",X=0,Z=0,Y=2});direct.Nodes.Add(new RouteNode{Id="b",X=8,Z=0,Y=2});direct.Nodes.Add(new RouteNode{Id="c",X=14,Z=6,Y=2});var directSolved=CurveSolver.Solve(direct);
        var probes=new[]{new{name="clean-r6-height2",result=Failure(clean.Samples,2)},new{name="clean-r6-height0",result=Failure(clean.Samples,0)},new{name="noisy-r6-height2",result=Failure(noisy.Samples,2)},new{name="noisy-r6-height0",result=Failure(noisy.Samples,0)}};
        var report=new{status="DIAGNOSTIC",scope="Single-variable probes and deletion-minimized actual production failures; no production edits",probes,minimalDirectMiter=new{points=direct.Nodes.Select(n=>new{x=n.X,z=n.Z}),angleDegrees=45,allowedTurnLimitDegrees=50,cornerRadius=10.77033f,minimumAllowedRadius=2.4f,valid=directSolved.Valid,reason=directSolved.Message},earlyNoisy=new{prefixSamples=earlyCount,points=early.Select(n=>new{x=n.X,z=n.Z}),length=Length(early),reason=Failure(early,2),withoutHeight=Failure(early,0)},minimalClean=new{points=a.Select(n=>new{x=n.X,z=n.Z}),reason=Failure(a,2),withoutHeight=Failure(a,0),everyInteriorPointLoadBearing=Enumerable.Range(1,a.Count-2).All(i=>{var q=a.Select(n=>n.Clone()).ToList();q.RemoveAt(i);return !Failure(q,2).Contains("偏移边界");})},minimalNoisy=new{points=b.Select(n=>new{x=n.X,z=n.Z}),reason=Failure(b,2),withoutHeight=Failure(b,0),maxDeviationFromIdealR6=b.Max(n=>Math.Abs(Math.Sqrt(n.X*n.X+(n.Z-6)*(n.Z-6))-6)),everyInteriorPointLoadBearing=Enumerable.Range(1,b.Count-2).All(i=>{var q=b.Select(n=>n.Clone()).ToList();q.RemoveAt(i);return !Failure(q,2).Contains("内侧空间不足");})}};
        string json=JsonSerializer.Serialize(report,new JsonSerializerOptions{WriteIndented=true});Console.WriteLine(json);File.WriteAllText(file,json);return 0;
    }
    static int Stress(string file)
    {
        var clock=Stopwatch.StartNew();var ordinary=new List<RunResult>();var pressure=new List<RunResult>();
        foreach(float noise in new[]{.02f,.03f})for(int seed=0;seed<12;seed++)ordinary.Add(Run(new Fixture("r6-"+noise+"-seed"+seed,"arc",6,noise,false,Path("arc",noise,9300+seed,false))));
        for(int seed=0;seed<8;seed++)pressure.Add(Run(new Fixture("r6-pressure-.05-seed"+seed,"arc",6,.05f,false,Path("arc",.05f,11300+seed,false))));
        bool Good(RunResult c)=>c.FinalSampleAccepted&&c.ReachedFinalEndpoint&&c.MaxPathDeviation<=.1f&&c.EligibleValid/(float)c.EligibleAttempts>=.9f&&c.MaxEligibleLag<=.35f;
        clock.Stop();var report=new{status=ordinary.All(Good)&&pressure.All(Good)?"PASS":"FAIL",scope="24 independently seeded radius6 traces at 2/3cm jitter plus 8 fixed 5cm noisy traces; all must reach raw endpoints within unchanged 0.1m contour tolerance, with sustained feedback.",width=2,tolerance=.1f,runtimeMs=clock.Elapsed.TotalMilliseconds,ordinaryTotal=ordinary.Count,ordinarySuccess=ordinary.Count(Good),ordinaryFailures=ordinary.Where(c=>!Good(c)).ToArray(),ordinaryAggregate=new{finalEnds=ordinary.Count(c=>c.FinalSampleAccepted),eligible=ordinary.Sum(c=>c.EligibleAttempts),accepted=ordinary.Sum(c=>c.EligibleValid),maxLag=ordinary.Max(c=>c.MaxEligibleLag),maxDeviation=ordinary.Max(c=>c.MaxPathDeviation)},pressureTotal=pressure.Count,pressureSuccess=pressure.Count(Good),pressure=pressure.Select(c=>new{c.Name,c.FinalSampleAccepted,c.EligibleValid,c.EligibleAttempts,c.MaxEligibleLag,c.MaxPathDeviation,c.FinalRejection}).ToArray()};
        string json=JsonSerializer.Serialize(report,new JsonSerializerOptions{WriteIndented=true});File.WriteAllText(file,json);Console.WriteLine(JsonSerializer.Serialize(new{report.status,report.runtimeMs,report.ordinarySuccess,report.ordinaryTotal,report.ordinaryAggregate,report.pressureSuccess,report.pressureTotal}));return report.status=="PASS"?0:1;
    }
    static int Main(string[] args)
    {
        var fixtures=new List<Fixture>();
        var specs=new[]{("line",.0f,false),("line",.012f,false),("line",.02f,false),("line",.03f,false),("arc",.0f,false),("arc",.012f,false),("arc",.02f,false),("arc",.03f,false),("s",.02f,false),("s",.02f,true)};
        for(int i=0;i<specs.Length;i++){var (shape,jitter,back)=specs[i];fixtures.Add(new Fixture("stroke-"+i,shape,shape=="arc"?6:shape=="s"?10:999,jitter,back,Path(shape,jitter,7100+i,back)));}
        if(args.Length>1&&args[0]=="--diagnose")return Diagnose(fixtures,args[1]);
        if(args.Length>1&&args[0]=="--stress")return Stress(args[1]);
        var checks=new List<object>();void Check(string name,Action action){try{action();checks.Add(new{name,status="PASS",error=""});}catch(Exception e){checks.Add(new{name,status="FAIL",error=e.GetBaseException().Message});}}
        void Need(bool v,string message){if(!v)throw new Exception(message);}
        Check("accepted-45-degree-author-turn-does-not-self-cross-its-offset",()=>{var d=new RouteDocument{SchemaVersion=2,Id="offset",Width=2,KitId="workshop.bridge.A",KitVersion="1"};foreach(var p in new[]{(0f,0f),(8f,0f),(14f,6f)})d.Nodes.Add(new RouteNode{Id="n"+d.Nodes.Count,X=p.Item1,Y=2,Z=p.Item2});string before=JsonSerializer.Serialize(d,new JsonSerializerOptions{IncludeFields=true});var r=CurveSolver.Solve(d);Need(r.Valid,r.Message);Need(before==JsonSerializer.Serialize(d,new JsonSerializerOptions{IncludeFields=true}),"Deriving corrected edges mutated saved author");var corner=r.FrameAt(8);Need(Math.Abs(corner.X-8)<.0001f&&Math.Abs(corner.Z)<.0001f,"Corner center moved");Need(Math.Abs(corner.LeftX-7.5857864f)<.0001f&&Math.Abs(corner.LeftZ-1)<.0001f&&Math.Abs(corner.RightX-8.4142136f)<.0001f&&Math.Abs(corner.RightZ+1)<.0001f,"45-degree miter did not meet independently calculated edges");});
        Check("height-cut-does-not-poison-clean-radius6-stroke",()=>{var d=CurveSketch.Build(fixtures[4].Samples,2,2);Need(Distance(d.Nodes[^1],fixtures[4].Samples[^1])<.0001f,"Clean arc tail lost");});
        Check("final-sub-two-millimetre-input-is-not-dropped",()=>{var raw=new List<RouteNode>{new RouteNode(),new RouteNode{X=4},new RouteNode{X=4.001f,Z=.0005f}};var d=CurveSketch.Build(raw,2,2);Need(d.Nodes[^1].X==raw[^1].X&&d.Nodes[^1].Z==raw[^1].Z,"Small final release sample was discarded by input cleaning");});
        Check("prepend-keeps-one-author-old-node-identities-and-opening",()=>{var d=CurveExamples.U();var nodes=d.Nodes.Select(n=>n.Clone()).ToArray();string opening=d.Openings[0].SegmentId;var method=typeof(CurveEdits).GetMethod("PrependStroke");Need(method!=null,"PrependStroke not implemented");var stroke=new List<RouteNode>{d.Nodes[0].Clone(),new RouteNode{X=-6,Y=0,Z=0},new RouteNode{X=-8,Y=0,Z=0}};var result=(RouteDocument)method.Invoke(null,new object[]{d,stroke});Need(result.Id==d.Id&&result.Nodes.Count==nodes.Length+2,"Prepend changed author or point count");Need(result.Nodes[0].X==-8&&result.Nodes[1].X==-6,"Prepend order must run new endpoint back to old first");for(int i=0;i<nodes.Length;i++)Need(JsonSerializer.Serialize(result.Nodes[i+2],new JsonSerializerOptions{IncludeFields=true})==JsonSerializer.Serialize(nodes[i],new JsonSerializerOptions{IncludeFields=true}),"Original node changed");Need(result.Openings[0].SegmentId==opening&&CurveSolver.Solve(result).Valid,"Existing opening or validity lost");});
        Check("actual-sharp-turn-and-crossing-still-rejected",()=>{var d=new RouteDocument{SchemaVersion=2,Id="sharp",Width=2,KitId="workshop.bridge.A",KitVersion="1"};foreach(var p in new[]{(0f,0f),(8f,0f),(8f,8f)})d.Nodes.Add(new RouteNode{Id="n"+d.Nodes.Count,X=p.Item1,Y=0,Z=p.Item2});Need(!CurveSolver.Solve(d).Valid,"Actual sharp corner accepted");var cross=fixtures[0].Samples.Select(n=>n.Clone()).ToList();cross.Add(new RouteNode{X=0,Z=10});cross.Add(new RouteNode{X=12,Z=-5});bool rejected=false;try{CurveSketch.Build(cross,0,2);}catch(ArgumentException){rejected=true;}Need(rejected,"Self crossing accepted");});
        var clock=Stopwatch.StartNew();var cases=fixtures.Select(Run).ToArray();clock.Stop();bool all=cases.All(c=>c.FinalSampleAccepted&&c.ReachedFinalEndpoint&&c.MaxPathDeviation<=.1f&&c.EligibleValid/(float)c.EligibleAttempts>=.9f&&c.MaxEligibleLag<=.35f)&&checks.All(x=>JsonSerializer.Serialize(x).Contains("\"PASS\""));var report=new{status=all?"PASS":"FAIL",scope="Pinned dense imperfect pointer traces through actual production CurveSketch.Build/CurveSolver; no engine, actual mouse or material claims.",width=2,positionTolerance=.1f,total=cases.Length,successful=cases.Count(c=>c.FinalSampleAccepted&&c.ReachedFinalEndpoint),runtimeMs=clock.Elapsed.TotalMilliseconds,checks,cases};
        string json=JsonSerializer.Serialize(report,new JsonSerializerOptions{WriteIndented=true});
        if(args.Length>1&&args[0]=="--report")File.WriteAllText(args[1],json);
        Console.WriteLine(json);return report.status=="PASS"?0:1;
    }
}
