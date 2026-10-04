using System;using System.IO;using System.Linq;using System.Collections.Generic;using UnityEngine;using UnityEditor;using Newtonsoft.Json;
namespace Xinghai.MapEditor.Editor {public static class ExchangeM12Proof {
 static float[] V(Vector3 p){return new[]{p.x,p.y,p.z};}
 public static void Run(){try{
  AssetDatabase.Refresh();string path="Assets/M12Exported/axis-color.fbx";AssetDatabase.ImportAsset(path,ImportAssetOptions.ForceUpdate);var model=AssetDatabase.LoadAssetAtPath<GameObject>(path);if(model==null)throw new Exception("FBX import failed");
  var registry=ScriptableObject.CreateInstance<MapRegistry>();registry.bindings=new[]{new AssetBinding{assetId="axis-color",prefab=model,blenderFbxAxes=true}};var doc=new MapDocument{mapId="m12-exchange",cells=new Cell[0],instances=new[]{new Placement{id="axis",assetId="axis-color"}}};var prefab=MapBaker.Bake(doc,"Assets/Generated/m12-exchange",registry);var obj=UnityEngine.Object.Instantiate(prefab);obj.transform.position=Vector3.zero;var items=new List<object>();var bounds=new Bounds();bool first=true;
  foreach(var f in obj.GetComponentsInChildren<MeshFilter>()){
   var mesh=f.sharedMesh;var mats=f.GetComponent<Renderer>().sharedMaterials;
   for(int s=0;s<mesh.subMeshCount;s++){var points=mesh.GetTriangles(s).Select(i=>f.transform.TransformPoint(mesh.vertices[i])).ToArray();var b=new Bounds(points[0],Vector3.zero);foreach(var p in points)b.Encapsulate(p);if(first){bounds=b;first=false;}else bounds.Encapsulate(b);
    var m=mats[s];items.Add(new{name=f.name,material=m.name,shader=m.shader.name,color=new[]{m.color.r,m.color.g,m.color.b,m.color.a},min=V(b.min),max=V(b.max)});
   }
  }
  if(Vector3.Distance(bounds.min,Vector3.zero)>.001f||Vector3.Distance(bounds.max,new Vector3(.75f,1,.5f))>.001f)throw new Exception("Source axes or meters differ after one 180 correction");Directory.CreateDirectory("../m12");File.WriteAllText("../m12/exchange-import.json",JsonConvert.SerializeObject(new{engine=Application.unityVersion,colorSpace=PlayerSettings.colorSpace.ToString(),min=V(bounds.min),max=V(bounds.max),items},Formatting.Indented));
  var camObject=new GameObject("M12 exchange camera");var cam=camObject.AddComponent<Camera>();cam.transform.position=bounds.center+new Vector3(2,1.5f,-2);cam.transform.LookAt(bounds.center);cam.orthographic=true;cam.orthographicSize=.8f;cam.clearFlags=CameraClearFlags.SolidColor;cam.backgroundColor=new Color(.12f,.13f,.16f);var light=new GameObject("M12 light").AddComponent<Light>();light.type=LightType.Directional;light.transform.rotation=Quaternion.Euler(40,-40,0);light.intensity=1.2f;RenderSettings.ambientLight=Color.gray;
  var rt=new RenderTexture(800,800,24);cam.targetTexture=rt;cam.Render();RenderTexture.active=rt;var tex=new Texture2D(800,800,TextureFormat.RGB24,false);tex.ReadPixels(new Rect(0,0,800,800),0,0);tex.Apply();File.WriteAllBytes("../m12/exchange-import.png",tex.EncodeToPNG());RenderTexture.active=null;cam.targetTexture=null;UnityEngine.Object.DestroyImmediate(tex);UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(obj);UnityEngine.Object.DestroyImmediate(camObject);UnityEngine.Object.DestroyImmediate(light.gameObject);
  var gray=AssetDatabase.LoadAllAssetsAtPath(path).OfType<Material>().Single(m=>m.name=="color-0");if(Mathf.Abs(gray.color.r-128f/255f)>.0001f)throw new Exception("Gray is not original sRGB: "+gray.color.r);Debug.Log("M12_EXCHANGE_IMPORTED");EditorApplication.Exit(0);
 }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
}}




