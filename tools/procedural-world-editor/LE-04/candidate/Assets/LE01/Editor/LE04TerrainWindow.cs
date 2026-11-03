using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public sealed partial class LE01Window
    {
        GameObject le04ImportModel;float le04ImportUnit=.25f;
        public LE04TerrainSession BasicSession {get{return LE04TerrainSession.Get(stroke.Author);}}
        [MenuItem("星骸/地编/基础地貌 v2")]
        public static void OpenBasic(){Open();}
        [MenuItem("星骸/地编/打开基础地貌 v2 样例")]
        public static bool OpenBasicSample(){return OpenScene("Assets/LE04/Scenes/LE04_Workflow.unity");}
        [MenuItem("星骸/地编/新建基础地貌 v2")]
        public static void NewBasic(){Open();var window=GetWindow<LE01Window>("星骸地形画笔");Instance=window;if(window.NewTerrain())window.EnableBasic();}
        public bool EnableBasic()
        {
            if(stroke.Author==null||EditorBusy)return false;CancelInput();
            if(LE03Modules.HasLayer(stroke.Author)){stroke.Status="旧混合场景保持原样；请新建基础地貌，或显式创建只含基础作者的副本。";return false;}
            if(!LE04TerrainSession.Has(stroke.Author)){var component=Undo.AddComponent<LE04TerrainState>(stroke.Author.gameObject);component.Write(new TerrainEditState());}
            enabledTool=true;lastUnityTool=Tools.current;modulePage=sculptPage=false;LE04TerrainSession.Get(stroke.Author);Repaint();return true;
        }
        void DrawBasicOffer()
        {
            EditorGUILayout.Space();using(new EditorGUI.DisabledScope(EditorBusy))if(GUILayout.Button("采用基础地貌 v2（局部体积／绘色／形色参考）"))EnableBasic();
        }
        void DrawBasicPanel()
        {
            var session=BasicSession;var s=session.Settings;
            EditorGUILayout.LabelField("基础地貌 v2",EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("点击实际表面编辑；形色参考是连续体积生成。具体建筑、桥梁与雪岩设计属于独立搭建工具。",MessageType.None);
            enabledTool=EditorGUILayout.ToggleLeft("启用场景画笔",enabledTool);if(!enabledTool&&session.Active)session.Cancel();
            if(GUILayout.Button("定位地形视角"))FrameTerrain();
            if(!session.Ready){EditorGUILayout.HelpBox(session.Status,MessageType.Info);return;}
            using(new EditorGUI.DisabledScope(session.Released))
            {
                EditorGUI.BeginChangeCheck();
                int oldTool=s.Tool=="paint"?1:s.Tool=="reference"?2:0;int tool=GUILayout.Toolbar(oldTool,new[]{"局部形体","绘色","形色参考"});
                if(tool!=oldTool){session.Cancel();s.Tool=new[]{"shape","paint","reference"}[tool];}
                bool anchor=GUILayout.Toolbar(s.AnchorMode?1:0,new[]{"连续拖画","锚点精修"})==1;if(anchor!=s.AnchorMode){session.Cancel();s.AnchorMode=anchor;}
                s.Radius=EditorGUILayout.Slider("笔刷半径 (m)",s.Radius,.0625f,6);
                s.Quantum=new[]{4,2,1}[EditorGUILayout.Popup("目标格度",s.Quantum==4?0:s.Quantum==2?1:2,new[]{"0.25 m","0.125 m","0.0625 m"})];
                if(s.Tool=="shape")
                {
                    string[] modes={"Extend","Raise","Lower","SmoothRaise","SmoothLower","Thicken","Thin","Erase"};string[] names={"延展","抬升","下压","柔和隆起","柔和压低","侧面加粗","侧面瘦身","移除"};int mode=Math.Max(0,Array.IndexOf(modes,s.Mode));int next=EditorGUILayout.Popup("操作",mode,names);s.Mode=modes[next];
                    s.Amount=EditorGUILayout.Slider("变化量 (m)",s.Amount,.0625f,2);s.Falloff=EditorGUILayout.Slider("过渡衰减",s.Falloff,0,1);
                    s.WorkPlane=EditorGUILayout.FloatField("空地延展平面 (m)",s.WorkPlane);
                }
                else if(s.Tool=="paint")
                {
                    s.Paint=EditorGUILayout.ColorField("画笔颜色",s.Paint);s.Paint.a=1;
                    int face=s.FaceMask==(int)TerrainFaceMask.PositiveY?1:s.FaceMask==(int)TerrainFaceMask.Sides?2:0;s.FaceMask=new[]{63,8,51}[EditorGUILayout.Popup("绘色面向",face,new[]{"所选朝向","仅顶面","仅侧面"})];
                    s.VisibleOnly=EditorGUILayout.Toggle("仅命中面与同向区域",s.VisibleOnly);
                    EditorGUILayout.HelpBox("连续拖画涂色；锚点模式扩大范围后，一次应用区域填色。按住 Shift 点击表面取色。",MessageType.None);
                    DrawBasicPalette(session);
                }
                else DrawBasicReference(session);
                s.YBelow=EditorGUILayout.Slider("向下高度带 (m)",s.YBelow,.0625f,12);s.YAbove=EditorGUILayout.Slider("向上高度带 (m)",s.YAbove,.0625f,12);
                if(s.AnchorMode)
                {
                    EditorGUILayout.LabelField(session.Active?"锚点已固定":"先在 Scene 可见表面单击一个锚点",EditorStyles.boldLabel);
                    s.NegativeX=EditorGUILayout.Slider("X 负向 (m)",s.NegativeX,.0625f,8);s.PositiveX=EditorGUILayout.Slider("X 正向 (m)",s.PositiveX,.0625f,8);
                    s.NegativeZ=EditorGUILayout.Slider("Z 负向 (m)",s.NegativeZ,.0625f,8);s.PositiveZ=EditorGUILayout.Slider("Z 正向 (m)",s.PositiveZ,.0625f,8);
                    if(GUILayout.Button("范围恢复为笔刷半径"))s.NegativeX=s.PositiveX=s.NegativeZ=s.PositiveZ=s.Radius;
                }
                if(EditorGUI.EndChangeCheck()&&session.Active)session.RequestPreview();
            }
            if(session.Active)
            {
                using(new EditorGUILayout.HorizontalScope()){if(GUILayout.Button(s.Tool=="paint"?"应用绘色":"应用候选"))session.Apply();if(GUILayout.Button("取消"))session.Cancel();}
            }
            EditorGUILayout.HelpBox(session.Status,session.Preview!=null&&session.Preview.Rejected?MessageType.Warning:MessageType.None);
            EditorGUILayout.LabelField("覆盖列／色板／版本",session.Current.State.OwnedColumns.Count+" / "+session.Current.State.Palette.Count+" / "+session.Current.State.Revision,EditorStyles.miniLabel);
            EditorGUILayout.LabelField("后台／本帧主线程 (ms)",session.LastWorkerMilliseconds.ToString("0.0")+" / "+session.LastTickMilliseconds.ToString("0.0"),EditorStyles.miniLabel);
            EditorGUILayout.HelpBox("连续模式松手为一条撤销；锚点模式需应用。Esc取消未完成候选。已松手后右键／中键导航保留操作。",MessageType.Info);
        }
        void DrawBasicPalette(LE04TerrainSession session)
        {
            var palette=session.Current.State.Palette;for(int row=0;row<palette.Count;row+=12)using(new EditorGUILayout.HorizontalScope())for(int i=row;i<Math.Min(palette.Count,row+12);i++){var c=palette[i].rgba;var previous=GUI.backgroundColor;GUI.backgroundColor=new Color(c[0],c[1],c[2],1);if(GUILayout.Button(new GUIContent(" ","色槽 "+i),GUILayout.Width(23)))session.Settings.Paint=GUI.backgroundColor;GUI.backgroundColor=previous;}
        }
        void DrawBasicReference(LE04TerrainSession session)
        {
            var s=session.Settings;var references=session.Current.State.References;
            if(references.Count>0)s.ReferenceIndex=EditorGUILayout.Popup("参考源",Mathf.Clamp(s.ReferenceIndex,0,references.Count-1),references.Select(r=>r.Id).ToArray());
            else EditorGUILayout.HelpBox("先导入认证 .voxel.json 或按统一格制作的闭合静态模型。源只采样一次；不会创建一串模型实例。",MessageType.Info);
            using(new EditorGUI.DisabledScope(session.Busy))
            {
                if(GUILayout.Button("导入 .voxel.json 形色参考…"))
                {
                    string path=EditorUtility.OpenFilePanel("导入地貌形色参考","","json");if(!string.IsNullOrEmpty(path))try{session.AddReference(LE04TerrainFiles.ReadReference(File.ReadAllText(path)),path);}catch(Exception error){session.Status=error.Message;}
                }
                le04ImportModel=(GameObject)EditorGUILayout.ObjectField("闭合静态模型",le04ImportModel,typeof(GameObject),false);le04ImportUnit=EditorGUILayout.FloatField("来源体素格 (m)",le04ImportUnit);
                using(new EditorGUI.DisabledScope(le04ImportModel==null))if(GUILayout.Button("一次采样所选模型"))try{session.AddReference(LE03MeshVoxelImport.Import(le04ImportModel,le04ImportUnit,"reference."+le04ImportModel.name),AssetDatabase.GetAssetPath(le04ImportModel));}catch(Exception error){session.Status=error.Message;}
            }
            s.ReferenceMode=(ReferenceBrushMode)EditorGUILayout.Popup("参考操作",(int)s.ReferenceMode,new[]{"增加并融合","削减","只参考颜色"});
            s.ScaleX=EditorGUILayout.Slider("X 轮廓伸展",s.ScaleX,.5f,3);s.ScaleY=EditorGUILayout.Slider("Y 轮廓伸展",s.ScaleY,.5f,3);s.ScaleZ=EditorGUILayout.Slider("Z 轮廓伸展",s.ScaleZ,.5f,3);s.Yaw=EditorGUILayout.Slider("水平朝向 (°)",s.Yaw,0,360);s.BlendWidth=EditorGUILayout.Slider("融合宽度 (m)",s.BlendWidth,0,.5f);s.UseColor=EditorGUILayout.Toggle("使用参考普通颜色",s.UseColor);s.OverwriteManual=EditorGUILayout.Toggle("明确覆盖已有手涂",s.OverwriteManual);
        }
    }
}
