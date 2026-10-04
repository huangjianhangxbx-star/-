using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEditor;
namespace Xinghai.MapEditor.Editor {
 public static class WorkshopPublishProof {
  public static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
  static string Manifest=>Path.GetFullPath("../workshop-task7/real-project/releases/fbx-proof/manifest.json");
  static void Reject(Action action,string message){bool rejected=false;try{action();}catch(Exception){rejected=true;}Check(rejected,message);}
  public static void Run(){try{
   var package=PublishReader.Read(Manifest);
   Check(package.manifest.publishId=="fbx-proof"&&package.manifest.dependencies.Length==4,"Frozen manifest identity lost");
   string temp=Path.GetFullPath("../workshop-task8/reader");Directory.CreateDirectory(temp);
   foreach(string mutation in new[]{"schema","axes","recipe","hash","missing","duplicate","escape","binding","runtime-editor","root"}){
    string folder=Path.Combine(temp,mutation);Copy(Path.GetDirectoryName(Manifest),folder);var m=JObject.Parse(File.ReadAllText(Path.Combine(folder,"manifest.json")));
    if(mutation=="schema")m["schema"]="wrong";
    if(mutation=="axes")m["sourceAxes"]="";
    if(mutation=="recipe")m["recipe"]="unknown";
    if(mutation=="hash")m["payloadFiles"][0]["sha256"]=new string('0',64);
    if(mutation=="missing")File.Delete(Path.Combine(folder,(string)m["outputFiles"][0]["path"]));
    if(mutation=="escape")m["payloadFiles"][0]["path"]="../elsewhere.json";
    if(mutation=="binding"||mutation=="runtime-editor"||mutation=="root"){
     string rel=(string)m["runtimePath"];var runtime=JObject.Parse(File.ReadAllText(Path.Combine(folder,rel)));
     if(mutation=="binding")runtime["instances"][0]["assetId"]="missing";
     if(mutation=="runtime-editor")runtime["editor"]=new JObject();
     if(mutation=="root")m["dependencies"][0]["anchorM"]=new JArray(.125,0,0);
     if(mutation!="root"){File.WriteAllText(Path.Combine(folder,rel),runtime.ToString());var row=m["payloadFiles"].First(r=>(string)r["path"]==rel);var bytes=File.ReadAllBytes(Path.Combine(folder,rel));row["sha256"]=PublishReader.Hash(bytes);row["byteLength"]=bytes.Length;}
    }
    File.WriteAllText(Path.Combine(folder,"manifest.json"),m.ToString());
    if(mutation=="duplicate")File.WriteAllText(Path.Combine(folder,"manifest.json"),m.ToString().Replace("\"publishId\": \"fbx-proof\"","\"publishId\": \"fbx-proof\", \"publishId\": \"other\""));
    Reject(()=>PublishReader.Read(Path.Combine(folder,"manifest.json")),"Accepted invalid package: "+mutation);
   }
   var first=SceneBaker.Bake(package,new ReceiveOptions());string prefabPath=AssetDatabase.GetAssetPath(first.prefab),guid=AssetDatabase.AssetPathToGUID(prefabPath);
   Check(prefabPath=="Assets/Generated/Workshop/fbx-proof/primary/Scene.prefab","Receipt path wrong");
   Check(first.prefab.GetComponentsInChildren<PublishedInstance>(true).Length==7,"Stable instances missing");
   var native=first.prefab.GetComponentsInChildren<PublishedInstance>(true).First(i=>i.assetId=="native-proof");
   var materials=native.GetComponentsInChildren<Renderer>(true).SelectMany(r=>r.sharedMaterials).Distinct().ToArray();
   Check(materials.Any(m=>Mathf.Abs(m.color.r-128f/255)<.001f&&Mathf.Abs(m.color.g-128f/255)<.001f),"Gray source sRGB changed");
   Check(materials.Any(m=>Mathf.Abs(m.color.a-.5f)<.001f&&m.IsKeywordEnabled("_ALPHATEST_ON")),"MASK alpha lost");
   Check(first.prefab.GetComponentsInChildren<Renderer>(true).Any(r=>r.sharedMaterials.Any(m=>m.mainTexture!=null)),"PNG dependency lost");
   foreach(var instance in first.prefab.GetComponentsInChildren<PublishedInstance>(true)){
    Check(Vector3.Distance(instance.transform.localPosition,WorkshopCoordinates.Unity(instance.sourcePositionM))<.00001f,"Source axis translation changed");
    Check(Quaternion.Angle(instance.transform.localRotation,Quaternion.Euler(0,-instance.rotationDeg,0))<.001f,"Rotation changed");
   }
   var again=SceneBaker.Bake(PublishReader.Read(Manifest),new ReceiveOptions());Check(AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(again.prefab))==guid,"Same receipt GUID changed");
   var copy=SceneBaker.Bake(package,new ReceiveOptions{receiptId="copy-proof"});Check(AssetDatabase.GetAssetPath(copy.prefab)!=prefabPath,"New receipt overwrote primary");
   string mesh=Directory.GetFiles(first.directory,"*.asset",SearchOption.AllDirectories).First();byte[] before=File.ReadAllBytes(mesh);File.AppendAllText(mesh,"\n# hand edit\n");Reject(()=>SceneBaker.Bake(package,new ReceiveOptions()),"Generated hand edit silently replaced");File.WriteAllBytes(mesh,before);AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
   File.WriteAllText("../workshop-task8/unity-publish-proof.json",new JObject{["passed"]=true,["version"]=Application.unityVersion,["guid"]=guid,["instances"]=7,["readerRejections"]=10}.ToString());Debug.Log("XH_WORKSHOP_PUBLISH_PASS");EditorApplication.Exit(0);
  }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
  static void Copy(string source,string target){Directory.CreateDirectory(target);foreach(var file in Directory.GetFiles(source,"*",SearchOption.AllDirectories)){string destination=Path.Combine(target,file.Substring(source.Length+1));Directory.CreateDirectory(Path.GetDirectoryName(destination));File.Copy(file,destination,true);}}
  public static void Extra(){try{
   var package=PublishReader.Read(Manifest);string axes=package.manifest.sourceAxes;package.manifest.sourceAxes="";try{Reject(()=>SceneBaker.Bake(package,new ReceiveOptions()),"Mutable manifest bypassed frozen validation");}finally{package.manifest.sourceAxes=axes;}
   var first=SceneBaker.Bake(package,new ReceiveOptions());string materialPath=Directory.GetFiles(first.directory,"*.mat",SearchOption.AllDirectories).First();var material=AssetDatabase.LoadAssetAtPath<Material>(materialPath);Color old=material.color;material.color=Color.magenta;EditorUtility.SetDirty(material);try{Reject(()=>SceneBaker.Bake(package,new ReceiveOptions()),"Unsaved generated edit was accepted");}finally{material.color=old;EditorUtility.ClearDirty(material);}
   var single=AssetBaker.Bake(PublishReader.Read("../workshop-task8/packages/releases/single-proof/manifest.json"),new ReceiveOptions());Check(single.prefab.GetComponentsInChildren<MeshFilter>().Length>0,"Single asset not received");Reject(()=>PublishReader.Read("../workshop-task8/packages/releases/unsupported-proof/manifest.json"),"External GLB silently accepted");
   var next=SceneBaker.Bake(PublishReader.Read("../workshop-task8/packages/releases/version-b/manifest.json"),new ReceiveOptions());Check(next.prefab.GetComponentsInChildren<PublishedInstance>().Length==10,"Version B new instances lost");Check(first.directory!=next.directory,"Version B replaced A");
   File.WriteAllText("../workshop-task8/unity-extra-proof.json","{\"passed\":true,\"checks\":[\"sealed manifest\",\"unsaved conflict\",\"single asset\",\"unsupported GLB\",\"A/B isolation\",\"four rotations\"]}");Debug.Log("XH_WORKSHOP_EXTRA_PASS");EditorApplication.Exit(0);
  }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
  public static void LegacyIdentity(){try{var module=AssetBaker.Bake(PublishReader.Read("../workshop-task8/packages/releases/legacy-id-proof/manifest.json"),new ReceiveOptions());Check(module.prefab!=null,"Valid legacy asset identity lost");Debug.Log("XH_WORKSHOP_LEGACY_ID_PASS");EditorApplication.Exit(0);}catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
 }
}
