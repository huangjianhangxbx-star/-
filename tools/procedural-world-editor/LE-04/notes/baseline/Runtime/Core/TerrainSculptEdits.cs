using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
namespace XingHai.LE01.Core
{
 public static class TerrainSculptEdits
 {
  const int Limit=4096;
  static bool Finite(float v){return !float.IsNaN(v)&&!float.IsInfinity(v);}
  static bool Overlap(int a,int b,int c,int d){return a<d&&c<b;}
  static bool Named(string value){return !string.IsNullOrEmpty(value)&&value.Length<=512&&!value.Any(char.IsControl);}
  static bool LocalValid(SculptInfluence influence,float x,float y,float z,float radius){return influence!=SculptInfluence.LocalSurface||Finite(x)&&Finite(y)&&Finite(z)&&Finite(radius)&&radius>0&&radius<=8&&Math.Abs(x)<=256&&Math.Abs(z)<=256&&Math.Abs(y)<=512;}
  static bool MaskValid(SculptLocalMask mask,SculptInfluence influence,List<BoundaryAnchor> anchors,float x,float y,float z,float radius)
  {
   if(!Enum.IsDefined(typeof(SculptLocalMask),mask))return false;if(mask==SculptLocalMask.Circle)return true;
   int lo=(int)Math.Floor((y-radius)/TerrainUnits.Unit),hi=(int)Math.Ceiling((y+radius)/TerrainUnits.Unit);
   return influence==SculptInfluence.LocalSurface&&anchors!=null&&anchors.All(a=>a!=null&&a.PatchMinHeight<a.PatchMaxHeight&&a.PatchMinHeight>=lo&&a.PatchMaxHeight<=hi&&Math.Abs((long)a.PatchMinHeight)<=8192&&Math.Abs((long)a.PatchMaxHeight)<=8192&&Math.Abs((a.Axis==0?a.Z+.5f:a.X+.5f)*TerrainUnits.Unit-(a.Axis==0?z:x))<=radius+.00001f);
  }
  // The hit may lie on an already shifted shell. Surface scope is measured in the
  // original anchor's tangent/height plane, so normal displacement never loses it.
  public static float LocalWeight(BoundaryAnchor a,float heightUnits,float x,float y,float z,float radius)
  {
   if(a==null||radius<=0)return 0;float t=(a.Axis==0?a.Z+.5f:a.X+.5f)*TerrainUnits.Unit-(a.Axis==0?z:x),dy=heightUnits*TerrainUnits.Unit-y;float square=(t*t+dy*dy)/(radius*radius);if(square>=1)return 0;float w=1-square;return w*w;
  }
  static void LocalRange(SculptSelection s,BoundaryAnchor a,out int lo,out int hi)
  {
   lo=s.MinHeight;hi=s.MaxHeight;if(s.Influence!=SculptInfluence.LocalSurface)return;
   if(s.LocalMask==SculptLocalMask.StructurePatch){foreach(var selected in s.Anchors)if(selected.Key==a.Key){lo=Math.Max(lo,selected.PatchMinHeight);hi=Math.Min(hi,selected.PatchMaxHeight);return;}hi=lo;return;}
   float tangent=(a.Axis==0?a.Z+.5f:a.X+.5f)*TerrainUnits.Unit-(a.Axis==0?s.LocalZ:s.LocalX);double square=(double)s.LocalRadius*s.LocalRadius-tangent*tangent;
   if(square<=0){hi=lo;return;}double half=Math.Sqrt(square)/TerrainUnits.Unit,center=s.LocalY/TerrainUnits.Unit;
   lo=Math.Max(lo,(int)Math.Ceiling(center-half-.5));hi=Math.Min(hi,(int)Math.Ceiling(center+half-.5));
  }
  static bool AnchorValid(BoundaryAnchor a){return a!=null&&(a.Axis==0||a.Axis==1)&&(a.Sign==-1||a.Sign==1)&&Math.Abs((long)a.X)<=4096&&Math.Abs((long)a.Z)<=4096&&Named(a.GroupId)&&a.LowerHeight<a.UpperHeight;}
  static bool ScopeValid(Bounds2 b,int lo,int hi,List<BoundaryAnchor> anchors){return !b.Empty&&lo<hi&&Math.Abs((long)lo)<=8192&&Math.Abs((long)hi)<=8192&&anchors!=null&&anchors.Count>0&&anchors.Count<=32768&&anchors.All(a=>AnchorValid(a)&&b.Contains(a.X,a.Z))&&anchors.Select(a=>a.Key).Distinct().Count()==anchors.Count;}
  static BoundaryAnchor Current(TerrainDocument d,CellIndex cells,BoundaryAnchor a)
  {
   int ox=a.X-(a.Axis==0&&a.Sign>0?1:0),oz=a.Z-(a.Axis==1&&a.Sign>0?1:0);
   int nx=ox+(a.Axis==0?a.Sign:0),nz=oz+(a.Axis==1?a.Sign:0);var own=cells.At(ox,oz);if(own==null)return null;
   var other=cells.At(nx,nz);int lower=other==null?d.BaseHeight:other.Top;if(lower>=own.Top)return null;
   var now=a.Copy();now.LowerHeight=lower;now.UpperHeight=own.Top;now.GroupId=RockBoundary.Group(d,a.X,a.Z);
   return now.GroupId==a.GroupId?now:null;
  }
  static HashSet<string> Keys(IEnumerable<BoundaryAnchor> anchors){return new HashSet<string>(anchors.Select(a=>a.Key),StringComparer.Ordinal);}
  static bool Touch(ShapeLock l,SculptSelection s){if(!l.Enabled||!Overlap(l.MinHeight,l.MaxHeight,s.MinHeight,s.MaxHeight))return false;var keys=Keys(s.Anchors);return l.Anchors.Any(a=>{if(!keys.Contains(a.Key))return false;int lo,hi;LocalRange(s,a,out lo,out hi);return Overlap(l.MinHeight,l.MaxHeight,lo,hi);});}
  static void Reject(TerrainResult result,TerrainDocument source,string message,int conflicts=0){result.Rejected=true;result.Changed=false;result.Document=source==null?new TerrainDocument():source.Copy();result.Message=message;result.ConflictCount=conflicts;}
  static void CountOrphans(TerrainResult r){r.OrphanCount=r.Document.SculptOverrides==null?0:r.Document.SculptOverrides.Count(e=>e.Status==SculptStatus.Orphaned);}
  public static bool ValidateExtensions(TerrainDocument d,out string error)
  {
   error="";if(d==null){error="Missing terrain document.";return false;}
   if(!TerrainGenerators.IsRockDocument(d)){
    if(d.SculptOverrides!=null&&d.SculptOverrides.Count>0||d.ShapeLocks!=null&&d.ShapeLocks.Count>0){error="Sculpt records require explicit le01.2 upgrade.";return false;}return true;
   }
   bool v3=d.GeneratorVersion=="le01.3";
   if(d.SculptSchemaVersion!=(v3?2:1)||d.SculptOverrides==null||d.ShapeLocks==null||d.SculptOverrides.Count>Limit||d.ShapeLocks.Count>Limit){error="Unsupported or malformed sculpt extension.";return false;}
   var ids=new HashSet<string>(StringComparer.Ordinal);
   foreach(var o in d.SculptOverrides){
    if(o==null||(o.Kind==SculptKind.Shape?o.Version!=2&&o.Version!=3:o.Version!=1)||o.Kind==SculptKind.Shape&&!v3||!Named(o.EditId)||!ids.Add(o.EditId)||o.DocumentId!=d.Id||o.GeneratorVersion!=d.GeneratorVersion||!ScopeValid(o.Bounds,o.MinHeight,o.MaxHeight,o.Anchors)||o.GroupIds==null||o.GroupIds.Count==0||o.GroupIds.Any(g=>!Named(g))||!Enum.IsDefined(typeof(SculptKind),o.Kind)||!Enum.IsDefined(typeof(SculptInfluence),o.Influence)||!Enum.IsDefined(typeof(SculptStatus),o.Status)||!Finite(o.Value)||Math.Abs(o.Value)>(o.Kind==SculptKind.Depth?.5f:1f)||o.Anchors.Any(a=>!o.GroupIds.Contains(a.GroupId))){error="Invalid sculpt record or future record version.";return false;}
    if(o.Kind==SculptKind.Shape&&(o.Anchors.Count>4096||o.MaxHeight-o.MinHeight>2048||o.ShapeFalloffMinHeight>o.MinHeight||o.ShapeFalloffMaxHeight<o.MaxHeight||o.ShapeFalloffMinHeight>=o.ShapeFalloffMaxHeight||Math.Abs((long)o.ShapeFalloffMinHeight)>8192||Math.Abs((long)o.ShapeFalloffMaxHeight)>8192)){error="Wall shape exceeds its bounded work area or falloff domain.";return false;}
    if(!LocalValid(o.Influence,o.LocalX,o.LocalY,o.LocalZ,o.LocalRadius)||!MaskValid(o.LocalMask,o.Influence,o.Anchors,o.LocalX,o.LocalY,o.LocalZ,o.LocalRadius)||o.ShapeProfileVersion<0||o.ShapeProfileVersion>1||o.ShapeProfileVersion!=0&&o.Kind!=SculptKind.Shape||o.Version==3&&o.ShapeProfileVersion!=1||o.LocalMask==SculptLocalMask.StructurePatch&&(!v3||o.Kind!=SculptKind.Shape||o.ShapeProfileVersion!=1||o.Version!=3)){error="Invalid local surface scope or shape profile version.";return false;}
   }
   ids.Clear();foreach(var l in d.ShapeLocks){
    if(l==null||l.Version!=1||!Named(l.Id)||!ids.Add(l.Id)||!ScopeValid(l.Bounds,l.MinHeight,l.MaxHeight,l.Anchors)||l.Pins==null||l.Pins.Count!=l.Anchors.Count||l.Pins.Any(p=>p==null||!Named(p.GroupId)||!Named(p.BoundaryKey))||l.Pins.Select(p=>p.BoundaryKey).Distinct().Count()!=l.Pins.Count||l.Anchors.Any(a=>!l.Pins.Any(p=>p.BoundaryKey==a.Key&&p.GroupId==a.GroupId))){error="Invalid shape lock or pinned profile.";return false;}
   }return true;
  }
  public static TerrainResult Apply(TerrainDocument source,TerrainCommand c)
  {
   var result=new TerrainResult{Document=source==null?new TerrainDocument():source.Copy()};string error;
   if(!TerrainGenerators.IsRockDocument(source)||!TerrainKernel.Validate(source,out error)){Reject(result,source,"A valid rock-generator document is required.");return result;}
   if(c==null||(c.Mode<BrushMode.SculptDepth||c.Mode>BrushMode.RestoreOrphan)&&c.Mode!=BrushMode.SculptShape){Reject(result,source,"Unsupported sculpt command.");return result;}
   if(c.Mode==BrushMode.SculptShape&&source.GeneratorVersion!="le01.3"){Reject(result,source,"True wall shape requires an explicit le01.3 candidate.");return result;}
   var s=c.Selection;
   if(s==null||!s.Valid||s.DocumentId!=source.Id||s.SourceRevision!=source.Revision||!ScopeValid(s.Bounds,s.MinHeight,s.MaxHeight,s.Anchors)||s.GroupIds==null||s.GroupIds.Count==0||!Enum.IsDefined(typeof(SculptInfluence),s.Influence)||!LocalValid(s.Influence,s.LocalX,s.LocalY,s.LocalZ,s.LocalRadius)||!MaskValid(s.LocalMask,s.Influence,s.Anchors,s.LocalX,s.LocalY,s.LocalZ,s.LocalRadius)||s.LocalMask==SculptLocalMask.StructurePatch&&(source.GeneratorVersion!="le01.3"||c.Mode==BrushMode.SculptDepth||c.Mode==BrushMode.SculptDensity)){Reject(result,source,"The frozen wall selection is stale or invalid.");return result;}
   result.Selection=s.Copy();result.DirtyBounds=s.Bounds;var cells=new CellIndex(source.Cells);
   if(s.Anchors.Any(a=>Current(source,cells,a)==null||!s.GroupIds.Contains(a.GroupId)||!Overlap(a.LowerHeight,a.UpperHeight,s.MinHeight,s.MaxHeight))){Reject(result,source,"The selected wall no longer matches its author anchors.");return result;}
   var doc=result.Document;int blocked=doc.ShapeLocks.Count(l=>Touch(l,s));
   if(c.Mode==BrushMode.SculptShape)blocked=Math.Max(blocked,doc.ShapeLocks.Count(l=>l.Enabled&&Overlap(l.MinHeight,l.MaxHeight,s.MinHeight,s.MaxHeight)&&l.Bounds.Intersects(s.Bounds.Expand(16))));
   // Removing or reactivating a signed shape shell can also change a nearby wall.
   // Exact anchor-key locks alone do not protect that neighboring physical volume.
   if(source.GeneratorVersion=="le01.3"&&(c.Mode==BrushMode.RestoreShape||c.Mode==BrushMode.RestoreOrphan)){
    bool restoresShape=false;Bounds2 impact=s.Bounds.Expand(16);int impactMin=s.MinHeight,impactMax=s.MaxHeight;
    if(c.Mode==BrushMode.RestoreShape){var selected=Keys(s.Anchors);restoresShape=doc.SculptOverrides.Any(o=>o.Kind==SculptKind.Shape&&o.Enabled&&o.Status==SculptStatus.Active&&Overlap(o.MinHeight,o.MaxHeight,s.MinHeight,s.MaxHeight)&&o.Anchors.Any(a=>selected.Contains(a.Key)));}
    else {var old=doc.SculptOverrides.FirstOrDefault(o=>o.EditId==c.EditId&&o.Status==SculptStatus.Orphaned&&o.Kind==SculptKind.Shape&&o.Enabled);if(old!=null){restoresShape=true;impact=Union(impact,old.Bounds.Expand(16));impactMin=Math.Min(impactMin,old.MinHeight);impactMax=Math.Max(impactMax,old.MaxHeight);if(old.Influence==SculptInfluence.LinkedColumn)foreach(var anchor in old.Anchors){var current=Current(doc,cells,anchor);if(current!=null){impactMin=Math.Min(impactMin,current.LowerHeight);impactMax=Math.Max(impactMax,current.UpperHeight);}}}}
    if(restoresShape){blocked=Math.Max(blocked,doc.ShapeLocks.Count(l=>l.Enabled&&Overlap(l.MinHeight,l.MaxHeight,impactMin,impactMax)&&l.Bounds.Intersects(impact)));result.DirtyBounds=impact;}
   }
   if(blocked>0&&(c.Mode==BrushMode.SculptDepth||c.Mode==BrushMode.SculptDensity||c.Mode==BrushMode.SculptShape||c.Mode==BrushMode.RestoreShape||c.Mode==BrushMode.RestoreOrphan)){Reject(result,source,"The selected shape is locked; unlock it before editing or restoring.",blocked);return result;}
   string before=ExtensionHash(doc);string id=Named(c.EditId)?c.EditId:"edit-"+(source.Revision+1).ToString(CultureInfo.InvariantCulture);
   if(c.Mode==BrushMode.SculptDepth||c.Mode==BrushMode.SculptDensity||c.Mode==BrushMode.SculptShape){
    float maximum=c.Mode==BrushMode.SculptDepth?.5f:1f;if(!Finite(c.Strength)||Math.Abs(c.Strength)>maximum){Reject(result,source,"Strength exceeds the explicit sculpt range.");return result;}
    doc.SculptOverrides.RemoveAll(o=>o.EditId==id);
    if(c.Strength!=0)doc.SculptOverrides.Add(new SculptOverride{Version=c.Mode==BrushMode.SculptShape?(doc.RockRuleVersion==1||s.LocalMask==SculptLocalMask.StructurePatch?3:2):1,EditId=id,DocumentId=doc.Id,GeneratorVersion=doc.GeneratorVersion,Bounds=s.Bounds,MinHeight=s.MinHeight,MaxHeight=s.MaxHeight,ShapeFalloffMinHeight=c.Mode==BrushMode.SculptShape?s.MinHeight:0,ShapeFalloffMaxHeight=c.Mode==BrushMode.SculptShape?s.MaxHeight:0,Influence=s.Influence,LocalMask=s.LocalMask,LocalX=s.Influence==SculptInfluence.LocalSurface?s.LocalX:0,LocalY=s.Influence==SculptInfluence.LocalSurface?s.LocalY:0,LocalZ=s.Influence==SculptInfluence.LocalSurface?s.LocalZ:0,LocalRadius=s.Influence==SculptInfluence.LocalSurface?s.LocalRadius:0,Kind=c.Mode==BrushMode.SculptDepth?SculptKind.Depth:c.Mode==BrushMode.SculptShape?SculptKind.Shape:SculptKind.Density,Value=c.Strength,ShapeProfileVersion=c.Mode==BrushMode.SculptShape&&(doc.RockRuleVersion==1||s.LocalMask==SculptLocalMask.StructurePatch)?1:0,Revision=source.Revision+1,GroupIds=new List<string>(s.GroupIds),Anchors=s.Anchors.ConvertAll(a=>a.Copy())});
    if(c.Mode==BrushMode.SculptShape){result.DirtyBounds=s.Bounds.Expand(16);result.ConstraintMessage="True wall offset is bounded to one metre; local height shaping tapers to zero at its upper and lower limits.";}
    else result.ConstraintMessage=c.Mode==BrushMode.SculptDepth?"Push-out restores carved depth only; the original author envelope and protected top remain limits.":"Only child structure density changes; primary group identity is preserved.";
   }else if(c.Mode==BrushMode.LockShape&&s.Influence==SculptInfluence.LocalSurface){
    doc.ShapeLocks.RemoveAll(l=>l.Id==id||l.Id.StartsWith(id+":local:",StringComparison.Ordinal));int number=0;
    foreach(var group in s.Anchors.GroupBy(a=>{int lo,hi;LocalRange(s,a,out lo,out hi);return new{lo,hi};}).OrderBy(g=>g.Key.lo).ThenBy(g=>g.Key.hi)){
     int lo=group.Key.lo,hi=group.Key.hi;if(hi<=lo)continue;var anchors=group.Select(a=>a.Copy()).ToList();
     // Preserve existing pin changes if a local disk crosses an older lock band.
     var cuts=new SortedSet<int>{lo,hi};foreach(var l in source.ShapeLocks)if(l.Enabled&&l.Anchors.Any(a=>anchors.Any(b=>b.Key==a.Key))){if(l.MinHeight>lo&&l.MinHeight<hi)cuts.Add(l.MinHeight);if(l.MaxHeight>lo&&l.MaxHeight<hi)cuts.Add(l.MaxHeight);}var yy=cuts.ToArray();
     for(int j=0;j<yy.Length-1;j++)doc.ShapeLocks.Add(new ShapeLock{Id=id+":local:"+(number++).ToString(CultureInfo.InvariantCulture),Bounds=s.Bounds,MinHeight=yy[j],MaxHeight=yy[j+1],Anchors=anchors.ConvertAll(a=>a.Copy()),Pins=anchors.Select(a=>new PinnedShape{GroupId=a.GroupId,BoundaryKey=a.Key,Seed=SeedFor(source,a,yy[j])}).ToList()});
    }
   }else if(c.Mode==BrushMode.LockShape){
    // Split only at existing lock height boundaries so each new pin captures the actual seed there.
    var selected=Keys(s.Anchors);var levels=new SortedSet<int>{s.MinHeight,s.MaxHeight};
    foreach(var l in source.ShapeLocks)if(l.Enabled&&l.Anchors.Any(a=>selected.Contains(a.Key))){if(l.MinHeight>s.MinHeight&&l.MinHeight<s.MaxHeight)levels.Add(l.MinHeight);if(l.MaxHeight>s.MinHeight&&l.MaxHeight<s.MaxHeight)levels.Add(l.MaxHeight);}
    doc.ShapeLocks.RemoveAll(l=>l.Id==id||l.Id.StartsWith(id+":height:",StringComparison.Ordinal));var heights=levels.ToArray();
    for(int i=0;i<heights.Length-1;i++){
     int lo=heights[i],hi=heights[i+1];var anchors=s.Anchors.Where(a=>Overlap(a.LowerHeight,a.UpperHeight,lo,hi)).Select(a=>a.Copy()).ToList();if(anchors.Count==0)continue;
     doc.ShapeLocks.Add(new ShapeLock{Id=heights.Length==2?id:id+":height:"+lo.ToString(CultureInfo.InvariantCulture),Bounds=s.Bounds,MinHeight=lo,MaxHeight=hi,Anchors=anchors,Pins=anchors.Select(a=>new PinnedShape{GroupId=a.GroupId,BoundaryKey=a.Key,Seed=SeedFor(source,a,Math.Max(lo,a.LowerHeight))}).ToList()});
    }
   }else if(c.Mode==BrushMode.UnlockShape){
    var kept=new List<ShapeLock>();foreach(var l in doc.ShapeLocks){if(!Touch(l,s)){kept.Add(l);continue;}SplitLock(l,s,kept);}doc.ShapeLocks=kept;
   }else if(c.Mode==BrushMode.RestoreShape){
    var kept=new List<SculptOverride>();foreach(var o in doc.SculptOverrides)SplitOverride(o,s,kept);doc.SculptOverrides=kept;
   }else {
    var old=doc.SculptOverrides.FirstOrDefault(o=>o.EditId==c.EditId&&o.Status==SculptStatus.Orphaned);
    if(old==null){Reject(result,source,"Select an orphan record by its exact edit ID.");return result;}
    var refreshed=old.Anchors.Select(a=>Current(doc,cells,a)).ToList();
    if(refreshed.Any(a=>a==null)){Reject(result,source,"The exact original wall anchors have not been restored; no nearby rebinding is allowed.");return result;}
    old.Anchors=refreshed;old.Status=SculptStatus.Active;old.Revision=source.Revision+1;RefreshLinked(old);result.DirtyBounds=Union(result.DirtyBounds,old.Bounds);
   }
   if(!ValidateExtensions(doc,out error)){Reject(result,source,error);return result;}result.Changed=before!=ExtensionHash(doc);CountOrphans(result);result.Message=result.Changed?"Sculpt intent preview ready":"No change";return result;
  }
  static void SplitOverride(SculptOverride o,SculptSelection s,List<SculptOverride> kept)
  {
   if(s.Influence==SculptInfluence.LocalSurface){SplitLocalOverride(o,s,kept);return;}
   var selected=Keys(s.Anchors);if(!Overlap(o.MinHeight,o.MaxHeight,s.MinHeight,s.MaxHeight)||!o.Anchors.Any(a=>selected.Contains(a.Key))){kept.Add(o);return;}
   var outside=o.Anchors.Where(a=>!selected.Contains(a.Key)).ToList();var inside=o.Anchors.Where(a=>selected.Contains(a.Key)).ToList();
   Action<List<BoundaryAnchor>,int,int,string> add=(anchors,lo,hi,suffix)=>{if(anchors.Count==0||hi<=lo)return;var p=o.Copy();p.EditId=o.EditId+suffix;p.Anchors=anchors.ConvertAll(a=>a.Copy());p.GroupIds=p.Anchors.Select(a=>a.GroupId).Distinct().ToList();p.MinHeight=lo;p.MaxHeight=hi;kept.Add(p);};
   add(outside,o.MinHeight,o.MaxHeight,":outside");add(inside,o.MinHeight,Math.Min(o.MaxHeight,s.MinHeight),":below");add(inside,Math.Max(o.MinHeight,s.MaxHeight),o.MaxHeight,":above");
  }
  static void SplitLock(ShapeLock l,SculptSelection s,List<ShapeLock> kept)
  {
   if(s.Influence==SculptInfluence.LocalSurface){SplitLocalLock(l,s,kept);return;}
   var selected=Keys(s.Anchors);var outside=l.Anchors.Where(a=>!selected.Contains(a.Key)).ToList();var inside=l.Anchors.Where(a=>selected.Contains(a.Key)).ToList();
   Action<List<BoundaryAnchor>,int,int,string> add=(anchors,lo,hi,suffix)=>{if(anchors.Count==0||hi<=lo)return;var p=l.Copy();p.Id=l.Id+suffix;p.Anchors=anchors.ConvertAll(a=>a.Copy());var keys=Keys(anchors);p.Pins=p.Pins.Where(v=>keys.Contains(v.BoundaryKey)).ToList();p.MinHeight=lo;p.MaxHeight=hi;kept.Add(p);};
   add(outside,l.MinHeight,l.MaxHeight,":outside");add(inside,l.MinHeight,Math.Min(l.MaxHeight,s.MinHeight),":below");add(inside,Math.Max(l.MinHeight,s.MaxHeight),l.MaxHeight,":above");
  }
  static List<Tuple<List<BoundaryAnchor>,int,int>> LocalRemainder(IEnumerable<BoundaryAnchor> anchors,int min,int max,SculptSelection s)
  {
   var selected=Keys(s.Anchors);var buckets=new Dictionary<Tuple<int,int>,List<BoundaryAnchor>>();
   Action<BoundaryAnchor,int,int> add=(a,lo,hi)=>{if(hi<=lo)return;var key=Tuple.Create(lo,hi);List<BoundaryAnchor> list;if(!buckets.TryGetValue(key,out list))buckets[key]=list=new List<BoundaryAnchor>();list.Add(a.Copy());};
   foreach(var a in anchors){int lo,hi;LocalRange(s,a,out lo,out hi);if(!selected.Contains(a.Key)||!Overlap(min,max,lo,hi)){add(a,min,max);continue;}add(a,min,Math.Min(max,lo));add(a,Math.Max(min,hi),max);}
   return buckets.OrderBy(b=>b.Key.Item1).ThenBy(b=>b.Key.Item2).Select(b=>Tuple.Create(b.Value,b.Key.Item1,b.Key.Item2)).ToList();
  }
  static void SplitLocalOverride(SculptOverride o,SculptSelection s,List<SculptOverride> kept)
  {
   var parts=LocalRemainder(o.Anchors,o.MinHeight,o.MaxHeight,s);if(parts.Count==1&&parts[0].Item1.Count==o.Anchors.Count&&parts[0].Item2==o.MinHeight&&parts[0].Item3==o.MaxHeight){kept.Add(o);return;}
   int i=0;foreach(var part in parts){var p=o.Copy();p.EditId=o.EditId+":local:"+(i++).ToString(CultureInfo.InvariantCulture);p.Anchors=part.Item1;p.GroupIds=p.Anchors.Select(a=>a.GroupId).Distinct().ToList();p.MinHeight=part.Item2;p.MaxHeight=part.Item3;kept.Add(p);}
  }
  static void SplitLocalLock(ShapeLock l,SculptSelection s,List<ShapeLock> kept)
  {
   var parts=LocalRemainder(l.Anchors,l.MinHeight,l.MaxHeight,s);int i=0;foreach(var part in parts){var p=l.Copy();p.Id=l.Id+":local:"+(i++).ToString(CultureInfo.InvariantCulture);p.Anchors=part.Item1;var keys=Keys(p.Anchors);p.Pins=p.Pins.Where(pin=>keys.Contains(pin.BoundaryKey)).ToList();p.MinHeight=part.Item2;p.MaxHeight=part.Item3;kept.Add(p);}
  }
  static Bounds2 Union(Bounds2 a,Bounds2 b){return new Bounds2(Math.Min(a.MinX,b.MinX),Math.Min(a.MinZ,b.MinZ),Math.Max(a.MaxX,b.MaxX),Math.Max(a.MaxZ,b.MaxZ));}
  static void RefreshLinked(SculptOverride o)
  {
   if(o.Influence!=SculptInfluence.LinkedColumn)return;
   // A restored height slice must remain removed after a later compatible author edit.
   if(o.Kind==SculptKind.Shape&&(o.MinHeight!=o.ShapeFalloffMinHeight||o.MaxHeight!=o.ShapeFalloffMaxHeight))return;
   o.MinHeight=o.Anchors.Min(a=>a.LowerHeight);o.MaxHeight=o.Anchors.Max(a=>a.UpperHeight);
   if(o.Kind==SculptKind.Shape){o.ShapeFalloffMinHeight=o.MinHeight;o.ShapeFalloffMaxHeight=o.MaxHeight;}
  }
  public static void CheckAuthorEdit(TerrainDocument source,TerrainResult result,TerrainCommand command)
  {
   if(!TerrainGenerators.IsRockDocument(source)||result.Rejected||!result.Changed)return;
   if(command.Mode==BrushMode.Reshape){CountOrphans(result);return;}
   var doc=result.Document;var cells=new CellIndex(doc.Cells);int conflicts=0;
   foreach(var l in source.ShapeLocks)if(l.Enabled&&l.Anchors.Any(a=>{var now=Current(doc,cells,a);return now==null||now.LowerHeight!=a.LowerHeight||now.UpperHeight!=a.UpperHeight;}))conflicts++;
   if(conflicts>0){Reject(result,source,"Author edit conflicts with a protected wall; unlock it explicitly first.",conflicts);return;}
   foreach(var o in doc.SculptOverrides)if(o.Status==SculptStatus.Active){
    var current=o.Anchors.Select(a=>Current(doc,cells,a)).ToList();
    if(current.Any(a=>a==null||!Overlap(a.LowerHeight,a.UpperHeight,o.MinHeight,o.MaxHeight))){o.Status=SculptStatus.Orphaned;result.ConstraintMessage="Some manual records are orphaned. Undo the author edit, remove them, or explicitly restore their exact original anchors.";}
    else{o.Anchors=current;RefreshLinked(o);}
   }CountOrphans(result);
  }
  public static int SeedFor(TerrainDocument doc,BoundaryAnchor a,int heightUnits)
  {
   int seed=doc.Seed;foreach(var p in doc.SeedPatches)if(p.Bounds.Contains(a.X,a.Z))seed=p.Seed;
   if(doc.ShapeLocks!=null)foreach(var l in doc.ShapeLocks)if(l.Enabled&&heightUnits>=l.MinHeight&&heightUnits<l.MaxHeight)foreach(var pin in l.Pins)if(pin.BoundaryKey==a.Key&&pin.GroupId==a.GroupId)return pin.Seed;return seed;
  }
  static string ExtensionHash(TerrainDocument doc){var b=new StringBuilder();AppendHash(doc,b);return b.ToString();}
  static void Put(StringBuilder b,object value){string s=value is float?((float)value).ToString("R",CultureInfo.InvariantCulture):value is IFormattable?((IFormattable)value).ToString(null,CultureInfo.InvariantCulture):value==null?"":value.ToString();b.Append(s.Length.ToString(CultureInfo.InvariantCulture)).Append(':').Append(s).Append('|');}
  static void PutScope(StringBuilder b,Bounds2 bounds,int lo,int hi,IEnumerable<BoundaryAnchor> anchors){Put(b,bounds.MinX);Put(b,bounds.MinZ);Put(b,bounds.MaxX);Put(b,bounds.MaxZ);Put(b,lo);Put(b,hi);foreach(var a in anchors){Put(b,a.X);Put(b,a.Z);Put(b,a.Axis);Put(b,a.Sign);Put(b,a.LowerHeight);Put(b,a.UpperHeight);Put(b,a.GroupId);Put(b,a.ChildId);if(a.PatchMinHeight!=0||a.PatchMaxHeight!=0){Put(b,"AP");Put(b,a.PatchMinHeight);Put(b,a.PatchMaxHeight);}}}
  public static void AppendHash(TerrainDocument doc,StringBuilder b)
  {
   if(!TerrainGenerators.IsRockDocument(doc))return;Put(b,"SCULPT");Put(b,doc.SculptSchemaVersion);Put(b,doc.StableLayoutSeed);
   foreach(var o in doc.SculptOverrides){Put(b,"O");Put(b,o.Version);Put(b,o.Revision);Put(b,o.EditId);Put(b,o.DocumentId);Put(b,o.GeneratorVersion);Put(b,o.Influence);Put(b,o.Kind);Put(b,o.Value);Put(b,o.Enabled);Put(b,o.Status);if(o.Kind==SculptKind.Shape){Put(b,o.ShapeFalloffMinHeight);Put(b,o.ShapeFalloffMaxHeight);}if(o.LocalMask!=SculptLocalMask.Circle){Put(b,"MASK");Put(b,o.LocalMask);}if(o.ShapeProfileVersion!=0){Put(b,"SP");Put(b,o.ShapeProfileVersion);}if(o.Influence==SculptInfluence.LocalSurface){Put(b,"LOCAL");Put(b,o.LocalX);Put(b,o.LocalY);Put(b,o.LocalZ);Put(b,o.LocalRadius);}foreach(var g in o.GroupIds)Put(b,g);PutScope(b,o.Bounds,o.MinHeight,o.MaxHeight,o.Anchors);}
   foreach(var l in doc.ShapeLocks){Put(b,"L");Put(b,l.Version);Put(b,l.Id);Put(b,l.Enabled);PutScope(b,l.Bounds,l.MinHeight,l.MaxHeight,l.Anchors);foreach(var p in l.Pins){Put(b,p.GroupId);Put(b,p.BoundaryKey);Put(b,p.Seed);}}
  }
 }
}
