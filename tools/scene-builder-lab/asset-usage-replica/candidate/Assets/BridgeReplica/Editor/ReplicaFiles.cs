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
        const string PrivateAssets="Assets/BridgeReplica/ResearchPrivate/";
        static string Key(string text){return ReplicaKitRegistry.Hash(Encoding.UTF8.GetBytes(text)).Substring(0,24);}
        static string Kind(int version){return version==2?"editable-freehand-bridge-route":"editable-orthogonal-bridge-route";}
        static bool Supported(ReplicaFile file)
        {return file!=null&&file.route!=null&&(file.schemaVersion==1||file.schemaVersion==2)&&file.route.SchemaVersion==file.schemaVersion&&file.kind==Kind(file.schemaVersion);}
        static bool Inside(string path,string root)
        {return Path.GetFullPath(path).StartsWith(Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar,Path.AltDirectorySeparatorChar)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase);}
        static bool PrivateAuthorPath(string full)
        {
            if(Inside(full,Path.Combine(Application.dataPath,"BridgeReplica/ResearchPrivate")))return true;
            // Workspace-local study data is kept outside the publishable Origin
            // tree. Locate its real sibling from this project, rather than
            // accepting an arbitrary folder merely named "ResearchPrivate".
            for(var dir=new DirectoryInfo(Application.dataPath);dir!=null;dir=dir.Parent)
                if(dir.Name.Equals("Origin",StringComparison.OrdinalIgnoreCase)&&dir.Parent!=null)
                    return Inside(full,Path.Combine(dir.Parent.FullName,"参考游戏研究"));
            return false;
        }
        static void ResearchAuthorPath(ReplicaKit kit,string full)
        {if(kit!=null&&kit.ResearchOnly&&!PrivateAuthorPath(full))throw new InvalidOperationException("原作研究作者只能保存在本工程 ResearchPrivate 或工作区的参考游戏研究私有目录；请另选私有位置。");}
        static bool ResearchScene(ReplicaAuthor[] authors,string normalized)
        {
            bool research=authors.Any(a=>a.Kit!=null&&a.Kit.ResearchOnly);
            if(research&&!normalized.StartsWith(PrivateAssets,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("场景含原作研究来源，只能另存到 Assets/BridgeReplica/ResearchPrivate/；未生成公开派生网格。");
            return research;
        }
        static void TransformAllowed(Transform t)
        {
            if((t.lossyScale-Vector3.one).sqrMagnitude>.000001f)throw new InvalidOperationException("路线构件保持原尺寸，请恢复根对象世界缩放为1。");
            if(Quaternion.Angle(t.rotation,Quaternion.Euler(0,t.eulerAngles.y,0))>.001f)throw new InvalidOperationException("路线作者只支持平移和水平转向。");
        }
        public static GameObject Committed(ReplicaAuthor author)
        {
            if(author==null)throw new ArgumentNullException("author");
            if(author.transform.Find("__RoutePreview")!=null)throw new InvalidOperationException("请先采用或取消路线候选，再保存。");
            TransformAllowed(author.transform);var doc=author.Read();var plan=ReplicaRoute.Solve(doc);
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
            var doc=author.Read().Clone();var data=new ReplicaFile{schemaVersion=doc.SchemaVersion,kind=Kind(doc.SchemaVersion),route=doc,kitAssetPath=kitPath,kitFingerprint=author.Kit.ContentHash,position=author.transform.position,rotation=author.transform.rotation};
            string full=Path.GetFullPath(path);ResearchAuthorPath(author.Kit,full);
            if(File.Exists(full)){var old=JsonUtility.FromJson<ReplicaFile>(File.ReadAllText(full));if(!Supported(old)||old.kind!=data.kind||old.schemaVersion!=data.schemaVersion)throw new InvalidOperationException("目标不是相同版本的路线文件，请另存并保留原文件。");}
            Directory.CreateDirectory(Path.GetDirectoryName(full));
            string temp=full+".tmp";File.WriteAllText(temp,JsonUtility.ToJson(data,true),new UTF8Encoding(false));if(File.Exists(full))File.Replace(temp,full,full+".bak");else File.Move(temp,full);
        }
        public static void LoadAuthor(ReplicaAuthor author,string path)
        {
            if(author==null)throw new ArgumentNullException("author");if(author.transform.Find("__RoutePreview")!=null)throw new InvalidOperationException("先采用或取消当前候选，再载入路线。");
            var data=JsonUtility.FromJson<ReplicaFile>(File.ReadAllText(path));
            if(!Supported(data))throw new InvalidDataException("不支持或版本不一致的路线文件，当前作品保持。");
            var plan=ReplicaRoute.Solve(data.route);if(!plan.Valid)throw new InvalidDataException(plan.Message);
            string kitPath=AssetPath(data.kitAssetPath,".asset",true);var kit=AssetDatabase.LoadAssetAtPath<ReplicaKit>(kitPath);ReplicaKitRegistry.Validate(kit);
            ResearchAuthorPath(kit,Path.GetFullPath(path));
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
            author.MappingJson=ReplicaGeometry.Mapping(ReplicaRoute.Solve(data.route),kit);EditorUtility.SetDirty(author);EditorSceneManager.MarkSceneDirty(author.gameObject.scene);Undo.FlushUndoRecordObjects();Undo.CollapseUndoOperations(group);
        }
        public static void PersistScene(Scene scene,string path)
        {
            if(!scene.IsValid()||!scene.isLoaded)throw new InvalidOperationException("目标场景尚未载入。");string normalized=AssetPath(path,".unity",false);
            var authors=scene.GetRootGameObjects().SelectMany(g=>g.GetComponentsInChildren<ReplicaAuthor>(true)).ToArray();
            bool research=ResearchScene(authors,normalized);
            foreach(var a in authors)Committed(a);
            if(authors.GroupBy(a=>a.Read().Id,StringComparer.Ordinal).Any(g=>g.Count()>1))throw new InvalidOperationException("同一场景存在重复路线身份，请给复制的路线分配新身份后保存。");
            string root=(research?PrivateAssets+"Generated/":"Assets/BridgeReplica/Generated/")+Key(normalized.ToLowerInvariant());
            foreach(var a in authors.OrderBy(a=>a.Read().Id,StringComparer.Ordinal))ReplicaGeometry.Persist(Committed(a),root+"/route_"+Key(a.Read().Id));
        }
        public static void SaveScene(string path)
        {
            string normalized=AssetPath(path,".unity",true);var scene=SceneManager.GetActiveScene();
            if(!scene.GetRootGameObjects().Any(g=>g.GetComponentInChildren<ReplicaAuthor>(true)!=null))throw new InvalidOperationException("当前场景没有路线作者。");
            ResearchScene(scene.GetRootGameObjects().SelectMany(g=>g.GetComponentsInChildren<ReplicaAuthor>(true)).ToArray(),normalized);
            foreach(var f in scene.GetRootGameObjects().SelectMany(g=>g.GetComponentsInChildren<MeshFilter>(true)))if(f.sharedMesh!=null&&f.GetComponentInParent<ReplicaAuthor>()==null&&!AssetDatabase.Contains(f.sharedMesh))throw new InvalidOperationException("场景中其它作者的网格尚未持久保存，请先使用它所属的编辑器保存。");
            ReplicaKitRegistry.Folder(Path.GetDirectoryName(normalized).Replace('\\','/'));PersistScene(scene,normalized);AssetDatabase.SaveAssets();if(!EditorSceneManager.SaveScene(scene,normalized))throw new IOException("路线场景保存失败。");
        }
        public static GameObject Bake(ReplicaAuthor author,string prefabPath)
        {
            if(author!=null&&author.Kit!=null&&author.Kit.ResearchOnly)throw new InvalidOperationException("原作研究套件禁止烘焙或导出独立预制体；原创A/B套件仍可正常导出。");
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
