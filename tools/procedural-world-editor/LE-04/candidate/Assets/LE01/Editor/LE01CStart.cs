using System.IO;
using UnityEditor;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public sealed class LE01CStart : EditorWindow
    {
        Vector2 startScroll;
        bool legacySamples;
        public const string TerraceScene="Assets/LE01C/Scenes/SteppedTerrace_719.unity";
        public static string Root {get{return Path.Combine(Directory.GetParent(LE01Export.TaskRoot).FullName,"LE-01C");}}
        public static string LatestRoot {get{return Path.Combine(Directory.GetParent(LE01Export.TaskRoot).FullName,"LE-02");}}
        public static string CurrentRoot {get{return Path.Combine(Directory.GetParent(LE01Export.TaskRoot).FullName,"LE-03");}}
        public const string CapabilitiesScene="Assets/LE02/Scenes/BrushCapabilities_719.unity";
        public const string StructureScene="Assets/LE03/Scenes/StructurePlayground_719.unity";
        public const string ModuleScene="Assets/LE03/Scenes/ModuleStructurePlayground_719.unity";
        [MenuItem("星骸/地编/开始 %#g")]
        public static void Open(){var w=GetWindow<LE01CStart>("星骸地编 · 开始");w.minSize=new Vector2(400,420);}
        [MenuItem("星骸/地编/打开阶梯岩台")]
        public static void OpenTerrace(){LE01Window.OpenTerrace();}
        [MenuItem("星骸/地编/打开塑形与坡地样例")]
        public static void OpenCapabilities(){LE01Window.OpenCapabilities();}
        [MenuItem("星骸/地编/新建空地形")]
        public static void New(){LE01Window.Open();LE01Window.Instance.NewTerrain();}
        [MenuItem("星骸/地编/打开造型与局部画笔")]
        public static void OpenStructure(){LE01Window.OpenStructureWorkspace();}
        [MenuItem("星骸/地编/打开完整模型混合样例")]
        public static void OpenModules(){LE01Window.OpenModuleWorkspace();}
        void OnGUI()
        {
            startScroll=EditorGUILayout.BeginScrollView(startScroll);
            GUILayout.Space(14);GUILayout.Label("星骸 · 程序化地编",EditorStyles.largeLabel);
            EditorGUILayout.HelpBox("在 Unity／团结的 Scene 视图操作，无需点击 Play。\n从空地形绘制，或打开可继续编辑的样例。",MessageType.Info);
            GUILayout.Space(8);
            if(GUILayout.Button("新建基础地貌 v2",GUILayout.Height(34))){LE01Window.NewBasic();if(LE01Window.Instance!=null&&LE04TerrainSession.Has(LE01Window.Instance.Controller.Author))Close();}
            if(GUILayout.Button("打开基础地貌 v2 可操作样例",GUILayout.Height(34))){if(LE01Window.OpenBasicSample())Close();}
            legacySamples=EditorGUILayout.Foldout(legacySamples,"旧版样例 · 保留原研究",true);
            if(legacySamples){if(GUILayout.Button("新建旧版空地形")){LE01Window.Open();if(LE01Window.Instance.NewTerrain())Close();}if(GUILayout.Button("旧造型与局部画笔")){if(LE01Window.OpenStructureWorkspace())Close();}if(GUILayout.Button("旧完整模型点放样例")){if(LE01Window.OpenModuleWorkspace())Close();}if(GUILayout.Button("塑形与坡地 · LE02")){if(LE01Window.OpenCapabilities())Close();}if(GUILayout.Button("阶梯岩台 · 绘制与抬压")){if(LE01Window.OpenTerrace())Close();}if(GUILayout.Button("高崖 · 岩壁凹凸与密度")){if(LE01Window.OpenTallWorkspace())Close();}}
            using(new EditorGUI.DisabledScope(FindObjectOfType<LE01TerrainAuthor>()==null))if(GUILayout.Button("继续当前场景的地形",GUILayout.Height(30))){LE01Window.Open();if(LE01Window.Instance.PrepareWorkspace(false))Close();}
            GUILayout.Space(12);GUILayout.Label("最短操作流程",EditorStyles.boldLabel);
            GUILayout.Label("1  连续拖画：左键按住绘制，松手提交一笔。\n2  锚点精修：点中表面，调各向范围与高度带，再应用。\n3  绘色：表面拖涂或锚点区域填色，Shift点击取色。\n4  形色参考：导入认证源，调尺寸后连续绘制融合。\n5  Esc取消；Undo／Redo撤销重做。\n6  保存基础地貌 v2；Scene与FBX保留颜色。",EditorStyles.wordWrappedLabel);
            GUILayout.Space(8);GUILayout.Label("Alt 与中／右键保留视角导航。\n切换 Unity 工具后，在地形窗口点击“恢复地形画笔”。",EditorStyles.wordWrappedMiniLabel);
            EditorGUILayout.EndScrollView();
        }
    }
    public sealed partial class LE01Window
    {
        public static bool OpenTerrace(){return OpenScene(LE01CStart.TerraceScene);}
        public static bool OpenCapabilities(){return OpenScene(LE01CStart.CapabilitiesScene);}
        public static bool OpenStructureWorkspace(){return OpenScene(LE01CStart.StructureScene);}
        public static bool OpenModuleWorkspace(){if(!OpenScene(LE01CStart.ModuleScene))return false;Instance.modulePage=true;Instance.sculptPage=false;var layer=LE03Modules.Layer(Instance.stroke.Author);if(layer.assets.Count>0)Instance.moduleSourceKey=VoxelModules.AssetKey(layer.assets[0]);Instance.Repaint();return true;}
        static string ToolName(BrushMode mode)
        {
            switch(mode){case BrushMode.Extend:return "延展";case BrushMode.Raise:return "硬抬升";case BrushMode.Lower:return "硬下压";case BrushMode.SmoothRaise:return "柔和隆起";case BrushMode.SmoothLower:return "柔和压低";case BrushMode.SculptShape:return "岩壁内收／外鼓";case BrushMode.Erase:return "擦除";case BrushMode.Reshape:return "局部重塑";case BrushMode.Convert:return "局部格度转换";case BrushMode.SculptDepth:return "切削／回填";case BrushMode.SculptDensity:return "岩壁密度";case BrushMode.LockShape:return "保形";case BrushMode.UnlockShape:return "解锁";case BrushMode.RestoreShape:return "恢复";default:return "恢复失配";}
        }
        void DrawSceneHint()
        {
            string hint;
            if(!enabledTool)hint="画笔已暂停 · 在地形窗口点击“恢复地形画笔”";
            else if(stroke.PendingConfirmation)hint="当前为未提交候选 · 在窗口应用，或 Esc 取消";
            else if(continuePick)hint="点击一个台面，将绘制平面切到该高度";
            else if(stroke.ReleasePending)hint="正在后台完成最新笔触 · Esc 可取消";
            else if(stroke.Mode==BrushMode.SculptShape||stroke.Mode==BrushMode.SculptDepth||stroke.Mode==BrushMode.SculptDensity)hint="侧壁按下锁定范围 · 左右拖动调强度 · 松手提交";
            else if(LE01Stroke.IsSculptMode(stroke.Mode))hint="侧壁按下选定范围 · 松手应用“"+ToolName(stroke.Mode)+"”";
            else if(LE01Stroke.IsHeightMode(stroke.Mode))hint="台面按下锁定范围 · 上下拖动调高差 · 松手后台提交";
            else if(stroke.Mode==BrushMode.Convert)hint="点击选择转换范围 · 在窗口确认候选";
            else hint="左键按住绘制 · 松手提交 · Esc 取消";
            Handles.BeginGUI();
            try {
                GUI.Box(new Rect(10,10,385,73),GUIContent.none,EditorStyles.helpBox);
                GUI.Label(new Rect(17,14,371,18),"星骸 · "+ToolName(stroke.Mode)+(stroke.Active?" · 未提交":""),EditorStyles.boldLabel);
                GUI.Label(new Rect(17,33,371,28),hint,EditorStyles.wordWrappedMiniLabel);
                GUI.Label(new Rect(17,63,371,16),"Alt／中键／右键：视角导航",EditorStyles.miniLabel);
            } finally { Handles.EndGUI(); }
        }
    }
}
