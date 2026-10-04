using System;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEditor;
namespace Xinghai.MapEditor.Editor {
 public static class WrapperUpgradeProof {
  public static void Run(){GameObject wrapper=null;try{
   var first=SceneBaker.Bake(PublishReader.Read("../workshop-task7/real-project/releases/fbx-proof/manifest.json"),new ReceiveOptions());
   var next=SceneBaker.Bake(PublishReader.Read("../workshop-task8/packages/releases/version-b/manifest.json"),new ReceiveOptions());
   wrapper=new GameObject("User wrapper");var state=wrapper.AddComponent<WrapperState>();state.publishId=first.publishId;state.receiptId=first.receiptId;state.visualRoot=(GameObject)PrefabUtility.InstantiatePrefab(first.prefab);state.visualRoot.transform.SetParent(wrapper.transform,false);
   var own=new GameObject("User collision and marker");own.transform.SetParent(wrapper.transform,false);own.AddComponent<BoxCollider>();own.AddComponent<WorkshopUserMarker>().target=state.visualRoot.GetComponentsInChildren<PublishedInstance>().First(i=>i.instanceId=="native-instance").gameObject;
   state.overrides=new[]{new InstanceOverride{instanceId="native-instance",sourcePositionM=new[]{1f,2f,3f},rotationDeg=90}};
   var adjusted=state.visualRoot.GetComponentsInChildren<PublishedInstance>().First(i=>i.instanceId=="native-instance");adjusted.transform.localPosition=new Vector3(1,3,2);adjusted.transform.localRotation=Quaternion.Euler(0,-90,0);
   string original="Assets/WorkshopWrapperOriginal.prefab";PrefabUtility.SaveAsPrefabAsset(wrapper,original);byte[] before=File.ReadAllBytes(original);
   var preview=WrapperUpgrade.Preview(wrapper,next);WorkshopPublishProof.Check(preview.canUpgrade,"Supported wrapper override rejected: "+string.Join(";",preview.conflicts));
   var copy=WrapperUpgrade.CreateCopy(wrapper,next,"Assets/WorkshopWrapperUpgraded.prefab");var newState=copy.GetComponent<WrapperState>();
   WorkshopPublishProof.Check(copy.GetComponentsInChildren<BoxCollider>().Length==1,"User collision lost");var marker=copy.GetComponentInChildren<WorkshopUserMarker>();WorkshopPublishProof.Check(marker!=null&&marker.target.GetComponent<PublishedInstance>().instanceId=="native-instance","User visual reference not remapped");
   var moved=newState.visualRoot.GetComponentsInChildren<PublishedInstance>().First(i=>i.instanceId=="native-instance");WorkshopPublishProof.Check(moved.transform.localPosition==new Vector3(1,3,2)&&Quaternion.Angle(moved.transform.localRotation,Quaternion.Euler(0,-90,0))<.001f,"Tracked transform override lost");WorkshopPublishProof.Check(newState.publishId==next.publishId&&before.SequenceEqual(File.ReadAllBytes(original)),"Original wrapper altered");
   marker=wrapper.GetComponentInChildren<WorkshopUserMarker>();marker.target=adjusted.GetComponentInChildren<MeshFilter>().gameObject;WorkshopPublishProof.Check(!WrapperUpgrade.Preview(wrapper,next).canUpgrade,"Unknown internal visual reference accepted");marker.target=adjusted.gameObject;
   adjusted.transform.localScale=Vector3.one*2;WorkshopPublishProof.Check(!WrapperUpgrade.Preview(wrapper,next).canUpgrade,"Unknown visual override accepted");adjusted.transform.localScale=Vector3.one;
   bool failed=false;try{WrapperUpgrade.CreateCopy(wrapper,next,original);}catch{failed=true;}WorkshopPublishProof.Check(failed&&before.SequenceEqual(File.ReadAllBytes(original)),"Existing wrapper overwritten");
   File.WriteAllText("../workshop-task8/wrapper-proof.json","{\"passed\":true,\"preserved\":[\"user component\",\"collider\",\"tracked transform\",\"visual reference\",\"original bytes\"]}");Debug.Log("XH_WRAPPER_UPGRADE_PASS");EditorApplication.Exit(0);
  }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}finally{if(wrapper!=null)UnityEngine.Object.DestroyImmediate(wrapper);}}
  public static void Conflicts(){GameObject wrapper=null;try{var first=SceneBaker.Bake(PublishReader.Read("../workshop-task7/real-project/releases/fbx-proof/manifest.json"),new ReceiveOptions());wrapper=new GameObject("Tracked wrapper");var state=wrapper.AddComponent<WrapperState>();state.publishId=first.publishId;state.receiptId=first.receiptId;state.visualRoot=(GameObject)PrefabUtility.InstantiatePrefab(first.prefab);state.visualRoot.transform.SetParent(wrapper.transform,false);state.overrides=new[]{new InstanceOverride{instanceId="native-instance",sourcePositionM=new[]{1f,2f,3f},rotationDeg=90}};var moved=state.visualRoot.GetComponentsInChildren<PublishedInstance>().First(i=>i.instanceId=="native-instance");moved.transform.localPosition=new Vector3(1,3,2);moved.transform.localRotation=Quaternion.Euler(0,-90,0);foreach(string id in new[]{"version-root","version-deleted"}){var next=SceneBaker.Bake(PublishReader.Read("../workshop-task8/packages/releases/"+id+"/manifest.json"),new ReceiveOptions());var report=WrapperUpgrade.Preview(wrapper,next);WorkshopPublishProof.Check(!report.canUpgrade&&report.conflicts.Any(c=>id=="version-root"?c.Contains("Root"):c.Contains("删除")),"Expected upgrade conflict missing: "+id);}System.IO.File.WriteAllText("../workshop-task8/wrapper-conflicts.json","{\"passed\":true,\"conflicts\":[\"changed Root\",\"deleted tracked instance\"]}");Debug.Log("XH_WRAPPER_CONFLICTS_PASS");EditorApplication.Exit(0);}catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}finally{if(wrapper!=null)UnityEngine.Object.DestroyImmediate(wrapper);}}
 }
}
