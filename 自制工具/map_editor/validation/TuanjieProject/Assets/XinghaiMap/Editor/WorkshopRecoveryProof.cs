using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json;
using UnityEngine;
using UnityEditor;
namespace Xinghai.MapEditor.Editor {
 public static class WorkshopRecoveryProof {
  static string Root="Assets/Generated/Workshop/fbx-proof/primary",Manifest="../workshop-task7/real-project/releases/fbx-proof/manifest.json";
  static Dictionary<string,string> Baseline()=>Directory.GetFiles(Root,"*",SearchOption.AllDirectories).Concat(new[]{"Assets/WorkshopWrapperOriginal.prefab","Assets/WorkshopWrapperOriginal.prefab.meta"}).ToDictionary(p=>p,p=>Convert.ToBase64String(File.ReadAllBytes(p)));
  static void Compare(Dictionary<string,string> before){foreach(var p in before)WorkshopPublishProof.Check(File.Exists(p.Key)&&File.ReadAllBytes(p.Key).SequenceEqual(Convert.FromBase64String(p.Value)),"Previous output/meta/wrapper changed: "+p.Key);}
  public static void Fault(){try{var before=Baseline();bool failed=false;try{SceneBaker.Bake(PublishReader.Read(Manifest),new ReceiveOptions{receiptId="fault-proof"});}catch(Exception e){failed=e.Message.Contains("Shader");}WorkshopPublishProof.Check(failed,"Expected missing shader failure was not reached");Compare(before);string folder="Assets/Generated/Workshop/fbx-proof/fault-proof";WorkshopPublishProof.Check(!Directory.Exists(folder)||Directory.GetFileSystemEntries(folder).Length==0,"Failed receive left derived files or directories");WorkshopPublishProof.Check(!Directory.Exists("Library/XinghaiBakeRecovery")||Directory.GetFiles("Library/XinghaiBakeRecovery","*.json").Length==0,"Failed transaction journal left pending");File.WriteAllText("../workshop-task8/fault-proof.json","{\"passed\":true,\"realMidBakeFailure\":\"missing custom shader\"}");Debug.Log("XH_WORKSHOP_FAULT_PASS");EditorApplication.Exit(0);}catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
  public static void Interrupt(){try{var before=Baseline();File.WriteAllText("../workshop-task8/recovery-before.json",JsonConvert.SerializeObject(before));string file=Directory.GetFiles(Root,"*.asset",SearchOption.AllDirectories).First();var journal=new BakeJournal();journal.Watch(file);journal.Watch(file+".meta");File.AppendAllText(file,"\n# interrupted write\n");File.AppendAllText(file+".meta","\n# interrupted meta\n");string newFile=Root+"/Interrupted.bin";journal.Watch(newFile);File.WriteAllText(newFile,"partial");Debug.Log("XH_WORKSHOP_INTERRUPTED");EditorApplication.Exit(73);}catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
  public static void Verify(){try{BakeJournal.Recover();Compare(JsonConvert.DeserializeObject<Dictionary<string,string>>(File.ReadAllText("../workshop-task8/recovery-before.json")));WorkshopPublishProof.Check(!File.Exists(Root+"/Interrupted.bin")&&!File.Exists(Root+"/Interrupted.bin.meta"),"Interrupted new file left valid");SceneBaker.Bake(PublishReader.Read(Manifest),new ReceiveOptions());File.WriteAllText("../workshop-task8/recovery-proof.json","{\"passed\":true,\"separateEditorProcess\":true,\"preserved\":[\"output bytes\",\"meta\",\"wrapper\"]}");Debug.Log("XH_WORKSHOP_RECOVERY_PASS");EditorApplication.Exit(0);}catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
 }
}
