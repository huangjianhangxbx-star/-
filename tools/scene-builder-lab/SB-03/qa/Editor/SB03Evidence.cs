using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.SB03.Editor;
namespace XingHai.SB03.QA
{
    public static class SB03Evidence
    {
        const string Scene="Assets/SB03/Scenes/SB03_Bridge.unity",Prefab="Assets/SB03/Baked/SB03_Bridge.prefab";
        static string Output {get{return Environment.GetEnvironmentVariable("SB03_OUTPUT_ROOT")??throw new InvalidOperationException("Set SB03_OUTPUT_ROOT.");}}
        static string Reports {get{return Path.Combine(Output,"reports");}}
        [Serializable] sealed class Step {public string name,image,specJson,meshHash;public int parts,cores,meshes,triangles;}
        [Serializable] sealed class Source {public int number,placements;public string id,title,fbx,fbxSha256;}
        [Serializable] sealed class Report
        {
            public string status="PASS",engine=Application.unityVersion,sourceHash,error;
            public string scope="Actual original FBX meshes combined by the production bridge solver/session and rendered by a Unity URP camera in one isolated batch project. No desktop or physical mouse/FPS claim.";
            public List<string> checks=new List<string>();public List<Step> steps=new List<Step>();public List<Source> sources=new List<Source>();
        }
        [Serializable] sealed class Expected {public string specJson,meshHash,mapHash,authorFileSha,sourceHash;public int revision;public Vector3 position;public Quaternion rotation;}
        [Serializable] sealed class Timing {public string name;public int iterations,parts,cores,meshes,triangles;public double solveP95,previewBuildP95,commitP95,undoP95,maxPreviewBuild;}
        [Serializable] sealed class Performance {public string status="PASS",engine=Application.unityVersion,scope="Main-thread solve/actual Mesh+MeshCollider build, commit and native Undo; warm 5, sample 20. Not viewport FPS.";public List<Timing> fixtures=new List<Timing>();}
        static Report report;static Camera camera;static GameObject ground;static SB03BridgeAuthor author;
        static string Hash(string value){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(value))).Replace("-","");}
        static string FileHash(string file){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(file))).Replace("-","");}
        static string ProductionHash(){return Hash(string.Join("\n",Directory.GetFiles(Path.Combine(Application.dataPath,"SB03"),"*.cs",SearchOption.AllDirectories).Where(p=>!p.Replace('\\','/').Contains("/QA/")).OrderBy(p=>p,StringComparer.Ordinal).Select(File.ReadAllText).ToArray()));}
        static void Need(bool value,string text){if(!value)throw new InvalidOperationException(text);if(report!=null)report.checks.Add(text);Debug.Log("SB03_EVIDENCE_CHECK "+text);}
        static void Write(string name,object data){Directory.CreateDirectory(Reports);File.WriteAllText(Path.Combine(Reports,name),JsonUtility.ToJson(data,true));}
        static string Mesh(GameObject root){return SB03EditorTests.MeshHash(root);}
        static SB03BridgeSession Session {get{return SB03BridgeSession.Get(author);}}
        static void Begin()
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Evidence runs only in the isolated batch QA project.");
            ShaderUtil.allowAsyncCompilation=false;Directory.CreateDirectory(Path.Combine(Output,"samples/screenshots"));Directory.CreateDirectory(Reports);report=new Report{sourceHash=ProductionHash()};
        }
        static void SetupScene()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.5f,.53f,.57f);RenderSettings.skybox=null;RenderSettings.fog=false;
            var light=new GameObject("SB03_SampleKey").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.25f;light.color=new Color(1,.94f,.85f);light.shadows=LightShadows.Soft;light.transform.rotation=Quaternion.Euler(42,-28,0);
            camera=new GameObject("SB03_SampleCamera").AddComponent<Camera>();camera.orthographic=true;camera.aspect=1440f/900;camera.backgroundColor=new Color(.57f,.66f,.7f);camera.clearFlags=CameraClearFlags.SolidColor;camera.nearClipPlane=.1f;camera.farClipPlane=150;camera.allowHDR=false;camera.allowMSAA=false;
            SB03BridgeFiles.EnsureFolder("Assets/SB03/Materials");const string matPath="Assets/SB03/Materials/SampleGround.mat";var mat=AssetDatabase.LoadAssetAtPath<Material>(matPath);if(mat==null){mat=new Material(Shader.Find("Universal Render Pipeline/Lit"));mat.SetColor("_BaseColor",new Color(.31f,.38f,.33f));mat.SetFloat("_Smoothness",0);AssetDatabase.CreateAsset(mat,matPath);}
            ground=GameObject.CreatePrimitive(PrimitiveType.Cube);ground.name="SampleGround_IndependentPlane";ground.transform.position=new Vector3(7,-.15f,0);ground.transform.localScale=new Vector3(22,.25f,10);ground.GetComponent<MeshRenderer>().sharedMaterial=mat;
            author=new GameObject("SB03_阶梯石拱桥").AddComponent<SB03BridgeAuthor>();author.transform.position=new Vector3(-2,0,1);author.transform.rotation=Quaternion.Euler(0,15,0);var spec=new BridgeSpec{Id="sb03.sample.bridge"};Need(Session.Preview(spec)&&Session.Apply(),"Default dedicated bridge commits from original source kit.");ViewBridge(false);
        }
        static void ViewBridge(bool side)
        {
            var target=author.transform.TransformPoint(new Vector3(author.Spec.Length*.5f,author.Spec.DeckHeight*.45f,0));camera.orthographicSize=side?author.Spec.Length*.34f:author.Spec.Length*.34f;
            camera.transform.position=target+author.transform.TransformDirection(side?new Vector3(0,.2f,-30):new Vector3(12,9,-18));camera.transform.LookAt(target);
        }
        static void Capture(string name,bool record=true)
        {
            string relative="samples/screenshots/"+name+".png";var target=new RenderTexture(1440,900,24,RenderTextureFormat.ARGB32){antiAliasing=1};var image=new Texture2D(1440,900,TextureFormat.RGB24,false);var old=RenderTexture.active;
            try{
                camera.targetTexture=target;camera.Render();camera.Render();RenderTexture.active=target;image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();
                if(name=="01-default"||name=="08-final"){var pixel=image.GetPixel(720,230);Need(!(pixel.r>.94f&&pixel.g>.94f&&pixel.b>.94f),"Rendered ground retains its actual colored material; no white shader warmup fallback.");}
                File.WriteAllBytes(Path.Combine(Output,relative),image.EncodeToPNG());
            }
            finally{camera.targetTexture=null;RenderTexture.active=old;UnityEngine.Object.DestroyImmediate(image);UnityEngine.Object.DestroyImmediate(target);}
            if(record){var filters=author.GetComponentsInChildren<MeshFilter>();report.steps.Add(new Step{name=name,image=relative,specJson=JsonUtility.ToJson(author.Spec),meshHash=Mesh(author.gameObject),parts=Session.LastPlan.Parts.Count,cores=Session.LastPlan.Solids.Count,meshes=filters.Length,triangles=filters.Sum(f=>f.sharedMesh.triangles.Length/3)});}
        }
        static void Commit(BridgeSpec spec,string check){Need(Session.Preview(spec)&&Session.Apply(),check);Physics.SyncTransforms();}
        static void CheckOpening(GameObject root,BridgeSpec spec)
        {
            var plan=BridgeSolver.Solve(spec);Need(plan.Valid&&spec.Opening,"Opening fixture is a valid bridge with a protected void.");float x=(plan.OpeningMinX+plan.OpeningMaxX)*.5f;var colliders=root.GetComponentsInChildren<Collider>();Physics.SyncTransforms();Need(colliders.Length>0,"Bridge has actual enabled colliders.");
            foreach(float y in new[]{.25f,.5f,1f})if(y<plan.OpeningCrown){var ray=new Ray(root.transform.TransformPoint(new Vector3(x,y,-spec.Width*.5f-2)),root.transform.TransformDirection(Vector3.forward));Need(!colliders.Any(c=>{RaycastHit hit;return c.enabled&&c.Raycast(ray,out hit,spec.Width+4);}),"Underpass passes through entire width at local height "+y+"m.");}
            var down=new Ray(root.transform.TransformPoint(new Vector3(x,spec.DeckHeight+2,0)),root.transform.TransformDirection(Vector3.down));Need(colliders.Any(c=>{RaycastHit hit;return c.enabled&&c.Raycast(down,out hit,3);}),"Deck above opening has a walkable MeshCollider surface.");
        }
        static void SourceBoard()
        {
            var board=new GameObject("QA_ActualSourceBoard");author.gameObject.SetActive(false);ground.SetActive(false);
            try{
                int index=0;foreach(var source in SB03BridgeGeometry.Kit.assets.OrderBy(s=>s.number)){
                    var slot=new GameObject(source.number.ToString("00")+"_"+source.id);slot.transform.SetParent(board.transform,false);slot.transform.localPosition=new Vector3((index%3)*2,0,(index/3)*2);
                    var original=AssetDatabase.LoadAssetAtPath<GameObject>(SB03BridgeGeometry.KitRoot+source.fbx);Need(original!=null,"Source board imports actual "+source.id+" FBX.");var model=UnityEngine.Object.Instantiate(original);model.transform.SetParent(slot.transform,false);slot.transform.localRotation=Quaternion.Euler(0,source.unityAdapterYaw,0)*model.transform.localRotation;
                    var chunk=author.GetComponentsInChildren<SB03Chunk>(true).FirstOrDefault(c=>c.SourceId==source.id);Need(chunk!=null,"Default bridge contains source "+source.id+" for direct usage comparison.");foreach(var renderer in model.GetComponentsInChildren<MeshRenderer>())renderer.sharedMaterial=chunk.GetComponent<MeshRenderer>().sharedMaterial;
                    var text=new GameObject("number").AddComponent<TextMesh>();text.transform.SetParent(slot.transform,false);text.transform.localPosition=new Vector3(-.4f,0,-.65f);text.characterSize=.16f;text.fontSize=48;text.text=source.number.ToString("00");text.color=Color.white;text.anchor=TextAnchor.MiddleCenter;
                    report.sources.Add(new Source{number=source.number,id=source.id,title=source.title,fbx=SB03BridgeGeometry.KitRoot+source.fbx,fbxSha256=source.fbxSha256,placements=Session.LastPlan.Parts.Count(p=>p.SourceId==source.id)});index++;
                }
                var target=new Vector3(2,.2f,2);camera.transform.position=target+new Vector3(7,9,-11);camera.transform.LookAt(target);camera.orthographicSize=3.8f;foreach(var text in board.GetComponentsInChildren<TextMesh>())text.transform.rotation=camera.transform.rotation;Capture("00-actual-source-board",false);
            }finally{UnityEngine.Object.DestroyImmediate(board);author.gameObject.SetActive(true);ground.SetActive(true);ViewBridge(false);}
        }
        static void Highlight(string id,string name)
        {
            var originals=new Dictionary<MeshRenderer,Material[]>();var temporary=new List<Material>();
            try{foreach(var renderer in author.GetComponentsInChildren<MeshRenderer>()){
                originals[renderer]=renderer.sharedMaterials;var tag=renderer.GetComponent<SB03Chunk>();var mat=new Material(Shader.Find("Universal Render Pipeline/Lit"));var color=tag!=null&&tag.SourceId==id?new Color(.2f,.87f,.88f):new Color(.25f,.3f,.32f);mat.SetColor("_BaseColor",color);mat.SetFloat("_Smoothness",0);renderer.sharedMaterial=mat;temporary.Add(mat);
            }Capture(name);}finally{foreach(var entry in originals)entry.Key.sharedMaterials=entry.Value;foreach(var material in temporary)UnityEngine.Object.DestroyImmediate(material);}
        }
        static void SaveAndBake()
        {
            CheckOpening(author.gameObject,author.Spec);var spec=author.Spec.Clone();string before=Mesh(author.gameObject),source=JsonUtility.ToJson(author.Spec);int revision=author.Revision;
            var candidate=spec.Clone();candidate.Length=16;Need(Session.Preview(candidate),"Save guard fixture creates an uncommitted candidate.");bool denied=false;try{SB03BridgeFiles.SaveAuthor(author,Path.Combine(Output,"samples/should-not-save.bridge.json"));}catch(InvalidOperationException){denied=true;}Need(denied,"Uncommitted candidate cannot be silently saved as a completed bridge.");Session.Cancel();Need(Mesh(author.gameObject)==before,"Save rejection and cancel preserve the exact committed bridge.");
            string file=Path.Combine(Output,"samples/default.bridge.json");SB03BridgeFiles.SaveAuthor(author,file);
            var baked=SB03BridgeFiles.Bake(author,Prefab);Need(Mesh(author.gameObject)==before&&JsonUtility.ToJson(author.Spec)==source&&author.Revision==revision,"Baking leaves the editable bridge author and actual source mesh intact.");
            Need(baked.GetComponentsInChildren<MonoBehaviour>(true).Length==0,"Independent bake contains no author, generator or provenance scripts.");Need(Mesh(baked)==before,"Independent bake retains exact original mesh arrays.");Need(baked.GetComponentsInChildren<MeshFilter>().All(f=>AssetDatabase.Contains(f.sharedMesh)),"Baked display and collision meshes are persistent assets.");CheckOpening(baked,spec);UnityEngine.Object.DestroyImmediate(baked);
            SB03BridgeFiles.SaveScene(Scene);Need(author.GetComponentsInChildren<MeshFilter>().All(f=>AssetDatabase.Contains(f.sharedMesh)),"Native scene owns persistent bridge meshes before closing the process.");
            var expected=new Expected{specJson=JsonUtility.ToJson(author.Spec),meshHash=Mesh(author.gameObject),mapHash=Hash(author.SourceMapJson),authorFileSha=FileHash(file),revision=author.Revision,position=author.transform.position,rotation=author.transform.rotation,sourceHash=ProductionHash()};Write("persistence-expected.json",expected);
            var loaded=new GameObject("QA_LoadedBridge").AddComponent<SB03BridgeAuthor>();SB03BridgeFiles.LoadAuthor(loaded,file);Need(JsonUtility.ToJson(loaded.Spec)==expected.specJson&&Mesh(loaded.gameObject)==expected.meshHash,"Complete author file reconstructs matching real bridge meshes.");Need(loaded.Revision==revision&&Hash(loaded.SourceMapJson)==expected.mapHash,"Complete author file preserves revision and source provenance.");Need(loaded.transform.position==expected.position&&Quaternion.Angle(loaded.transform.rotation,expected.rotation)<.001f,"Author file preserves nonzero translation and a 15-degree bridge direction.");UnityEngine.Object.DestroyImmediate(loaded.gameObject);
            var bad=JsonUtility.FromJson<SB03BridgeFile>(File.ReadAllText(file));bad.spec.DeckHeight=.5f;bad.spec.ArchHeight=2;string invalid=Path.Combine(Reports,"invalid-fixture.bridge.json");File.WriteAllText(invalid,JsonUtility.ToJson(bad));denied=false;try{SB03BridgeFiles.LoadAuthor(author,invalid);}catch(InvalidDataException){denied=true;}Need(denied&&Mesh(author.gameObject)==before&&JsonUtility.ToJson(author.Spec)==source,"Invalid author file is rejected before modifying the previous bridge.");
        }
        public static void Run()
        {
            Begin();try{
                SetupScene();Capture("01-default");SourceBoard();var spec=author.Spec.Clone();spec.Length=16;Commit(spec,"Length change rebuilds one coordinated bridge.");ViewBridge(false);Capture("02-long");spec=author.Spec.Clone();spec.Width=3.5f;Commit(spec,"Width change repeats certified source lanes without stretching them.");ViewBridge(false);Capture("03-wide");spec=author.Spec.Clone();spec.DeckHeight=2.5f;Commit(spec,"Raised bridge coordinates approach steps, core, arch and guard rails.");ViewBridge(false);Capture("04-high");CheckOpening(author.gameObject,author.Spec);
                Commit(new BridgeSpec{Id="sb03.sample.bridge"},"Sample returns to the default 14m bridge for reproducible editing.");ViewBridge(true);Capture("05-actual-underpass");ViewBridge(false);Highlight("sb03.tread","06-source-treads");Highlight("sb03.arch-stone","07-source-arch-stones");foreach(var source in SB03BridgeGeometry.Kit.assets.OrderBy(s=>s.number))Highlight(source.id,"source-"+source.number.ToString("00"));Capture("08-final");SaveAndBake();Write("workflow-evidence.json",report);
            }catch(Exception e){report.status="FAIL";report.error=e.ToString();Write("workflow-evidence.json",report);throw;}
        }
        public static void Reopen()
        {
            Begin();try{
                var expected=JsonUtility.FromJson<Expected>(File.ReadAllText(Path.Combine(Reports,"persistence-expected.json")));Need(ProductionHash()==expected.sourceHash,"Reopen process uses the same production source version.");EditorSceneManager.OpenScene(Scene);author=UnityEngine.Object.FindObjectOfType<SB03BridgeAuthor>();camera=UnityEngine.Object.FindObjectsOfType<Camera>().First(c=>c.name=="SB03_SampleCamera");ground=GameObject.Find("SampleGround_IndependentPlane");
                Need(author!=null&&JsonUtility.ToJson(author.Spec)==expected.specJson&&author.Revision==expected.revision,"Separate Engine process restores native author and revision.");Need(Mesh(author.gameObject)==expected.meshHash&&Hash(author.SourceMapJson)==expected.mapHash,"Separate process loads persistent mesh arrays and source map before any regeneration.");Need(author.transform.position==expected.position&&Quaternion.Angle(author.transform.rotation,expected.rotation)<.001f,"Separate process retains bridge root translation and direction.");CheckOpening(author.gameObject,author.Spec);
                var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(Prefab);Need(prefab!=null&&prefab.GetComponentsInChildren<MonoBehaviour>(true).Length==0,"Separate process loads an independent bake without generator scripts.");var baked=(GameObject)PrefabUtility.InstantiatePrefab(prefab);Need(Mesh(baked)==expected.meshHash,"Independent prefab reloads the exact baked mesh arrays.");CheckOpening(baked,author.Spec);UnityEngine.Object.DestroyImmediate(baked);
                string file=Path.Combine(Output,"samples/default.bridge.json");Need(FileHash(file)==expected.authorFileSha,"Author file remains unchanged across process restart.");var loaded=new GameObject("QA_ReopenedFile").AddComponent<SB03BridgeAuthor>();SB03BridgeFiles.LoadAuthor(loaded,file);Need(JsonUtility.ToJson(loaded.Spec)==expected.specJson&&Mesh(loaded.gameObject)==expected.meshHash,"Second process reconstructs the complete author file with real source assets.");UnityEngine.Object.DestroyImmediate(loaded.gameObject);
                var next=author.Spec.Clone();next.Width+=.5f;Commit(next,"Reopened native author remains editable.");Undo.FlushUndoRecordObjects();Undo.PerformUndo();Need(JsonUtility.ToJson(author.Spec)==expected.specJson&&Mesh(author.gameObject)==expected.meshHash,"Continued edit Undo restores exact reopened native author and mesh.");ViewBridge(false);Capture("09-reopened");Write("workflow-reopen.json",report);
            }catch(Exception e){report.status="FAIL";report.error=e.ToString();Write("workflow-reopen.json",report);throw;}
        }
        static double P95(List<double> values){var sorted=values.OrderBy(v=>v).ToArray();return sorted[(int)Math.Ceiling(sorted.Length*.95)-1];}
        public static void Measure()
        {
            Begin();var performance=new Performance();try{
                SetupScene();foreach(float length in new[]{14f,24f}){
                    var spec=new BridgeSpec{Id="sb03.performance",Length=length};Commit(spec,"Performance fixture "+length+"m settles before measurement.");var solve=new List<double>();var preview=new List<double>();var commit=new List<double>();var undo=new List<double>();
                    for(int i=-5;i<20;i++){
                        Undo.ClearAll();var timer=System.Diagnostics.Stopwatch.StartNew();var plan=BridgeSolver.Solve(spec);double tSolve=timer.Elapsed.TotalMilliseconds;Need(plan.Valid,"Timed fixed fixture remains valid.");timer.Restart();Need(Session.Preview(spec),"Timed actual mesh candidate succeeds.");double tPreview=timer.Elapsed.TotalMilliseconds;timer.Restart();Need(Session.Apply(),"Timed candidate commits.");double tCommit=timer.Elapsed.TotalMilliseconds;Undo.FlushUndoRecordObjects();timer.Restart();Undo.PerformUndo();double tUndo=timer.Elapsed.TotalMilliseconds;
                        Need(JsonUtility.ToJson(author.Spec)==JsonUtility.ToJson(spec),"Undo retains the previous fixed-size bridge recipe.");if(i>=0){solve.Add(tSolve);preview.Add(tPreview);commit.Add(tCommit);undo.Add(tUndo);}
                    }
                    var filters=author.GetComponentsInChildren<MeshFilter>();performance.fixtures.Add(new Timing{name=length+"m",iterations=20,parts=Session.LastPlan.Parts.Count,cores=Session.LastPlan.Solids.Count,meshes=filters.Length,triangles=filters.Sum(f=>f.sharedMesh.triangles.Length/3),solveP95=P95(solve),previewBuildP95=P95(preview),commitP95=P95(commit),undoP95=P95(undo),maxPreviewBuild=preview.Max()});
                }Write("performance-unity.json",performance);
            }catch{performance.status="FAIL";Write("performance-unity.json",performance);throw;}
        }
        static void NativeSceneSave(bool initialRed)
        {
            Begin();try{
                SetupScene();string fingerprint=Mesh(author.gameObject),map=Hash(author.SourceMapJson);SB03BridgeFiles.EnsureFolder("Assets/SB03/WorkScenes");const string path="Assets/SB03/WorkScenes/NativeCtrlS.unity";
                Need(EditorSceneManager.SaveScene(author.gameObject.scene,path),"Ordinary native scene save succeeds without calling SB03BridgeFiles.SaveScene.");
                Need(author.GetComponentsInChildren<MeshFilter>().All(f=>f.sharedMesh!=null&&AssetDatabase.Contains(f.sharedMesh)),"Ordinary scene save persists all actual bridge Mesh and MeshCollider assets.");
                Need(Mesh(author.gameObject)==fingerprint&&Hash(author.SourceMapJson)==map,"Ordinary save preserves the committed geometry and source map exactly.");
                var expected=new Expected{specJson=JsonUtility.ToJson(author.Spec),meshHash=fingerprint,mapHash=map,revision=author.Revision,position=author.transform.position,rotation=author.transform.rotation,sourceHash=ProductionHash()};Write("native-save-expected.json",expected);Write(initialRed?"native-save-initial-red.json":"native-save.json",report);
            }catch(Exception e){report.status="FAIL";report.error=e.ToString();Write(initialRed?"native-save-initial-red.json":"native-save.json",report);throw;}
        }
        public static void NativeSaveRed(){NativeSceneSave(true);}
        public static void NativeSave(){NativeSceneSave(false);}
        public static void NativeReopen()
        {
            Begin();try{
                var expected=JsonUtility.FromJson<Expected>(File.ReadAllText(Path.Combine(Reports,"native-save-expected.json")));Need(ProductionHash()==expected.sourceHash,"Native reopen uses the same tested production source.");EditorSceneManager.OpenScene("Assets/SB03/WorkScenes/NativeCtrlS.unity");author=UnityEngine.Object.FindObjectOfType<SB03BridgeAuthor>();
                Need(author!=null&&JsonUtility.ToJson(author.Spec)==expected.specJson&&author.Revision==expected.revision,"Native CtrlS scene reopens its author without a custom load command.");Need(Mesh(author.gameObject)==expected.meshHash&&Hash(author.SourceMapJson)==expected.mapHash,"Native CtrlS restores actual mesh arrays and source map before any rebuild.");Need(author.transform.position==expected.position&&Quaternion.Angle(author.transform.rotation,expected.rotation)<.001f,"Native CtrlS preserves nonzero translation and bridge direction.");Need(author.GetComponentsInChildren<MeshFilter>().All(f=>AssetDatabase.Contains(f.sharedMesh)),"Reopened native scene references actual persistent meshes.");CheckOpening(author.gameObject,author.Spec);Write("native-save-reopen.json",report);
            }catch(Exception e){report.status="FAIL";report.error=e.ToString();Write("native-save-reopen.json",report);throw;}
        }
        static void MultipleAuthorIdentity(bool initialRed)
        {
            Begin();try{
                SetupScene();var spec=author.Spec.Clone();spec.Id="middle";Commit(spec,"First bridge has a stable author identity.");const string path="Assets/SB03/Scenes/MultipleIdentity.unity";SB03BridgeFiles.SaveScene(path);string firstMesh=Mesh(author.gameObject),firstMap=Hash(author.SourceMapJson);
                var second=new GameObject("SecondBridge_SortsEarlier").AddComponent<SB03BridgeAuthor>();second.transform.position=new Vector3(0,0,12);var secondSpec=new BridgeSpec{Id="aaa-new-earlier-bridge",Length=16,Width=3.5f};var session=SB03BridgeSession.Get(second);Need(session.Preview(secondSpec)&&session.Apply(),"Second differently sized bridge commits with an identity sorting before the first.");string secondMesh=Mesh(second.gameObject);SB03BridgeFiles.SaveScene(path);
                Need(Mesh(author.gameObject)==firstMesh&&Hash(author.SourceMapJson)==firstMap,"Saving a new earlier-sorting bridge does not overwrite the first bridge's persistent mesh assets.");Need(Mesh(second.gameObject)==secondMesh,"Second bridge retains its distinct own geometry after scene save.");
                var duplicate=new GameObject("DuplicateIdentity").AddComponent<SB03BridgeAuthor>();var duplicateSession=SB03BridgeSession.Get(duplicate);Need(duplicateSession.Preview(secondSpec)&&duplicateSession.Apply(),"Duplicate-id fixture has an actual committed bridge before testing save validation.");bool rejected=false;try{SB03BridgeFiles.SaveScene(path);}catch(InvalidOperationException){rejected=true;}Need(rejected,"Duplicate bridge identities are rejected before writing scene mesh assets.");Need(Mesh(author.gameObject)==firstMesh&&Mesh(second.gameObject)==secondMesh,"Duplicate-id rejection preserves both existing bridge meshes.");UnityEngine.Object.DestroyImmediate(duplicate.gameObject);Write(initialRed?"multi-identity-initial-red.json":"multi-identity.json",report);
            }catch(Exception e){report.status="FAIL";report.error=e.ToString();Write(initialRed?"multi-identity-initial-red.json":"multi-identity.json",report);throw;}
        }
        public static void MultiIdentityRed(){MultipleAuthorIdentity(true);}
        public static void MultiIdentity(){MultipleAuthorIdentity(false);}
        [Serializable] sealed class PersistenceCase {public string name,status,detail;}
        [Serializable] sealed class PersistenceReport {public string status="PASS",engine=Application.unityVersion;public List<PersistenceCase> checks=new List<PersistenceCase>();}
        public static void PersistenceRed()
        {
            var combined=new PersistenceReport();Action<string,Action> test=(name,action)=>{var check=new PersistenceCase{name=name,status="PASS"};try{action();}catch(Exception e){check.status="FAIL";check.detail=e.GetBaseException().ToString();combined.status="FAIL";}combined.checks.Add(check);};
            test("ordinary-native-scene-save-persists-meshes",NativeSaveRed);test("stable-author-identity-isolates-saved-mesh-assets",MultiIdentityRed);Write("persistence-initial-red.json",combined);if(combined.status!="PASS")throw new InvalidOperationException("Persistence regressions reproduced; inspect persistence-initial-red.json.");
        }
        public static void Persistence()
        {
            var combined=new PersistenceReport();Action<string,Action> test=(name,action)=>{var check=new PersistenceCase{name=name,status="PASS"};try{action();}catch(Exception e){check.status="FAIL";check.detail=e.GetBaseException().ToString();combined.status="FAIL";}combined.checks.Add(check);};
            test("ordinary-native-scene-save-persists-meshes",NativeSave);test("stable-author-identity-isolates-saved-mesh-assets",MultiIdentity);Write("persistence.json",combined);if(combined.status!="PASS")throw new InvalidOperationException("Persistence verification failed; inspect persistence.json.");
        }
        public static void InitialFilesRed()
        {
            bool available=false;
            foreach(var assembly in AppDomain.CurrentDomain.GetAssemblies())if(assembly.GetType("XingHai.SB03.Editor.SB03BridgeFiles")!=null)available=true;
            string root=Environment.GetEnvironmentVariable("SB03_REPORT_ROOT")??Path.GetFullPath("SB03-reports");Directory.CreateDirectory(root);
            File.WriteAllText(Path.Combine(root,"files-initial-red.json"),"{\"status\":\""+(available?"PASS":"FAIL")+"\",\"engine\":\""+Application.unityVersion+"\",\"check\":\"Dedicated B bridge author/scene/bake persistence API exists\"}");
            if(!available)throw new InvalidOperationException("SB03BridgeFiles missing: no complete bridge author, scene or independent bake persistence exists.");
        }
    }
}
