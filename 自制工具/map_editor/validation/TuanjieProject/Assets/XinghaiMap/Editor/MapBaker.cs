using UnityEngine;
using UnityEditor;
using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
namespace Xinghai.MapEditor.Editor {
 public static class MapBaker {
  internal static Action BeforePublishForTest;
  public static string LastStatus {get;private set;}
  static T Store<T>(T fresh,string path,BakeJournal journal) where T:UnityEngine.Object {
   journal.Watch(path);var existing=AssetDatabase.LoadAssetAtPath<T>(path);
   if(existing==null){AssetDatabase.CreateAsset(fresh,path);return fresh;}
   journal.Snapshot(existing);EditorUtility.CopySerialized(fresh,existing);UnityEngine.Object.DestroyImmediate(fresh);EditorUtility.SetDirty(existing);return existing;
  }
  static Mesh BuildMesh(IEnumerable<Quad> quads,MapDocument doc){
   var vertices=new List<Vector3>();var normals=new List<Vector3>();var colors=new List<Color>();var triangles=new List<int>();
   foreach(var q in quads){int[] axes=Enumerable.Range(0,3).Where(a=>a!=q.axis).ToArray();int start=vertices.Count;ColorUtility.TryParseHtmlString(doc.palette[q.color],out var color);if(PlayerSettings.colorSpace==ColorSpace.Linear)color=color.linear;
    foreach(var ab in new[]{new[]{q.a,q.b},new[]{q.a+q.w,q.b},new[]{q.a+q.w,q.b+q.h},new[]{q.a,q.b+q.h}}){float[] p={0,0,0},n={0,0,0};p[q.axis]=q.plane;p[axes[0]]=ab[0];p[axes[1]]=ab[1];n[q.axis]=q.sign;vertices.Add(new Vector3(p[0],p[2],p[1])*doc.voxelSize);normals.Add(new Vector3(n[0],n[2],n[1]));colors.Add(color);}
    var order=q.sign==(q.axis==1?-1:1)?new[]{0,2,1,0,3,2}:new[]{0,1,2,0,2,3};triangles.AddRange(order.Select(i=>start+i));
   }
   var mesh=new Mesh{name="Terrain chunk",indexFormat=UnityEngine.Rendering.IndexFormat.UInt32};mesh.SetVertices(vertices);mesh.SetNormals(normals);mesh.SetColors(colors);mesh.SetTriangles(triangles,0);mesh.RecalculateBounds();return mesh;
  }
  static string SafeId(string id){if(id.Length>80)throw new Exception("实例身份过长");return Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(id)).Replace('/','_').Replace('+','-').TrimEnd('=');}
  public static GameObject Bake(MapDocument input,string folder,MapRegistry registry=null){
   BakeJournal.Recover();LastStatus="failed";
   var watch=System.Diagnostics.Stopwatch.StartNew();var doc=SourceReader.Parse(JsonConvert.SerializeObject(input));
   if(!Regex.IsMatch(folder??"","^Assets/Generated/[a-zA-Z0-9_-]+$"))throw new Exception("输出必须为 Assets/Generated 下的单个模块目录");
   var walk=new DirectoryInfo(Path.GetFullPath(folder));while(walk!=null&&walk.FullName.StartsWith(Path.GetFullPath("Assets"),StringComparison.OrdinalIgnoreCase)){if(walk.Exists&&(walk.Attributes&FileAttributes.ReparsePoint)!=0)throw new Exception("输出不能经过目录链接");walk=walk.Parent;}
   if(registry==null)registry=AssetDatabase.LoadAssetAtPath<MapRegistry>("Assets/MapRegistry.asset");var bindings=new Dictionary<string,AssetBinding>();
   if(registry!=null)foreach(var b in registry.bindings){if(string.IsNullOrEmpty(b.assetId)||bindings.ContainsKey(b.assetId))throw new Exception("映射表存在空或重复ID");bindings.Add(b.assetId,b);}
   foreach(var p in doc.instances){string key=p.kind=="event"?p.registryKey:p.assetId;if(string.IsNullOrEmpty(key)||!bindings.TryGetValue(key,out var b)||b.prefab==null)throw new Exception("缺失预制体映射："+key);if(p.kind=="event"&&b.prefab.GetComponentsInChildren<MonoBehaviour>(true).Length==0)throw new Exception("事件映射需要带脚本的功能预制体");}
   foreach(var d in doc.decals)if(!bindings.TryGetValue(d.assetId,out var b)||b.texture==null)throw new Exception("缺失贴花贴图映射："+d.assetId);
   var shader=Shader.Find("Xinghai/Map Vertex Color");var decalShader=Shader.Find("Xinghai/Horizontal Decal");if(shader==null||decalShader==null)throw new Exception("地图材质Shader未安装");
   string signature="baker-1.2:"+AssetDatabase.GetAssetDependencyHash(AssetDatabase.GetAssetPath(shader))+AssetDatabase.GetAssetDependencyHash(AssetDatabase.GetAssetPath(decalShader))+JsonConvert.SerializeObject(doc)+Application.unityVersion+PlayerSettings.colorSpace+string.Join(";",bindings.OrderBy(b=>b.Key).Select(b=>b.Key+":"+b.Value.blenderFbxAxes+":"+AssetDatabase.GetAssetDependencyHash(AssetDatabase.GetAssetPath(b.Value.prefab!=null?(UnityEngine.Object)b.Value.prefab:b.Value.texture))));
   string fingerprint;using(var hash=System.Security.Cryptography.SHA256.Create())fingerprint=Convert.ToBase64String(hash.ComputeHash(System.Text.Encoding.UTF8.GetBytes(signature)));
   string reportPath=folder+"/bake-report.json";var previous=AssetDatabase.LoadAssetAtPath<GameObject>(folder+"/Module.prefab");
   if(previous!=null&&File.Exists(reportPath)&&BeforePublishForTest==null){var report=Newtonsoft.Json.Linq.JObject.Parse(File.ReadAllText(reportPath));if(report.Value<string>("fingerprint")==fingerprint&&previous.GetComponentsInChildren<MeshFilter>(true).All(m=>m.sharedMesh!=null)&&previous.GetComponentsInChildren<Renderer>(true).All(r=>r.sharedMaterials.All(m=>m!=null))){using(var journal=new BakeJournal()){journal.Watch(reportPath);report["status"]="unchanged";File.WriteAllText(reportPath,report.ToString());journal.Commit();}LastStatus="unchanged";return previous;}}
   var quads=GreedyMesher.Build(doc);var staged=quads.GroupBy(q=>q.chunk).ToDictionary(g=>g.Key,g=>BuildMesh(g,doc));
   Directory.CreateDirectory(folder);AssetDatabase.Refresh();var root=new GameObject(doc.mapId);
   try{using(var journal=new BakeJournal()){
    var material=Store(new Material(shader){name="地形色板"},folder+"/Terrain.mat",journal);
    root.AddComponent<ModulePlacement>();var data=root.AddComponent<MapSurfaceData>();data.mapId=doc.mapId;data.revision=doc.revision;data.surfaces=doc.surfaces;
    foreach(var pair in staged){var saved=Store(pair.Value,folder+"/Chunk_"+pair.Key.Replace(',','_')+".asset",journal);var go=new GameObject("Chunk "+pair.Key);go.transform.SetParent(root.transform,false);go.AddComponent<MeshFilter>().sharedMesh=saved;go.AddComponent<MeshRenderer>().sharedMaterial=material;go.AddComponent<MeshCollider>().sharedMesh=saved;}
    foreach(var p in doc.instances){var obj=(GameObject)PrefabUtility.InstantiatePrefab(bindings[p.kind=="event"?p.registryKey:p.assetId].prefab);var importedRotation=obj.transform.localRotation;obj.name="Instance "+p.id;obj.transform.SetParent(root.transform,false);obj.transform.localPosition=new Vector3(p.x,p.z,p.y);obj.transform.localRotation=Quaternion.Euler(0,-p.rotation,0);if(p.anchor!=null&&p.anchor.Length==3)obj.transform.localPosition-=obj.transform.localRotation*new Vector3(p.anchor[0],p.anchor[2],p.anchor[1]);if(bindings[p.kind=="event"?p.registryKey:p.assetId].blenderFbxAxes&&AssetDatabase.GetAssetPath(bindings[p.kind=="event"?p.registryKey:p.assetId].prefab).EndsWith(".fbx",StringComparison.OrdinalIgnoreCase))obj.transform.localRotation*=Quaternion.Euler(0,180,0);obj.transform.localRotation*=importedRotation;foreach(var evt in obj.GetComponentsInChildren<SampleEvent>(true))evt.localId=p.id;}
    foreach(var d in doc.decals){var mat=new Material(decalShader){name="Decal "+d.assetId,mainTexture=bindings[d.assetId].texture};mat=Store(mat,folder+"/Decal_"+SafeId(d.assetId)+".mat",journal);
     var mesh=new Mesh{name="Decal plane"};mesh.vertices=new[]{new Vector3(-d.width/2,0,-d.height/2),new Vector3(-d.width/2,0,d.height/2),new Vector3(d.width/2,0,d.height/2),new Vector3(d.width/2,0,-d.height/2)};mesh.uv=new[]{new Vector2(0,0),new Vector2(0,1),new Vector2(1,1),new Vector2(1,0)};mesh.triangles=new[]{0,1,2,0,2,3};mesh.RecalculateNormals();mesh=Store(mesh,folder+"/DecalMesh_"+SafeId(d.id)+".asset",journal);
     var go=new GameObject("Decal "+d.id);go.transform.SetParent(root.transform,false);go.transform.localPosition=new Vector3(d.x,d.z+.002f,d.y);go.transform.localRotation=Quaternion.Euler(0,-d.rotation,0);go.AddComponent<MeshFilter>().sharedMesh=mesh;go.AddComponent<MeshRenderer>().sharedMaterial=mat;}
    BeforePublishForTest?.Invoke();string prefabPath=folder+"/Module.prefab";journal.Watch(prefabPath);var result=PrefabUtility.SaveAsPrefabAsset(root,prefabPath,out bool success);if(!success||result==null)throw new Exception("预制体发布失败");
    journal.Watch(reportPath);File.WriteAllText(reportPath,JsonConvert.SerializeObject(new{doc.mapId,doc.revision,fingerprint,status="updated",version=Application.unityVersion,quads=quads.Count,chunks=staged.Count,milliseconds=watch.ElapsedMilliseconds},Formatting.Indented));journal.Commit();LastStatus="updated";return result;
   }}finally{UnityEngine.Object.DestroyImmediate(root);foreach(var mesh in staged.Values)if(mesh!=null&&!AssetDatabase.Contains(mesh))UnityEngine.Object.DestroyImmediate(mesh);}
  }
 }
}
