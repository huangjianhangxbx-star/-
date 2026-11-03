using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
namespace XingHai.LE01.Core
{
 // Derived edge geometry is disposable. The sparse author leaves are never rewritten.
 internal static class TerrainCompilerLegacy
 {
  const int Band=12;
  static readonly int[] DX={-1,1,0,0},DZ={0,0,-1,1};
  public static TerrainBuild Build(TerrainDocument doc,Bounds2? dirty=null)
  {
   string error;if(!TerrainKernel.Validate(doc,out error))throw new ArgumentException(error);
   var timer=Stopwatch.StartNew();var build=new TerrainBuild{AuthorLeaves=doc.Cells.Count,SourceRevision=doc.Revision};
   var author=new CellIndex(doc.Cells);var derived=new List<TerrainCell>();
   Bounds2 bounds=dirty.HasValue?dirty.Value.Expand(Band+4):DocumentBounds(doc);
   build.RebuiltBounds=bounds;
   // Neighbor halo supplies exact visibility at rebuilt chunk boundaries.
   var compileBounds=new Bounds2(TerrainUnits.FloorDiv(bounds.MinX,64)*64,TerrainUnits.FloorDiv(bounds.MinZ,64)*64,(TerrainUnits.FloorDiv(bounds.MaxX-1,64)+1)*64,(TerrainUnits.FloorDiv(bounds.MaxZ-1,64)+1)*64);
   var halo=compileBounds.Expand(Band+8);
   foreach(var cell in doc.Cells)
   {
    if(!halo.Intersects(new Bounds2(cell.X,cell.Z,cell.X+cell.Size,cell.Z+cell.Size)))continue;
    bool near=NearEdge(author,cell,doc.BaseHeight);
    if(!near){derived.Add(cell.Copy());continue;}
    for(int z=cell.Z;z<cell.Z+cell.Size;z++)for(int x=cell.X;x<cell.X+cell.Size;x++)
    {var n=cell.Copy();n.X=x;n.Z=z;n.Size=1;n.Top=ShapedTop(doc,author,x,z,cell.Top);derived.Add(n);}
   }
   var index=new CellIndex(derived);RegularizeSaddles(index,author,doc.BaseHeight,compileBounds.Expand(2));derived=index.Map.Values.OrderBy(c=>c.X).ThenBy(c=>c.Z).ThenBy(c=>c.Size).ToList();
   var solid=new TerrainSolidSurface(derived,doc.BaseHeight);foreach(var c in derived)ApplyFault(doc,author,solid,c);solid.Regularize(author,compileBounds.Expand(2));derived=solid.Index.Map.Values.OrderBy(c=>c.X).ThenBy(c=>c.Z).ThenBy(c=>c.Size).ToList();build.DerivedCells=derived.Count;var chunks=new Dictionary<CellKey,MeshWriter>();
   if(dirty.HasValue&&!bounds.Empty)for(int z=TerrainUnits.FloorDiv(bounds.MinZ,64);z<=TerrainUnits.FloorDiv(bounds.MaxZ-1,64);z++)for(int x=TerrainUnits.FloorDiv(bounds.MinX,64);x<=TerrainUnits.FloorDiv(bounds.MaxX-1,64);x++)chunks[new CellKey(x,z,0)]=new MeshWriter(x,z);
   foreach(var cell in derived)
   {
    int cx=TerrainUnits.FloorDiv(cell.X,64),cz=TerrainUnits.FloorDiv(cell.Z,64);
    if(!compileBounds.Contains(cell.X,cell.Z))continue;
    var key=new CellKey(cx,cz,0);MeshWriter mesh;if(!chunks.TryGetValue(key,out mesh)){mesh=new MeshWriter(cx,cz);chunks[key]=mesh;}
    var own=solid.For(cell);foreach(var span in own){mesh.Horizontal(cell.X,cell.Z,cell.Size,span.Max,true,span.Max==author.At(cell.X,cell.Z).Top?0:4);mesh.Horizontal(cell.X,cell.Z,cell.Size,span.Min,false,3);}
    for(int direction=0;direction<4;direction++)
    {
     int start=0;List<TerrainSolidSurface.Span> last=null;
     for(int s=0;s<=cell.Size;s++)
     {
      var visible=new List<TerrainSolidSurface.Span>();
      if(s<cell.Size){int nx=direction==0?cell.X-1:direction==1?cell.X+cell.Size:cell.X+s;int nz=direction==2?cell.Z-1:direction==3?cell.Z+cell.Size:cell.Z+s;visible=TerrainSolidSurface.Visible(own,solid.At(nx,nz));}
      if(s==0){last=visible;continue;}
      if(!TerrainSolidSurface.Same(visible,last)||s==cell.Size){foreach(var span in last)mesh.Side(cell,direction,start,s,span.Min,span.Max);start=s;last=visible;}
     }
    }
   }
   foreach(var item in chunks.OrderBy(p=>p.Key.X).ThenBy(p=>p.Key.Z))build.Chunks.Add(item.Value.Finish());
   timer.Stop();build.Milliseconds=timer.ElapsedMilliseconds;return build;
  }
  static Bounds2 DocumentBounds(TerrainDocument d)
  {return d.Cells.Count==0?new Bounds2(0,0,0,0):new Bounds2(d.Cells.Min(c=>c.X),d.Cells.Min(c=>c.Z),d.Cells.Max(c=>c.X+c.Size),d.Cells.Max(c=>c.Z+c.Size));}
  static void ApplyFault(TerrainDocument d,CellIndex author,TerrainSolidSurface surface,TerrainCell c)
  {
   if(d.Style!=0||c.Size!=1)return;int x=c.X,z=c.Z,rawTop=author.At(x,z).Top,lower=d.BaseHeight,distance=Band+1;int[] hits=new int[4];
   for(int n=0;n<4;n++){hits[n]=Band+1;for(int s=1;s<=Band;s++){var a=author.At(x+DX[n]*s,z+DZ[n]*s);if(a==null||a.Top<rawTop){hits[n]=s;if(s<distance){distance=s;lower=a==null?d.BaseHeight:a.Top;}break;}}}
   if(hits[0]<=Band&&hits[1]<=Band&&hits[0]+hits[1]<=Band+3||hits[2]<=Band&&hits[3]<=Band&&hits[2]+hits[3]<=Band+3)return;
   int seed=d.Seed;foreach(var patch in d.SeedPatches)if(patch.Bounds.Contains(x,z))seed=patch.Seed;uint group=ColumnGroup(x,z,seed);int height=rawTop-lower;
   if(height<24||group%5!=1||distance>2+(int)((group>>9)%4))return;
   int lo=lower+(int)(height*(.35f+(group>>14)%4*.05f));int hi=lo+2+(int)((group>>18)%4);surface.Cut(c,lo,hi);
  }
  static void RegularizeSaddles(CellIndex derived,CellIndex author,int bottom,Bounds2 region)
  {
   var pending=new Queue<CellKey>();var queued=new HashSet<CellKey>();
   Action<int,int> enqueue=(x,z)=>{var k=new CellKey(x,z,0);if(region.Contains(x,z)&&queued.Add(k))pending.Enqueue(k);};
   foreach(var c in derived.Map.Values.OrderBy(c=>c.X).ThenBy(c=>c.Z).ThenBy(c=>c.Size)){enqueue(c.X,c.Z);enqueue(c.X+c.Size,c.Z);enqueue(c.X,c.Z+c.Size);enqueue(c.X+c.Size,c.Z+c.Size);}
   while(pending.Count>0)
   {
    var p=pending.Dequeue();queued.Remove(p);int[] xs={p.X-1,p.X,p.X-1,p.X},zs={p.Z-1,p.Z-1,p.Z,p.Z};var cells=new TerrainCell[4];var heights=new int[4];
    for(int i=0;i<4;i++){cells[i]=derived.At(xs[i],zs[i]);heights[i]=cells[i]==null?bottom:cells[i].Top;}
    int a=-1,b=-1,target=0;
    if(Math.Min(heights[0],heights[3])>Math.Max(heights[1],heights[2])){a=1;b=2;target=Math.Min(heights[0],heights[3]);}
    else if(Math.Min(heights[1],heights[2])>Math.Max(heights[0],heights[3])){a=0;b=3;target=Math.Min(heights[1],heights[2]);}
    if(a<0)continue;
    int chosen=-1;
    foreach(int i in new[]{a,b}){var raw=author.At(xs[i],zs[i]);if(cells[i]!=null&&raw!=null&&raw.Top>=target&&(chosen<0||heights[i]>heights[chosen]))chosen=i;}
    if(chosen<0)throw new ArgumentException("Terrain has a diagonal-only plateau contact. Add a face-connected bridge or erase one touching corner.");
    int x=xs[chosen],z=zs[chosen];derived.Split(cells[chosen],1);derived.At(x,z).Top=target;
    enqueue(x,z);enqueue(x+1,z);enqueue(x,z+1);enqueue(x+1,z+1);
   }
  }
  static bool NearEdge(CellIndex index,TerrainCell c,int bottom)
  {
   int x=c.X+c.Size/2,z=c.Z+c.Size/2;
   for(int n=0;n<4;n++)for(int s=1;s<=Band+c.Size;s++){var a=index.At(x+DX[n]*s,z+DZ[n]*s);if(a==null||a.Top<c.Top)return true;}
   return false;
  }
  static int ShapedTop(TerrainDocument d,CellIndex index,int x,int z,int top)
  {
   int bestDistance=Band+1,lower=d.BaseHeight;var distances=new int[4];
   for(int n=0;n<4;n++)
   {
    distances[n]=Band+1;
    for(int s=1;s<=Band;s++){var a=index.At(x+DX[n]*s,z+DZ[n]*s);if(a==null||a.Top<top){distances[n]=s;if(s<bestDistance){bestDistance=s;lower=a==null?d.BaseHeight:a.Top;}break;}}
   }
   if(bestDistance>Band||top-lower<8)return top;
   // A narrow bridge remains complete across its whole top; edge dressing cannot sever it.
   if(distances[0]<=Band&&distances[1]<=Band&&distances[0]+distances[1]<=Band+3||distances[2]<=Band&&distances[3]<=Band&&distances[2]+distances[3]<=Band+3)return top;
   int seed=d.Seed;for(int i=0;i<d.SeedPatches.Count;i++)if(d.SeedPatches[i].Bounds.Contains(x,z))seed=d.SeedPatches[i].Seed;
   uint group=ColumnGroup(x,z,seed);
   // Physical group width is 0.75m, independent of brush quantum. Rare uncut groups are continuous ribs.
   int depth=3+(int)(group%7);if((group>>4)%7==0)depth=0;
   if(bestDistance>depth||depth==0)return top;
   float position=(bestDistance-.5f)/depth;int levels=d.Style==1?4:3;
   int tier=Math.Min(levels-1,(int)(position*levels));
   float fraction=(tier+1f)/(levels+1f)+(int)((group>>8)%5)*.025f;
   int height=top-lower;int y=d.Style==0?top-(int)Math.Round(Math.Min(12,height*.65f)*(1-fraction)):lower+(int)Math.Round(height*fraction);
   // Sparse partial faults vary by pillar group rather than forming full concentric rings.
   if(d.Style==0&&((group>>14)%5)==0&&tier==1)y-=Math.Min(2,height/16);
   return Math.Max(lower+1,Math.Min(top,y));
  }
  static uint Hash(int x,int z,int seed)
  {unchecked{uint h=(uint)(x*374761393+z*668265263+seed*1274126177);h=(h^(h>>13))*1274126177u;return h^(h>>16);}}
  static uint ColumnGroup(int x,int z,int seed)
  {
   const int span=12;int gx=TerrainUnits.FloorDiv(x,span),gz=TerrainUnits.FloorDiv(z,span);long best=long.MaxValue;uint chosen=0;
   for(int dz=-1;dz<=1;dz++)for(int dx=-1;dx<=1;dx++){int a=gx+dx,b=gz+dz;uint h=Hash(a,b,seed);int px=a*span+3+(int)(h%7),pz=b*span+3+(int)((h>>6)%7);long dd=(long)(x-px)*(x-px)+(long)(z-pz)*(z-pz);if(dd<best){best=dd;chosen=h;}}
   return chosen;
  }
  sealed class MeshWriter
  {
   readonly int cx,cz;readonly List<float> vertices=new List<float>(),normals=new List<float>(),uv=new List<float>();readonly List<int> triangles=new List<int>();
   public MeshWriter(int x,int z){cx=x;cz=z;}
   void Quad(int[] xyz,int nx,int ny,int nz,int palette)
   {
    int start=vertices.Count/3;
    for(int i=0;i<4;i++){vertices.Add(xyz[i*3]*TerrainUnits.Unit);vertices.Add(xyz[i*3+1]*TerrainUnits.Unit);vertices.Add(xyz[i*3+2]*TerrainUnits.Unit);normals.Add(nx);normals.Add(ny);normals.Add(nz);uv.Add((palette+.5f)/8f);uv.Add(.5f);}
    triangles.Add(start);triangles.Add(start+1);triangles.Add(start+2);triangles.Add(start);triangles.Add(start+2);triangles.Add(start+3);
   }
   public void Horizontal(int x,int z,int q,int y,bool up,int palette)
   {if(up)Quad(new[]{x,y,z,x,y,z+q,x+q,y,z+q,x+q,y,z},0,1,0,palette);else Quad(new[]{x,y,z,x+q,y,z,x+q,y,z+q,x,y,z+q},0,-1,0,palette);}
   public void Side(TerrainCell c,int dir,int a,int b,int y0,int y1)
   {
    int x=c.X,z=c.Z;
    if(dir==0)Quad(new[]{x,y0,z+a,x,y0,z+b,x,y1,z+b,x,y1,z+a},-1,0,0,2);
    if(dir==1){x+=c.Size;Quad(new[]{x,y0,z+a,x,y1,z+a,x,y1,z+b,x,y0,z+b},1,0,0,1);}
    if(dir==2)Quad(new[]{x+a,y0,z,x+a,y1,z,x+b,y1,z,x+b,y0,z},0,0,-1,2);
    if(dir==3){z+=c.Size;Quad(new[]{x+a,y0,z,x+b,y0,z,x+b,y1,z,x+a,y1,z},0,0,1,1);}
   }
   public ChunkMesh Finish(){return new ChunkMesh{Id="chunk_"+cx+"_"+cz,ChunkX=cx,ChunkZ=cz,Vertices=vertices.ToArray(),Normals=normals.ToArray(),UV=uv.ToArray(),Triangles=triangles.ToArray()};}
  }
 }
}

