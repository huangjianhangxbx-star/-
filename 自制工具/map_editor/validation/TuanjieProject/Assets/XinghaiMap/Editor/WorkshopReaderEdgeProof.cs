using System;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEditor;
namespace Xinghai.MapEditor.Editor {
 public static class WorkshopReaderEdgeProof {
  static string Source="../workshop-task7/real-project/releases/fbx-proof";
  static void Save(string folder,string relative,JObject value){File.WriteAllText(Path.Combine(folder,relative),value.ToString());}
  static void Rehash(string folder,JObject manifest){foreach(var row in manifest["payloadFiles"].Concat(manifest["outputFiles"])){var bytes=File.ReadAllBytes(Path.Combine(folder,(string)row["path"]));row["sha256"]=PublishReader.Hash(bytes);row["byteLength"]=bytes.Length;}foreach(var dep in manifest["dependencies"]){string stem="payload/source/assets/"+(string)dep["assetId"];var rows=manifest["payloadFiles"].Where(f=>(string)f["path"]==stem+".xhmodule.json"||(string)f["path"]==stem+".png"||((string)f["path"]).StartsWith(stem+"/",StringComparison.Ordinal)).OrderBy(f=>(string)f["path"],StringComparer.Ordinal).Select(f=>new JObject{["path"]=f["path"].DeepClone(),["sha256"]=f["sha256"].DeepClone(),["byteLength"]=f["byteLength"].DeepClone()});dep["contentHash"]=PublishReader.Hash(Encoding.UTF8.GetBytes(new JArray(rows).ToString(Formatting.None)));}string runtime=(string)manifest["runtimePath"];var scene=JObject.Parse(File.ReadAllText(Path.Combine(folder,runtime)));foreach(var binding in scene["bindings"])binding["contentHash"]=manifest["dependencies"].First(d=>(string)d["assetId"]==(string)binding["assetId"])["contentHash"].DeepClone();Save(folder,runtime,scene);var r=manifest["payloadFiles"].First(f=>(string)f["path"]==runtime);var b=File.ReadAllBytes(Path.Combine(folder,runtime));r["sha256"]=PublishReader.Hash(b);r["byteLength"]=b.Length;}
  public static void Run(){try{var failures=new JArray();foreach(string name in new[]{"voxel-phase","fractional-rotation","unknown-group","scene-source-assets","fractional-length","native-grid","png-crc"}){string folder="../workshop-task8/reader-edge/"+name;Directory.CreateDirectory(folder);foreach(var f in Directory.GetFiles(Source,"*",SearchOption.AllDirectories)){string relative=f.Substring(Source.Length+1);string target=Path.Combine(folder,relative);Directory.CreateDirectory(Path.GetDirectoryName(target));File.Copy(f,target,true);}var m=JObject.Parse(File.ReadAllText(Path.Combine(folder,"manifest.json")));string runtime=(string)m["runtimePath"];var scene=JObject.Parse(File.ReadAllText(Path.Combine(folder,runtime)));var source=JObject.Parse(File.ReadAllText(Path.Combine(folder,"payload/source/scene.xhscene.json")));
   if(name=="voxel-phase"){scene["instances"][0]["positionM"]=new JArray(.1,0,0);source["instances"][0]["positionM"]=new JArray(.1,0,0);}if(name=="fractional-rotation"){scene["instances"][0]["rotationDeg"]=90.5;source["instances"][0]["rotationDeg"]=90.5;}
   if(name=="unknown-group"){scene["groups"][0]["unexpected"]=true;source["groups"][0]["unexpected"]=true;}
   if(name=="scene-source-assets")((JArray)source["assets"]).RemoveAt(3);
   if(name=="native-grid"){var dep=m["dependencies"][0];string a=(string)dep["sourcePath"],r=(string)dep["unity"]["runtimePath"];foreach(string file in new[]{a,r}){var voxel=JObject.Parse(File.ReadAllText(Path.Combine(folder,file)));voxel["rootMode"]="grid";voxel["anchorM"]=new JArray(.1,0,0);Save(folder,file,voxel);}dep["anchorM"]=new JArray(.1,0,0);}
   if(name=="png-crc"){string png=(string)m["dependencies"].Last()["sourcePath"];byte[] bytes=File.ReadAllBytes(Path.Combine(folder,png));bytes[bytes.Length-1]^=1;File.WriteAllBytes(Path.Combine(folder,png),bytes);}
   Save(folder,runtime,scene);Save(folder,"payload/source/scene.xhscene.json",source);Rehash(folder,m);if(name=="fractional-length")m["payloadFiles"][0]["byteLength"]=(double)m["payloadFiles"][0]["byteLength"]+.4;Save(folder,"manifest.json",m);bool rejected=false;try{PublishReader.Read(Path.Combine(folder,"manifest.json"));}catch{rejected=true;}if(!rejected)failures.Add(name);
  }WorkshopPublishProof.Check(failures.Count==0,"Reader accepted malformed frozen packages: "+failures.ToString(Formatting.None));File.WriteAllText("../workshop-task8/reader-edge-proof.json","{\"passed\":true,\"rejections\":6}");Debug.Log("XH_WORKSHOP_READER_EDGE_PASS");EditorApplication.Exit(0);}catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
 }
}
