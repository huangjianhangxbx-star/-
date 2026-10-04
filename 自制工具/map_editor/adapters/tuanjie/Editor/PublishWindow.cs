using System;
using UnityEngine;
using UnityEditor;
namespace Xinghai.MapEditor.Editor {
 public sealed class PublishWindow:EditorWindow {
  string manifestPath="",receiptId="primary",status="选择工坊发布包的 manifest.json。";PublishPackage package;PublishedScene candidate;Vector2 scroll;GameObject wrapper;
  [MenuItem("Tools/Xinghai/接收工坊发布包")]public static void Open(){GetWindow<PublishWindow>("工坊接收");}
  public void Load(string path){var validated=PublishReader.Read(path);package=validated;manifestPath=System.IO.Path.GetFullPath(path);status="已验证冻结闭包："+package.manifest.publishId;candidate=null;}
  public PublishedModule Receive(string receipt){PublishReader.Require(package!=null,"先选择并验证发布包");var result=package.manifest.kind=="scene"?(PublishedModule)SceneBaker.Bake(package,new ReceiveOptions{receiptId=receipt}):AssetBaker.Bake(package,new ReceiveOptions{receiptId=receipt});candidate=result as PublishedScene;Selection.activeObject=result.prefab;EditorGUIUtility.PingObject(result.prefab);status="接收完成："+result.directory;return result;}
  void Action(Action run){try{run();}catch(Exception e){status=e.Message;Debug.LogWarning("工坊接收："+e.Message);}Repaint();}
  void OnGUI(){scroll=EditorGUILayout.BeginScrollView(scroll);EditorGUILayout.LabelField("接收冻结发布",EditorStyles.boldLabel);EditorGUILayout.HelpBox("源文件保存不会更新已接收版本。Generated 内部手改将阻止重收；请选择新接收副本。外部模型需要 glb-fbx 配方。本版使用 Built-in 材质。",MessageType.Info);
   EditorGUILayout.SelectableLabel(manifestPath,EditorStyles.textField,GUILayout.Height(36));if(GUILayout.Button("选择 manifest.json 并验证")){string file=EditorUtility.OpenFilePanel("选择工坊发布包",System.IO.Path.GetDirectoryName(manifestPath)??"","json");if(file.Length>0)Action(()=>Load(file));}
   receiptId=EditorGUILayout.TextField("接收身份",receiptId);if(GUILayout.Button("新接收副本身份"))receiptId=Guid.NewGuid().ToString("N");
   if(package!=null){EditorGUILayout.LabelField(package.manifest.publishId+" · "+package.manifest.kind+" · r"+package.manifest.sourceRevision);EditorGUILayout.LabelField("冻结依赖",package.manifest.dependencies.Length.ToString());using(new EditorGUI.DisabledScope(false))if(GUILayout.Button("接收 / 核对同版生成物"))Action(()=>Receive(receiptId));}
   EditorGUILayout.Space();EditorGUILayout.LabelField("升级用户包装副本",EditorStyles.boldLabel);wrapper=(GameObject)EditorGUILayout.ObjectField("原包装",wrapper,typeof(GameObject),true);using(new EditorGUI.DisabledScope(wrapper==null||candidate==null)){if(GUILayout.Button("预检包装升级"))Action(()=>{var report=WrapperUpgrade.Preview(wrapper,candidate);status=report.canUpgrade?"预检通过，可生成新包装副本。":string.Join("\n",report.conflicts);});if(GUILayout.Button("生成新包装副本"))Action(()=>{var report=WrapperUpgrade.Preview(wrapper,candidate);PublishReader.Require(report.canUpgrade,string.Join("\n",report.conflicts));string file=EditorUtility.SaveFilePanelInProject("保存新包装副本",wrapper.name+"-升级","prefab","原包装保持不变，选择尚不存在的新路径。");if(file.Length>0){var copy=WrapperUpgrade.CreateCopy(wrapper,candidate,file);Selection.activeObject=copy;status="已生成包装副本："+file;}});}
   EditorGUILayout.HelpBox(status,MessageType.None);EditorGUILayout.EndScrollView();
  }
 }
}
