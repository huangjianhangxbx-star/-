using System;
using UnityEngine;
using UnityEditor;
namespace Xinghai.MapEditor.Editor {
 public static class ProofSetup {
  public static void Run(){try{
   var registry=AssetDatabase.LoadAssetAtPath<MapRegistry>("Assets/MapRegistry.asset");if(registry==null){registry=ScriptableObject.CreateInstance<MapRegistry>();AssetDatabase.CreateAsset(registry,"Assets/MapRegistry.asset");}
   var obj=GameObject.CreatePrimitive(PrimitiveType.Cube);obj.name="Sample switch";obj.transform.localScale=Vector3.one*.2f;obj.AddComponent<SampleEvent>();
   var evt=PrefabUtility.SaveAsPrefabAsset(obj,"Assets/Fixtures/Switch.prefab");UnityEngine.Object.DestroyImmediate(obj);
   var model=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Fixtures/direction.fbx");if(model==null)throw new Exception("External FBX not imported");
   registry.bindings=new[]{new AssetBinding{assetId="sample.switch",prefab=evt},new AssetBinding{assetId="sample.direction",prefab=model}};EditorUtility.SetDirty(registry);AssetDatabase.SaveAssets();
   PersistenceProof.Run();
  }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
 }
}
