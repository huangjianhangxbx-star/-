using System;
using System.IO;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
namespace Xinghai.MapEditor.Editor {
 public static class ReopenProof {
  static void Require(bool ok,string msg){if(!ok)throw new Exception(msg);}
  public static void Run() {
   try {
    EditorSceneManager.OpenScene("Assets/Proof.unity");
    var first=GameObject.Find("First module");var second=GameObject.Find("Second module");
    var mesh=first.GetComponentInChildren<MeshFilter>().sharedMesh;
    Require(mesh!=null && mesh.vertexCount>0,"Reopened mesh missing");
    string guid=AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(mesh));
    var d=JsonUtility.FromJson<MapDocument>(File.ReadAllText("Assets/Fixtures/platform.json"));
    var list=new System.Collections.Generic.List<Cell>(d.cells);list.Add(new Cell{x=3,y=2,z=-2,color=1});d.cells=list.ToArray();d.revision++;
    MapBaker.Bake(d,"Assets/Generated/platform");
    PlacementIdentity.Repair();
    Require(AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(first.GetComponentInChildren<MeshFilter>().sharedMesh))==guid,"Mesh GUID changed during update");
    Require(GameObject.Find("User owned marker").transform.position==new Vector3(9,2,3),"Manual content lost");
    Require(first.GetComponentsInChildren<Transform>().Length==second.GetComponentsInChildren<Transform>().Length,"Repeated module differs");
    Require(first.GetComponentInChildren<SampleEvent>()!=null,"Functional event must be baked from registry");
    var a=first.GetComponentInChildren<SampleEvent>();var b=second.GetComponentInChildren<SampleEvent>();
    Require(a.Identity!=b.Identity,"Repeated module events must have distinct stable IDs");
    a.Activate();Require(a.Count==1 && b.Count==0,"Event state must be independent");
    EditorSceneManager.SaveOpenScenes();AssetDatabase.SaveAssets();
    File.WriteAllText("../logs/reopen.json","{\"passed\":true,\"meshGuid\":\""+guid+"\"}");
    Debug.Log("XH_REOPEN_PASS");EditorApplication.Exit(0);
   }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}
  }
 }
}
