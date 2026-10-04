using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;
namespace Xinghai.MapEditor.Editor {
 public static class WorkshopPackageProof {
  public static void Export(){try{var list=JObject.Parse(File.ReadAllText("../../scripts/workshop-plugin-files.json"));var paths=list["runtime"].Select(n=>"Assets/XinghaiMap/Runtime/"+(string)n).Concat(list["editor"].Select(n=>"Assets/XinghaiMap/Editor/"+(string)n)).ToArray();if(paths.Length!=25||paths.Distinct().Count()!=25||paths.Any(p=>p.Contains("Proof")||!File.Exists(p)))throw new Exception("Invalid formal plugin whitelist");foreach(var path in paths){string formal="../../adapters/tuanjie/"+path.Substring("Assets/XinghaiMap/".Length);if(!File.ReadAllBytes(path).SequenceEqual(File.ReadAllBytes(formal)))throw new Exception("Verification source differs from formal source: "+path);}Directory.CreateDirectory("../../release");AssetDatabase.ExportPackage(paths,"../../release/星骸地图团结插件-Workshop-M2.0.unitypackage",ExportPackageOptions.Default);Debug.Log("XH_WORKSHOP_PACKAGE_PASS");EditorApplication.Exit(0);}catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
 }
}
