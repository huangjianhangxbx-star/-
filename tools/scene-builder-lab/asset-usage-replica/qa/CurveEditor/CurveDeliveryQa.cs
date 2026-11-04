using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.BridgeReplica.Editor;

namespace XingHai.BridgeReplica.QA
{
    // Run only in the existing temporary QA project, after the targeted tests.
    // This creates one useful public scene and an actual dependency whitelist;
    // it does not deploy, start a new project, or certify desktop input/T11.
    public static class CurveDeliveryQa
    {
        const string ScenePath="Assets/BridgeReplica/Scenes/CurveWorkflow.unity";
        [Serializable] sealed class FileRecord { public string relativePath,sha256; public long bytes; }
        [Serializable] sealed class AuthorRecord { public string name,id,kitId,kitVersion,document,mesh; public Vector3 position; }
        [Serializable] sealed class Report
        {
            public string status="FAIL",date,engine,scene=ScenePath,error,productionSourceHash;
            public string scope="Public original A/B editable delivery sample and actual AssetDatabase dependency whitelist. Physical drawing T3 and original-game behavior T11 remain deferred.";
            public bool physicalInput=false,originalGameBehavior=false,researchArtifactsIncluded=false;
            public string screenshot="samples/curve-v02/CurveWorkflow.png";
            public string[] closure,builtinOrPackageDependencies;
            public List<FileRecord> files=new List<FileRecord>(),productionSources=new List<FileRecord>();
            public List<AuthorRecord> authors=new List<AuthorRecord>();
        }
        static string Output {get{return Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required.");}}
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException(message);}
        static string Hash(string file){return ReplicaKitRegistry.Hash(File.ReadAllBytes(file));}
        static FileRecord Record(string path)
        {Need(File.Exists(path),"Missing whitelist file: "+path);return new FileRecord{relativePath=path.Replace('\\','/'),sha256=Hash(path),bytes=new FileInfo(path).Length};}
        static string SourceHash(IEnumerable<FileRecord> sources)
        {return ReplicaKitRegistry.Hash(Encoding.UTF8.GetBytes(string.Join("\n",sources.OrderBy(s=>s.relativePath,StringComparer.Ordinal).Select(s=>s.relativePath+"|"+s.sha256).ToArray())));}
        static ReplicaAuthor Create(string name,string id,RouteDocument document,ReplicaKit kit,Vector3 position)
        {
            var author=new GameObject(name).AddComponent<ReplicaAuthor>();author.transform.position=position;
            document=document.Clone();document.Id=id;var session=ReplicaSession.Get(author);
            Need(session.Preview(document,kit)&&session.ApplyNew(),name+": "+session.Status);return author;
        }
        static void AddWithMetadata(HashSet<string> files,string path)
        {
            files.Add(path);Need(File.Exists(path+".meta"),"Missing GUID metadata: "+path);files.Add(path+".meta");
            string folder=Path.GetDirectoryName(path).Replace('\\','/');
            while(folder!="Assets")
            {if(File.Exists(folder+".meta"))files.Add(folder+".meta");folder=Path.GetDirectoryName(folder).Replace('\\','/');}
        }
        static Bounds AuthorBounds(IEnumerable<ReplicaAuthor> authors)
        {
            bool first=true;var bounds=new Bounds();
            foreach(var renderer in authors.SelectMany(a=>a.GetComponentsInChildren<Renderer>()))
            {if(first){bounds=renderer.bounds;first=false;}else bounds.Encapsulate(renderer.bounds);}
            Need(!first,"Delivery scene has no visible bridge geometry.");return bounds;
        }
        static Camera Presentation(Bounds bounds)
        {
            RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.56f,.59f,.61f);RenderSettings.skybox=null;
            var light=new GameObject("Sun").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.15f;light.transform.rotation=Quaternion.Euler(48,-35,0);
            const string materialPath="Assets/BridgeReplica/Materials/CurveWorkflowGround.mat";var material=AssetDatabase.LoadAssetAtPath<Material>(materialPath);
            if(material==null){ReplicaKitRegistry.Folder("Assets/BridgeReplica/Materials");material=new Material(Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard"));material.color=new Color(.39f,.45f,.4f);if(material.HasProperty("_BaseColor"))material.SetColor("_BaseColor",material.color);if(material.HasProperty("_Smoothness"))material.SetFloat("_Smoothness",0);AssetDatabase.CreateAsset(material,materialPath);}
            var ground=GameObject.CreatePrimitive(PrimitiveType.Cube);ground.name="Ground";ground.transform.position=new Vector3(bounds.center.x,-.2f,bounds.center.z);ground.transform.localScale=new Vector3(bounds.size.x+12,.25f,bounds.size.z+12);ground.GetComponent<Renderer>().sharedMaterial=material;
            var camera=new GameObject("Main Camera").AddComponent<Camera>();camera.tag="MainCamera";camera.orthographic=true;camera.aspect=1.6f;camera.orthographicSize=Mathf.Max(bounds.extents.x/camera.aspect,bounds.extents.z*.85f+bounds.extents.y*.5f)+4;
            camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.59f,.69f,.73f);camera.nearClipPlane=.1f;camera.farClipPlane=300;camera.allowHDR=false;camera.allowMSAA=false;
            camera.transform.position=bounds.center+new Vector3(0,48,-56);camera.transform.LookAt(bounds.center);camera.gameObject.AddComponent<AudioListener>();return camera;
        }
        static void Capture(Camera camera,string path)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path));ShaderUtil.allowAsyncCompilation=false;
            var target=new RenderTexture(1440,900,24);var texture=new Texture2D(1440,900,TextureFormat.RGB24,false);var previous=RenderTexture.active;
            try{camera.targetTexture=target;camera.Render();camera.Render();RenderTexture.active=target;texture.ReadPixels(new Rect(0,0,1440,900),0,0);texture.Apply();File.WriteAllBytes(path,texture.EncodeToPNG());}
            finally{camera.targetTexture=null;RenderTexture.active=previous;UnityEngine.Object.DestroyImmediate(texture);UnityEngine.Object.DestroyImmediate(target);}
        }
        public static void Run()
        {
            Need(Application.isBatchMode,"Delivery sample may only be generated in the existing background QA project.");
            var report=new Report{date=DateTimeOffset.Now.ToString("o"),engine=Application.unityVersion};
            try
            {
                Need(Path.GetFullPath(Application.dataPath).Replace('\\','/').EndsWith("/qa/unity-session/Assets",StringComparison.OrdinalIgnoreCase),"Refusing to replace a scene in the actual user project.");
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
                var kitA=ReplicaKitRegistry.EnsureBase();var kitB=ReplicaKitRegistry.Register(Path.Combine(Output,"kits/B/kit-manifest.json"));
                Need(!kitA.ResearchOnly&&!kitB.ResearchOnly,"Public sample must use original A/B source kits.");
                var authors=new[]{
                    Create("01_斜线桥_A_可编辑","delivery.v02.diagonal.A",CurveExamples.Diagonal(),kitA,new Vector3(-32,0,-18)),
                    Create("02_U形桥_A_直段桥洞","delivery.v02.U.A",CurveExamples.U(),kitA,new Vector3(-30,0,0)),
                    Create("03_S形桥_B_可从末端续画","delivery.v02.S.B",CurveExamples.S(),kitB,new Vector3(-2,0,0))};
                var camera=Presentation(AuthorBounds(authors));ReplicaFiles.SaveScene(ScenePath);AssetDatabase.SaveAssets();AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
                foreach(var author in authors)
                {
                    Need(author.GetComponentsInChildren<MeshFilter>().All(f=>AssetDatabase.Contains(f.sharedMesh)),"Scene still contains transient author meshes.");
                    report.authors.Add(new AuthorRecord{name=author.name,id=author.Read().Id,kitId=author.Kit.Id,kitVersion=author.Kit.Version,position=author.transform.position,document=author.DocumentJson,mesh=ReplicaGeometry.Fingerprint(author.transform.Find("__RouteGeometry").gameObject)});
                }
                var closure=ReplicaPublicExport.ValidateClosure(new[]{ScenePath});report.closure=closure;
                Need(!closure.Any(p=>p.Contains("/Editor/QA/")||p.Contains("/ResearchPrivate/")),"Public dependency closure includes test or private artifacts.");
                var files=new HashSet<string>(StringComparer.Ordinal);
                foreach(string path in closure.Where(p=>p.StartsWith("Assets/",StringComparison.Ordinal)))AddWithMetadata(files,path);
                report.builtinOrPackageDependencies=closure.Where(p=>!p.StartsWith("Assets/",StringComparison.Ordinal)).ToArray();
                foreach(string path in Directory.GetFiles("Assets/BridgeReplica","*.cs",SearchOption.AllDirectories).Select(p=>p.Replace('\\','/')).Where(p=>!p.Contains("/Editor/QA/")&&!p.Contains("/ResearchPrivate/")).OrderBy(p=>p,StringComparer.Ordinal))
                {report.productionSources.Add(Record(path));AddWithMetadata(files,path);}
                report.productionSourceHash=SourceHash(report.productionSources);
                report.files=files.OrderBy(p=>p,StringComparer.Ordinal).Select(Record).ToList();
                Need(report.files.All(f=>!f.relativePath.Contains("/ResearchPrivate/")&&!f.relativePath.Contains("/Editor/QA/")),"Private/test file entered public whitelist.");
                Capture(camera,Path.Combine(Output,report.screenshot));report.status="PASS";
            }
            catch(Exception error){report.error=error.ToString();}
            Directory.CreateDirectory(Path.Combine(Output,"reports"));File.WriteAllText(Path.Combine(Output,"reports/v02-delivery-public.json"),JsonUtility.ToJson(report,true));
            Debug.Log("CURVE_DELIVERY "+report.status+" "+report.error);EditorApplication.Exit(report.status=="PASS"?0:1);
        }
    }
}
