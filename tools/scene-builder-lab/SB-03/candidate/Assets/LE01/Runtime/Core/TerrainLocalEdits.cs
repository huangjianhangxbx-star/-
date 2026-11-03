using System;
using System.Collections.Generic;
using System.Linq;
namespace XingHai.LE01.Core
{
 [Serializable] public struct TerrainPoint3
 {public float X,Y,Z;public TerrainPoint3(float x,float y,float z){X=x;Y=y;Z=z;}}
 public enum TerrainEditMode {Extend,Raise,Lower,SmoothRaise,SmoothLower,Thicken,Thin,Erase}
 [Serializable] public sealed class TerrainEditCommand
 {
  public TerrainEditMode Mode;public List<TerrainPoint3> Path=new List<TerrainPoint3>();public TerrainPoint3 Anchor,Normal=new TerrainPoint3(0,1,0);
  public Bounds2 Bounds;public int YMin=-4096,YMax=4096,Amount=4,Quantum=4,ExpectedRevision=-1;
  public float Radius=1.5f,Falloff;
 }
 public static class TerrainLocalEdits
 {
  public static TerrainEditResult Apply(TerrainEditSnapshot source,TerrainEditCommand command)
  {
   try {
    if(source==null||command==null)throw new ArgumentException("Missing terrain or edit command.");
    TerrainEditOperations.ValidateRevision(source,command.ExpectedRevision);
    if(!Enum.IsDefined(typeof(TerrainEditMode),command.Mode)||!TerrainUnits.ValidQuantum(command.Quantum)||command.YMin>=command.YMax||command.YMin< -4096||command.YMax>4096||Math.Abs((long)command.Amount)>4096||!TerrainEditOperations.Finite(command.Radius)||command.Radius<=0||command.Radius>32||!TerrainEditOperations.Finite(command.Falloff)||command.Falloff<0||command.Falloff>1)throw new ArgumentException("Invalid local edit settings.");
    if(!TerrainEditOperations.Finite(command.Anchor.X)||!TerrainEditOperations.Finite(command.Anchor.Y)||!TerrainEditOperations.Finite(command.Anchor.Z)||!TerrainEditOperations.Finite(command.Normal.X)||!TerrainEditOperations.Finite(command.Normal.Y)||!TerrainEditOperations.Finite(command.Normal.Z))throw new ArgumentException("Invalid anchor or surface normal.");
    float edgeFalloff=(command.Mode==TerrainEditMode.SmoothRaise||command.Mode==TerrainEditMode.SmoothLower)&&command.Falloff==0?.75f:command.Falloff;
    var points=command.Path==null||command.Path.Count==0?new List<TerrainPoint3>{command.Anchor}:TerrainEditOperations.CanonicalPath(command.Path);
    var bounds=command.Bounds.Empty?TerrainEditOperations.PathBounds(points,command.Radius):command.Bounds;
    TerrainEditOperations.ValidateBounds(bounds);
    if((long)(bounds.MaxX-bounds.MinX)*(bounds.MaxZ-bounds.MinZ)>65536)throw new ArgumentException("Local edit exceeds 65536 active fine columns; reduce its range.");
    int amount=Math.Abs(command.Amount);if(amount==0)return new TerrainEditResult{Snapshot=source};
    var changes=new Dictionary<TerrainColumnKey,List<TerrainVolumeSpan>>();
    bool rectangular=!command.Bounds.Empty;
    for(int z=bounds.MinZ;z<bounds.MaxZ;z++)for(int x=bounds.MinX;x<bounds.MaxX;x++) {
     float falloff=rectangular?RectangleWeight(x,z,bounds,edgeFalloff):PathWeight(x,z,points,command.Radius,edgeFalloff);
     if(falloff<=0)continue;
     int delta=Math.Max(command.Quantum,(int)Math.Round(amount*falloff/command.Quantum,MidpointRounding.AwayFromZero)*command.Quantum);
     var old=source.ColumnAt(x,z);var next=new List<TerrainVolumeSpan>(old);
     if(command.Mode==TerrainEditMode.Erase)next=TerrainEditOperations.Subtract(old,command.YMin,command.YMax);
     else if(command.Mode==TerrainEditMode.Thicken||command.Mode==TerrainEditMode.Thin) {
      bool alongX=Math.Abs(command.Normal.X)>=Math.Abs(command.Normal.Z);int sign=(alongX?command.Normal.X:command.Normal.Z)<0?-1:1;
      if(Math.Abs(command.Normal.X)+Math.Abs(command.Normal.Z)<.1f)throw new ArgumentException("Thickness editing requires an actual wall-side normal.");
      if(command.Mode==TerrainEditMode.Thicken) {
       // Dilation follows the actual facing wall intervals, including its existing profile.
       for(int d=1;d<=delta;d++)foreach(var span in source.ColumnAt(x-(alongX?sign*d:0),z-(alongX?0:sign*d))) {
        int lo=Math.Max(span.Min,command.YMin),hi=Math.Min(span.Max,command.YMax);if(lo<hi)next=TerrainEditOperations.Union(next,new TerrainVolumeSpan(lo,hi,span.BaseColorId){TopColorId=span.TopColorId,BottomColorId=span.BottomColorId});
       }
      }else {
       // Keep the intersection with the outward column: exactly an inward shell removal.
       var outward=source.ColumnAt(x+(alongX?sign*delta:0),z+(alongX?0:sign*delta));
       var shell=TerrainEditOperations.Difference(old,outward);
       foreach(var span in shell)next=TerrainEditOperations.Subtract(next,Math.Max(span.Min,command.YMin),Math.Min(span.Max,command.YMax));
      }
     }else if(command.Mode==TerrainEditMode.Extend) {
      int target=Math.Min(command.YMax,Math.Max(command.YMin+1,TerrainUnits.ToUnits(command.Anchor.Y)+delta));
      int bottom=old.Count==0?Math.Max(source.Basis.BaseHeight,command.YMin):Math.Max(command.YMin,old[old.Count-1].Max);
      if(bottom<target)next=TerrainEditOperations.Union(next,new TerrainVolumeSpan(bottom,target));
     }else if(old.Count>0) {
      int selected=-1;for(int i=old.Count-1;i>=0;i--)if(old[i].Max>command.YMin&&old[i].Max<=command.YMax){selected=i;break;}
      if(selected>=0) {
       var s=old[selected];
       if(command.Mode==TerrainEditMode.Raise||command.Mode==TerrainEditMode.SmoothRaise) {
        int top=Math.Min(command.YMax,s.Max+delta);if(top>s.Max)next=TerrainEditOperations.Union(next,new TerrainVolumeSpan(s.Max,top,s.BaseColorId){TopColorId=s.TopColorId,BottomColorId=s.BottomColorId});
       }else {int cut=Math.Max(command.YMin,s.Max-delta);next=TerrainEditOperations.Subtract(next,cut,s.Max);}
      }
     }
     if(!TerrainEditOperations.Same(old,next))changes[new TerrainColumnKey(x,z)]=next;
    }
    return TerrainEditOperations.Commit(source,changes,null,command.Mode==TerrainEditMode.Erase||command.Mode==TerrainEditMode.Lower||command.Mode==TerrainEditMode.SmoothLower||command.Mode==TerrainEditMode.Thin);
   }catch(ArgumentException e){return TerrainEditOperations.Reject(source,e.Message);}
  }
  static float RectangleWeight(int x,int z,Bounds2 b,float falloff)
  {
   if(falloff<=0)return 1;float nx=(x+.5f-(b.MinX+b.MaxX)*.5f)/((b.MaxX-b.MinX)*.5f),nz=(z+.5f-(b.MinZ+b.MaxZ)*.5f)/((b.MaxZ-b.MinZ)*.5f);return Weight(Math.Max(Math.Abs(nx),Math.Abs(nz)),falloff);
  }
  static float PathWeight(int x,int z,List<TerrainPoint3> path,float radius,float falloff)
  {
   double px=(x+.5)*TerrainUnits.Unit,pz=(z+.5)*TerrainUnits.Unit,best=double.MaxValue;
   for(int i=0;i<path.Count;i++) {var a=path[Math.Max(0,i-1)];var b=path[i];double dx=b.X-a.X,dz=b.Z-a.Z,den=dx*dx+dz*dz,t=den==0?0:Math.Max(0,Math.Min(1,((px-a.X)*dx+(pz-a.Z)*dz)/den));double ex=px-a.X-t*dx,ez=pz-a.Z-t*dz;best=Math.Min(best,Math.Sqrt(ex*ex+ez*ez));}
   return Weight((float)(best/radius),falloff);
  }
  static float Weight(float n,float edge){if(n>=1)return 0;if(edge<=0||n<=1-edge)return 1;float t=(1-n)/edge;return t*t*(3-2*t);}
 }
 // Pure interval utilities shared by A edits. Existing lists are never mutated.
 internal static class TerrainEditOperations
 {
  internal static bool Finite(float v){return !float.IsNaN(v)&&!float.IsInfinity(v);}
  internal static TerrainEditResult Reject(TerrainEditSnapshot s,string message){return new TerrainEditResult{Snapshot=s,Rejected=true,Reason=message};}
  internal static void ValidateRevision(TerrainEditSnapshot s,int revision){if(revision>=0&&revision!=s.State.Revision)throw new ArgumentException("The terrain changed after this operation was anchored.");}
  internal static void ValidateBounds(Bounds2 b){if(b.Empty||b.MinX< -4096||b.MinZ< -4096||b.MaxX>4096||b.MaxZ>4096)throw new ArgumentException("Edit range is outside the supported 256 m work area.");}
  internal static TerrainEditState CopyState(TerrainEditState s)
  {
   return new TerrainEditState{Version=s.Version,Revision=s.Revision,BaseTerrainHash=s.BaseTerrainHash,OwnedColumns=new List<TerrainColumnOverride>(s.OwnedColumns),PaintRuns=new List<TerrainPaintRun>(s.PaintRuns),Palette=new List<VoxelPaletteEntry>(s.Palette),References=new List<TerrainReferenceRecord>(s.References),Settings=s.Settings};
  }
  internal static bool Same(IReadOnlyList<TerrainVolumeSpan> a,IReadOnlyList<TerrainVolumeSpan> b){if(a.Count!=b.Count)return false;for(int i=0;i<a.Count;i++)if(a[i].Min!=b[i].Min||a[i].Max!=b[i].Max||a[i].BaseColorId!=b[i].BaseColorId||a[i].TopColorId!=b[i].TopColorId||a[i].BottomColorId!=b[i].BottomColorId)return false;return true;}
  internal static List<TerrainVolumeSpan> Normalize(IEnumerable<TerrainVolumeSpan> spans)
  {
   var sorted=spans.Where(s=>s.Min<s.Max).OrderBy(s=>s.Min).ThenBy(s=>s.Max).ToList();var result=new List<TerrainVolumeSpan>();
   foreach(var s in sorted){if(result.Count==0){result.Add(s);continue;}var p=result[result.Count-1];if(s.Min<p.Max)throw new ArgumentException("Overlapping volume colors require explicit interval union.");if(s.Min==p.Max&&s.BaseColorId==p.BaseColorId&&s.TopColorId==p.TopColorId&&s.BottomColorId==p.BottomColorId){p.Max=s.Max;result[result.Count-1]=p;}else result.Add(s);}return result;
  }
  internal static List<TerrainVolumeSpan> Subtract(IReadOnlyList<TerrainVolumeSpan> spans,int lo,int hi)
  {
   if(lo>=hi)return new List<TerrainVolumeSpan>(spans);var result=new List<TerrainVolumeSpan>();foreach(var s in spans){if(s.Max<=lo||s.Min>=hi){result.Add(s);continue;}if(s.Min<lo){var p=s;p.Max=lo;result.Add(p);}if(s.Max>hi){var p=s;p.Min=hi;result.Add(p);}}return result;
  }
  internal static List<TerrainVolumeSpan> Difference(IReadOnlyList<TerrainVolumeSpan> a,IReadOnlyList<TerrainVolumeSpan> b){var r=new List<TerrainVolumeSpan>(a);foreach(var s in b)r=Subtract(r,s.Min,s.Max);return r;}
  internal static List<TerrainVolumeSpan> Union(IReadOnlyList<TerrainVolumeSpan> old,TerrainVolumeSpan addition)
  {var r=new List<TerrainVolumeSpan>(old);r.AddRange(Difference(new[]{addition},old));return Normalize(r);}
  internal static List<TerrainPoint3> CanonicalPath(IReadOnlyList<TerrainPoint3> path)
  {
   if(path==null||path.Count==0||path.Count>16384)throw new ArgumentException("Reference/edit path requires 1–16384 points.");var result=new List<TerrainPoint3>();
   foreach(var p in path){if(!Finite(p.X)||!Finite(p.Y)||!Finite(p.Z)||Math.Abs(p.X)>256||Math.Abs(p.Y)>256||Math.Abs(p.Z)>256)throw new ArgumentException("Path is outside supported finite work area.");if(result.Count>0&&Distance(result[result.Count-1],p)<1e-7)continue;result.Add(p);while(result.Count>=3){int n=result.Count;var a=result[n-3];var b=result[n-2];var c=result[n-1];double ux=b.X-a.X,uy=b.Y-a.Y,uz=b.Z-a.Z,vx=c.X-b.X,vy=c.Y-b.Y,vz=c.Z-b.Z,cross=(uy*vz-uz*vy)*(uy*vz-uz*vy)+(uz*vx-ux*vz)*(uz*vx-ux*vz)+(ux*vy-uy*vx)*(ux*vy-uy*vx);if(ux*vx+uy*vy+uz*vz<0||cross>1e-10*(ux*ux+uy*uy+uz*uz+vx*vx+vy*vy+vz*vz))break;result.RemoveAt(n-2);}}
   return result;
  }
  internal static double Distance(TerrainPoint3 a,TerrainPoint3 b){double x=b.X-a.X,y=b.Y-a.Y,z=b.Z-a.Z;return Math.Sqrt(x*x+y*y+z*z);}
  internal static Bounds2 PathBounds(IReadOnlyList<TerrainPoint3> p,float radius){return new Bounds2((int)Math.Floor((p.Min(a=>a.X)-radius)/TerrainUnits.Unit),(int)Math.Floor((p.Min(a=>a.Z)-radius)/TerrainUnits.Unit),(int)Math.Ceiling((p.Max(a=>a.X)+radius)/TerrainUnits.Unit),(int)Math.Ceiling((p.Max(a=>a.Z)+radius)/TerrainUnits.Unit));}
  internal static TerrainEditResult Commit(TerrainEditSnapshot source,Dictionary<TerrainColumnKey,List<TerrainVolumeSpan>> changes,TerrainEditState supplied,bool checkSupport)
  {
   if(changes.Count>65536||changes.Sum(p=>(long)p.Value.Count)>262144)throw new ArgumentException("Edit exceeds the active fine-column or span budget.");
   var state=supplied??CopyState(source.State);var dirty=new TerrainDirtySet();
   foreach(var pair in changes){var b=new Bounds2(pair.Key.X,pair.Key.Z,pair.Key.X+1,pair.Key.Z+1);var original=source.ColumnAt(pair.Key.X,pair.Key.Z);var delta=Difference(original,pair.Value);delta.AddRange(Difference(pair.Value,original));
    foreach(var l in source.Basis.ShapeLocks)if(l.Enabled&&l.Bounds.Intersects(b)&&delta.Any(s=>s.Min<l.MaxHeight&&s.Max>l.MinHeight))throw new ArgumentException("The edit intersects a protected shape; unlock it first.");
    if(pair.Value.Any(s=>s.Min< -4096||s.Max>4096))throw new ArgumentException("Edited heights exceed the supported 256 m work area.");dirty.AddColumn(pair.Key.X,pair.Key.Z);
   }
   var keys=new HashSet<TerrainColumnKey>(changes.Keys);state.OwnedColumns=state.OwnedColumns.Where(c=>!keys.Contains(new TerrainColumnKey(c.X,c.Z))).ToList();foreach(var p in changes.OrderBy(p=>p.Key.X).ThenBy(p=>p.Key.Z))state.OwnedColumns.Add(new TerrainColumnOverride{X=p.Key.X,Z=p.Key.Z,Spans=p.Value});
   for(int i=source.State.PaintRuns.Count;i<state.PaintRuns.Count;i++)dirty.AddColumn(state.PaintRuns[i].X,state.PaintRuns[i].Z);
   bool colorChanged=state.PaintRuns.Count!=source.State.PaintRuns.Count||state.Palette.Count!=source.State.Palette.Count;if(changes.Count==0&&!colorChanged)return new TerrainEditResult{Snapshot=source};
   state.Revision=source.State.Revision+1;TerrainEffectiveSource.Validate(state);var snapshot=source.WithState(state);
   if(checkSupport)foreach(var p in changes)foreach(var span in p.Value)if(span.Min>source.Basis.BaseHeight&&!Rooted(snapshot,p.Key,span)&&Rooted(source,p.Key,span))throw new ArgumentException("This cut removes the only support of a remaining fragment. Keep a connected support or erase that fragment too.");
   return new TerrainEditResult{Snapshot=snapshot,Dirty=dirty,Changed=true};
  }
  static bool Rooted(TerrainEditSnapshot source,TerrainColumnKey start,TerrainVolumeSpan span)
  {
   var queue=new Queue<Tuple<TerrainColumnKey,TerrainVolumeSpan>>();var seen=new HashSet<string>();
   foreach(var s in source.ColumnAt(start.X,start.Z))if(s.Min<span.Max&&s.Max>span.Min)queue.Enqueue(Tuple.Create(start,s));int visits=0;
   while(queue.Count>0){var item=queue.Dequeue();var k=item.Item1;var s=item.Item2;string id=k.X+","+k.Z+","+s.Min+","+s.Max;if(!seen.Add(id))continue;if(s.Min<=source.Basis.BaseHeight)return true;if(++visits>262144)throw new ArgumentException("Support validation exceeds the connected-component budget.");
    foreach(var vertical in source.ColumnAt(k.X,k.Z))if(vertical.Max==s.Min||vertical.Min==s.Max)queue.Enqueue(Tuple.Create(k,vertical));
    foreach(var n in new[]{new TerrainColumnKey(k.X-1,k.Z),new TerrainColumnKey(k.X+1,k.Z),new TerrainColumnKey(k.X,k.Z-1),new TerrainColumnKey(k.X,k.Z+1)})foreach(var v in source.ColumnAt(n.X,n.Z))if(v.Min<s.Max&&v.Max>s.Min)queue.Enqueue(Tuple.Create(n,v));
   }return false;
  }
 }
}



