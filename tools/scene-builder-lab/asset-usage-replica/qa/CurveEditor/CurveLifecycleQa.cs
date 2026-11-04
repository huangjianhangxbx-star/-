using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.BridgeReplica.Editor;

namespace XingHai.BridgeReplica.QA
{
    public static class CurveLifecycleQa
    {
        const string ScenePath="Assets/BridgeReplica/Scenes/CurveLifecycle.unity";
        [Serializable] sealed class Check { public string name,status,error; }
        [Serializable] sealed class Expected { public string document,mesh,mapping,legacyDocument,legacyMesh; public int nodes; }
        [Serializable] sealed class Report { public string status,date,scope="Actual Unity meshes, author files, scene serialization and native Undo; not physical mouse input."; public List<Check> checks=new List<Check>(); }
        static string Output {get{return Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT");}}
        static string Reports {get{return Path.Combine(Output,"reports");}}
        static string AuthorFile {get{return Path.Combine(Output,"samples/curve-U-v2.bridge-route.json");}}
        static void Need(bool value,string message){if(!value)throw new Exception(message);}
        static string Hash(string text){return ReplicaKitRegistry.Hash(Encoding.UTF8.GetBytes(text));}
        static void Case(Report report,string name,Action action)
        {var c=new Check{name=name};try{action();c.status="PASS";}catch(Exception e){c.status="FAIL";c.error=e.ToString();}report.checks.Add(c);Debug.Log("CURVE_LIFECYCLE "+name+" "+c.status+" "+c.error);}
        static void Finish(Report report,string name)
        {report.status=report.checks.All(c=>c.status=="PASS")?"PASS":"FAIL";Directory.CreateDirectory(Reports);File.WriteAllText(Path.Combine(Reports,name+".json"),JsonUtility.ToJson(report,true));EditorApplication.Exit(report.status=="PASS"?0:1);}
        static ReplicaAuthor Create(string name,RouteDocument doc,ReplicaKit kit)
        {var author=new GameObject(name).AddComponent<ReplicaAuthor>();var session=ReplicaSession.Get(author);Need(session.Preview(doc,kit),session.Status);Need(session.ApplyNew(),session.Status);return author;}
        static string Mesh(ReplicaAuthor author){return ReplicaGeometry.Fingerprint(author.transform.Find("__RouteGeometry").gameObject);}
        public static void Run()
        {
            Need(Application.isBatchMode,"Use the unique temporary background QA Editor.");EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var report=new Report{date=DateTimeOffset.Now.ToString("o")};ReplicaAuthor author=null,legacy=null;Expected expected=null;
            var kit=ReplicaKitRegistry.EnsureBase();
            Case(report,"v2 preview commits identical actual meshes",()=>
            {
                legacy=Create("Legacy_v1_preserved",RouteExamples.Straight(),kit);
                author=new GameObject("Freehand_v2_U").AddComponent<ReplicaAuthor>();var session=ReplicaSession.Get(author);
                Need(session.Preview(CurveExamples.U(),kit),session.Status);var preview=author.transform.Find("__RoutePreview").gameObject;
                Need(preview.GetComponentsInChildren<MeshFilter>().Any(f=>f.sharedMesh.vertexCount>0),"Preview contains no actual geometry.");
                string mesh=ReplicaGeometry.Fingerprint(preview);Need(session.ApplyNew(),session.Status);Need(Mesh(author)==mesh,"Committed mesh differs from final preview.");
                Need(author.Read().SchemaVersion==2&&author.Read().Nodes.Count==29,"U author loses freehand control points.");
                var mapping=JsonUtility.FromJson<CurveMapping>(author.MappingJson);Need(mapping.route!=null&&JsonUtility.ToJson(mapping.route)==author.DocumentJson,"Committed provenance contains an older author revision.");
                Need(session.Geometry.GetComponentsInChildren<MeshFilter>().All(f=>f.GetComponent<MeshCollider>()!=null&&f.GetComponent<MeshCollider>().sharedMesh==f.sharedMesh),"Collision is not derived from the visible mesh.");
            });
            if(author!=null&&author.Read()!=null)
            {
                Case(report,"invalid edit retains last valid candidate then cancel restores committed",()=>
                {
                    var session=ReplicaSession.Get(author);string committed=author.DocumentJson,committedMesh=Mesh(author);var changed=author.Read();changed.Nodes[11].X+=.04f;
                    Need(session.Preview(changed,kit),session.Status);var preview=author.transform.Find("__RoutePreview");string valid=JsonUtility.ToJson(session.Candidate.Document),previewMesh=ReplicaGeometry.Fingerprint(preview.gameObject);
                    var invalid=changed.Clone();invalid.Nodes.Clear();Need(!session.Preview(invalid,kit),"Empty graph accepted.");
                    Need(session.HasCandidate&&author.transform.Find("__RoutePreview")==preview&&JsonUtility.ToJson(session.Candidate.Document)==valid&&ReplicaGeometry.Fingerprint(preview.gameObject)==previewMesh,"Rejected edit lost valid preview.");
                    session.Cancel();Need(author.DocumentJson==committed&&Mesh(author)==committedMesh&&session.Geometry.activeSelf,"Cancel changed committed author or mesh.");
                });
                Case(report,"local curve edit is one native Undo and Redo",()=>
                {
                    var session=ReplicaSession.Get(author);string before=author.DocumentJson,beforeMesh=Mesh(author);var changed=author.Read();changed.Nodes[11].X+=.04f;changed.Nodes[11].Z+=.03f;
                    Undo.ClearAll();Need(session.Preview(changed,kit)&&session.Apply(),session.Status);string after=author.DocumentJson,afterMesh=Mesh(author);Need(beforeMesh!=afterMesh,"Local curve edit leaves actual mesh unchanged.");
                    Undo.FlushUndoRecordObjects();Undo.PerformUndo();Need(author.DocumentJson==before&&Mesh(author)==beforeMesh,"One Undo does not restore complete curve authority and geometry.");
                    Undo.PerformRedo();Need(author.DocumentJson==after&&Mesh(author)==afterMesh,"One Redo does not restore edited curve and geometry.");Undo.PerformUndo();
                });
                Case(report,"versioned author roundtrip and legacy overwrite protection",()=>
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(AuthorFile));ReplicaFiles.SaveAuthor(author,AuthorFile);var file=JsonUtility.FromJson<ReplicaFile>(File.ReadAllText(AuthorFile));
                    Need(file.schemaVersion==2&&file.kind=="editable-freehand-bridge-route"&&file.route.SchemaVersion==2,"Freehand save is labeled as legacy orthogonal data.");
                    string old=Path.Combine(Output,"samples/curve-legacy-protected.bridge-route.json");ReplicaFiles.SaveAuthor(legacy,old);string bytes=File.ReadAllText(old);bool refused=false;
                    try{ReplicaFiles.SaveAuthor(author,old);}catch(InvalidOperationException){refused=true;}Need(refused&&File.ReadAllText(old)==bytes,"Freehand save silently overwrote legacy file.");
                    var restored=new GameObject("restored-author-file").AddComponent<ReplicaAuthor>();try{ReplicaFiles.LoadAuthor(restored,AuthorFile);Need(restored.DocumentJson==author.DocumentJson&&Mesh(restored)==Mesh(author),"Author JSON roundtrip loses precise control points, revision, kit or geometry.");}
                    finally{ReplicaGeometry.Destroy(restored.gameObject);}
                    string malformed=Path.Combine(Output,"samples/curve-malformed.bridge-route.json");File.WriteAllText(malformed,"{\"schemaVersion\":2,\"kind\":\"editable-freehand-bridge-route\",\"route\":null}");string current=author.DocumentJson,mesh=Mesh(author);bool invalid=false;try{ReplicaFiles.LoadAuthor(author,malformed);}catch(InvalidDataException){invalid=true;}Need(invalid&&author.DocumentJson==current&&Mesh(author)==mesh,"Invalid load changed existing work.");
                });
                Case(report,"native scene keeps persistent mesh arrays and legacy author unchanged",()=>
                {
                    expected=new Expected{document=author.DocumentJson,mesh=Mesh(author),mapping=Hash(author.MappingJson),legacyDocument=legacy.DocumentJson,legacyMesh=Mesh(legacy),nodes=author.Read().Nodes.Count};
                    ReplicaFiles.SaveScene(ScenePath);Need(author.GetComponentsInChildren<MeshFilter>().All(f=>AssetDatabase.Contains(f.sharedMesh)),"Native scene references transient freehand geometry.");
                    Need(legacy.DocumentJson==expected.legacyDocument&&Mesh(legacy)==expected.legacyMesh,"Saving freehand data changed the existing v1 bridge.");
                    Need(!AssetDatabase.GetDependencies(ScenePath,true).Any(p=>p.Contains("/ResearchPrivate/")),"Public original sample depends on private research assets.");
                    Directory.CreateDirectory(Reports);File.WriteAllText(Path.Combine(Reports,"v02-native-curve-expected.json"),JsonUtility.ToJson(expected,true));
                });
            }
            Finish(report,"v02-curve-lifecycle");
        }
        public static void Reopen()
        {
            Need(Application.isBatchMode,"Use the temporary background QA Editor.");var report=new Report{date=DateTimeOffset.Now.ToString("o")};
            Case(report,"separate process opens actual persisted geometry before regeneration",()=>
            {
                var expected=JsonUtility.FromJson<Expected>(File.ReadAllText(Path.Combine(Reports,"v02-native-curve-expected.json")));EditorSceneManager.OpenScene(ScenePath);
                var authors=UnityEngine.Object.FindObjectsOfType<ReplicaAuthor>();var author=authors.Single(a=>a.name=="Freehand_v2_U");var legacy=authors.Single(a=>a.name=="Legacy_v1_preserved");
                Need(author.DocumentJson==expected.document&&author.Read().Nodes.Count==expected.nodes&&Hash(author.MappingJson)==expected.mapping,"Reopen changed author control points, version or provenance.");
                Need(author.GetComponentsInChildren<MeshFilter>().All(f=>AssetDatabase.Contains(f.sharedMesh))&&Mesh(author)==expected.mesh,"Reopen lacks exact serialized mesh arrays before rebuild.");
                Need(legacy.DocumentJson==expected.legacyDocument&&Mesh(legacy)==expected.legacyMesh,"Native reopen changed old v1 geometry.");
                var session=ReplicaSession.Get(author);var changed=author.Read();changed.Nodes[12].X+=.04f;Undo.ClearAll();Need(session.Preview(changed,author.Kit)&&session.Apply(),session.Status);Need(Mesh(author)!=expected.mesh,"Reopened curve cannot be edited.");
                Undo.FlushUndoRecordObjects();Undo.PerformUndo();Need(author.DocumentJson==expected.document&&Mesh(author)==expected.mesh,"Reopened curve Undo does not restore exact editable author and mesh.");
            });Finish(report,"v02-curve-reopen");
        }
    }
}
