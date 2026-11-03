using System;using System.Collections.Generic;using System.Diagnostics;using System.Linq;
namespace XingHai.LE01.Core
{
 internal static class TerrainCompilerV2
 {
  internal static TerrainBuild Build(TerrainDocument doc,Bounds2? dirty,int featureLevel)
  {
   var timer=Stopwatch.StartNew();string error;if(!TerrainKernel.Validate(doc,out error))throw new ArgumentException(error);if(featureLevel<0||featureLevel>2)throw new ArgumentException("Feature level must be 0,1,2.");
   var output=new TerrainBuild{AuthorLeaves=doc.Cells.Count,SourceRevision=doc.Revision,ValidationMilliseconds=timer.ElapsedMilliseconds};if(doc.Cells.Count==0)return output;long mark=timer.ElapsedMilliseconds;
   bool shaped=RockWallShapes.HasEdits(doc);int shapeBand=shaped?16:0;
   Bounds2 bounds=dirty.HasValue?dirty.Value.Expand(RockBoundary.Band+4+shapeBand):new Bounds2(doc.Cells.Min(c=>c.X),doc.Cells.Min(c=>c.Z),doc.Cells.Max(c=>c.X+c.Size),doc.Cells.Max(c=>c.Z+c.Size)).Expand(shapeBand);output.RebuiltBounds=bounds;
   var compile=new Bounds2(TerrainUnits.FloorDiv(bounds.MinX,64)*64,TerrainUnits.FloorDiv(bounds.MinZ,64)*64,(TerrainUnits.FloorDiv(bounds.MaxX-1,64)+1)*64,(TerrainUnits.FloorDiv(bounds.MaxZ-1,64)+1)*64);var halo=compile.Expand(RockBoundary.Band+8);
   var boundary=new RockBoundary(doc);var profile=new RockProfile(doc,featureLevel);var leaves=new List<TerrainCell>();var targets=new Dictionary<CellKey,BoundaryAnchor>();var distances=new Dictionary<CellKey,float>();var protectedCells=new HashSet<CellKey>();
   output.BoundaryMilliseconds=timer.ElapsedMilliseconds-mark;mark=timer.ElapsedMilliseconds;
   foreach(var c in doc.Cells)
   {
    if(!halo.Intersects(new Bounds2(c.X,c.Z,c.X+c.Size,c.Z+c.Size)))continue;
    float centerDist;var center=boundary.Nearest(c.X+c.Size/2,c.Z+c.Size/2,c.Top,out centerDist);
    if(center==null){leaves.Add(c.Copy());targets[new CellKey(c.X,c.Z,c.Size)]=null;continue;}
    for(int z=c.Z;z<c.Z+c.Size;z++)for(int x=c.X;x<c.X+c.Size;x++)
    {
     var n=c.Copy();n.X=x;n.Z=z;n.Size=1;leaves.Add(n);float distance;var edge=boundary.Nearest(x,z,c.Top,out distance);var key=new CellKey(x,z,1);targets[key]=edge;if(edge==null)continue;distances[key]=distance;if(boundary.Narrow(x,z,c.Top))protectedCells.Add(key);
    }
   }
   var solid=new TerrainSolidSurface(leaves,doc.BaseHeight);
   foreach(var c in leaves){var key=new CellKey(c.X,c.Z,c.Size);BoundaryAnchor a;if(targets.TryGetValue(key,out a)&&a!=null&&!protectedCells.Contains(key))solid.SetSpans(c,profile.Solid(a,distances[key],c.Top));}
   output.ProfileMilliseconds=timer.ElapsedMilliseconds-mark;mark=timer.ElapsedMilliseconds;
   var wallShapes=shaped?new RockWallShapes(doc,boundary,profile,solid,halo):null;
   solid.Regularize(wallShapes!=null&&wallShapes.Any?solid.Index:boundary.Author,compile.Expand(2),wallShapes!=null&&wallShapes.Any);leaves=solid.Index.Map.Values.OrderBy(c=>c.X).ThenBy(c=>c.Z).ThenBy(c=>c.Size).ToList();output.DerivedCells=leaves.Count;output.TopologyMilliseconds=timer.ElapsedMilliseconds-mark;mark=timer.ElapsedMilliseconds;
   var chunks=new Dictionary<CellKey,RockMeshWriter>();if(dirty.HasValue)for(int z=TerrainUnits.FloorDiv(bounds.MinZ,64);z<=TerrainUnits.FloorDiv(bounds.MaxZ-1,64);z++)for(int x=TerrainUnits.FloorDiv(bounds.MinX,64);x<=TerrainUnits.FloorDiv(bounds.MaxX-1,64);x++)chunks[new CellKey(x,z,0)]=new RockMeshWriter(x,z);
   var used=new Dictionary<string,List<BoundaryAnchor>>();
   var usedKeys=new Dictionary<string,HashSet<string>>();
   foreach(var c in leaves)
   {
    if(!compile.Contains(c.X,c.Z))continue;int cx=TerrainUnits.FloorDiv(c.X,64),cz=TerrainUnits.FloorDiv(c.Z,64);var key=new CellKey(cx,cz,0);RockMeshWriter mesh;if(!chunks.TryGetValue(key,out mesh))chunks[key]=mesh=new RockMeshWriter(cx,cz);
    BoundaryAnchor anchor;if(!targets.TryGetValue(new CellKey(c.X,c.Z,c.Size),out anchor)){anchor=wallShapes==null?null:wallShapes.Owner(c);if(anchor==null){float distance;anchor=boundary.Nearest(c.X,c.Z,c.Top,out distance);}}string group=anchor==null?"":anchor.GroupId,child=anchor==null?"":anchor.ChildId,boundaryKey=anchor==null?"":anchor.Key;
    if(anchor!=null){List<BoundaryAnchor> list;if(!used.TryGetValue(group,out list)){used[group]=list=new List<BoundaryAnchor>();usedKeys[group]=new HashSet<string>();}if(usedKeys[group].Add(anchor.Key))list.Add(anchor);}
    var own=solid.For(c);foreach(var span in own){bool snowTop=doc.TerrainThemeId=="snow-rock"&&own.Count>0&&span.Max==own[own.Count-1].Max;mesh.Horizontal(c.X,c.Z,c.Size,span.Max,true,span.Max==c.Top||snowTop?0:4);mesh.Horizontal(c.X,c.Z,c.Size,span.Min,false,3);}
    for(int direction=0;direction<4;direction++)
    {
     if(wallShapes!=null&&wallShapes.TouchesSide(c,direction)){
      for(int s=0;s<c.Size;s++){int nx=direction==0?c.X-1:direction==1?c.X+c.Size:c.X+s,nz=direction==2?c.Z-1:direction==3?c.Z+c.Size:c.Z+s;foreach(var span in TerrainSolidSurface.Visible(own,solid.At(nx,nz)))wallShapes.EmitSide(mesh,c,direction,s,span,anchor);}continue;
     }
     int start=0;List<TerrainSolidSurface.Span> last=null;
     for(int s=0;s<=c.Size;s++)
     {
      var visible=new List<TerrainSolidSurface.Span>();if(s<c.Size){int nx=direction==0?c.X-1:direction==1?c.X+c.Size:c.X+s,nz=direction==2?c.Z-1:direction==3?c.Z+c.Size:c.Z+s;visible=TerrainSolidSurface.Visible(own,solid.At(nx,nz));}
      if(s==0){last=visible;continue;}if(!TerrainSolidSurface.Same(visible,last)||s==c.Size){foreach(var span in last)mesh.Side(c,direction,start,s,span.Min,span.Max,group,child,boundaryKey);start=s;last=visible;}
     }
    }
   }
   foreach(var chunk in chunks.OrderBy(p=>p.Key.X).ThenBy(p=>p.Key.Z))output.Chunks.Add(chunk.Value.Finish());
   if(wallShapes!=null)foreach(var anchor in wallShapes.OwnedAnchors){List<BoundaryAnchor> list;if(!used.TryGetValue(anchor.GroupId,out list)){used[anchor.GroupId]=list=new List<BoundaryAnchor>();usedKeys[anchor.GroupId]=new HashSet<string>();}if(usedKeys[anchor.GroupId].Add(anchor.Key))list.Add(anchor);}
   foreach(var pair in used.OrderBy(p=>p.Key))
   {
    var aa=pair.Value;var info=new StructureInfo{GroupId=pair.Key,ParentId="",Bounds=new Bounds2(aa.Min(a=>a.X)-12,aa.Min(a=>a.Z)-12,aa.Max(a=>a.X)+13,aa.Max(a=>a.Z)+13),MinHeight=aa.Min(a=>a.LowerHeight),MaxHeight=aa.Max(a=>a.UpperHeight),EventHeights=aa.SelectMany(a=>profile.EffectiveEvents(a,false)).Distinct().ToArray()};output.Structures.Add(info);
    foreach(var child in aa.GroupBy(a=>a.ChildId)){var a=child.First();output.Structures.Add(new StructureInfo{GroupId=child.Key,ParentId=pair.Key,Bounds=info.Bounds,MinHeight=a.LowerHeight,MaxHeight=a.UpperHeight,EventHeights=child.SelectMany(v=>profile.EffectiveEvents(v,true)).Distinct().ToArray()});}
   }
   output.MeshMilliseconds=timer.ElapsedMilliseconds-mark;output.Solid=solid;timer.Stop();output.Milliseconds=timer.ElapsedMilliseconds;return output;
  }
 }
 internal sealed class RockMeshWriter
 {
  readonly int cx,cz;readonly List<float> vertices=new List<float>(),normals=new List<float>(),uv=new List<float>();readonly List<int> triangles=new List<int>();readonly List<string> groups=new List<string>(),children=new List<string>(),boundaries=new List<string>();
  internal RockMeshWriter(int x,int z){cx=x;cz=z;}
  void Quad(int[] xyz,int nx,int ny,int nz,int palette,string group="",string child="",string boundary="")
  {
   int start=vertices.Count/3;for(int i=0;i<4;i++){vertices.Add(xyz[i*3]*TerrainUnits.Unit);vertices.Add(xyz[i*3+1]*TerrainUnits.Unit);vertices.Add(xyz[i*3+2]*TerrainUnits.Unit);normals.Add(nx);normals.Add(ny);normals.Add(nz);uv.Add((palette+.5f)/8f);uv.Add(.5f);}
   triangles.Add(start);triangles.Add(start+1);triangles.Add(start+2);triangles.Add(start);triangles.Add(start+2);triangles.Add(start+3);groups.Add(group);groups.Add(group);children.Add(child);children.Add(child);boundaries.Add(boundary);boundaries.Add(boundary);
  }
  internal void Horizontal(int x,int z,int q,int y,bool up,int palette){if(up)Quad(new[]{x,y,z,x,y,z+q,x+q,y,z+q,x+q,y,z},0,1,0,palette);else Quad(new[]{x,y,z,x+q,y,z,x+q,y,z+q,x,y,z+q},0,-1,0,palette);}
  internal void Side(TerrainCell c,int dir,int a,int b,int y0,int y1,string group,string child,string boundary="")
  {
   int x=c.X,z=c.Z;if(dir==0)Quad(new[]{x,y0,z+a,x,y0,z+b,x,y1,z+b,x,y1,z+a},-1,0,0,2,group,child,boundary);
   if(dir==1){x+=c.Size;Quad(new[]{x,y0,z+a,x,y1,z+a,x,y1,z+b,x,y0,z+b},1,0,0,1,group,child,boundary);}
   if(dir==2)Quad(new[]{x+a,y0,z,x+a,y1,z,x+b,y1,z,x+b,y0,z},0,0,-1,2,group,child,boundary);
   if(dir==3){z+=c.Size;Quad(new[]{x+a,y0,z,x+b,y0,z,x+b,y1,z,x+a,y1,z},0,0,1,1,group,child,boundary);}
  }
  internal ChunkMesh Finish(){return new ChunkMesh{Id="chunk_"+cx+"_"+cz,ChunkX=cx,ChunkZ=cz,Vertices=vertices.ToArray(),Normals=normals.ToArray(),UV=uv.ToArray(),Triangles=triangles.ToArray(),TriangleGroupIds=groups.ToArray(),TriangleChildIds=children.ToArray(),TriangleBoundaryKeys=boundaries.ToArray()};}
 }
}
