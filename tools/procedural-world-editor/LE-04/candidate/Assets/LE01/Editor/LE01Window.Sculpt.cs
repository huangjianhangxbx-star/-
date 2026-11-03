using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public sealed partial class LE01Window
    {
        bool sculptPage,sculptProjectionActive;
        SculptSelection hoverSelection;
        readonly LE01StructureSelectionCache selectionCache=new LE01StructureSelectionCache();
        SurfaceHit hoverHit;
        Plane sculptPlane;
        Vector3 sculptCameraPosition;
        Quaternion sculptCameraRotation;
        Matrix4x4 sculptCameraProjection;
        string OutputFolder(string name){return Path.Combine(Current.RockRuleVersion==1||Current.TerrainThemeId=="snow-rock"?LE01CStart.CurrentRoot:Current.GeneratorVersion=="le01.3"?LE01CStart.LatestRoot:Current.GeneratorVersion=="le01.2"?LE01CStart.Root:LE01Export.TaskRoot,name);}
        [MenuItem("星骸/LE-01/新建旧版空地形")]
        public static void NewLegacy(){Open();Instance.NewTerrain(true);}
        [MenuItem("星骸/LE-01/打开 LE-01B 高崖候选")]
        public static void OpenTall(){OpenTallWorkspace();}
        public static bool OpenTallWorkspace(){return OpenScene("Assets/LE01B/Scenes/Tall_719.unity",true);}
        static void EnsurePreviewLight(){if(UnityEngine.Object.FindObjectOfType<Light>()!=null)return;var light=new GameObject("LE01B_PreviewKey").AddComponent<Light>();light.type=LightType.Directional;light.intensity=.9f;light.transform.rotation=Quaternion.Euler(35,-48,0);light.shadows=LightShadows.Soft;}
        void DrawVersionPanel()
        {
            EditorGUILayout.LabelField("生成器",Current.GeneratorVersion+(Current.GeneratorVersion=="le01.1"?" · 旧版保持":" · 连贯岩体候选"));
            if(Current.GeneratorVersion!="le01.3")using(new EditorGUI.DisabledScope(stroke.Busy)){if(GUILayout.Button("采用可塑形版本，并另存候选…"))UpgradeCandidate();}
        }
        void UpgradeCandidate()
        {
            try{
                CancelInput();var source=Current.Copy();var origin=stroke.Author.transform.position;source.OriginX=origin.x;source.OriginY=origin.y;source.OriginZ=origin.z;
                var candidate=TerrainGenerators.UpgradeToV3(source);string path=EditorUtility.SaveFilePanel("另存可塑形候选，保留旧版",Path.Combine(LE01CStart.LatestRoot,"samples"),candidate.Id+".leterrain","json");if(string.IsNullOrEmpty(path))return;
                if(!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return;EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
                var a=new GameObject("LE02_Terrain").AddComponent<LE01TerrainAuthor>();a.Write(candidate);a.transform.position=origin;stroke.Author=a;stroke.UndoChanged();stroke.SculptScope=SculptInfluence.LocalSurface;stroke.SculptMinHeight=candidate.BaseHeight;stroke.SculptMaxHeight=candidate.ActivePlaneHeight;EnsurePreviewLight();LE01Adapter.NativeSave(a,path);Selection.activeGameObject=a.gameObject;chosenStyle=candidate.Style;
                string scenePath=AssetDatabase.GenerateUniqueAssetPath("Assets/LE02/Scenes/"+candidate.Id+".unity");LE01Adapter.SaveSceneMeshes(a,scenePath);PrepareWorkspace(true);stroke.Status="已另存可塑形候选；旧作者文件和旧场景保留";
            }catch(Exception e){ShowFailure(e);}
        }
        void DrawSculptPanel()
        {
            if(!TerrainGenerators.IsRockDocument(Current)){EditorGUILayout.HelpBox("旧生成器不会自动改形。先采用 v2 并另存候选，才能编辑连贯岩体。",MessageType.Info);return;}
            var modes=new[]{BrushMode.SculptShape,BrushMode.SculptDepth,BrushMode.SculptDensity,BrushMode.LockShape,BrushMode.UnlockShape,BrushMode.RestoreShape};var labels=new[]{"薄厚","切削","密度","保形","解锁","恢复"};int index=Array.IndexOf(modes,stroke.Mode);int next=GUILayout.Toolbar(index,labels);if(next>=0&&next!=index)SetMode(modes[next]);
            using(new EditorGUI.DisabledScope(stroke.Active)){
                EditorGUI.BeginChangeCheck();stroke.Radius=EditorGUILayout.Slider(stroke.Mode==BrushMode.SculptShape&&stroke.SculptScope==SculptInfluence.LocalSurface?"片区半宽／半高 (m)":"选择半径 (m)",stroke.Radius,.125f,4);
                int scope=(int)stroke.SculptScope;int nextScope=EditorGUILayout.Popup("作用范围",scope,new[]{"沿柱联动 · 整段","手动高度带",stroke.Mode==BrushMode.SculptShape?"局部结构片 · 宽和高":"局部圆域 · 宽和高"});
                if(nextScope!=scope){if(nextScope==2&&Current.GeneratorVersion!="le01.3")stroke.Status="先另存可塑形版本，再使用局部圆域。";else stroke.SculptScope=(SculptInfluence)nextScope;}
                if(stroke.SculptScope==SculptInfluence.LocalSurface)EditorGUILayout.HelpBox(stroke.Mode==BrushMode.SculptShape?"尺度同时限制触点周围的宽与高，按原柱和台阶分片，片内整体内收／外移，保留原有起伏。":"半径同时限制触点周围的宽度和高度，只连接同朝向的可见墙面；不会自动联动整柱。",MessageType.None);
                if(stroke.SculptScope==SculptInfluence.HeightRange){stroke.SculptMinHeight=TerrainUnits.ToUnits(EditorGUILayout.FloatField("下界 (m)",stroke.SculptMinHeight*TerrainUnits.Unit));stroke.SculptMaxHeight=TerrainUnits.ToUnits(EditorGUILayout.FloatField("上界 (m)",stroke.SculptMaxHeight*TerrainUnits.Unit));}
                using(new EditorGUI.DisabledScope(stroke.Mode!=BrushMode.SculptShape&&stroke.Mode!=BrushMode.SculptDepth&&stroke.Mode!=BrushMode.SculptDensity))stroke.SculptStrength=EditorGUILayout.Slider(stroke.Mode==BrushMode.SculptDensity?"密度增量":stroke.Mode==BrushMode.SculptShape?"薄厚幅度 (m)":"切削／回填 (m)",stroke.SculptStrength,stroke.Mode==BrushMode.SculptDensity||stroke.Mode==BrushMode.SculptShape?-1:-.5f,stroke.Mode==BrushMode.SculptDensity||stroke.Mode==BrushMode.SculptShape?1:.5f);
                DrawShapeControls();
                stroke.SculptPreviewOnly=EditorGUILayout.Toggle("松手后先保留候选",stroke.SculptPreviewOnly);if(EditorGUI.EndChangeCheck()){hoverSelection=null;surfaceHover.Invalidate();SceneView.RepaintAll();}
            }
            string gesture=stroke.Mode==BrushMode.SculptShape?(stroke.SculptScope==SculptInfluence.LocalSurface?"正值外移结构片，负值内收；片内保持原柱走势与起伏，边缘形成阶梯收口。":"正值向外增加岩壁体积，负值向内收；手动高度带上下端渐弱、中部较强，可拖蓝色下界和橙色上界。"):stroke.Mode==BrushMode.SculptDepth?"侧壁按下固定目标，左右拖动调凹凸，松手提交。正值恢复已切削进深，负值内收；受原占用边界限制。":stroke.Mode==BrushMode.SculptDensity?"侧壁按下固定目标，左右拖动调子结构密度，松手提交；主柱组保持。":"在侧壁按下选定范围，松手应用“"+ToolName(stroke.Mode)+"”。";
            EditorGUILayout.HelpBox(gesture+" 整笔固定范围；实际联动高度见下方数字与侧壁高亮。",MessageType.Info);
            var selection=stroke.Active&&stroke.Command!=null?stroke.Command.Selection:hoverSelection;DrawSelectionInfo(selection);
            if(stroke.PendingConfirmation){
                EditorGUILayout.HelpBox("当前只是候选，作者文件未改变。应用或取消；Esc 取消。",MessageType.Warning);
                using(new EditorGUILayout.HorizontalScope()){using(new EditorGUI.DisabledScope(stroke.Preview==null||stroke.Preview.Rejected)){if(GUILayout.Button("应用候选")){stroke.Apply();capturedView=null;}}if(GUILayout.Button("取消候选"))CancelInput();}
            }
            if(stroke.Preview!=null){EditorGUILayout.LabelField("冲突 / 失配",stroke.Preview.ConflictCount+" / "+stroke.Preview.OrphanCount);if(!string.IsNullOrEmpty(stroke.Preview.ConstraintMessage))EditorGUILayout.HelpBox(stroke.Preview.ConstraintMessage,MessageType.Warning);}
            var orphaned=Current.SculptOverrides.Where(o=>o.Status==SculptStatus.Orphaned).ToArray();EditorGUILayout.LabelField("覆盖 / 保形 / 失配",Current.SculptOverrides.Count+" / "+Current.ShapeLocks.Count+" / "+orphaned.Length);
            foreach(var edit in orphaned.Take(3)){
                EditorGUILayout.LabelField("失配区域",edit.EditId.Length>12?edit.EditId.Substring(0,12):edit.EditId,EditorStyles.miniLabel);
                using(new EditorGUILayout.HorizontalScope()){if(GUILayout.Button("尝试恢复此条失配"))OrphanAction(edit,BrushMode.RestoreOrphan);if(GUILayout.Button("移除此条失配手修"))RemoveOrphan(edit);}
            }
            EditorGUILayout.HelpBox("保形锁定具体前壁范围与形态参数。相交的改高/擦除/粗化默认拒绝；相邻兼容修改保留覆盖。删除目标后的失配记录不自动换绑。恢复工具只清本处手修，先解锁再恢复。",MessageType.None);
            using(new EditorGUI.DisabledScope(stroke.Busy)){bool gray=EditorGUILayout.Toggle("灰模检查",stroke.Author.Gray);if(gray!=stroke.Author.Gray)LE01Adapter.SetGray(stroke.Author,gray);}
            EditorGUILayout.HelpBox(stroke.Status,MessageType.None);EditorGUILayout.LabelField("最近拾取 / 核心 / 生成",LE01Adapter.LastPickMilliseconds.ToString("0.00")+" / "+stroke.LastKernelMilliseconds+" / "+stroke.LastBuildMilliseconds+" ms");
            if(GUILayout.Button("定位岩壁视角"))FrameTerrain(true);
        }
        void OrphanAction(SculptOverride edit,BrushMode mode)
        {
            if(stroke.Active)return;SetMode(mode);var selection=new SculptSelection{DocumentId=Current.Id,SourceRevision=Current.Revision,GroupIds=edit.GroupIds.ToList(),Anchors=edit.Anchors.Select(a=>a.Copy()).ToList(),Bounds=edit.Bounds,MinHeight=edit.MinHeight,MaxHeight=edit.MaxHeight,Influence=edit.Influence,LocalMask=edit.LocalMask,LocalX=edit.LocalX,LocalY=edit.LocalY,LocalZ=edit.LocalZ,LocalRadius=edit.LocalRadius,Valid=true};
            if(stroke.BeginSculptSelection(selection,Vector2.zero)){stroke.Command.EditId=edit.EditId;stroke.RequestEnd();}
        }
        void RemoveOrphan(SculptOverride edit)
        {
            if(stroke.Active)return;var copy=Current.Copy();if(copy.SculptOverrides.RemoveAll(item=>item.EditId==edit.EditId&&item.Status==SculptStatus.Orphaned)==0)return;copy.Revision++;var origin=stroke.Author.transform.position;copy.OriginX=origin.x;copy.OriginY=origin.y;copy.OriginZ=origin.z;stroke.ReplaceDocument(copy,"移除此条失配手修");stroke.Status="已移除此条失配手修；基础地形与其他覆盖保留";
        }
        void DrawSelectionInfo(SculptSelection selection)
        {
            if(selection==null||!selection.Valid)return;EditorGUILayout.LabelField("固定柱组 / 边界段",selection.GroupIds.Count+" / "+selection.Anchors.Count);EditorGUILayout.LabelField("实际高度范围",(selection.MinHeight*TerrainUnits.Unit).ToString("0.###")+" → "+(selection.MaxHeight*TerrainUnits.Unit).ToString("0.###")+" m");
            EditorGUILayout.LabelField("边界范围",(selection.Bounds.MinX*TerrainUnits.Unit).ToString("0.##")+","+(selection.Bounds.MinZ*TerrainUnits.Unit).ToString("0.##")+" → "+(selection.Bounds.MaxX*TerrainUnits.Unit).ToString("0.##")+","+(selection.Bounds.MaxZ*TerrainUnits.Unit).ToString("0.##"));
        }
        void OnSculptScene(SceneView view,Event e)
        {
            if(!TerrainGenerators.IsRockDocument(Current)||stroke.Mode==BrushMode.SculptShape&&Current.GeneratorVersion!="le01.3")return;
            if(stroke.Active){
                DrawSculptSelection(stroke.Command.Selection,new Color(.95f,.7f,.25f,.85f));
                if(stroke.ReleasePending)return;
                if(e.type==EventType.MouseUp&&e.button==0&&!stroke.PendingConfirmation){stroke.RequestEnd();GUIUtility.hotControl=0;sculptProjectionActive=false;if(!stroke.Active)capturedView=null;e.Use();return;}
                if(e.type==EventType.MouseDrag&&e.button==0&&!stroke.PendingConfirmation){
                    if(!sculptProjectionActive||view.camera.transform.position!=sculptCameraPosition||Quaternion.Angle(view.camera.transform.rotation,sculptCameraRotation)>.001f||view.camera.projectionMatrix!=sculptCameraProjection){CancelInput();stroke.Status="视图投影改变，已取消未提交塑形";e.Use();return;}
                    float distance;var ray=HandleUtility.GUIPointToWorldRay(e.mousePosition);bool valid=sculptPlane.Raycast(ray,out distance);
                    if(valid){var p=stroke.Author.transform.InverseTransformPoint(ray.GetPoint(distance));var s=stroke.Command.Selection;valid=s.Bounds.Expand(32).Contains(Mathf.FloorToInt(p.x/TerrainUnits.Unit),Mathf.FloorToInt(p.z/TerrainUnits.Unit))&&p.y>=s.MinHeight*TerrainUnits.Unit-.25f&&p.y<=s.MaxHeight*TerrainUnits.Unit+.25f;}
                    stroke.DragSculpt(e.mousePosition,valid);e.Use();view.Repaint();
                }return;
            }
            if(hoverSelection!=null&&hoverSelection.SourceRevision!=Current.Revision)hoverSelection=null;
            if(e.type==EventType.MouseMove||e.type==EventType.MouseDown){
                if(surfaceHover.Resolve(stroke.Author,HandleUtility.GUIPointToWorldRay(e.mousePosition),true,e.type==EventType.MouseDown)){hoverHit=surfaceHover.Hit;var snapshot=selectionCache.Get(stroke.Author);hoverSelection=stroke.Mode==BrushMode.SculptShape?snapshot.ResolveShapeHit(hoverHit,stroke.Radius,stroke.SculptScope,stroke.SculptMinHeight,stroke.SculptMaxHeight):snapshot.ResolveHit(hoverHit,stroke.Radius,stroke.SculptScope,stroke.SculptMinHeight,stroke.SculptMaxHeight);}
                else{hoverSelection=null;if(e.type==EventType.MouseDown)stroke.Status=surfaceHover.Message;}
            }
            DrawSculptSelection(hoverSelection,new Color(.45f,.9f,.8f,.75f));DrawSculptHeightHandles(view);
            if(GUIUtility.hotControl!=0&&GUIUtility.hotControl!=control)return;
            if(e.type==EventType.MouseDown&&e.button==0&&hoverSelection!=null&&hoverSelection.Valid){
                if(stroke.BeginSculptSelection(hoverSelection,e.mousePosition)){capturedView=view;sculptPlane=new Plane(stroke.Author.transform.TransformDirection(new Vector3(hoverHit.NormalX,hoverHit.NormalY,hoverHit.NormalZ)),stroke.Author.transform.TransformPoint(new Vector3(hoverHit.X,hoverHit.Y,hoverHit.Z)));sculptCameraPosition=view.camera.transform.position;sculptCameraRotation=view.camera.transform.rotation;sculptCameraProjection=view.camera.projectionMatrix;sculptProjectionActive=true;GUIUtility.hotControl=control;e.Use();}
            }if(e.type==EventType.MouseMove)view.Repaint();
        }
        void DrawSculptSelection(SculptSelection selection,Color color)
        {
            LE02BrushOverlay.DrawSculpt(stroke.Author,selection,filter=>LE01Adapter.SurfaceBoundaryKeys(stroke.Author,filter),stroke.Active);
        }
        void DrawShapeControls()
        {
            if(stroke.Mode!=BrushMode.SculptShape)return;
            if(Current.GeneratorVersion!="le01.3"){EditorGUILayout.HelpBox("内收／外鼓需先采用上方可塑形版本，再另存候选。旧切削工具继续可用。",MessageType.Info);return;}
            using(new EditorGUILayout.HorizontalScope()){
                if(GUILayout.Button("内收瘦身"))stroke.SculptStrength=-Mathf.Max(.125f,Mathf.Abs(stroke.SculptStrength));
                if(GUILayout.Button("中段外鼓")){stroke.SculptStrength=Mathf.Max(.25f,Mathf.Abs(stroke.SculptStrength));stroke.SculptScope=SculptInfluence.HeightRange;int lo=Current.BaseHeight,hi=Current.Cells.Count==0?Current.ActivePlaneHeight:Current.Cells.Max(c=>c.Top);stroke.SculptMinHeight=lo+(hi-lo)/4;stroke.SculptMaxHeight=lo+(hi-lo)*3/4;}
            }
            EditorGUILayout.HelpBox("薄厚幅度单位为米，最多±1m。若只有一侧被高亮，仅修改该侧；局部上下界也可在Scene内直接拖动。",MessageType.None);
        }
    }
}
