using System;
using System.IO;
using System.Linq;
using UnityEditor;
namespace XingHai.BridgeReplica.Editor
{
    public static class ReplicaPublicExport
    {
        // Apply to the actual package entry points, not a hand-maintained list
        // of original JSON filenames. Scenes inherit all referenced dependencies.
        public static string[] ValidateClosure(string[] entryPoints)
        {
            if(entryPoints==null||entryPoints.Length==0)throw new InvalidDataException("缺少公开导出入口。");
            var entries=entryPoints.Select(p=>p.Replace('\\','/')).ToArray();
            if(entries.Any(p=>!p.StartsWith("Assets/",StringComparison.Ordinal)||p.Contains("..")||!File.Exists(p)))throw new InvalidDataException("公开入口须为实际Assets资源文件。");
            var closure=AssetDatabase.GetDependencies(entries,true).Concat(entries).Distinct().OrderBy(p=>p,StringComparer.Ordinal).ToArray();
            foreach(string path in closure)
            {
                if(path.StartsWith("Assets/BridgeReplica/ResearchPrivate/",StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("公开导出依赖了原作研究产物："+path);
                var kit=AssetDatabase.LoadAssetAtPath<ReplicaKit>(path);if(kit!=null&&kit.ResearchOnly)throw new InvalidOperationException("公开导出依赖了研究套件："+path);
                if(path.StartsWith("Assets/",StringComparison.Ordinal)&&!path.StartsWith("Assets/BridgeReplica/",StringComparison.Ordinal)&&!path.StartsWith("Assets/SB03/",StringComparison.Ordinal)&&!path.StartsWith("Assets/LE01/Rendering/",StringComparison.Ordinal))throw new InvalidOperationException("公开依赖超出本工具白名单："+path);
            }
            return closure;
        }
    }
}
