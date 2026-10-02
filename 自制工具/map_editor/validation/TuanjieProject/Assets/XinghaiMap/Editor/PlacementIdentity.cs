using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
namespace Xinghai.MapEditor.Editor {
 [InitializeOnLoad] public static class PlacementIdentity {
  static PlacementIdentity(){EditorApplication.hierarchyChanged+=Repair;}
  public static void Repair(){
   var seen=new HashSet<string>();
   foreach(var m in UnityEngine.Object.FindObjectsOfType<ModulePlacement>(true)){
    if(!m.gameObject.scene.IsValid() || EditorUtility.IsPersistent(m) || m.gameObject.scene.path.EndsWith(".prefab"))continue;
    if(string.IsNullOrEmpty(m.placementId)||!seen.Add(m.placementId)){
     m.placementId=Guid.NewGuid().ToString("N");seen.Add(m.placementId);EditorUtility.SetDirty(m);PrefabUtility.RecordPrefabInstancePropertyModifications(m);
    }
   }
  }
 }
}
