using System;
using UnityEngine;
using UnityEditor;
namespace Xinghai.MapEditor.Editor {
 public static class WorkshopWindowProof {
  public static void Run(){PublishWindow window=null;try{window=EditorWindow.GetWindow<PublishWindow>();window.Load("../workshop-task8/packages/releases/single-proof/manifest.json");var single=window.Receive("window-proof");WorkshopPublishProof.Check(single.prefab!=null&&single.directory.EndsWith("single-proof/window-proof"),"Window single receive route wrong");window.Load("../workshop-task7/real-project/releases/fbx-proof/manifest.json");var scene=window.Receive("window-proof");WorkshopPublishProof.Check(scene is PublishedScene&&scene.prefab.GetComponentsInChildren<PublishedInstance>().Length==7,"Window scene receive route wrong");Debug.Log("XH_WORKSHOP_WINDOW_PASS");EditorApplication.Exit(0);}catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}finally{if(window!=null)window.Close();}}
 }
}
