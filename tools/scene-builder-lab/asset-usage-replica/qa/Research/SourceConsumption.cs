using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.BridgeReplica.Editor;

namespace XingHai.BridgeReplica.QA
{
    /// <summary>Private, actual generated-fragment causal test; never copies original data into public reports.</summary>
    public static class SourceConsumption
    {
        [Serializable] sealed class ImportResult { public string status,kitPath,changedKitPath; }
        [Serializable] sealed class ChunkFact { public string role,sourceId,sourceHash,meshFingerprint;public int vertices,triangles,placements; }
        [Serializable] sealed class Report
        {
            public string status="FAIL",scope="Actual same U route and Unity generated fragment consumption. Not original-game T11 or physical mouse evidence.",engine=Application.unityVersion,error;
            public string kitPath,changedKitPath,baselineScene,changedScene,routeJson,baselineMapping,changedMapping;
            public List<string> checks=new List<string>(),images=new List<string>();
            public ChunkFact[] baseline,changed;
            public int[] changedTreadVertexIndices,mappedTreadFirstVertices;
        }
        [Serializable] sealed class ReopenReport { public string status="FAIL",scene,error,route,mesh;public List<string> checks=new List<string>(); }
        static string Output
        {
            get { var path=Environment.GetEnvironmentVariable("REPLICA_RESEARCH_OUTPUT");if(string.IsNullOrWhiteSpace(path)||!Path.IsPathRooted(path))throw new InvalidOperationException("Private absolute REPLICA_RESEARCH_OUTPUT required.");Directory.CreateDirectory(path);return path; }
        }
        static void Need(bool value,string text,List<string> checks){if(!value)throw new InvalidOperationException(text);checks.Add(text);Debug.Log("RESEARCH_CONSUMPTION "+text);}
        static ReplicaKit Load(string path){var kit=AssetDatabase.LoadAssetAtPath<ReplicaKit>(path);ResearchKitImporter.Validate(kit);return kit;}
        static Dictionary<string,Mesh> Meshes(GameObject geometry){return geometry.GetComponentsInChildren<ReplicaChunk>().ToDictionary(c=>c.Role,c=>c.GetComponent<MeshFilter>().sharedMesh,StringComparer.Ordinal);}
        static ChunkFact[] Facts(GameObject geometry)
        {
            return geometry.GetComponentsInChildren<ReplicaChunk>().OrderBy(c=>c.Role,StringComparer.Ordinal).Select(c=>new ChunkFact{role=c.Role,sourceId=c.SourceId,sourceHash=c.SourceHash,meshFingerprint=ResearchKitImporter.MeshFingerprint(c.GetComponent<MeshFilter>().sharedMesh),vertices=c.GetComponent<MeshFilter>().sharedMesh.vertexCount,triangles=c.GetComponent<MeshFilter>().sharedMesh.triangles.Length/3,placements=c.Placements}).ToArray();
        }
        static ReplicaAuthor Build(RouteDocument input,ReplicaKit kit)
        {
            var route=input.Clone();route.KitId=kit.Id;route.KitVersion=kit.Version;var curve=CurveSolver.Solve(route);
            if(!curve.Valid)throw new InvalidDataException("U route invalid: "+curve.Message);
            var author=new GameObject("TGResearch_U_EditableAuthor").AddComponent<ReplicaAuthor>();author.Kit=kit;author.Write(route);author.MappingJson=CurveGeometry.Mapping(curve,kit);
            var geometry=CurveGeometry.Build(curve,kit);geometry.transform.SetParent(author.transform,false);return author;
        }
        static Camera SetupScene()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);RenderSettings.skybox=null;RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.63f,.66f,.68f);ShaderUtil.allowAsyncCompilation=false;
            var light=new GameObject("Research_Light").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.1f;light.transform.rotation=Quaternion.Euler(48,-35,0);light.shadows=LightShadows.Soft;
            var camera=new GameObject("Research_Camera").AddComponent<Camera>();camera.orthographic=true;camera.aspect=1440f/1000f;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.57f,.67f,.7f);camera.allowHDR=false;camera.allowMSAA=false;camera.nearClipPlane=.1f;camera.farClipPlane=200;return camera;
        }
        static void View(Camera camera,bool close)
        {
            Vector3 centre=close?new Vector3(-2,1,0):new Vector3(5,1,6);camera.orthographicSize=close?2.8f:13;camera.transform.position=centre+(close?new Vector3(-5,3.5f,6):new Vector3(22,24,30));camera.transform.LookAt(centre);
        }
        static void Capture(Camera camera,string path)
        {
            var target=new RenderTexture(1440,1000,24){antiAliasing=1};var image=new Texture2D(1440,1000,TextureFormat.RGB24,false);var old=RenderTexture.active;
            try{camera.targetTexture=target;camera.Render();camera.Render();RenderTexture.active=target;image.ReadPixels(new Rect(0,0,1440,1000),0,0);image.Apply();File.WriteAllBytes(path,image.EncodeToPNG());}
            finally{camera.targetTexture=null;RenderTexture.active=old;UnityEngine.Object.DestroyImmediate(image);UnityEngine.Object.DestroyImmediate(target);}
        }
        static string PersistScene(ReplicaAuthor author,string folder,string name)
        {
            string meshFolder=folder+"/"+name+"-meshes";ReplicaKitRegistry.Folder(meshFolder);
            foreach(var chunk in author.GetComponentsInChildren<ReplicaChunk>())
            {
                var filter=chunk.GetComponent<MeshFilter>();string path=meshFolder+"/"+chunk.Role+".asset";
                if(AssetDatabase.Contains(filter.sharedMesh))throw new InvalidOperationException("Expected fresh generated research geometry.");
                AssetDatabase.CreateAsset(filter.sharedMesh,path);var collider=chunk.GetComponent<MeshCollider>();if(collider!=null)collider.sharedMesh=filter.sharedMesh;
            }
            EditorUtility.SetDirty(author);AssetDatabase.SaveAssets();string scene=folder+"/"+name+".unity";
            if(!EditorSceneManager.SaveScene(author.gameObject.scene,scene))throw new IOException("Private research scene save failed.");return scene;
        }
        public static void Run()
        {
            string output=Output;var report=new Report();
            try
            {
                var imported=JsonUtility.FromJson<ImportResult>(File.ReadAllText(Path.Combine(output,"unity-import-result.json")));
                Need(imported!=null&&imported.status=="PASS","reuse actual importer PASS paths without reimport",report.checks);
                // Load after NewScene: otherwise Resources can unload C#-only kit references.
                var camera=SetupScene();var baselineKit=Load(imported.kitPath);var changedKit=Load(imported.changedKitPath);report.kitPath=imported.kitPath;report.changedKitPath=imported.changedKitPath;
                var route=CurveExamples.U();var curve=CurveSolver.Solve(route);Need(curve.Valid&&curve.Openings.Count>0,"same valid U route includes straight opening and two approach stair runs",report.checks);
                string folder=ResearchKitImporter.PrivateRoot+"/SourceConsumption/"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");ReplicaKitRegistry.Folder(folder);
                var baseline=Build(route,baselineKit);var baselineGeometry=baseline.transform.Find("__RouteGeometry").gameObject;var before=Meshes(baselineGeometry);report.baseline=Facts(baselineGeometry);report.routeJson=baseline.DocumentJson;report.baselineMapping=baseline.MappingJson;
                var map=JsonUtility.FromJson<CurveMapping>(baseline.MappingJson);var tread=map.placements.Where(p=>p.role=="tread").ToArray();Need(tread.Length>0,"U approach has actual repeated source tread placements",report.checks);
                foreach(var role in new[]{"tread","deck","rail"})
                {
                    var binding=baselineKit.Bindings.Single(b=>b.Role==role);var placements=map.placements.Where(p=>p.role==role).ToArray();Need(placements.Length>0,"actual generated role present: "+role,report.checks);
                    Need(placements.All(p=>p.sourceId==binding.Id&&p.sourceHash==binding.ModelSha256&&p.vertexCount==binding.Mesh.vertexCount&&p.triangleCount==binding.Mesh.triangles.Length/3),"source identity and actual source ranges map for "+role,report.checks);
                    int vertices=0,triangles=0;foreach(var p in placements){if(p.firstVertex!=vertices||p.firstTriangle!=triangles)throw new InvalidOperationException("Non-contiguous generated fragment range: "+role);vertices+=p.vertexCount;triangles+=p.triangleCount;}
                    Need(vertices==before[role].vertexCount&&triangles==before[role].triangles.Length/3,"source map fully covers generated "+role+" mesh",report.checks);
                }
                View(camera,false);string image=Path.Combine(output,"U-source-baseline.png");Capture(camera,image);report.images.Add(image);View(camera,true);image=Path.Combine(output,"U-source-tread-baseline-close.png");Capture(camera,image);report.images.Add(image);
                View(camera,false);report.baselineScene=PersistScene(baseline,folder,"U-source-baseline");
                var changed=Build(route,changedKit);var changedGeometry=changed.transform.Find("__RouteGeometry").gameObject;var after=Meshes(changedGeometry);report.changed=Facts(changedGeometry);report.changedMapping=changed.MappingJson;
                Need(changed.DocumentJson==report.routeJson,"source change does not rewrite author U route",report.checks);
                baseline.gameObject.SetActive(false);
                foreach(var pair in before)
                {
                    Need(after.ContainsKey(pair.Key),"changed kit retains generated role "+pair.Key,report.checks);
                    bool same=ResearchKitImporter.MeshFingerprint(pair.Value)==ResearchKitImporter.MeshFingerprint(after[pair.Key]);
                    Need(pair.Key=="tread"?!same:same,pair.Key=="tread"?"changed source affects actual generated tread chunk":"unrelated generated chunk unchanged: "+pair.Key,report.checks);
                }
                var bv=before["tread"].vertices;var av=after["tread"].vertices;Need(bv.Length==av.Length,"controlled position edit preserves generated topology size",report.checks);
                var changedIndices=new List<int>();for(int i=0;i<bv.Length;i++)if((bv[i]-av[i]).sqrMagnitude>1e-10f){if(Mathf.Abs(bv[i].x-av[i].x)>=.00001f||Mathf.Abs(bv[i].z-av[i].z)>=.00001f)throw new InvalidOperationException("Controlled vertex changed more than vertical position.");changedIndices.Add(i);}
                report.changedTreadVertexIndices=changedIndices.ToArray();report.mappedTreadFirstVertices=tread.Select(p=>p.firstVertex).ToArray();
                Need(report.changedTreadVertexIndices.SequenceEqual(report.mappedTreadFirstVertices),"every changed generated vertex matches source vertex zero in the mapped repeated tread fragments",report.checks);
                var changedMap=JsonUtility.FromJson<CurveMapping>(changed.MappingJson);string expectedHash=changedKit.Bindings.Single(b=>b.Role=="tread").ModelSha256;
                Need(changedMap.placements.Where(p=>p.role=="tread").All(p=>p.sourceHash==expectedHash),"changed actual source fingerprint propagates to all affected fragment mappings",report.checks);
                View(camera,false);image=Path.Combine(output,"U-source-changed.png");Capture(camera,image);report.images.Add(image);View(camera,true);image=Path.Combine(output,"U-source-tread-changed-close.png");Capture(camera,image);report.images.Add(image);
                // Save only the variant under test in each native scene.
                baseline.gameObject.SetActive(true);changed.gameObject.SetActive(false);ReplicaGeometry.Destroy(changed.gameObject);
                EditorSceneManager.OpenScene(report.baselineScene);baseline=UnityEngine.Object.FindObjectOfType<ReplicaAuthor>();camera=UnityEngine.Object.FindObjectOfType<Camera>();
                Need(baseline!=null&&baseline.DocumentJson==report.routeJson,"native baseline scene retains editable route authority",report.checks);
                var rebuilt=CurveGeometry.Build(CurveSolver.Solve(baseline.Read()),Load(report.kitPath));var rebuiltFacts=Facts(rebuilt);
                Need(rebuiltFacts.Select(x=>x.meshFingerprint).SequenceEqual(report.baseline.Select(x=>x.meshFingerprint)),"same-engine native reopen source route rebuild reproduces all generated chunks",report.checks);ReplicaGeometry.Destroy(rebuilt);
                // Produce an independent changed scene after the baseline reopen, then leave baseline saved.
                changed=Build(route,Load(report.changedKitPath));UnityEngine.Object.DestroyImmediate(baseline.gameObject);report.changedScene=PersistScene(changed,folder,"U-source-changed");
                EditorSceneManager.OpenScene(report.baselineScene);report.status="PASS";
            }
            catch(Exception e){report.error=e.ToString();throw;}
            finally{File.WriteAllText(Path.Combine(output,"source-consumption-result.json"),JsonUtility.ToJson(report,true));}
        }
        public static void Reopen()
        {
            var report=new ReopenReport();string output=Output;
            try
            {
                var previous=JsonUtility.FromJson<Report>(File.ReadAllText(Path.Combine(output,"source-consumption-result.json")));
                Need(previous!=null&&previous.status=="PASS","actual consumption comparison passed before independent reopen",report.checks);
                report.scene=previous.baselineScene;EditorSceneManager.OpenScene(report.scene);var author=UnityEngine.Object.FindObjectOfType<ReplicaAuthor>();
                Need(author!=null&&author.DocumentJson==previous.routeJson,"independent process native scene preserves editable route JSON",report.checks);ResearchKitImporter.Validate(author.Kit);
                var facts=Facts(author.transform.Find("__RouteGeometry").gameObject);Need(facts.Select(x=>x.meshFingerprint).SequenceEqual(previous.baseline.Select(x=>x.meshFingerprint)),"independent process persistent generated Mesh fingerprints match baseline",report.checks);
                var rebuilt=CurveGeometry.Build(CurveSolver.Solve(author.Read()),author.Kit);Need(Facts(rebuilt).Select(x=>x.meshFingerprint).SequenceEqual(previous.baseline.Select(x=>x.meshFingerprint)),"independent process route and real source Mesh regenerate identical geometry",report.checks);report.route=author.DocumentJson;report.mesh=ReplicaGeometry.Fingerprint(rebuilt);ReplicaGeometry.Destroy(rebuilt);report.status="PASS";
            }
            catch(Exception e){report.error=e.ToString();throw;}
            finally{File.WriteAllText(Path.Combine(output,"source-consumption-reopen.json"),JsonUtility.ToJson(report,true));}
        }
    }
}
