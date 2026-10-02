using System;
using System.IO;
using System.Collections.Generic;
using UnityEditor;
using Newtonsoft.Json;
using System.Linq;
namespace Xinghai.MapEditor.Editor {
 public sealed class BakeJournal:IDisposable {
  readonly Dictionary<string,byte[]> files=new Dictionary<string,byte[]>();bool committed;
  readonly Dictionary<UnityEngine.Object,UnityEngine.Object> snapshots=new Dictionary<UnityEngine.Object,UnityEngine.Object>();
  public void Snapshot(UnityEngine.Object obj){if(obj!=null&&!snapshots.ContainsKey(obj))snapshots[obj]=UnityEngine.Object.Instantiate(obj);}
  readonly string journal=Path.Combine("Library/XinghaiBakeRecovery",Guid.NewGuid()+".json");
  public void Watch(string path){if(!path.StartsWith("Assets/Generated/",StringComparison.Ordinal)||path.Contains(".."))throw new Exception("Invalid recovery path");foreach(var p in new[]{path,path+".meta"})if(!files.ContainsKey(p))files[p]=File.Exists(p)?File.ReadAllBytes(p):null;Directory.CreateDirectory(Path.GetDirectoryName(journal));var temp=journal+".writing";File.WriteAllText(temp,JsonConvert.SerializeObject(files));if(File.Exists(journal))File.Replace(temp,journal,null);else File.Move(temp,journal);}
  public void Commit(){AssetDatabase.SaveAssets();committed=true;if(File.Exists(journal))File.Delete(journal);}
  static void Restore(Dictionary<string,byte[]> entries){foreach(var pair in entries){string absolute=Path.GetFullPath(pair.Key),root=Path.GetFullPath("Assets/Generated")+Path.DirectorySeparatorChar;if(!absolute.StartsWith(root,StringComparison.OrdinalIgnoreCase))throw new Exception("Recovery path outside generated root");if(pair.Value==null){if(File.Exists(pair.Key))File.Delete(pair.Key);}else File.WriteAllBytes(pair.Key,pair.Value);}AssetDatabase.Refresh(ImportAssetOptions.ForceUpdate|ImportAssetOptions.ForceSynchronousImport);foreach(var key in entries.Keys.Where(p=>!p.EndsWith(".meta")&&File.Exists(p)))AssetDatabase.ImportAsset(key,ImportAssetOptions.ForceUpdate|ImportAssetOptions.ForceSynchronousImport);}
  public void Dispose(){try{if(committed)return;foreach(var pair in snapshots)if(pair.Key!=null){EditorUtility.CopySerialized(pair.Value,pair.Key);EditorUtility.ClearDirty(pair.Key);}Restore(files);if(File.Exists(journal))File.Delete(journal);}finally{foreach(var copy in snapshots.Values)if(copy!=null)UnityEngine.Object.DestroyImmediate(copy);}}
  public static void Recover(){if(!Directory.Exists("Library/XinghaiBakeRecovery"))return;foreach(var file in Directory.GetFiles("Library/XinghaiBakeRecovery","*.json")){Restore(JsonConvert.DeserializeObject<Dictionary<string,byte[]>>(File.ReadAllText(file)));File.Delete(file);UnityEngine.Debug.LogWarning("已恢复中断前的地图烘焙："+file);}}
  [InitializeOnLoadMethod]static void QueueRecovery(){EditorApplication.delayCall+=Recover;}
 }
}
