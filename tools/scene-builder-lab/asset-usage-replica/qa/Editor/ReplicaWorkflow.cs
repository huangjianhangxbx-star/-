using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using XingHai.BridgeReplica.Editor;
using XingHai.SB03;
using XingHai.SB03.Editor;
namespace XingHai.BridgeReplica.QA
{
    public static class ReplicaWorkflow
    {
        const string Scene="Assets/BridgeReplica/Scenes/RouteWorkflow.unity",Prefab="Assets/BridgeReplica/Baked/RouteWorkflow.prefab";
        const string BScene="Assets/BridgeReplica/Scenes/RouteWorkflowB.unity",BPrefab="Assets/BridgeReplica/Baked/RouteWorkflowB.prefab";
        [Serializable] sealed class Check {public string name,status="PASS",error;}
        [Serializable] sealed class Shot {public string name,image,route,mesh;public int nodes,parts,cores,chunks,triangles;}
        [Serializable] sealed class Report
        {
            public string status="PASS",engine=Application.unityVersion,sourceHash;
            public string scope="Actual production route author, original FBX meshes, URP renders, native Undo and persistent assets in isolated background Engine. Original-game controlled replacement and physical desktop input are separate, not certified here.";
            public List<Check> checks=new List<Check>();public List<Shot> shots=new List<Shot>();
            public string frozenBefore,frozenAfter,familySpecBefore,familySpecAfter,kitA,kitB;public string[] changedGeometryRoles;
            public bool cleanSceneHasNoLegacyFixture;
            public string sampleScene;public string[] sampleDependencies;
        }
        [Serializable] sealed class Expected
        {public string document,mesh,mappingHash,kitPath,kitFingerprint,sourceHash,scene,prefab,file;public Vector3 position;public Quaternion rotation;}
        static Report report;static ReplicaAuthor author;static Camera camera;static SB03BridgeAuthor legacy;static GameObject manual;
        static string legacySpec,legacyMesh,manualMesh;static Matrix4x4 manualTransform;
        static string Output {get{return Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required.");}}
        static string Reports {get{return Path.Combine(Output,"reports");}}
        static ReplicaSession Session {get{return ReplicaSession.Get(author);}}
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException(message);Debug.Log("REPLICA_CHECK "+message);}
        static string TextHash(string value){return ReplicaKitRegistry.Hash(Encoding.UTF8.GetBytes(value));}
        static string SourceHash()
        {return TextHash(string.Join("\n",Directory.GetFiles(Path.Combine(Application.dataPath,"BridgeReplica"),"*.cs",SearchOption.AllDirectories).Where(p=>!p.Replace('\\','/').Contains("/QA/")).OrderBy(p=>p,StringComparer.Ordinal).Select(File.ReadAllText).ToArray()));}
        static void Write(string name,object value){Directory.CreateDirectory(Reports);File.WriteAllText(Path.Combine(Reports,name),JsonUtility.ToJson(value,true));}
        static void Begin(){Need(Application.isBatchMode,"Tests run only in the isolated background Engine.");ShaderUtil.allowAsyncCompilation=false;report=new Report{sourceHash=SourceHash()};Directory.CreateDirectory(Path.Combine(Output,"samples/screenshots"));}
        static void Case(string name,Action action){var c=new Check{name=name};try{action();}catch(Exception e){c.status="FAIL";c.error=e.GetBaseException().ToString();report.status="FAIL";}report.checks.Add(c);Debug.Log("REPLICA_CASE "+name+" "+c.status+" "+c.error);}
        static void Commit(RouteDocument d,ReplicaKit kit=null){Need(Session.Preview(d,kit??author.Kit),"Candidate accepted: "+Session.Status);Need(Session.Apply(),"Whole route commits: "+Session.Status);Physics.SyncTransforms();}
        static void Setup()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.49f,.53f,.56f);RenderSettings.skybox=null;
            var light=new GameObject("QA_Light").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.15f;light.transform.rotation=Quaternion.Euler(43,-30,0);light.shadows=LightShadows.Soft;
            ReplicaKitRegistry.Folder("Assets/BridgeReplica/Materials");const string groundPath="Assets/BridgeReplica/Materials/QAGround.mat";var mat=AssetDatabase.LoadAssetAtPath<Material>(groundPath);
            if(mat==null){mat=new Material(Shader.Find("Universal Render Pipeline/Lit"));mat.SetColor("_BaseColor",new Color(.30f,.38f,.33f));mat.SetFloat("_Smoothness",0);AssetDatabase.CreateAsset(mat,groundPath);}
            var ground=GameObject.CreatePrimitive(PrimitiveType.Cube);ground.name="QA_IndependentGround";ground.transform.position=new Vector3(7,-.2f,4);ground.transform.localScale=new Vector3(24,.25f,22);ground.GetComponent<MeshRenderer>().sharedMaterial=mat;
            camera=new GameObject("QA_Camera").AddComponent<Camera>();camera.orthographic=true;camera.orthographicSize=11;camera.aspect=1440f/900;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.55f,.65f,.69f);camera.allowHDR=false;camera.allowMSAA=false;camera.nearClipPlane=.1f;camera.farClipPlane=120;camera.transform.position=new Vector3(7,1,4)+new Vector3(17,17,-22);camera.transform.LookAt(new Vector3(7,1,4));
            author=new GameObject("可编辑折线桥").AddComponent<ReplicaAuthor>();author.Kit=ReplicaKitRegistry.EnsureBase();Commit(RouteExamples.Straight());
            OwnershipFixtures();
        }
        static void OwnershipFixtures()
        {
            // Disposable validation objects are deliberately outside the fixed
            // comparison camera. They are never part of the delivered sample.
            legacy=new GameObject("Legacy_SB03_Readonly").AddComponent<SB03BridgeAuthor>();legacy.transform.position=new Vector3(100,0,100);var old=SB03BridgeSession.Get(legacy);Need(old.Preview(new BridgeSpec{Id="old-preserved"})&&old.Apply(),"Old SB03 author still generates via its existing entry.");legacySpec=JsonUtility.ToJson(legacy.Spec);legacyMesh=ReplicaGeometry.Fingerprint(legacy.gameObject);
            manual=GameObject.CreatePrimitive(PrimitiveType.Cube);manual.name="IndependentManual";manual.transform.position=new Vector3(100,0,110);manualMesh=ReplicaGeometry.Fingerprint(manual);manualTransform=manual.transform.localToWorldMatrix;Undo.ClearAll();
        }
        static void Capture(string name)
        {
            string relative="samples/screenshots/"+name+".png";var target=new RenderTexture(1440,900,24){antiAliasing=1};var image=new Texture2D(1440,900,TextureFormat.RGB24,false);var old=RenderTexture.active;
            try{camera.targetTexture=target;camera.Render();camera.Render();RenderTexture.active=target;image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();File.WriteAllBytes(Path.Combine(Output,relative),image.EncodeToPNG());}
            finally{camera.targetTexture=null;RenderTexture.active=old;UnityEngine.Object.DestroyImmediate(image);UnityEngine.Object.DestroyImmediate(target);}
            var filters=Session.Geometry.GetComponentsInChildren<MeshFilter>();report.shots.Add(new Shot{name=name,image=relative,route=author.DocumentJson,mesh=ReplicaGeometry.Fingerprint(Session.Geometry),nodes=author.Read().Nodes.Count,parts=Session.Committed.Plan.Parts.Count,cores=Session.Committed.Plan.Solids.Count,chunks=filters.Length,triangles=filters.Sum(f=>f.sharedMesh.triangles.Length/3)});
        }
        static void SameEndpoints()
        {
            var straight=author.Read();string old=ReplicaGeometry.Fingerprint(Session.Geometry);Capture("01-A-straight");Commit(RouteExamples.Detour());var detour=author.Read();Capture("02-A-detour");
            Need(straight.Nodes[0].X==detour.Nodes[0].X&&straight.Nodes[0].Z==detour.Nodes[0].Z&&straight.Nodes.Last().X==detour.Nodes.Last().X&&straight.Nodes.Last().Z==detour.Nodes.Last().Z,"Straight and detour retain identical endpoints.");
            Need(detour.Nodes.Count>straight.Nodes.Count&&detour.Nodes.Any(n=>n.Z==8),"Committed author keeps the real middle route, not just endpoint length.");Need(ReplicaGeometry.Fingerprint(Session.Geometry)!=old,"Same endpoints with different middle route produces different actual mesh.");
        }
        static void MappingRevision()
        {var mapping=JsonUtility.FromJson<ReplicaMapping>(author.MappingJson);Need(mapping.route.Revision==author.Read().Revision,"Persistent source mapping uses the same committed route revision.");Need(mapping.kitFingerprint==author.Kit.ContentHash&&mapping.sources.Length==9,"Mapping identifies the actual selected source version.");}
        static void EditLifecycle()
        {
            var doc=author.Read();string json=author.DocumentJson,mesh=ReplicaGeometry.Fingerprint(Session.Geometry);var moved=RouteEdits.OffsetLeg(doc,2,2);
            Need(Session.Preview(moved,author.Kit),"Middle-leg candidate accepted.");Need(author.DocumentJson==json,"Candidate does not mutate committed route.");Need(ReplicaGeometry.Fingerprint(author.gameObject)!=mesh,"Candidate has visible real geometry.");Session.Cancel();Need(author.DocumentJson==json&&ReplicaGeometry.Fingerprint(Session.Geometry)==mesh,"Cancel restores exact route and actual mesh.");
            Commit(moved);Capture("03-A-middle-moved");Undo.FlushUndoRecordObjects();string changed=author.DocumentJson,changedMesh=ReplicaGeometry.Fingerprint(Session.Geometry);Undo.PerformUndo();Need(author.DocumentJson==json&&ReplicaGeometry.Fingerprint(Session.Geometry)==mesh,"One native Undo restores route and exact mesh.");Undo.PerformRedo();Need(author.DocumentJson==changed&&ReplicaGeometry.Fingerprint(Session.Geometry)==changedMesh,"One native Redo restores route and exact mesh.");
            Commit(RouteExamples.Detour());Commit(RouteEdits.SetNodeHeight(author.Read(),4,1.75f));Capture("04-A-local-height");Need(author.Read().Nodes[4].Y==1.75f,"Local node elevation survives commit.");
            Commit(RouteExamples.Detour());string baseMesh=ReplicaGeometry.Fingerprint(Session.Geometry);Commit(RouteEdits.Append(author.Read(),14,0,-6));Need(author.Read().Nodes.Count==7,"Continuation stores a new stable node and segment.");Commit(RouteEdits.RemoveLastSegment(author.Read()));Need(author.Read().Nodes.Count==6&&ReplicaGeometry.Fingerprint(Session.Geometry)==baseMesh,"Deleting last segment removes obsolete end pieces and restores surviving arrangement.");
            string before=author.DocumentJson,beforeMesh=ReplicaGeometry.Fingerprint(Session.Geometry);var bad=author.Read();bad.Nodes[2].Y=2.25f;Need(!Session.Preview(bad,author.Kit),"Sloped protected opening rejected with a concrete constraint.");Need(!Session.Apply()&&author.DocumentJson==before&&ReplicaGeometry.Fingerprint(Session.Geometry)==beforeMesh,"Invalid candidate cannot alter the previous route or geometry.");
        }
        static void Opening(GameObject root,RouteDocument doc)
        {
            var result=RouteSolver.Solve(doc);Need(result.Valid,result.Message);var segments=result.Segments.Where(s=>s.HasOpening).ToArray();Need(segments.Length>0,"Fixture retains a legal protected opening.");var colliders=root.GetComponentsInChildren<Collider>();Physics.SyncTransforms();
            foreach(var s in segments)
            {
                float d=(s.OpeningStart+s.OpeningEnd)*.5f;foreach(float y in new[]{.25f,.5f,1f})if(y<s.OpeningCrown)
                {
                    var point=new Vector3(s.StartX+d*s.DirX+(doc.Width/2+2)*s.DirZ,y,s.StartZ+d*s.DirZ-(doc.Width/2+2)*s.DirX);var direction=new Vector3(-s.DirZ,0,s.DirX);
                    var ray=new Ray(root.transform.TransformPoint(point),root.transform.TransformDirection(direction));Need(!colliders.Any(c=>{RaycastHit hit;return c.enabled&&c.Raycast(ray,out hit,doc.Width+4);}),"Protected portal has actual full-width collider clearance at "+y+"m.");
                }
                var above=root.transform.TransformPoint(new Vector3(s.StartX+d*s.DirX,s.StartHeight+3,s.StartZ+d*s.DirZ));Need(colliders.Any(c=>{RaycastHit h;return c.enabled&&c.Raycast(new Ray(above,root.transform.TransformDirection(Vector3.down)),out h,4);}),"Deck above opening has actual walkable collision.");
            }
        }
        static void OtherOwners()
        {
            Need(JsonUtility.ToJson(legacy.Spec)==legacySpec&&ReplicaGeometry.Fingerprint(legacy.gameObject)==legacyMesh,"New route edits preserve old SB03 author and actual geometry.");Need(manual.transform.localToWorldMatrix==manualTransform&&manual.transform.parent==null&&ReplicaGeometry.Fingerprint(manual)==manualMesh,"New route edits preserve independent object identity, transform and mesh.");
        }
        static void RemoveDisposableFixtures()
        {
            if(legacy!=null||manual!=null)
            {
                Need(legacy!=null&&manual!=null,"Both ownership fixtures exist before cleanup.");OtherOwners();
                // These are objects made by OwnershipFixtures in this isolated
                // test scene, never user objects or source assets.
                ReplicaGeometry.Destroy(legacy.gameObject);UnityEngine.Object.DestroyImmediate(manual);legacy=null;manual=null;
            }
        }
        static void CleanSample(string scenePath)
        {
            var scene=SceneManager.GetActiveScene();var roots=scene.GetRootGameObjects();
            report.cleanSceneHasNoLegacyFixture=!roots.Any(g=>g.name=="Legacy_SB03_Readonly"||g.name=="IndependentManual"||g.GetComponentInChildren<SB03BridgeAuthor>(true)!=null);
            Need(report.cleanSceneHasNoLegacyFixture,"Delivered sample contains no legacy or Manual validation fixture.");
            Need(roots.SelectMany(g=>g.GetComponentsInChildren<ReplicaAuthor>(true)).Count()==1,"Delivered sample contains exactly one editable route author.");
            var dependencies=AssetDatabase.GetDependencies(scenePath,true).OrderBy(p=>p,StringComparer.Ordinal).ToArray();
            var unsupported=dependencies.Where(p=>p.StartsWith("Assets/",StringComparison.Ordinal)&&!p.StartsWith("Assets/BridgeReplica/",StringComparison.Ordinal)&&!p.StartsWith("Assets/LE01/Rendering/",StringComparison.Ordinal)&&!(p.StartsWith("Assets/SB03/",StringComparison.Ordinal)&&p.EndsWith(".cs",StringComparison.OrdinalIgnoreCase))).ToArray();
            Need(unsupported.Length==0,"Sample dependencies use only BridgeReplica assets, rendering settings and declared code; no legacy test meshes: "+string.Join(",",unsupported));
            report.sampleScene=scenePath;report.sampleDependencies=dependencies;
        }
        static void EntryPorts(GameObject geometry,RouteDocument doc)
        {
            var colliders=geometry.GetComponentsInChildren<Collider>();Physics.SyncTransforms();
            foreach(int endpoint in new[]{0,doc.Nodes.Count-1})
            {
                var n=doc.Nodes[endpoint];var next=doc.Nodes[endpoint==0?1:doc.Nodes.Count-2];var inward=new Vector3(next.X-n.X,0,next.Z-n.Z).normalized;var across=new Vector3(-inward.z,0,inward.x);
                foreach(float offset in new[]{-doc.Width*.25f,0,doc.Width*.25f})
                {
                    var start=new Vector3(n.X,n.Y+.75f,n.Z)+across*offset-inward*.25f;var ray=new Ray(geometry.transform.TransformPoint(start),geometry.transform.TransformDirection(inward));
                    Need(!colliders.Any(c=>{RaycastHit hit;return c.enabled&&c.Raycast(ray,out hit,.5f);}),"Walking entry port "+endpoint+" is not blocked by a guard or pole at lateral "+offset+"m.");
                }
            }
        }
        static Expected Persist(string scene,string prefab,string file,string expectedName)
        {
            var doc=author.Read();string mesh=ReplicaGeometry.Fingerprint(Session.Geometry);Opening(Session.Geometry,doc);EntryPorts(Session.Geometry,doc);ReplicaFiles.SaveAuthor(author,Path.Combine(Output,file));
            var baked=ReplicaFiles.Bake(author,prefab);Need(baked.GetComponentsInChildren<MonoBehaviour>(true).Length==0,"Bake has no procedural author or metadata scripts.");Need(ReplicaGeometry.Fingerprint(baked)==mesh&&ReplicaGeometry.Fingerprint(Session.Geometry)==mesh,"Independent bake preserves exact geometry and editable source meshes.");Opening(baked,doc);UnityEngine.Object.DestroyImmediate(baked);
            RemoveDisposableFixtures();
            ReplicaFiles.SaveScene(scene);Need(Session.Geometry.GetComponentsInChildren<MeshFilter>().All(f=>AssetDatabase.Contains(f.sharedMesh)),"Native route scene references persistent actual meshes.");CleanSample(scene);
            var expected=new Expected{document=author.DocumentJson,mesh=mesh,mappingHash=TextHash(author.MappingJson),kitPath=AssetDatabase.GetAssetPath(author.Kit),kitFingerprint=author.Kit.ContentHash,sourceHash=SourceHash(),scene=scene,prefab=prefab,file=file,position=author.transform.position,rotation=author.transform.rotation};Write(expectedName,expected);
            var restored=new GameObject("QA_RestoredRoute").AddComponent<ReplicaAuthor>();ReplicaFiles.LoadAuthor(restored,Path.Combine(Output,file));Need(restored.DocumentJson==expected.document&&ReplicaGeometry.Fingerprint(restored.gameObject)==mesh,"Complete route file restores actual editable middle nodes and exact geometry.");Need(restored.Kit.ContentHash==expected.kitFingerprint,"Route file preserves exact source kit version.");Need(ReplicaSession.Get(restored).Committed.Document.Revision==restored.Read().Revision,"Loaded session projection and authoritative route agree on restored revision.");ReplicaGeometry.Destroy(restored.gameObject);return expected;
        }
        public static void A()
        {
            Begin();Case("prepare-original-source-kit-A",Setup);
            if(author!=null&&Session.Geometry!=null)
            {
                Case("same-endpoints-different-middle-actual-structure",SameEndpoints);Case("actual-walking-start-end-ports",()=>EntryPorts(Session.Geometry,author.Read()));Case("committed-source-map-revision",MappingRevision);Case("local-route-edit-cancel-undo-append-delete",EditLifecycle);Case("legacy-and-independent-ownership",OtherOwners);
                Case("complete-route-file-native-save-and-independent-bake",()=>Persist(Scene,Prefab,"samples/route-A.bridge-route.json","route-A-expected.json"));
            }
            report.kitA=author==null||author.Kit==null?null:author.Kit.ContentHash;Write("workflow-A.json",report);if(report.status!="PASS")throw new InvalidOperationException("Route A checks failed; inspect workflow-A.json.");
        }
        static void OpenExpected(string reportName)
        {
            var expected=JsonUtility.FromJson<Expected>(File.ReadAllText(Path.Combine(Reports,reportName)));Need(SourceHash()==expected.sourceHash,"Reopen uses the same tested generator source.");EditorSceneManager.OpenScene(expected.scene);author=UnityEngine.Object.FindObjectOfType<ReplicaAuthor>();camera=UnityEngine.Object.FindObjectsOfType<Camera>().First(c=>c.name=="QA_Camera");
            legacy=null;manual=null;CleanSample(expected.scene);
            Need(author!=null&&author.DocumentJson==expected.document,"Native reopen retains the complete editable node graph before reconstruction.");Need(author.Kit!=null&&author.Kit.ContentHash==expected.kitFingerprint,"Native reopen retains source kit identity.");Need(ReplicaGeometry.Fingerprint(Session.Geometry)==expected.mesh&&TextHash(author.MappingJson)==expected.mappingHash,"Native reopen restores actual serialized Mesh arrays and provenance before rebuild.");Need(author.transform.position==expected.position&&Quaternion.Angle(author.transform.rotation,expected.rotation)<.001f,"Native reopen retains author placement and orientation.");Opening(Session.Geometry,author.Read());EntryPorts(Session.Geometry,author.Read());
            var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(expected.prefab);Need(prefab!=null&&prefab.GetComponentsInChildren<MonoBehaviour>(true).Length==0&&ReplicaGeometry.Fingerprint(prefab)==expected.mesh,"Independent prefab reopens without generator scripts and with exact mesh.");
            string old=author.DocumentJson,mesh=ReplicaGeometry.Fingerprint(Session.Geometry);Commit(RouteEdits.OffsetLeg(author.Read(),2,1));Undo.FlushUndoRecordObjects();Undo.PerformUndo();Need(author.DocumentJson==old&&ReplicaGeometry.Fingerprint(Session.Geometry)==mesh,"Reopened middle route remains editable; one Undo restores exact native data and mesh.");Capture(author.Kit.Id=="workshop.bridge.A"?"05-A-reopened":"07-B-reopened");
        }
        public static void ReopenA(){Begin();Case("separate-process-native-route-A-reopen-edit",()=>OpenExpected("route-A-expected.json"));Write("workflow-A-reopen.json",report);if(report.status!="PASS")throw new InvalidOperationException("A reopen failed.");}
        static string GeometrySignature(ReplicaBinding binding)
        {
            var instance=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>(binding.ModelPath));instance.transform.position=Vector3.zero;
            try{var points=new List<string>();foreach(var f in instance.GetComponentsInChildren<MeshFilter>(true))foreach(var p in f.sharedMesh.vertices){var v=(Matrix4x4.Rotate(Quaternion.Euler(0,binding.AdapterYaw,0))*f.transform.localToWorldMatrix).MultiplyPoint3x4(p);points.Add(Mathf.RoundToInt(v.x*100000)+","+Mathf.RoundToInt(v.y*100000)+","+Mathf.RoundToInt(v.z*100000));}points.Sort(StringComparer.Ordinal);return TextHash(string.Join(";",points.ToArray()));}
            finally{UnityEngine.Object.DestroyImmediate(instance);}
        }
        static string ShapeOnly(RouteDocument document){var c=document.Clone();c.KitId=c.KitVersion="";c.Revision=0;return JsonUtility.ToJson(c);}
        public static void SwapB()
        {
            Begin();report.frozenBefore=SourceHash();report.familySpecBefore=ReplicaKitRegistry.HashFile(Path.Combine(Output,"kit-spec/bridge-orthogonal-family-v1.md"));Write("swap-baseline-before.json",report);Case("A-before-independent-kit-swap",()=>OpenExpected("route-A-expected.json"));
            if(report.status=="PASS")Case("independent-kit-only-swap-cancel-adopt-save",()=>{
                // This record is established before registering B. This run does
                // not edit generator files, the route, openings or camera.
                OwnershipFixtures();var kitA=author.Kit;string json=author.DocumentJson,meshA=ReplicaGeometry.Fingerprint(Session.Geometry),shape=ShapeOnly(author.Read());var position=camera.transform.position;var rotation=camera.transform.rotation;float size=camera.orthographicSize;
                Capture("06-A-before-kit-swap");var kitB=ReplicaKitRegistry.Register(Path.Combine(Output,"kits/B/kit-manifest.json"));report.kitA=kitA.ContentHash;report.kitB=kitB.ContentHash;
                var changed=kitA.Bindings.Where(a=>GeometrySignature(a)!=GeometrySignature(kitB.Bindings.Single(b=>b.Role==a.Role))).Select(b=>b.Role).ToArray();report.changedGeometryRoles=changed;
                Need(changed.Any(r=>r=="tread"||r=="deck")&&changed.Any(r=>r=="post"||r=="keystone"||r=="arch-foot")&&changed.Any(r=>r=="rail"||r=="coping"),"Independent B changes actual geometry in walk, connection and guard/edge categories, not only color.");
                Need(Session.Preview(author.Read(),kitB),"Same route accepts independently supplied kit B.");Need(author.DocumentJson==json&&author.Kit==kitA,"Kit preview keeps committed route and kit A identity.");Session.Cancel();Need(author.DocumentJson==json&&author.Kit==kitA&&ReplicaGeometry.Fingerprint(Session.Geometry)==meshA,"Cancel kit replacement restores exact A author and meshes.");
                Commit(author.Read(),kitB);Need(ShapeOnly(author.Read())==shape&&ReplicaGeometry.Fingerprint(Session.Geometry)!=meshA,"Adopting B changes source geometry while preserving route, elevations, openings and rules.");Need(camera.transform.position==position&&camera.transform.rotation==rotation&&camera.orthographicSize==size,"A/B use the exact same camera.");Opening(Session.Geometry,author.Read());Capture("07-B-same-route");Persist(BScene,BPrefab,"samples/route-B.bridge-route.json","route-B-expected.json");
                var map=JsonUtility.FromJson<ReplicaMapping>(author.MappingJson);Need(map.kitFingerprint==kitB.ContentHash&&map.sources.All(s=>s.Id.StartsWith("workshop.bridge.B.")),"Provenance names actual independent B sources rather than A defaults.");
            });
            report.frozenAfter=SourceHash();report.familySpecAfter=ReplicaKitRegistry.HashFile(Path.Combine(Output,"kit-spec/bridge-orthogonal-family-v1.md"));Case("generator-unchanged-through-B-registration-and-swap",()=>Need(report.frozenBefore==report.frozenAfter&&report.familySpecBefore==report.familySpecAfter,"Generator and interface-spec baselines are byte-identical before and after independent B registration, swap and persistence."));Write("workflow-kit-swap.json",report);if(report.status!="PASS")throw new InvalidOperationException("Independent kit swap failed; inspect workflow-kit-swap.json.");
        }
        public static void ReopenB(){Begin();Case("separate-process-native-route-B-reopen-edit",()=>OpenExpected("route-B-expected.json"));Write("workflow-B-reopen.json",report);if(report.status!="PASS")throw new InvalidOperationException("B reopen failed.");}
        public static void ReopenAAndSwapB(){ReopenA();SwapB();}
        public static void FilesRed()
        {
            bool found=AppDomain.CurrentDomain.GetAssemblies().Any(a=>a.GetTypes().Any(t=>t.Name=="ReplicaFiles"));
            string root=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT");Directory.CreateDirectory(Path.Combine(root,"reports"));
            File.WriteAllText(Path.Combine(root,"reports/files-initial-red.json"),"{\"status\":\""+(found?"PASS":"FAIL")+"\",\"feature\":\"persistent editable route with source kit identity\"}");
            if(!found)throw new InvalidOperationException("ReplicaFiles missing: editable route, kit fingerprint, native scene and independent bake persistence are absent.");
        }
    }
}
