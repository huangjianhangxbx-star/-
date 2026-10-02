using System;
using System.IO;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
namespace Xinghai.MapEditor.Editor {
 public static class PersistenceProof {
  public static void Run() {
   try {
    var d=JsonUtility.FromJson<MapDocument>(File.ReadAllText("Assets/Fixtures/platform.json"));
    var prefab=MapBaker.Bake(d,"Assets/Generated/platform");
    if(prefab==null) throw new Exception("Bake must return a persisted prefab");
    var filter=prefab.GetComponentInChildren<MeshFilter>();
    if(filter==null || !AssetDatabase.Contains(filter.sharedMesh)) throw new Exception("Mesh must survive editor restart");
    if(filter.sharedMesh.vertexCount==0) throw new Exception("Mesh must contain geometry");
    var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene);
    var a=(GameObject)PrefabUtility.InstantiatePrefab(prefab); a.name="First module";
    var b=(GameObject)PrefabUtility.InstantiatePrefab(prefab); b.name="Second module"; b.transform.position=new Vector3(5,0,0);
    var marker=new GameObject("User owned marker"); marker.transform.position=new Vector3(9,2,3);
    EditorSceneManager.SaveScene(scene,"Assets/Proof.unity"); AssetDatabase.SaveAssets();
    File.WriteAllText("../logs/persist.json",JsonUtility.ToJson(new Result{version=Application.unityVersion,meshGuid=AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(filter.sharedMesh)),prefabGuid=AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(prefab))},true));
    Debug.Log("XH_PERSIST_PASS"); EditorApplication.Exit(0);
   } catch(Exception e) {Debug.LogException(e);EditorApplication.Exit(1);}
  }
  [Serializable] class Result {public string version,meshGuid,prefabGuid;}
 }
}
