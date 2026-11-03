using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace XingHai.LE01.Editor
{
    // Ctrl+S must never serialize a preview or transient unreferenced Mesh.
    public sealed class LE04TerrainSaveGuard : AssetModificationProcessor
    {
        static bool saving;
        static string[] OnWillSaveAssets(string[] paths)
        {
            if(saving)return paths;var allowed=new List<string>();
            foreach(string path in paths)
            {
                if(!path.EndsWith(".unity",StringComparison.OrdinalIgnoreCase)){allowed.Add(path);continue;}
                var scene=SceneManager.GetSceneByPath(path);if(!scene.IsValid()||!scene.isLoaded){allowed.Add(path);continue;}
                var authors=new List<LE01TerrainAuthor>();foreach(var root in scene.GetRootGameObjects())authors.AddRange(root.GetComponentsInChildren<LE01TerrainAuthor>(true));
                bool basic=false,denied=false;foreach(var author in authors)if(LE04TerrainSession.Has(author))
                {
                    basic=true;if(LE04TerrainSession.IsBusy(author)){Debug.LogWarning("基础地貌候选未结束，本次场景保存已阻止。请先应用或取消。");denied=true;break;}
                    try{saving=true;LE04TerrainFiles.SaveScene(author,path);}catch(Exception error){Debug.LogWarning(error.Message);denied=true;}finally{saving=false;}
                }
                if(!basic||!denied)allowed.Add(path);
            }
            return allowed.ToArray();
        }
    }
}
