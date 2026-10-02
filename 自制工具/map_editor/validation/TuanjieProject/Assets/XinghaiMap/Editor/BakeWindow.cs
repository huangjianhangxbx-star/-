using System;
using System.IO;
using UnityEditor;
using UnityEngine;
namespace Xinghai.MapEditor.Editor {
 public class BakeWindow:EditorWindow {
  string source="",output="",message="选择桌面导出的JSON地图源。生成内容与人工组合场景分开保存。";MapRegistry registry;MapDocument doc;
  [MenuItem("星骸地图/烘焙地图")]
  public static void Open(){GetWindow<BakeWindow>("星骸地图烘焙");}
  internal Rect bakeButtonRect;
  internal void ChooseSource(string file){source=file;doc=SourceReader.Parse(File.ReadAllText(source));output="Assets/Generated/"+doc.mapId;message="已校验 "+doc.cells.Length+" 个体素";}
  void OnGUI(){
   GUILayout.Label("地图源 → 团结模块",EditorStyles.boldLabel);
   if(GUILayout.Button("选择地图源 JSON")){var file=EditorUtility.OpenFilePanel("地图源","","json");if(!string.IsNullOrEmpty(file))try{ChooseSource(file);}catch(Exception e){doc=null;message=e.Message;}}
   EditorGUILayout.SelectableLabel(source,GUILayout.Height(35));registry=(MapRegistry)EditorGUILayout.ObjectField("资产映射表",registry,typeof(MapRegistry),false);
   if(registry==null&&GUILayout.Button("创建/选择项目映射表")){registry=AssetDatabase.LoadAssetAtPath<MapRegistry>("Assets/MapRegistry.asset");if(registry==null){registry=CreateInstance<MapRegistry>();AssetDatabase.CreateAsset(registry,"Assets/MapRegistry.asset");}Selection.activeObject=registry;}
   if(doc!=null){EditorGUILayout.LabelField("输出",output);EditorGUILayout.LabelField("实例 / 贴花",doc.instances.Length+" / "+doc.decals.Length);foreach(var p in doc.instances)EditorGUILayout.SelectableLabel((p.kind=="event"?p.registryKey+" (事件)":p.assetId),GUILayout.Height(17));foreach(var p in doc.decals)EditorGUILayout.SelectableLabel(p.assetId+" (PNG)",GUILayout.Height(17));}
   using(new EditorGUI.DisabledScope(doc==null)){if(GUILayout.Button("校验并烘焙 / 更新模块",GUILayout.Height(34)))try{doc=SourceReader.Parse(File.ReadAllText(source));var prefab=MapBaker.Bake(doc,output,registry);Selection.activeObject=prefab;EditorGUIUtility.PingObject(prefab);message=(MapBaker.LastStatus=="unchanged"?"源与依赖无变化。":"已更新模块。")+"拖入场景可多次放置；将人工内容保存在模块外层。";}catch(Exception e){message="失败："+e.Message;Debug.LogException(e);}}
   if(Event.current.type==EventType.Repaint)bakeButtonRect=GUILayoutUtility.GetLastRect();
   EditorGUILayout.HelpBox(message,MessageType.Info);
  }
 }
}
