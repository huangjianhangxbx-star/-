using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
 public static class LE02StrokePerformance
 {
  [Serializable] sealed class Workload
  {
   public int points,previewUploads;
   public double beginMs,dragP50Ms,dragP95Ms,dragMaxMs,tickP50Ms,tickP95Ms,tickMaxMs,releaseRequestMs,releaseToCommitMs,cancelMs,undoRequestMs,undoToMeshMs;
   public string finalAuthorHash;
  }
  [Serializable] sealed class Report
  {
   public string status="FAIL",engine,utc,sourceHash,error;
   public string scope="Actual Unity process/controller and mesh upload. Synthetic 1ms-spaced path callbacks; no physical mouse, Scene GUI rendering or GPU completion. Drag/Tick percentiles use 500/2000 callbacks; release/cancel/Undo are single observations per workload, not P95. This harness changes only its temporary Scene.";
   public List<Workload> workloads=new List<Workload>();
  }
  static void Need(bool value,string message){if(!value)throw new InvalidOperationException(message);}
  static double Ms(Action action){var watch=Stopwatch.StartNew();action();return watch.Elapsed.TotalMilliseconds;}
  static double Percent(List<double> values,double p){var ordered=values.OrderBy(x=>x).ToArray();return ordered[Math.Min(ordered.Length-1,(int)Math.Ceiling(ordered.Length*p)-1)];}
  static LE01TerrainAuthor Fixture()
  {
   EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
   var d=new TerrainDocument{Id="LE02_PathPerformance",BaseHeight=-48,ActiveQuantum=2};var c=new TerrainCommand{Mode=BrushMode.Extend,Radius=12,Quantum=2};c.Path.Add(new Point2(0,0));d=TerrainGenerators.UpgradeToV3(TerrainKernel.Apply(d,c).Document);
   Need(d.Cells.Count==28968,"24m author benchmark scale changed");var a=new GameObject("LE02_PathPerformance").AddComponent<LE01TerrainAuthor>();a.Write(d);LE01Adapter.Upload(a,TerrainCompiler.Build(d),true,true);return a;
  }
  static void Drain(LE01Stroke stroke){var watch=Stopwatch.StartNew();while(stroke.Busy&&watch.ElapsedMilliseconds<15000){stroke.Tick();Thread.Sleep(2);}Need(!stroke.Busy,"queued operation did not settle");}
  static Workload RunWorkload(int count)
  {
   var result=new Workload{points=count};var author=Fixture();var stroke=new LE01Stroke{Author=author,Mode=BrushMode.Extend,Radius=1.5f,Quantum=2,PlaneHeight=0};
   try{
    result.beginMs=Ms(()=>Need(stroke.Begin(new Vector3(17,0,0),100),"path did not begin"));var drag=new List<double>();var ticks=new List<double>();
    for(int i=1;i<=count;i++){
     double phase=i*.035;var point=new Vector3(15+(float)Math.Cos(phase)*2,0,(float)Math.Sin(phase)*2);
     drag.Add(Ms(()=>stroke.Drag(point,100)));ticks.Add(Ms(stroke.Tick));Thread.Sleep(1);
    }
    result.dragP50Ms=Percent(drag,.5);result.dragP95Ms=Percent(drag,.95);result.dragMaxMs=drag.Max();result.tickP50Ms=Percent(ticks,.5);result.tickP95Ms=Percent(ticks,.95);result.tickMaxMs=ticks.Max();result.previewUploads=stroke.PreviewUploads;
    var completion=Stopwatch.StartNew();result.releaseRequestMs=Ms(()=>Need(stroke.RequestEnd(),"release was not queued"));Drain(stroke);result.releaseToCommitMs=completion.Elapsed.TotalMilliseconds;Need(author.Read().Cells.Count>28968,"long stroke did not extend any terrain");result.finalAuthorHash=TerrainQueries.ContentHash(author.Read());
    var before=author.Read();var original=author.GetComponentsInChildren<MeshFilter>().ToDictionary(f=>f.name,f=>f.sharedMesh);stroke.Mode=BrushMode.Erase;stroke.Radius=.75f;Need(stroke.Begin(new Vector3(17,0,0),100),"erase did not begin");int uploads=stroke.PreviewUploads;var watch=Stopwatch.StartNew();while(stroke.PreviewUploads==uploads&&watch.ElapsedMilliseconds<10000){stroke.Tick();Thread.Sleep(2);}Need(stroke.PreviewUploads>uploads,"cancel case did not upload a preview");result.cancelMs=Ms(stroke.Cancel);
    Need(TerrainQueries.ContentHash(author.Read())==TerrainQueries.ContentHash(before),"cancel changed author");var filters=author.GetComponentsInChildren<MeshFilter>();Need(filters.Length==original.Count&&filters.All(f=>original.ContainsKey(f.name)&&ReferenceEquals(original[f.name],f.sharedMesh)),"cancel did not restore exact committed meshes");
    completion.Restart();result.undoRequestMs=Ms(()=>{Undo.PerformUndo();stroke.RequestUndoChanged();});Drain(stroke);result.undoToMeshMs=completion.Elapsed.TotalMilliseconds;Need(author.Read().Cells.Count==28968,"one Undo did not restore the original 24m author");return result;
   }finally{stroke.Cancel();}
  }
  public static void Run()
  {
   var report=new Report{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O"),sourceHash=LE01BEvidence.SourceHash()};
   try{report.workloads.Add(RunWorkload(500));report.workloads.Add(RunWorkload(2000));report.status="PASS";}
   catch(Exception error){report.error=error.ToString();throw;}
   finally{Directory.CreateDirectory(Path.Combine(LE02PerfEditorTests.Root,"reports"));File.WriteAllText(Path.Combine(LE02PerfEditorTests.Root,"reports/stroke-performance.json"),JsonUtility.ToJson(report,true));}
   UnityEngine.Debug.Log("LE02_STROKE_PERFORMANCE_COMPLETE");
  }
 }
}
