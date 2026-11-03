using System;using System.Collections.Generic;using System.Linq;
namespace XingHai.LE01.Core
{
 internal struct ModuleFaceStyle:IEquatable<ModuleFaceStyle>
 {
  internal int Material;internal string Owner,Child,Boundary;
  internal ModuleFaceStyle(int material,string owner,string child,string boundary){Material=material;Owner=owner??"";Child=child??"";Boundary=boundary??"";}
  public bool Equals(ModuleFaceStyle s){return Material==s.Material&&Owner==s.Owner&&Child==s.Child&&Boundary==s.Boundary;}
  public override bool Equals(object o){return o is ModuleFaceStyle&&Equals((ModuleFaceStyle)o);}
  public override int GetHashCode(){unchecked{return Material*397^Owner.GetHashCode()^Child.GetHashCode()^Boundary.GetHashCode();}}
 }
 internal sealed class VoxelModuleMesher
 {
  struct Rect {internal int A,B,C,D;internal Rect(int a,int b,int c,int d){A=a;B=b;C=c;D=d;}}
  struct FaceKey:IEquatable<FaceKey>
  {
   internal int X,Z,Dir,Plane;internal ModuleFaceStyle Style;
   public bool Equals(FaceKey k){return X==k.X&&Z==k.Z&&Dir==k.Dir&&Plane==k.Plane&&Style.Equals(k.Style);}
   public override bool Equals(object o){return o is FaceKey&&Equals((FaceKey)o);}
   public override int GetHashCode(){unchecked{return X*73856093^Z*19349663^Dir*397^Plane^Style.GetHashCode();}}
  }
  sealed class Writer
  {
   internal readonly int X,Z;internal readonly List<float> Vertices=new List<float>(),Normals=new List<float>(),UV=new List<float>();internal readonly List<int> Triangles=new List<int>();internal readonly List<string> Groups=new List<string>(),Children=new List<string>(),Boundaries=new List<string>();
   internal Writer(int x,int z){X=x;Z=z;}
   internal void Quad(float[] xyz,float nx,float ny,float nz,ModuleFaceStyle style,int count)
   {
    int start=Vertices.Count/3;Vertices.AddRange(xyz);for(int i=0;i<4;i++){Normals.Add(nx);Normals.Add(ny);Normals.Add(nz);UV.Add((style.Material+.5f)/count);UV.Add(.5f);}Triangles.Add(start);Triangles.Add(start+1);Triangles.Add(start+2);Triangles.Add(start);Triangles.Add(start+2);Triangles.Add(start+3);for(int i=0;i<2;i++){Groups.Add(style.Owner);Children.Add(style.Child);Boundaries.Add(style.Boundary);}
   }
   internal ChunkMesh Finish(){return new ChunkMesh{Id="chunk_"+X+"_"+Z,ChunkX=X,ChunkZ=Z,Vertices=Vertices.ToArray(),Normals=Normals.ToArray(),UV=UV.ToArray(),Triangles=Triangles.ToArray(),TriangleGroupIds=Groups.ToArray(),TriangleChildIds=Children.ToArray(),TriangleBoundaryKeys=Boundaries.ToArray()};}
  }
  readonly int paletteCount;readonly HashSet<CellKey> allowed;readonly Dictionary<CellKey,Writer> writers=new Dictionary<CellKey,Writer>();readonly Dictionary<CellKey,ChunkMesh> preserved=new Dictionary<CellKey,ChunkMesh>();readonly Dictionary<FaceKey,List<Rect>> faces=new Dictionary<FaceKey,List<Rect>>();
  internal VoxelModuleMesher(int count,HashSet<CellKey> filter){paletteCount=count;allowed=filter;}
  internal bool Allowed(int x,int z){return allowed==null||allowed.Contains(new CellKey(x,z,0));}
  internal void Ensure(int x,int z){if(!Allowed(x,z))return;var key=new CellKey(x,z,0);if(!writers.ContainsKey(key)&&!preserved.ContainsKey(key))writers[key]=new Writer(x,z);}
  internal void Preserve(ChunkMesh c)
  {
   var uv=new float[c.UV.Length];for(int i=0;i<uv.Length;i+=2){int material=Math.Max(0,Math.Min(7,(int)Math.Floor(c.UV[i]*8)));uv[i]=(material+.5f)/paletteCount;uv[i+1]=c.UV[i+1];}
   preserved[new CellKey(c.ChunkX,c.ChunkZ,0)]=new ChunkMesh{Id=c.Id,ChunkX=c.ChunkX,ChunkZ=c.ChunkZ,Vertices=c.Vertices,Normals=c.Normals,UV=uv,Triangles=c.Triangles,TriangleGroupIds=c.TriangleGroupIds,TriangleChildIds=c.TriangleChildIds,TriangleBoundaryKeys=c.TriangleBoundaryKeys};
  }
  internal void Retain(ChunkMesh c,int quad,ModuleFaceStyle style)
  {Ensure(c.ChunkX,c.ChunkZ);var xyz=new float[12];Array.Copy(c.Vertices,quad*12,xyz,0,12);int i=quad*12;writers[new CellKey(c.ChunkX,c.ChunkZ,0)].Quad(xyz,c.Normals[i],c.Normals[i+1],c.Normals[i+2],style,paletteCount);}
  internal void Rectangle(int x,int z,int dir,int plane,int a,int b,int c,int d,ModuleFaceStyle style)
  {if(a>=c||b>=d||!Allowed(x,z))return;var key=new FaceKey{X=x,Z=z,Dir=dir,Plane=plane,Style=style};List<Rect> list;if(!faces.TryGetValue(key,out list))faces[key]=list=new List<Rect>();list.Add(new Rect(a,b,c,d));}
  static List<Rect> Merge(List<Rect> values)
  {
   bool changed;do{int before=values.Count;values.Sort((a,b)=>a.B!=b.B?a.B.CompareTo(b.B):a.D!=b.D?a.D.CompareTo(b.D):a.A.CompareTo(b.A));var horizontal=new List<Rect>();foreach(var r in values){if(horizontal.Count>0){var old=horizontal[horizontal.Count-1];if(old.B==r.B&&old.D==r.D&&old.C==r.A){old.C=r.C;horizontal[horizontal.Count-1]=old;continue;}}horizontal.Add(r);}
    horizontal.Sort((a,b)=>a.A!=b.A?a.A.CompareTo(b.A):a.C!=b.C?a.C.CompareTo(b.C):a.B.CompareTo(b.B));values=new List<Rect>();foreach(var r in horizontal){if(values.Count>0){var old=values[values.Count-1];if(old.A==r.A&&old.C==r.C&&old.D==r.B){old.D=r.D;values[values.Count-1]=old;continue;}}values.Add(r);}changed=values.Count<before;
   }while(changed);return values;
  }
  static float[] Coordinates(FaceKey k,Rect r)
  {
   int a=r.A,b=r.B,c=r.C,d=r.D,p=k.Plane;int[] xyz;
   if(k.Dir==0)xyz=new[]{p,b,a,p,b,c,p,d,c,p,d,a};else if(k.Dir==1)xyz=new[]{p,b,a,p,d,a,p,d,c,p,b,c};else if(k.Dir==2)xyz=new[]{a,p,b,c,p,b,c,p,d,a,p,d};else if(k.Dir==3)xyz=new[]{a,p,b,a,p,d,c,p,d,c,p,b};else if(k.Dir==4)xyz=new[]{a,b,p,a,d,p,c,d,p,c,b,p};else xyz=new[]{a,b,p,c,b,p,c,d,p,a,d,p};
   var output=new float[12];for(int i=0;i<12;i++)output[i]=xyz[i]*TerrainUnits.Unit;return output;
  }
  internal List<ChunkMesh> Finish()
  {
   foreach(var group in faces.OrderBy(p=>p.Key.X).ThenBy(p=>p.Key.Z).ThenBy(p=>p.Key.Dir).ThenBy(p=>p.Key.Plane).ThenBy(p=>p.Key.Style.Material).ThenBy(p=>p.Key.Style.Owner,StringComparer.Ordinal).ThenBy(p=>p.Key.Style.Child,StringComparer.Ordinal).ThenBy(p=>p.Key.Style.Boundary,StringComparer.Ordinal)){
    var k=group.Key;Ensure(k.X,k.Z);float nx=k.Dir==0?-1:k.Dir==1?1:0,ny=k.Dir==2?-1:k.Dir==3?1:0,nz=k.Dir==4?-1:k.Dir==5?1:0;foreach(var r in Merge(group.Value))writers[new CellKey(k.X,k.Z,0)].Quad(Coordinates(k,r),nx,ny,nz,k.Style,paletteCount);
   }
   var result=new Dictionary<CellKey,ChunkMesh>(preserved);foreach(var p in writers)result[p.Key]=p.Value.Finish();return result.OrderBy(p=>p.Key.X).ThenBy(p=>p.Key.Z).Select(p=>p.Value).ToList();
  }
 }
}
