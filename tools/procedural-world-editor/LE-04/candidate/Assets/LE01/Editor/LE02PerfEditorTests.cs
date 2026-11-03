using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Threading;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
 public static class LE02PerfEditorTests
 {
  [Serializable] sealed class Check{public string name,status,detail;public double milliseconds;}
  [Serializable] sealed class Report{public string engine,utc,status="PASS",scope="Actual Unity controller/mesh transactions with controlled worker; not physical GUI timing";public List<Check> checks=new List<Check>();}
  static Report report;
  static void Need(bool ok,string message){if(!ok)throw new InvalidOperationException(message);}
  static LE01TerrainAuthor Fixture()
  {
   EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
   var d=new TerrainDocument{Id="LE02_AsyncFixture",BaseHeight=-48,ActiveQuantum=2};var c=new TerrainCommand{Mode=BrushMode.Extend,Radius=2,Quantum=2};c.Path.Add(new Point2(0,0));d=TerrainGenerators.UpgradeToV2(TerrainKernel.Apply(d,c).Document);
   var a=new GameObject("LE02_AsyncFixture").AddComponent<LE01TerrainAuthor>();a.Write(d);LE01Adapter.Upload(a,TerrainCompiler.Build(d),true,true);return a;
  }
  static bool ReleasePending(LE01Stroke stroke){return (bool)typeof(LE01Stroke).GetProperty("ReleasePending").GetValue(stroke,null);}
  static void RequestEnd(LE01Stroke stroke){var method=typeof(LE01Stroke).GetMethod("RequestEnd");Need(method!=null,"Scene mouse release has no asynchronous request boundary");method.Invoke(stroke,null);}
  static void Drain(LE01Stroke stroke){var watch=System.Diagnostics.Stopwatch.StartNew();while(stroke.Active&&watch.ElapsedMilliseconds<5000){stroke.Tick();Thread.Sleep(3);}Need(!stroke.Active,"asynchronous release never settled");}
  static void NonBlockingLatestRelease()
  {
   var a=Fixture();string original=TerrainQueries.ContentHash(a.Read());using(var entered=new ManualResetEventSlim())using(var allow=new ManualResetEventSlim()){
    var stroke=new LE01Stroke((d,c)=>{entered.Set();Need(allow.Wait(2000),"controlled worker was not released");return TerrainKernel.Apply(d,c);}){Author=a,Mode=BrushMode.Raise,Radius=.6f,Quantum=2};
    try{
     Need(stroke.Begin(Vector3.zero,100),"raise did not start");stroke.Drag(Vector3.zero,84);stroke.Tick();Need(entered.Wait(1000),"worker did not start");
     stroke.Drag(Vector3.zero,68);var watch=System.Diagnostics.Stopwatch.StartNew();RequestEnd(stroke);watch.Stop();
     Need(watch.ElapsedMilliseconds<50,"mouse release blocked waiting for generation");Need(stroke.Active&&ReleasePending(stroke)&&LE01Stroke.IsEditing(a),"release-pending must remain a guarded active author transaction");
     Need(TerrainQueries.ContentHash(a.Read())==original,"release wrote author before final worker result");
     bool denied=false;try{LE01Adapter.NativeSave(a,Path.Combine(Root,"qa/must-not-save-pending.json"));}catch(InvalidOperationException){denied=true;}Need(denied,"release-pending save bypassed edit guard");
     allow.Set();Drain(stroke);Need(!ReleasePending(stroke),"settled release retained pending state");Need(TerrainQueries.HeightUnits(a.Read(),0,0)==8,"release committed an earlier drag instead of latest 0.5m target");
     Undo.PerformUndo();stroke.UndoChanged();Need(TerrainQueries.ContentHash(a.Read())==original,"asynchronous release did not create exactly one undo transaction");
    }finally{allow.Set();stroke.Cancel();}
   }
  }
  static void CancelReleasedWorker()
  {
   var a=Fixture();string original=TerrainQueries.ContentHash(a.Read());using(var entered=new ManualResetEventSlim())using(var allow=new ManualResetEventSlim()){
    var stroke=new LE01Stroke((d,c)=>{entered.Set();Need(allow.Wait(2000),"controlled worker was not released");return TerrainKernel.Apply(d,c);}){Author=a,Mode=BrushMode.Erase,Radius=.5f};
    try{Need(stroke.Begin(Vector3.zero,0),"erase did not start");stroke.Tick();Need(entered.Wait(1000),"worker did not start");RequestEnd(stroke);stroke.Cancel();allow.Set();for(int i=0;i<60;i++){stroke.Tick();Thread.Sleep(3);}Need(!stroke.Active&&!ReleasePending(stroke)&&!LE01Stroke.IsEditing(a)&&TerrainQueries.ContentHash(a.Read())==original,"cancelled released worker altered the author or edit guard");}
    finally{allow.Set();stroke.Cancel();}
   }
  }
  static void CancelReusesCommittedMeshes()
  {
   var a=Fixture();var original=new Dictionary<string,Mesh>();foreach(var f in a.GetComponentsInChildren<MeshFilter>())original[f.name]=f.sharedMesh;
   var stroke=new LE01Stroke{Author=a,Mode=BrushMode.Erase,Radius=.5f};Need(stroke.Begin(Vector3.zero,0),"erase did not start");var watch=System.Diagnostics.Stopwatch.StartNew();while(stroke.PreviewUploads==0&&watch.ElapsedMilliseconds<5000){stroke.Tick();Thread.Sleep(3);}Need(stroke.PreviewUploads>0,"cancel fixture has no actual preview");stroke.Cancel();
   Need(a.GetComponentsInChildren<MeshFilter>().Length==original.Count,"cancel lost committed chunks");
   foreach(var f in a.GetComponentsInChildren<MeshFilter>())Need(original.ContainsKey(f.name)&&ReferenceEquals(original[f.name],f.sharedMesh),"cancel regenerated mesh rather than restoring committed mesh references");
  }
  static void HistoryRestorationIsDeferred()
  {
   var a=Fixture();var old=a.GetComponentsInChildren<MeshFilter>()[0].sharedMesh;var replacement=a.Read();foreach(var c in replacement.Cells)c.Top+=4;replacement.Revision++;a.Write(replacement);
   var stroke=new LE01Stroke{Author=a};var request=typeof(LE01Stroke).GetMethod("RequestUndoChanged");Need(request!=null,"history restoration has no asynchronous boundary");
   request.Invoke(stroke,null);Need((bool)typeof(LE01Stroke).GetProperty("RestoringHistory").GetValue(stroke,null),"history restore did not stay guarded until Tick");
   Need(LE01Stroke.IsEditing(a)&&ReferenceEquals(a.GetComponentsInChildren<MeshFilter>()[0].sharedMesh,old),"history request synchronously rebuilt mesh or allowed inconsistent author export");
   var watch=System.Diagnostics.Stopwatch.StartNew();while((bool)typeof(LE01Stroke).GetProperty("RestoringHistory").GetValue(stroke,null)&&watch.ElapsedMilliseconds<5000){stroke.Tick();Thread.Sleep(3);}
   Need(!LE01Stroke.IsEditing(a)&&!ReferenceEquals(a.GetComponentsInChildren<MeshFilter>()[0].sharedMesh,old),"history result did not upload and release edit guard");
   Need(TerrainQueries.ContentHash(a.Read())==TerrainQueries.ContentHash(replacement),"restoring geometry changed history author intent");
  }
  static void AuthorSwapReleasesFormerGuard()
  {
   var first=Fixture();var second=new GameObject("LE02_OtherAuthor").AddComponent<LE01TerrainAuthor>();second.Write(first.Read());LE01Adapter.Upload(second,TerrainCompiler.Build(second.Read()),true,true);
   var stroke=new LE01Stroke{Author=first,Mode=BrushMode.Erase,Radius=.5f};Need(stroke.Begin(Vector3.zero,0),"first-author stroke did not start");stroke.Author=second;stroke.Tick();
   Need(!stroke.Active&&!LE01Stroke.IsEditing(first)&&!LE01Stroke.IsEditing(second),"author swap leaked the former author transaction guard");
  }
  static void ConcurrentControllerCannotStealAuthor()
  {
   var a=Fixture();var first=new LE01Stroke{Author=a,Mode=BrushMode.Erase,Radius=.5f};var second=new LE01Stroke{Author=a,Mode=BrushMode.Raise,Radius=.5f};
   try{Need(first.Begin(Vector3.zero,0),"first controller did not acquire author");Need(!second.Begin(Vector3.zero,0)&&first.Active&&LE01Stroke.IsEditing(a),"second controller stole an active author/committed backup");second.Cancel();Need(LE01Stroke.IsEditing(a),"inactive controller cancelled another controller's edit guard");}
   finally{second.Cancel();first.Cancel();}
  }
  public static string Root{get{return Path.GetFullPath(Path.Combine(Application.dataPath,"../../../LE-02"));}}
  public static void Run()
  {
   report=new Report{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O")};
   foreach(var action in new Action[]{NonBlockingLatestRelease,CancelReleasedWorker,CancelReusesCommittedMeshes,HistoryRestorationIsDeferred,AuthorSwapReleasesFormerGuard,ConcurrentControllerCannotStealAuthor}){
    var timer=System.Diagnostics.Stopwatch.StartNew();var check=new Check{name=action.Method.Name,status="PASS"};try{action();}catch(Exception e){check.status="FAIL";check.detail=e.GetBaseException().Message;report.status="FAIL";}timer.Stop();check.milliseconds=timer.Elapsed.TotalMilliseconds;report.checks.Add(check);
   }
   Directory.CreateDirectory(Path.Combine(Root,"reports"));File.WriteAllText(Path.Combine(Root,"reports/stroke-async.json"),JsonUtility.ToJson(report,true));if(report.status!="PASS")throw new InvalidOperationException("LE02 asynchronous stroke checks failed");Debug.Log("LE02_ASYNC_STROKE_COMPLETE");
  }
 }
}
