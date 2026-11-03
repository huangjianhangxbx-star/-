using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Unity.Profiling;
using XingHai.LE01;
using XingHai.LE01.Core;
using XingHai.LE01.Editor;
namespace XingHai.LE04.QA
{
 // A separate Engine process and one operation per frame boundary avoid native
 // Undo coalescing between fixtures. Run without -quit; this host exits itself.
 public static class LE04Performance
 {
  [Serializable] sealed class Row
  {public int sample,quantumUnits,changedMeshObjects;public double inputP95Ms,inputMaxMs,beginMs,workerMs,previewMs,releaseMs,finalTickMs,tickP95Ms,tickMaxMs,undoRequestMs,undoRestoreMs,cancelMs;public long mainAllocatedBytes=-1,totalEditorFrameAllocatedBytes=-1;}
  [Serializable] sealed class Summary
  {public int quantumUnits,samples;public double inputP95Ms,inputMaxMs,tickP95Ms,tickMaxMs,previewP95Ms,releaseP95Ms,releaseMaxMs,undoRequestP95Ms,undoRestoreP95Ms,undoRestoreMaxMs,cancelMaxMs;public long maximumEditorFrameAllocatedBytes;public bool inputTarget,tickTarget,previewTarget,releaseTarget,undoTarget,cancelTarget,allocationTarget;}
  [Serializable] sealed class Report
  {
   public string status="PASS",engine,sourceHash,authorHash,error;
   public string scope="Actual session input collection, background solve, final Unity Mesh/Collider upload, release commit, cancel restore and native Undo across Editor frames. Input numbers are controller calls, not physical mouse or GPU frame rate.";
   public string allocations="Mono per-thread API returns zero and is unavailable. totalEditorFrameAllocatedBytes sums verified ProfilerRecorder GC Allocated In Frame (Bytes), from input frame through one frame after final commit, including all worker/main/editor allocations. Conservative whole-Editor upper bound; no heap delta. Controlled 2 MiB probe separately verified the byte counter; GC.Alloc time marker is not used.";
   public int leaves=28968,warmup=5,samples=20;public double coldCompleteMs,coldFinalTickMs;public List<Row> rows=new List<Row>();public List<Summary> summaries=new List<Summary>();
  }
  static Report report;static LE01TerrainAuthor author;static LE04TerrainSession session;static string baselineHash;
  static Stopwatch phaseTimer=new Stopwatch();static List<double> inputs=new List<double>(),ticks=new List<double>();static Row current;
  static int phase,run=-5,quantum=4,previousUploads;static long allocatedStart;static double phaseStart;
  static Dictionary<string,Mesh> originalMeshes,cancelMeshes;static string root;
  static ProfilerRecorder allocationRecorder;static long frameAllocated;
  static void Need(bool value,string reason){if(!value)throw new InvalidOperationException(reason);}
  static double P95(IEnumerable<double> v){var values=v.OrderBy(n=>n).ToArray();return values.Length==0?0:values[(int)Math.Ceiling(values.Length*.95)-1];}
  static Dictionary<string,Mesh> Meshes(){return LE01Adapter.Geometry(author).GetComponentsInChildren<MeshFilter>().ToDictionary(f=>f.gameObject.name,f=>f.sharedMesh);}
  public static void Run()
  {
   if(!Application.isBatchMode)throw new InvalidOperationException("Performance QA is isolated batch only.");
   // A layout restored by the Editor can own a second Tick callback. The QA
   // host must be the only controller that uploads or commits measured jobs.
   foreach(var window in Resources.FindObjectsOfTypeAll<LE01Window>())window.Close();
   root=Environment.GetEnvironmentVariable("LE04_OUTPUT_ROOT")??throw new InvalidOperationException("Set LE04_OUTPUT_ROOT to the LE04 delivery directory.");
   EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);var basis=JsonUtility.FromJson<TerrainDocument>(File.ReadAllText(Path.Combine(root,"qa/fixtures/LE04-baseline24.v3.json")));Need(basis.Cells.Count==28968,"Fixed 24m workload changed");
   author=new GameObject("LE04_Performance_24m").AddComponent<LE01TerrainAuthor>();author.Write(basis);author.gameObject.AddComponent<LE04TerrainState>().Write(new TerrainEditState());
   report=new Report{engine=Application.unityVersion,sourceHash=LE01BEvidence.SourceHash(),authorHash=TerrainQueries.ContentHash(basis)};phaseTimer.Restart();phaseStart=EditorApplication.timeSinceStartup;session=LE04TerrainSession.Get(author);phase=0;EditorApplication.update+=Update;
  }
  static void Configure()
  {
   session.Settings.Tool="shape";session.Settings.Mode="Raise";session.Settings.Amount=.25f;session.Settings.Radius=1.5f;session.Settings.Quantum=quantum;session.Settings.Falloff=1;session.Settings.YAbove=1.5f;session.Settings.YBelow=1.5f;
  }
  static Vector3 Point {get{return quantum==4?new Vector3(.5f,0,0):new Vector3(-4,0,-4);}}
  static void StartEdit()
  {
   Configure();current=new Row{sample=run,quantumUnits=quantum};inputs.Clear();ticks.Clear();originalMeshes=Meshes();frameAllocated=0;allocationRecorder=ProfilerRecorder.StartNew(ProfilerCategory.Memory,"GC Allocated In Frame",2048,ProfilerRecorderOptions.Default);var timer=Stopwatch.StartNew();Need(session.BeginStroke(Point,Vector3.up),"Could not start independent edit: "+session.Status);current.beginMs=timer.Elapsed.TotalMilliseconds;
   // Event-count stress uses the same short collinear path; worker normalizes it.
   for(int n=0;n<500;n++){timer.Restart();session.Drag(Point+new Vector3(n/499f*.1f,0,0),Vector3.up);inputs.Add(timer.Elapsed.TotalMilliseconds);}
   current.inputP95Ms=P95(inputs);current.inputMaxMs=inputs.Max();allocatedStart=GC.GetAllocatedBytesForCurrentThread();session.Release();phaseTimer.Restart();phase=2;
  }
  static void Update()
  {
   try
   {
    Need(EditorApplication.timeSinceStartup-phaseStart<480,"Performance host exceeded eight-minute guard");
    if((phase==2||phase==21)&&allocationRecorder.Valid)frameAllocated+=allocationRecorder.LastValue;
    var timer=Stopwatch.StartNew();int uploads=session.PreviewUploads;session.Tick();double tick=timer.Elapsed.TotalMilliseconds;
    if(phase==0){report.coldFinalTickMs=Math.Max(report.coldFinalTickMs,tick);if(!session.Ready||session.Busy)return;report.coldCompleteMs=phaseTimer.Elapsed.TotalMilliseconds;baselineHash=session.Current.ContentHash();Undo.ClearAll();phase=1;return;}
    if(phase==1){StartEdit();return;}
    if(phase==2){ticks.Add(tick);if(session.PreviewUploads>uploads)current.finalTickMs=tick;if(session.Busy)return;
     current.releaseMs=phaseTimer.Elapsed.TotalMilliseconds;current.workerMs=session.LastWorkerMilliseconds;current.tickP95Ms=P95(ticks);current.tickMaxMs=ticks.Max();long allocated=GC.GetAllocatedBytesForCurrentThread()-allocatedStart;if(allocated>0)current.mainAllocatedBytes=allocated;
     Need(session.Current.ContentHash()!=baselineHash,"Release must commit changed effective source");var updated=Meshes();current.changedMeshObjects=updated.Count(p=>!originalMeshes.ContainsKey(p.Key)||originalMeshes[p.Key]!=p.Value);Need(current.changedMeshObjects<originalMeshes.Count,"Local edit must reuse distant Mesh objects");Undo.FlushUndoRecordObjects();phase=21;return;}
    if(phase==21){if(allocationRecorder.Valid){current.totalEditorFrameAllocatedBytes=frameAllocated;allocationRecorder.Dispose();}phase=3;return;}
    if(phase==3){timer.Restart();Undo.PerformUndo();current.undoRequestMs=timer.Elapsed.TotalMilliseconds;phaseTimer.Restart();session.Rebuild(true);phase=4;return;}
    if(phase==4){if(session.Busy)return;current.undoRestoreMs=phaseTimer.Elapsed.TotalMilliseconds;Need(session.Current.ContentHash()==baselineHash,"Native Undo restores independent benchmark base");phase=5;return;}
    if(phase==5){Configure();cancelMeshes=Meshes();phaseTimer.Restart();Need(session.BeginStroke(Point,Vector3.up),"Cancel fixture begin");session.Drag(Point+new Vector3(.1f,0,0),Vector3.up);previousUploads=session.PreviewUploads;phase=6;return;}
    if(phase==6){current.tickMaxMs=Math.Max(current.tickMaxMs,tick);if(session.PreviewUploads<=previousUploads)return;current.previewMs=phaseTimer.Elapsed.TotalMilliseconds;timer.Restart();session.Cancel();current.cancelMs=timer.Elapsed.TotalMilliseconds;Need(session.Current.ContentHash()==baselineHash,"Cancel restores committed author");var restored=Meshes();Need(restored.Count==cancelMeshes.Count&&restored.All(p=>cancelMeshes.ContainsKey(p.Key)&&cancelMeshes[p.Key]==p.Value),"Cancel restores exact committed Mesh objects");Need(!session.Busy,"Cancel releases transaction");if(run>=0)report.rows.Add(current);run++;if(run>=20){if(quantum==4){quantum=2;run=-5;}else{Finish();return;}}phase=1;return;}
   }
   catch(Exception e){report.status="FAIL";report.error=e.ToString();UnityEngine.Debug.LogException(e);Finish();}
  }
  static void Finish()
  {
   EditorApplication.update-=Update;
   foreach(var group in report.rows.GroupBy(r=>r.quantumUnits)){
    var s=new Summary{quantumUnits=group.Key,samples=group.Count(),inputP95Ms=P95(group.Select(r=>r.inputP95Ms)),inputMaxMs=group.Max(r=>r.inputMaxMs),tickP95Ms=P95(group.Select(r=>r.finalTickMs)),tickMaxMs=group.Max(r=>r.tickMaxMs),previewP95Ms=P95(group.Select(r=>r.previewMs)),releaseP95Ms=P95(group.Select(r=>r.releaseMs)),releaseMaxMs=group.Max(r=>r.releaseMs),undoRequestP95Ms=P95(group.Select(r=>r.undoRequestMs)),undoRestoreP95Ms=P95(group.Select(r=>r.undoRestoreMs)),undoRestoreMaxMs=group.Max(r=>r.undoRestoreMs),cancelMaxMs=group.Max(r=>r.cancelMs)};
    s.maximumEditorFrameAllocatedBytes=group.Max(r=>r.totalEditorFrameAllocatedBytes);s.allocationTarget=s.maximumEditorFrameAllocatedBytes>0&&s.maximumEditorFrameAllocatedBytes<=64L*1024*1024;
    s.inputTarget=s.inputP95Ms<=2&&s.inputMaxMs<=8;s.tickTarget=s.tickP95Ms<=8&&s.tickMaxMs<=33;s.previewTarget=s.previewP95Ms<=150;s.releaseTarget=s.releaseP95Ms<=300&&s.releaseMaxMs<=600;s.undoTarget=s.undoRequestP95Ms<=100&&s.undoRestoreP95Ms<=500&&s.undoRestoreMaxMs<=750;s.cancelTarget=s.cancelMaxMs<=16;report.summaries.Add(s);
   }
   Directory.CreateDirectory(Path.Combine(root,"reports"));File.WriteAllText(Path.Combine(root,"reports/performance-unity.json"),JsonUtility.ToJson(report,true));LE04TerrainSession.Forget(author);UnityEngine.Debug.Log("LE04_PERFORMANCE_COMPLETE "+report.status);EditorApplication.Exit(report.status=="PASS"?0:1);
  }
 }
}
