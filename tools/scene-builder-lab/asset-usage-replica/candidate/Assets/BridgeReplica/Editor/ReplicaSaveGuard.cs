using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
namespace XingHai.BridgeReplica.Editor
{
    [InitializeOnLoad] public sealed class ReplicaSaveGuard : AssetModificationProcessor
    {
        static bool saving;
        static readonly Dictionary<string,Scene> pending=new Dictionary<string,Scene>(StringComparer.OrdinalIgnoreCase);
        static ReplicaSaveGuard(){EditorSceneManager.sceneSaving+=BeforeSave;}
        static bool Has(Scene scene){return scene.IsValid()&&scene.isLoaded&&scene.GetRootGameObjects().Any(g=>g.GetComponentInChildren<ReplicaAuthor>(true)!=null);}
        static void BeforeSave(Scene scene,string path)
        {
            if(saving||!Has(scene))return;pending[path.Replace('\\','/')]=scene;
            try
            {
                saving=true;foreach(var a in scene.GetRootGameObjects().SelectMany(g=>g.GetComponentsInChildren<ReplicaAuthor>(true)))ReplicaSession.Get(a).Cancel();
                ReplicaFiles.PersistScene(scene,path);
            }
            finally{saving=false;}
        }
        static string[] OnWillSaveAssets(string[] paths)
        {
            if(saving)return paths;var allowed=new List<string>();
            foreach(var p in paths)
            {
                if(!p.EndsWith(".unity",StringComparison.OrdinalIgnoreCase)){allowed.Add(p);continue;}
                string path=p.Replace('\\','/');Scene scene=SceneManager.GetSceneByPath(path);if((!scene.IsValid()||!scene.isLoaded)&&pending.ContainsKey(path))scene=pending[path];
                if(!Has(scene)){allowed.Add(p);continue;}
                try{saving=true;ReplicaFiles.PersistScene(scene,path);allowed.Add(p);}
                catch(Exception error){Debug.LogWarning("路线保存未执行："+error.Message);}
                finally{saving=false;pending.Remove(path);}
            }
            return allowed.ToArray();
        }
    }
}
