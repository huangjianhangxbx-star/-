using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01;
using XingHai.LE01.Core;
using XingHai.LE01.Editor;
namespace XingHai.LE04.QA
{
 public static class LE04DeliveryAudit
 {
  [Serializable] sealed class Dependency{public string path,guid,fileSha256,metaSha256,packageName,packageVersion;public long size;}
  [Serializable] sealed class Source{public string path,sha256;public long size;}
  [Serializable] sealed class Report{public string status="PASS",engine,utc,sourceHash,shaderHash,scene="Assets/LE04/Scenes/LE04_Workflow.unity",authorHash,meshHash,packageManifestHash,packageLockHash;public int meshCount,referenceCount,paletteCount;public List<Dependency> dependencies=new List<Dependency>();public List<Source> sources=new List<Source>();}
  static string Hash(string path){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-","");}
  public static void Run()
  {
   if(!Application.isBatchMode)throw new InvalidOperationException("Delivery audit only runs in isolated batch QA");
   var r=new Report{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O"),sourceHash=LE01BEvidence.SourceHash(),packageManifestHash=Hash("Packages/manifest.json"),packageLockHash=Hash("Packages/packages-lock.json")};
   EditorSceneManager.OpenScene(r.scene);var a=UnityEngine.Object.FindObjectOfType<LE01TerrainAuthor>();if(a==null||!LE04TerrainSession.Has(a))throw new Exception("Sample must contain an editable basic terrain author");
   var state=a.GetComponent<LE04TerrainState>().Read();var snapshot=TerrainEffectiveSource.Capture(a.Read(),state);r.authorHash=snapshot.ContentHash();r.meshHash=LE01CEvidence.MeshFingerprint(a);r.referenceCount=state.References.Count;r.paletteCount=state.Palette.Count;
   var expected=LE04TerrainFiles.Read(File.ReadAllText(Path.Combine(Environment.GetEnvironmentVariable("LE04_OUTPUT_ROOT"),"samples/LE04_Workflow.basicterrain.json")));
   if(TerrainEffectiveSource.Capture(expected.terrain,expected.editState).ContentHash()!=r.authorHash)throw new Exception("Complete file and native Scene do not have the same effective author");
   foreach(var f in LE01Adapter.Geometry(a).GetComponentsInChildren<MeshFilter>()){r.meshCount++;if(f.sharedMesh==null||!AssetDatabase.Contains(f.sharedMesh))throw new Exception("Sample references missing or temporary mesh");var renderer=f.GetComponent<MeshRenderer>();if(renderer==null||renderer.sharedMaterial==null||renderer.sharedMaterial.GetTexture("_BaseMap")==null)throw new Exception("Sample references missing palette material");}
   foreach(var go in a.gameObject.scene.GetRootGameObjects())foreach(var component in go.GetComponentsInChildren<Component>(true))if(component==null)throw new Exception("Native Scene has a missing script");
   // The portable project must resolve the rendering pipeline and settings as
   // well as the Scene. The disposable project builds only this new sample.
   EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(r.scene,true)};
   AssetDatabase.SaveAssets();
   var seeds=new HashSet<string>(StringComparer.Ordinal){r.scene};
   foreach(string settingsPath in Directory.GetFiles("ProjectSettings","*.asset",SearchOption.TopDirectoryOnly)){
    foreach(Match match in Regex.Matches(File.ReadAllText(settingsPath),@"\bguid:\s*([A-Fa-f0-9]{32})(?=[,\s}])")){
     string guid=match.Groups[1].Value;if(guid.StartsWith("0000000000000000",StringComparison.Ordinal))continue;
     string assetPath=AssetDatabase.GUIDToAssetPath(guid);if(string.IsNullOrEmpty(assetPath))throw new Exception("Unresolved project configuration GUID "+guid+" in "+settingsPath);seeds.Add(assetPath);
    }
    r.sources.Add(new Source{path=settingsPath.Replace('\\','/'),sha256=Hash(settingsPath),size=new FileInfo(settingsPath).Length});
   }
   r.sources.Add(new Source{path="ProjectSettings/ProjectVersion.txt",sha256=Hash("ProjectSettings/ProjectVersion.txt"),size=new FileInfo("ProjectSettings/ProjectVersion.txt").Length});
   foreach(string path in AssetDatabase.GetDependencies(seeds.ToArray(),true).OrderBy(s=>s,StringComparer.Ordinal)){
    bool package=path.StartsWith("Packages/",StringComparison.Ordinal);if(!path.StartsWith("Assets/",StringComparison.Ordinal)&&!package)continue;
    string guid=AssetDatabase.AssetPathToGUID(path);if(string.IsNullOrEmpty(guid)||AssetDatabase.GUIDToAssetPath(guid)!=path)throw new Exception("AssetDatabase GUID roundtrip mismatch: "+path);
    string physical=path;UnityEditor.PackageManager.PackageInfo info=null;
    if(package){info=UnityEditor.PackageManager.PackageInfo.FindForAssetPath(path);if(info==null)throw new Exception("Package dependency is unresolved: "+path);physical=Path.Combine(info.resolvedPath,path.Substring(info.assetPath.Length+1));}
    if(!File.Exists(physical)||!File.Exists(physical+".meta"))throw new Exception("Missing native asset or .meta: "+path);
    r.dependencies.Add(new Dependency{path=path,guid=guid,fileSha256=Hash(physical),metaSha256=Hash(physical+".meta"),size=new FileInfo(physical).Length,packageName=info==null?"":info.name,packageVersion=info==null?"":info.version});
   }
   foreach(string path in Directory.GetFiles("Assets/LE01","*.cs",SearchOption.AllDirectories).OrderBy(s=>s,StringComparer.CurrentCulture))r.sources.Add(new Source{path=path.Replace('\\','/'),sha256=Hash(path),size=new FileInfo(path).Length});
   foreach(string path in Directory.GetFiles("Assets/LE01","*.shader",SearchOption.AllDirectories)){r.shaderHash=Hash(path);r.sources.Add(new Source{path=path.Replace('\\','/'),sha256=r.shaderHash,size=new FileInfo(path).Length});}
   File.WriteAllText(Path.Combine(Environment.GetEnvironmentVariable("LE04_REPORT_ROOT"),"delivery-audit.json"),JsonUtility.ToJson(r,true));Debug.Log("LE04_DELIVERY_AUDIT_PASS");
  }
 }
}
