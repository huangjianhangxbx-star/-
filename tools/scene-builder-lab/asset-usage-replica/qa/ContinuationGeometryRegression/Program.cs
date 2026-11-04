using System.Diagnostics;
using System.Text.Json;
using XingHai.BridgeReplica;

static class Program
{
    sealed record Case(int Seed,float Noise,bool First,float Turn,bool BaseValid,bool StandaloneValid,bool JoinedValid,string Rejection,float AdjacentLength,float TangentDeltaDegrees,int PrefixAccepted,int PrefixAttempts,float LastAcceptedExtension,RouteNode[] BaseNodes,RouteNode[] ExtensionNodes);
    static float Distance(RouteNode a,RouteNode b)=>(float)Math.Sqrt((a.X-b.X)*(a.X-b.X)+(a.Z-b.Z)*(a.Z-b.Z));
    static float Length(IEnumerable<RouteNode> nodes){var ps=nodes.ToArray();float n=0;for(int i=1;i<ps.Length;i++)n+=Distance(ps[i-1],ps[i]);return n;}
    static List<RouteNode> BaseTrace(int seed,float noise,string shape="sin")
    {
        var rng=new Random(seed);var trace=new List<RouteNode>();float s=0;int i=0;
        float length=shape=="arc"?12:18;
        RouteNode Point(float at,string id){float n=(float)(rng.NextDouble()*2-1)*noise;if(shape=="arc"){float a=at/6;return new RouteNode{Id=id,X=(float)(6*Math.Sin(a)-Math.Sin(a)*n),Z=(float)(6*(1-Math.Cos(a))+Math.Cos(a)*n)};}return new RouteNode{Id=id,X=at,Z=(float)Math.Sin(at/8)+n};}
        while(s<length){trace.Add(Point(s,"b"+i++));s+=.05f+(float)rng.NextDouble()*.11f;}
        trace.Add(Point(length,"final"));return trace;
    }
    static List<RouteNode> ExtensionTrace(RouteNode endpoint,bool first,float noise,float turn,int seed,double? headingOverride=null)
    {
        var rng=new Random(seed);var points=new List<RouteNode>{endpoint.Clone()};float referenceX=first?0:18;
        double heading=headingOverride??(Math.Atan(.125*Math.Cos(referenceX/8))+(first?Math.PI:0));float s=0,x=endpoint.X,z=endpoint.Z;int i=0;
        while(s<4)
        {
            float step=Math.Min(4-s,.05f+(float)rng.NextDouble()*.11f);double angle=heading+turn*Math.PI/180*Math.Min(1,(s+step*.5)/2);x+=step*(float)Math.Cos(angle);z+=step*(float)Math.Sin(angle);s+=step;
            float n=(float)(rng.NextDouble()*2-1)*noise;points.Add(new RouteNode{Id="e"+i++,X=x-(float)Math.Sin(angle)*n,Z=z+(float)Math.Cos(angle)*n,Y=endpoint.Y});
        }
        return points;
    }
    static Case Run(int seed,float noise,bool first,float turn,string shape="sin")
    {
        var raw=BaseTrace(seed,noise,shape);RouteDocument b;
        try{b=CurveSketch.Build(raw,2,2);}catch(Exception e){return new(seed,noise,first,turn,false,false,false,"base: "+e.Message,0,0,0,0,0,Array.Empty<RouteNode>(),Array.Empty<RouteNode>());}
        var endpoint=first?b.Nodes[0]:b.Nodes[^1];var adjacent=first?b.Nodes[1]:b.Nodes[^2];float dx=endpoint.X-adjacent.X,dz=endpoint.Z-adjacent.Z;
        double expected=(shape=="arc"?(first?Math.PI:2):Math.Atan(.125*Math.Cos((first?0:18)/8f))+(first?Math.PI:0)),actual=Math.Atan2(dz,dx),delta=(actual-expected)*180/Math.PI;while(delta>180)delta-=360;while(delta< -180)delta+=360;
        var samples=ExtensionTrace(endpoint,first,noise,turn,seed+10000,expected);int accepted=0,attempts=0;float last=0;bool standalone=false,joinedValid=false;string rejection="";RouteDocument eDoc=null;
        for(int count=2;count<=samples.Count;count++)
        {
            try
            {
                eDoc=CurveSketch.Build(samples.Take(count).Select(n=>n.Clone()).ToList(),0,2);standalone=true;foreach(var n in eDoc.Nodes)n.Y=endpoint.Y;
                var joined=first?CurveEdits.PrependStroke(b,eDoc.Nodes):CurveEdits.AppendStroke(b,eDoc.Nodes);var solved=CurveSolver.Solve(joined);attempts++;
                if(solved.Valid){accepted++;last=Length(eDoc.Nodes);joinedValid=count==samples.Count;rejection="";}else {joinedValid=false;rejection=solved.Message;}
            }
            catch(Exception error){standalone=false;joinedValid=false;rejection=error.Message;}
        }
        return new(seed,noise,first,turn,true,standalone,joinedValid,rejection,Distance(endpoint,adjacent),(float)delta,accepted,attempts,last,b.Nodes.ToArray(),eDoc?.Nodes.ToArray()??Array.Empty<RouteNode>());
    }
    static int DirectProbe(string file)
    {
        var facts=new List<object>();
        foreach(float tailZ in new[]{0f,.01f,.02f,.03f})foreach(float turn in new[]{-40f,-20f,0f,20f,40f})
        {
            var b=new RouteDocument{SchemaVersion=2,Id="legal-short-tail",Width=2,KitId="workshop.bridge.A",KitVersion="1"};
            foreach(var n in new[]{new RouteNode{Id="a",X=0,Y=2},new RouteNode{Id="b",X=10,Y=2},new RouteNode{Id="c",X=10.1f,Y=2,Z=tailZ}})b.Nodes.Add(n);
            var baseResult=CurveSolver.Solve(b);var raw=ExtensionTrace(b.Nodes[^1],false,0,turn,999);
            // Direct fixture's intended broad heading is +X, not sin's endpoint derivative.
            double rotate=Math.Atan(.125*Math.Cos(18f/8));foreach(var n in raw.Skip(1)){double x=n.X-b.Nodes[^1].X,z=n.Z-b.Nodes[^1].Z;n.X=b.Nodes[^1].X+(float)(x*Math.Cos(rotate)+z*Math.Sin(rotate));n.Z=b.Nodes[^1].Z+(float)(-x*Math.Sin(rotate)+z*Math.Cos(rotate));}
            RouteDocument stroke=null;string reason="";bool joined=false,standalone=false;try{stroke=CurveSketch.Build(raw,0,2);standalone=true;foreach(var n in stroke.Nodes)n.Y=2;var result=CurveSolver.Solve(CurveEdits.AppendStroke(b,stroke.Nodes));joined=result.Valid;reason=result.Message;}catch(Exception e){reason=e.Message;}
            facts.Add(new{tailZ,turn,baseValid=baseResult.Valid,standalone,joined,reason,baseNodes=b.Nodes,extensionNodes=stroke?.Nodes});
        }
        var report=new{status="DIAGNOSTIC",scope="Manually-authored legal 0.1m terminal span plus independent smooth new stroke; kept distinct from naturally captured bases",cases=facts};File.WriteAllText(file,JsonSerializer.Serialize(report,new JsonSerializerOptions{WriteIndented=true,IncludeFields=true}));Console.WriteLine(JsonSerializer.Serialize(facts));return 0;
    }
    public static int Main(string[] args)
    {
        if(args.Length>1&&args[0]=="--direct")return DirectProbe(args[1]);
        if(args.Length>1&&args[0]=="--arc")
        {
            var timerArc=Stopwatch.StartNew();var arcs=new List<Case>();foreach(float noise in new[]{.03f,.05f})foreach(bool first in new[]{false,true})foreach(float turn in new[]{-20f,0f,20f})for(int seed=0;seed<40;seed++)arcs.Add(Run(31700+seed,noise,first,turn,"arc"));timerArc.Stop();
            var eligibleArc=arcs.Where(c=>c.BaseValid&&c.StandaloneValid).ToArray();var reportArc=new{status=eligibleArc.All(c=>c.JoinedValid)?"PASS":"FAIL",scope="Naturally drawn dense radius6 base plus separately drawn 4m extension, exact port centre and intended broad tangent, 3/5cm noise",runtimeMs=timerArc.Elapsed.TotalMilliseconds,total=arcs.Count,baseValid=arcs.Count(c=>c.BaseValid),standaloneValid=arcs.Count(c=>c.StandaloneValid),eligible=eligibleArc.Length,joinedValid=eligibleArc.Count(c=>c.JoinedValid),failures=eligibleArc.Where(c=>!c.JoinedValid).ToArray(),cases=arcs};File.WriteAllText(args[1],JsonSerializer.Serialize(reportArc,new JsonSerializerOptions{WriteIndented=true,IncludeFields=true}));Console.WriteLine(JsonSerializer.Serialize(new{reportArc.status,reportArc.runtimeMs,reportArc.total,reportArc.baseValid,reportArc.standaloneValid,reportArc.eligible,reportArc.joinedValid,failed=reportArc.failures.Length}));return reportArc.status=="PASS"?0:1;
        }
        var timer=Stopwatch.StartNew();var cases=new List<Case>();
        foreach(float noise in new[]{0f,.02f,.03f})foreach(bool first in new[]{false,true})foreach(float turn in new[]{-20f,0f,20f})for(int seed=0;seed<4;seed++)cases.Add(Run(23700+seed,noise,first,turn));
        timer.Stop();var eligible=cases.Where(c=>c.BaseValid&&c.StandaloneValid).ToArray();var failed=eligible.Where(c=>!c.JoinedValid).ToArray();var groups=cases.GroupBy(c=>(c.Noise,c.First,c.Turn)).Select(g=>new{g.Key.Noise,g.Key.First,g.Key.Turn,total=g.Count(),baseValid=g.Count(c=>c.BaseValid),standaloneValid=g.Count(c=>c.StandaloneValid),joinedValid=g.Count(c=>c.JoinedValid)}).ToArray();
        var report=new{status=failed.Length==0&&cases.All(c=>c.BaseValid&&c.StandaloneValid)?"PASS":"FAIL",scope="Two independently sampled ordinary drawn strokes: actual CurveSketch->Append/Prepend->CurveSolver. No Unity, port picking or physical mouse claims.",sourceUnchanged=true,runtimeMs=timer.Elapsed.TotalMilliseconds,total=cases.Count,baseValid=cases.Count(c=>c.BaseValid),standaloneValid=cases.Count(c=>c.StandaloneValid),eligible=eligible.Length,joinedValid=eligible.Count(c=>c.JoinedValid),failed=failed.Length,groups,minimalCandidate=failed.OrderBy(c=>Math.Abs(c.Turn)).ThenBy(c=>c.Noise).FirstOrDefault(),cases};
        string file=args.Length>0?args[0]:"continuation-geometry-red.json";Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(file)));File.WriteAllText(file,JsonSerializer.Serialize(report,new JsonSerializerOptions{WriteIndented=true,IncludeFields=true}));
        Console.WriteLine(JsonSerializer.Serialize(new{report.status,report.runtimeMs,report.total,report.baseValid,report.standaloneValid,report.eligible,report.joinedValid,report.failed,report.groups}));return report.status=="PASS"?0:1;
    }
}
