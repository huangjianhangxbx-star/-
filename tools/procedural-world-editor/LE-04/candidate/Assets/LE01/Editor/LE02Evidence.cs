using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public static class LE02Evidence
    {
        public const string ScenePath="Assets/LE02/Scenes/BrushCapabilities_719.unity";
        public static string Root {get{return Path.Combine(Directory.GetParent(LE01Export.TaskRoot).FullName,"LE-02");}}
        [Serializable] public sealed class Check {public string name,status,detail;}
        [Serializable] public sealed class Frame {public string name,path,authorHash,meshHash;public int leaves,triangles;}
        [Serializable] public sealed class Report
        {
            public string status="FAIL",engine,utc,sourceHash,shaderHash,authorHash,meshHash,native,scene=ScenePath;
            public string scope="Actual Unity production controller, Physics, meshes and rendered images; controlled input, not physical mouse or GUI latency.";
            public List<Check> checks=new List<Check>();public List<Frame> images=new List<Frame>();
        }
        static Report report;
        public static string ShaderHash(){using(var hash=System.Security.Cryptography.SHA256.Create()){var text=string.Join("\n",Directory.GetFiles(Path.Combine(Application.dataPath,"LE01"),"*.shader",SearchOption.AllDirectories).OrderBy(p=>p).Select(File.ReadAllText));return BitConverter.ToString(hash.ComputeHash(System.Text.Encoding.UTF8.GetBytes(text))).Replace("-","");}}
        static void Begin(){foreach(string folder in new[]{"reports","samples","samples/screenshots","exports"})Directory.CreateDirectory(Path.Combine(Root,folder));report=new Report{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O"),sourceHash=LE01BEvidence.SourceHash(),shaderHash=ShaderHash()};}
        static void Require(bool yes,string name,string detail=""){report.checks.Add(new Check{name=name,status=yes?"PASS":"FAIL",detail=detail});if(!yes)throw new InvalidOperationException(name+" "+detail);Debug.Log("LE02_EVIDENCE_PASS "+name);}
        static void SaveReport(string name){File.WriteAllText(Path.Combine(Root,"reports/"+name+".json"),JsonUtility.ToJson(report,true));}
        static LE01TerrainAuthor Blank(string id,int bottom=-64)
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.35f,.35f,.35f);RenderSettings.skybox=null;RenderSettings.fog=false;
            var light=new GameObject("LE02_Key").AddComponent<Light>();light.type=LightType.Directional;light.intensity=.9f;light.transform.rotation=Quaternion.Euler(35,-48,0);light.shadows=LightShadows.Soft;
            var doc=TerrainGenerators.UpgradeToV3(new TerrainDocument{Id=id,BaseHeight=bottom,ActiveQuantum=2,Seed=719});
            var author=new GameObject("LE02_Terrain").AddComponent<LE01TerrainAuthor>();author.Write(doc);return author;
        }
        static void Drain(LE01Stroke stroke,bool previewOnly=false)
        {
            var timer=System.Diagnostics.Stopwatch.StartNew();
            while(stroke.Busy&&!stroke.PendingConfirmation&&timer.ElapsedMilliseconds<20000){stroke.Tick();Thread.Sleep(2);}
            Require(!stroke.ReleasePending&&(!stroke.Busy||previewOnly&&stroke.PendingConfirmation),"asynchronous stroke settles",stroke.Status);
        }
        static void Extend(LE01TerrainAuthor author,params Vector3[] points)
        {
            var brush=new LE01Stroke{Author=author,Mode=BrushMode.Extend,Radius=3,Quantum=2,PlaneHeight=0};
            Require(brush.Begin(points[0],100),"drawing from empty author begins");foreach(var p in points.Skip(1))brush.Drag(p,100);brush.RequestEnd();Drain(brush);Require(author.Read().Cells.Count>0,"drawn author contains real terrain");
        }
        static void Height(LE01TerrainAuthor author,BrushMode mode,Vector3 point,float radius,float falloff,float strength)
        {
            var brush=new LE01Stroke{Author=author,Mode=mode,Radius=radius,Falloff=falloff,HeightStrength=strength,Quantum=2};
            Require(brush.Begin(point,100),"gradual height stroke begins");brush.RequestEnd();Drain(brush);
        }
        static SurfaceHit Pick(LE01TerrainAuthor author,float x,float y)
        {
            SurfaceHit hit;string message;Require(LE01Adapter.TryPickSculpt(author,new Ray(author.transform.position+new Vector3(x,y,-14),Vector3.forward),out hit,out message),"actual visible deformed wall is pickable",message);
            Require(!string.IsNullOrEmpty(hit.BoundaryKey),"actual triangle has original boundary identity");return hit;
        }
        static LE01Stroke Shape(LE01TerrainAuthor author,float x,float y,float amount,string id,bool candidate=false)
        {
            var brush=new LE01Stroke{Author=author,Mode=BrushMode.SculptShape,Radius=.8f,SculptStrength=amount,SculptScope=SculptInfluence.HeightRange,SculptMinHeight=-56,SculptMaxHeight=-8,SculptPreviewOnly=candidate};
            Require(brush.BeginSculpt(Pick(author,x,y),new Vector2(100,100)),"wall shape begins");brush.Command.EditId=id;brush.RequestEnd();Drain(brush,candidate);return brush;
        }
        static void Set(LE01TerrainAuthor author,TerrainDocument doc){author.Write(doc.Copy());LE01Adapter.Upload(author,TerrainCompiler.Build(author.Read()),true,true);Physics.SyncTransforms();}
        static void Native(LE01TerrainAuthor author,string name){string file=Path.Combine(Root,"samples/"+name+".leterrain.json");LE01Adapter.NativeSave(author,file);Require(TerrainQueries.ContentHash(LE01Adapter.NativeLoad(file))==TerrainQueries.ContentHash(author.Read()),"native saves and reads "+name);}
        static void Capture(LE01TerrainAuthor author,string name,Bounds bounds,string view="oblique",string thumbnail=null,Action overlay=null)
        {
            var go=new GameObject("LE02_EvidenceCamera");var camera=go.AddComponent<Camera>();int width=thumbnail==null?1200:480,height=thumbnail==null?900:360;
            var target=new RenderTexture(width,height,24,RenderTextureFormat.ARGB32);var pixels=new Texture2D(width,height,TextureFormat.RGB24,false);var previous=RenderTexture.active;var previousEvent=Event.current;
            string relative="samples/screenshots/"+name+".png";
            try
            {
                camera.orthographic=true;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.16f,.18f,.20f);camera.transform.rotation=Quaternion.Euler(view=="side"?0:28,view=="side"?0:-28,0);
                camera.orthographicSize=Mathf.Max(bounds.size.x*.49f,bounds.size.y*.7f,bounds.size.z*.6f);camera.transform.position=bounds.center-camera.transform.forward*40;camera.nearClipPlane=.1f;camera.farClipPlane=100;camera.targetTexture=target;LE02OffscreenRender.Render(camera,overlay);
                RenderTexture.active=target;pixels.ReadPixels(new Rect(0,0,width,height),0,0);pixels.Apply();File.WriteAllBytes(Path.Combine(Root,relative),pixels.EncodeToPNG());
                if(thumbnail!=null){LE01Export.Folder("Assets/LE02/Thumbnails");File.WriteAllBytes("Assets/LE02/Thumbnails/"+thumbnail+".png",pixels.EncodeToPNG());AssetDatabase.ImportAsset("Assets/LE02/Thumbnails/"+thumbnail+".png",ImportAssetOptions.ForceSynchronousImport);}
                report.images.Add(new Frame{name=name,path=relative,authorHash=TerrainQueries.ContentHash(author.Read()),meshHash=LE01CEvidence.MeshFingerprint(author),leaves=author.Read().Cells.Count,triangles=LE01Adapter.Geometry(author).GetComponentsInChildren<MeshFilter>().Sum(f=>f.sharedMesh.triangles.Length/3)});
            }
            finally{Event.current=previousEvent;RenderTexture.active=previous;UnityEngine.Object.DestroyImmediate(pixels);UnityEngine.Object.DestroyImmediate(target);UnityEngine.Object.DestroyImmediate(go);}
        }
        public static void BuildExamples()
        {
            Begin();
            try
            {
                var author=Blank("BrushCapabilities_719");Extend(author,new Vector3(-4,0,0),new Vector3(4,0,0));var original=author.Read();var bounds=LE01Adapter.Bounds(author);
                foreach(var preset in TerrainRockPresets.All){var choice=TerrainRockPresets.Apply(original,preset.Id);Require(!choice.Rejected,"procedural preset applies "+preset.Id);Set(author,choice.Document);Capture(author,"preset-"+preset.Id,bounds,"oblique",preset.Id);Native(author,"Preset_"+preset.Id);}
                Set(author,original);Capture(author,"wall-before",bounds,"side");Capture(author,"wall-before-oblique",bounds);Native(author,"Original_719");
                var outward=Shape(author,2,-2,.875f,"middle-bulge");Require(author.Read().SculptOverrides.Any(o=>o.Kind==SculptKind.Shape&&o.Value>0),"outward intent is committed");Capture(author,"wall-middle-bulge",bounds,"side");Capture(author,"wall-middle-bulge-oblique",bounds);Native(author,"MiddleBulge_719");LE01Export.Export(LE01Adapter.Geometry(author),Path.Combine(Root,"exports/MiddleBulge_719.fbx"));
                string changed=TerrainQueries.ContentHash(author.Read());Undo.PerformUndo();outward.UndoChanged();Require(TerrainQueries.ContentHash(author.Read())==TerrainQueries.ContentHash(original),"one Undo restores wall author");Undo.PerformRedo();outward.UndoChanged();Require(TerrainQueries.ContentHash(author.Read())==changed,"one Redo restores outward author");
                string mesh=LE01CEvidence.MeshFingerprint(author);var candidate=Shape(author,-2,-2,-.5f,"cancelled-inset",true);Require(candidate.PendingConfirmation,"preview candidate waits for confirmation");candidate.Handle(LE01InputKind.Escape,Vector3.zero,0);Require(TerrainQueries.ContentHash(author.Read())==changed&&LE01CEvidence.MeshFingerprint(author)==mesh,"candidate Escape restores exact committed geometry");
                Set(author,original);Shape(author,2,-2,-.5f,"middle-inset");Capture(author,"wall-middle-inset",bounds,"side");Native(author,"ThinnerWall_719");
                Set(author,original);Height(author,BrushMode.SmoothRaise,new Vector3(-3,0,0),.75f,2.25f,1.5f);Capture(author,"gradual-hill",LE01Adapter.Bounds(author));Native(author,"Slope_719");LE01Export.Export(LE01Adapter.Geometry(author),Path.Combine(Root,"exports/Slope_719.fbx"));
                Capture(author,"surface-range",LE01Adapter.Bounds(author),"oblique",null,()=>LE02BrushOverlay.DrawHeightRange(author,new Vector3(-3,1.5f,0),.75f,2.25f,0,false,true,false,requireSceneRepaint:false));
                Set(author,original);Height(author,BrushMode.SmoothLower,new Vector3(-3,0,0),.75f,2.25f,.875f);Capture(author,"gradual-depression",bounds);Native(author,"ShallowDepression_719");
                Set(author,original);Height(author,BrushMode.SmoothRaise,new Vector3(-3,0,0),.75f,2.25f,1.5f);Shape(author,2,-2,.875f,"playground-middle-bulge");
                var hit=Pick(author,2,-2);var selection=TerrainStructures.Prepare(author.Read()).ResolveHit(hit,.8f,SculptInfluence.HeightRange,-56,-8);
                Capture(author,"wall-surface-range",LE01Adapter.Bounds(author),"oblique",null,()=>LE02BrushOverlay.DrawSculpt(author,selection,f=>LE01Adapter.SurfaceBoundaryKeys(author,f),false,requireSceneRepaint:false));
                Capture(author,"playground-final",LE01Adapter.Bounds(author));Native(author,"BrushCapabilities_719");
                report.native="samples/BrushCapabilities_719.leterrain.json";report.authorHash=TerrainQueries.ContentHash(author.Read());LE01Adapter.SaveSceneMeshes(author,ScenePath);report.meshHash=LE01CEvidence.MeshFingerprint(author);report.status="PASS";
            }
            catch(Exception error){report.checks.Add(new Check{name="uncaught",status="FAIL",detail=error.ToString()});throw;}
            finally{SaveReport("workflow-validation");AssetDatabase.SaveAssets();}
            Debug.Log("LE02_EXAMPLES_COMPLETE");
        }
        public static void Reopen()
        {
            var old=JsonUtility.FromJson<Report>(File.ReadAllText(Path.Combine(Root,"reports/workflow-validation.json")));Begin();
            try
            {
                EditorSceneManager.OpenScene(ScenePath);var author=UnityEngine.Object.FindObjectOfType<LE01TerrainAuthor>();Require(author!=null,"new process reopens author");
                Require(TerrainQueries.ContentHash(author.Read())==old.authorHash&&TerrainQueries.ContentHash(LE01Adapter.NativeLoad(Path.Combine(Root,old.native)))==old.authorHash,"new process scene and native match original author");
                Require(LE01CEvidence.MeshFingerprint(author)==old.meshHash,"new process actual mesh arrays match");Require(author.Read().GeneratorVersion=="le01.3"&&author.Read().SculptOverrides.Any(o=>o.Kind==SculptKind.Shape&&o.Version==2),"new shape schema survives save");
                var hit=Pick(author,2,-2);Require(TerrainStructures.ResolveHit(author.Read(),hit,.8f,SculptInfluence.HeightRange,-56,-8).Valid,"persisted outward wall binds actual triangle identity");
                Height(author,BrushMode.SmoothLower,new Vector3(-3,1.5f,0),.5f,.5f,.25f);Native(author,"BrushCapabilities_719_continued");Require(author.Read().SculptOverrides.Any(o=>o.EditId=="playground-middle-bulge"),"continued height editing preserves distant outward intent");
                report.authorHash=TerrainQueries.ContentHash(author.Read());report.meshHash=LE01CEvidence.MeshFingerprint(author);report.status="PASS";
            }
            catch(Exception error){report.checks.Add(new Check{name="uncaught",status="FAIL",detail=error.ToString()});throw;}
            finally{SaveReport("new-process-workflow");}Debug.Log("LE02_REOPEN_COMPLETE");
        }
    }
}
