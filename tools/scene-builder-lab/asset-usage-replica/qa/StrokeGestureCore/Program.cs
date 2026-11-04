using System.Reflection;
using System.Text.Json;
using XingHai.BridgeReplica;

static class Program
{
    static readonly JsonSerializerOptions Json=new(){WriteIndented=true,IncludeFields=true};
    static readonly List<object> checks=new();
    static Type Module=>typeof(CurveSketch).Assembly.GetType("XingHai.BridgeReplica.CurveGesture")??throw new InvalidOperationException("MISSING: production CurveGesture module");
    static object Call(string name,params object[] args)
    {
        var method=Module.GetMethod(name,BindingFlags.Public|BindingFlags.Static)??throw new InvalidOperationException("MISSING: CurveGesture."+name);
        try{return method.Invoke(null,args);}catch(TargetInvocationException e){throw e.InnerException??e;}
    }
    static RouteNode N(string id,float x,float z=0,float y=2)=>new(){Id=id,X=x,Y=y,Z=z};
    static RouteDocument Doc(params RouteNode[] nodes)=>new(){SchemaVersion=2,Id="gesture-route",KitId="workshop.bridge.A",KitVersion="1",Width=2,Revision=7,Nodes=nodes.ToList()};
    static string Bytes(object value)=>JsonSerializer.Serialize(value,Json);
    static void Need(bool condition,string message){if(!condition)throw new InvalidOperationException(message);}
    static void Near(float actual,float expected,string message,float e=.0001f)=>Need(MathF.Abs(actual-expected)<=e,message+": "+actual+" != "+expected);
    static void Rejected(Action action,string message){try{action();}catch(ArgumentException){return;}throw new InvalidOperationException(message);}
    static void Check(string name,Action action){try{action();checks.Add(new{name,status="PASS",error=""});}catch(Exception e){checks.Add(new{name,status="FAIL",error=e.Message});}}
    static List<RouteNode> Retract(List<RouteNode> raw,RouteNode pointer,float tolerance,bool expected)
    {
        object[] args={raw,pointer,tolerance,null};bool ok=(bool)Call("TryRetract",args);Need(ok==expected,"unexpected retract state");return (List<RouteNode>)args[3];
    }
    static RouteDocument Trim(RouteDocument doc,bool first,float arc,string id="cut")=>(RouteDocument)Call("TrimAuthor",doc,first,arc,id);
    static List<RouteNode> Keys(RouteDocument doc)=>(List<RouteNode>)Call("ProfileKeys",doc);
    static RouteDocument Height(RouteDocument contour,params RouteNode[] keys)=>(RouteDocument)Call("ApplyHeightProfile",contour,keys.ToList());
    static RouteDocument OpenDoc()
    {
        var d=Doc(N("a",0),N("b",8),N("c",16));d.Openings.Add(new(){SegmentId="a__b",Width=2,Height=1});Need(CurveSolver.Solve(d).Valid,"opening fixture must be valid");return d;
    }
    public static int Main(string[] argv)
    {
        Check("projection-uses-XZ-arc-and-interpolated-height",()=>{var d=Doc(N("a",0),N("b",4),N("c",4,4,4));object[] a={d,N("pointer",5,2,99),0f,null};Near((float)Call("Project",a),1,"distance");Near((float)a[2],6,"arc");var p=(RouteNode)a[3];Near(p.X,4,"foot X");Near(p.Z,2,"foot Z");Near(p.Y,3,"foot Y");});
        Check("retract-interior-preserves-prefix-and-interpolates-Y",()=>{var raw=new List<RouteNode>{N("a",0,0,2),N("b",2,0,3),N("c",4,0,4)};string before=Bytes(raw);var t=Retract(raw,N("pointer",3,.05f,99),.1f,true);Need(t.Count==3&&t[0].Id=="a"&&t[1].Id=="b","prefix identity");Near(t[^1].X,3,"cut X");Near(t[^1].Z,0,"cut Z");Near(t[^1].Y,3.5f,"cut Y");Need(Bytes(raw)==before,"raw authority changed");});
        Check("retract-point-one-metre-hysteresis",()=>{var raw=new List<RouteNode>{N("a",0),N("b",4)};Need(Retract(raw,N("p",3.95f),.1f,false)==null,"false retract must return no candidate");Retract(raw,N("p",3.8f),.1f,true);});
        Check("retract-rejects-far-path-and-forward-pointer",()=>{var raw=new List<RouteNode>{N("a",0),N("b",4)};Retract(raw,N("p",3,.5f),.1f,false);Retract(raw,N("p",5),.1f,false);});
        Check("retract-can-return-origin-only",()=>{var raw=new List<RouteNode>{N("a",0),N("b",2),N("c",4)};var t=Retract(raw,N("p",0),.1f,true);Need(t.Count==1&&t[0].Id=="a","origin retraction must be one cloned node");Need(!ReferenceEquals(t[0],raw[0]),"origin alias");});
        Check("trim-tail-preserves-authority-and-enabled-untouched-opening",()=>{var d=OpenDoc();string before=Bytes(d);var t=Trim(d,false,12);Need(t.Nodes.Count==3&&t.Nodes[0].Id=="a"&&t.Nodes[1].Id=="b"&&t.Nodes[2].Id=="cut","tail IDs");Near(t.Nodes[^1].X,12,"tail cut");Need(t.Id==d.Id&&t.KitId==d.KitId&&t.KitVersion==d.KitVersion&&t.Revision==7,"route metadata");Need(t.Openings.Count==1&&Bytes(t.Openings[0])==Bytes(d.Openings[0]),"untouched opening");Need(Bytes(d)==before,"source author changed");});
        Check("trim-head-preserves-retained-original-nodes",()=>{var d=Doc(N("a",0,0,1),N("b",8,0,3),N("c",16,0,3));var t=Trim(d,true,4);Need(t.Nodes.Count==3&&t.Nodes[0].Id=="cut"&&t.Nodes[1].Id=="b"&&t.Nodes[2].Id=="c","head IDs");Near(t.Nodes[0].X,4,"head cut");Near(t.Nodes[0].Y,2,"head height");Need(Bytes(t.Nodes[1])==Bytes(d.Nodes[1]),"retained node data");});
        Check("trim-exact-node-reuses-original-id",()=>{var d=Doc(N("a",0),N("b",8),N("c",16));var t=Trim(d,false,8,"unused");Need(t.Nodes.Count==2&&t.Nodes[^1].Id=="b","exact node cut created another identity");});
        Check("trim-rejects-cut-through-enabled-opening",()=>Rejected(()=>Trim(OpenDoc(),false,4),"active opening was silently cut"));
        Check("trim-rejects-removing-enabled-opening",()=>Rejected(()=>Trim(OpenDoc(),true,8),"active opening was silently removed"));
        Check("trim-rejects-too-short-and-outside-range",()=>{var d=Doc(N("a",0),N("b",8));Rejected(()=>Trim(d,false,.49f),"subminimum author accepted");Rejected(()=>Trim(d,true,8.1f),"outside cut accepted");});
        Check("profile-keys-compress-height-not-planar-turns",()=>{var d=Doc(N("a",0),N("b",2),N("c",2,2),N("d",4,2));var k=Keys(d);Need(k.Count==2&&k[0].Id=="a"&&k[^1].Id=="d","flat profile must retain only ends");});
        Check("profile-keys-retain-actual-slope-change",()=>{var d=Doc(N("a",0,0,2),N("b",1,0,2.5f),N("c",2,0,3),N("d",4,0,3));var k=Keys(d);Need(k.Count==3&&k[1].Id=="c","height slope corner lost");});
        Check("height-straight-peak-survives-planar-simplification",()=>{var c=Doc(N("a",0,0,0),N("b",4,0,0));var t=Height(c,N("h0",0,0,2),N("peak",2,0,3),N("h1",4,0,2));Need(t.Nodes.Count==3&&t.Nodes[0].Id=="a"&&t.Nodes[^1].Id=="b","contour identities");Near(t.Nodes[1].X,2,"peak position");Near(t.Nodes[1].Y,3,"peak height");Need(CurveSolver.Solve(t).Valid,"peak slope must be feasible");});
        Check("height-last-key-extends-at-constant-height",()=>{var t=Height(Doc(N("a",0,0,0),N("b",8,0,0)),N("h0",0,0,2),N("h1",2,0,3));Near(t.Nodes[^1].Y,3,"last height must continue flat");Need(t.Nodes.Any(n=>MathF.Abs(n.X-2)<.0001f&&MathF.Abs(n.Y-3)<.0001f),"ramp stop key missing");});
        Check("height-keeps-continuous-intermediate-values",()=>{var t=Height(Doc(N("a",0,0,0),N("b",.3f,0,0),N("c",.6f,0,0)),N("h0",0,0,2),N("h1",.6f,0,2.25f));Near(t.Nodes.Single(n=>n.Id=="b").Y,2.125f,"intermediate node was rounded");Need(CurveSolver.Solve(t).Valid,"legal .4167 slope rejected");});
        Check("height-projects-keys-without-moving-contour-XZ",()=>{var c=Doc(N("a",0),N("middle",4),N("b",8));string before=Bytes(c);var t=Height(c,N("h0",0,0,2),N("h1",2,.08f,3));Need(t.Nodes.All(n=>n.Z==0),"contour was moved toward key");foreach(var n in c.Nodes){var p=t.Nodes.Single(x=>x.Id==n.Id);Need(p.X==n.X&&p.Z==n.Z,"original XZ changed");}Need(Bytes(c)==before,"contour mutation");Need(Bytes(t)==Bytes(Height(c,N("h0",0,0,2),N("h1",2,.08f,3))),"derived node identities are nondeterministic");});
        Check("height-rejects-off-contour-and-reversed-keys",()=>{var c=Doc(N("a",0),N("b",8));Rejected(()=>Height(c,N("h0",0),N("h1",2,.101f,3)),"off-path key accepted");Rejected(()=>Height(c,N("h0",0),N("h1",4),N("h2",2)),"reversed profile accepted");});
        Check("height-rejects-oversteep-range-and-vertical-at-same-arc",()=>{var c=Doc(N("a",0),N("b",4));Rejected(()=>Height(c,N("h0",0),N("h1",.5f,0,3)),"steep ramp accepted");Rejected(()=>Height(c,N("h0",0),N("h1",4,0,8.25f)),"out-of-range height accepted");Rejected(()=>Height(c,N("h0",0),N("h1",0,0,3)),"zero-run vertical edit accepted");});
        Check("empty-height-profile-preserves-automatic-approach",()=>{var c=CurveSketch.Build(new List<RouteNode>{N("s0",0),N("s1",12)},2,2);string before=Bytes(c);var t=Height(c);Need(Bytes(t)==before&&Bytes(c)==before,"default approach changed without explicit height keys");});
        var failed=checks.Count(c=>((string)c.GetType().GetProperty("status").GetValue(c))!="PASS");var report=new{status=failed==0?"PASS":"FAIL",scope="Pure production CurveGesture helpers; no engine, physical mouse, or Window acceptance claim",total=checks.Count,passed=checks.Count-failed,checks};
        string output=argv.Length>0?argv[0]:"stroke-gesture-core.json";Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output)));File.WriteAllText(output,JsonSerializer.Serialize(report,Json));Console.WriteLine(JsonSerializer.Serialize(new{report.status,report.total,report.passed,failures=checks.Where(c=>((string)c.GetType().GetProperty("status").GetValue(c))!="PASS")}));return failed==0?0:1;
    }
}
