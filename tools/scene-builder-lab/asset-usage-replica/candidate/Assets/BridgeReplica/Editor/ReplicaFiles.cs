using System;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace XingHai.BridgeReplica.Editor
{
    [Serializable] public sealed class ReplicaFile
    {
        public int schemaVersion=1;
        public string kind="editable-orthogonal-bridge-route",kitAssetPath,kitFingerprint;
        public RouteDocument route;
        public Vector3 position;
        public Quaternion rotation=Quaternion.identity;
    }
    public static class ReplicaFiles
    {
        static string Key(string text){return ReplicaKitRegistry.Hash(Encoding.UTF8.GetBytes(text)).Substring(0,24);}
        static void TransformAllowed(Transform t)
        {
            if((t.lossyScale-Vector3.one).sqrMagnitude>.000001f)throw new InvalidOperationException("路线构件保持原尺寸，请恢复根对象世界缩放为1。");
            if(Quaternion.Angle(t.rotation,Quaternion.Euler(0,t.eulerAngles.y,0))>.001f)throw new InvalidOperationException("路线作者只支持平移和水平转向。");
        }
        public static GameObject Committed(ReplicaAuthor author)
        {
            if(author==null)throw new ArgumentNullException("author");
            if(author.transform.Find("__RoutePreview")!=null)throw new InvalidOperationException("请先采用或取消路线候选，再保存。");
            TransformAllowed(author.transform);var doc=author.Read();var plan=RouteSolver.Solve(doc);
            if(!plan.Valid)throw new InvalidDataException(plan.Message);ReplicaKitRegistry.Validate(author.Kit);
            if(doc.KitId!=author.Kit.Id||doc.KitVersion!=author.Kit.Version)throw new InvalidDataException("作者与套件身份不一致；请显式重新采用套件。");
            var root=author.transform.Find("__RouteGeometry");
            if(root==null||!root.GetComponentsInChildren<MeshFilter>().Any(f=>f.sharedMesh!=null))throw new InvalidOperationException("路线没有已提交的真实网格。");
            return root.gameObject;
        }
        static string AssetPath(string path,string extension,bool restricted)
        {
            string p=path.Replace('\\','/');
            if(!p.StartsWith(restricted?"Assets/BridgeReplica/":"Assets/",StringComparison.Ordinal)||!p.EndsWith(extension,StringComparison.OrdinalIgnoreCase)||p.Split('/').Any(v=>string.IsNullOrWhiteSpace(v)||v=="."||v==".."||v.IndexOfAny(Path.GetInvalidFileNameChars())>=0))throw new InvalidOperationException("无效路线资源路径："+path);
            return p;
        }
        public static void SaveAuthor(ReplicaAuthor author,string path)
        {
            Committed(author);string kitPath=AssetDatabase.GetAssetPath(author.Kit);
            if(string.IsNullOrEmpty(kitPath))throw new InvalidOperationException("套件尚未登记为资源。");
            var data=new ReplicaFile{route=author.Read().Clone(),kitAssetPath=kitPath,kitFingerprint=author.Kit.ContentHash,position=author.transform.position,rotation=author.transform.rotation};
            string full=Path.GetFullPath(path);Directory.CreateDirectory(Path.GetDirectoryName(full));
            if(File.Exists(full)){var old=JsonUtility.FromJson<ReplicaFile>(File.ReadAllText(full));if(old==null||old.kind!=data.kind||old.schemaVersion!=1)throw new InvalidOperationException("目标不是本族路线文件，请另存并保留原文件。");}
            string temp=full+".tmp";File.WriteAllText(temp,JsonUtility.ToJson(data,true),new UTF8Encoding(false));if(File.Exists(full))File.Replace(temp,full,full+".bak");else File.Move(temp,full);
        }
        public static void LoadAuthor(ReplicaAuthor author,string path)
        {
            if(author==null)throw new ArgumentNullException("author");if(author.transform.Find("__RoutePreview")!=null)throw new InvalidOperationException("先采用或取消当前候选，再载入路线。");
            var data=JsonUtility.FromJson<ReplicaFile>(File.ReadAllText(path));
            if(data==null||data.kind!="editable-orthogonal-bridge-route"||data.schemaVersion!=1||data.route==null)throw new InvalidDataException("不支持的路线文件，当前作品保持。");
            var plan=RouteSolver.Solve(data.route);if(!plan.Valid)throw new InvalidDataException(plan.Message);
            string kitPath=AssetPath(data.kitAssetPath,".asset",true);var kit=AssetDatabase.LoadAssetAtPath<ReplicaKit>(kitPath);ReplicaKitRegistry.Validate(kit);
            if(kit.ContentHash!=data.kitFingerprint||kit.Id!=data.route.KitId||kit.Version!=data.route.KitVersion)throw new InvalidDataException("对应套件版本不匹配，当前作品保持。");
            foreach(float v in new[]{data.position.x,data.position.y,data.position.z,data.rotation.x,data.rotation.y,data.rotation.z,data.rotation.w})if(float.IsNaN(v)||float.IsInfinity(v))throw new InvalidDataException("路线变换包含非有限数字。");
            float norm=Quaternion.Dot(data.rotation,data.rotation);if(Mathf.Abs(norm-1)>.001f||Quaternion.Angle(data.rotation,Quaternion.Euler(0,data.rotation.eulerAngles.y,0))>.001f)throw new InvalidDataException("路线文件转向无效。");
            var session=ReplicaSession.Get(author);if(!session.Preview(data.route,kit))throw new InvalidDataException(session.Status);
            Undo.IncrementCurrentGroup();int group=Undo.GetCurrentGroup();Undo.SetCurrentGroupName("载入可编辑桥梁路线");Undo.RecordObject(author,"载入路线");Undo.RecordObject(author.transform,"载入路线");
            if(!session.Apply()){session.Cancel();throw new InvalidOperationException(session.Status);}
            // Restore the complete saved author, including revision. The session
            // commits only the matching validated graph and source identity.
            author.Write(data.route.Clone());author.transform.position=data.position;author.transform.rotation=data.rotation;author.transform.localScale=Vector3.one;
            if(!session.Rebuild())throw new InvalidOperationException("路线文件已读取，但派生网格恢复失败："+session.Status);
            author.MappingJson=ReplicaGeometry.Mapping(RouteSolver.Solve(data.route),kit);EditorUtility.SetDirty(author);EditorSceneManager.MarkSceneDirty(author.gameObject.scene);Undo.FlushUndoRecordObjects();Undo.CollapseUndoOperations(group);
        }
        public static void PersistScene(Scene scene,string path)
        {
            if(!scene.IsValid()||!scene.isLoaded)throw new InvalidOperationException("目标场景尚未载入。");string normalized=AssetPath(path,".unity",false);
            var authors=scene.GetRootGameObjects().SelectMany(g=>g.GetComponentsInChildren<ReplicaAuthor>(true)).ToArray();
            foreach(var a in authors)Committed(a);
            if(authors.GroupBy(a=>a.Read().Id,StringComparer.Ordinal).Any(g=>g.Count()>1))throw new InvalidOperationException("同一场景存在重复路线身份，请给复制的路线分配新身份后保存。");
            string root="Assets/BridgeReplica/Generated/"+Key(normalized.ToLowerInvariant());
            foreach(var a in authors.OrderBy(a=>a.Read().Id,StringComparer.Ordinal))ReplicaGeometry.Persist(Committed(a),root+"/route_"+Key(a.Read().Id));
        }
        public static void SaveScene(string path)
        {
            string normalized=AssetPath(path,".unity",true);var scene=SceneManager.GetActiveScene();
            if(!scene.GetRootGameObjects().Any(g=>g.GetComponentInChildren<ReplicaAuthor>(true)!=null))throw new InvalidOperationException("当前场景没有路线作者。");
            foreach(var f in scene.GetRootGameObjects().SelectMany(g=>g.GetComponentsInChildren<MeshFilter>(true)))if(f.sharedMesh!=null&&f.GetComponentInParent<ReplicaAuthor>()==null&&!AssetDatabase.Contains(f.sharedMesh))throw new InvalidOperationException("场景中其它作者的网格尚未持久保存，请先使用它所属的编辑器保存。");
            ReplicaKitRegistry.Folder(Path.GetDirectoryName(normalized).Replace('\\','/'));PersistScene(scene,normalized);AssetDatabase.SaveAssets();if(!EditorSceneManager.SaveScene(scene,normalized))throw new IOException("路线场景保存失败。");
        }
        public static GameObject Bake(ReplicaAuthor author,string prefabPath)
        {
            string path=AssetPath(prefabPath,".prefab",true);var source=Committed(author);ReplicaKitRegistry.Folder(Path.GetDirectoryName(path).Replace('\\','/'));
            var baked=UnityEngine.Object.Instantiate(source);baked.name="Baked_"+author.name;baked.transform.SetParent(null,false);baked.transform.position=author.transform.position;baked.transform.rotation=author.transform.rotation;baked.transform.localScale=Vector3.one;
            try
            {
                foreach(var t in baked.GetComponentsInChildren<Transform>(true))t.gameObject.hideFlags=HideFlags.None;
                foreach(var component in baked.GetComponentsInChildren<MonoBehaviour>(true))UnityEngine.Object.DestroyImmediate(component);
                foreach(var filter in baked.GetComponentsInChildren<MeshFilter>(true))if(filter.sharedMesh!=null){filter.sharedMesh=UnityEngine.Object.Instantiate(filter.sharedMesh);var collider=filter.GetComponent<MeshCollider>();if(collider!=null)collider.sharedMesh=filter.sharedMesh;}
                ReplicaGeometry.Persist(baked,Path.ChangeExtension(path,null)+"_Meshes");AssetDatabase.SaveAssets();bool success;PrefabUtility.SaveAsPrefabAsset(baked,path,out success);if(!success)throw new IOException("独立预制体保存失败。");return baked;
            }
            catch{ReplicaGeometry.Destroy(baked);throw;}
        }
    }
}
