using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace XingHai.SB03.Editor
{
    [Serializable] public sealed class SB03BridgeFile
    {
        public int schemaVersion=1,recipeVersion=1,revision;
        public string kind="purpose-built-stone-bridge",kitContractSha256,sourceMapJson;
        public BridgeSpec spec;
        public Vector3 position;
        public Quaternion rotation=Quaternion.identity;
    }

    public static class SB03BridgeFiles
    {
        const string Contract="Assets/SB03/Kit/contracts.json";
        static string HashFile(string path){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-","");}
        static string HashText(string value){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(value))).Replace("-","").ToLowerInvariant();}
        static void RequireTransform(Transform root)
        {
            if((root.lossyScale-Vector3.one).sqrMagnitude>.000001f)throw new InvalidOperationException("桥梁源构件禁止缩放。请保持根对象世界缩放为1，再保存或烘焙。");
            if(Quaternion.Angle(root.rotation,Quaternion.Euler(0,root.eulerAngles.y,0))>.001f)throw new InvalidOperationException("当前桥梁作者只支持平移与水平转向；请恢复俯仰后保存。");
        }
        static GameObject Committed(SB03BridgeAuthor author)
        {
            if(author==null)throw new ArgumentNullException("author");
            if(author.transform.Find("__SB03_Preview")!=null)throw new InvalidOperationException("请先应用或取消桥梁候选，再保存或烘焙。");
            RequireTransform(author.transform);
            var plan=BridgeSolver.Solve(author.Spec);if(!plan.Valid)throw new InvalidDataException(plan.Message);
            var root=author.transform.Find("__SB03_Generated");if(root==null||!root.GetComponentsInChildren<MeshFilter>().Any(f=>f.sharedMesh!=null))throw new InvalidOperationException("桥梁尚无已提交网格，请先生成有效桥梁。");
            return root.gameObject;
        }
        public static void EnsureFolder(string folder)
        {
            folder=folder.Replace('\\','/');if(folder=="Assets")return;
            if(!folder.StartsWith("Assets/",StringComparison.Ordinal)||folder.Split('/').Any(x=>string.IsNullOrWhiteSpace(x)||x=="."||x==".."))throw new InvalidOperationException("无效资源目录。");
            if(AssetDatabase.IsValidFolder(folder))return;string parent=Path.GetDirectoryName(folder).Replace('\\','/');EnsureFolder(parent);AssetDatabase.CreateFolder(parent,Path.GetFileName(folder));
        }
        static string AssetPath(string path,string extension)
        {
            string normalized=path.Replace('\\','/');if(!normalized.StartsWith("Assets/SB03/",StringComparison.Ordinal)||Path.GetExtension(normalized)!=extension||normalized.Split('/').Any(x=>string.IsNullOrWhiteSpace(x)||x=="."||x==".."||x.IndexOfAny(Path.GetInvalidFileNameChars())>=0))throw new InvalidOperationException("桥梁资源须保存到 Assets/SB03 下的有效 "+extension+" 文件。");
            return normalized;
        }
        public static void SaveAuthor(SB03BridgeAuthor author,string file)
        {
            Committed(author);SB03BridgeGeometry.PrepareKit();if(!File.Exists(Contract))throw new FileNotFoundException("缺少桥梁素材契约。",Contract);
            var data=new SB03BridgeFile{spec=author.Spec.Clone(),revision=author.Revision,sourceMapJson=author.SourceMapJson,kitContractSha256=HashFile(Contract),position=author.transform.position,rotation=author.transform.rotation};
            string full=Path.GetFullPath(file);Directory.CreateDirectory(Path.GetDirectoryName(full));
            if(File.Exists(full)){var old=JsonUtility.FromJson<SB03BridgeFile>(File.ReadAllText(full));if(old==null||old.kind!=data.kind||old.schemaVersion!=1)throw new InvalidOperationException("请另存桥梁作者文件，保留原文件。");}
            File.WriteAllText(full+".tmp",JsonUtility.ToJson(data,true),new System.Text.UTF8Encoding(false));if(File.Exists(full))File.Replace(full+".tmp",full,full+".bak");else File.Move(full+".tmp",full);
        }
        public static void LoadAuthor(SB03BridgeAuthor author,string file)
        {
            if(author==null)throw new ArgumentNullException("author");
            if(author.transform.Find("__SB03_Preview")!=null)throw new InvalidOperationException("请先应用或取消桥梁候选，再打开文件。");
            var data=JsonUtility.FromJson<SB03BridgeFile>(File.ReadAllText(file));
            if(data==null||data.kind!="purpose-built-stone-bridge"||data.schemaVersion!=1||data.recipeVersion!=1||data.spec==null)throw new InvalidDataException("不支持的桥梁作者文件；当前桥梁保持原样。");
            var plan=BridgeSolver.Solve(data.spec);if(!plan.Valid)throw new InvalidDataException(plan.Message);
            foreach(float v in new[]{data.position.x,data.position.y,data.position.z,data.rotation.x,data.rotation.y,data.rotation.z,data.rotation.w})if(float.IsNaN(v)||float.IsInfinity(v))throw new InvalidDataException("桥梁变换包含无效数字。");
            float norm=data.rotation.x*data.rotation.x+data.rotation.y*data.rotation.y+data.rotation.z*data.rotation.z+data.rotation.w*data.rotation.w;
            if(Mathf.Abs(norm-1)>.001f||Quaternion.Angle(data.rotation,Quaternion.Euler(0,data.rotation.eulerAngles.y,0))>.001f)throw new InvalidDataException("桥梁文件的水平转向无效。");
            SB03BridgeGeometry.PrepareKit();if(!File.Exists(Contract)||HashFile(Contract)!=data.kitContractSha256)throw new InvalidDataException("文件依赖的桥梁素材版本与当前契约不同。请保留原文件，先核对素材版本。");
            var session=SB03BridgeSession.Get(author);if(!session.Preview(data.spec))throw new InvalidDataException("桥梁文件无法生成，原作品已保留。");
            Undo.IncrementCurrentGroup();int group=Undo.GetCurrentGroup();Undo.SetCurrentGroupName("打开桥梁作者");Undo.RecordObject(author,"打开桥梁作者");Undo.RecordObject(author.transform,"打开桥梁作者");
            if(!session.Apply()){session.Cancel();throw new InvalidOperationException("桥梁文件未提交，原作品已保留。");}
            author.Revision=data.revision;author.transform.position=data.position;author.transform.rotation=data.rotation;author.transform.localScale=Vector3.one;
            EditorUtility.SetDirty(author);EditorSceneManager.MarkSceneDirty(author.gameObject.scene);Undo.FlushUndoRecordObjects();Undo.CollapseUndoOperations(group);
        }
        public static void SaveScene(string path)
        {
            string normalized=AssetPath(path,".unity");if(!normalized.StartsWith("Assets/SB03/Scenes/",StringComparison.Ordinal)&&!normalized.StartsWith("Assets/SB03/WorkScenes/",StringComparison.Ordinal))throw new InvalidOperationException("桥梁场景请保存到 SB03/Scenes 或 WorkScenes，保留其它研究场景。");
            var scene=SceneManager.GetActiveScene();var authors=scene.GetRootGameObjects().SelectMany(r=>r.GetComponentsInChildren<SB03BridgeAuthor>(true)).ToArray();
            if(authors.Length==0)throw new InvalidOperationException("当前场景没有桥梁作者。");
            // A and independent objects retain their own persistence ownership.
            foreach(var filter in scene.GetRootGameObjects().SelectMany(r=>r.GetComponentsInChildren<MeshFilter>(true)))if(filter.sharedMesh!=null&&filter.GetComponentInParent<SB03BridgeAuthor>()==null&&!AssetDatabase.Contains(filter.sharedMesh))throw new InvalidOperationException("场景中另有尚未持久保存的独立网格。请先使用其所属编辑器保存，再保存桥梁场景。");
            EnsureFolder(Path.GetDirectoryName(normalized).Replace('\\','/'));PersistSceneMeshes(scene,normalized);
            AssetDatabase.SaveAssets();if(!EditorSceneManager.SaveScene(scene,normalized))throw new IOException("桥梁场景保存失败。");
        }
        public static void PersistSceneMeshes(Scene scene,string path)
        {
            if(!scene.IsValid()||!scene.isLoaded)throw new InvalidOperationException("目标场景尚未载入。");
            string normalized=path.Replace('\\','/');if(!normalized.StartsWith("Assets/",StringComparison.Ordinal)||!normalized.EndsWith(".unity",StringComparison.OrdinalIgnoreCase)||normalized.Split('/').Any(x=>string.IsNullOrWhiteSpace(x)||x=="."||x==".."))throw new InvalidOperationException("原生场景须保存到 Assets 内的有效路径。");
            var authors=scene.GetRootGameObjects().SelectMany(r=>r.GetComponentsInChildren<SB03BridgeAuthor>(true)).ToArray();if(authors.Length==0)return;
            // Validate every author before writing any asset. Enumeration order
            // must never become another author's persistent asset identity.
            foreach(var author in authors)Committed(author);
            if(authors.GroupBy(a=>a.Spec.Id,StringComparer.Ordinal).Any(g=>g.Count()>1))throw new InvalidOperationException("场景中有重复的桥梁身份。请为复制出的桥梁分配新身份后保存；原有网格保持原样。");
            string folder="Assets/SB03/Generated/NativeScenes/"+HashText(normalized.ToLowerInvariant()).Substring(0,16);EnsureFolder(folder);
            foreach(var author in authors.OrderBy(a=>a.Spec.Id,StringComparer.Ordinal))SB03BridgeGeometry.PersistMeshes(Committed(author),folder+"/bridge_"+HashText(author.Spec.Id).Substring(0,32));
        }
        public static GameObject Bake(SB03BridgeAuthor author,string prefabPath)
        {
            var source=Committed(author);string path=AssetPath(prefabPath,".prefab");EnsureFolder(Path.GetDirectoryName(path).Replace('\\','/'));
            var baked=UnityEngine.Object.Instantiate(source);baked.name="SB03_Baked_"+author.Spec.Id;baked.transform.SetParent(null,false);baked.transform.position=author.transform.position;baked.transform.rotation=author.transform.rotation;baked.transform.localScale=Vector3.one;
            try{
                foreach(var t in baked.GetComponentsInChildren<Transform>(true))t.gameObject.hideFlags=HideFlags.None;
                foreach(var component in baked.GetComponentsInChildren<MonoBehaviour>(true))UnityEngine.Object.DestroyImmediate(component);
                // GameObject cloning shares Mesh references. Give the bake its own
                // meshes before persistence can retire a transient source Mesh.
                foreach(var filter in baked.GetComponentsInChildren<MeshFilter>(true))if(filter.sharedMesh!=null){filter.sharedMesh=UnityEngine.Object.Instantiate(filter.sharedMesh);var collider=filter.GetComponent<MeshCollider>();if(collider!=null)collider.sharedMesh=filter.sharedMesh;}
                string folder=Path.ChangeExtension(path,null)+"_Meshes";EnsureFolder(folder);SB03BridgeGeometry.PersistMeshes(baked,folder);AssetDatabase.SaveAssets();
                bool success;PrefabUtility.SaveAsPrefabAsset(baked,path,out success);if(!success)throw new IOException("独立桥梁预制体保存失败。");
                return baked;
            }catch{UnityEngine.Object.DestroyImmediate(baked);throw;}
        }
    }
}
