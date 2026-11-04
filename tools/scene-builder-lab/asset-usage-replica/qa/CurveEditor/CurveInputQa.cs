using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using XingHai.BridgeReplica.Editor;
namespace XingHai.BridgeReplica.QA
{
    public static class CurveInputQa
    {
        [Serializable] sealed class Report
        {public string status="FAIL",error="",scope="Actual Window input API and native Undo; background engine, physical mouse remains separate.";public bool physicalInput=false;public List<string> checks=new List<string>();public int inputSamples,visibleGrowingPreviews;public float medianPreviewMs,p95PreviewMs,maxPreviewMs;}
        static Report r;static void Need(bool v,string s){if(!v)throw new Exception(s);r.checks.Add(s);}
        public static void Run()
        {
            r=new Report();ReplicaWindow window=null;
            try
            {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);window=ScriptableObject.CreateInstance<ReplicaWindow>();
                var path=CurveExamples.U().Nodes;window.BeginDraw(new Vector3(path[0].X,0,path[0].Z));var times=new List<float>();string last="";
                foreach(var n in path.Skip(1))
                {
                    var clock=System.Diagnostics.Stopwatch.StartNew();bool ok=window.DragDraw(new Vector3(n.X,0,n.Z));clock.Stop();times.Add((float)clock.Elapsed.TotalMilliseconds);r.inputSamples++;
                    if(ok)
                    {
                        // Unity FindObjectsOfType omits the intended DontSave
                        // scratch author. Resources includes it without changing
                        // the input/production path or making a substitute mesh.
                        var preview=Resources.FindObjectsOfTypeAll<ReplicaAuthor>().Where(a=>a.gameObject.scene.IsValid()).Select(a=>a.transform.Find("__RoutePreview")).FirstOrDefault(t=>t!=null);
                        Need(window.Drawing&&preview!=null&&preview.gameObject.activeInHierarchy&&preview.GetComponentsInChildren<MeshRenderer>().Any(m=>m.enabled)&&preview.GetComponentsInChildren<MeshFilter>().Any(f=>f.sharedMesh.vertexCount>0),"bridge geometry visible before mouse release sample "+r.inputSamples);
                        last=ReplicaGeometry.Fingerprint(preview.gameObject);r.visibleGrowingPreviews++;
                    }
                }
                Need(r.visibleGrowingPreviews>=path.Count-3,"continuous input repeatedly updates actual structure, not only a line");
                Need(window.EndDraw(),"U freehand commit succeeds: "+window.Status);var author=window.Author;var session=ReplicaSession.Get(author);var initial=author.Read();var json=author.DocumentJson;var mesh=ReplicaGeometry.Fingerprint(session.Geometry);
                Need(initial.SchemaVersion==2&&mesh==last,"final commit exactly matches last visible preview");
                Need(initial.Nodes.Any(n=>Math.Abs(n.X-Mathf.Round(n.X/.5f)*.5f)>.01f),"free drawing retains non-grid control coordinates");
                var end=initial.Nodes.Last();var world=author.transform.TransformPoint(new Vector3(end.X,end.Y,end.Z));
                Need(Math.Abs(world.x-path.Last().X)<.001f&&Math.Abs(world.z-path.Last().Z)<.001f,"final original U sample survives input adapter");
                Need(window.BeginContinueDraw(),"same-author endpoint continuation armed");window.BeginDraw(world);window.DragDraw(world+Vector3.left*2);window.DragDraw(world+Vector3.left*4);
                Need(window.EndDraw(),"same-author continuation commits");Need(window.Author==author&&author.Read().Id==initial.Id,"extension retains same author and route identity");
                var extended=author.Read();Need(initial.Nodes.Select((n,i)=>JsonUtility.ToJson(n)==JsonUtility.ToJson(extended.Nodes[i])).All(x=>x),"extension preserves every existing control node exactly");
                Need(extended.Nodes.Last().X<end.X-3.9f,"extension adds real end geometry");Undo.FlushUndoRecordObjects();Undo.PerformUndo();
                Need(author.DocumentJson==json&&ReplicaGeometry.Fingerprint(session.Geometry)==mesh,"one native Undo restores entire extension and real Mesh");Undo.PerformRedo();
                Need(author.Read().Nodes.Count==extended.Nodes.Count,"native Redo restores extension");
                string kept=author.DocumentJson,keptMesh=ReplicaGeometry.Fingerprint(session.Geometry);window.BeginDraw(new Vector3(100,0,100));window.DragDraw(new Vector3(106,0,101));window.CancelInput();
                Need(author.DocumentJson==kept&&ReplicaGeometry.Fingerprint(session.Geometry)==keptMesh,"cancelled new stroke preserves previously committed bridge");
                // Navigation finishes a valid drawn gesture, then must leave it intact.
                window.BeginDraw(new Vector3(80.13f,0,80.27f));window.DragDraw(new Vector3(88.19f,0,84.31f));window.FinishGesture();var navigated=window.Author;var navJson=navigated.DocumentJson;var navMesh=ReplicaGeometry.Fingerprint(ReplicaSession.Get(navigated).Geometry);window.FinishGesture();
                Need(navigated.DocumentJson==navJson&&ReplicaGeometry.Fingerprint(ReplicaSession.Get(navigated).Geometry)==navMesh,"navigation completion does not roll back committed geometry");
                times.Sort();r.medianPreviewMs=times[times.Count/2];r.p95PreviewMs=times[Math.Min(times.Count-1,(int)(times.Count*.95f))];r.maxPreviewMs=times.Last();r.status="PASS";
            }
            catch(Exception e){r.error=e.ToString();}
            finally{if(window!=null)UnityEngine.Object.DestroyImmediate(window);string root=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT");File.WriteAllText(Path.Combine(root,"reports/v02-input-api.json"),JsonUtility.ToJson(r,true));}
            Debug.Log("CURVE_INPUT_API "+r.status+" "+r.error);EditorApplication.Exit(r.status=="PASS"?0:1);
        }
    }
}
