using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace XingHai.SB03.Editor
{
    // Native Ctrl+S has the same B-owned mesh persistence as the explicit menu.
    [InitializeOnLoad] public sealed class SB03BridgeSaveGuard : AssetModificationProcessor
    {
        static bool saving;
        static readonly Dictionary<string,Scene> pending=new Dictionary<string,Scene>(StringComparer.OrdinalIgnoreCase);
        static SB03BridgeSaveGuard(){EditorSceneManager.sceneSaving+=BeforeSceneSave;}
        static void BeforeSceneSave(Scene scene,string path)
        {
            pending[path.Replace('\\','/')]=scene;if(saving)return;
            var authors=scene.GetRootGameObjects().SelectMany(r=>r.GetComponentsInChildren<SB03BridgeAuthor>(true)).ToArray();if(authors.Length==0)return;
            // Direct EditorSceneManager.SaveScene bypasses OnWillSaveAssets on
            // this engine. Persist before its native scene serialization too.
            try{saving=true;foreach(var author in authors)SB03BridgeSession.Get(author).Cancel();SB03BridgeFiles.PersistSceneMeshes(scene,path);}
            catch(Exception error){Debug.LogWarning("桥梁场景保存已阻止："+error.Message);throw;}
            finally{saving=false;}
        }
        static string[] OnWillSaveAssets(string[] paths)
        {
            if(saving)return paths;var allowed=new List<string>();
            foreach(string path in paths)
            {
                if(!path.EndsWith(".unity",StringComparison.OrdinalIgnoreCase)){allowed.Add(path);continue;}
                string normalized=path.Replace('\\','/');var scene=SceneManager.GetSceneByPath(normalized);if((!scene.IsValid()||!scene.isLoaded)&&pending.ContainsKey(normalized))scene=pending[normalized];
                if(!scene.IsValid()||!scene.isLoaded){allowed.Add(path);continue;}
                bool hasBridge=scene.GetRootGameObjects().Any(r=>r.GetComponentInChildren<SB03BridgeAuthor>(true)!=null);
                if(!hasBridge){allowed.Add(path);pending.Remove(normalized);continue;}
                try{saving=true;SB03BridgeFiles.PersistSceneMeshes(scene,normalized);allowed.Add(path);}
                catch(Exception error){Debug.LogWarning("桥梁场景保存已阻止："+error.Message);}
                finally{saving=false;pending.Remove(normalized);}
            }
            return allowed.ToArray();
        }
    }
}
