using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Diagnostics;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.BridgeReplica.Editor;
namespace XingHai.BridgeReplica.QA
{
    public static class ReplicaMetrics
    {
        [Serializable] sealed class Entry {public string kit;public int samples,parts,cores,chunks,triangles;public double solveP95,previewP95,applyP95,cancelP95;}
        [Serializable] sealed class Report {public string status="PASS",engine=Application.unityVersion,sourceHash,scope="Five warmups and ten samples of actual main-thread route solve, source-mesh/collider preview, apply and cancel. Not physical input or viewport FPS.";public List<Entry> entries=new List<Entry>();}
        static double P95(List<double> v){v.Sort();return v[(int)Math.Ceiling(v.Count*.95)-1];}
        static double Time(Action a){var w=Stopwatch.StartNew();a();return w.Elapsed.TotalMilliseconds;}
        public static void Run()
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("QA only");string root=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT");var report=new Report();
            report.sourceHash=ReplicaKitRegistry.Hash(System.Text.Encoding.UTF8.GetBytes(string.Join("\n",Directory.GetFiles(Path.Combine(Application.dataPath,"BridgeReplica"),"*.cs",SearchOption.AllDirectories).Where(p=>!p.Replace('\\','/').Contains("/QA/")).OrderBy(p=>p,StringComparer.Ordinal).Select(File.ReadAllText).ToArray())));
            // Scene replacement can unload assets referenced only by C# locals.
            // Reload each kit after NewScene rather than time a destroyed handle.
            foreach(var kitPath in ReplicaKitRegistry.All().Where(k=>!k.ResearchOnly).Select(AssetDatabase.GetAssetPath).ToArray())
            {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);var kit=AssetDatabase.LoadAssetAtPath<ReplicaKit>(kitPath);var author=new GameObject("QA_Metrics").AddComponent<ReplicaAuthor>();var session=ReplicaSession.Get(author);var doc=RouteExamples.Detour();
                var solve=new List<double>();var preview=new List<double>();var apply=new List<double>();var cancel=new List<double>();
                for(int i=0;i<15;i++)
                {
                    double s=Time(()=>{var p=RouteSolver.Solve(doc);if(!p.Valid)throw new InvalidOperationException(p.Message);});
                    double pms=Time(()=>{if(!session.Preview(doc,kit))throw new InvalidOperationException(session.Status);});
                    double a=Time(()=>{if(!session.Apply())throw new InvalidOperationException(session.Status);});
                    if(!session.Preview(RouteEdits.OffsetLeg(doc,2,2),kit))throw new InvalidOperationException(session.Status);double c=Time(session.Cancel);
                    if(i>=5){solve.Add(s);preview.Add(pms);apply.Add(a);cancel.Add(c);}Undo.ClearAll();
                }
                var filters=session.Geometry.GetComponentsInChildren<MeshFilter>();report.entries.Add(new Entry{kit=kit.Id,samples=10,parts=session.Committed.Plan.Parts.Count,cores=session.Committed.Plan.Solids.Count,chunks=filters.Length,triangles=filters.Sum(f=>f.sharedMesh.triangles.Length/3),solveP95=P95(solve),previewP95=P95(preview),applyP95=P95(apply),cancelP95=P95(cancel)});
            }
            File.WriteAllText(Path.Combine(root,"reports/representative-performance.json"),JsonUtility.ToJson(report,true));
        }
        public static void FinalChecks(){ReplicaWorkflow.ReopenB();ReplicaInput.Run();Run();}
        public static void ReopenBAndMeasure(){ReplicaWorkflow.ReopenB();Run();}
    }
}
