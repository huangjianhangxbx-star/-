using System;
using System.Linq;
using System.Text.Json;
using XingHai.LE01.Core;
public static partial class Program
{
 public static void PaintTests()
 {
  var doc=new TerrainDocument{Id="paint-fixture",GeneratorVersion="le01.2",BaseHeight=-8};
  for(int z=0;z<8;z+=4)for(int x=0;x<8;x+=4)doc.Cells.Add(new TerrainCell{X=x,Z=z,Size=4,Top=0,PlaneId="p0"});
  var source=TerrainEffectiveSource.Capture(doc,new TerrainEditState());var start=PaintVolume(source);
  var command=new TerrainPaintCommand{UseRegion=true,Region=new Bounds2(0,0,8,8),YMin=-8,YMax=16,FaceMask=63,Rgba=new[]{.8f,.2f,.1f,1f}};
  command.Hits.Add(new SurfaceHit(.2f,0,.2f,0,1,0));
  var painted=TerrainPaintEdits.Apply(source,command);Need(painted.Changed&&!painted.Rejected,painted.Reason);
  Need(PaintVolume(painted.Snapshot)==start,"Paint must not change occupied volume");
  int color=painted.Snapshot.State.Palette.Count-1;
  Need(painted.Snapshot.ColorAt(3,-1,3,3)==color,"Visible top must use custom RGBA");
  Need(painted.Snapshot.ColorAt(3,-8,3,2)==source.ColorAt(3,-8,3,2),"Painting top must not pass through to bottom");
  Need(painted.Snapshot.ColorAt(0,-4,3,0)==source.ColorAt(0,-4,3,0),"Painting top must not overwrite sides");
  var built=TerrainSurfaceMesher.Build(painted.Snapshot,null,new TerrainDirtySet{All=true});
  Need(built.Chunks.SelectMany(c=>Enumerable.Range(0,c.Vertices.Length/3).Where(i=>c.Normals[i*3+1]>.9f).Select(i=>c.UV[i*2])).All(u=>Math.Abs(u-(color+.5f)/256)<.00001f),"Surface must retain generic paint UVs");
  var jsonOptions=new JsonSerializerOptions{IncludeFields=true};
  var state=JsonSerializer.Deserialize<TerrainEditState>(JsonSerializer.Serialize(painted.Snapshot.State,jsonOptions),jsonOptions);
  var reloaded=TerrainEffectiveSource.Capture(doc,state);
  Need(reloaded.ContentHash()==painted.Snapshot.ContentHash(),"Paint author must survive file roundtrip");
  Need(reloaded.ColorAt(3,-1,3,3)==color,"Reopened top must retain custom color");
  var side=new TerrainPaintCommand{UseRegion=true,Region=new Bounds2(0,0,8,8),YMin=-8,YMax=0,FaceMask=63,Rgba=new[]{.1f,.6f,.4f,1f}};side.Hits.Add(new SurfaceHit(.5f,-.2f,.2f,1,0,0));
  var sideResult=TerrainPaintEdits.Apply(reloaded,side);Need(sideResult.Changed&&!sideResult.Rejected,sideResult.Reason);
  Need(sideResult.Snapshot.ColorAt(7,-4,3,1)!=reloaded.ColorAt(7,-4,3,1),"Visible side should paint");
  Need(sideResult.Snapshot.ColorAt(0,-4,3,0)==reloaded.ColorAt(0,-4,3,0),"Side brush must not paint opposite face");
  var repeat=TerrainPaintEdits.Apply(painted.Snapshot,command);Need(!repeat.Changed,"Identical paint must be idempotent");
  var full=painted.Snapshot.State.Copy();while(full.Palette.Count<256){int n=full.Palette.Count;full.Palette.Add(new VoxelPaletteEntry{id="color"+n,rgba=new[]{n/256f,.01f,.02f,1f}});}
  var overflow=TerrainPaintEdits.Apply(painted.Snapshot.WithState(full),new TerrainPaintCommand{UseRegion=true,Region=new Bounds2(0,0,4,4),Hits=command.Hits,Rgba=new[]{.99f,.98f,.97f,1f}});
  Need(overflow.Rejected&&full.Palette.Count==256,"Palette overflow must reject atomically");
  var emptyDoc=new TerrainDocument{Id="paint-occlusion",GeneratorVersion="le01.2"};
  var isolated=TerrainEffectiveSource.Capture(emptyDoc,new TerrainEditState());var occupied=isolated.State.Copy();
  occupied.OwnedColumns.Add(new TerrainColumnOverride{X=0,Z=0,Spans=new System.Collections.Generic.List<TerrainVolumeSpan>{new TerrainVolumeSpan(-8,0)}});
  occupied.OwnedColumns.Add(new TerrainColumnOverride{X=4,Z=0,Spans=new System.Collections.Generic.List<TerrainVolumeSpan>{new TerrainVolumeSpan(-8,0)}});
  isolated=isolated.WithState(occupied);
  var occluded=new TerrainPaintCommand{UseRegion=true,Region=new Bounds2(0,0,5,1),YMin=-8,YMax=0,Rgba=new[]{.7f,.1f,.8f,1f}};occluded.Hits.Add(new SurfaceHit(.3125f,-.2f,.03f,1,0,0));
  var visible=TerrainPaintEdits.Apply(isolated,occluded);Need(visible.Changed&&!visible.Rejected,visible.Reason);
  Need(visible.Snapshot.ColorAt(4,-4,0,1)!=isolated.ColorAt(4,-4,0,1),"Front-facing exposed wall receives paint");
  Need(visible.Snapshot.ColorAt(0,-4,0,1)==isolated.ColorAt(0,-4,0,1),"Rear same-facing wall is occluded and must retain its color");
  var directRear=new TerrainPaintCommand{Radius=.1f,YMin=-8,YMax=0,Rgba=new[]{.6f,.2f,.7f,1f}};directRear.Hits.Add(new SurfaceHit(.0625f,-.25f,.03125f,1,0,0));
  var reached=TerrainPaintEdits.Apply(isolated,directRear);Need(reached.Changed&&!reached.Rejected,"An actual visible side hit must paint even with another wall beyond the camera-facing plane");
  Need(reached.Snapshot.ColorAt(0,-4,0,1)!=isolated.ColorAt(0,-4,0,1),"Direct side hit must receive paint");
  Console.WriteLine("Paint: volume, visible face, backface, UV, JSON, idempotency and palette limits PASS");
 }
 static string PaintVolume(TerrainEditSnapshot s){return string.Join(";",s.Columns().OrderBy(c=>c.X).ThenBy(c=>c.Z).Select(c=>c.X+","+c.Z+":"+string.Join(",",s.ColumnAt(c.X,c.Z).Select(p=>p.Min+"/"+p.Max))));}
}
