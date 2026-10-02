using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Xinghai.MapEditor.Editor {
 public static class TowerSampleProof {
  static void Check(bool yes, string message) { if (!yes) throw new Exception(message); }
  static string AssetName(string id) { return id.Substring("ruins:".Length); }
  static GameObject BakeMap(MapDocument doc, string folder) {
   var registry = AssetDatabase.LoadAssetAtPath<MapRegistry>("Assets/TowerAssets/TowerRegistry.asset");
   Check(registry != null && registry.bindings.Length >= 10, "Tower registry was not persisted");
   return MapBaker.Bake(doc, folder, registry);
  }
  public static void Run() { try {
   const string sourcePath = "../../samples/tower-ruins/遗迹双路.xhmap.json";
   const string folder = "Assets/Generated/tower-ruins-m11-v1";
   const string scenePath = "Assets/TowerProof.unity";
   AssetDatabase.Refresh();
   var doc = SourceReader.Parse(File.ReadAllText(sourcePath));
   Check(doc.mapId == "tower-ruins-m11-v1", "Unexpected tower source");
   const string registryPath = "Assets/TowerAssets/TowerRegistry.asset";
   var registry = AssetDatabase.LoadAssetAtPath<MapRegistry>(registryPath);
   if (registry == null) {
    registry = ScriptableObject.CreateInstance<MapRegistry>();
    AssetDatabase.CreateAsset(registry, registryPath);
   }
   var bindings = new List<AssetBinding>();
   foreach (var id in doc.instances.Where(p => p.kind == "model").Select(p => p.assetId).Distinct()) {
    Check(id.StartsWith("ruins:"), "Unexpected model ID " + id);
    var asset = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/TowerAssets/" + AssetName(id) + ".fbx");
    Check(asset != null, "Real FBX missing: " + id);
    bindings.Add(new AssetBinding { assetId = id, prefab = asset, blenderFbxAxes = true });
   }
   var eventPrefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Fixtures/Switch.prefab");
   Check(eventPrefab != null, "Sample event prefab missing");
   foreach (var key in doc.instances.Where(p => p.kind == "event").Select(p => p.registryKey).Distinct())
    bindings.Add(new AssetBinding { assetId = key, prefab = eventPrefab, blenderFbxAxes = false });
   var texture = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/TowerAssets/PT_EMBLEM_01.png");
   Check(texture != null, "Real decal PNG missing");
   foreach (var id in doc.decals.Select(d => d.assetId).Distinct())
    bindings.Add(new AssetBinding { assetId = id, texture = texture });
   registry.bindings = bindings.ToArray();
   EditorUtility.SetDirty(registry); AssetDatabase.SaveAssets();
   var baked = BakeMap(doc, folder);
   string prefabPath = folder + "/Module.prefab";
   string guid = AssetDatabase.AssetPathToGUID(prefabPath);
   Check(!string.IsNullOrEmpty(guid), "Tower prefab GUID missing");
   Check(baked.GetComponent<MapSurfaceData>().surfaces.Length == doc.surfaces.Length, "Surface tags lost");
   Check(baked.GetComponentsInChildren<SampleEvent>(true).Length == 4, "Event mapping lost");
   Check(baked.GetComponentsInChildren<Transform>(true).Count(t => t.name.StartsWith("Instance ")) == doc.instances.Length, "Real model or event instance lost");
   Check(baked.GetComponentsInChildren<Transform>(true).Count(t => t.name.StartsWith("Decal ")) == doc.decals.Length, "Decal lost");
   var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene);
   var a = (GameObject)PrefabUtility.InstantiatePrefab(baked); a.name = "Tower A";
   var b = (GameObject)PrefabUtility.InstantiatePrefab(baked); b.name = "Tower B";
   b.transform.position = new Vector3(28, 0, 0);
   new GameObject("User marker").transform.position = new Vector3(7, 3, -4);
   PlacementIdentity.Repair();
   string identityA = a.GetComponent<ModulePlacement>().placementId;
   string identityB = b.GetComponent<ModulePlacement>().placementId;
   Check(identityA != identityB, "Duplicate placed module identity");
   EditorSceneManager.SaveScene(scene, scenePath);
   Check(BakeMap(doc, folder) != null && MapBaker.LastStatus == "unchanged", "Idempotent bake failed");
   Check(AssetDatabase.AssetPathToGUID(prefabPath) == guid, "Prefab GUID changed");
   int originalColor = doc.cells[0].color, originalRevision = doc.revision;
   doc.cells[0].color = (originalColor + 1) % doc.palette.Length; doc.revision++;
   BakeMap(doc, folder);
   Check(a.GetComponent<ModulePlacement>().placementId == identityA && b.GetComponent<ModulePlacement>().placementId == identityB, "Update reset placed IDs");
   string chunk = Directory.GetFiles(folder, "Chunk_*.asset")[0];
   byte[] goodMesh = File.ReadAllBytes(chunk);
   doc.cells[0].color = (originalColor + 2) % doc.palette.Length; doc.revision++;
   MapBaker.BeforePublishForTest = () => { throw new IOException("Injected tower bake failure"); };
   bool rejected = false;
   try { BakeMap(doc, folder); } catch (IOException) { rejected = true; }
   finally { MapBaker.BeforePublishForTest = null; }
   Check(rejected && goodMesh.SequenceEqual(File.ReadAllBytes(chunk)), "Failed bake changed previous mesh");
   AssetDatabase.SaveAssets();
   Check(goodMesh.SequenceEqual(File.ReadAllBytes(chunk)), "Rollback left dirty mesh in memory");
   doc.cells[0].color = originalColor; doc.revision = originalRevision;
   BakeMap(doc, folder);
   Check(AssetDatabase.AssetPathToGUID(prefabPath) == guid, "Final source restore changed GUID");
   EditorSceneManager.SaveScene(scene, scenePath);
   EditorSceneManager.OpenScene(scenePath);
   Check(UnityEngine.Object.FindObjectsOfType<ModulePlacement>().Length == 2, "Reopen lost duplicate modules");
   Check(GameObject.Find("User marker").transform.position == new Vector3(7, 3, -4), "Reopen changed manual object");
   foreach (var filter in UnityEngine.Object.FindObjectsOfType<MeshFilter>())
    Check(filter.sharedMesh != null && AssetDatabase.Contains(filter.sharedMesh), "Unpersisted mesh in tower scene");
   File.WriteAllText("../../validation/logs/tower-sample-proof.json", JsonConvert.SerializeObject(new {
    passed = true, doc.mapId, doc.revision, cells = doc.cells.Length, surfaces = doc.surfaces.Length,
    models = doc.instances.Count(p => p.kind == "model"), events = doc.instances.Count(p => p.kind == "event"),
    decals = doc.decals.Length, prefabGuid = guid, scene = scenePath, engine = Application.unityVersion,
    duplicatePlacements = 2, update = true, rollback = true, reopened = true
   }, Formatting.Indented));
   Debug.Log("XH_TOWER_SAMPLE_PROOF_PASS"); EditorApplication.Exit(0);
  } catch (Exception e) { Debug.LogException(e); EditorApplication.Exit(1); } }
 }
}
