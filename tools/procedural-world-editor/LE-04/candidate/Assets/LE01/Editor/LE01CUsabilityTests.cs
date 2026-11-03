using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    // Dedicated research project only. These are actual Editor entry-point tests, not physical-input evidence.
    public static class LE01CUsabilityTests
    {
        [Serializable] sealed class Case { public string name,status,error; public int assertions; }
        [Serializable] sealed class Summary { public string engine,utc,status,input="Editor entry points and real author/mesh state; not physical mouse";public List<Case> cases=new List<Case>(); }
        static Case current;
        static readonly BindingFlags fields=BindingFlags.Instance|BindingFlags.NonPublic;
        static void Require(bool condition,string message){if(!condition)throw new Exception(message);current.assertions++;}
        static void Set(LE01Window w,string name,object value){typeof(LE01Window).GetField(name,fields).SetValue(w,value);}
        static bool Flag(LE01Window w,string name){return (bool)typeof(LE01Window).GetField(name,fields).GetValue(w);}
        public static void Run()
        {
            var result=new Summary{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O"),status="PASS"};
            Action<string,Action> run=(name,body)=>{current=new Case{name=name,status="PASS"};try{body();}catch(Exception e){current.status="FAIL";current.error=e.GetBaseException().Message;result.status="FAIL";}result.cases.Add(current);Debug.Log("LE01C_USABILITY_"+current.status+" "+name+" "+current.error);};
            run("new-after-sculpt-restores-drawing",NewAfterSculpt);
            run("tall-entry-selects-and-frames-editable-wall",TallEntry);
            run("resume-preserves-author-and-returns-to-view",Resume);
            run("sample-working-copy-preserves-source-on-save",SampleWorkCopyRed);
            run("resume-rebuilds-missing-derived-meshes",MissingMeshRed);
            string folder=Path.Combine(Directory.GetParent(LE01Export.TaskRoot).FullName,"LE-01C/reports");Directory.CreateDirectory(folder);
            File.WriteAllText(Path.Combine(folder,Environment.GetEnvironmentVariable("LE01C_USABILITY_REPORT")??"usability-entry-tests.json"),JsonUtility.ToJson(result,true));
            Debug.Log("LE01C_USABILITY_COMPLETE "+result.status);
            if(result.status!="PASS")throw new Exception("LE01C usability entry checks failed; see report");
        }
        static void NewAfterSculpt()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);LE01Window.Open();var w=LE01Window.Instance;
            w.Controller.Mode=BrushMode.SculptDepth;Set(w,"sculptPage",true);Set(w,"enabledTool",false);Set(w,"continuePick",true);w.Controller.SculptPreviewOnly=true;
            Require(w.NewTerrain(),"new terrain action succeeds in a clean research scene");
            Require(w.Controller.Mode==BrushMode.Extend&&!Flag(w,"sculptPage"),"new terrain must return from rock sculpting to the Extend drawing page");
            Require(Flag(w,"enabledTool")&&!Flag(w,"continuePick")&&!w.Controller.SculptPreviewOnly,"new terrain must resume an immediate drawing stroke, not inherit paused/pick/candidate state");
            Require(w.Controller.Author!=null&&w.Controller.Author.Read().Cells.Count==0,"new terrain starts from an empty editable author");
            Require(w.Controller.Handle(LE01InputKind.Down,Vector3.zero,100),"first drawing stroke starts");w.Controller.Handle(LE01InputKind.Up,Vector3.zero,100);
            Require(w.Controller.Author.Read().Cells.Count>0,"first drawing stroke actually creates terrain instead of using an invalid sculpt selection");
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        }
        static void TallEntry()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);LE01Window.Open();var w=LE01Window.Instance;Set(w,"enabledTool",false);Set(w,"sculptPage",false);w.Controller.Mode=BrushMode.Erase;Selection.activeGameObject=null;
            LE01Window.OpenTall();w=LE01Window.Instance;var a=w.Controller.Author;
            Require(Path.GetFileNameWithoutExtension(SceneManager.GetActiveScene().path).StartsWith("Tall_719",StringComparison.Ordinal),"tall action opens a high-cliff sample scene");
            Require(a!=null&&Selection.activeGameObject==a.gameObject,"sample entry selects the editable author rather than a generated chunk or stale selection");
            Require(Flag(w,"enabledTool")&&Flag(w,"sculptPage")&&w.Controller.Mode==BrushMode.SculptDepth,"high-cliff sample resumes the enabled wall sculpt brush");
            var view=SceneView.lastActiveSceneView;Require(view!=null,"sample entry provides a Scene viewport");
            Require(Vector3.Distance(view.pivot,LE01Adapter.Bounds(a).center)<.01f&&!view.in2DMode,"sample entry frames the terrain in 3D");
        }
        static void Resume()
        {
            var w=LE01Window.Instance;var a=w.Controller.Author;string source=a.DocumentJson,scene=SceneManager.GetActiveScene().path;
            Set(w,"enabledTool",false);Selection.activeGameObject=null;
            var method=typeof(LE01Window).GetMethod("PrepareWorkspace",BindingFlags.Public|BindingFlags.Instance);
            Require(method!=null,"shared workspace entry exists for the start panel");
            Require((bool)method.Invoke(w,new object[]{false}),"continue current terrain succeeds");
            Require(w.Controller.Author==a&&a.DocumentJson==source&&SceneManager.GetActiveScene().path==scene,"continue action preserves the current author and scene contents");
            Require(Selection.activeGameObject==a.gameObject&&Flag(w,"enabledTool")&&!Flag(w,"sculptPage")&&w.Controller.Mode==BrushMode.Extend,"continue returns to an enabled terrain brush and selects its author");
        }
        public static void SampleWorkCopyRed()
        {
            if(current==null)current=new Case{name="sample-working-copy-preserves-source-on-save",status="PASS"};
            const string original="Assets/LE01B/Scenes/Tall_719.unity";var originalBytes=File.ReadAllBytes(original);
            LE01Window.OpenTall();var scene=SceneManager.GetActiveScene();
            Require(scene.path.StartsWith("Assets/LE01C/WorkScenes/",StringComparison.Ordinal),"sample entry opens a separate editable C working scene rather than the retained B source");
            var a=LE01Window.Instance.Controller.Author;var d=a.Read();d.BrushRadius+=.125f;d.Revision++;a.Write(d);EditorUtility.SetDirty(a);EditorSceneManager.MarkSceneDirty(scene);
            Require(EditorSceneManager.SaveScene(scene),"edited sample workspace can be saved normally");
            Require(originalBytes.SequenceEqual(File.ReadAllBytes(original)),"saving sample edits preserves the original scene bytes");
        }
        public static void MissingMeshRed()
        {
            if(current==null)current=new Case{name="resume-rebuilds-missing-derived-meshes",status="PASS"};
            var a=LE01BEditorTests.WallFixture();LE01Window.Open();var w=LE01Window.Instance;string source=a.DocumentJson;
            var filters=LE01Adapter.Geometry(a).GetComponentsInChildren<MeshFilter>();Require(filters.Length>0,"missing-mesh regression starts with real rendered terrain chunks");
            var previous=filters.Select(f=>f.sharedMesh).Where(m=>m!=null).ToArray();foreach(var f in filters)f.sharedMesh=null;foreach(var collider in LE01Adapter.Geometry(a).GetComponentsInChildren<MeshCollider>())collider.sharedMesh=null;
            try{
                Require(w.PrepareWorkspace(false),"continue current terrain accepts an intact author with missing derived meshes");
                var restored=LE01Adapter.Geometry(a).GetComponentsInChildren<MeshFilter>();Require(restored.Length>0&&restored.All(f=>f.sharedMesh!=null&&f.sharedMesh.vertexCount>0),"resume must rebuild missing sharedMesh references even when the author binding is unchanged");
                Require(a.DocumentJson==source,"mesh recovery preserves author intent");
            }finally{foreach(var mesh in previous)if(!AssetDatabase.Contains(mesh))UnityEngine.Object.DestroyImmediate(mesh);}
        }
    }
}
