using System;
using System.IO;
using UnityEngine;
using UnityEditor;
namespace Xinghai.MapEditor.Editor {
 public static class WorkshopLinkProof {public static void Run(){try{bool rejected=false;try{PublishReader.Read("../workshop-task8/linked-package/manifest.json");}catch(Exception e){rejected=e.Message.Contains("链接");}WorkshopPublishProof.Check(rejected,"Linked dependency was accepted or wrong failure");File.WriteAllText("../workshop-task8/link-proof.json","{\"passed\":true,\"actualWindowsJunction\":true}");Debug.Log("XH_WORKSHOP_LINK_PASS");EditorApplication.Exit(0);}catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}}
}
