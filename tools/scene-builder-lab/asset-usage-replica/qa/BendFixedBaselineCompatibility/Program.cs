using System.Diagnostics;
using System.Text.Json;
using XingHai.OldBridgeReplica;

static class Program {
    static readonly List<object> BaseCompatibility=new(); static int InvalidBase;
    static XingHai.BridgeReplica.CurveResult ActualSolve(RouteDocument d)
    {return XingHai.BridgeReplica.CurveSolver.Solve(JsonSerializer.Deserialize<XingHai.BridgeReplica.RouteDocument>(JsonSerializer.Serialize(d,Json),Json));}
    static readonly JsonSerializerOptions Json=new(){WriteIndented=true,IncludeFields=true};
    sealed record Result(string Group,bool First,float Step,float InitialTurn,float ReleaseTail,float ActualStoredTail,float TerminalHeadingError,int Samples,int Attempts,int StandaloneAccepted,int JoinedAccepted,bool FinalStandalone,bool FinalJoined,string FirstRejected,string FinalRejected,float LastAcceptedLength,float EndpointError,RouteNode[] BaseNodes,RouteNode[] Raw);
    static RouteNode P(float x,float z,string id="")=>new(){Id=id,X=x,Z=z};
    static float Distance(RouteNode a,RouteNode b)=>(float)Math.Sqrt((a.X-b.X)*(a.X-b.X)+(a.Z-b.Z)*(a.Z-b.Z));
    static float Length(IEnumerable<RouteNode> nodes){var p=nodes.ToArray();float length=0;for(int i=1;i<p.Length;i++)length+=Distance(p[i-1],p[i]);return length;}
    static float Angle(float x,float z)=>MathF.Atan2(z,x);
    static float DeltaAngle(float a,float b){float d=(a-b)*180/MathF.PI;while(d>180)d-=360;while(d< -180)d+=360;return d;}
    static (RouteNode point,float heading) Endpoint(RouteDocument b,bool first)
    {var p=first?b.Nodes[0]:b.Nodes[^1];var q=first?b.Nodes[1]:b.Nodes[^2];return(p,Angle(p.X-q.X,p.Z-q.Z));}
    static RouteDocument Straight()
    {var raw=new List<RouteNode>();for(float x=0;x<14;x+=.05f)raw.Add(P(x,0));raw.Add(P(14,0));return CurveSketch.Build(raw,2,2);}
    static (RouteDocument doc,float heading) DrawnArc(float release,bool first,int seed)
    {
        var rng=new Random(seed);var raw=new List<RouteNode>();float length=14.3f,s=0;int count=0;
        RouteNode Arc(float at){float a=at/6,noise=count++==0?0:(float)(rng.NextDouble()*2-1)*.02f;return P((float)(6*Math.Sin(a)-Math.Sin(a)*noise),(float)(6*(1-Math.Cos(a))+Math.Cos(a)*noise));}
        while(s<length){raw.Add(Arc(s));s+=.05f+(float)rng.NextDouble()*.11f;}raw.Add(Arc(length));raw.Add(Arc(length+release));
        if(first)raw.Reverse();var b=CurveSketch.Build(raw,2,2);return(b,(length+release)/6);
    }
    static List<RouteNode> CurvedExtension(RouteDocument b,bool first,float heading,float initialTurn,float step,float length=6,bool firstOnly=false)
    {
        var endpoint=Endpoint(b,first).point;float angle=heading+initialTurn*MathF.PI/180;var result=new List<RouteNode>{endpoint.Clone()};
        void Add(float at){float u=6*MathF.Sin(at/6),v=6*(1-MathF.Cos(at/6));result.Add(P(endpoint.X+MathF.Cos(angle)*u-MathF.Sin(angle)*v,endpoint.Z+MathF.Sin(angle)*u+MathF.Cos(angle)*v));}
        if(firstOnly){if(step<length)Add(step);for(float s=step+.25f;s<length;s+=.25f)Add(s);}
        else for(float s=step;s<length;s+=step)Add(s);
        Add(length);return result;
    }
    static Result Run(string group,RouteDocument b,List<RouteNode> raw,bool first,float step,float turn,float release=0,float intendedHeading=0)
    {
        string before=JsonSerializer.Serialize(b,Json);var baseResult=ActualSolve(b);if(!baseResult.Valid)InvalidBase++;BaseCompatibility.Add(new{group,first,step,turn,release,newBaseValid=baseResult.Valid,baseReason=baseResult.Message});int attempts=0,standalone=0,joined=0;RouteDocument last=null;bool finalStandalone=false,finalJoined=false;string firstReason="",lastReason="";
        var endpoint=Endpoint(b,first);float actualTail=Distance(endpoint.point,first?b.Nodes[1]:b.Nodes[^2]);
        for(int n=2;n<=raw.Count;n++)
        {
            bool final=n==raw.Count;attempts++;try
            {
                var stroke=CurveSketch.Build(raw.Take(n).Select(p=>p.Clone()).ToList(),0,b.Width);foreach(var p in stroke.Nodes)p.Y=endpoint.point.Y;standalone++;if(final)finalStandalone=true;
                var candidate=first?CurveEdits.PrependStroke(b,stroke.Nodes):CurveEdits.AppendStroke(b,stroke.Nodes);var result=ActualSolve(candidate);
                if(!result.Valid)throw new ArgumentException(result.Message);joined++;last=stroke;lastReason="";if(final)finalJoined=true;
            }
            catch(Exception e){lastReason=e.Message;if(firstReason==""&&Length(raw.Take(n))>=.5f)firstReason=e.Message;}
        }
        if(before!=JsonSerializer.Serialize(b,Json))throw new Exception("Actual production continuation changed saved base authority");
        return new(group,first,step,turn,release,actualTail,DeltaAngle(endpoint.heading,intendedHeading),raw.Count,attempts,standalone,joined,finalStandalone,finalJoined,firstReason,lastReason,last==null?0:Length(last.Nodes),last==null?-1:Distance(last.Nodes[^1],raw[^1]),b.Nodes.ToArray(),raw.ToArray());
    }
    public static int Main(string[] args)
    {
        var timer=Stopwatch.StartNew();var sampling=new List<Result>();var tails=new List<Result>();var recovery=new List<Result>();var baseFailures=new List<object>();
        foreach(bool first in new[]{false,true})foreach(float turn in new[]{0f,10f,45f})foreach(float step in new[]{.05f,.25f,1f,2f})
        {var b=Straight();float h=Endpoint(b,first).heading;sampling.Add(Run("same-r6-path-variable-spacing",b,CurvedExtension(b,first,h,turn,step),first,step,turn,0,h));}
        foreach(bool first in new[]{false,true})foreach(float release in new[]{.02f,.1f,.3f,1f})foreach(float firstStep in new[]{.05f,.5f,1f,2f})foreach(float turn in new[]{5f,10f,20f,45f})
        {
            try{var (b,h)=DrawnArc(release,first,11831);tails.Add(Run("drawn-arc-with-small-final-release",b,CurvedExtension(b,first,h,turn,firstStep,6,true),first,firstStep,turn,release,h));}
            catch(Exception e){baseFailures.Add(new{first,release,firstStep,turn,reason=e.Message});}
        }
        foreach(bool first in new[]{false,true})foreach(float excursion in new[]{.3f,.8f})
        {
            var b=Straight();var (endpoint,heading)=Endpoint(b,first);var raw=new List<RouteNode>();
            // Every real point is retained. The pointer first reaches a legal
            // preview, deviates, returns near its last valid endpoint, then
            // continues along the original legal extension.
            foreach(var p in new[]{(0f,0f),(.6f,0f),(.62f,excursion),(.65f,.01f),(.9f,0f),(1.5f,0f),(4f,0f)})raw.Add(P(endpoint.X+MathF.Cos(heading)*p.Item1-MathF.Sin(heading)*p.Item2,endpoint.Z+MathF.Sin(heading)*p.Item1+MathF.Cos(heading)*p.Item2));
            recovery.Add(Run("red-excursion-return-to-last-valid-tail",b,raw,first,0,0,0,heading));
        }
                if(args.Length>1)
        {
            using var capture=JsonDocument.Parse(File.ReadAllText(args[1]));
            foreach(string key in new[]{"representativeSamplingFailure","representativeTailFailure"})
            {
                var fact=capture.RootElement.GetProperty(key);if(fact.ValueKind!=JsonValueKind.Object)continue;
                var b=new RouteDocument{SchemaVersion=2,Id="curve-stroke",Width=2,KitId="workshop.bridge.A",KitVersion="1"};
                b.Nodes=JsonSerializer.Deserialize<List<RouteNode>>(fact.GetProperty("BaseNodes").GetRawText(),Json);
                var raw=JsonSerializer.Deserialize<List<RouteNode>>(fact.GetProperty("Raw").GetRawText(),Json);
                recovery.Add(Run("captured-"+key,b,raw,fact.GetProperty("First").GetBoolean(),fact.GetProperty("Step").GetSingle(),fact.GetProperty("InitialTurn").GetSingle(),fact.GetProperty("ReleaseTail").GetSingle()));
            }
        }
        timer.Stop();var combined=sampling.Concat(tails).Concat(recovery).ToArray();
        object Fact(Result c)=>new{c.Group,c.First,c.Step,c.InitialTurn,c.ReleaseTail,c.ActualStoredTail,c.TerminalHeadingError,c.Samples,c.Attempts,c.StandaloneAccepted,c.JoinedAccepted,c.FinalStandalone,c.FinalJoined,c.FirstRejected,c.FinalRejected,c.LastAcceptedLength,c.EndpointError};
        var report=new{status=sampling.Concat(tails).Concat(recovery.Where(c=>c.Group.StartsWith("captured-"))).All(c=>c.FinalJoined)&&baseFailures.Count==0&&InvalidBase==0?"PASS":"FAIL",scope="Fixed old baseline CurveSketch.Build outputs (both base and extension) -> actual new production CurveSolver, including captured original Red representatives. No new sketch Build, Engine, or physical mouse claim.",sourceUnchanged=true,runtimeMs=timer.Elapsed.TotalMilliseconds,samplingCount=sampling.Count,samplingFinals=sampling.Count(c=>c.FinalJoined),tailCount=tails.Count,tailFinals=tails.Count(c=>c.FinalJoined),baseFailures,baseCompatibility=BaseCompatibility,recoveryCount=recovery.Count,recoveryFinals=recovery.Count(c=>c.FinalJoined),sampling=sampling.Select(Fact),tails=tails.Select(Fact),recovery,representativeSamplingFailure=sampling.FirstOrDefault(c=>!c.FinalJoined),representativeTailFailure=tails.FirstOrDefault(c=>c.InitialTurn==20&&c.FinalStandalone&&!c.FinalJoined)};
        string file=args.Length>0?args[0]:"stroke-recovery-red.json";Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(file)));File.WriteAllText(file,JsonSerializer.Serialize(report,Json));
        Console.WriteLine(JsonSerializer.Serialize(new{report.status,report.runtimeMs,report.samplingCount,report.samplingFinals,report.tailCount,report.tailFinals,baseFailures=report.baseFailures.Count,report.recoveryCount,report.recoveryFinals,samplingFailed=sampling.Where(c=>!c.FinalJoined).Select(c=>new{c.First,c.Step,c.InitialTurn,c.FinalStandalone,c.FinalRejected}),recovery=recovery.Select(c=>new{c.First,c.JoinedAccepted,c.LastAcceptedLength,c.EndpointError,c.FinalRejected})}));return report.status=="PASS"?0:1;
    }
}
