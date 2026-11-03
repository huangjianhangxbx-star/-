using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using XingHai.SB03;

internal static class Program
{
    static int failed;
    static readonly List<object> results = new List<object>();
    static void Require(bool ok, string message) { if (!ok) throw new Exception(message); }
    static void Equal(float actual, float expected, string message) { Require(Math.Abs(actual - expected) < .0001f, message + ": " + actual + " != " + expected); }
    static void Test(string name, Action action)
    {
        try { action(); Console.WriteLine("PASS " + name); results.Add(new { name, status = "PASS" }); }
        catch (Exception error) { failed++; Console.WriteLine("FAIL " + name + ": " + error.Message); results.Add(new { name, status = "FAIL", error = error.Message }); }
    }
    static BridgePlan Default() { var plan = BridgeSolver.Solve(new BridgeSpec()); Require(plan.Valid, "default bridge must solve: " + plan.Message); return plan; }
    static string Fingerprint(BridgePlan plan) { return JsonSerializer.Serialize(plan, new JsonSerializerOptions { IncludeFields = true }); }
    static (float,float,float) SourceSize(string id)
    {
        switch (id)
        {
            case "sb03.tread": case "sb03.deck": case "sb03.abutment-cap": return (.5f,.25f,.5f);
            case "sb03.coping": return (.5f,.25f,.25f);
            case "sb03.rail": return (.5f,1,.125f);
            case "sb03.post": return (.25f,1.25f,.25f);
            case "sb03.arch-stone": return (.25f,.25f,.25f);
            case "sb03.arch-foot": case "sb03.keystone": return (.5f,.5f,.25f);
            default: throw new Exception("unknown source: " + id);
        }
    }
    static bool Inside(BridgeSolid b,float x,float y,float z) { const float e=.00001f;return x>b.MinX+e&&x<b.MaxX-e&&y>b.MinY+e&&y<b.MaxY-e&&z>b.MinZ+e&&z<b.MaxZ-e; }
    static bool Inside(BridgePart p,float x,float y,float z)
    {
        var (sx,sy,sz)=SourceSize(p.SourceId);
        bool quarter=Math.Abs(p.Yaw%180)>.001f;if(quarter){float old=sx;sx=sz;sz=old;}
        const float e=.00001f;return x>p.X-sx/2+e&&x<p.X+sx/2-e&&y>p.Y+e&&y<p.Y+sy-e&&z>p.Z-sz/2+e&&z<p.Z+sz/2-e;
    }
    static void Main(string[] args)
    {
        Test("default bridge derives approaches, deck and modular source placements",()=>{
            var p=Default();Equal(p.DeckStart,4,"eight quarter-rise steps need four metre run");Equal(p.DeckEnd,10,"symmetric approach");Require(p.StartSteps==8&&p.EndSteps==8,"step count");
            Require(p.Parts.Count(v=>v.SourceId=="sb03.tread")==80,"16 step stations across five .5m lanes");
            Require(p.Parts.Count(v=>v.SourceId=="sb03.deck")==60,"12 deck stations across five .5m lanes");
            Equal(p.WalkingHeightAt(.25f),.25f,"first step");Equal(p.WalkingHeightAt(3.75f),2,"last approach step");Equal(p.WalkingHeightAt(7),2,"deck");Equal(p.WalkingHeightAt(13.75f),.25f,"last descending step");
        });
        Test("protected opening is genuine full-width void with a solid crown",()=>{
            var p=Default();Equal(p.OpeningMinX,5,"opening left");Equal(p.OpeningMaxX,9,"opening right");Equal(p.OpeningCrown,1.25f,"opening crown");
            Require(p.ContainsOpening(7,1.2f,0),"centre must have usable clearance");Require(!p.ContainsOpening(7,1.3f,0),"above crown not void");
            Require(p.Solids.Any(v=>Inside(v,7.01f,1.6f,.1f)),"structural material above arch, not only source ornament");
            for(float x=5.025f;x<9;x+=.05f)for(float y=.025f;y<1.25f;y+=.05f)for(float z=-1.225f;z<1.25f;z+=.175f)
                if(p.ContainsOpening(x,y,z)) { Require(!p.Solids.Any(v=>Inside(v,x,y,z)),"core intrudes into void");Require(!p.Parts.Any(v=>Inside(v,x,y,z)),"source intrudes into void"); }
        });
        Test("every walking tile is supported to its underside",()=>{
            var p=Default();foreach(var v in p.Parts.Where(v=>v.Role=="stair.tread"||v.Role=="deck.surface"))
            { if(v.Y==0)continue;float below=v.Y-.01f;Require(p.Solids.Any(s=>Inside(s,v.X+.03125f,below,v.Z)),"unsupported walking tile "+v.Id); }
        });
        Test("all declared original roles are actually consumed with stable unique identities",()=>{
            var p=Default();var ids=new HashSet<string>(p.Parts.Select(v=>v.Id));Require(ids.Count==p.Parts.Count,"source placement IDs unique");
            foreach(string source in new[]{"sb03.tread","sb03.deck","sb03.coping","sb03.rail","sb03.post","sb03.arch-stone","sb03.arch-foot","sb03.keystone","sb03.abutment-cap"})Require(p.Parts.Any(v=>v.SourceId==source),"unused source "+source);
            Require(p.Parts.All(v=>!string.IsNullOrEmpty(v.Role)&&new[]{0f,90,180,270}.Contains(v.Yaw)),"role and permitted yaw");
            Require(Fingerprint(p)==Fingerprint(BridgeSolver.Solve(new BridgeSpec())),"repeat must not reshuffle source placements");
        });
        Test("dimensions coordinate rows, approaches and opening instead of scaling sources",()=>{
            var s=new BridgeSpec{Length=18,Width=3,DeckHeight=2.5f,ArchWidth=5,ArchHeight=1.75f,StartHeight=.5f,EndHeight=0};var p=BridgeSolver.Solve(s);Require(p.Valid,p.Message);
            Require(p.StartSteps==8&&p.EndSteps==10,"independent endpoint heights");Equal(p.DeckStart,4,"left run");Equal(p.DeckEnd,13,"right run");
            Require(p.Parts.Count(v=>v.SourceId=="sb03.tread")==108,"18 stations x6lanes");Equal(p.OpeningMaxX-p.OpeningMinX,5,"requested opening preserved");
            s.Width=2;Require(p.Spec.Width==3,"solver snapshot must not alias mutable request");var clone=p.Spec.Clone();clone.Length=20;Require(p.Spec.Length==18,"Clone independent");
        });
        Test("ground stairs and filled-support bridge are valid non-opening modes",()=>{
            var low=BridgeSolver.Solve(new BridgeSpec{Length=6,DeckHeight=.5f,Opening=false,Rails=false});Require(low.Valid,low.Message);Require(!low.Parts.Any(v=>v.SourceId=="sb03.rail"||v.SourceId=="sb03.post"),"rail toggle must remove source roles");Require(!low.ContainsOpening(3,.1f,0),"disabled opening no void");
            var ground=BridgeSolver.Solve(new BridgeSpec{Length=6,DeckHeight=.25f,Opening=false});Require(ground.Valid,ground.Message);
        });
        Test("bad recipes reject before returning any partial geometry",()=>{
            var bad=new List<BridgeSpec>{new BridgeSpec{Length=8},new BridgeSpec{Width=2.75f},new BridgeSpec{Width=0},new BridgeSpec{Length=1000},new BridgeSpec{Length=float.NaN},new BridgeSpec{ArchHeight=2},new BridgeSpec{ArchWidth=7},new BridgeSpec{DeckHeight=-1},new BridgeSpec{StartHeight=3},new BridgeSpec{Id=""},new BridgeSpec{EndHeight=float.PositiveInfinity},new BridgeSpec{Length=14.25f}};
            foreach(var s in bad){var p=BridgeSolver.Solve(s);Require(!p.Valid,"invalid recipe accepted");Require(p.Parts.Count==0&&p.Solids.Count==0,"invalid result leaked partial geometry");Require(!string.IsNullOrEmpty(p.Message),"rejection reason required");}
            Require(!BridgeSolver.Solve(null).Valid,"null recipe reject");
        });
        Test("maximum supported bridge stays bounded and source poses retain world grid",()=>{
            var p=BridgeSolver.Solve(new BridgeSpec{Length=40,Width=6,DeckHeight=5,ArchWidth=8,ArchHeight=4.25f});Require(p.Valid,p.Message);Require(p.Parts.Count<5000&&p.Solids.Count<512,"maximum source/core budget");
            foreach(var s in p.Solids)Require(s.MinX<s.MaxX&&s.MinY<s.MaxY&&s.MinZ<s.MaxZ,"no zero or inverted core");
            var sw=Stopwatch.StartNew();for(int i=0;i<50;i++)BridgeSolver.Solve(new BridgeSpec());sw.Stop();Console.WriteLine("METRIC 50 default solves "+sw.Elapsed.TotalMilliseconds.ToString("F2")+" ms");
        });
        Test("high arch coursing forms a connected band from springing to crown",()=>{
            // A tall allowed arch used to leave loose quarter-metre stones
            // above its feet and wherever adjacent soffit columns jump.
            var p=BridgeSolver.Solve(new BridgeSpec{Length=40,Width=6,DeckHeight=5,ArchWidth=8,ArchHeight=4.25f});Require(p.Valid,p.Message);
            var band=p.Parts.Where(v=>v.Z>0&&(v.Role=="arch.course"||v.Role=="arch.springing"||v.Role=="arch.crown")).ToList();
            var seen=new HashSet<string>{band.Single(v=>v.Role=="arch.crown").Id};bool added=true;
            while(added){added=false;foreach(var a in band.Where(v=>!seen.Contains(v.Id)))foreach(var b in band.Where(v=>seen.Contains(v.Id)).ToArray())
                {var (ax,ay,az)=SourceSize(a.SourceId);var (bx,by,bz)=SourceSize(b.SourceId);float dx=Math.Abs(a.X-b.X),dy=Math.Abs(a.Y+ay/2-b.Y-by/2);
                 if(dx<(ax+bx)/2+.001f&&dy<(ay+by)/2+.001f){seen.Add(a.Id);added=true;break;}}}
            Require(seen.Count==band.Count,"every arch source must join the same stepped ring; disconnected="+(band.Count-seen.Count));
        });
        Test("opening clears both decorated entrances as well as the inner wall width",()=>{
            var p=Default();
            // Literal opening samples, independent of ContainsOpening: this
            // catches a source block placed in front of either portal.
            foreach(var sample in new[]{(5.125f,.25f),(5.625f,.75f),(6.625f,1f),(7.375f,1f),(8.875f,.25f)})
                for(float z=-2;z<2;z+=.0625f)
                {Require(!p.Solids.Any(v=>Inside(v,sample.Item1,sample.Item2,z)),"core blocks entrance");Require(!p.Parts.Any(v=>Inside(v,sample.Item1,sample.Item2,z)),"source blocks entrance");}
        });
        Test("legal recipe envelope has grounded sources, finite positive solids and clearance",()=>{
            int solved=0;
            foreach(float height in new[]{.5f,1,1.5f,2,3,4,5})foreach(float width in new[]{1f,2.5f,6})foreach(bool hole in new[]{false,true})
            {
                var p=BridgeSolver.Solve(new BridgeSpec{Length=40,Width=width,DeckHeight=height,Opening=hole,ArchWidth=8,ArchHeight=Math.Max(.5f,height-.75f)});
                if(hole&&height<1.25f){Require(!p.Valid,"too-low opening unexpectedly accepted");continue;}Require(p.Valid,p.Message);solved++;
                Require(p.Parts.All(v=>v.Y>=0&&!float.IsNaN(v.X)&&!float.IsInfinity(v.Z)),"source below ground or nonfinite");
                for(float x=16.125f;x<24;x+=.25f)for(float y=.125f;y<height-.75f;y+=.25f)
                    if(p.ContainsOpening(x,y,0))Require(!p.Solids.Any(v=>Inside(v,x,y,0)),"parameterized core intrudes");
            }
            Require(solved==36,"expected legal envelope cases");
        });
        Test("railing faces avoid post shaft z-plane coincidence",()=>{
            var p=Default();
            // The authored rail and post shaft are both .125m deep. Coincident
            // depth planes caused actual Unity z-fighting at their joints.
            foreach(int side in new[]{-1,1})
            {
                var rail=p.Parts.First(v=>v.SourceId=="sb03.rail"&&Math.Sign(v.Z)==side);
                var post=p.Parts.First(v=>v.SourceId=="sb03.post"&&Math.Sign(v.Z)==side);
                Equal(Math.Abs(post.Z-rail.Z),.0625f,"rail sits half a detail cell inside its post shaft");
                Require(Math.Abs((rail.Z+.0625f)-(post.Z+.0625f))>.001f&&Math.Abs((rail.Z-.0625f)-(post.Z-.0625f))>.001f,"outer and inner wood faces are not coincident");
            }
        });
        string root=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../reports"));Directory.CreateDirectory(root);
        File.WriteAllText(Path.Combine(root,"core-tests.json"),JsonSerializer.Serialize(new{status=failed==0?"PASS":"FAIL",failed,checks=results},new JsonSerializerOptions{WriteIndented=true}));
        Environment.ExitCode=failed==0?0:1;
    }
}
