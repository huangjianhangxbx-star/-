using UnityEditor;
using UnityEditor.PackageManager;
namespace Xinghai.MapEditor.Editor {
 public static class DependencySetup {
  public static void Run(){var request=Client.Add("com.unity.nuget.newtonsoft-json@3.2.1");EditorApplication.CallbackFunction poll=null;poll=()=>{if(!request.IsCompleted)return;EditorApplication.update-=poll;if(request.Status==StatusCode.Success){UnityEngine.Debug.Log("XH_JSON_PACKAGE_READY");EditorApplication.Exit(0);}else{UnityEngine.Debug.LogError(request.Error.message);EditorApplication.Exit(1);}};EditorApplication.update+=poll;}
 }
}
