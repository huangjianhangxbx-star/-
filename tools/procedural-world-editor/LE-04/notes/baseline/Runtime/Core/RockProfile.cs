using System;using System.Collections.Generic;using System.Linq;
namespace XingHai.LE01.Core
{
 internal sealed class RockProfile
 {
  readonly TerrainDocument doc;readonly int level;readonly RockBrushPreset style;
  bool Structured{get{return doc.RockRuleVersion==1;}}
  struct PreparedKey:IEquatable<PreparedKey>{internal string Key,Group,Child;internal int Lower,Upper,Top;internal bool Shape;public bool Equals(PreparedKey b){return Key==b.Key&&Group==b.Group&&Child==b.Child&&Lower==b.Lower&&Upper==b.Upper&&Top==b.Top&&Shape==b.Shape;}public override bool Equals(object b){return b is PreparedKey&&Equals((PreparedKey)b);}public override int GetHashCode(){unchecked{return (Key.GetHashCode()*397^Group.GetHashCode())*397^Child.GetHashCode()^Lower*17^Upper*31^Top*67^(Shape?1:0);}}}
  readonly Dictionary<PreparedKey,int[]> preparedKnots=new Dictionary<PreparedKey,int[]>();
  readonly Dictionary<string,List<SculptOverride>> edits=new Dictionary<string,List<SculptOverride>>();
  readonly Dictionary<SculptOverride,Dictionary<string,BoundaryAnchor>> patches=new Dictionary<SculptOverride,Dictionary<string,BoundaryAnchor>>();
  // All semantic inputs (seed patches, locks, edits, style and version) are one
  // immutable per-build snapshot. The cache is never shared across documents.
  internal RockProfile(TerrainDocument d,int featureLevel){doc=d.Copy();level=featureLevel;style=doc.GeneratorVersion=="le01.3"?TerrainRockPresets.For(doc):null;if(doc.SculptOverrides!=null)foreach(var e in doc.SculptOverrides)if(e.Enabled&&e.Status==SculptStatus.Active){if(e.LocalMask==SculptLocalMask.StructurePatch)patches[e]=e.Anchors.ToDictionary(a=>a.Key);foreach(var a in e.Anchors){List<SculptOverride> list;if(!edits.TryGetValue(a.Key,out list))edits[a.Key]=list=new List<SculptOverride>();list.Add(e);}}}
  int Seed(BoundaryAnchor a,int y)
  {
   return TerrainSculptEdits.SeedFor(doc,a,y);
  }
  internal int EventHeight(BoundaryAnchor a,int seed)
  {uint h=RockBoundary.GroupHash(a.GroupId,seed);int height=a.UpperHeight-a.LowerHeight;return a.LowerHeight+height*(20+(int)((h>>7)%50))/100;}
  static float Clamp01(float value){return Math.Max(0,Math.Min(1,value));}
  static bool EventEnabled(uint parent){return (parent>>4)%3!=0;}
  internal int[] Events(BoundaryAnchor a,int seed){uint h=RockBoundary.GroupHash(a.GroupId,seed);return level>=1&&a.UpperHeight-a.LowerHeight>=20&&EventEnabled(h)?new[]{EventHeight(a,seed)}:new int[0];}
  internal int[] ChildEvents(BoundaryAnchor a,int seed){if(level<2)return new int[0];int start,end,taper;ChildRange(a,RockBoundary.GroupHash(a.ChildId,seed),out start,out end,out taper);return new[]{Math.Max(a.LowerHeight,start),Math.Min(a.UpperHeight,end)};}
  int[] SeedSegments(BoundaryAnchor a)
  {
   var cuts=new SortedSet<int>{a.LowerHeight,a.UpperHeight};foreach(var l in doc.ShapeLocks)if(l.Enabled&&l.Pins.Any(p=>p.BoundaryKey==a.Key)){if(l.MinHeight>a.LowerHeight&&l.MinHeight<a.UpperHeight)cuts.Add(l.MinHeight);if(l.MaxHeight>a.LowerHeight&&l.MaxHeight<a.UpperHeight)cuts.Add(l.MaxHeight);}return cuts.ToArray();
  }
  internal int[] EffectiveEvents(BoundaryAnchor a,bool child)
  {var result=new SortedSet<int>();var cuts=SeedSegments(a);for(int i=0;i<cuts.Length-1;i++){int seed=Seed(a,cuts[i]);foreach(int y in child?ChildEvents(a,seed):Events(a,seed))if(y>=cuts[i]&&y<cuts[i+1])result.Add(y);}return result.ToArray();}
  static void ChildRange(BoundaryAnchor a,uint child,out int start,out int end,out int taper)
  {int height=a.UpperHeight-a.LowerHeight;start=a.LowerHeight+height*(int)((child>>16)%35)/100;end=a.LowerHeight+height*(65+(int)((child>>23)%36))/100;taper=4+(int)((child>>12)%5);if(child%3==0)end=a.UpperHeight+taper;else if(child%3==1)start=a.LowerHeight-taper;}
  internal float Depth(BoundaryAnchor a,float y)
  {
   if(y<a.LowerHeight)return 0;
   int seed=Seed(a,(int)Math.Floor(y));uint parent=RockBoundary.GroupHash(a.GroupId,seed),child=RockBoundary.GroupHash(a.ChildId,seed);int height=a.UpperHeight-a.LowerHeight;
   float depth=style==null?2+(parent%8):style.BaseCutUnits+(parent%(uint)style.ReliefRangeUnits),density=style==null?.6f:style.ChildDensity,delta=0;
   List<SculptOverride> list;if(edits.TryGetValue(a.Key,out list))foreach(var e in list)
   {
    if(y<e.MinHeight||y>=e.MaxHeight)continue;float weight=1;
    if(e.Influence==SculptInfluence.HeightRange)weight=Math.Max(0,Math.Min(1,Math.Min((y-e.MinHeight)/4,(e.MaxHeight-y)/4)));
    else if(e.Influence==SculptInfluence.LocalSurface)weight=TerrainSculptEdits.LocalWeight(a,y,e.LocalX,e.LocalY,e.LocalZ,e.LocalRadius);
    if(e.Kind==SculptKind.Depth)delta+=e.Value/TerrainUnits.Unit*weight;else if(e.Kind==SculptKind.Density)density+=e.Value*weight;
   }
    if(level>=1&&height>=20&&EventEnabled(parent))
   {
    int eventY=EventHeight(a,seed);int offset=(3+(int)((parent>>15)%4))*(((parent>>13)%2)==0?1:-1);
    float step=Structured?(y<eventY?0:y<eventY+2?.5f:1):Clamp01((y-eventY)/4);
    depth+=offset*(style==null?1:style.StepScale)*step;
   }
   if(level>=2)
   {
    density=Math.Max(0,Math.Min(1.6f,density));if(Structured)density*=.35f;
    int birth,end,taper;ChildRange(a,child,out birth,out end,out taper);float life=Clamp01((y-birth)/taper)*Clamp01((end-y)/taper);
    if(Structured)life=y>=birth&&y<end?1:0;
    if((child%100)<density*75)depth+=((int)((child>>8)%7)-3)*life*(style==null?1:style.ChildReliefScale)*(Structured?.5f:1);
    // A short cap transition belongs to the same parent/child profile, never a separate hat.
    int capHeight=3+(int)((parent>>24)%6);
    if(Structured){if((parent>>22)%5==0&&a.UpperHeight-y<capHeight)depth+=2;}
    else if((parent>>22)%3==0&&a.UpperHeight-y<capHeight)depth+=(2+(int)((parent>>19)%3))*Clamp01((capHeight-(a.UpperHeight-y))/capHeight);
   }
   depth-=delta;
   // Each parent reaches the actual lower terrace/base through a bounded tapered foot.
   if(a.LowerHeight>doc.BaseHeight&&y-a.LowerHeight<6)depth*=Structured?(y-a.LowerHeight<2?0:y-a.LowerHeight<4?.5f:1):Math.Max(0,(y-a.LowerHeight)/6);
   if(height<16)depth*=Math.Max(.15f,height/16f);
   return Math.Max(0,Math.Min(RockBoundary.Band-1,depth));
  }
  internal List<TerrainSolidSurface.Span> Solid(BoundaryAnchor a,float distance,int rawTop)
  {return Solid(a,distance,rawTop,false);}
  internal List<TerrainSolidSurface.Span> ShapedSolid(BoundaryAnchor a,float distance,int rawTop)
  {return Solid(a,distance,rawTop,true);}
  float ShapeOffset(BoundaryAnchor a,float y,bool ignorePatches=false)
  {
   if(y<a.LowerHeight||y>=a.UpperHeight)return 0;
   List<SculptOverride> list;if(!edits.TryGetValue(a.Key,out list))return 0;float delta=0;
   foreach(var edit in list)if(edit.Kind==SculptKind.Shape&&y>=edit.MinHeight&&y<edit.MaxHeight){float weight=1;
    if(edit.LocalMask==SculptLocalMask.StructurePatch){BoundaryAnchor patch;if(!ignorePatches&&patches[edit].TryGetValue(a.Key,out patch)&&y>=patch.PatchMinHeight&&y<patch.PatchMaxHeight)delta+=edit.Value/TerrainUnits.Unit;continue;}
    if(edit.ShapeProfileVersion==1){
     // Keep the existing column's shoulder height and broad planes. Only short
     // boundary bevels are shared; no common full-band parabolic bag is added.
     if(edit.Influence==SculptInfluence.HeightRange){float edge=Math.Max(1,Math.Min(4,(edit.ShapeFalloffMaxHeight-edit.ShapeFalloffMinHeight)/4f));weight=Clamp01((y-edit.ShapeFalloffMinHeight)/edge)*Clamp01((edit.ShapeFalloffMaxHeight-y)/edge);}
     int seed=Seed(a,(int)Math.Floor(y));uint parent=RockBoundary.GroupHash(a.GroupId,seed);
     if(level>=1&&a.UpperHeight-a.LowerHeight>=20&&EventEnabled(parent))weight*=.75f+.25f*Clamp01((y-EventHeight(a,seed))/4);
    }else if(edit.Influence==SculptInfluence.HeightRange){float t=Clamp01((y-edit.ShapeFalloffMinHeight)/(edit.ShapeFalloffMaxHeight-edit.ShapeFalloffMinHeight));weight=4*t*(1-t);}
    if(edit.Influence==SculptInfluence.LocalSurface)weight*=TerrainSculptEdits.LocalWeight(a,y,edit.LocalX,edit.LocalY,edit.LocalZ,edit.LocalRadius);delta+=edit.Value/TerrainUnits.Unit*weight;}
   return Math.Max(-16,Math.Min(16,delta));
  }
  double ShapedThreshold(BoundaryAnchor a,float y)
  {
   float depth=Depth(a,y),hard=0;bool hasPatch=false;List<SculptOverride> list;
   if(patches.Count>0&&edits.TryGetValue(a.Key,out list))foreach(var edit in list)if(edit.Kind==SculptKind.Shape&&edit.LocalMask==SculptLocalMask.StructurePatch&&y>=edit.MinHeight&&y<edit.MaxHeight&&y>=a.LowerHeight&&y<a.UpperHeight){BoundaryAnchor patch;if(patches[edit].TryGetValue(a.Key,out patch)&&y>=patch.PatchMinHeight&&y<patch.PatchMaxHeight){hard+=edit.Value/TerrainUnits.Unit;hasPatch=true;}}
   if(!hasPatch)return Math.Round(depth-ShapeOffset(a,y),MidpointRounding.AwayFromZero);
   // Round the requested displacement once. Rounding a shifted signed depth
   // would add an extra unit when an old half-unit depth crosses zero.
   double original=Math.Round(depth,MidpointRounding.AwayFromZero),legacy=Math.Round(depth-ShapeOffset(a,y,true),MidpointRounding.AwayFromZero);
   return Math.Max(original-16,Math.Min(original+16,legacy-Math.Round(hard,MidpointRounding.AwayFromZero)));
  }
  int[] Knots(BoundaryAnchor a,int rawTop,bool shape)
  {
   var key=new PreparedKey{Key=a.Key,Group=a.GroupId,Child=a.ChildId,Lower=a.LowerHeight,Upper=a.UpperHeight,Top=rawTop,Shape=shape};int[] prepared;if(preparedKnots.TryGetValue(key,out prepared))return prepared;
   var knots=new SortedSet<int>{doc.BaseHeight,a.LowerHeight,a.LowerHeight+3,a.LowerHeight+6,a.UpperHeight-6,a.UpperHeight};
   // Fine sampling is confined to short semantic transition bands, never the entire cliff height.
   Action<int> addGenes=seed=>{int eventY=EventHeight(a,seed);for(int n=0;n<=4;n++)knots.Add(eventY+n);uint parent=RockBoundary.GroupHash(a.GroupId,seed);int cap=3+(int)((parent>>24)%6);for(int n=0;n<=cap;n++)knots.Add(a.UpperHeight-n);uint child=RockBoundary.GroupHash(a.ChildId,seed);int birth,end,taper;ChildRange(a,child,out birth,out end,out taper);for(int n=0;n<=taper;n++){knots.Add(birth+n);knots.Add(end-n);}for(int n=0;n<=6;n++)knots.Add(a.LowerHeight+n);};
   var seedCuts=SeedSegments(a);for(int i=0;i<seedCuts.Length-1;i++){knots.Add(seedCuts[i]);addGenes(Seed(a,seedCuts[i]));}knots.Add(a.UpperHeight);
   List<SculptOverride> list;if(edits.TryGetValue(a.Key,out list))foreach(var e in list){knots.Add(e.MinHeight+(e.MaxHeight-e.MinHeight)/2);for(int n=0;n<=4;n++){knots.Add(e.MinHeight+n);knots.Add(e.MaxHeight-n);}if(e.Influence==SculptInfluence.LocalSurface||shape&&e.Kind==SculptKind.Shape&&e.Influence==SculptInfluence.HeightRange)for(int y=Math.Max(doc.BaseHeight,e.MinHeight);y<=Math.Min(rawTop,e.MaxHeight);y++)knots.Add(y);}
   prepared=knots.Where(y=>y>=doc.BaseHeight&&y<=rawTop).ToArray();preparedKnots.Add(key,prepared);return prepared;
  }
  List<TerrainSolidSurface.Span> Solid(BoundaryAnchor a,float distance,int rawTop,bool shape)
  {
   var yy=Knots(a,rawTop,shape);var spans=new List<TerrainSolidSurface.Span>();
   Func<int,bool> occupied=y=>distance>=(shape?ShapedThreshold(a,y+.5f):Math.Round(Depth(a,y+.5f),MidpointRounding.AwayFromZero));
   Action<int,int> append=(lo,hi)=>{if(hi<=lo)return;if(spans.Count>0&&spans[spans.Count-1].Max==lo){var p=spans[spans.Count-1];p.Max=hi;spans[spans.Count-1]=p;}else spans.Add(new TerrainSolidSurface.Span(lo,hi));};
   for(int i=0;i<yy.Length-1;i++)
   {
    int lo=yy[i],hi=yy[i+1];if(hi<=lo)continue;bool begin=occupied(lo),end=occupied(hi-1);
    if(begin==end){if(begin)append(lo,hi);continue;}
    int left=lo,right=hi-1;while(left+1<right){int mid=(left+right)/2;if(occupied(mid)==begin)left=mid;else right=mid;}
    if(begin)append(lo,right);else append(right,hi);
   }
   return spans;
  }
 }
}
