using System.Reflection;
using System.Text.Json;
using XingHai.BridgeReplica;

static class Program
{
    static readonly List<object> checks=new();
    static object Field(object o,string name)=>o.GetType().GetField(name).GetValue(o);
    static float F(object o,string name)=>Convert.ToSingle(Field(o,name));
    static void Need(bool condition,string error){if(!condition)throw new Exception(error);}
    static void Check(string name,Action run){try{run();checks.Add(new{name,status="PASS",error=""});}catch(Exception e){checks.Add(new{name,status="FAIL",error=e.GetBaseException().Message});}}
    static object Solve(RouteDocument d)
    {
        var t=typeof(RouteDocument).Assembly.GetType("XingHai.BridgeReplica.CurveSolver");
        Need(t!=null,"Free-direction CurveSolver is not implemented.");
        return t.GetMethod("Solve").Invoke(null,new object[]{d});
    }
    static List<object> Frames(object result)=>((System.Collections.IEnumerable)Field(result,"Frames")).Cast<object>().ToList();
    static RouteDocument Route(params (float x,float z)[] xy)
    {var d=new RouteDocument{SchemaVersion=2,Width=2,Id="curve-test",KitId="workshop.bridge.A",KitVersion="1"};for(int i=0;i<xy.Length;i++)d.Nodes.Add(new RouteNode{Id="n"+i,X=xy[i].x,Y=2,Z=xy[i].z});return d;}
    static double Distance(float x,float z,RouteNode a,RouteNode b)
    {double dx=b.X-a.X,dz=b.Z-a.Z,t=Math.Clamp(((x-a.X)*dx+(z-a.Z)*dz)/(dx*dx+dz*dz),0,1);return Math.Sqrt(Math.Pow(x-a.X-t*dx,2)+Math.Pow(z-a.Z-t*dz,2));}
    static void CheckFaithful(RouteDocument d)
    {
        var r=Solve(d);Need((bool)Field(r,"Valid"),(string)Field(r,"Message"));var ff=Frames(r);
        Need(ff.Count>2,"Expected arc-length geometry stations, not only endpoints.");
        foreach(var f in ff)Need(Enumerable.Range(0,d.Nodes.Count-1).Min(i=>Distance(F(f,"X"),F(f,"Z"),d.Nodes[i],d.Nodes[i+1]))<=.001,"Generated centerline departed from authored stroke.");
        foreach(var n in d.Nodes)Need(ff.Min(f=>Math.Sqrt(Math.Pow(F(f,"X")-n.X,2)+Math.Pow(F(f,"Z")-n.Z,2)))<=.001,"An authored turn disappeared.");
        double inputArc=0;
        for(int i=1;i<d.Nodes.Count;i++)inputArc+=Math.Sqrt(Math.Pow(d.Nodes[i].X-d.Nodes[i-1].X,2)+Math.Pow(d.Nodes[i].Z-d.Nodes[i-1].Z,2));
        Need(Math.Abs(F(r,"Length")-inputArc)<.005,"Along-stroke correspondence or Euclidean arc length changed.");
        foreach(var f in ff)
        {
            double remaining=F(f,"Arc");int span=0;
            while(span<d.Nodes.Count-2){double len=DistanceBetween(d.Nodes[span],d.Nodes[span+1]);if(remaining<=len+.00001)break;remaining-=len;span++;}
            var a=d.Nodes[span];var b=d.Nodes[span+1];double t=Math.Clamp(remaining/DistanceBetween(a,b),0,1);
            Need(Math.Abs(F(f,"X")-(a.X+(b.X-a.X)*t))<.002&&Math.Abs(F(f,"Z")-(a.Z+(b.Z-a.Z)*t))<.002,"Arc station was matched to a different part of the stroke.");
        }
        Need(Math.Abs(F(ff[0],"X")-d.Nodes[0].X)<.001&&Math.Abs(F(ff[^1],"Z")-d.Nodes[^1].Z)<.001,"Stroke endpoints changed.");
        float la=-1,ra=-1;foreach(var f in ff){Need(F(f,"LeftArc")>=la&&F(f,"RightArc")>=ra,"Boundary arc lengths reversed.");la=F(f,"LeftArc");ra=F(f,"RightArc");}
    }
    static double DistanceBetween(RouteNode a,RouteNode b)=>Math.Sqrt(Math.Pow(a.X-b.X,2)+Math.Pow(a.Z-b.Z,2));
    static RouteDocument Example(string name)=>(RouteDocument)typeof(RouteDocument).Assembly.GetType("XingHai.BridgeReplica.CurveExamples").GetMethod(name).Invoke(null,null);
    static int Main(string[] args)
    {
        if(args.Contains("--legacy-red"))
        {
            var points=new List<RouteNode>();for(int i=0;i<=4;i++)points.Add(new RouteNode{X=i*5,Z=i*5});var old=RouteSketch.Build(points,0,2);
            double deviation=old.Nodes.Max(n=>Math.Abs(n.X-n.Z)/Math.Sqrt(2));
            Check("T1-diagonal-stays-on-input",()=>Need(deviation<=.1,"Legacy diagonal was converted into an L; deviation="+deviation));
        }
        else
        {
            Check("T1-five-point-diagonal",()=>CheckFaithful(Route((0,0),(5,5),(10,10),(15,15),(20,20))));
            Check("T1-non-45-heading",()=>CheckFaithful(Route((0,0),(12.3f,7.1f))));
            Check("T2-radius6-U-input-preserved",()=>CheckFaithful(Example("U")));
            Check("T2-radius6-S-input-preserved",()=>CheckFaithful(Example("S")));
            Check("T2-C-input-preserved",()=>CheckFaithful(Example("C")));
            Check("T4-inner-outer-lengths-differ",()=>{var r=Solve(Example("U"));Need((bool)Field(r,"Valid"),(string)Field(r,"Message"));var last=Frames(r)[^1];Need(Math.Abs(F(last,"LeftArc")-F(last,"RightArc"))>5.5,"Inner and outer arcs incorrectly use one shared count/length.");});
            Check("T4-edge-sampling-returns-physical-side-and-tangent",()=>
            {
                var r=(CurveResult)Solve(Example("U"));Need(r.Valid,r.Message);
                foreach(bool left in new[]{true,false})for(int i=0;i<r.Frames.Count-1;i++)
                {
                    var a=r.Frames[i];var b=r.Frames[i+1];float ax=left?a.LeftX:a.RightX,az=left?a.LeftZ:a.RightZ,bx=left?b.LeftX:b.RightX,bz=left?b.LeftZ:b.RightZ;
                    float edgeArc=((left?a.LeftArc:a.RightArc)+(left?b.LeftArc:b.RightArc))*.5f;var f=r.EdgeFrameAt(left,edgeArc);float length=(float)Math.Sqrt((bx-ax)*(bx-ax)+(bz-az)*(bz-az));
                    Need(Math.Abs(f.X-(ax+bx)*.5f)<.001&&Math.Abs(f.Z-(az+bz)*.5f)<.001,"Edge sampling returned the center instead of the physical edge.");
                    Need(Math.Abs(f.Arc-(a.Arc+b.Arc)*.5f)<.001,"Edge sample lost its corresponding center arc.");
                    Need(Math.Abs(f.TangentX-(bx-ax)/length)<.001&&Math.Abs(f.TangentZ-(bz-az)/length)<.001,"Edge tangent does not follow the actual side segment.");
                }
            });
            Check("T3-half-metre-stroke-creates-geometry",()=>{var d=CurveSketch.Build(new List<RouteNode>{new RouteNode(),new RouteNode{X=.5f}},2,2);Need(d.SchemaVersion==2,"Live stroke used the legacy author schema.");CheckFaithful(d);Need(d.Nodes.Max(n=>n.Y)==0,"Very short route was raised into an impossible slope.");});
            Check("T3-new-S-stroke-follows-samples-with-gradual-height",()=>{var samples=Example("S").Nodes;var d=CurveSketch.Build(samples,2,2);CheckFaithful(d);Need(d.Nodes.First().Y==0&&d.Nodes.Last().Y==0&&d.Nodes.Max(n=>n.Y)==2,"New stroke does not grow toward the requested height with valid approaches.");foreach(var sample in samples)Need(Enumerable.Range(0,d.Nodes.Count-1).Min(i=>Distance(sample.X,sample.Z,d.Nodes[i],d.Nodes[i+1]))<=.04,"Live simplification removed part of the S stroke.");});
            Check("T5-straight-span-opening-remains-void",()=>{var d=Example("U");var r=Solve(d);Need((bool)Field(r,"Valid"),(string)Field(r,"Message"));var oo=((System.Collections.IEnumerable)Field(r,"Openings")).Cast<object>().ToList();Need(oo.Count==1,"Expected one associated straight-span arch.");var o=oo[0];float mid=(F(o,"StartArc")+F(o,"EndArc"))*.5f;Need((float)o.GetType().GetMethod("HeightAt").Invoke(o,new object[]{mid})>=1,"Opening became a filled support.");});
            Check("T6-free-local-move-and-stable-identities",()=>{var d=Example("S");var before=d.Nodes[8].Clone();var t=typeof(RouteDocument).Assembly.GetType("XingHai.BridgeReplica.CurveEdits");var moved=(RouteDocument)t.GetMethod("MoveNode").Invoke(null,new object[]{d,8,before.X+.03f,before.Z+.03f});Need(d.Nodes[8].X==before.X&&moved.Nodes[8].Id==before.Id,"Edit mutated committed document or node identity.");CheckFaithful(moved);});
            Check("T6-endpoint-append-one-author",()=>{var d=Example("S");var last=d.Nodes[^1];var t=typeof(RouteDocument).Assembly.GetType("XingHai.BridgeReplica.CurveEdits");var continued=(RouteDocument)t.GetMethod("Append").Invoke(null,new object[]{d,last.X+3.7f,last.Y,last.Z+1.2f});Need(continued.Id==d.Id&&continued.Nodes.Count==d.Nodes.Count+1,"Continuation replaced author or lost endpoint.");CheckFaithful(continued);});
            Check("T10-self-crossing-rejected",()=>{var d=Route((0,0),(10,10),(0,10),(10,0));var r=Solve(d);Need(!(bool)Field(r,"Valid"),"Self-crossing input silently accepted.");Need(!string.IsNullOrEmpty((string)Field(r,"Message")),"Invalid location/reason missing.");});
            Check("T10-tight-hairpin-rejected",()=>{var r=Solve(Route((0,0),(6,0),(6,.2f),(0,.2f)));Need(!(bool)Field(r,"Valid"),"Sub-width hairpin accepted.");});
            Check("T9-legacy-schema-not-reinterpreted",()=>{var d=Route((0,0),(20,0));d.SchemaVersion=1;Need(!(bool)Field(Solve(d),"Valid"),"Legacy v1 was silently migrated to a curve.");});
        }
        bool pass=checks.All(x=>JsonSerializer.Serialize(x).Contains("\"PASS\""));
        var report=JsonSerializer.Serialize(new{status=pass?"PASS":"FAIL",scope="Pure production path geometry; does not certify engine meshes, physical input, source art, or original-game behavior.",checks},new JsonSerializerOptions{WriteIndented=true});
        Console.WriteLine(report);if(args.Length>1&&args[0]=="--report")File.WriteAllText(args[1],report);return pass?0:1;
    }
}
