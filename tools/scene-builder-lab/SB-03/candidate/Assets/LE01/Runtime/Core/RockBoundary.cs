using System;using System.Collections.Generic;using System.Linq;using System.Globalization;
namespace XingHai.LE01.Core
{
 internal sealed class RockBoundary
 {
  internal const int Band=12;
  static string Number(int value){return value.ToString(CultureInfo.InvariantCulture);}
  internal readonly TerrainDocument Doc;internal readonly CellIndex Author;internal readonly Dictionary<string,BoundaryAnchor> Edges=new Dictionary<string,BoundaryAnchor>();
  // Local immutable height snapshot only. Never cache the mutable CellIndex.Map.
  // At most 4 MiB of integer slots; large or very sparse author envelopes use Author.
  const int MissingHeight=int.MinValue,MaxHeightSlots=1048576;
  readonly int[] heights;readonly int minX,minZ,width,height;
  readonly Dictionary<CellKey,List<BoundaryAnchor>> vertices=new Dictionary<CellKey,List<BoundaryAnchor>>();
  RockProfile structureProfile;
  internal static uint Hash(int x,int z,int seed){unchecked{uint h=(uint)(x*374761393+z*668265263+seed*1274126177);h=(h^(h>>13))*1274126177u;return h^(h>>16);}}
  internal static string Group(TerrainDocument doc,int x,int z)
  {
   int span=doc.GeneratorVersion=="le01.3"?TerrainRockPresets.For(doc).ColumnSpanUnits:20;int gx=TerrainUnits.FloorDiv(x,span),gz=TerrainUnits.FloorDiv(z,span),bestX=0,bestZ=0;long best=long.MaxValue;
   for(int dz=-1;dz<=1;dz++)for(int dx=-1;dx<=1;dx++){int a=gx+dx,b=gz+dz;uint h=Hash(a,b,doc.StableLayoutSeed);int px=a*span+6+(int)(h%9),pz=b*span+6+(int)((h>>7)%9);long d=(long)(x-px)*(x-px)+(long)(z-pz)*(z-pz);if(d<best){best=d;bestX=a;bestZ=b;}}
   return "g2:"+Number(bestX)+":"+Number(bestZ);
  }
  internal static uint GroupHash(string id,int seed){unchecked{int h=seed;foreach(char c in id)h=h*31+c;return Hash(h,17,seed);}}
  internal RockBoundary(TerrainDocument d)
  {
   Doc=d;Author=new CellIndex(d.Cells);
   if(d.Cells.Count>0){
    minX=d.Cells.Min(c=>c.X);minZ=d.Cells.Min(c=>c.Z);width=d.Cells.Max(c=>c.X+c.Size)-minX;height=d.Cells.Max(c=>c.Z+c.Size)-minZ;
    long area=(long)width*height,occupied=0;foreach(var c in d.Cells)occupied+=(long)c.Size*c.Size;
    if(area>0&&area<=MaxHeightSlots&&area<=Math.Max(4096L,occupied*8L)){
     heights=new int[(int)area];for(int i=0;i<heights.Length;i++)heights[i]=MissingHeight;
     foreach(var c in d.Cells)for(int z=c.Z;z<c.Z+c.Size;z++){int row=(z-minZ)*width+c.X-minX;for(int x=0;x<c.Size;x++)heights[row+x]=c.Top;}
    }
   }
   foreach(var c in d.Cells)for(int s=0;s<c.Size;s++)
   {Add(c,c.X,c.Z+s,0,-1,c.X-1,c.Z+s);Add(c,c.X+c.Size,c.Z+s,0,1,c.X+c.Size,c.Z+s);Add(c,c.X+s,c.Z,1,-1,c.X+s,c.Z-1);Add(c,c.X+s,c.Z+c.Size,1,1,c.X+s,c.Z+c.Size);}
  }
  int HeightAt(int x,int z)
  {
   if(heights==null){var c=Author.At(x,z);return c==null?MissingHeight:c.Top;}
   int dx=x-minX,dz=z-minZ;return (uint)dx<(uint)width&&(uint)dz<(uint)height?heights[dz*width+dx]:MissingHeight;
  }
  void Add(TerrainCell own,int x,int z,int axis,int sign,int nx,int nz)
  {
   int n=HeightAt(nx,nz),lo=n==MissingHeight?Doc.BaseHeight:n;if(lo>=own.Top)return;
   int childSpan=Doc.RockRuleVersion==1?Math.Max(8,TerrainRockPresets.For(Doc).ColumnSpanUnits/2):5;
   var a=new BoundaryAnchor{X=x,Z=z,Axis=axis,Sign=sign,LowerHeight=lo,UpperHeight=own.Top};a.GroupId=Group(Doc,x,z);a.ChildId=a.GroupId+":c:"+Number(TerrainUnits.FloorDiv(x,childSpan))+":"+Number(TerrainUnits.FloorDiv(z,childSpan));Edges[a.Key]=a;
   AddVertex(a,x,z);AddVertex(a,x+(axis==1?1:0),z+(axis==0?1:0));
  }
  void AddVertex(BoundaryAnchor a,int x,int z){var k=new CellKey(x,z,0);List<BoundaryAnchor> list;if(!vertices.TryGetValue(k,out list))vertices[k]=list=new List<BoundaryAnchor>();list.Add(a);}
  internal IEnumerable<BoundaryAnchor> Adjacent(BoundaryAnchor a)
  {foreach(var k in new[]{new CellKey(a.X,a.Z,0),new CellKey(a.X+(a.Axis==1?1:0),a.Z+(a.Axis==0?1:0),0)})foreach(var b in vertices[k])if(Math.Min(a.UpperHeight,b.UpperHeight)>Math.Max(a.LowerHeight,b.LowerHeight))yield return b;}
  internal BoundaryAnchor Nearest(int x,int z,int top,out float distance)
  {
   BoundaryAnchor chosen=null;distance=Band+1;int[] dx={-1,1,0,0},dz={0,0,-1,1};
   for(int n=0;n<4;n++)for(int s=1;s<=Band;s++){if(HeightAt(x+dx[n]*s,z+dz[n]*s)<top){int axis=n<2?0:1,sign=n%2==0?-1:1,px=axis==0?x+(sign<0?-s+1:s):x,pz=axis==1?z+(sign<0?-s+1:s):z;BoundaryAnchor edge;string key=Number(px)+":"+Number(pz)+":"+Number(axis)+":"+Number(sign);if(Edges.TryGetValue(key,out edge)&&s-.5f<distance){chosen=edge;distance=s-.5f;}break;}}
   return chosen;
  }
  internal bool Narrow(int x,int z,int top)
  {int[] hits={Band+1,Band+1,Band+1,Band+1},dx={-1,1,0,0},dz={0,0,-1,1};for(int n=0;n<4;n++)for(int s=1;s<=Band;s++){if(HeightAt(x+dx[n]*s,z+dz[n]*s)<top){hits[n]=s;break;}}return hits[0]<=Band&&hits[1]<=Band&&hits[0]+hits[1]<=Band+3||hits[2]<=Band&&hits[3]<=Band&&hits[2]+hits[3]<=Band+3;}
  internal static SculptSelection Resolve(TerrainDocument doc,SurfaceHit hit,float radius,SculptInfluence influence,int minHeight,int maxHeight)
  {
   string error;if(!TerrainGenerators.IsRockDocument(doc)||!TerrainKernel.Validate(doc,out error))return new SculptSelection{DocumentId=doc==null?null:doc.Id,SourceRevision=doc==null?0:doc.Revision,Influence=influence,Message="Explicit valid rock-generator upgrade is required."};
   return new RockBoundary(doc).Resolve(hit,radius,influence,minHeight,maxHeight);
  }
  internal static SculptSelection ResolveShape(TerrainDocument doc,SurfaceHit hit,float radius,SculptInfluence influence,int minHeight,int maxHeight)
  {
   string error;if(doc==null||doc.GeneratorVersion!="le01.3"||!TerrainKernel.Validate(doc,out error))return new SculptSelection{DocumentId=doc==null?null:doc.Id,SourceRevision=doc==null?0:doc.Revision,Influence=influence,Message="A valid v3 document is required for structural wall shape."};return new RockBoundary(doc).ResolveShape(hit,radius,influence,minHeight,maxHeight);
  }
  internal SculptSelection ResolveShape(SurfaceHit hit,float radius,SculptInfluence influence,int minHeight,int maxHeight)
  {
   var selection=Resolve(hit,radius,influence,minHeight,maxHeight);
   if(Doc.GeneratorVersion!="le01.3"){selection.Valid=false;selection.Message="A v3 candidate is required for structural wall shape.";return selection;}
   if(!selection.Valid||influence!=SculptInfluence.LocalSurface)return selection;
   if(structureProfile==null)structureProfile=new RockProfile(Doc,2);float y=hit.Y/TerrainUnits.Unit;selection.LocalMask=SculptLocalMask.StructurePatch;
   foreach(var a in selection.Anchors){var cuts=new SortedSet<int>{a.LowerHeight,a.UpperHeight};foreach(int at in structureProfile.EffectiveEvents(a,false)){cuts.Add(at);if(at+2<a.UpperHeight)cuts.Add(at+2);}var levels=cuts.ToArray();int lo=a.LowerHeight,hi=a.UpperHeight;for(int i=0;i<levels.Length-1;i++)if(y>=levels[i]&&y<levels[i+1]){lo=levels[i];hi=levels[i+1];break;}a.PatchMinHeight=Math.Max(selection.MinHeight,lo);a.PatchMaxHeight=Math.Min(selection.MaxHeight,hi);}
   selection.Anchors.RemoveAll(a=>a.PatchMaxHeight<=a.PatchMinHeight);if(selection.Anchors.Count==0){selection.Valid=false;selection.Message="No original structural wall fragment at the visible hit.";return selection;}
   selection.MinHeight=selection.Anchors.Min(a=>a.PatchMinHeight);selection.MaxHeight=selection.Anchors.Max(a=>a.PatchMaxHeight);selection.GroupIds=selection.Anchors.Select(a=>a.GroupId).Distinct().OrderBy(g=>g).ToList();selection.Message="Frozen planar wall fragments bounded by original column events and local width/height";return selection;
  }
  internal SculptSelection Resolve(SurfaceHit hit,float radius,SculptInfluence influence,int minHeight,int maxHeight)
  {
   var selection=new SculptSelection{DocumentId=Doc.Id,SourceRevision=Doc.Revision,Influence=influence,LocalX=hit.X,LocalY=hit.Y,LocalZ=hit.Z,LocalRadius=radius};
   if(new[]{radius,hit.X,hit.Y,hit.Z,hit.NormalX,hit.NormalY,hit.NormalZ}.Any(v=>float.IsNaN(v)||float.IsInfinity(v))||radius<=0||radius>8||Math.Abs(hit.NormalY)>.5f){selection.Message="Select a visible side wall.";return selection;}
   BoundaryAnchor first=null;double best=double.MaxValue;float hx=hit.X/TerrainUnits.Unit,hz=hit.Z/TerrainUnits.Unit,hy=hit.Y/TerrainUnits.Unit;
   if(!string.IsNullOrEmpty(hit.BoundaryKey)){
    if(!Edges.TryGetValue(hit.BoundaryKey,out first)||hy<first.LowerHeight-1||hy>first.UpperHeight+1){selection.Message="The visible mesh anchor is stale; refresh the terrain before editing.";return selection;}
   }else {
    foreach(var a in Edges.Values){float dot=a.Axis==0?a.Sign*hit.NormalX:a.Sign*hit.NormalZ;if(dot<.25f||hy<a.LowerHeight-1||hy>a.UpperHeight+1)continue;double ax=a.X+(a.Axis==1?.5:0),az=a.Z+(a.Axis==0?.5:0),d=(ax-hx)*(ax-hx)+(az-hz)*(az-hz);if(d<best){best=d;first=a;}}
    if(first==null||best>(Band+2)*(Band+2)){selection.Message="No connected editable author wall at hit.";return selection;}
   }
   var pending=new Queue<BoundaryAnchor>();var distance=new Dictionary<string,int>();pending.Enqueue(first);distance[first.Key]=0;float maxDistance=radius/TerrainUnits.Unit;
   float nx=string.IsNullOrEmpty(hit.BoundaryKey)?hit.NormalX:first.Axis==0?first.Sign:0,nz=string.IsNullOrEmpty(hit.BoundaryKey)?hit.NormalZ:first.Axis==1?first.Sign:0;
   while(pending.Count>0){var a=pending.Dequeue();int path=distance[a.Key];
    if(influence==SculptInfluence.LocalSurface){float tangent=(a.Axis==0?a.Z+.5f:a.X+.5f)*TerrainUnits.Unit-(a.Axis==0?hit.Z:hit.X);if(a.Axis!=first.Axis||a.Sign!=first.Sign||Math.Abs(tangent)>=radius||hy+maxDistance<=a.LowerHeight||hy-maxDistance>=a.UpperHeight)continue;}
    selection.Anchors.Add(a.Copy());if(path+1>maxDistance)continue;foreach(var b in Adjacent(a)){float dot=b.Axis==0?b.Sign*nx:b.Sign*nz;if(dot<-.05f||distance.ContainsKey(b.Key))continue;distance[b.Key]=path+1;pending.Enqueue(b);}}
   if(selection.Anchors.Count==0){selection.Message="No visible wall area inside local radius.";return selection;}
   selection.GroupIds=selection.Anchors.Select(a=>a.GroupId).Distinct().OrderBy(s=>s).ToList();selection.MinHeight=influence==SculptInfluence.LinkedColumn?selection.Anchors.Min(a=>a.LowerHeight):Math.Max(minHeight,selection.Anchors.Min(a=>a.LowerHeight));selection.MaxHeight=influence==SculptInfluence.LinkedColumn?selection.Anchors.Max(a=>a.UpperHeight):Math.Min(maxHeight,selection.Anchors.Max(a=>a.UpperHeight));
   if(influence==SculptInfluence.LocalSurface){selection.MinHeight=Math.Max(selection.Anchors.Min(a=>a.LowerHeight),(int)Math.Floor(hy-maxDistance));selection.MaxHeight=Math.Min(selection.Anchors.Max(a=>a.UpperHeight),(int)Math.Ceiling(hy+maxDistance));}
   selection.Bounds=new Bounds2(selection.Anchors.Min(a=>a.X)-Band,selection.Anchors.Min(a=>a.Z)-Band,selection.Anchors.Max(a=>a.X)+Band+1,selection.Anchors.Max(a=>a.Z)+Band+1);selection.Valid=selection.MaxHeight>selection.MinHeight;selection.Message=selection.Valid?"Frozen connected wall scope":"Empty height range";return selection;
  }
 }
}
