using System.Text.Json;
using System.Security.Cryptography;
using XingHai.SB03;
using XingHai.BridgeReplica;
var checks=new List<object>();bool success=true;
void Need(bool yes,string message){if(!yes)throw new Exception(message);}
RouteNode N(string id,float x,float y,float z)=>new RouteNode{Id=id,X=x,Y=y,Z=z};
RouteDocument Straight()=>new RouteDocument{Nodes=new(){N("start",0,0,0),N("rise",4,2,0),N("fall",10,2,0),N("end",14,0,0)},Openings=new(){new RouteOpening{SegmentId="rise__fall"}}};
RouteDocument Detour()=>new RouteDocument{Nodes=new(){N("start",0,0,0),N("rise",0,2,4),N("turn-a",0,2,8),N("turn-b",14,2,8),N("fall",14,2,4),N("end",14,0,0)},Openings=new(){new RouteOpening{SegmentId="turn-a__turn-b"}}};
string Hash(BridgePlan plan)=>Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(new {plan.Parts,plan.Solids},new JsonSerializerOptions{IncludeFields=true})));
void Case(string name,Action body){try{body();checks.Add(new{name,status="PASS"});Console.WriteLine("PASS "+name);}catch(Exception e){success=false;checks.Add(new{name,status="FAIL",error=e.Message});Console.WriteLine("FAIL "+name+": "+e.Message);}}
Case("same-endpoints-middle-route-changes-structure",()=>{
 var a=Straight();var b=Detour();var pa=RouteSolver.Solve(a);var pb=RouteSolver.Solve(b);
 Need(pa.Valid,pa.Message);Need(pb.Valid,pb.Message);Need(a.Nodes[0].X==b.Nodes[0].X&&a.Nodes[^1].X==b.Nodes[^1].X&&a.Nodes[^1].Z==b.Nodes[^1].Z,"Fixtures share endpoints.");
 Need(Hash(pa.Plan)!=Hash(pb.Plan),"Middle route must affect actual source placement and core solids.");Need(pb.Plan.Parts.Any(p=>p.Z>7),"Detoured route has geometry at its actual middle leg.");Need(pa.Plan.Parts.All(p=>Math.Abs(p.Z)<2),"Straight route stays at original straight corridor.");
});
Case("fixed-source-family-no-whole-prefab-stamps",()=>{
 var p=RouteSolver.Solve(Detour());Need(p.Valid,p.Message);Need(p.Plan.Parts.Count>100,"Construct with actual repeated source parts.");
 Need(p.Plan.Parts.All(v=>v.SourceId.StartsWith("sb03.")&&!string.IsNullOrEmpty(v.Role)),"Every part has source and structural role.");Need(p.Plan.Parts.Select(v=>v.Id).Distinct().Count()==p.Plan.Parts.Count,"Unique placement identities.");
 Need(p.Plan.Parts.Select(v=>v.SourceId).Distinct().Count()>=8,"Actual roles are populated, not one bridge stamp.");Need(p.Plan.Solids.Count<300,"Core uses merged columns rather than per-voxel objects.");
});
Case("corner-platform-keeps-walking-ports-open",()=>{
 var p=RouteSolver.Solve(Detour());Need(p.Valid,p.Message);Need(p.Plan.Parts.Any(v=>v.Role=="junction.deck"),"Turn gets an actual landing.");
 var rails=p.Plan.Parts.Where(v=>v.Role=="junction.guard.rail"&&v.Id.Contains("turn-a/")).ToArray();Need(rails.Length>0,"Closed outer edges receive guards.");
 Need(!rails.Any(v=>Math.Abs(v.Z-6.9375f)<.01f||Math.Abs(v.X-1.0625f)<.01f),"Incoming south and outgoing east ports are not blocked by landing rails.");
});
Case("opening-remains-full-width-protected",()=>{
 var p=RouteSolver.Solve(Detour());Need(p.Valid,p.Message);var seg=p.Segments.Single(s=>s.HasOpening);
 for(float d=seg.OpeningStart+.125f;d<seg.OpeningEnd;d+=.25f)for(float y=.125f;y<seg.OpeningHeightAt(d)-.001f;y+=.25f)for(float w=-1;w<=1;w+=.25f){
  float x=seg.StartX+d*seg.DirX-w*seg.DirZ,z=seg.StartZ+d*seg.DirZ+w*seg.DirX;
  Need(seg.ContainsOpening(x,y,z),"Void query follows rotated segment.");Need(!p.Plan.Solids.Any(b=>x>b.MinX+.0001f&&x<b.MaxX-.0001f&&y>b.MinY+.0001f&&y<b.MaxY-.0001f&&z>b.MinZ+.0001f&&z<b.MaxZ-.0001f),"Generated solid intrudes into portal.");
 }
 var bad=Detour();bad.Nodes[2].Y=2.25f;Need(!RouteSolver.Solve(bad).Valid,"Opening on sloped span must be rejected, not filled.");
});
Case("paired-middle-leg-offset-preserves-endpoints-and-identities",()=>{
 var doc=Detour();var old=RouteSolver.Solve(doc);Need(old.Valid,old.Message);var moved=RouteEdits.OffsetLeg(doc,2,2);var now=RouteSolver.Solve(moved);Need(now.Valid,now.Message);
 Need(moved.Nodes[0].X==doc.Nodes[0].X&&moved.Nodes[^1].Z==doc.Nodes[^1].Z,"Interior move preserves endpoints.");Need(moved.Nodes[2].Z==10&&moved.Nodes[3].Z==10,"Both turn nodes move with the middle leg.");Need(doc.Nodes[2].Z==8,"Editing does not mutate committed input.");
 Need(old.Segments.Select(s=>s.Id).SequenceEqual(now.Segments.Select(s=>s.Id)),"Local move preserves segment IDs.");Need(Hash(old.Plan)!=Hash(now.Plan),"Leg move changes actual geometry.");
});
Case("local-height-updates-only-related-source-arrangements",()=>{
 var doc=Detour();var original=RouteSolver.Solve(doc);Need(original.Valid,original.Message);var edited=RouteEdits.SetNodeHeight(doc,4,1.75f);var result=RouteSolver.Solve(edited);Need(result.Valid,result.Message);Need(Hash(original.Plan)!=Hash(result.Plan),"Local height changes steps/core/guard.");
 var untouched=original.Plan.Parts.Where(p=>p.Id.Contains("/start__rise/")).ToArray();var after=result.Plan.Parts.Where(p=>p.Id.Contains("/start__rise/")).ToArray();Need(JsonSerializer.Serialize(untouched,new JsonSerializerOptions{IncludeFields=true})==JsonSerializer.Serialize(after,new JsonSerializerOptions{IncludeFields=true}),"Unrelated flight is not reshuffled.");
});
Case("append-delete-restores-author-and-end-guard-arrangement",()=>{
 var doc=Detour();var previous=RouteSolver.Solve(doc);Need(previous.Valid,previous.Message);var more=RouteEdits.Append(doc,14,0,-6);Need(more.Nodes.Count==doc.Nodes.Count+1,"Append one node/segment.");var p=RouteSolver.Solve(more);Need(p.Valid,p.Message);Need(Hash(p.Plan)!=Hash(previous.Plan),"Continuation changes end layout.");
 var back=RouteEdits.RemoveLastSegment(more);var restored=RouteSolver.Solve(back);Need(restored.Valid,restored.Message);Need(Hash(restored.Plan)==Hash(previous.Plan),"Removing last segment restores exact surviving layout.");
});
Case("route-serialization-retains-editable-middle-and-kit-version",()=>{
 var before=Detour();var text=JsonSerializer.Serialize(before,new JsonSerializerOptions{IncludeFields=true});var after=JsonSerializer.Deserialize<RouteDocument>(text,new JsonSerializerOptions{IncludeFields=true});
 Need(after.Nodes.Count==6&&after.Nodes[2].Id=="turn-a"&&after.Nodes[2].Z==8,"Middle nodes survive serialization.");Need(after.KitId==before.KitId&&after.KitVersion==before.KitVersion,"Kit identity survives author save.");Need(Hash(RouteSolver.Solve(after).Plan)==Hash(RouteSolver.Solve(before).Plan),"Serialized route rebuilds exact source layout.");
});
Case("continuous-sketch-preserves-turns-and-is-density-invariant",()=>{
 var sparse=new List<RouteNode>{N("",0,0,0),N("",0,0,8),N("",14,0,8),N("",14,0,0)};
 var dense=new List<RouteNode>();for(int z=0;z<=8;z++)dense.Add(N("",0,0,z));for(int x=1;x<=14;x++)dense.Add(N("",x,0,8));for(int z=7;z>=0;z--)dense.Add(N("",14,0,z));
 var a=RouteSketch.Build(sparse);var b=RouteSketch.Build(dense);Need(a.Nodes.Count>=4&&a.Nodes.Any(n=>n.Z==8),"Sketch retains an explicit middle turn.");
 var pa=RouteSolver.Solve(a);var pb=RouteSolver.Solve(b);Need(pa.Valid,pa.Message);Need(pb.Valid,pb.Message);Need(Hash(pa.Plan)==Hash(pb.Plan),"Sampling more events does not alter final route arrangement.");
});
Case("invalid-family-and-topology-are-explicit",()=>{
 var width=Straight();width.Width=2.5f;Need(!RouteSolver.Solve(width).Valid,"Uncertified half-metre width rejected.");var diagonal=Straight();diagonal.Nodes[1].Z=1;Need(!RouteSolver.Solve(diagonal).Valid,"Diagonal not silently changed.");
 var nan=Straight();nan.Nodes[1].X=float.NaN;Need(!RouteSolver.Solve(nan).Valid,"NaN rejected.");var duplicate=Straight();duplicate.Nodes[2].Id=duplicate.Nodes[1].Id;Need(!RouteSolver.Solve(duplicate).Valid,"Duplicate node identity rejected.");
 var crossing=new RouteDocument{Nodes=new(){N("a",0,2,0),N("b",8,2,0),N("c",8,2,8),N("d",4,2,8),N("e",4,2,-4)}};Need(!RouteSolver.Solve(crossing).Valid,"Self-intersection rejected.");
 var shortRun=Straight();shortRun.Nodes[1].X=1;Need(!RouteSolver.Solve(shortRun).Valid,"Impossible stair grade rejected.");
 var cramped=new RouteDocument{Nodes=new(){N("a",0,2,0),N("b",10,2,0),N("c",10,2,10),N("d",2,2,10),N("e",2,2,2),N("f",8,2,2)}};Need(!RouteSolver.Solve(cramped).Valid,"Nonadjacent touching corridors cannot overlap guard source envelopes.");
});
Case("rotated-and-reversed-flight-retains-actual-void-and-source-frames",()=>{
 var fixtures=new List<RouteDocument>();var rotated=Straight();foreach(var n in rotated.Nodes){float x=n.X;n.X=-n.Z;n.Z=x;}fixtures.Add(rotated);
 var reversed=Straight();reversed.Nodes.Reverse();reversed.Openings[0].SegmentId="fall__rise";fixtures.Add(reversed);
 foreach(var doc in fixtures){var p=RouteSolver.Solve(doc);Need(p.Valid,p.Message);Need(p.Plan.Solids.All(b=>b.MaxX>b.MinX&&b.MaxY>b.MinY&&b.MaxZ>b.MinZ),"Every rotated core remains a positive closed prism.");
  var s=p.Segments.Single(s=>s.HasOpening);float d=(s.OpeningStart+s.OpeningEnd)/2;Need(s.ContainsOpening(s.StartX+d*s.DirX,.5f,s.StartZ+d*s.DirZ),"Rotated/reversed opening has the same usable world clearance.");
  Need(p.Plan.Parts.All(v=>v.Yaw==0||v.Yaw==90||v.Yaw==180||v.Yaw==270),"Certified source frames use only cardinal rotations.");
 }
});
Case("source-envelopes-cannot-fill-protected-portal",()=>{
 var p=RouteSolver.Solve(Detour());Need(p.Valid,p.Message);var s=p.Segments.Single(s=>s.HasOpening);
 foreach(var part in p.Plan.Parts){float sx=.5f,sy=.25f,sz=.5f;switch(part.SourceId){case "sb03.coping":sz=.25f;break;case "sb03.rail":sy=1;sz=.125f;break;case "sb03.post":sx=sz=.25f;sy=1.25f;break;case "sb03.arch-stone":sx=sz=.25f;break;case "sb03.arch-foot":case "sb03.keystone":sz=.25f;sy=.5f;break;}if(part.Yaw==90||part.Yaw==270){float t=sx;sx=sz;sz=t;}
  for(float d=s.OpeningStart+.125f;d<s.OpeningEnd;d+=.25f)for(float y=.125f;y<s.OpeningHeightAt(d);y+=.25f)for(float w=-1;w<=1;w+=.25f){float x=s.StartX+d*s.DirX-w*s.DirZ,z=s.StartZ+d*s.DirZ+w*s.DirX;Need(!(x>part.X-sx/2+.0001f&&x<part.X+sx/2-.0001f&&y>part.Y+.0001f&&y<part.Y+sy-.0001f&&z>part.Z-sz/2+.0001f&&z<part.Z+sz/2-.0001f),"Source envelope intrudes: "+part.Id);}
 }
});
Case("terminal-walking-ports-remain-free-of-guard-source-envelopes",()=>{
 foreach(var basis in new[]{Straight(),Detour()})for(int rotation=0;rotation<4;rotation++)
 {
  var doc=basis.Clone();for(int n=0;n<rotation;n++)foreach(var p in doc.Nodes){float x=p.X;p.X=-p.Z;p.Z=x;}
  var r=RouteSolver.Solve(doc);Need(r.Valid,r.Message);
  foreach(bool start in new[]{true,false})
  {
   var node=start?doc.Nodes[0]:doc.Nodes[^1];var segment=start?r.Segments[0]:r.Segments[^1];
   float dx=segment.DirX,dz=segment.DirZ,half=doc.Width/2-.01f;
   float minX=node.X-(dx==0?half:.25f),maxX=node.X+(dx==0?half:.25f),minZ=node.Z-(dz==0?half:.25f),maxZ=node.Z+(dz==0?half:.25f),height=node.Y+.75f;
   foreach(var part in r.Plan.Parts.Where(p=>p.SourceId=="sb03.rail"||p.SourceId=="sb03.post"))
   {
    float sx=part.SourceId=="sb03.rail"?.5f:.25f,sz=part.SourceId=="sb03.rail"?.125f:.25f,sy=part.SourceId=="sb03.rail"?1:1.25f;if(part.Yaw==90||part.Yaw==270){float t=sx;sx=sz;sz=t;}
    bool blocks=height>part.Y+.0001f&&height<part.Y+sy-.0001f&&Math.Min(maxX,part.X+sx/2)-Math.Max(minX,part.X-sx/2)>.0001f&&Math.Min(maxZ,part.Z+sz/2)-Math.Max(minZ,part.Z-sz/2)>.0001f;
    Need(!blocks,"Guard envelope blocks "+(start?"start":"end")+" walking port, rotation"+rotation+": "+part.Id);
   }
  }
 }
});
var report=new{status=success?"PASS":"FAIL",scope="Pure C# route author, fixed interface family and source layout; no Unity interaction or original-game claim",checks};
string folder=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../reports"));Directory.CreateDirectory(folder);File.WriteAllText(Path.Combine(folder,"route-core-tests.json"),JsonSerializer.Serialize(report,new JsonSerializerOptions{WriteIndented=true}));
Environment.Exit(success?0:1);
