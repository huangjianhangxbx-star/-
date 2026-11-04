using System.Text.Json;
using XingHai.BridgeReplica;

static class Program
{
    static readonly JsonSerializerOptions Json=new(){WriteIndented=true,IncludeFields=true};
    sealed record Fact(string Name,bool ExpectedValid,bool ActualValid,bool Pass,string Reason,int Nodes,float LastX,float LastZ,float MinTriangleArea);
    static readonly List<Fact> Facts=new();
    static RouteDocument Route(params(float x,float z)[] p)
    {var d=new RouteDocument{SchemaVersion=2,Id="bend-feasibility",KitId="workshop.bridge.A",KitVersion="1",Width=2};for(int i=0;i<p.Length;i++)d.Nodes.Add(new RouteNode{Id="n"+i,X=p[i].x,Y=2,Z=p[i].z});return d;}
    static float Area(float ax,float az,float bx,float bz,float cx,float cz)=>(bx-ax)*(cz-az)-(bz-az)*(cx-ax);
    static float MinArea(CurveResult r)
    {float m=float.MaxValue;for(int i=1;i<r.Frames.Count;i++){var a=r.Frames[i-1];var b=r.Frames[i];m=Math.Min(m,Area(a.LeftX,a.LeftZ,a.RightX,a.RightZ,b.LeftX,b.LeftZ));m=Math.Min(m,Area(a.RightX,a.RightZ,b.RightX,b.RightZ,b.LeftX,b.LeftZ));}return m;}
    static void Check(string name,bool expected,Func<(CurveResult result,RouteNode target)> run)
    {
        try{var(r,target)=run();float min=MinArea(r);var last=r.Document?.Nodes.LastOrDefault();bool endpoint=!r.Valid||target==null||r.Document.Nodes.Any(n=>Math.Abs(n.X-target.X)<.0001f&&Math.Abs(n.Z-target.Z)<.0001f);bool pass=r.Valid==expected&&endpoint&&(!r.Valid||min>0);Facts.Add(new(name,expected,r.Valid,pass,r.Message,r.Document?.Nodes.Count??0,last?.X??0,last?.Z??0,min));}
        catch(Exception e){Facts.Add(new(name,expected,false,!expected,e.Message,0,0,0,0));}
    }
    static (CurveResult result,RouteNode target) JoinArc(float radius,float angle,int steps,bool first,float initialTurn=0)
    {
        var b=Route((0,0),(8,0));var endpoint=first?b.Nodes.First():b.Nodes.Last();float direction=first?-1:1;var raw=new List<RouteNode>{endpoint.Clone()};float rot=initialTurn*MathF.PI/180;
        for(int i=1;i<=steps;i++){float t=angle*MathF.PI/180*i/steps,u=radius*MathF.Sin(t),v=radius*(1-MathF.Cos(t));raw.Add(new RouteNode{Id="s"+i,X=endpoint.X+direction*(MathF.Cos(rot)*u-MathF.Sin(rot)*v),Y=2,Z=endpoint.Z+direction*(MathF.Sin(rot)*u+MathF.Cos(rot)*v)});}
        var stroke=CurveSketch.Build(raw,0,2);foreach(var n in stroke.Nodes)n.Y=2;var joined=first?CurveEdits.PrependStroke(b,stroke.Nodes):CurveEdits.AppendStroke(b,stroke.Nodes);return(CurveSolver.Solve(joined),raw.Last());
    }
    static (CurveResult,RouteNode) Solve(params(float x,float z)[] points)=>(CurveSolver.Solve(Route(points)),null);
    static int Main(string[] args)
    {
        foreach(bool first in new[]{false,true})foreach(int steps in new[]{1,2,3,6,22}){var f=first;var s=steps;Check($"R2.8-110deg-{(f?"first":"last")}-{s}samples",true,()=>JoinArc(2.8f,110,s,f));}
        foreach(bool first in new[]{false,true})foreach(float spacing in new[]{.05f,.25f,1f,2f}){var f=first;int steps=(int)Math.Ceiling(6/spacing);Check($"R6-45deg-start-{(f?"first":"last")}-spacing{spacing}",true,()=>JoinArc(6,180/MathF.PI,steps,f,45));}
        Check("hard-90deg-long-L-rejected",false,()=>Solve((0,0),(8,0),(8,6)));
        Check("short-final-90deg-rejected",false,()=>Solve((0,0),(8,0),(8,.1f)));
        Check("short-first-90deg-rejected",false,()=>Solve((0,0),(.1f,0),(.1f,8)));
        Check("short-final-60deg-fold-rejected",false,()=>Solve((0,0),(8,0),(8.05f,.08660254f)));
        Check("short-first-60deg-fold-rejected",false,()=>Solve((0,0),(.1f,0),(4.1f,6.928203f)));
        Check("exact-retrace-rejected",false,()=>Solve((0,0),(8,0),(4,0)));
        Check("subwidth-hairpin-rejected",false,()=>Solve((0,0),(6,0),(6,.2f),(0,.2f)));
        Check("selfcross-with-all-45deg-turns-rejected",false,()=>Solve((0,0),(6,0),(9,3),(9,9),(6,12),(0,12),(-3,9),(-3,3),(0,0),(6,0)));
        Check("subwidth-parallel-return-rejected",false,()=>Solve((0,0),(8,0),(8,3),(0,3),(0,1),(7,1)));
        Check("75deg-long-corner-physically-valid",true,()=>Solve((0,0),(8,0),(9.552914f,5.795555f)));
        var report=new{status=Facts.All(f=>f.Pass)?"PASS":"FAIL",scope="Linked actual production Core only. Tests accepted sparse bends and real local ribbon triangle orientation; no Engine or physical mouse claim.",total=Facts.Count,passed=Facts.Count(f=>f.Pass),failed=Facts.Count(f=>!f.Pass),cases=Facts};
        string file=args.Length>0?args[0]:"bend-feasibility-report.json";File.WriteAllText(file,JsonSerializer.Serialize(report,Json));Console.WriteLine(JsonSerializer.Serialize(new{report.status,report.total,report.passed,report.failed,failures=Facts.Where(f=>!f.Pass)}));return report.status=="PASS"?0:1;
    }
}
