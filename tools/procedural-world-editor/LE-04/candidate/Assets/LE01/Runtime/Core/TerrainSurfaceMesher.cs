using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
namespace XingHai.LE01.Core
{
 public sealed class SurfacePickIndex
 {
  readonly TerrainEditSnapshot source;
  internal SurfacePickIndex(TerrainEditSnapshot value){source=value;}
  // Local metres and the actual hit normal determine an atomic logical face;
  // merged triangle metadata never determines the editable wall selection.
  public bool TryPick(float x,float y,float z,int direction,out TerrainSurfacePick pick)
  {
   pick=new TerrainSurfacePick();if(direction<0||direction>5)return false;
   int[] dx={-1,1,0,0,0,0},dy={0,0,-1,1,0,0},dz={0,0,0,0,-1,1};
   double ux=x/TerrainUnits.Unit,uy=y/TerrainUnits.Unit,uz=z/TerrainUnits.Unit;
   double plane=dx[direction]!=0?ux:dy[direction]!=0?uy:uz;
   if(Math.Abs(plane-Math.Round(plane))>.02)return false;
   int ix=(int)Math.Floor(ux-dx[direction]*.001),iy=(int)Math.Floor(uy-dy[direction]*.001),iz=(int)Math.Floor(uz-dz[direction]*.001);
   if(!source.Occupied(ix,iy,iz)||source.Occupied(ix+dx[direction],iy+dy[direction],iz+dz[direction]))return false;
   pick=new TerrainSurfacePick{X=ix,Y=iy,Z=iz,Direction=direction,ColorId=source.ColorAt(ix,iy,iz,direction),Owned=source.IsOwned(ix,iz),LogicalKey="column:"+ix+":"+iz+":"+iy+":"+direction};return true;
  }
 }
 public static class TerrainSurfaceMesher
 {
  struct FacePlane : IEquatable<FacePlane>
  {
   internal int Dir,Plane,Color;internal FacePlane(int d,int p,int c){Dir=d;Plane=p;Color=c;}
   public bool Equals(FacePlane o){return Dir==o.Dir&&Plane==o.Plane&&Color==o.Color;}public override bool Equals(object o){return o is FacePlane&&Equals((FacePlane)o);}public override int GetHashCode(){return Dir*31^Plane*397^Color*65537;}
  }
  struct Rect {internal int U0,U1,V0,V1;internal Rect(int a,int b,int c,int d){U0=a;U1=b;V0=c;V1=d;}}
  struct Line : IEquatable<Line>{internal int A,B;internal Line(int a,int b){A=a;B=b;}public bool Equals(Line o){return A==o.A&&B==o.B;}public override bool Equals(object o){return o is Line&&Equals((Line)o);}public override int GetHashCode(){return A*397^B;}}
  public static TerrainSurfaceBuild Build(TerrainEditSnapshot source,TerrainEditCache previous=null,TerrainDirtySet dirty=null)
  {
   if(source==null)throw new ArgumentNullException("source");var timer=Stopwatch.StartNew();var hash=source.ContentHash();
   bool all=previous==null||previous.BaseSource!=source.Base||dirty==null||dirty.All;
   var cache=new TerrainEditCache{BaseSource=source.Base,BaseCompileCount=previous==null?1:previous.BaseCompileCount,StateHash=hash,Meshes=previous==null?new Dictionary<TerrainColumnKey,ChunkMesh>():new Dictionary<TerrainColumnKey,ChunkMesh>(previous.Meshes)};
   var output=new TerrainSurfaceBuild{Snapshot=source,Palette=source.State.Palette,PickIndex=new SurfacePickIndex(source),Cache=cache};
   if(!all&&previous.StateHash==hash){output.Chunks=cache.Meshes.Values.OrderBy(c=>c.ChunkX).ThenBy(c=>c.ChunkZ).ToList();return output;}
   var keys=new HashSet<TerrainColumnKey>();
   if(all){if(!source.Bounds.Empty)for(int cz=TerrainUnits.FloorDiv(source.Bounds.MinZ,64);cz<=TerrainUnits.FloorDiv(source.Bounds.MaxZ-1,64);cz++)for(int cx=TerrainUnits.FloorDiv(source.Bounds.MinX,64);cx<=TerrainUnits.FloorDiv(source.Bounds.MaxX-1,64);cx++)keys.Add(new TerrainColumnKey(cx,cz));foreach(var k in cache.Meshes.Keys)keys.Add(k);}
   else if(!dirty.Bounds.Empty){var b=dirty.Bounds.Expand(1);for(int cz=TerrainUnits.FloorDiv(b.MinZ,64);cz<=TerrainUnits.FloorDiv(b.MaxZ-1,64);cz++)for(int cx=TerrainUnits.FloorDiv(b.MinX,64);cx<=TerrainUnits.FloorDiv(b.MaxX-1,64);cx++)keys.Add(new TerrainColumnKey(cx,cz));}
   foreach(var key in keys.OrderBy(k=>k.X).ThenBy(k=>k.Z))
   {
    var mesh=BuildChunk(source,key.X,key.Z,output);output.ChangedChunks.Add(mesh);
    if(mesh.Triangles.Length==0){cache.Meshes.Remove(key);output.EmptyChunkKeys.Add(mesh.Id);}else cache.Meshes[key]=mesh;
   }
   output.Chunks=cache.Meshes.Values.OrderBy(c=>c.ChunkX).ThenBy(c=>c.ChunkZ).ToList();timer.Stop();output.Milliseconds=timer.ElapsedMilliseconds;return output;
  }
  static ChunkMesh BuildChunk(TerrainEditSnapshot source,int cx,int cz,TerrainSurfaceBuild output)
  {
   var planes=new Dictionary<FacePlane,List<Rect>>();
   Action<int,int,int,int,int,int,int> add=(dir,plane,color,u0,u1,v0,v1)=>{var key=new FacePlane(dir,plane,color);List<Rect> list;if(!planes.TryGetValue(key,out list))planes[key]=list=new List<Rect>();list.Add(new Rect(u0,u1,v0,v1));};
   int[] dx={-1,1,0,0},dz={0,0,-1,1},dirs={0,1,4,5};
   for(int z=cz*64;z<(cz+1)*64;z++)for(int x=cx*64;x<(cx+1)*64;x++)
   {
    var spans=source.ColumnAt(x,z);if(spans.Count==0)continue;output.InputColumns++;
    for(int si=0;si<spans.Count;si++)
    {var span=spans[si];if(si==spans.Count-1||spans[si+1].Min>span.Max)add(3,span.Max,source.ColorAt(x,span.Max-1,z,3),x,x+1,z,z+1);if(si==0||spans[si-1].Max<span.Min)add(2,span.Min,source.ColorAt(x,span.Min,z,2),x,x+1,z,z+1);}
    for(int d=0;d<4;d++)foreach(var visible in Visible(spans,source.ColumnAt(x+dx[d],z+dz[d])))
    {
     var cuts=new SortedSet<int>{visible.Min,visible.Max};
     List<TerrainPaintRun> paint;if(source.Paint.TryGetValue(new TerrainColumnKey(x,z),out paint))foreach(var p in paint)if((p.FaceMask&(1<<dirs[d]))!=0){if(p.YMin>visible.Min&&p.YMin<visible.Max)cuts.Add(p.YMin);if(p.YMax>visible.Min&&p.YMax<visible.Max)cuts.Add(p.YMax);}
     var levels=cuts.ToArray();for(int i=0;i<levels.Length-1;i++){int lo=levels[i],hi=levels[i+1],color=source.ColorAt(x,lo,z,dirs[d]);if(d<2)add(dirs[d],x+(d==1?1:0),color,z,z+1,lo,hi);else add(dirs[d],z+(d==3?1:0),color,x,x+1,lo,hi);}
    }
   }
   var writer=new Writer(cx,cz);
   foreach(var pair in planes.OrderBy(p=>p.Key.Dir).ThenBy(p=>p.Key.Plane).ThenBy(p=>p.Key.Color))foreach(var rect in Merge(pair.Value)){writer.Quad(pair.Key,rect);output.Quads++;}
   return writer.Finish();
  }
  static IEnumerable<TerrainVolumeSpan> Visible(IReadOnlyList<TerrainVolumeSpan> own,IReadOnlyList<TerrainVolumeSpan> other)
  {
   foreach(var span in own){int start=span.Min;foreach(var n in other){if(n.Max<=start)continue;if(n.Min>=span.Max)break;if(n.Min>start)yield return new TerrainVolumeSpan(start,Math.Min(n.Min,span.Max));start=Math.Max(start,n.Max);if(start>=span.Max)break;}if(start<span.Max)yield return new TerrainVolumeSpan(start,span.Max);}
  }
  // Union exact axis-aligned rectangles and merge identical consecutive scan bands.
  // Vertical bands use interval endpoints, never allocate one voxel per metre of height.
  static IEnumerable<Rect> Merge(List<Rect> faces)
  {
   var levels=new SortedSet<int>();foreach(var r in faces){levels.Add(r.V0);levels.Add(r.V1);}var ys=levels.ToArray();var active=new Dictionary<Line,Rect>();var result=new List<Rect>();
   for(int i=0;i<ys.Length-1;i++)
   {
    int lo=ys[i],hi=ys[i+1];var intervals=faces.Where(r=>r.V0<=lo&&r.V1>=hi).OrderBy(r=>r.U0).ThenBy(r=>r.U1);var lines=new List<Line>();int a=0,b=0;bool first=true;
    foreach(var r in intervals){if(first){a=r.U0;b=r.U1;first=false;}else if(r.U0<=b)b=Math.Max(b,r.U1);else{lines.Add(new Line(a,b));a=r.U0;b=r.U1;}}if(!first)lines.Add(new Line(a,b));
    var next=new Dictionary<Line,Rect>();foreach(var line in lines){Rect old;if(active.TryGetValue(line,out old)&&old.V1==lo){old.V1=hi;next[line]=old;active.Remove(line);}else next[line]=new Rect(line.A,line.B,lo,hi);}result.AddRange(active.Values);active=next;
   }
   result.AddRange(active.Values);return result.OrderBy(r=>r.V0).ThenBy(r=>r.U0).ThenBy(r=>r.V1).ThenBy(r=>r.U1);
  }
  sealed class Writer
  {
   readonly int cx,cz;readonly List<float> vertices=new List<float>(),normals=new List<float>(),uv=new List<float>();readonly List<int> triangles=new List<int>();readonly List<string> keys=new List<string>();
   internal Writer(int x,int z){cx=x;cz=z;}
   internal void Quad(FacePlane f,Rect r)
   {
    int p=f.Plane,a=r.U0,b=r.U1,c=r.V0,d=r.V1;int[] xyz;int nx=0,ny=0,nz=0;
    if(f.Dir==0){nx=-1;xyz=new[]{p,c,a,p,c,b,p,d,b,p,d,a};}
    else if(f.Dir==1){nx=1;xyz=new[]{p,c,a,p,d,a,p,d,b,p,c,b};}
    else if(f.Dir==2){ny=-1;xyz=new[]{a,p,c,b,p,c,b,p,d,a,p,d};}
    else if(f.Dir==3){ny=1;xyz=new[]{a,p,c,a,p,d,b,p,d,b,p,c};}
    else if(f.Dir==4){nz=-1;xyz=new[]{a,c,p,a,d,p,b,d,p,b,c,p};}
    else{nz=1;xyz=new[]{a,c,p,b,c,p,b,d,p,a,d,p};}
    int start=vertices.Count/3;for(int i=0;i<4;i++){vertices.Add(xyz[i*3]*TerrainUnits.Unit);vertices.Add(xyz[i*3+1]*TerrainUnits.Unit);vertices.Add(xyz[i*3+2]*TerrainUnits.Unit);normals.Add(nx);normals.Add(ny);normals.Add(nz);uv.Add((f.Color+.5f)/256);uv.Add(.5f);}
    triangles.AddRange(new[]{start,start+1,start+2,start,start+2,start+3});keys.Add("");keys.Add("");
   }
   internal ChunkMesh Finish(){return new ChunkMesh{Id="chunk_"+cx+"_"+cz,ChunkX=cx,ChunkZ=cz,Vertices=vertices.ToArray(),Normals=normals.ToArray(),UV=uv.ToArray(),Triangles=triangles.ToArray(),TriangleBoundaryKeys=keys.ToArray(),TriangleGroupIds=keys.ToArray(),TriangleChildIds=keys.ToArray()};}
  }
 }
}
