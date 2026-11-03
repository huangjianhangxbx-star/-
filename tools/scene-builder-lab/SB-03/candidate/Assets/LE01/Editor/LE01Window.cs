using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public sealed partial class LE01Window : EditorWindow
    {
        readonly LE01Stroke stroke=new LE01Stroke();
        bool enabledTool=true,continuePick,showPlaneGrid=true;
        int chosenStyle,control;
        Vector2 scroll;
        SceneView capturedView;
        Vector3 lastValidPoint;
        Tool lastUnityTool;
        string cachedJson;
        TerrainDocument cachedDocument;
        TerrainDocument Current {get{if(cachedDocument==null||cachedJson!=stroke.Author.DocumentJson){cachedJson=stroke.Author.DocumentJson;cachedDocument=stroke.Author.Read();}return cachedDocument;}}
        public static LE01Window Instance;
        public LE01Stroke Controller {get{return stroke;}}
        [MenuItem("星骸/LE-01/地形画笔")]
        public static void Open(){var w=GetWindow<LE01Window>("星骸地形画笔");Instance=w;w.minSize=new Vector2(340,430);w.Bind();SceneView.RepaintAll();}
        [MenuItem("星骸/LE-01/打开圆台示例")]
        public static void OpenSample(){OpenScene("Assets/LE01/Scenes/Round_719.unity");}
        static bool OpenScene(string path,bool sculpt=false)
        {
            if(!File.Exists(path)){EditorUtility.DisplayDialog("星骸地编","未找到示例场景："+path+"\n请使用包含示例的完整源码包。","确定");return false;}
            if(Instance!=null)Instance.CancelInput();if(!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return false;
            string folder=path.StartsWith("Assets/LE04/",StringComparison.Ordinal)?"Assets/LE04/WorkScenes":path.StartsWith("Assets/LE03/",StringComparison.Ordinal)?"Assets/LE03/WorkScenes":"Assets/LE02/WorkScenes";LE01Export.Folder(folder);
            string workspace=AssetDatabase.GenerateUniqueAssetPath(folder+"/"+Path.GetFileNameWithoutExtension(path)+"-work-"+DateTime.Now.ToString("yyyyMMdd-HHmmssfff")+".unity");
            if(!AssetDatabase.CopyAsset(path,workspace)){EditorUtility.DisplayDialog("星骸地编","无法创建示例工作副本，请检查工程目录是否可写。","确定");return false;}
            EditorSceneManager.OpenScene(workspace);Open();return Instance.PrepareWorkspace(sculpt);
        }
        public bool PrepareWorkspace(bool sculpt)
        {
            CancelInput();Bind();if(stroke.Author==null){stroke.Status="当前场景没有可编辑地形，请先新建或打开样例";return false;}
            modulePage=false;sculptPage=sculpt&&Current.GeneratorVersion!="le01.1";SetMode(sculptPage?(Current.GeneratorVersion=="le01.3"?BrushMode.SculptShape:BrushMode.SculptDepth):BrushMode.Extend);lastUnityTool=Tools.current;
            Selection.activeGameObject=stroke.Author.gameObject;FrameTerrain(sculptPage);stroke.Status=sculptPage?"已定位高崖；在可见侧壁按下，左右拖动调凹凸，松手提交":"已定位地形；在 Scene 视图按住左键延展，松手提交";Repaint();return true;
        }
        void FrameTerrain(bool wall=false)
        {
            var view=SceneView.lastActiveSceneView;if(view==null)view=GetWindow<SceneView>();view.in2DMode=false;view.orthographic=false;
            var bounds=LE01Adapter.Bounds(stroke.Author);float size=Mathf.Max(4,bounds.extents.magnitude*1.25f);
            view.LookAt(bounds.center,Quaternion.Euler(wall?16:38,-35,0),size,false,true);view.Repaint();
        }
        void OnEnable(){Instance=this;lastUnityTool=Tools.current;SceneView.duringSceneGui+=OnScene;EditorApplication.update+=Tick;Undo.undoRedoPerformed+=OnUndo;EditorApplication.focusChanged+=FocusChanged;EditorSceneManager.sceneClosing+=SceneClosing;Selection.selectionChanged+=SelectionChanged;Bind();}
        void OnDisable(){if(LE04TerrainSession.Has(stroke.Author))BasicSession.Cancel();stroke.Cancel();if(stroke.Author!=null&&!LE03Modules.ReleasePending(stroke.Author))LE03Modules.Cancel(stroke.Author);LE02BrushOverlay.Release();SceneView.duringSceneGui-=OnScene;EditorApplication.update-=Tick;Undo.undoRedoPerformed-=OnUndo;EditorApplication.focusChanged-=FocusChanged;EditorSceneManager.sceneClosing-=SceneClosing;Selection.selectionChanged-=SelectionChanged;if(Instance==this)Instance=null;}
        void Bind()
        {
            var author=FindObjectOfType<LE01TerrainAuthor>();bool changed=stroke.Author!=author;
            if(changed){stroke.Cancel();stroke.Author=author;}if(author==null)return;
            if(LE04TerrainSession.Has(author)){LE04TerrainSession.Get(author);return;}var d=author.Read();if(changed){stroke.LoadParameters(d);stroke.SculptScope=d.GeneratorVersion=="le01.3"?SculptInfluence.LocalSurface:SculptInfluence.LinkedColumn;stroke.Seed=d.Seed;stroke.SculptMinHeight=d.BaseHeight;stroke.SculptMaxHeight=d.ActivePlaneHeight;chosenStyle=d.Style;}
            var filters=LE01Adapter.Geometry(author).GetComponentsInChildren<MeshFilter>();
            if(!stroke.Busy&&(filters.Length==0||filters.Any(f=>f.sharedMesh==null)||!LE01Adapter.GeometryMatchesAuthor(author)))LE01Adapter.Upload(author,TerrainCompiler.Build(d),true,true);
        }
        void Tick(){if(LE04TerrainSession.Has(stroke.Author)){var session=BasicSession;session.Tick();Repaint();return;}TickInteraction();}
        void SelectionChanged(){CancelInput();var go=Selection.activeGameObject;var chosen=go==null?null:go.GetComponentInParent<LE01TerrainAuthor>();if(chosen!=null&&chosen!=stroke.Author){stroke.Author=chosen;var document=chosen.Read();stroke.LoadParameters(document);if(LE04TerrainSession.Has(chosen)){LE04TerrainSession.Get(chosen);return;}if(LE03Modules.HasLayer(chosen)){if(!LE03Modules.Busy(chosen)&&!LE01Adapter.GeometryMatchesAuthor(chosen))LE03Modules.HistoryChanged(chosen);}else stroke.RequestUndoChanged();stroke.SculptScope=document.GeneratorVersion=="le01.3"?SculptInfluence.LocalSurface:SculptInfluence.LinkedColumn;chosenStyle=document.Style;}}
        void OnUndo(){if(LE04TerrainSession.Has(stroke.Author)){BasicSession.Rebuild(true);Repaint();SceneView.RepaintAll();return;}if(LE03Modules.HasLayer(stroke.Author))LE03Modules.HistoryChanged(stroke.Author);else stroke.RequestUndoChanged();if(stroke.Author!=null)chosenStyle=stroke.Author.Read().Style;Repaint();SceneView.RepaintAll();}
        void FocusChanged(bool focus){if(!focus)CancelInput(LE01InputKind.FocusLost);}
        void SceneClosing(Scene scene,bool removing){if(stroke.Author!=null&&stroke.Author.gameObject.scene==scene)CancelInput(LE01InputKind.SceneClosed);}
        void CancelInput(LE01InputKind kind=LE01InputKind.ToolChanged){var author=stroke.Author;if(LE04TerrainSession.Has(author))BasicSession.Cancel();stroke.Handle(kind,Vector3.zero,0);if(author!=null&&(kind==LE01InputKind.Escape||!LE03Modules.ReleasePending(author)))LE03Modules.Cancel(author);GUIUtility.hotControl=0;capturedView=null;hoverSelection=null;sculptProjectionActive=false;surfaceHover.Invalidate();hasSurfaceCursor=false;moduleGhost=false;moduleHitValid=false;Repaint();SceneView.RepaintAll();}
        void SetMode(BrushMode mode){CancelInput(LE01InputKind.ToolChanged);stroke.Mode=mode;continuePick=false;enabledTool=true;}
        void OnGUI()
        {
            if(Event.current.type==EventType.KeyDown&&Event.current.keyCode==KeyCode.Escape){CancelInput(LE01InputKind.Escape);continuePick=false;Event.current.Use();}
            using(new EditorGUILayout.HorizontalScope(EditorStyles.toolbar)){
                using(new EditorGUI.DisabledScope(EditorBusy)){
                    if(GUILayout.Button("开始",EditorStyles.toolbarButton))LE01CStart.Open();
                    if(GUILayout.Button("新建",EditorStyles.toolbarButton))NewTerrain();
                    if(GUILayout.Button("打开",EditorStyles.toolbarButton))LoadNative();
                }
                using(new EditorGUI.DisabledScope(stroke.Author==null||EditorBusy)){
                    if(GUILayout.Button("保存",EditorStyles.toolbarButton))SaveNative();
                    if(GUILayout.Button("导出 FBX",EditorStyles.toolbarButton))Export();
                }
            }
            if(stroke.RestoringHistory||LE03Modules.RestoringHistory(stroke.Author)){EditorGUILayout.HelpBox("正在后台恢复历史，完成后继续编辑…",MessageType.Info);return;}
            scroll=EditorGUILayout.BeginScrollView(scroll);
            if(stroke.Author==null){EditorGUILayout.HelpBox("在 Scene 视图编辑，无需点击 Play。先新建空地形，或从开始页打开阶梯岩台／高崖样例。",MessageType.Info);if(GUILayout.Button("新建空地形"))NewTerrain();if(GUILayout.Button("打开开始页与示例"))LE01CStart.Open();EditorGUILayout.EndScrollView();return;}
            if(LE04TerrainSession.Has(stroke.Author)){DrawBasicPanel();EditorGUILayout.EndScrollView();return;}DrawBasicOffer();EditorGUILayout.LabelField("当前工具",ToolName(stroke.Mode)+(enabledTool?" · 已启用":" · 已暂停"),EditorStyles.boldLabel);
            if(!enabledTool){EditorGUILayout.HelpBox("切换 Unity 工具后，地形画笔会暂停。点击下面按钮继续。",MessageType.Info);if(GUILayout.Button("恢复地形画笔")){enabledTool=true;lastUnityTool=Tools.current;}}
            bool enable=EditorGUILayout.ToggleLeft("启用场景画笔",enabledTool);if(enabledTool&&!enable)CancelInput();enabledTool=enable;
            showPlaneGrid=EditorGUILayout.ToggleLeft("显示逻辑平面网格",showPlaneGrid);
            EditorGUILayout.LabelField("当前地形",Current.Id,EditorStyles.miniLabel);
            DrawVersionPanel();
            DrawRuleControls();DrawThemeControls();
            int page;using(new EditorGUI.DisabledScope(EditorBusy))page=GUILayout.Toolbar(modulePage?2:sculptPage?1:0,new[]{"地形","岩壁塑形","模型画笔"});
            if((page==1)!=sculptPage||(page==2)!=modulePage){CancelInput();sculptPage=page==1;modulePage=page==2;moduleGhost=false;if(!modulePage)SetMode(sculptPage?(Current.GeneratorVersion=="le01.3"?BrushMode.SculptShape:BrushMode.SculptDepth):BrushMode.Extend);}
            if(modulePage){DrawModulePanel();EditorGUILayout.EndScrollView();return;}
            if(sculptPage){DrawSculptPanel();EditorGUILayout.EndScrollView();return;}
            var names=new[]{"延展","抬升","下压","隆起","压低","擦除","局部重塑"};var modes=new[]{BrushMode.Extend,BrushMode.Raise,BrushMode.Lower,BrushMode.SmoothRaise,BrushMode.SmoothLower,BrushMode.Erase,BrushMode.Reshape};int selected=Array.IndexOf(modes,stroke.Mode);
            int next=GUILayout.Toolbar(selected,names);if(next>=0&&next!=selected)SetMode(modes[next]);
            if(GUILayout.Button(continuePick?"点击一个台面…":"沿此台面继续（点选）")){CancelInput();continuePick=true;enabledTool=true;}
            using(new EditorGUI.DisabledScope(EditorBusy)){
                stroke.Radius=EditorGUILayout.Slider(SoftMode(stroke.Mode)?"中心半径 (m)":"半径 (m)",stroke.Radius,.125f,8f);
                stroke.PlaneHeight=TerrainUnits.ToUnits(EditorGUILayout.FloatField("平面 H (m)",stroke.PlaneHeight*TerrainUnits.Unit));
                var d=Current;float b=EditorGUILayout.FloatField("地形底 B (m)",d.BaseHeight*TerrainUnits.Unit);
                if(TerrainUnits.ToUnits(b)!=d.BaseHeight)ChangeDocument("改变地形底",x=>x.BaseHeight=TerrainUnits.ToUnits(b));
                int index=stroke.Quantum==4?0:stroke.Quantum==2?1:2;int qi=EditorGUILayout.Popup("新笔格度 q",index,new[]{"0.25 m","0.125 m","0.0625 m"});stroke.Quantum=new[]{4,2,1}[qi];
                if(Current.GeneratorVersion=="le01.1"){int style=EditorGUILayout.Popup("侧壁风格",chosenStyle,new[]{"连续柱组","组织阶崖"});if(style!=chosenStyle){chosenStyle=style;ChangeDocument("改变侧壁风格",x=>x.Style=style);}}else EditorGUILayout.LabelField("侧壁风格",TerrainRockPresets.For(d).Name);
                stroke.Seed=EditorGUILayout.IntField("局部候选 Seed",stroke.Seed);
                if(stroke.Mode==BrushMode.Raise||stroke.Mode==BrushMode.Lower){stroke.EntirePlateau=EditorGUILayout.Toggle("修改整个同高连通台面",stroke.EntirePlateau);if(stroke.EntirePlateau)EditorGUILayout.HelpBox("整台面模式高亮完整连通范围，不受圆形半径限制。",MessageType.None);}
                bool gray=EditorGUILayout.Toggle("灰模检查",stroke.Author.Gray);if(gray!=stroke.Author.Gray)LE01Adapter.SetGray(stroke.Author,gray);
                DrawSoftSettings();
            }
            DrawPresetLibrary();
            EditorGUILayout.Space(5);EditorGUILayout.LabelField("局部格度转换",EditorStyles.boldLabel);
            int target=stroke.TargetQuantum==4?0:stroke.TargetQuantum==2?1:2;stroke.TargetQuantum=new[]{4,2,1}[EditorGUILayout.Popup("目标 q",target,new[]{"0.25 m","0.125 m","0.0625 m"})];
            if(GUILayout.Button("选择转换区域 → 预览"))SetMode(BrushMode.Convert);
            if(stroke.PendingConfirmation){
                var candidate=stroke.Preview;var region=candidate.DirtyBounds;
                EditorGUILayout.HelpBox("仅预览：点击的圆形区域（不沿拖动路径刷选）。Esc 可取消。",MessageType.Warning);
                EditorGUILayout.LabelField("作者叶格",Current.Cells.Count+" → "+candidate.Document.Cells.Count);
                EditorGUILayout.LabelField("损失格数 / 生成CPU",candidate.LostCells+" / "+stroke.LastBuildMilliseconds+" ms");
                EditorGUILayout.LabelField("作者影响范围 (m)",(region.MinX*TerrainUnits.Unit).ToString("0.##")+","+(region.MinZ*TerrainUnits.Unit).ToString("0.##")+" → "+(region.MaxX*TerrainUnits.Unit).ToString("0.##")+","+(region.MaxZ*TerrainUnits.Unit).ToString("0.##"));
                EditorGUILayout.LabelField("派生重建", "影响范围 + 有限邻接边带，按 4m 区块");
                if(candidate.Rejected)EditorGUILayout.HelpBox(candidate.Message,MessageType.Error);
                using(new EditorGUILayout.HorizontalScope()){if(GUILayout.Button("应用候选")){stroke.Apply();capturedView=null;}if(GUILayout.Button("取消"))CancelInput();}
            }
            EditorGUILayout.Space(5);EditorGUILayout.HelpBox(stroke.Status,MessageType.None);
            var doc=Current;EditorGUILayout.LabelField("作者叶格 / Revision",doc.Cells.Count+" / "+doc.Revision);
            EditorGUILayout.LabelField("最近 CPU 核心 / 生成 / 上传",stroke.LastKernelMilliseconds+" / "+stroke.LastBuildMilliseconds+" / "+LE01Adapter.LastUploadMilliseconds+" ms");
            EditorGUILayout.HelpBox("左键按住绘制，松开一次提交；抬压按下锁定选区，垂直拖动每 8 px 改一档 q。Esc、切工具、失焦或关场景取消。Alt 与中/右键保留导航。格度下拉只影响新笔。",MessageType.Info);
            if(GUILayout.Button("定位地形视角"))FrameTerrain();
            EditorGUILayout.EndScrollView();
        }
        void ChangeDocument(string label,Action<TerrainDocument> change,bool rebuild=true){
            CancelInput();var d=Current.Copy();change(d);string error;
            if(d.BaseHeight>=d.ActivePlaneHeight||!TerrainKernel.Validate(d,out error)){var previous=stroke.Author.Read();stroke.PlaneHeight=previous.ActivePlaneHeight;stroke.Quantum=previous.ActiveQuantum;stroke.Radius=previous.BrushRadius;stroke.Status="参数未应用：地形底必须低于活动平面和全部台面，且作者数据须有效";return;}
            Undo.RecordObject(stroke.Author,label);d.Revision++;stroke.Author.Write(d);EditorUtility.SetDirty(stroke.Author);EditorSceneManager.MarkSceneDirty(stroke.Author.gameObject.scene);if(rebuild)LE01Adapter.Upload(stroke.Author,TerrainCompiler.Build(d),true,true);
        }
        void PersistParameters(){
            var d=Current;if(d.ActivePlaneHeight==stroke.PlaneHeight&&d.ActiveQuantum==stroke.Quantum&&Mathf.Abs(d.BrushRadius-stroke.Radius)<.00001f&&(d.RockRuleVersion==0||d.HeightBrushForm==stroke.HeightForm&&d.HeightBrushRotation==stroke.RotationDegrees&&d.HeightBrushAspect==stroke.AspectRatio))return;
            ChangeDocument("改变画笔参数",x=>{WriteBrushParameters(x);if(!x.Planes.Any(p=>p.Height==x.ActivePlaneHeight))x.Planes.Add(new WorkPlane{Id="p"+x.ActivePlaneHeight,Height=x.ActivePlaneHeight});},false);
        }
        void OnScene(SceneView view){if(LE04TerrainSession.Has(stroke.Author)){OnBasicScene(view);return;}if(modulePage)OnModuleScene(view);else OnSurfaceScene(view);}
        public bool NewTerrain(bool legacy=false)
        {
            CancelInput();
            if(!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return false;
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            CancelInput();var go=new GameObject(legacy?"LE01_Terrain":"LE03_Terrain");var author=go.AddComponent<LE01TerrainAuthor>();var doc=new TerrainDocument{Id="terrain-"+DateTime.Now.ToString("yyyyMMdd-HHmmss")};if(!legacy){doc=TerrainGenerators.UpgradeToV3(doc);doc.RockRuleVersion=1;doc.SourceId="le03.hierarchical-rock";doc.HeightBrushForm=TerrainHeightForm.Mound;doc.HeightBrushAspect=1.7f;}author.Write(doc);Undo.RegisterCreatedObjectUndo(go,"新建地形");stroke.Author=author;stroke.LoadParameters(doc);stroke.SculptScope=legacy?SculptInfluence.LinkedColumn:SculptInfluence.LocalSurface;stroke.Seed=719;stroke.SculptMinHeight=doc.BaseHeight;stroke.SculptMaxHeight=0;stroke.SculptPreviewOnly=false;stroke.EntirePlateau=false;chosenStyle=0;EnsurePreviewLight();PrepareWorkspace(false);
            return true;
        }
        void LoadNative()
        {
            try
            {
                string path=EditorUtility.OpenFilePanel("打开地形或完整场景",Path.Combine(LE01CStart.CurrentRoot,"samples"),"json");if(string.IsNullOrEmpty(path))return;string json=File.ReadAllText(path);if(LE04TerrainFiles.IsFile(json)){var file=LE04TerrainFiles.Read(json);if(stroke.Author==null&&!NewTerrain())return;LE04TerrainFiles.LoadInto(stroke.Author,file);modulePage=sculptPage=false;return;}if(LE04TerrainSession.Has(stroke.Author))throw new InvalidOperationException("请在旧版或新建地形中打开旧文件，避免丢失 v2 编辑层。");VoxelWorldFile world;
                if(LE03Modules.TryReadWorld(json,out world))
                {if(stroke.Author==null&&!NewTerrain())return;if(LE03Modules.LoadWorld(stroke.Author,world)){modulePage=true;sculptPage=false;moduleGhost=false;}return;}
                var d=LE01Adapter.NativeLoad(path);if(stroke.Author==null&&!NewTerrain(d.GeneratorVersion=="le01.1"))return;
                if(LE03Modules.HasLayer(stroke.Author)){LE03Modules.LoadWorld(stroke.Author,new VoxelWorldFile{terrain=d,layer=new VoxelLayerDocument()});return;}
                stroke.ReplaceDocument(d,"打开原生地形");chosenStyle=d.Style;stroke.SculptScope=d.GeneratorVersion=="le01.3"?SculptInfluence.LocalSurface:SculptInfluence.LinkedColumn;stroke.SculptMinHeight=d.BaseHeight;stroke.SculptMaxHeight=d.ActivePlaneHeight;PrepareWorkspace(false);
            }
            catch(Exception ex){ShowFailure(ex);}
        }
        void SaveNative(){try{if(LE04TerrainSession.Has(stroke.Author)){string basicPath=EditorUtility.SaveFilePanel("保存基础地貌 v2",OutputFolder("samples"),stroke.Author.Read().Id+".basicterrain","json");if(!string.IsNullOrEmpty(basicPath))LE04TerrainFiles.Save(stroke.Author,basicPath);return;}PersistParameters();bool mixed=LE03Modules.HasLayer(stroke.Author);string path=EditorUtility.SaveFilePanel(mixed?"保存完整场景（地形＋模型）":"保存作者数据",mixed?Path.Combine(LE01CStart.CurrentRoot,"samples"):OutputFolder("samples"),stroke.Author.Read().Id+(mixed?".voxelworld":".leterrain"),"json");if(!string.IsNullOrEmpty(path))LE01Adapter.NativeSave(stroke.Author,path);}catch(Exception ex){ShowFailure(ex);}}
        void Export(){try{string path=EditorUtility.SaveFilePanel("导出可见地形 FBX",OutputFolder("exports"),stroke.Author.Read().Id,"fbx");if(!string.IsNullOrEmpty(path))LE01Export.Export(LE01Adapter.Geometry(stroke.Author),path);}catch(Exception ex){ShowFailure(ex);}}
        void ShowFailure(Exception error){stroke.Status=error.Message;EditorUtility.DisplayDialog("LE-01 操作未完成",error.Message,"确定");}
    }
}
