using System;
using System.Collections.Generic;
using System.Linq;
namespace XingHai.LE01.Core
{
 public enum ReferenceBrushMode {Add,Subtract,ColorOnly}
 [Serializable] public sealed class ReferenceBrushCommand
 {
  public ReferenceBrushMode Mode;public List<TerrainPoint3> Path=new List<TerrainPoint3>();
  public int Quantum=4,Seed=719,ExpectedRevision=-1;public float ScaleX=1,ScaleY=1,ScaleZ=1,YawDegrees,BlendWidth;
  public bool UseColor=true,OverwriteManual;
 }
 public static class TerrainReferenceEdits
 {
  sealed class Sample {internal ReferenceVoxel Voxel;internal int[] Faces;}
  public static TerrainEditResult Apply(TerrainEditSnapshot source,ReferenceBrushCommand command,CompiledReferenceField reference)
  {
   try {
    if(source==null||command==null||reference==null)throw new ArgumentException("Choose a certified shape/color reference first.");
    TerrainEditOperations.ValidateRevision(source,command.ExpectedRevision);
    if(!Enum.IsDefined(typeof(ReferenceBrushMode),command.Mode)||!TerrainUnits.ValidQuantum(command.Quantum)||!Scale(command.ScaleX)||!Scale(command.ScaleY)||!Scale(command.ScaleZ)||!TerrainEditOperations.Finite(command.YawDegrees)||!TerrainEditOperations.Finite(command.BlendWidth)||command.BlendWidth<0||command.BlendWidth>4)throw new ArgumentException("Invalid reference brush settings (scale .5–3; blend 0–4 m).");
    var path=TerrainEditOperations.CanonicalPath(command.Path);double unit=command.Quantum*TerrainUnits.Unit;
    if(reference.Size.X*command.ScaleX<unit||reference.Size.Y*command.ScaleY<unit||reference.Size.Z*command.ScaleZ<unit)throw new ArgumentException("Each resampled reference dimension must occupy at least one target cell.");
    var samples=SampleSweep(path,command,reference);
    var active=new HashSet<TerrainColumnKey>();foreach(var p in samples.Keys)for(int dz=0;dz<command.Quantum;dz++)for(int dx=0;dx<command.Quantum;dx++)active.Add(new TerrainColumnKey(p.X+dx,p.Z+dz));
    if(active.Count>65536)throw new ArgumentException("Reference resampling expands beyond 65536 active fine columns.");
    var changes=new Dictionary<TerrainColumnKey,List<TerrainVolumeSpan>>();var state=TerrainEditOperations.CopyState(source.State);var paletteMap=new Dictionary<int,int>();
    foreach(var p in samples.OrderBy(p=>p.Key.X).ThenBy(p=>p.Key.Z).ThenBy(p=>p.Key.Y)) {
     for(int dz=0;dz<command.Quantum;dz++)for(int dx=0;dx<command.Quantum;dx++) {
      int x=p.Key.X+dx,z=p.Key.Z+dz,lo=p.Key.Y,hi=lo+command.Quantum;var key=new TerrainColumnKey(x,z);List<TerrainVolumeSpan> current;if(!changes.TryGetValue(key,out current))current=new List<TerrainVolumeSpan>(source.ColumnAt(x,z));
      if(command.Mode==ReferenceBrushMode.Subtract) {
       var next=TerrainEditOperations.Subtract(current,lo,hi);if(!TerrainEditOperations.Same(current,next))changes[key]=next;continue;
      }
      var volume=new TerrainVolumeSpan(lo,hi);
      if(command.Mode==ReferenceBrushMode.ColorOnly) {
       if(!command.UseColor)continue;
       foreach(var s in current) {int a=Math.Max(s.Min,lo),b=Math.Min(s.Max,hi);if(a<b)ColorRuns(source,state,paletteMap,reference,p.Value,x,z,a,b,command.OverwriteManual?101:10,true);}
       continue;
      }
      if(command.UseColor&&command.OverwriteManual)foreach(var existing in current){int a=Math.Max(existing.Min,lo),b=Math.Min(existing.Max,hi);if(a<b)ColorRuns(source,state,paletteMap,reference,p.Value,x,z,a,b,101,true);}
      var added=TerrainEditOperations.Difference(new[]{volume},current);if(added.Count==0)continue;
      foreach(var add in added) {
       var s=add;if(command.UseColor){s.BaseColorId=Color(state,paletteMap,reference,p.Value.Voxel.Material);s.TopColorId=Color(state,paletteMap,reference,p.Value.Faces[3]);s.BottomColorId=Color(state,paletteMap,reference,p.Value.Faces[2]);ColorRuns(source,state,paletteMap,reference,p.Value,x,z,s.Min,s.Max,command.OverwriteManual?101:10,false);}
       current=TerrainEditOperations.Union(current,s);
      }
      changes[key]=current;
     }
    }
    // A finite deterministic shoulder shares the existing surface and the new field.
    // It never fills reference holes or invents a purpose-specific construction rule.
    if(command.Mode==ReferenceBrushMode.Add&&command.BlendWidth>0)Blend(source,changes,command);
    var result=TerrainEditOperations.Commit(source,changes,state,command.Mode==ReferenceBrushMode.Subtract);
    if(command.Mode==ReferenceBrushMode.ColorOnly&&result.Changed){result.Dirty.ColorOnly=true;foreach(var k in active)result.Dirty.AddColumn(k.X,k.Z);}
    return result;
   }catch(ArgumentException e){return TerrainEditOperations.Reject(source,e.Message);}
  }
  static bool Scale(float v){return TerrainEditOperations.Finite(v)&&v>=.5f&&v<=3;}
  static Dictionary<ReferenceVoxelKey,Sample> SampleSweep(List<TerrainPoint3> path,ReferenceBrushCommand c,CompiledReferenceField f)
  {
   var output=new Dictionary<ReferenceVoxelKey,Sample>();double radians=c.YawDegrees*Math.PI/180,cos=Math.Cos(radians),sin=Math.Sin(radians);int scanned=0,q=c.Quantum;double step=q*TerrainUnits.Unit*.5;
   var points=Resample(path,step);double minX=double.MaxValue,maxX=double.MinValue,minZ=double.MaxValue,maxZ=double.MinValue;
   foreach(double x in new[]{-f.Pivot.X*c.ScaleX,(f.Size.X-f.Pivot.X)*c.ScaleX})foreach(double z in new[]{-f.Pivot.Z*c.ScaleZ,(f.Size.Z-f.Pivot.Z)*c.ScaleZ}){double rx=cos*x-sin*z,rz=sin*x+cos*z;minX=Math.Min(minX,rx);maxX=Math.Max(maxX,rx);minZ=Math.Min(minZ,rz);maxZ=Math.Max(maxZ,rz);}
   foreach(var point in points) {
    int x0=Floor(point.X+minX,q),x1=Ceil(point.X+maxX,q),z0=Floor(point.Z+minZ,q),z1=Ceil(point.Z+maxZ,q),y0=Floor(point.Y-f.Pivot.Y*c.ScaleY,q),y1=Ceil(point.Y+(f.Size.Y-f.Pivot.Y)*c.ScaleY,q);
    TerrainEditOperations.ValidateBounds(new Bounds2(x0,z0,x1,z1));if(y0< -4096||y1>4096)throw new ArgumentException("Reference height exceeds the supported work area.");
    long box=(long)((x1-x0)/q)*((z1-z0)/q)*((y1-y0)/q);if(box>65536)throw new ArgumentException("Reference target sampling box exceeds 65536 cells.");
    for(int z=z0;z<z1;z+=q)for(int x=x0;x<x1;x+=q)for(int y=y0;y<y1;y+=q) {
     if(++scanned>4194304)throw new ArgumentException("Reference sweep exceeds the bounded sampling work budget.");
     double wx=(x+q*.5)*TerrainUnits.Unit-point.X,wz=(z+q*.5)*TerrainUnits.Unit-point.Z,wy=(y+q*.5)*TerrainUnits.Unit-point.Y;
     double sx=(cos*wx+sin*wz)/c.ScaleX+f.Pivot.X,sz=(-sin*wx+cos*wz)/c.ScaleZ+f.Pivot.Z,sy=wy/c.ScaleY+f.Pivot.Y;
     var v=f.Sample(sx,sy,sz);if(v==null)continue;var key=new ReferenceVoxelKey(x,y,z);if(output.ContainsKey(key))continue;
     output[key]=new Sample{Voxel=v,Faces=RotateFaces(v,cos,sin)};if(output.Count>65536)throw new ArgumentException("Reference sweep exceeds 65536 occupied target cells.");
    }
   }return output;
  }
  static int Floor(double m,int q){return TerrainUnits.FloorDiv((int)Math.Floor(m/TerrainUnits.Unit+1e-7),q)*q;}
  static int Ceil(double m,int q){return -TerrainUnits.FloorDiv(-(int)Math.Ceiling(m/TerrainUnits.Unit-1e-7),q)*q;}
  static List<TerrainPoint3> Resample(List<TerrainPoint3> path,double spacing)
  {
   var result=new List<TerrainPoint3>{path[0]};double cumulative=0,next=spacing;
   for(int i=1;i<path.Count;i++){var a=path[i-1];var b=path[i];double length=TerrainEditOperations.Distance(a,b);if(length<=1e-9)continue;while(next<=cumulative+length+1e-9){double t=Math.Min(1,(next-cumulative)/length);result.Add(new TerrainPoint3((float)(a.X+(b.X-a.X)*t),(float)(a.Y+(b.Y-a.Y)*t),(float)(a.Z+(b.Z-a.Z)*t)));next+=spacing;if(result.Count>65536)throw new ArgumentException("Reference sweep path exceeds sampling budget.");}cumulative+=length;}
   if(TerrainEditOperations.Distance(result[result.Count-1],path[path.Count-1])>1e-7)result.Add(path[path.Count-1]);return result;
  }
  static int[] RotateFaces(ReferenceVoxel v,double cos,double sin)
  {
   var result=Enumerable.Repeat(v.Material,6).ToArray();if(v.Faces==null)return result;result[2]=v.Faces[2];result[3]=v.Faces[3];int[] dx={-1,1,0,0,0,0},dz={0,0,0,0,-1,1};
   foreach(int dir in new[]{0,1,4,5}){double x=cos*dx[dir]+sin*dz[dir],z=-sin*dx[dir]+cos*dz[dir];int sourceDir=Math.Abs(x)>=Math.Abs(z)?(x<0?0:1):(z<0?4:5);result[dir]=v.Faces[sourceDir];}return result;
  }
  static int Color(TerrainEditState state,Dictionary<int,int> map,CompiledReferenceField field,int original)
  {
   int index;if(map.TryGetValue(original,out index))return index;var rgba=field.Palette[original].rgba;index=state.Palette.FindIndex(p=>p.rgba.SequenceEqual(rgba));if(index<0){if(state.Palette.Count>=256)throw new ArgumentException("The stable 256-color palette is full.");index=state.Palette.Count;state.Palette.Add(new VoxelPaletteEntry{id="reference."+index,role="solid",rgba=(float[])rgba.Clone()});}map[original]=index;return index;
  }
  static void ColorRuns(TerrainEditSnapshot source,TerrainEditState state,Dictionary<int,int> map,CompiledReferenceField field,Sample sample,int x,int z,int lo,int hi,int priority,bool allFaces)
  {
   for(int dir=0;dir<6;dir++) {
    if(!allFaces&&(dir==2||dir==3||sample.Faces[dir]==sample.Voxel.Material))continue;
    var allowed=new List<TerrainVolumeSpan>{new TerrainVolumeSpan(lo,hi)};List<TerrainPaintRun> prior;
    if(source.Paint.TryGetValue(new TerrainColumnKey(x,z),out prior))foreach(var p in prior)if(p.Priority>priority&&(p.FaceMask&(1<<dir))!=0)allowed=TerrainEditOperations.Subtract(allowed,p.YMin,p.YMax);
    if(allowed.Count==0)continue;
    int color=Color(state,map,field,sample.Faces[dir]);
    foreach(var band in allowed) {
     bool same=true;for(int y=band.Min;y<band.Max;y++)if(source.ColorAt(x,y,z,dir)!=color){same=false;break;}if(same)continue;
     state.PaintRuns.Add(new TerrainPaintRun{X=x,Z=z,YMin=band.Min,YMax=band.Max,FaceMask=1<<dir,ColorId=color,Priority=priority});
     if(state.PaintRuns.Count>262144)throw new ArgumentException("Reference colors exceed the 262144-run paint budget.");
    }
   }
  }  static void Blend(TerrainEditSnapshot source,Dictionary<TerrainColumnKey,List<TerrainVolumeSpan>> changes,ReferenceBrushCommand command)
  {
   int width=Math.Max(1,TerrainUnits.ToUnits(command.BlendWidth)),q=command.Quantum;var original=changes.ToArray();
   foreach(var p in original) {
    var old=source.ColumnAt(p.Key.X,p.Key.Z);if(p.Value.Count==0||old.Count==0)continue;int newTop=p.Value[p.Value.Count-1].Max,oldTop=old[old.Count-1].Max;if(newTop<=oldTop)continue;
    foreach(var offset in new[]{new TerrainColumnKey(-q,0),new TerrainColumnKey(q,0),new TerrainColumnKey(0,-q),new TerrainColumnKey(0,q)})for(int d=q;d<=width;d+=q) {
     int x=p.Key.X+offset.X*d/q,z=p.Key.Z+offset.Z*d/q;var key=new TerrainColumnKey(x,z);if(changes.ContainsKey(key))break;var neighbor=source.ColumnAt(x,z);if(neighbor.Count==0)break;int top=neighbor[neighbor.Count-1].Max;
     // Keep shoulders shallow and tied to the current neighboring plane, not a new mound.
     int target=Math.Min(newTop,top+(int)Math.Round(Math.Min(newTop-top,width)*(1.0-d/(double)(width+q))));
     if(target<=top)continue;var list=TerrainEditOperations.Union(neighbor,new TerrainVolumeSpan(top,target,neighbor[neighbor.Count-1].BaseColorId));changes[key]=list;
     if(changes.Count>65536)throw new ArgumentException("Reference blend exceeds active fine-column budget.");
    }
   }
  }
 }
}


