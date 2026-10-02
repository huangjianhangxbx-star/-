using System;
using System.IO;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using System.Linq;
namespace Xinghai.MapEditor.Editor {
 public static class BuildProof {
  public static void Run(){try{
   EditorSceneManager.OpenScene("Assets/CompleteProof.unity");
   foreach(var name in new[]{"Proof camera","Sun","Proof player"}) {var old=GameObject.Find(name);if(old!=null)UnityEngine.Object.DestroyImmediate(old);}
   PlayerSettings.runInBackground=true;
   var events=UnityEngine.Object.FindObjectsOfType<SampleEvent>();if(events.Length!=2||events[0].Identity==events[1].Identity)throw new Exception("Reopened event identities invalid");
   var cam=new GameObject("Proof camera").AddComponent<Camera>();cam.transform.position=new Vector3(8,9,-10);cam.transform.LookAt(new Vector3(2.5f,0,0));cam.clearFlags=CameraClearFlags.SolidColor;cam.backgroundColor=new Color(.07f,.1f,.14f);cam.orthographic=true;cam.orthographicSize=5;
   var sun=new GameObject("Sun").AddComponent<Light>();sun.type=LightType.Directional;sun.transform.rotation=Quaternion.Euler(50,-35,0);sun.intensity=1.3f;RenderSettings.ambientLight=new Color(.35f,.4f,.5f);
   new GameObject("Proof player").AddComponent<ProofPlayer>();
   EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),"Assets/CompleteProof.unity");AssetDatabase.SaveAssets();
   EditorSceneManager.OpenScene("Assets/CompleteProof.unity");
   if(UnityEngine.Object.FindObjectOfType<ProofPlayer>()==null || UnityEngine.Object.FindObjectOfType<Camera>()==null)throw new Exception("Runtime proof objects not persisted");
   Directory.CreateDirectory("../build");
   var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{"Assets/CompleteProof.unity"},locationPathName="../build/MapProof.exe",target=BuildTarget.StandaloneWindows64,options=BuildOptions.None});
   File.WriteAllText("../logs/build-result.json","{\"result\":\""+report.summary.result+"\",\"errors\":"+report.summary.totalErrors+"}");
   if(report.summary.result!=BuildResult.Succeeded)throw new Exception("Player build failed");
   Directory.CreateDirectory("../../release");var runtime=Directory.GetFiles("Assets/XinghaiMap/Runtime").Where(p=>!p.EndsWith(".meta")&&!p.EndsWith("ProofPlayer.cs")).Select(p=>p.Replace('\\','/'));var editor=new[]{"BakeWindow","MapBaker","BakeJournal","SourceReader","PlacementIdentity"}.Select(n=>"Assets/XinghaiMap/Editor/"+n+".cs");AssetDatabase.ExportPackage(runtime.Concat(editor).ToArray(),"../../release/星骸地图团结插件.unitypackage",ExportPackageOptions.Default);
   Debug.Log("XH_BUILD_PASS");EditorApplication.Exit(0);
  }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
 }
}
