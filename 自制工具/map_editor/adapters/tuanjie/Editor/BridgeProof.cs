using System;
using System.IO;
using UnityEngine;
using UnityEditor;
namespace Xinghai.MapEditor.Editor {
 public static class BridgeProof {
  public static void Run(){try{
   var d=JsonUtility.FromJson<MapDocument>(File.ReadAllText("Assets/Fixtures/bridge.json"));
   if(SurfaceMesher.FaceCount(d)!=30)throw new Exception("Bridge needs 30 exposed faces");
   var prefab=MapBaker.Bake(d,"Assets/Generated/bridge");var mesh=prefab.GetComponentInChildren<MeshFilter>().sharedMesh;
   if(mesh.triangles.Length!=180)throw new Exception("Bridge must retain 60 triangles before greedy merging");
   bool bottom=false;var vertices=mesh.vertices;var normals=mesh.normals;
   for(int i=0;i<vertices.Length;i++)if(normals[i]==Vector3.down&&Mathf.Abs(vertices[i].y-.5f)<.0001f&&vertices[i].x>=.25f&&vertices[i].x<=.5f)bottom=true;
   if(!bottom)throw new Exception("Bridge underside lost");
   AssetDatabase.SaveAssets();File.WriteAllText("../logs/bridge.json","{\"faces\":30,\"underside\":true,\"persisted\":true}");EditorApplication.Exit(0);
  }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
 }
}
