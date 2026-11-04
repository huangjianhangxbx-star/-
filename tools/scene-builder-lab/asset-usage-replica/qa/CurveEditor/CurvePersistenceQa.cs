using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.BridgeReplica.Editor;

namespace XingHai.BridgeReplica.QA
{
    public static class CurvePersistenceQa
    {
        [Serializable] sealed class Check { public string name,status,error; }
        [Serializable] sealed class Report { public string status,date; public bool physicalInput=false; public List<Check> checks=new List<Check>(); }
        static void CheckCase(Report r,string name,Action action)
        {var item=new Check{name=name};try{action();item.status="PASS";}catch(Exception e){item.status="FAIL";item.error=e.ToString();}r.checks.Add(item);}
        static void Require(bool condition,string message){if(!condition)throw new Exception(message);}
        static void Write(Report r,string name)
        {
            r.status=r.checks.TrueForAll(c=>c.status=="PASS")?"PASS":"FAIL";
            string root=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT");Directory.CreateDirectory(Path.Combine(root,"reports"));File.WriteAllText(Path.Combine(root,"reports",name+".json"),JsonUtility.ToJson(r,true));
            Debug.Log(name+" "+r.status);EditorApplication.Exit(r.status=="PASS"?0:1);
        }
        // Break caught: a rejected new route discards the user's previous valid
        // uncommitted candidate instead of preserving its visible geometry.
        public static void InitialRed(){Run("v02-persistence-initial-red");}
        public static void Green(){Run("v02-persistence-input-green");}
        static void Run(string reportName)
        {
            var report=new Report{date=DateTimeOffset.Now.ToString("o")};ReplicaWindow window=null;
            CheckCase(report,"rejected candidate preserves last valid preview",()=>
            {
                var go=new GameObject("preview-preservation-fixture");var author=go.AddComponent<ReplicaAuthor>();
                try
                {
                    var kit=ReplicaKitRegistry.EnsureBase();var session=ReplicaSession.Get(author);var doc=RouteExamples.Straight();
                    Require(session.Preview(doc,kit),"Fixture's valid existing route rejected: "+session.Status);
                    var previous=author.transform.Find("__RoutePreview");string identity=JsonUtility.ToJson(session.Candidate.Document);
                    var invalid=doc.Clone();invalid.Nodes.Clear();Require(!session.Preview(invalid,kit),"Invalid empty route accepted.");
                    Require(session.HasCandidate&&author.transform.Find("__RoutePreview")==previous,"Rejected route destroyed the existing valid preview.");
                    Require(JsonUtility.ToJson(session.Candidate.Document)==identity,"Rejected route replaced candidate authority.");
                }
                finally{ReplicaSession.Get(author).Cancel();UnityEngine.Object.DestroyImmediate(go);}
            });
            // Break caught: the real Window input adapter still sends freehand
            // input through the orthogonal sketch path, losing non-grid X/Z.
            CheckCase(report,"window diagonal commits schema2 and exact final input",()=>
            {
                window=ScriptableObject.CreateInstance<ReplicaWindow>();window.BeginDraw(new Vector3(.13f,0,.27f));
                window.DragDraw(new Vector3(4.14f,0,4.28f));window.DragDraw(new Vector3(8.19f,0,8.31f));window.DragDraw(new Vector3(15.23f,0,15.37f));
                Require(window.EndDraw(),"Window failed to commit diagonal: "+window.Status);
                var doc=window.Author.Read();Require(doc.SchemaVersion==2,"Window committed legacy orthogonal schema.");
                var end=doc.Nodes[doc.Nodes.Count-1];var world=window.Author.transform.TransformPoint(new Vector3(end.X,end.Y,end.Z));
                Require(Mathf.Abs(world.x-15.23f)<.001f&&Mathf.Abs(world.z-15.37f)<.001f,"Last input sample snapped, discarded, or orthogonalized.");
            });
            if(window!=null){var author=window.Author;UnityEngine.Object.DestroyImmediate(window);if(author!=null){var geo=author.transform.Find("__RouteGeometry");if(geo!=null)ReplicaGeometry.Destroy(geo.gameObject);UnityEngine.Object.DestroyImmediate(author.gameObject);}}
            Write(report,reportName);
        }
    }
}
