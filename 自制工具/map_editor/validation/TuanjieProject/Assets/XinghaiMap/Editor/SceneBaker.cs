using System;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
namespace Xinghai.MapEditor.Editor {
 public static class SceneBaker {
  public static PublishedScene Bake(PublishPackage package,ReceiveOptions options){PublishReader.Require(package.manifest.kind=="scene","需要场景发布包");return (PublishedScene)WorkshopBake.Receive(package,options,true);}
  internal static GameObject Build(PublishPackage package,Dictionary<string,GameObject> modules,Dictionary<string,Texture2D> textures,string folder,BakeJournal journal){var scene=PublishReader.Json(package.files[package.manifest.runtimePath]).ToObject<RuntimeScene>();var root=new GameObject(scene.sceneId);try{foreach(var i in scene.instances){var child=(GameObject)PrefabUtility.InstantiatePrefab(modules[i.assetId]);child.name=i.instanceId;child.transform.SetParent(root.transform,false);child.transform.localPosition=WorkshopCoordinates.Unity(i.positionM);child.transform.localRotation=Quaternion.Euler(0,-i.rotationDeg,0);var dep=package.manifest.dependencies.First(d=>d.assetId==i.assetId);var identity=child.AddComponent<PublishedInstance>();identity.instanceId=i.instanceId;identity.assetId=i.assetId;identity.sourcePositionM=(float[])i.positionM.Clone();identity.rotationDeg=i.rotationDeg;identity.anchorM=(float[])dep.anchorM.Clone();identity.contentHash=dep.contentHash;}
   foreach(var d in scene.decals){var shader=Shader.Find("Xinghai/Horizontal Decal");PublishReader.Require(shader!=null,"贴花Shader缺失");var material=WorkshopBake.Store(new Material(shader){name=d.decalId,mainTexture=textures[d.assetId]},folder+"/decal-"+d.decalId+".mat",journal);var mesh=new Mesh{name=d.decalId};mesh.vertices=new[]{new Vector3(-d.widthM/2,0,-d.heightM/2),new Vector3(-d.widthM/2,0,d.heightM/2),new Vector3(d.widthM/2,0,d.heightM/2),new Vector3(d.widthM/2,0,-d.heightM/2)};mesh.uv=new[]{new Vector2(0,0),new Vector2(0,1),new Vector2(1,1),new Vector2(1,0)};mesh.triangles=new[]{0,1,2,0,2,3};mesh.RecalculateNormals();mesh=WorkshopBake.Store(mesh,folder+"/decal-"+d.decalId+".asset",journal);var child=new GameObject("Decal "+d.decalId);child.transform.SetParent(root.transform,false);child.transform.localPosition=WorkshopCoordinates.Unity(d.positionM)+Vector3.up*.002f;child.transform.localRotation=Quaternion.Euler(0,-d.rotationDeg,0);child.AddComponent<MeshFilter>().sharedMesh=mesh;child.AddComponent<MeshRenderer>().sharedMaterial=material;}
   return root;
  }catch{UnityEngine.Object.DestroyImmediate(root);throw;}}
 }
}
