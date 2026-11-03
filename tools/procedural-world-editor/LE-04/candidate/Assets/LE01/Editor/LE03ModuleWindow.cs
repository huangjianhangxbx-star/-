using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public sealed partial class LE01Window
    {
        [Serializable] sealed class KitEntry {public string key="",label="",assetId="",sourceHash="",voxel="",preview="";}
        [Serializable] sealed class KitManifest {public KitEntry[] modules;}
        const string KitRoot="Assets/LE03/ModuleKit";
        KitManifest moduleKit;
        bool modulePage,moduleGhost;
        int moduleAction,moduleYaw;
        string moduleSourceKey,moduleHoverMessage,lastModuleStatus;
        bool lastModuleBusy;
        GameObject modulePrefab;
        VoxelPlacement modulePreview;
        VoxelModuleAsset modulePreviewAsset;
        SurfaceHit moduleHit;
        bool moduleHitValid;
        bool EditorBusy {get{return stroke.Busy||LE03Modules.Busy(stroke.Author)||LE04TerrainSession.IsBusy(stroke.Author);}}
        KitManifest ModuleKit()
        {
            if(moduleKit==null){var file=AssetDatabase.LoadAssetAtPath<TextAsset>(KitRoot+"/kit-manifest.json");moduleKit=file==null?new KitManifest{modules=new KitEntry[0]}:JsonUtility.FromJson<KitManifest>(file.text);}return moduleKit;
        }
        Texture2D ModuleThumbnail(VoxelModuleAsset asset)
        {
            var entry=ModuleKit().modules.FirstOrDefault(e=>e.assetId==asset.assetId&&e.sourceHash==asset.sourceHash);
            return entry==null?null:AssetDatabase.LoadAssetAtPath<Texture2D>(KitRoot+"/"+entry.preview.Replace('\\','/'));
        }
        void SelectModule(VoxelModuleAsset asset)
        {
            if(!LE03Modules.Import(stroke.Author,asset)){moduleHoverMessage=LE03Modules.Status(stroke.Author);return;}
            moduleSourceKey=VoxelModules.AssetKey(asset);moduleGhost=false;moduleHitValid=false;moduleHoverMessage=null;SceneView.RepaintAll();Repaint();
        }
        void DrawModulePanel()
        {
            if(Current.GeneratorVersion!="le01.3"){EditorGUILayout.HelpBox("完整模型画笔用于可塑形版本。先在上方另存可塑形候选，原作品保持。",MessageType.Info);return;}
            var layer=LE03Modules.Layer(stroke.Author);
            EditorGUILayout.HelpBox("每笔放置一个完整母件。R旋转90°；模型原色与来源随场景一起保存。模型面使用删除／替换，基础岩壁仍在岩壁页编辑。",MessageType.None);
            using(new EditorGUI.DisabledScope(EditorBusy))
            {
                moduleAction=GUILayout.Toolbar(moduleAction,new[]{"放置完整件","替换选中件","删除选中件"});
                if(GUILayout.Button("定位完整场景"))FrameTerrain();
                int yaw=EditorGUILayout.Popup("旋转",moduleYaw,new[]{"0°","90°","180°","270°"});if(yaw!=moduleYaw){moduleYaw=yaw;moduleGhost=false;SceneView.RepaintAll();}
                using(new EditorGUI.DisabledScope(layer.assets.Count>0||layer.placements.Count>0))
                {float unit=EditorGUILayout.FloatField("模型格度 (m)",layer.voxelSize);if(Math.Abs(unit-layer.voxelSize)>.00001f)LE03Modules.SetUnit(stroke.Author,unit);}
                if(GUILayout.Button("导入 .voxel.json 完整素材…"))
                {
                    string path=EditorUtility.OpenFilePanel("导入同格度体素素材",Path.Combine(LE01CStart.CurrentRoot,"kit"),"json");
                    if(!string.IsNullOrEmpty(path))try{SelectModule(JsonUtility.FromJson<VoxelModuleAsset>(File.ReadAllText(path)));}catch(Exception error){moduleHoverMessage=error.Message;}
                }
                modulePrefab=(GameObject)EditorGUILayout.ObjectField("外部 Prefab / 模型",modulePrefab,typeof(GameObject),false);
                using(new EditorGUI.DisabledScope(modulePrefab==null))if(GUILayout.Button("一次性认证导入所选模型"))
                {
                    try{SelectModule(LE03MeshVoxelImport.Import(modulePrefab,layer.voxelSize,"external."+modulePrefab.name.Substring(0,Math.Min(120,modulePrefab.name.Length))));}catch(Exception error){moduleHoverMessage="导入未改变旧素材："+error.Message;}
                }
                GUILayout.Space(5);GUILayout.Label("内置完整母件",EditorStyles.boldLabel);
                foreach(var entry in ModuleKit().modules)
                {
                    using(new EditorGUILayout.HorizontalScope())
                    {
                        var texture=AssetDatabase.LoadAssetAtPath<Texture2D>(KitRoot+"/"+entry.preview.Replace('\\','/'));
                        if(texture!=null)GUILayout.Label(texture,GUILayout.Width(112),GUILayout.Height(84));
                        using(new EditorGUILayout.VerticalScope())
                        {
                            GUILayout.Label(entry.label,EditorStyles.boldLabel);GUILayout.Label(entry.assetId,EditorStyles.miniLabel);
                            if(GUILayout.Button("选用此母件"))try{var source=AssetDatabase.LoadAssetAtPath<TextAsset>(KitRoot+"/"+entry.voxel.Replace('\\','/'));if(source==null)throw new FileNotFoundException("完整母件数据未随工程导入");SelectModule(JsonUtility.FromJson<VoxelModuleAsset>(source.text));}catch(Exception error){moduleHoverMessage=error.Message;}
                        }
                    }
                }
                GUILayout.Space(5);GUILayout.Label("本场景素材库",EditorStyles.boldLabel);
                foreach(var asset in layer.assets)
                {
                    bool selected=moduleSourceKey==VoxelModules.AssetKey(asset);
                    if(GUILayout.Toggle(selected,asset.assetId+" · v"+asset.assetVersion+" · "+asset.sourceHash.Substring(0,8),"Button")&&!selected){moduleSourceKey=VoxelModules.AssetKey(asset);moduleGhost=false;}
                }
            }
            var selectedAsset=layer.assets.FirstOrDefault(a=>VoxelModules.AssetKey(a)==moduleSourceKey);
            if(selectedAsset!=null){var image=ModuleThumbnail(selectedAsset);if(image!=null)GUILayout.Label(image,GUILayout.Height(140));EditorGUILayout.LabelField("完整尺寸",(selectedAsset.size[0]*layer.voxelSize).ToString("0.##")+" × "+(selectedAsset.size[1]*layer.voxelSize).ToString("0.##")+" × "+(selectedAsset.size[2]*layer.voxelSize).ToString("0.##")+" m");}
            EditorGUILayout.LabelField("已放置完整件",layer.placements.Count.ToString());
            foreach(var placement in layer.placements.Take(12))using(new EditorGUILayout.HorizontalScope())
            {
                GUILayout.Label(placement.assetId+" · "+(placement.yaw*90)+"°",EditorStyles.miniLabel);
                using(new EditorGUI.DisabledScope(EditorBusy))if(GUILayout.Button("删除",GUILayout.Width(48)))LE03Modules.Remove(stroke.Author,placement.id);
            }
            EditorGUILayout.HelpBox(moduleHoverMessage??LE03Modules.Status(stroke.Author),MessageType.None);
            using(new EditorGUI.DisabledScope(!LE03Modules.Busy(stroke.Author)||LE03Modules.RestoringHistory(stroke.Author)))if(GUILayout.Button("取消当前模型笔触")){LE03Modules.Cancel(stroke.Author);GUIUtility.hotControl=0;}
        }
        static Vector3 RotatedPivot(VoxelModuleAsset asset,int yaw)
        {
            float x=asset.pivot[0],y=asset.pivot[1],z=asset.pivot[2];
            switch(yaw&3){case 1:return new Vector3(z,y,asset.size[0]-x);case 2:return new Vector3(asset.size[0]-x,y,asset.size[2]-z);case 3:return new Vector3(asset.size[2]-z,y,x);default:return new Vector3(x,y,z);}
        }
        static Vector3 ModuleSize(VoxelModuleAsset asset,int yaw,float unit){return new Vector3((yaw&1)==0?asset.size[0]:asset.size[2],asset.size[1],(yaw&1)==0?asset.size[2]:asset.size[0])*unit;}
        void UpdateModulePreview()
        {
            moduleGhost=false;modulePreview=null;modulePreviewAsset=null;if(!moduleHitValid)return;var layer=LE03Modules.Layer(stroke.Author);var source=layer.assets.FirstOrDefault(a=>VoxelModules.AssetKey(a)==moduleSourceKey);
            string key=moduleHit.BoundaryKey;var existing=!string.IsNullOrEmpty(key)&&key.StartsWith("module:",StringComparison.Ordinal)?layer.placements.FirstOrDefault(p=>p.id==key.Substring(7)):null;
            if(moduleAction==2)
            {
                if(existing==null){moduleHoverMessage="请指向一个完整模型，基础地形不会被删除";return;}modulePreview=existing.Copy();modulePreviewAsset=layer.assets.First(a=>VoxelModules.AssetKey(a)==VoxelModules.AssetKey(existing));moduleGhost=true;return;
            }
            if(source==null){moduleHoverMessage="先选择一个完整母件";return;}
            Vector3 anchor=new Vector3(moduleHit.X,moduleHit.Y,moduleHit.Z)/layer.voxelSize;
            if(moduleAction==1)
            {
                if(existing==null){moduleHoverMessage="请指向要替换的完整模型";return;}var old=layer.assets.First(a=>VoxelModules.AssetKey(a)==VoxelModules.AssetKey(existing));anchor=new Vector3(existing.x,existing.y,existing.z)+RotatedPivot(old,existing.yaw);
            }
            Vector3 origin=anchor-RotatedPivot(source,moduleYaw);modulePreview=new VoxelPlacement{id=existing!=null&&moduleAction==1?existing.id:"ghost",assetId=source.assetId,assetVersion=source.assetVersion,sourceHash=source.sourceHash,x=Mathf.RoundToInt(origin.x),y=Mathf.RoundToInt(origin.y),z=Mathf.RoundToInt(origin.z),yaw=moduleYaw};modulePreviewAsset=source;moduleGhost=true;moduleHoverMessage=null;
        }
        void DrawModuleGhost()
        {
            if(!moduleGhost||modulePreview==null||modulePreviewAsset==null||Event.current.type!=EventType.Repaint)return;
            var oldMatrix=Handles.matrix;var oldDepth=Handles.zTest;var oldColor=Handles.color;
            try{Handles.matrix=stroke.Author.transform.localToWorldMatrix;Handles.zTest=CompareFunction.LessEqual;Handles.color=moduleAction==2?new Color(1,.4f,.3f,.9f):new Color(.4f,.95f,.85f,.9f);float unit=LE03Modules.Layer(stroke.Author).voxelSize;var size=ModuleSize(modulePreviewAsset,modulePreview.yaw,unit);Handles.DrawWireCube(new Vector3(modulePreview.x,modulePreview.y,modulePreview.z)*unit+size*.5f,size);}
            finally{Handles.matrix=oldMatrix;Handles.zTest=oldDepth;Handles.color=oldColor;}
        }
        void DrawModuleSceneHint()
        {
            Handles.BeginGUI();try{GUI.Box(new Rect(10,10,385,73),GUIContent.none,EditorStyles.helpBox);GUI.Label(new Rect(17,14,371,18),"星骸 · 完整模型画笔",EditorStyles.boldLabel);GUI.Label(new Rect(17,33,371,28),moduleHoverMessage??LE03Modules.Status(stroke.Author),EditorStyles.wordWrappedMiniLabel);GUI.Label(new Rect(17,63,371,16),"左键放置／替换／删除 · R旋转 · Esc取消 · 中／右键导航",EditorStyles.miniLabel);}finally{Handles.EndGUI();}
        }
        void OnModuleScene(SceneView view)
        {
            if(stroke.Author==null)return;DrawModuleSceneHint();var e=Event.current;if(!enabledTool||LE03Modules.RestoringHistory(stroke.Author))return;
            control=GUIUtility.GetControlID("LE03ModuleBrush".GetHashCode(),FocusType.Passive);
            if(e.type==EventType.KeyDown&&e.keyCode==KeyCode.Escape){LE03Modules.Cancel(stroke.Author);GUIUtility.hotControl=0;moduleGhost=false;e.Use();return;}
            if(e.alt||EditorGUIUtility.editingTextField||e.type==EventType.MouseDown&&e.button!=0){if(LE03Modules.Busy(stroke.Author)&&!LE03Modules.ReleasePending(stroke.Author)){LE03Modules.Cancel(stroke.Author);GUIUtility.hotControl=0;}moduleGhost=false;return;}
            if(e.type==EventType.KeyDown&&e.keyCode==KeyCode.R&&!EditorBusy){moduleYaw=(moduleYaw+1)&3;UpdateModulePreview();e.Use();Repaint();view.Repaint();}
            if(e.type==EventType.Layout)HandleUtility.AddDefaultControl(control);
            if(e.type==EventType.MouseUp&&e.button==0&&LE03Modules.Busy(stroke.Author)&&!LE03Modules.ReleasePending(stroke.Author)){LE03Modules.RequestEnd(stroke.Author);GUIUtility.hotControl=0;e.Use();view.Repaint();return;}
            if(LE03Modules.Busy(stroke.Author)){DrawModuleGhost();return;}
            if(stroke.Busy||Current.GeneratorVersion!="le01.3")return;
            bool input=e.type==EventType.MouseMove||e.type==EventType.MouseDown;
            if(input)
            {
                bool onPlane=false;var ray=HandleUtility.GUIPointToWorldRay(e.mousePosition);moduleHitValid=surfaceHover.Resolve(stroke.Author,ray,false,e.type==EventType.MouseDown);
                if(moduleHitValid)moduleHit=surfaceHover.Hit;
                else if(moduleAction==0&&!surfaceHover.Blocked){Vector3 point;if(stroke.IntersectLockedPlane(ray,out point)){moduleHitValid=true;onPlane=true;moduleHit=new SurfaceHit{X=point.x,Y=point.y,Z=point.z,NormalY=1};}}
                UpdateModulePreview();
                if(onPlane&&moduleGhost)moduleHoverMessage="空地模型工作平面 H "+stroke.PlaneHeight*TerrainUnits.Unit+" m";
            }
            DrawModuleGhost();
            if(e.type==EventType.MouseDown&&e.button==0&&moduleGhost)
            {
                bool began;if(moduleAction==2)began=LE03Modules.BeginRemove(stroke.Author,modulePreview.id);else{var placement=modulePreview.Copy();if(moduleAction==0)placement.id=Guid.NewGuid().ToString("N");began=LE03Modules.BeginPlace(stroke.Author,placement);}
                if(began){GUIUtility.hotControl=control;e.Use();view.Repaint();Repaint();}
            }
            if(input)view.Repaint();
        }
    }
}
