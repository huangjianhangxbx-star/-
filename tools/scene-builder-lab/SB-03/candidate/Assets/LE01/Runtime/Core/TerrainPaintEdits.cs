using System;
using System.Collections.Generic;
using System.Linq;
namespace XingHai.LE01.Core
{
 [Serializable] public sealed class TerrainPaintCommand
 {
  public Bounds2 Region;public bool UseRegion,VisibleOnly=true;
  public List<SurfaceHit> Hits=new List<SurfaceHit>();
  public float Radius=1.5f;public int YMin=-4096,YMax=4096,FaceMask=63,ColorId=-1,Priority=100,ExpectedRevision=-1;
  public float[] Rgba;
 }
 public static class TerrainPaintEdits
 {
  static TerrainEditResult Reject(TerrainEditSnapshot s,string reason){return new TerrainEditResult{Snapshot=s,Rejected=true,Reason=reason};}
  public static int Direction(SurfaceHit h)
  {float x=Math.Abs(h.NormalX),y=Math.Abs(h.NormalY),z=Math.Abs(h.NormalZ);return x>=y&&x>=z?(h.NormalX<0?0:1):y>=z?(h.NormalY<0?2:3):(h.NormalZ<0?4:5);}
  static bool Finite(float f){return !float.IsNaN(f)&&!float.IsInfinity(f);}
  static bool Same(float[] a,float[] b){return a!=null&&b!=null&&a.Length==4&&b.Length==4&&Enumerable.Range(0,4).All(i=>Math.Abs(a[i]-b[i])<.000001f);}
  static List<TerrainVolumeSpan> Difference(IReadOnlyList<TerrainVolumeSpan> own,IReadOnlyList<TerrainVolumeSpan> other)
  {var r=new List<TerrainVolumeSpan>();foreach(var s in own){int a=s.Min;foreach(var b in other){if(b.Max<=a)continue;if(b.Min>=s.Max)break;if(b.Min>a)r.Add(new TerrainVolumeSpan(a,Math.Min(b.Min,s.Max)));a=Math.Max(a,b.Max);if(a>=s.Max)break;}if(a<s.Max)r.Add(new TerrainVolumeSpan(a,s.Max));}return r;}
  static List<TerrainVolumeSpan> Union(IReadOnlyList<TerrainVolumeSpan> a,IReadOnlyList<TerrainVolumeSpan> b)
  {var all=a.Concat(b).OrderBy(s=>s.Min).ToArray();var r=new List<TerrainVolumeSpan>();foreach(var s in all){if(r.Count==0||r[r.Count-1].Max<s.Min)r.Add(new TerrainVolumeSpan(s.Min,s.Max));else{var p=r[r.Count-1];p.Max=Math.Max(p.Max,s.Max);r[r.Count-1]=p;}}return r;}
  // Orthographic visibility along the hit normal: a rear face never receives a
  // run through a nearer solid. Only relevant rows of the source are scanned.
  static Dictionary<TerrainColumnKey,List<TerrainVolumeSpan>> VisibleSides(TerrainEditSnapshot source,Bounds2 region,int dir)
  {
   var r=new Dictionary<TerrainColumnKey,List<TerrainVolumeSpan>>();bool axisX=dir<2,positive=dir==1||dir==5;
   int row0=axisX?region.MinZ:region.MinX,row1=axisX?region.MaxZ:region.MaxX;
   int lo=axisX?source.Bounds.MinX:source.Bounds.MinZ,hi=axisX?source.Bounds.MaxX:source.Bounds.MaxZ;
   for(int row=row0;row<row1;row++){
    IReadOnlyList<TerrainVolumeSpan> seen=new List<TerrainVolumeSpan>();
    for(int n=positive?hi-1:lo;positive?n>=lo:n<hi;n+=positive?-1:1){int x=axisX?n:row,z=axisX?row:n;var spans=source.ColumnAt(x,z);if(spans.Count==0)continue;var visible=Difference(spans,seen);if(region.Contains(x,z)&&visible.Count>0)r[new TerrainColumnKey(x,z)]=visible;seen=Union(seen,spans);}
   }return r;
  }
  static Bounds2 Area(TerrainPaintCommand c)
  {
   if(c.UseRegion)return c.Region;int r=(int)Math.Ceiling(c.Radius/TerrainUnits.Unit);int x0=int.MaxValue,z0=int.MaxValue,x1=int.MinValue,z1=int.MinValue;
   foreach(var h in c.Hits){int x=(int)Math.Floor(h.X/TerrainUnits.Unit),z=(int)Math.Floor(h.Z/TerrainUnits.Unit);x0=Math.Min(x0,x-r);z0=Math.Min(z0,z-r);x1=Math.Max(x1,x+r+1);z1=Math.Max(z1,z+r+1);}return new Bounds2(x0,z0,x1,z1);
  }
  static bool Near(TerrainPaintCommand c,int x,int z,int min,int max,int dir)
  {
   if(c.UseRegion)return true;float cx=(x+.5f)*TerrainUnits.Unit,cz=(z+.5f)*TerrainUnits.Unit;
   foreach(var h in c.Hits){if(c.VisibleOnly&&Direction(h)!=dir)continue;float dy=Math.Max(min*TerrainUnits.Unit-h.Y,Math.Max(0,h.Y-max*TerrainUnits.Unit));float dx=cx-h.X,dz=cz-h.Z;if(dx*dx+dz*dz+dy*dy<=c.Radius*c.Radius)return true;}return false;
  }
  public static TerrainEditResult Apply(TerrainEditSnapshot source,TerrainPaintCommand command)
  {
   if(source==null||command==null)throw new ArgumentNullException();var c=command;
   if(c.ExpectedRevision>=0&&c.ExpectedRevision!=source.State.Revision)return Reject(source,"The terrain changed; refresh the paint selection.");
   if(c.YMin>=c.YMax||c.YMin< -4096||c.YMax>4096||!Finite(c.Radius)||c.Radius<=0||c.Radius>32||(c.FaceMask&~63)!=0||c.FaceMask==0)return Reject(source,"Invalid paint range or face mask.");
   if(c.Hits==null||(!c.UseRegion||c.VisibleOnly)&&c.Hits.Count==0)return Reject(source,"Choose a visible terrain face before painting.");
   foreach(var h in c.Hits)if(!Finite(h.X)||!Finite(h.Y)||!Finite(h.Z)||!Finite(h.NormalX)||!Finite(h.NormalY)||!Finite(h.NormalZ)||Math.Abs(h.NormalX)+Math.Abs(h.NormalY)+Math.Abs(h.NormalZ)<.5f)return Reject(source,"Invalid surface hit.");
   var area=Area(c);if(area.Empty)return new TerrainEditResult{Snapshot=source};
   if(area.MinX< -4096||area.MinZ< -4096||area.MaxX>4096||area.MaxZ>4096||(long)(area.MaxX-area.MinX)*(area.MaxZ-area.MinZ)>65536)return Reject(source,"Paint selection exceeds the local 65,536-column budget.");
   var palette=new List<VoxelPaletteEntry>(source.State.Palette);int color=c.ColorId;
   if(c.Rgba!=null){if(c.Rgba.Length!=4||c.Rgba.Any(v=>!Finite(v)||v<0||v>1))return Reject(source,"Color must be four finite RGBA values in 0..1.");color=palette.FindIndex(p=>Same(p.rgba,c.Rgba));if(color<0){if(palette.Count>=256)return Reject(source,"The palette already contains 256 colors.");color=palette.Count;palette.Add(new VoxelPaletteEntry{id="paint."+color,role="solid",rgba=(float[])c.Rgba.Clone()});}}
   if(color<0||color>=palette.Count)return Reject(source,"Choose an existing color or supply RGBA.");
   var editedPaint=new Dictionary<TerrainColumnKey,List<TerrainPaintRun>>();var dirty=new TerrainDirtySet{ColorOnly=true};
   int mask=c.FaceMask;if(c.VisibleOnly){int hitMask=0;foreach(var h in c.Hits)hitMask|=1<<Direction(h);mask&=hitMask;}
   for(int dir=0;dir<6;dir++){
    if((mask&(1<<dir))==0)continue;
    var visibility=c.VisibleOnly&&dir!=2&&dir!=3?VisibleSides(source,area,dir):null;
    if(visibility!=null)foreach(var hit in c.Hits){
     if(Direction(hit)!=dir)continue;
     // The camera may be between two walls, or look into a recess obliquely.
     // A certified direct hit is visible even when an axis-parallel ray from
     // infinity would meet another solid first.
     int hx=(int)Math.Floor((hit.X-hit.NormalX*.0001f)/TerrainUnits.Unit),hz=(int)Math.Floor((hit.Z-hit.NormalZ*.0001f)/TerrainUnits.Unit);
     if(!area.Contains(hx,hz))continue;int dx=dir==0?-1:dir==1?1:0,dz=dir==4?-1:dir==5?1:0;
     var exposed=Difference(source.ColumnAt(hx,hz),source.ColumnAt(hx+dx,hz+dz));var key=new TerrainColumnKey(hx,hz);List<TerrainVolumeSpan> old;
     visibility[key]=visibility.TryGetValue(key,out old)?Union(old,exposed):exposed;
    }
    for(int z=area.MinZ;z<area.MaxZ;z++)for(int x=area.MinX;x<area.MaxX;x++){
     var spans=source.ColumnAt(x,z);if(spans.Count==0)continue;var selected=new List<TerrainVolumeSpan>();
     if(dir==2||dir==3){
      for(int i=0;i<spans.Count;i++){
       // The pointer can see a lower shelf from an oblique angle. Select the
       // band nearest the actual hit, rather than assuming the highest top.
       if(c.VisibleOnly){bool nearest=false;foreach(var h in c.Hits){if(Direction(h)!=dir)continue;float boundary=(dir==3?spans[i].Max:spans[i].Min)*TerrainUnits.Unit;float distance=Math.Abs(boundary-h.Y);bool closer=false;for(int j=0;j<spans.Count;j++)if(j!=i&&Math.Abs((dir==3?spans[j].Max:spans[j].Min)*TerrainUnits.Unit-h.Y)<distance-.00001f){closer=true;break;}if(!closer){nearest=true;break;}}if(!nearest)continue;}
       var s=spans[i];int y=dir==3?s.Max-1:s.Min;if(y<c.YMin||y>=c.YMax||!Near(c,x,z,y,y+1,dir))continue;
       // Keep the editable vertical band so newly exposed faces inherit this
       // paint; clip away other disconnected solids in the same column.
       int low=i==0?c.YMin:Math.Max(c.YMin,spans[i-1].Max),high=i==spans.Count-1?c.YMax:Math.Min(c.YMax,spans[i+1].Min);selected.Add(new TerrainVolumeSpan(low,high));
      }
     }else if(visibility!=null){List<TerrainVolumeSpan> visible;if(visibility.TryGetValue(new TerrainColumnKey(x,z),out visible))selected=visible;}
     else{int dx=dir==0?-1:dir==1?1:0,dz=dir==4?-1:dir==5?1:0;selected=Difference(spans,source.ColumnAt(x+dx,z+dz));}
     foreach(var s in selected){int a=Math.Max(s.Min,c.YMin),b=Math.Min(s.Max,c.YMax);if(a>=b||!Near(c,x,z,a,b,dir))continue;
      if(!c.UseRegion){int h0=int.MaxValue,h1=int.MinValue;foreach(var h in c.Hits){if(c.VisibleOnly&&Direction(h)!=dir)continue;int y=(int)Math.Floor(h.Y/TerrainUnits.Unit),rad=(int)Math.Ceiling(c.Radius/TerrainUnits.Unit);h0=Math.Min(h0,y-rad);h1=Math.Max(h1,y+rad+1);}a=Math.Max(a,h0);b=Math.Min(b,h1);if(a>=b)continue;}
      var key=new TerrainColumnKey(x,z);List<TerrainPaintRun> paint;
      if(!editedPaint.TryGetValue(key,out paint)){List<TerrainPaintRun> original;paint=source.Paint.TryGetValue(key,out original)?new List<TerrainPaintRun>(original):new List<TerrainPaintRun>();editedPaint[key]=paint;}
      bool same=paint.Any(p=>p.YMin<=a&&p.YMax>=b&&p.FaceMask==(1<<dir)&&p.ColorId==color&&p.Priority==c.Priority);
      if(same&&source.ColorAt(x,Math.Max(a,Math.Min(b-1,spans[spans.Count-1].Max-1)),z,dir)==color)continue;
      // Remove overwritten same-face portions to bound repeated-stroke storage.
      for(int n=paint.Count-1;n>=0;n--){var p=paint[n];if(p.X!=x||p.Z!=z||p.FaceMask!=(1<<dir)||p.Priority>c.Priority||p.YMax<=a||p.YMin>=b)continue;paint.RemoveAt(n);if(p.YMin<a){var left=p.Copy();left.YMax=a;paint.Add(left);}if(p.YMax>b){var right=p.Copy();right.YMin=b;paint.Add(right);}}
      paint.Add(new TerrainPaintRun{X=x,Z=z,YMin=a,YMax=b,FaceMask=1<<dir,ColorId=color,Priority=c.Priority});dirty.AddColumn(x,z);
     }
    }
   }
   if(dirty.Columns.Count==0)return new TerrainEditResult{Snapshot=source};
   var finalPaint=source.State.PaintRuns.Where(p=>!editedPaint.ContainsKey(new TerrainColumnKey(p.X,p.Z))).ToList();
   foreach(var pair in editedPaint.OrderBy(p=>p.Key.X).ThenBy(p=>p.Key.Z))finalPaint.AddRange(pair.Value);
   if(finalPaint.Count>262144)return Reject(source,"Paint storage exceeds the 262,144-run budget.");
   var state=new TerrainEditState{Version=2,Revision=source.State.Revision+1,BaseTerrainHash=source.State.BaseTerrainHash,OwnedColumns=source.State.OwnedColumns,PaintRuns=finalPaint,Palette=palette,References=source.State.References,Settings=source.State.Settings};
   return new TerrainEditResult{Snapshot=source.WithState(state),Dirty=dirty,Changed=true};
  }
 }
}
