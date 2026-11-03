using System;
using System.Collections.Generic;
using System.Linq;
using XingHai.LE01.Core;
public static partial class Program
{
 static void ValidationTests()
 {
  var valid=TerrainEffectiveSource.Capture(Flat(),new TerrainEditState()).State;var cases=new Dictionary<string,Action<TerrainEditState>>{
   {"null owned",s=>s.OwnedColumns=null},{"null paint",s=>s.PaintRuns=null},{"null palette",s=>s.Palette=null},{"null references",s=>s.References=null},{"null settings",s=>s.Settings=null},
   {"null owned record",s=>s.OwnedColumns.Add(null)},{"null paint record",s=>s.PaintRuns.Add(null)},{"null palette record",s=>s.Palette.Add(null)},{"null reference record",s=>s.References.Add(null)},
   {"bad version",s=>s.Version=99},{"negative revision",s=>s.Revision=-1},
   {"exclusive maximum X",s=>s.OwnedColumns.Add(new TerrainColumnOverride{X=4096,Z=0})},{"exclusive maximum Z",s=>s.OwnedColumns.Add(new TerrainColumnOverride{X=0,Z=4096})},
   {"duplicate owned",s=>{s.OwnedColumns.Add(new TerrainColumnOverride{X=0,Z=0});s.OwnedColumns.Add(new TerrainColumnOverride{X=0,Z=0});}},
   {"null spanlist",s=>s.OwnedColumns.Add(new TerrainColumnOverride{Spans=null})},
   {"unsorted spans",s=>s.OwnedColumns.Add(new TerrainColumnOverride{Spans=new List<TerrainVolumeSpan>{new TerrainVolumeSpan(3,4),new TerrainVolumeSpan(0,2)}})},
   {"invalid paint world",s=>s.PaintRuns.Add(new TerrainPaintRun{X=4096,YMin=0,YMax=1})},
   {"invalid paint height",s=>s.PaintRuns.Add(new TerrainPaintRun{YMin=-4097,YMax=1})},
   {"zero paint mask",s=>s.PaintRuns.Add(new TerrainPaintRun{YMin=0,YMax=1,FaceMask=0})},
   {"too many paint",s=>s.PaintRuns=Enumerable.Range(0,262145).Select(i=>new TerrainPaintRun{YMin=0,YMax=1}).ToList()},
   {"bad palette identity",s=>s.Palette[0].id=null},{"bad palette role",s=>s.Palette[0].role=null},{"bad palette rgba",s=>s.Palette[0].rgba[0]=float.NaN},
   {"bad reference snapshot",s=>s.References.Add(new TerrainReferenceRecord{Id="empty",SourceHash=new string('a',64)})},
   {"bad settings",s=>s.Settings.Radius=float.NaN}
  };
  var failures=new List<string>();foreach(var pair in cases){var state=valid.Copy();pair.Value(state);try{TerrainEffectiveSource.Validate(state);failures.Add(pair.Key+":accepted");}catch(ArgumentException){}catch(Exception e){failures.Add(pair.Key+":"+e.GetType().Name);}}
  foreach(var name in new[]{"null owned","null paint","null palette","null references","null settings","null owned record","null palette record"}){var state=valid.Copy();cases[name](state);try{TerrainEffectiveSource.Capture(Flat(),state);failures.Add("Capture "+name+":accepted");}catch(ArgumentException){}catch(Exception e){failures.Add("Capture "+name+":"+e.GetType().Name);}}
  Need(failures.Count==0,"Invalid v2 state must reject cleanly: "+string.Join("; ",failures));
  var edge=valid.Copy();edge.OwnedColumns.Add(new TerrainColumnOverride{X=-4096,Z=4095,Spans=new List<TerrainVolumeSpan>{new TerrainVolumeSpan(-4096,4096)}});TerrainEffectiveSource.Validate(edge);Console.WriteLine("Rejected "+cases.Count+" invalid state variants, valid world edge retained");
 }
}
