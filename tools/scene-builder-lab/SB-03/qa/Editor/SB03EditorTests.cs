using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Threading;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01;
using XingHai.LE01.Core;
using XingHai.LE01.Editor;

namespace XingHai.SB03.QA
{
    // Reflection lets the initial red test compile before the SB03 production types exist.
    // All behavioral checks exercise the actual author, meshes, native Undo and colliders.
    public static class SB03EditorTests
    {
        [Serializable] sealed class Check {public string name,status="PASS",detail;}
        [Serializable] sealed class Report
        {
            public string status="PASS",engine=Application.unityVersion;
            public string scope="Real Unity author/session, MeshCollider, native Undo and independent A source. No desktop or physical-input claim.";
            public List<Check> checks=new List<Check>();
        }
        static Report report;
        static string Root {get{return Environment.GetEnvironmentVariable("SB03_REPORT_ROOT")??Path.GetFullPath("SB03-reports");}}
        static Type Find(string name){return AppDomain.CurrentDomain.GetAssemblies().SelectMany(a=>{try{return a.GetTypes();}catch(ReflectionTypeLoadException e){return e.Types.Where(t=>t!=null).ToArray();}}).FirstOrDefault(t=>t.Name==name);}
        static void Need(bool value,string detail){if(!value)throw new InvalidOperationException(detail);}
        static object Read(object target,string name)
        {
            Need(target!=null,"Missing object while reading "+name);var type=target.GetType();var f=type.GetField(name,BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic);if(f!=null)return f.GetValue(target);
            var p=type.GetProperty(name,BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic);Need(p!=null,type.Name+" must expose "+name);return p.GetValue(target,null);
        }
        static void Write(object target,string name,object value)
        {
            var type=target.GetType();var f=type.GetField(name,BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic);if(f!=null){f.SetValue(target,Convert.ChangeType(value,f.FieldType));return;}
            var p=type.GetProperty(name,BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic);Need(p!=null&&p.CanWrite,type.Name+" must allow "+name);p.SetValue(target,Convert.ChangeType(value,p.PropertyType),null);
        }
        static object Call(object target,string method,params object[] args)
        {
            var candidates=target.GetType().GetMethods(BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Instance).Where(m=>m.Name==method&&m.GetParameters().Length==args.Length).ToArray();
            Need(candidates.Length==1,"Expected unambiguous "+target.GetType().Name+"."+method+" with "+args.Length+" args");try{return candidates[0].Invoke(target,args);}catch(TargetInvocationException e){throw e.InnerException??e;}
        }
        static float Number(object value,string name){return Convert.ToSingle(Read(value,name));}
        static string Json(object value){return JsonUtility.ToJson(value);}
        static object Clone(object value){return JsonUtility.FromJson(Json(value),value.GetType());}
        static void RequireAPI()
        {
            Need(Find("BridgeSpec")!=null,"SB03 BridgeSpec is missing: no B bridge editor implemented yet.");
            Need(Find("SB03BridgeAuthor")!=null,"SB03BridgeAuthor is missing: no editable B bridge author exists.");
            Need(Find("SB03BridgeSession")!=null,"SB03BridgeSession is missing: bridge candidate/commit lifecycle absent.");
        }
        sealed class Fixture {public Component Author;public object Session;public GameObject Root;}
        static Fixture NewBridge()
        {
            RequireAPI();EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);var root=new GameObject("SB03_QA_Bridge");var author=root.AddComponent(Find("SB03BridgeAuthor"));
            var get=Find("SB03BridgeSession").GetMethods(BindingFlags.Public|BindingFlags.Static).Single(m=>m.Name=="Get"&&m.GetParameters().Length==1);var session=get.Invoke(null,new object[]{author});
            var spec=Activator.CreateInstance(Find("BridgeSpec"));Need((bool)Call(session,"Preview",spec),"Default bridge candidate must be valid.");Need((bool)Call(session,"Apply"),"Default bridge candidate must commit.");
            Need(root.GetComponentsInChildren<MeshFilter>().Any(f=>f.sharedMesh!=null&&f.sharedMesh.vertexCount>0),"Committed bridge uses actual generated display meshes.");
            Undo.FlushUndoRecordObjects();Undo.ClearAll();return new Fixture{Author=author,Session=session,Root=root};
        }
        public static string MeshHash(GameObject root)
        {
            using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream)){
                foreach(var f in root.GetComponentsInChildren<MeshFilter>(true).Where(f=>f.sharedMesh!=null).OrderBy(f=>f.name,StringComparer.Ordinal)){
                    writer.Write(f.name);var mesh=f.sharedMesh;writer.Write(mesh.vertexCount);foreach(var p in mesh.vertices){writer.Write(p.x);writer.Write(p.y);writer.Write(p.z);}foreach(var n in mesh.normals){writer.Write(n.x);writer.Write(n.y);writer.Write(n.z);}foreach(var uv in mesh.uv){writer.Write(uv.x);writer.Write(uv.y);}foreach(var t in mesh.triangles)writer.Write(t);
                }writer.Flush();using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(stream.ToArray())).Replace("-","");
            }
        }
        static void PreviewCancel()
        {
            var f=NewBridge();string source=Json(Read(f.Author,"Spec")),mesh=MeshHash(f.Root);var candidate=Clone(Read(f.Author,"Spec"));Write(candidate,"Length",Number(candidate,"Length")+2);
            Need((bool)Call(f.Session,"Preview",candidate),"Legal length candidate accepted.");Need(Json(Read(f.Author,"Spec"))==source,"Preview leaves committed author unchanged.");Need(MeshHash(f.Root)!=mesh,"Preview changes the actual visible bridge geometry.");
            Call(f.Session,"Cancel");Need(Json(Read(f.Author,"Spec"))==source&&MeshHash(f.Root)==mesh,"Cancel restores exact committed author and geometry.");
        }
        static void CommitUndoRedo()
        {
            var f=NewBridge();string source=Json(Read(f.Author,"Spec")),mesh=MeshHash(f.Root);var candidate=Clone(Read(f.Author,"Spec"));Write(candidate,"Width",Number(candidate,"Width")+.5f);
            Need((bool)Call(f.Session,"Preview",candidate)&&(bool)Call(f.Session,"Apply"),"Width edit commits as one transaction.");Undo.FlushUndoRecordObjects();string changed=Json(Read(f.Author,"Spec")),changedMesh=MeshHash(f.Root);Need(changed!=source&&changedMesh!=mesh,"Commit changes author and matching visible mesh.");
            Undo.PerformUndo();Need(Json(Read(f.Author,"Spec"))==source,"One native Undo restores the previous author.");Need(MeshHash(f.Root)==mesh,"One native Undo restores exact geometry.");
            Undo.PerformRedo();Need(Json(Read(f.Author,"Spec"))==changed&&MeshHash(f.Root)==changedMesh,"One native Redo restores committed author and geometry.");
        }
        static void InvalidCandidatePreserves()
        {
            var f=NewBridge();string source=Json(Read(f.Author,"Spec")),mesh=MeshHash(f.Root);var candidate=Clone(Read(f.Author,"Spec"));Write(candidate,"DeckHeight",.5f);Write(candidate,"ArchHeight",2);
            Need(!(bool)Call(f.Session,"Preview",candidate),"An arch taller than its bridge is rejected.");Need(Json(Read(f.Author,"Spec"))==source&&MeshHash(f.Root)==mesh,"Rejected candidate preserves previous author and actual mesh.");
            Need(!(bool)Call(f.Session,"Apply"),"An invalid candidate cannot be applied.");Need(Json(Read(f.Author,"Spec"))==source&&MeshHash(f.Root)==mesh,"Invalid Apply leaves previous bridge intact.");
        }
        static void SourceProvenance()
        {
            var f=NewBridge();var plan=Read(f.Session,"LastPlan");var parts=((IEnumerable)Read(plan,"Parts")).Cast<object>().ToArray();Need(parts.Length>20,"Bridge has actual repeated construction parts.");
            Need(parts.Select(p=>(string)Read(p,"Id")).Distinct().Count()==parts.Length,"Generated parts have unique stable identities.");
            foreach(var part in parts){Need(!string.IsNullOrEmpty((string)Read(part,"SourceId")),"Every source part identifies its original asset.");Need(!string.IsNullOrEmpty((string)Read(part,"Role")),"Every source part identifies its structural role.");}
            var ids=parts.Select(p=>(string)Read(p,"SourceId")).Distinct().ToArray();Need(ids.Contains("sb03.tread")&&ids.Contains("sb03.deck")&&ids.Contains("sb03.rail"),"Source map includes actual stairs, deck and railing sources.");
            var sources=AssetDatabase.FindAssets("t:Model",new[]{"Assets/SB03"});Need(sources.Length>=9,"At least the nine original source models are actually imported into Unity.");
            string map=(string)Read(f.Author,"SourceMapJson");Need(!string.IsNullOrEmpty(map)&&ids.All(id=>map.Contains(id)),"Committed author persists the generated-to-source map, not just a transient solver list.");
        }
        static void ActualColliderVoid()
        {
            var f=NewBridge();var plan=Read(f.Session,"LastPlan");var spec=Read(f.Author,"Spec");float x=(Number(plan,"OpeningMinX")+Number(plan,"OpeningMaxX"))*.5f,width=Number(spec,"Width"),crown=Number(plan,"OpeningCrown");Need(crown>.25f,"Protected opening has a usable positive crown.");Physics.SyncTransforms();
            var colliders=f.Root.GetComponentsInChildren<Collider>();Need(colliders.Length>0,"Bridge owns actual physics colliders.");
            foreach(float factor in new[]{.25f,.5f,.75f}){
                var across=new Ray(f.Root.transform.TransformPoint(new Vector3(x,crown*factor,-width*.5f-2)),f.Root.transform.TransformDirection(Vector3.forward));
                Need(!colliders.Any(c=>{RaycastHit hit;return c.enabled&&c.Raycast(across,out hit,width+4);}),"Underpass is empty across full bridge width at crown factor "+factor);
            }
            var down=new Ray(f.Root.transform.TransformPoint(new Vector3(x,Number(spec,"DeckHeight")+3,0)),f.Root.transform.TransformDirection(Vector3.down));
            Need(colliders.Any(c=>{RaycastHit hit;return c.enabled&&c.Raycast(down,out hit,4);}),"Bridge deck above the protected void has a real walkable collision surface.");
        }
        static void UnrelatedAAndManual()
        {
            var f=NewBridge();var doc=TerrainGenerators.UpgradeToV3(new TerrainDocument{Id="SB03_A_Readonly",BaseHeight=-16,ActiveQuantum=4});var command=new TerrainCommand{Mode=BrushMode.Extend,Radius=1,Quantum=4,PlaneHeight=0};command.Path.Add(new Point2(12,0));doc=TerrainKernel.Apply(doc,command).Document;
            var a=new GameObject("A_BasicTerrain_ReadOnly").AddComponent<LE01TerrainAuthor>();a.Write(doc);var state=a.gameObject.AddComponent<LE04TerrainState>();state.Write(new TerrainEditState());var terrain=LE04TerrainSession.Get(a);var timer=System.Diagnostics.Stopwatch.StartNew();while(!terrain.Ready||terrain.Busy){terrain.Tick();Thread.Sleep(1);Need(timer.ElapsedMilliseconds<20000,"A fixture preparation timed out.");}
            var manual=GameObject.CreatePrimitive(PrimitiveType.Cube);manual.name="IndependentManual";manual.transform.position=new Vector3(20,1,2);string aJson=a.DocumentJson,editJson=state.EditJson,aMesh=MeshHash(a.gameObject),manualMesh=MeshHash(manual);var matrix=manual.transform.localToWorldMatrix;
            var candidate=Clone(Read(f.Author,"Spec"));Write(candidate,"Length",Number(candidate,"Length")+2);Need((bool)Call(f.Session,"Preview",candidate)&&(bool)Call(f.Session,"Apply"),"B edit commits beside A and Manual objects.");
            Need(a.DocumentJson==aJson&&state.EditJson==editJson&&MeshHash(a.gameObject)==aMesh,"B edit leaves real A author, effective state and actual mesh unchanged.");
            Need(manual.transform.parent==null&&manual.transform.localToWorldMatrix==matrix&&MeshHash(manual)==manualMesh,"B edit preserves independent Manual root, transform and mesh.");LE04TerrainSession.Forget(a);
        }
        static void Case(string name,Action body){var check=new Check{name=name};try{body();}catch(Exception e){check.status="FAIL";check.detail=e.GetBaseException().ToString();report.status="FAIL";}report.checks.Add(check);Debug.Log("SB03_CHECK "+name+" "+check.status+" "+check.detail);}
        static void Save(string name){Directory.CreateDirectory(Root);File.WriteAllText(Path.Combine(Root,name),JsonUtility.ToJson(report,true));}
        public static void RunRed()
        {
            Need(Application.isBatchMode,"SB03 tests run only in an isolated batch QA project.");report=new Report();Case("editable-purpose-specific-bridge-api-exists",RequireAPI);Save("editor-initial-red.json");if(report.status!="PASS")throw new InvalidOperationException("Expected initial red: dedicated B bridge feature missing.");
        }
        public static void Run()
        {
            Need(Application.isBatchMode,"SB03 tests run only in an isolated batch QA project.");report=new Report();Case("candidate-cancel-exact-restoration",PreviewCancel);Case("one-native-undo-redo-restores-whole-bridge",CommitUndoRedo);Case("invalid-candidate-preserves-previous-bridge",InvalidCandidatePreserves);Case("real-imported-kit-and-persistent-source-map",SourceProvenance);Case("actual-underpass-collision-clearance",ActualColliderVoid);Case("A-and-independent-manual-object-unchanged",UnrelatedAAndManual);Save("editor-integration.json");if(report.status!="PASS")throw new InvalidOperationException("SB03 editor integration failed; inspect editor-integration.json.");
        }
    }
}
