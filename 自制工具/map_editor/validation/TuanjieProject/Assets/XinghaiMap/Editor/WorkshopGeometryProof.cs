using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Globalization;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
namespace Xinghai.MapEditor.Editor {
 public static class WorkshopGeometryProof {
  static string Key(float x,float y,float z)=>string.Join(",",new[]{x,y,z}.Select(v=>Math.Round(v,4).ToString("0.0000",CultureInfo.InvariantCulture)));
  public static void Run(){try{
   EditorSceneManager.NewScene(NewSceneSetup.EmptyScene);var expected=JObject.Parse(File.ReadAllText("../workshop-task8/expected-unity-vertices.json"));var results=new JObject();
   foreach(string name in new[]{"a","b"}){string manifest=name=="a"?"../workshop-task7/real-project/releases/fbx-proof/manifest.json":"../workshop-task8/packages/releases/version-b/manifest.json";var received=SceneBaker.Bake(PublishReader.Read(manifest),new ReceiveOptions());var obj=(GameObject)PrefabUtility.InstantiatePrefab(received.prefab);var actual=new HashSet<string>();foreach(var filter in obj.GetComponentsInChildren<MeshFilter>())foreach(var vertex in filter.sharedMesh.vertices){Vector3 p=filter.transform.TransformPoint(vertex);actual.Add(Key(p.x,p.y,p.z));}var wanted=new HashSet<string>(expected[name].Select(p=>Key((float)p[0],(float)p[1],(float)p[2])));WorkshopPublishProof.Check(actual.SetEquals(wanted),"Geometry differs "+name+" actual-only="+string.Join(";",actual.Except(wanted).Take(5))+" expected-only="+string.Join(";",wanted.Except(actual).Take(5)));results[name]=new JObject{["worldVertexSetEqual"]=true,["vertices"]=actual.Count};obj.transform.position+=name=="a"?new Vector3(0,0,0):new Vector3(0,0,8);}
   var light=new GameObject("Proof Light").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1;light.transform.rotation=Quaternion.Euler(45,35,0);RenderSettings.ambientLight=new Color(.6f,.6f,.6f);var camera=new GameObject("Proof Camera").AddComponent<Camera>();camera.backgroundColor=new Color(.05f,.07f,.09f);camera.clearFlags=CameraClearFlags.SolidColor;camera.orthographic=true;camera.orthographicSize=9;camera.transform.position=new Vector3(13,16,-15);camera.transform.LookAt(new Vector3(2,1,4));var render=new RenderTexture(1440,900,24);camera.targetTexture=render;camera.Render();RenderTexture.active=render;var image=new Texture2D(1440,900,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();File.WriteAllBytes("../workshop-task8/unity-visual.png",image.EncodeToPNG());RenderTexture.active=null;camera.targetTexture=null;render.Release();UnityEngine.Object.DestroyImmediate(render);UnityEngine.Object.DestroyImmediate(image);results["passed"]=true;results["version"]=Application.unityVersion;File.WriteAllText("../workshop-task8/unity-geometry-proof.json",results.ToString());Debug.Log("XH_WORKSHOP_GEOMETRY_PASS");EditorApplication.Exit(0);
  }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
 }
}
