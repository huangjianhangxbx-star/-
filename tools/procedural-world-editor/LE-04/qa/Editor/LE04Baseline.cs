using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01;
using XingHai.LE01.Core;
using XingHai.LE01.Editor;
namespace XingHai.LE04.QA
{
 public static class LE04Baseline
 {
  [Serializable] sealed class Row{public int run;public double kernelMs,compileMs,uploadMs,totalMs;public long allocatedBytes;}
  [Serializable] sealed class Report{public string scope="Actual A-only legacy Unity main-thread Kernel+partial compile+final Mesh/Collider upload, five warmups and twenty measured independent edits against fixed source; excludes SceneView input/GPU. Actual allocated bytes, not heap delta.";public string sourceHash,authorHash,engine;public int leaves,triangles,chunks;public double initialCompileMs,initialUploadMs,p95Ms,maxMs;public List<Row> rows=new List<Row>();}
  public static void Run()
  {
   var root=Environment.GetEnvironmentVariable("LE04_OUTPUT_ROOT");
   EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
   var d=JsonUtility.FromJson<TerrainDocument>(File.ReadAllText(Path.Combine(root,"qa/fixtures/LE04-baseline24.v3.json")));
   if(d.Cells.Count!=28968)throw new InvalidOperationException("The fixed 24m baseline changed");
   var report=new Report{engine=Application.unityVersion,sourceHash=LE01BEvidence.SourceHash(),authorHash=TerrainQueries.ContentHash(d),leaves=d.Cells.Count};
   var a=new GameObject("LE04_LegacyBaseline").AddComponent<LE01TerrainAuthor>();a.Write(d);
   var t=Stopwatch.StartNew();var full=TerrainCompiler.Build(d);report.initialCompileMs=t.Elapsed.TotalMilliseconds;
   t.Restart();LE01Adapter.Upload(a,full,true,true);report.initialUploadMs=t.Elapsed.TotalMilliseconds;report.chunks=full.Chunks.Count;report.triangles=full.Chunks.Sum(c=>c.Triangles.Length/3);
   for(int i=-5;i<20;i++){
    var command=new TerrainCommand{Mode=BrushMode.Raise,Radius=1.5f,Quantum=4,TargetHeight=4};command.Path.Add(new Point2(.5f,0));
    long before=GC.GetAllocatedBytesForCurrentThread();t.Restart();var edited=TerrainKernel.Apply(d,command);double kernel=t.Elapsed.TotalMilliseconds;if(edited.Rejected)throw new Exception(edited.Message);
    t.Restart();var built=TerrainCompiler.Build(edited.Document,edited.DirtyBounds);double compile=t.Elapsed.TotalMilliseconds;
    a.Write(edited.Document);t.Restart();LE01Adapter.Upload(a,built,true,false);double upload=t.Elapsed.TotalMilliseconds;
    if(i>=0)report.rows.Add(new Row{run=i,kernelMs=kernel,compileMs=compile,uploadMs=upload,totalMs=kernel+compile+upload,allocatedBytes=GC.GetAllocatedBytesForCurrentThread()-before});
   }
   report.p95Ms=report.rows.Select(r=>r.totalMs).OrderBy(x=>x).ElementAt(18);report.maxMs=report.rows.Max(r=>r.totalMs);
   File.WriteAllText(Path.Combine(root,"reports/baseline-unity.json"),JsonUtility.ToJson(report,true));
   UnityEngine.Debug.Log("LE04_BASELINE_COMPLETE");
  }
 }
}
