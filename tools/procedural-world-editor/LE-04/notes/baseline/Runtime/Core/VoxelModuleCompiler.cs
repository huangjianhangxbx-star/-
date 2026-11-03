using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
namespace XingHai.LE01.Core
{
 public static class VoxelModuleCompiler
 {
  const int MaxColumns=1000000,MaxPlacedVoxels=2000000;
  struct SolidSpan
  {
   internal int Min,Max,Material,Fallback,OriginalMin;internal int[] Faces;internal string Owner,Child;
   internal SolidSpan Slice(int lo,int hi){var s=this;s.Min=lo;s.Max=hi;return s;}
  }
  sealed class Column {internal int RawTop;internal readonly List<SolidSpan> Spans=new List<SolidSpan>();}
  sealed class Placed {internal VoxelPlacement Placement;internal VoxelModuleAsset Asset;internal int X0,Y0,Z0,X1,Y1,Z1;internal int[] Palette;}
  struct VoxelKey:IEquatable<VoxelKey>
  {
   internal int X,Y,Z;internal VoxelKey(int x,int y,int z){X=x;Y=y;Z=z;}
   public bool Equals(VoxelKey k){return X==k.X&&Y==k.Y&&Z==k.Z;}
   public override bool Equals(object o){return o is VoxelKey&&Equals((VoxelKey)o);}
   public override int GetHashCode(){unchecked{return X*73856093^Y*19349663^Z*83492791;}}
  }
  struct SideKey:IEquatable<SideKey>
  {
   internal int X,Z,Dir;internal SideKey(int x,int z,int d){X=x;Z=z;Dir=d;}
   public bool Equals(SideKey k){return X==k.X&&Z==k.Z&&Dir==k.Dir;}
   public override bool Equals(object o){return o is SideKey&&Equals((SideKey)o);}
   public override int GetHashCode(){unchecked{return X*73856093^Z*19349663^Dir;}}
  }
  struct OriginalSide {internal int Min,Max;internal ModuleFaceStyle Style;}
  static readonly int[] DX={-1,1,0,0},DZ={0,0,-1,1},FaceDir={0,1,4,5};
  static Placed Transform(VoxelPlacement p,VoxelModuleAsset a,int q,int[] palette)
  {
   int sx=p.yaw%2==0?a.size[0]:a.size[2],sz=p.yaw%2==0?a.size[2]:a.size[0];
   return new Placed{Placement=p,Asset=a,Palette=palette,X0=p.x*q,X1=(p.x+sx)*q,Z0=p.z*q,Z1=(p.z+sz)*q,Y0=p.y*q,Y1=(p.y+a.size[1])*q};
  }
  static VoxelKey Transform(Placed p,VoxelCell cell,int q)
  {
   int x=cell.x,z=cell.z,yaw=p.Placement.yaw;
   if(yaw==1){x=cell.z;z=p.Asset.size[0]-1-cell.x;}else if(yaw==2){x=p.Asset.size[0]-1-cell.x;z=p.Asset.size[2]-1-cell.z;}else if(yaw==3){x=p.Asset.size[2]-1-cell.z;z=cell.x;}
   return new VoxelKey((p.Placement.x+x)*q,(p.Placement.y+cell.y)*q,(p.Placement.z+z)*q);
  }
  static int[] Faces(Placed p,VoxelCell cell)
  {
   if(cell.faces==null)return null;var result=new int[6];int[] x={-1,1,0,0,0,0},z={0,0,0,0,-1,1};
   for(int i=0;i<6;i++){int dir=i;if(i!=2&&i!=3){int rx=x[i],rz=z[i];for(int r=0;r<p.Placement.yaw;r++){int old=rx;rx=rz;rz=-old;}dir=rx<0?0:rx>0?1:rz<0?4:5;}result[dir]=p.Palette[cell.faces[i]];}return result;
  }
  static void Replace(List<SolidSpan> spans,int lo,int hi,SolidSpan? addition,List<SolidSpan> scratch)
  {
   scratch.Clear();foreach(var old in spans){if(old.Max<=lo||old.Min>=hi)scratch.Add(old);else{if(old.Min<lo)scratch.Add(old.Slice(old.Min,lo));if(old.Max>hi)scratch.Add(old.Slice(hi,old.Max));}}
   if(addition.HasValue)scratch.Add(addition.Value);scratch.Sort((a,b)=>a.Min.CompareTo(b.Min));spans.Clear();spans.AddRange(scratch);
  }
  static Column CopyBase(TerrainSolidSurface solid,int x,int z)
  {
   var c=new Column{RawTop=int.MinValue};if(solid==null)return c;var raw=solid.Index.At(x,z);if(raw!=null)c.RawTop=raw.Top;
   foreach(var s in solid.At(x,z))c.Spans.Add(new SolidSpan{Min=s.Min,Max=s.Max,Material=-1,Owner="",Child=""});return c;
  }
  static bool SameColor(VoxelPaletteEntry a,VoxelPaletteEntry b){if(a.role!=b.role)return false;for(int i=0;i<4;i++)if(a.rgba[i]!=b.rgba[i])return false;return true;}
  static List<VoxelPaletteEntry> BasePalette(string theme)
  {
   float[][] values=theme=="snow-rock"?new[]{new[]{.92f,.95f,.94f,1},new[]{.32f,.40f,.48f,1},new[]{.23f,.31f,.40f,1},new[]{.16f,.22f,.29f,1},new[]{.36f,.44f,.51f,1},new[]{.45f,.53f,.59f,1},new[]{.76f,.84f,.88f,1},new[]{.59f,.68f,.75f,1}}:new[]{new[]{.61f,.69f,.65f,1},new[]{.40f,.46f,.50f,1},new[]{.26f,.33f,.39f,1},new[]{.23f,.27f,.30f,1},new[]{.52f,.58f,.56f,1},new[]{.69f,.72f,.66f,1},new[]{.45f,.51f,.49f,1},new[]{1f,1f,1f,1}};
   var result=new List<VoxelPaletteEntry>();for(int i=0;i<8;i++)result.Add(new VoxelPaletteEntry{id="base."+i,role=theme=="snow-rock"&&i==0?"snow":"rock",rgba=values[i]});return result;
  }
  static int[] AddPalette(List<VoxelPaletteEntry> palette,VoxelModuleAsset asset)
  {var map=new int[asset.palette.Count];for(int i=0;i<map.Length;i++){int index=palette.FindIndex(p=>SameColor(p,asset.palette[i]));if(index<0){index=palette.Count;palette.Add(asset.palette[i].Copy());}map[i]=index;}return map;}
  static void FixSnow(Column column,List<VoxelPaletteEntry> palette)
  {
   bool exposedSnow=true;int ceiling=int.MaxValue;
   for(int i=column.Spans.Count-1;i>=0;i--){var s=column.Spans[i];bool snow=s.Material>=0&&palette[s.Material].role=="snow";if(ceiling!=int.MaxValue&&s.Max!=ceiling)exposedSnow=false;if(!snow)exposedSnow=false;if(snow&&!exposedSnow){s.Material=s.Fallback;s.Faces=null;column.Spans[i]=s;}ceiling=s.Min;}
  }
  static bool At(Column c,int y,out SolidSpan found)
  {foreach(var s in c.Spans)if(s.Min<=y&&s.Max>y){found=s;return true;}found=default(SolidSpan);return false;}
  // Stacking two designed pieces can leave an edge-only (four-face) contact.
  // Extend only an original upper module foot by one source grid cell. Existing
  // occupancy is never overwritten, and the new band cannot propagate downward.
  static void RepairHorizontalJoins(Dictionary<CellKey,Column> columns,int q,List<SolidSpan> scratch)
  {
   var pending=new Queue<CellKey>(columns.Keys.OrderBy(k=>k.X).ThenBy(k=>k.Z));var queued=new HashSet<CellKey>(pending);var gaps=new List<int>();int repaired=0;
   Action<CellKey> enqueue=key=>{if(columns.ContainsKey(key)&&queued.Add(key))pending.Enqueue(key);};
   Action<CellKey,SolidSpan> bridge=(key,source)=>{
    int x0=TerrainUnits.FloorDiv(key.X,q)*q,z0=TerrainUnits.FloorDiv(key.Z,q)*q,lo=source.OriginalMin-q,hi=source.OriginalMin;
    for(int z=z0;z<z0+q;z++)for(int x=x0;x<x0+q;x++){
     var target=new CellKey(x,z,0);Column c;SolidSpan upper;if(!columns.TryGetValue(target,out c)||!At(c,hi,out upper)||upper.Material<0||upper.Owner!=source.Owner)continue;
     gaps.Clear();int start=lo;foreach(var old in c.Spans){if(old.Max<=start)continue;if(old.Min>=hi)break;if(old.Min>start){gaps.Add(start);gaps.Add(Math.Min(old.Min,hi));}start=Math.Max(start,old.Max);if(start>=hi)break;}if(start<hi){gaps.Add(start);gaps.Add(hi);}
     if(gaps.Count==0)continue;if(++repaired>100000)throw new ArgumentException("Module contact-repair work budget exceeded.");
     for(int g=0;g<gaps.Count;g+=2)Replace(c.Spans,gaps[g],gaps[g+1],source.Slice(gaps[g],gaps[g+1]),scratch);
     enqueue(target);enqueue(new CellKey(x-1,z,0));enqueue(new CellKey(x+1,z,0));enqueue(new CellKey(x,z-1,0));enqueue(new CellKey(x,z+1,0));
    }
   };
   Action<CellKey,Column,Column> check=(key,upperColumn,other)=>{
    for(int i=0;i<upperColumn.Spans.Count;i++){var upper=upperColumn.Spans[i];if(upper.Material<0||upper.Min!=upper.OriginalMin)continue;int y=upper.Min;SolidSpan below,opposite,above;if(At(upperColumn,y-1,out below)||!At(other,y-1,out opposite)||At(other,y,out above)||opposite.Material<0||opposite.Owner==upper.Owner)continue;bridge(key,upper);}
   };
   while(pending.Count>0){var key=pending.Dequeue();queued.Remove(key);Column own=columns[key];foreach(var next in new[]{new CellKey(key.X+1,key.Z,0),new CellKey(key.X,key.Z+1,0)}){Column other;if(!columns.TryGetValue(next,out other))continue;check(key,own,other);check(next,other,own);}}
  }
  static ModuleFaceStyle Style(SolidSpan s,int dir,int material=-1)
  {return new ModuleFaceStyle(material>=0?material:s.Faces==null?s.Material:s.Faces[dir],s.Owner,s.Child,s.Material>=0?"module:"+s.Owner:"");}
  static int Direction(ChunkMesh chunk,int vertex)
  {int i=vertex*3;float x=chunk.Normals[i],y=chunk.Normals[i+1];return x<-.5f?0:x>.5f?1:y<-.5f?2:y>.5f?3:chunk.Normals[i+2]<0?4:5;}
  static ModuleFaceStyle OriginalStyle(ChunkMesh c,int quad)
  {
   int triangle=quad*2,material=Math.Max(0,Math.Min(7,(int)Math.Floor(c.UV[quad*8]*8)));
   return new ModuleFaceStyle(material,triangle<c.TriangleGroupIds.Length?c.TriangleGroupIds[triangle]:"",triangle<c.TriangleChildIds.Length?c.TriangleChildIds[triangle]:"",triangle<c.TriangleBoundaryKeys.Length?c.TriangleBoundaryKeys[triangle]:"");
  }
  static void ClipBase(TerrainBuild terrain,Dictionary<CellKey,Column> columns,VoxelModuleMesher mesher,Dictionary<SideKey,List<OriginalSide>> metadata)
  {
   var touched=new HashSet<CellKey>(columns.Keys.Select(k=>new CellKey(TerrainUnits.FloorDiv(k.X,64),TerrainUnits.FloorDiv(k.Z,64),0)));
   foreach(var chunk in terrain.Chunks){if(!mesher.Allowed(chunk.ChunkX,chunk.ChunkZ))continue;if(!touched.Contains(new CellKey(chunk.ChunkX,chunk.ChunkZ,0))){mesher.Preserve(chunk);continue;}
    if(chunk.Vertices.Length%12!=0||chunk.Triangles.Length!=chunk.Vertices.Length/2)throw new ArgumentException("Base composition requires the original uncomposed quad mesh.");mesher.Ensure(chunk.ChunkX,chunk.ChunkZ);
    for(int quad=0;quad<chunk.Vertices.Length/12;quad++){
     int vertex=quad*4,dir=Direction(chunk,vertex);var style=OriginalStyle(chunk,quad);int minX=int.MaxValue,minY=int.MaxValue,minZ=int.MaxValue,maxX=int.MinValue,maxY=int.MinValue,maxZ=int.MinValue;
     for(int n=0;n<4;n++){int i=(vertex+n)*3,x=TerrainUnits.ToUnits(chunk.Vertices[i]),y=TerrainUnits.ToUnits(chunk.Vertices[i+1]),z=TerrainUnits.ToUnits(chunk.Vertices[i+2]);minX=Math.Min(minX,x);maxX=Math.Max(maxX,x);minY=Math.Min(minY,y);maxY=Math.Max(maxY,y);minZ=Math.Min(minZ,z);maxZ=Math.Max(maxZ,z);}
     if(dir==2||dir==3){bool changed=false;for(int z=minZ;z<maxZ&&!changed;z++)for(int x=minX;x<maxX;x++)if(columns.ContainsKey(new CellKey(x,z,0))){changed=true;break;}
      if(!changed){mesher.Retain(chunk,quad,style);continue;}for(int z=minZ;z<maxZ;z++)for(int x=minX;x<maxX;x++)if(!columns.ContainsKey(new CellKey(x,z,0)))mesher.Rectangle(chunk.ChunkX,chunk.ChunkZ,dir,minY,x,z,x+1,z+1,style);
     }else{
      int start=dir<2?minZ:minX,end=dir<2?maxZ:maxX,plane=dir<2?minX:minZ;bool changed=false;
      for(int t=start;t<end;t++){int x=dir==0?plane:dir==1?plane-1:t,z=dir==4?plane:dir==5?plane-1:t;if(columns.ContainsKey(new CellKey(x,z,0))){changed=true;var side=new SideKey(x,z,dir);List<OriginalSide> list;if(!metadata.TryGetValue(side,out list))metadata[side]=list=new List<OriginalSide>();list.Add(new OriginalSide{Min=minY,Max=maxY,Style=style});}}
      if(!changed){mesher.Retain(chunk,quad,style);continue;}for(int t=start;t<end;t++){int x=dir==0?plane:dir==1?plane-1:t,z=dir==4?plane:dir==5?plane-1:t;if(!columns.ContainsKey(new CellKey(x,z,0)))mesher.Rectangle(chunk.ChunkX,chunk.ChunkZ,dir,plane,t,minY,t+1,maxY,style);}
     }
    }
   }
  }
  static void BaseSide(VoxelModuleMesher mesher,int x,int z,int dir,int lo,int hi,Dictionary<SideKey,List<OriginalSide>> metadata,List<int> cuts)
  {
   int material=dir==0||dir==4?2:1;List<OriginalSide> original;metadata.TryGetValue(new SideKey(x,z,dir),out original);cuts.Clear();cuts.Add(lo);cuts.Add(hi);if(original!=null)foreach(var s in original){if(s.Min>lo&&s.Min<hi)cuts.Add(s.Min);if(s.Max>lo&&s.Max<hi)cuts.Add(s.Max);}cuts.Sort();
   for(int i=0;i<cuts.Count-1;i++){int a=cuts[i],b=cuts[i+1];if(a==b)continue;var style=new ModuleFaceStyle(material,"","","");if(original!=null)foreach(var s in original)if(s.Min<=a&&s.Max>=b){style=new ModuleFaceStyle(material,s.Style.Owner,s.Style.Child,s.Style.Boundary);break;}EmitSide(mesher,x,z,dir,a,b,style);}
  }
  static void EmitSide(VoxelModuleMesher mesher,int x,int z,int dir,int lo,int hi,ModuleFaceStyle style)
  {int cx=TerrainUnits.FloorDiv(x,64),cz=TerrainUnits.FloorDiv(z,64),plane=dir==0?x:dir==1?x+1:dir==4?z:z+1,t=dir<2?z:x;mesher.Rectangle(cx,cz,dir,plane,t,lo,t+1,hi,style);}
  public static VoxelWorldBuild Build(TerrainBuild terrain,VoxelLayerDocument layer,string theme="stone",bool allChunks=true)
  {
   if(terrain==null)throw new ArgumentException("Missing base terrain build.");if(terrain.ModuleComposed)throw new ArgumentException("Use the cached uncomposed base build, not already composed module geometry.");string error;if(!VoxelModules.ValidateLayer(layer,out error))throw new ArgumentException(error);if(layer.placements.Count>0&&terrain.Chunks.Any(c=>c.Triangles.Length>0)&&terrain.Solid==null)throw new ArgumentException("The base build needs its uncomposed solid-column snapshot.");
   var timer=Stopwatch.StartNew();int q=TerrainUnits.ToUnits(layer.voxelSize);var palette=BasePalette(theme);var maps=new Dictionary<string,int[]>();var assets=layer.assets.ToDictionary(VoxelModules.AssetKey);var placed=new List<Placed>();var columns=new Dictionary<CellKey,Column>();long inputs=0;
   foreach(var p in layer.placements){var asset=assets[VoxelModules.AssetKey(p)];int[] map;if(!maps.TryGetValue(VoxelModules.AssetKey(p),out map))maps[VoxelModules.AssetKey(p)]=map=AddPalette(palette,asset);var transform=Transform(p,asset,q,map);placed.Add(transform);inputs+=asset.voxels.Count;if(inputs>MaxPlacedVoxels)throw new ArgumentException("Placed module voxel work budget exceeded.");long area=(long)(transform.X1-transform.X0+2)*(transform.Z1-transform.Z0+2);if(area>MaxColumns)throw new ArgumentException("Module affected-column budget exceeded.");
    for(int z=transform.Z0-1;z<=transform.Z1;z++)for(int x=transform.X0-1;x<=transform.X1;x++){var key=new CellKey(x,z,0);if(!columns.ContainsKey(key)){if(columns.Count==MaxColumns)throw new ArgumentException("Module affected-column budget exceeded.");columns[key]=CopyBase(terrain.Solid,x,z);}}
   }
   var scratch=new List<SolidSpan>();foreach(var p in placed)if(p.Placement.replaceBase)for(int z=p.Z0;z<p.Z1;z++)for(int x=p.X0;x<p.X1;x++)Replace(columns[new CellKey(x,z,0)].Spans,p.Y0,p.Y1,null,scratch);
   var voxelKeys=new HashSet<VoxelKey>();foreach(var p in placed){int fallback=p.Asset.palette.FindIndex(c=>c.role=="rock");if(fallback<0)fallback=p.Asset.palette.FindIndex(c=>c.role!="snow");fallback=fallback<0?1:p.Palette[fallback];
    foreach(var cell in p.Asset.voxels){var key=Transform(p,cell,q);voxelKeys.Add(key);var span=new SolidSpan{Min=key.Y,Max=key.Y+q,OriginalMin=key.Y,Material=p.Palette[cell.material],Faces=Faces(p,cell),Fallback=fallback,Owner=p.Placement.id,Child=p.Asset.assetId};for(int z=key.Z;z<key.Z+q;z++)for(int x=key.X;x<key.X+q;x++)Replace(columns[new CellKey(x,z,0)].Spans,span.Min,span.Max,span,scratch);}
   }
   RepairHorizontalJoins(columns,q,scratch);foreach(var column in columns.Values)FixSnow(column,palette);var allowed=allChunks?null:new HashSet<CellKey>(terrain.Chunks.Select(c=>new CellKey(c.ChunkX,c.ChunkZ,0)));var mesher=new VoxelModuleMesher(palette.Count,allowed);var metadata=new Dictionary<SideKey,List<OriginalSide>>();ClipBase(terrain,columns,mesher,metadata);var cuts=new List<int>();
   foreach(var pair in columns.OrderBy(p=>p.Key.X).ThenBy(p=>p.Key.Z)){int x=pair.Key.X,z=pair.Key.Z,cx=TerrainUnits.FloorDiv(x,64),cz=TerrainUnits.FloorDiv(z,64);if(!mesher.Allowed(cx,cz))continue;mesher.Ensure(cx,cz);var own=pair.Value.Spans;
    for(int i=0;i<own.Count;i++){var s=own[i];if(i==own.Count-1||own[i+1].Min>s.Max)mesher.Rectangle(cx,cz,3,s.Max,x,z,x+1,z+1,Style(s,3,s.Material<0?(s.Max==pair.Value.RawTop?0:4):-1));if(i==0||own[i-1].Max<s.Min)mesher.Rectangle(cx,cz,2,s.Min,x,z,x+1,z+1,Style(s,2,s.Material<0?3:-1));
     for(int side=0;side<4;side++){int nx=x+DX[side],nz=z+DZ[side],dir=FaceDir[side];Column neighbor;List<SolidSpan> other;if(columns.TryGetValue(new CellKey(nx,nz,0),out neighbor))other=neighbor.Spans;else other=CopyBase(terrain.Solid,nx,nz).Spans;int start=s.Min;
      foreach(var n in other){if(n.Max<=start)continue;if(n.Min>=s.Max)break;if(n.Min>start){int hi=Math.Min(n.Min,s.Max);if(s.Material<0)BaseSide(mesher,x,z,dir,start,hi,metadata,cuts);else EmitSide(mesher,x,z,dir,start,hi,Style(s,dir));}start=Math.Max(start,n.Max);if(start>=s.Max)break;}if(start<s.Max){if(s.Material<0)BaseSide(mesher,x,z,dir,start,s.Max,metadata,cuts);else EmitSide(mesher,x,z,dir,start,s.Max,Style(s,dir));}
     }
    }
   }
   var output=new TerrainBuild{AuthorLeaves=terrain.AuthorLeaves,DerivedCells=terrain.DerivedCells+columns.Count,SourceRevision=terrain.SourceRevision,Structures=new List<StructureInfo>(terrain.Structures),RebuiltBounds=terrain.RebuiltBounds,Solid=terrain.Solid,ModuleComposed=true,ClearPrevious=terrain.ClearPrevious,ModulePalette=palette.Select(p=>p.Copy()).ToArray(),Chunks=mesher.Finish()};
   if(columns.Count>0){var b=terrain.RebuiltBounds;output.RebuiltBounds=new Bounds2(Math.Min(b.MinX,columns.Keys.Min(k=>k.X)),Math.Min(b.MinZ,columns.Keys.Min(k=>k.Z)),Math.Max(b.MaxX,columns.Keys.Max(k=>k.X)+1),Math.Max(b.MaxZ,columns.Keys.Max(k=>k.Z)+1));}output.Milliseconds=timer.ElapsedMilliseconds;
   return new VoxelWorldBuild{geometry=output,palette=palette,affectedColumns=columns.Count,moduleVoxels=voxelKeys.Count};
  }
 }
}
