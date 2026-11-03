using System;
using System.Collections.Generic;
using System.Linq;
namespace XingHai.LE01.Core
{
 public static class TerrainKernel
 {
  public const int MaxAuthorLeaves=300000;
  public static TerrainResult Apply(TerrainDocument source,TerrainCommand command)
  {
   if(command!=null&&(command.Mode==BrushMode.SculptDepth||command.Mode==BrushMode.SculptDensity||command.Mode==BrushMode.LockShape||command.Mode==BrushMode.UnlockShape||command.Mode==BrushMode.RestoreShape||command.Mode==BrushMode.RestoreOrphan||command.Mode==BrushMode.SculptShape))return TerrainSculptEdits.Apply(source,command);
   if(command!=null&&(command.Mode==BrushMode.SmoothRaise||command.Mode==BrushMode.SmoothLower))return TerrainSlopeEdits.Apply(source,command);
   var result=new TerrainResult{Document=new TerrainDocument()};
   try {
    string error;if(!Validate(source,out error))throw new ArgumentException(error);
    ValidateCommand(command,source);
    result.Document=source.Copy();result.DirtyBounds=CommandBounds(command);var doc=result.Document;var index=new CellIndex(doc.Cells);
    if(command.Mode==BrushMode.Reshape){doc.SeedPatches.RemoveAll(p=>SameBounds(p.Bounds,result.DirtyBounds));doc.SeedPatches.Add(new SeedPatch{Bounds=result.DirtyBounds,Seed=command.Seed});}
    else if(command.Mode==BrushMode.Convert)Convert(index,doc,command,result);
    else Paint(index,doc,command);
    doc.Cells=index.Map.Values.OrderBy(c=>c.X).ThenBy(c=>c.Z).ThenBy(c=>c.Size).ToList();
    if(doc.Cells.Count>MaxAuthorLeaves)throw new ArgumentException("Author leaf budget exceeded; reduce brush extent.");
    if(!Validate(doc,out error))throw new ArgumentException(error);
    if(command.EntirePlateau&&(command.Mode==BrushMode.Raise||command.Mode==BrushMode.Lower)&&doc.Cells.Count>0)result.DirtyBounds=new Bounds2(doc.Cells.Min(a=>a.X),doc.Cells.Min(a=>a.Z),doc.Cells.Max(a=>a.X+a.Size),doc.Cells.Max(a=>a.Z+a.Size));
    result.Changed=TerrainQueries.ContentHash(source)!=TerrainQueries.ContentHash(doc);result.Message=result.Changed?"Preview ready":"No change";
    TerrainSculptEdits.CheckAuthorEdit(source,result,command);
   }catch(ArgumentException e){if(source!=null)result.Document=source.Copy();result.Rejected=true;result.Changed=false;result.Message=e.Message;}
   return result;
  }
  public static bool Validate(TerrainDocument d,out string error)
  {
   error="";
   if(d==null||d.SchemaVersion!=1||(d.GeneratorVersion!="le01.1"&&d.GeneratorVersion!="le01.2"&&d.GeneratorVersion!="le01.3")){error="Unsupported terrain schema or generator.";return false;}
   if((d.GeneratorVersion=="le01.2"||d.GeneratorVersion=="le01.3")&&(d.SculptSchemaVersion!=(d.GeneratorVersion=="le01.3"?2:1)||d.SculptOverrides==null||d.ShapeLocks==null)){error="Unsupported sculpt schema.";return false;}
   if(d.GeneratorVersion=="le01.3"&&!TerrainRockPresets.Known(d.RockPresetId)){error="Unknown procedural rock preset.";return false;}
   if(d.RockRuleVersion<0||d.RockRuleVersion>1||d.RockRuleVersion!=0&&d.GeneratorVersion!="le01.3"){error="Unsupported rock structure-rule version.";return false;}
   if(!string.IsNullOrEmpty(d.TerrainThemeId)&&d.TerrainThemeId!="stone"&&d.TerrainThemeId!="snow-rock"){error="Unknown terrain theme.";return false;}
   if(d.RockRuleVersion==1&&(!Enum.IsDefined(typeof(TerrainHeightForm),d.HeightBrushForm)||!Finite(d.HeightBrushRotation)||!Finite(d.HeightBrushAspect)||d.HeightBrushAspect<1||d.HeightBrushAspect>4)){error="Invalid saved directional brush settings.";return false;}
   if(!TerrainSculptEdits.ValidateExtensions(d,out error))return false;
   if(!TerrainUnits.ValidQuantum(d.ActiveQuantum)||d.Cells==null||d.Planes==null||d.SeedPatches==null||d.Cells.Count>MaxAuthorLeaves){error="Invalid author data or leaf budget.";return false;}
   if(Math.Abs((long)d.BaseHeight)>4096||Math.Abs((long)d.ActivePlaneHeight)>4096){error="Author heights exceed the supported integer range.";return false;}
   if(!Finite(d.OriginX)||!Finite(d.OriginY)||!Finite(d.OriginZ)||!Finite(d.BrushRadius)||d.BrushRadius<=0){error="Non-finite author settings.";return false;}
   if(d.Planes.Any(p=>p==null)||d.SeedPatches.Any(p=>p==null||p.Bounds.Empty)){error="Invalid work plane or seed patch.";return false;}
   var occupied=new CellIndex(new TerrainCell[0]);
   foreach(var c in d.Cells){
    if(c==null||!TerrainUnits.ValidQuantum(c.Size)||c.X%c.Size!=0||c.Z%c.Size!=0||c.Top<=d.BaseHeight||Math.Abs((long)c.X)>4096||Math.Abs((long)c.Z)>4096||Math.Abs((long)c.Top)>4096){error="Invalid aligned terrain leaf.";return false;}
    var key=new CellKey(c.X,c.Z,c.Size);if(occupied.Map.ContainsKey(key)){error="Overlapping author leaves.";return false;}occupied.Map.Add(key,c);
   }
   // With aligned power-of-two leaves, an overlap is either an exact duplicate or
   // an occupied ancestor. Check after building the index so input order cannot hide it.
   foreach(var c in d.Cells)for(int q=c.Size*2;q<=4;q*=2)if(occupied.Map.ContainsKey(new CellKey(c.X&~(q-1),c.Z&~(q-1),q))){error="Overlapping author leaves.";return false;}
   var corners=new HashSet<CellKey>();
   foreach(var c in d.Cells){
    for(int ix=0;ix<2;ix++)for(int iz=0;iz<2;iz++){
     int x=c.X+ix*c.Size,z=c.Z+iz*c.Size;if(!corners.Add(new CellKey(x,z,0)))continue;
     var a=occupied.At(x-1,z-1);int h0=a==null?d.BaseHeight:a.Top;
     a=occupied.At(x,z-1);int h1=a==null?d.BaseHeight:a.Top;
     a=occupied.At(x-1,z);int h2=a==null?d.BaseHeight:a.Top;
     a=occupied.At(x,z);int h3=a==null?d.BaseHeight:a.Top;
     if(Math.Min(h0,h3)>Math.Max(h1,h2)||Math.Min(h1,h2)>Math.Max(h0,h3)){error="A plateau touches only at a diagonal edge; add a face-connected bridge or erase one corner.";return false;}
    }
   }
   return true;
  }
  static bool Finite(float x){return !float.IsNaN(x)&&!float.IsInfinity(x);}
  static bool SameBounds(Bounds2 a,Bounds2 b){return a.MinX==b.MinX&&a.MinZ==b.MinZ&&a.MaxX==b.MaxX&&a.MaxZ==b.MaxZ;}
  static void ValidateCommand(TerrainCommand c,TerrainDocument d)
  {
   if(c==null||c.Path==null||c.Path.Count==0||c.Path.Count>8192||!Finite(c.Radius)||c.Radius<=0||c.Radius>32)throw new ArgumentException("Invalid brush path or radius.");
   if(!TerrainUnits.ValidQuantum(c.Quantum)||!TerrainUnits.ValidQuantum(c.TargetQuantum))throw new ArgumentException("Quantum must be .25, .125, or .0625 m.");
   foreach(var p in c.Path)if(!Finite(p.X)||!Finite(p.Z)||Math.Abs(p.X)>256||Math.Abs(p.Z)>256)throw new ArgumentException("Brush point outside supported finite work area.");
   if(Math.Abs((long)c.TargetHeight)>4096||Math.Abs((long)c.PlaneHeight)>4096||c.Mode==BrushMode.Extend&&c.PlaneHeight<=d.BaseHeight)throw new ArgumentException("Invalid working height.");
  }
  static Bounds2 CommandBounds(TerrainCommand c)
  {
   var points=c.Mode==BrushMode.Extend||c.Mode==BrushMode.Erase?c.Path:new List<Point2>{c.Path[0]};
   return new Bounds2((int)Math.Floor((points.Min(p=>p.X)-c.Radius)/TerrainUnits.Unit),(int)Math.Floor((points.Min(p=>p.Z)-c.Radius)/TerrainUnits.Unit),(int)Math.Ceiling((points.Max(p=>p.X)+c.Radius)/TerrainUnits.Unit),(int)Math.Ceiling((points.Max(p=>p.Z)+c.Radius)/TerrainUnits.Unit));
  }
  static HashSet<CellKey> Tiles(TerrainCommand c)
  {
   if(c.Coverage!=null&&c.Coverage.Matches(c))return new HashSet<CellKey>(c.Coverage.Keys);
   var tiles=new HashSet<CellKey>();int q=c.Quantum;float size=q*TerrainUnits.Unit;
   Action<Point2> disc=p=>{
    int x0=TerrainUnits.FloorDiv((int)Math.Floor((p.X-c.Radius)/TerrainUnits.Unit),q)*q,z0=TerrainUnits.FloorDiv((int)Math.Floor((p.Z-c.Radius)/TerrainUnits.Unit),q)*q;
    int x1=(int)Math.Ceiling((p.X+c.Radius)/TerrainUnits.Unit),z1=(int)Math.Ceiling((p.Z+c.Radius)/TerrainUnits.Unit);
    for(int z=z0;z<z1;z+=q)for(int x=x0;x<x1;x+=q){float dx=(x+q*.5f)*TerrainUnits.Unit-p.X,dz=(z+q*.5f)*TerrainUnits.Unit-p.Z;if(dx*dx+dz*dz<=c.Radius*c.Radius)tiles.Add(new CellKey(x,z,q));}
   };
   disc(c.Path[0]);
   if(c.Mode==BrushMode.Extend||c.Mode==BrushMode.Erase)for(int i=1;i<c.Path.Count;i++){
    var a=c.Path[i-1];var b=c.Path[i];double length=Math.Sqrt((b.X-a.X)*(b.X-a.X)+(b.Z-a.Z)*(b.Z-a.Z));int steps=(int)Math.Ceiling(length/Math.Min(c.Radius*.4f,size*.5f));if(steps>16384)throw new ArgumentException("Brush segment exceeds work budget.");
    for(int n=1;n<=steps;n++)disc(new Point2(a.X+(b.X-a.X)*n/steps,a.Z+(b.Z-a.Z)*n/steps));
   }
   if(tiles.Count>MaxAuthorLeaves)throw new ArgumentException("Brush area exceeds leaf budget.");return tiles;
  }
  static void Paint(CellIndex index,TerrainDocument doc,TerrainCommand c)
  {
   int q=c.Quantum,target=c.StartHeight+(int)Math.Round((double)(c.TargetHeight-c.StartHeight)/q)*q;
   if(c.Mode==BrushMode.Raise)target=Math.Max(c.StartHeight,target);if(c.Mode==BrushMode.Lower)target=Math.Min(c.StartHeight,target);target=Math.Max(doc.BaseHeight+q,target);var tiles=Tiles(c);
   if(c.EntirePlateau&&(c.Mode==BrushMode.Raise||c.Mode==BrushMode.Lower)){
    var first=index.At((int)Math.Floor(c.Path[0].X/TerrainUnits.Unit),(int)Math.Floor(c.Path[0].Z/TerrainUnits.Unit));var seen=new HashSet<CellKey>();var pending=new Queue<TerrainCell>();if(first!=null&&first.Top==c.StartHeight)pending.Enqueue(first);
    while(pending.Count>0){var a=pending.Dequeue();var k=new CellKey(a.X,a.Z,a.Size);if(!seen.Add(k))continue;for(int s=0;s<a.Size;s++){int[] xs={a.X-1,a.X+a.Size,a.X+s,a.X+s};int[] zs={a.Z+s,a.Z+s,a.Z-1,a.Z+a.Size};for(int n=0;n<4;n++){var b=index.At(xs[n],zs[n]);if(b!=null&&b.Top==c.StartHeight&&!seen.Contains(new CellKey(b.X,b.Z,b.Size)))pending.Enqueue(b);}}}
    foreach(var k in seen){var a=index.Map[k];a.Top=target;a.PlaneId="p"+target;}
   }else foreach(var tile in tiles){
    int step=q;for(int z=tile.Z;z<tile.Z+q;z++)for(int x=tile.X;x<tile.X+q;x++){var existing=index.At(x,z);if(existing!=null)step=Math.Min(step,existing.Size);}
    for(int z=tile.Z;z<tile.Z+q;z+=step)for(int x=tile.X;x<tile.X+q;x+=step){
     var old=index.At(x,z);index.Split(old,step);old=index.At(x,z);var key=new CellKey(x,z,step);
     if(c.Mode==BrushMode.Erase){index.Map.Remove(key);continue;}
     if(c.Mode==BrushMode.Extend){if(old==null)index.Map[key]=new TerrainCell{X=x,Z=z,Size=step,Top=c.PlaneHeight,PlaneId="p"+c.PlaneHeight};else if(old.Top<c.PlaneHeight){old.Top=c.PlaneHeight;old.PlaneId="p"+c.PlaneHeight;}}
     else if(old!=null&&old.Top==c.StartHeight){old.Top=target;old.PlaneId="p"+target;}
    }
   }
   if(c.Mode==BrushMode.Extend)doc.ActivePlaneHeight=c.PlaneHeight;if(c.Mode==BrushMode.Raise||c.Mode==BrushMode.Lower)doc.ActivePlaneHeight=target;
   doc.ActiveQuantum=q;doc.BrushRadius=c.Radius;if(!doc.Planes.Any(p=>p.Height==doc.ActivePlaneHeight))doc.Planes.Add(new WorkPlane{Id="p"+doc.ActivePlaneHeight,Height=doc.ActivePlaneHeight});
  }
  static void Convert(CellIndex index,TerrainDocument doc,TerrainCommand c,TerrainResult result)
  {
   int q=c.TargetQuantum;var p=c.Path[0];var selected=index.Map.Values.Where(a=>{double dx=(a.X+a.Size*.5)*TerrainUnits.Unit-p.X,dz=(a.Z+a.Size*.5)*TerrainUnits.Unit-p.Z;return dx*dx+dz*dz<=c.Radius*c.Radius;}).ToArray();
   foreach(var a in selected)if(a.Size>q)index.Split(a,q);var chosen=new HashSet<TerrainCell>(selected);var blocks=new HashSet<CellKey>();
   foreach(var a in selected)if(a.Size<q)blocks.Add(new CellKey(TerrainUnits.FloorDiv(a.X,q)*q,TerrainUnits.FloorDiv(a.Z,q)*q,q));
   foreach(var block in blocks){
    var members=new HashSet<TerrainCell>();TerrainCell sample=null;bool unsafeBlock=false;
    for(int z=block.Z;z<block.Z+q;z++)for(int x=block.X;x<block.X+q;x++){var a=index.At(x,z);if(a==null){unsafeBlock=true;continue;}members.Add(a);if(sample==null)sample=a;else if(a.Top!=sample.Top||a.Material!=sample.Material)unsafeBlock=true;}
    if(unsafeBlock){result.LostCells+=q*q;throw new ArgumentException("Coarsening would lose a narrow route or height boundary; use a finer quantum.");}
    if(members.Any(a=>!chosen.Contains(a)))continue;foreach(var a in members)index.Map.Remove(new CellKey(a.X,a.Z,a.Size));var merged=sample.Copy();merged.X=block.X;merged.Z=block.Z;merged.Size=q;index.Map[block]=merged;
   }
   doc.ActiveQuantum=q;
  }
 }
 public sealed class TerrainSession
 {
  public TerrainDocument Document{get;private set;}public TerrainDocument Working{get{return LastResult==null?Document:LastResult.Document;}}public bool IsPreview{get{return captured!=null;}}public TerrainResult LastResult{get;private set;}public bool CanUndo{get{return undo.Count>0;}}public bool CanRedo{get{return redo.Count>0;}}
  TerrainDocument captured;readonly Stack<TerrainDocument> undo=new Stack<TerrainDocument>(),redo=new Stack<TerrainDocument>();
  public TerrainSession(TerrainDocument d){Document=d.Copy();}
  public void Begin(TerrainCommand c){captured=Document.Copy();LastResult=TerrainKernel.Apply(captured,c);}
  public void Update(TerrainCommand c){if(captured==null)Begin(c);else LastResult=TerrainKernel.Apply(captured,c);}
  public bool Commit(){if(captured==null||LastResult==null||LastResult.Rejected||!LastResult.Changed){Cancel();return false;}undo.Push(captured);redo.Clear();Document=LastResult.Document.Copy();Document.Revision=captured.Revision+1;captured=null;LastResult=null;return true;}
  public void Cancel(){captured=null;LastResult=null;}
  public bool Undo(){Cancel();if(undo.Count==0)return false;redo.Push(Document.Copy());int revision=Document.Revision+1;Document=undo.Pop();Document.Revision=revision;return true;}
  public bool Redo(){Cancel();if(redo.Count==0)return false;undo.Push(Document.Copy());int revision=Document.Revision+1;Document=redo.Pop();Document.Revision=revision;return true;}
 }
}
