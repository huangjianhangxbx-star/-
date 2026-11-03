using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Threading;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    // Resource regressions for the actual Unity adapter/controller. No synthetic input claim.
    public static class LE02ResourceEditorTests
    {
        [Serializable] sealed class Check { public string name,status,detail; }
        [Serializable] sealed class Report { public string engine,utc,status="PASS";public string scope="Actual Unity author/mesh lifetime and scene-save guard; background controller, not physical GUI";public List<Check> checks=new List<Check>(); }
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException(message);}
        static LE01TerrainAuthor Fixture()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var doc=new TerrainDocument{Id="LE02_ResourceFixture",BaseHeight=-48,ActiveQuantum=2};var paint=new TerrainCommand{Mode=BrushMode.Extend,Radius=2,Quantum=2};paint.Path.Add(new Point2(0,0));
            doc=TerrainGenerators.UpgradeToV3(TerrainKernel.Apply(doc,paint).Document);var author=new GameObject("LE02_ResourceFixture").AddComponent<LE01TerrainAuthor>();author.Write(doc);LE01Adapter.Upload(author,TerrainCompiler.Build(doc),true,true);return author;
        }
        static void WaitPreview(LE01Stroke stroke)
        {
            var timer=System.Diagnostics.Stopwatch.StartNew();while(stroke.Active&&stroke.PreviewUploads==0&&timer.ElapsedMilliseconds<5000){stroke.Tick();Thread.Sleep(3);}Need(stroke.Active&&stroke.PreviewUploads>0,"resource fixture did not upload a real preview");
        }
        static bool GuardContainsReference(LE01TerrainAuthor author)
        {
            foreach(var field in typeof(LE01Stroke).GetFields(BindingFlags.Static|BindingFlags.NonPublic|BindingFlags.Public)){
                object value=field.GetValue(null);var dictionary=value as IDictionary;
                if(dictionary!=null){foreach(object key in dictionary.Keys)if(ReferenceEquals(key,author))return true;}
                else {var sequence=value as IEnumerable;if(sequence!=null)foreach(object item in sequence)if(ReferenceEquals(item,author))return true;}
            }return false;
        }
        public static void SceneSaveDuringActiveRejected()
        {
            var author=Fixture();var stroke=new LE01Stroke{Author=author,Mode=BrushMode.Erase,Radius=.5f};string name="ResourceGuard_"+Guid.NewGuid().ToString("N");string scene="Assets/LE02/Scenes/"+name+".unity",generated="Assets/LE02/Generated/Scenes/"+name;
            Need(!File.Exists(scene)&&!AssetDatabase.IsValidFolder(generated),"resource fixture destination must be new");
            try{
                Need(stroke.Begin(Vector3.zero,0),"resource guard stroke did not start");WaitPreview(stroke);bool denied=false;
                try{LE01Adapter.SaveSceneMeshes(author,scene);}catch(InvalidOperationException){denied=true;}
                Need(denied&&!File.Exists(scene)&&!AssetDatabase.IsValidFolder(generated),"active scene save persisted uncommitted preview geometry or bypassed the author guard");
            }finally{
                stroke.Cancel();if(File.Exists(scene))AssetDatabase.DeleteAsset(scene);if(AssetDatabase.IsValidFolder(generated))AssetDatabase.DeleteAsset(generated);
            }
        }
        public static void DestroyedAuthorReleasesPinnedSnapshot()
        {
            var author=Fixture();int id=author.GetInstanceID();var original=author.GetComponentsInChildren<MeshFilter>()[0].sharedMesh;Need(original!=null&&!AssetDatabase.Contains(original),"resource fixture requires a real nonpersistent committed mesh");
            var stroke=new LE01Stroke{Author=author,Mode=BrushMode.Erase,Radius=.5f};
            try{
                Need(stroke.Begin(Vector3.zero,0),"destroyed-author stroke did not start");WaitPreview(stroke);Need(original!=null,"preview retired the pinned committed mesh early");
                UnityEngine.Object.DestroyImmediate(author.gameObject);stroke.Cancel();
                Need(!stroke.Active&&!GuardContainsReference(author),"destroyed author retained an editing owner/transaction guard");
                Need(original==null,"destroyed author retained a pinned nonpersistent committed mesh after cancellation");
                var field=typeof(LE01Adapter).GetField("committed",BindingFlags.Static|BindingFlags.NonPublic);var snapshots=field==null?null:field.GetValue(null) as IDictionary;
                Need(snapshots==null||!snapshots.Contains(id),"destroyed author retained its committed snapshot entry");
            }finally{stroke.Cancel();LE01Adapter.DiscardCommitted(author);}
        }
        public static void Run()
        {
            var report=new Report{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O")};
            foreach(var action in new Action[]{SceneSaveDuringActiveRejected,DestroyedAuthorReleasesPinnedSnapshot}){
                var check=new Check{name=action.Method.Name,status="PASS"};try{action();}catch(Exception error){check.status="FAIL";check.detail=error.GetBaseException().Message;report.status="FAIL";}report.checks.Add(check);Debug.Log("LE02_RESOURCE_"+check.status+" "+check.name+" "+check.detail);
            }
            string root=Path.GetFullPath(Path.Combine(Application.dataPath,"../../../LE-02/reports"));Directory.CreateDirectory(root);File.WriteAllText(Path.Combine(root,"resource-lifetime.json"),JsonUtility.ToJson(report,true));
            if(report.status!="PASS")throw new InvalidOperationException("LE02 resource/scene-save guards failed");Debug.Log("LE02_RESOURCE_COMPLETE");
        }
    }
}
