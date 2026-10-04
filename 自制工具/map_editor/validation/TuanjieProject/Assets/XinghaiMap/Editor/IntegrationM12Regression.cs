using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using Newtonsoft.Json;
namespace Xinghai.MapEditor.Editor {
 public static class IntegrationM12Regression {
  static void Check(bool yes,string message){if(!yes)throw new Exception(message);}
  public static void Run(){try{
   var doc=SourceReader.Parse(File.ReadAllText("../workflow/地图 样本.json"));
   var registry=AssetDatabase.LoadAssetAtPath<MapRegistry>("Assets/MapRegistry.asset");
   var model=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Fixtures/direction.fbx");var evt=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Fixtures/Switch.prefab");var texture=AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Fixtures/纹样.png");
   Check(model!=null&&evt!=null&&texture!=null,"Exchange fixtures missing");
   var bindings=new List<AssetBinding>{new AssetBinding{assetId="sample.switch",prefab=evt}};
   foreach(var p in doc.instances.Where(p=>p.kind!="event"))if(!bindings.Any(b=>b.assetId==p.assetId))bindings.Add(new AssetBinding{assetId=p.assetId,prefab=model});
   foreach(var d in doc.decals)bindings.Add(new AssetBinding{assetId=d.assetId,texture=texture});registry.bindings=bindings.ToArray();EditorUtility.SetDirty(registry);AssetDatabase.SaveAssets();
   string folder="Assets/Generated/"+doc.mapId;var prefab=MapBaker.Bake(doc,folder,registry);var path=folder+"/Module.prefab";
   string guid=AssetDatabase.AssetPathToGUID(path);int count=Directory.GetFiles(folder).Length;
   Check(prefab.GetComponent<MapSurfaceData>().surfaces.Length==1,"Surface logic lost");Check(prefab.GetComponentsInChildren<SampleEvent>().Length==1,"Event mapping failed");Check(prefab.GetComponentsInChildren<Transform>().Count(t=>t.name.StartsWith("Decal "))==1,"Decal missing");
   var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene);var first=(GameObject)PrefabUtility.InstantiatePrefab(prefab);first.name="First module";var second=(GameObject)PrefabUtility.InstantiatePrefab(prefab);second.name="Second module";second.transform.position=new Vector3(6,0,0);new GameObject("User owned marker").transform.position=new Vector3(9,2,3);PlacementIdentity.Repair();
   string a=first.GetComponent<ModulePlacement>().placementId,bid=second.GetComponent<ModulePlacement>().placementId;Check(a!=bid,"Duplicate module identity");EditorSceneManager.SaveScene(scene,"Assets/M12CompleteProof.unity");
   MapBaker.Bake(doc,folder,registry);Check(Directory.GetFiles(folder).Length==count&&AssetDatabase.AssetPathToGUID(path)==guid,"Idempotence or prefab GUID failed");
   int oldColor=doc.cells[0].color;doc.cells[0].color=2;doc.revision++;MapBaker.Bake(doc,folder,registry);Check(first.GetComponent<ModulePlacement>().placementId==a&&second.GetComponent<ModulePlacement>().placementId==bid,"Update reset module IDs");
   var meshPath=Directory.GetFiles(folder,"Chunk_*.asset")[0].Replace('\\','/');byte[] oldMesh=File.ReadAllBytes(meshPath);doc.cells[0].color=3;MapBaker.BeforePublishForTest=()=>{throw new IOException("Injected interruption");};try{MapBaker.Bake(doc,folder,registry);throw new Exception("Fault was not injected");}catch(IOException){}finally{MapBaker.BeforePublishForTest=null;}Check(oldMesh.SequenceEqual(File.ReadAllBytes(meshPath)),"Mid-bake rollback lost previous mesh");AssetDatabase.SaveAssets();Check(oldMesh.SequenceEqual(File.ReadAllBytes(meshPath)),"Rollback left dirty in-memory mesh");doc.cells[0].color=2;byte[] before=File.ReadAllBytes(path);string goodId=doc.instances[0].assetId;doc.instances[0].assetId="missing.asset";bool rejected=false;try{MapBaker.Bake(doc,folder,registry);}catch{rejected=true;}Check(rejected&&before.SequenceEqual(File.ReadAllBytes(path)),"Invalid source replaced good prefab");doc.instances[0].assetId=goodId;
   Check(GameObject.Find("User owned marker").transform.position==new Vector3(9,2,3),"Manual marker changed");
   EditorSceneManager.SaveScene(scene,"Assets/M12CompleteProof.unity");EditorSceneManager.OpenScene("Assets/M12CompleteProof.unity");var events=UnityEngine.Object.FindObjectsOfType<SampleEvent>();Check(events.Length==2&&events[0].Identity!=events[1].Identity,"Reopen lost event identity");events[0].Activate();Check(events[0].Count==1&&events[1].Count==0,"Events share state");
   foreach(var filter in UnityEngine.Object.FindObjectsOfType<MeshFilter>())Check(filter.sharedMesh!=null&&AssetDatabase.Contains(filter.sharedMesh),"Nonpersistent mesh");
   File.WriteAllText("../m12/integration.json",JsonConvert.SerializeObject(new{passed=true,doc.mapId,doc.revision,cells=doc.cells.Length,events=events.Length,prefabGuid=guid,version=Application.unityVersion},Formatting.Indented));Debug.Log("XH_INTEGRATION_PASS");EditorApplication.Exit(0);
  }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
 }
}



