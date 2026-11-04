using System.Reflection;
using System.Text.Json;
using XingHai.BridgeReplica;

static class Program
{
    static readonly JsonSerializerOptions Json=new(){WriteIndented=true,IncludeFields=true};
    static readonly List<object> checks=new();
    sealed record Built(RouteDocument Doc,bool Rounded,List<RouteNode> Keys,string Notice);
    static RouteNode P(float x,float z=0,float y=0,string id="p")=>new(){Id=id,X=x,Y=y,Z=z};
    static string Bytes(object value)=>JsonSerializer.Serialize(value,Json);
    static void Need(bool condition,string message){if(!condition)throw new InvalidOperationException(message);}
    static void Near(float value,float wanted,string message,float tolerance=.0001f)=>Need(MathF.Abs(value-wanted)<=tolerance,message+": "+value+" != "+wanted);
    static void Check(string name,Action action){try{action();checks.Add(new{name,status="PASS",error=""});}catch(Exception e){checks.Add(new{name,status="FAIL",error=e.Message});}}
    static void Reject(Action action,string contains=null)
    {try{action();}catch(ArgumentException e){if(contains!=null)Need(e.Message.Contains(contains),"wrong rejection: "+e.Message);return;}throw new InvalidOperationException("expected rejection");}
    static Built Build(List<RouteNode> input,float height=0,float width=2,List<RouteNode> keys=null)
    {
        var type=typeof(CurveSketch).Assembly.GetType("XingHai.BridgeReplica.CurveBrush")??throw new InvalidOperationException("MISSING: production CurveBrush module");
        var method=type.GetMethod("Build",BindingFlags.Public|BindingFlags.Static)??throw new InvalidOperationException("MISSING: CurveBrush.Build");
        object[] args={input,height,width,keys,false,null,null};
        try{var doc=(RouteDocument)method.Invoke(null,args);return new(doc,(bool)args[4],(List<RouteNode>)args[5],(string)args[6]);}catch(TargetInvocationException e){throw e.InnerException??e;}
    }
    static List<RouteNode> Sample(List<RouteNode> points,float gap)
    {
        var output=new List<RouteNode>{points[0].Clone()};
        for(int i=1;i<points.Count;i++){var a=points[i-1];var b=points[i];float d=MathF.Sqrt((b.X-a.X)*(b.X-a.X)+(b.Z-a.Z)*(b.Z-a.Z));for(float s=gap;s<d-.0001f;s+=gap)output.Add(P(a.X+(b.X-a.X)*s/d,a.Z+(b.Z-a.Z)*s/d));output.Add(b.Clone());}return output;
    }
    static List<RouteNode> Corner(float angle,float leg,float gap)
    {float t=angle*MathF.PI/180;return Sample(new(){P(0),P(leg),P(leg+MathF.Cos(t)*leg,MathF.Sin(t)*leg)},gap);}
    static RouteDocument Base()=>new(){SchemaVersion=2,Id="old-route",Revision=9,KitId="workshop.bridge.A",KitVersion="1",Width=2,Nodes=new(){P(0,0,2,"old-first"),P(8,0,2,"old-last")}};
    public static int Main(string[] args)
    {
        Check("successful-strict-sketch-remains-byte-identical",()=>{var input=Sample(new(){P(0),P(12,2)},.25f);string before=Bytes(input);var old=CurveSketch.Build(input,2,2);var b=Build(input,2);Need(!b.Rounded&&b.Keys==null&&Bytes(b.Doc)==Bytes(old),"valid strict sketch changed");Need(Bytes(input)==before,"input changed");});
        Check("height-only-failure-does-not-trigger-rounding",()=>Reject(()=>Build(new(){P(0),P(4)},0,2,new(){P(0,0,2),P(.5f,0,4)}),"过陡"));
        foreach(float leg in new[]{6f,8f,10f})foreach(float turn in new[]{90f,100f,120f})foreach(float gap in new[]{.25f,1f,2f})
        {float l=leg,t=turn,g=gap;Check($"round-{t}-leg{l}-gap{g}",()=>{var raw=Corner(t,l,g);string before=Bytes(raw);var b=Build(raw);Need(b.Rounded&&b.Notice.Contains("已按桥宽自动圆角"),"designed corner not reported");Need(CurveSolver.Solve(b.Doc).Valid,"rounded bridge does not solve");Need(b.Doc.Nodes[0].X==raw[0].X&&b.Doc.Nodes[0].Z==raw[0].Z&&b.Doc.Nodes[^1].X==raw[^1].X&&b.Doc.Nodes[^1].Z==raw[^1].Z,"true endpoints moved");Need(Bytes(raw)==before,"mouse intent changed");});}
        Check("140-degree-probe-with-room",()=>{var b=Build(Corner(140,10,.5f));Need(b.Rounded&&CurveSolver.Solve(b.Doc).Valid,"140 degree spacious probe failed");});
        Check("right-turns-and-width-scaled-corners",()=>{foreach(float angle in new[]{-90f,-120f})Need(Build(Corner(angle,8,1)).Rounded,"right turn failed");foreach(float width in new[]{.5f,1f,4f,6f}){var b=Build(Corner(90,10,1),0,width);Need(b.Rounded&&CurveSolver.Solve(b.Doc).Valid,"scaled bridge width failed: "+width);}});
        Check("two-local-corners-map-height-keys-in-order",()=>
        {
            var raw=Sample(new(){P(0),P(8),P(8,8),P(16,8)},.5f);var keys=new List<RouteNode>{P(0,0,2,"h0"),P(8,0,3,"h1"),P(8,8,3,"h2"),P(16,8,2,"h3")};var b=Build(raw,0,2,keys);
            Need(b.Rounded&&b.Keys.Count==4&&CurveSolver.Solve(b.Doc).Valid,"multiple rounded corners/profile invalid");for(int i=0;i<keys.Count;i++)Need(b.Keys[i].Y==keys[i].Y&&b.Keys[i].Id==keys[i].Id,"multi-corner height key changed");
        });
        Check("small-legs-explain-required-space",()=>{Reject(()=>Build(Corner(90,2,.25f)),"继续延长");Reject(()=>Build(Corner(140,6,.5f)),"继续延长");});
        Check("actual-raw-backtracking-and-self-cross-stay-rejected",()=>{Reject(()=>Build(Sample(new(){P(0),P(8),P(1)},.5f)));Reject(()=>Build(Sample(new(){P(0),P(8),P(2,6),P(6,-2)},.5f)));});
        Check("rounded-first-and-tail-additions-preserve-old-author",()=>
        {
            foreach(bool first in new[]{false,true})
            {
                var old=Base();string before=Bytes(old);var raw=Corner(100,8,1);foreach(var p in raw){p.X=first?-p.X:p.X+8;p.Z=first?-p.Z:p.Z;}
                var b=Build(raw);foreach(var p in b.Doc.Nodes)p.Y=2;
                var joined=first?CurveEdits.PrependStroke(old,b.Doc.Nodes):CurveEdits.AppendStroke(old,b.Doc.Nodes);
                Need(CurveSolver.Solve(joined).Valid,"rounded addition not feasible with immutable old endpoint");Need(Bytes(old)==before&&old.Nodes.All(n=>joined.Nodes.Any(p=>Bytes(p)==Bytes(n))),"saved old author changed");
            }
        });
        Check("corner-height-key-is-mapped-with-order-count-id-and-Y",()=>
        {
            var raw=Corner(90,8,.5f);var keys=new List<RouteNode>{P(0,0,2,"h0"),P(8,0,3,"peak"),P(8,8,2,"h1")};string before=Bytes(keys);var b=Build(raw,0,2,keys);
            Need(b.Rounded&&b.Keys.Count==3,"height keys dropped");for(int i=0;i<keys.Count;i++)Need(b.Keys[i].Id==keys[i].Id&&b.Keys[i].Y==keys[i].Y,"key identity/height changed");
            Need(MathF.Abs(b.Keys[1].X-8)>.1f&&b.Keys[1].Z>.1f,"sharp-corner key was left off the visible arc");Need(Bytes(keys)==before,"source keys mutated");Need(CurveSolver.Solve(b.Doc).Valid,"mapped profile invalid");
        });
        Check("keys-already-on-rounded-design-are-not-shifted",()=>
        {
            var raw=Corner(90,8,.5f);var initial=Build(raw);var c=CurveSolver.Solve(initial.Doc);var f=c.FrameAt(c.Length*.5f);var key=P(f.X,f.Z,3,"already-visible");
            var b=Build(raw,0,2,new(){P(0,0,2,"h0"),key,P(8,8,2,"h1")});Need(b.Keys[1].X==key.X&&b.Keys[1].Z==key.Z&&b.Keys[1].Y==key.Y,"visible height key moved");
        });
        Check("retract-follows-returned-visible-round-guide",()=>
        {
            var b=Build(Corner(90,8,.5f));var c=CurveSolver.Solve(b.Doc);var f=c.FrameAt(c.Length*.5f);var pointer=P(f.X,f.Z,99);
            Need(CurveGesture.TryRetract(b.Doc.Nodes,pointer,.08f,out var trimmed),"visible-arc retraction failed");Near(trimmed[^1].X,f.X,"visible cut X");Near(trimmed[^1].Z,f.Z,"visible cut Z");Need(MathF.Min(MathF.Abs(f.X-8),MathF.Abs(f.Z))>.1f,"fixture not inside rounded-away raw corner");
        });
        Check("rounded-height-oversteep-is-still-rejected",()=>Reject(()=>Build(Corner(90,6,.5f),0,2,new(){P(0,0,2),P(6,0,8),P(6,6,2)}),"过陡"));
        Check("short-stroke-and-invalid-options-not-rounded",()=>{Reject(()=>Build(new(){P(0),P(.3f)}));Reject(()=>Build(Corner(90,8,1),9));Reject(()=>Build(Corner(90,8,1),0,.1f));});
        var failed=checks.Count(c=>(string)c.GetType().GetProperty("status").GetValue(c)!="PASS");
        var report=new{status=failed==0?"PASS":"FAIL",scope="Production CurveBrush -> unchanged strict CurveSketch/CurveSolver/CurveGesture; explicit design corner rounding may depart metres from raw intent. No Window, engine, actual mesh/collider or physical-input claim.",total=checks.Count,passed=checks.Count-failed,checks};
        string output=args.Length>0?args[0]:"curve-brush-core.json";Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output)));File.WriteAllText(output,JsonSerializer.Serialize(report,Json));Console.WriteLine(JsonSerializer.Serialize(new{report.status,report.total,report.passed,failures=checks.Where(c=>(string)c.GetType().GetProperty("status").GetValue(c)!="PASS")}));return failed==0?0:1;
    }
}
