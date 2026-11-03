using System;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public sealed partial class LE01Window
    {
        readonly LE02SurfaceHoverCache surfaceHover = new LE02SurfaceHoverCache();
        bool hasSurfaceCursor, cursorOnPlane, showPresets;
        Vector3 cursorPoint;
        string presetChoice = "classic", lastPaintStatus, lastPaintJson;
        int lastPaintUploads;
        bool lastPaintActive, lastPaintRestoring;
        double nextBind;
        void TickInteraction()
        {
            if (stroke.Author == null && EditorApplication.timeSinceStartup >= nextBind) { nextBind = EditorApplication.timeSinceStartup + .5; Bind(); }
            if (Tools.current != lastUnityTool) { lastUnityTool = Tools.current; CancelInput(); enabledTool = false; stroke.Status = "Unity 工具已切换；地形画笔暂停"; }
            if (stroke.Active && capturedView == null && !stroke.PendingConfirmation && !stroke.ReleasePending) stroke.Cancel();
            stroke.Tick();
            string moduleStatus=stroke.Author==null?null:LE03Modules.Status(stroke.Author);bool moduleBusy=LE03Modules.Busy(stroke.Author);if(lastModuleStatus!=moduleStatus||lastModuleBusy!=moduleBusy){lastModuleStatus=moduleStatus;lastModuleBusy=moduleBusy;Repaint();}
            string json = stroke.Author == null ? null : stroke.Author.DocumentJson;
            bool changed = lastPaintStatus != stroke.Status || lastPaintJson != json || lastPaintUploads != stroke.PreviewUploads || lastPaintActive != stroke.Active || lastPaintRestoring != stroke.RestoringHistory;
            if (changed) { lastPaintStatus = stroke.Status; lastPaintJson = json; lastPaintUploads = stroke.PreviewUploads; lastPaintActive = stroke.Active; lastPaintRestoring = stroke.RestoringHistory; Repaint(); }
            if (!stroke.Active) capturedView = null;
        }
        static bool SoftMode(BrushMode mode) { return mode == BrushMode.SmoothRaise || mode == BrushMode.SmoothLower; }
        void DrawSoftSettings()
        {
            if (!SoftMode(stroke.Mode)) return;
            if (Current.GeneratorVersion != "le01.3") { EditorGUILayout.HelpBox("隆起与压低使用可塑形版本。先在上方采用新版候选，再另存作者文件。", MessageType.Info); return; }
            stroke.Falloff = EditorGUILayout.Slider("外围过渡宽度 (m)", stroke.Falloff, .125f, 8);
            stroke.HeightStrength = EditorGUILayout.Slider("中心高度变化 (m)", stroke.HeightStrength, .0625f, 4);
            if(Current.RockRuleVersion==1)
            {
                stroke.HeightForm=(TerrainHeightForm)EditorGUILayout.Popup("地形走势",(int)stroke.HeightForm,new[]{"圆台 · 保留平顶","坡脊 · 沿长轴延伸","山坡 · 有方向的起落","局部起伏 · 不规则丘面"});
                if(stroke.HeightForm!=TerrainHeightForm.RoundTerrace)
                {
                    stroke.RotationDegrees=EditorGUILayout.Slider("走势方向 (°)",stroke.RotationDegrees,0,360);
                    float maximum=Mathf.Clamp(32/Mathf.Max(.125f,stroke.Radius+stroke.Falloff),1,4);
                    stroke.AspectRatio=EditorGUILayout.Slider("长短轴比例",Mathf.Min(stroke.AspectRatio,maximum),1,maximum);
                    EditorGUILayout.LabelField("外围范围",((stroke.Radius+stroke.Falloff)*stroke.AspectRatio*2).ToString("0.##")+" × "+((stroke.Radius+stroke.Falloff)*2).ToString("0.##")+" m",EditorStyles.miniLabel);
                }
            }
            else{stroke.HeightForm=TerrainHeightForm.RoundTerrace;EditorGUILayout.HelpBox("原规则继续使用圆台隆起；先另存新结构规则候选，再使用方向坡形。",MessageType.None);}
            EditorGUILayout.HelpBox("在台面按下锁定范围，上下拖动调高度，松手后台提交。范围之外保持原有台面，坡面仍保留阶梯感。", MessageType.None);
        }
        void DrawPresetLibrary()
        {
            showPresets = EditorGUILayout.Foldout(showPresets, "程序风格预设库", true); if (!showPresets) return;
            var presets = TerrainRockPresets.All;
            using (new EditorGUI.DisabledScope(EditorBusy))
            {
                LE02PresetCards.Draw(presets.Select(p => p.Id).ToArray(), presets.Select(p => p.Name).ToArray(), presets.Select(p => p.Description).ToArray(), ref presetChoice);
                if (GUILayout.Button("应用所选风格")) ApplyRockPreset(presetChoice);
            }
            EditorGUILayout.LabelField("当前风格", TerrainRockPresets.For(Current).Name, EditorStyles.miniLabel);
        }
        public bool ApplyRockPreset(string id)
        {
            if (stroke.Author == null || EditorBusy) return false;
            var result = TerrainRockPresets.Apply(Current, id);
            if (result.Rejected || !result.Changed) { stroke.Status = result.Message; return false; }
            stroke.ReplaceDocument(result.Document, "应用程序岩体风格"); presetChoice = id; surfaceHover.Invalidate(); hoverSelection = null; Repaint(); return true;
        }
        bool RefreshSurfaceCursor(Ray ray, bool force)
        {
            bool valid = surfaceHover.Resolve(stroke.Author, ray, false, force); cursorOnPlane = false; hasSurfaceCursor = false;
            if (valid)
            {
                var hit = surfaceHover.Hit;
                if ((LE01Stroke.IsHeightMode(stroke.Mode) || continuePick) && !LE01Adapter.CanEditHeightSurface(stroke.Author,hit)) { if(force)stroke.Status="请指向原生台面；中层岩壁台阶使用薄厚工具";return false; }
                cursorPoint = new Vector3(hit.X, hit.Y, hit.Z); hasSurfaceCursor = true;
            }
            else if (stroke.Mode == BrushMode.Extend && !surfaceHover.Blocked && stroke.IntersectLockedPlane(ray, out cursorPoint)) { cursorOnPlane = true; hasSurfaceCursor = true; }
            return hasSurfaceCursor;
        }
        void DrawTerrainCursor()
        {
            if (!hasSurfaceCursor || Event.current.type != EventType.Repaint) return;
            var world = stroke.Author.transform.TransformPoint(cursorPoint);
            if (!cursorOnPlane)
            {
                if(LE01Stroke.IsHeightMode(stroke.Mode))
                {
                    bool soft=SoftMode(stroke.Mode);var command=stroke.Active?stroke.Command:null;
                    var form=soft&&Current.RockRuleVersion==1?(command==null?stroke.HeightForm:command.HeightForm):TerrainHeightForm.RoundTerrace;
                    LE02BrushOverlay.DrawHeightForm(stroke.Author,cursorPoint,stroke.Radius,soft?stroke.Falloff:0,command==null?TerrainUnits.ToUnits(cursorPoint.y):command.StartHeight,stroke.EntirePlateau,soft,stroke.Active,form,command==null?stroke.RotationDegrees:command.RotationDegrees,command==null?stroke.AspectRatio:command.AspectRatio);
                }
                else LE02BrushOverlay.DrawTerrain(stroke.Author,cursorPoint,stroke.Radius,0,stroke.Mode==BrushMode.Erase||stroke.Mode==BrushMode.Reshape||stroke.Mode==BrushMode.Convert,stroke.Active);
                if (!stroke.Active) { var zTest = Handles.zTest; Handles.zTest = CompareFunction.LessEqual; Handles.color = new Color(.4f, .95f, .8f, .9f); Handles.DotHandleCap(0, world, Quaternion.identity, HandleUtility.GetHandleSize(world) * .035f, EventType.Repaint); Handles.zTest = zTest; }
            }
            else
            {
                var previous = Handles.zTest; Handles.zTest = CompareFunction.LessEqual; Handles.color = new Color(.45f, .75f, .9f, .8f); Handles.DrawWireDisc(world, stroke.Author.transform.up, stroke.Radius);
                if (showPlaneGrid)
                {
                    float step = stroke.Quantum * TerrainUnits.Unit; int half = Mathf.Clamp(Mathf.CeilToInt(stroke.Radius * 1.3f / step), 6, 24); float x = Mathf.Round(cursorPoint.x / step) * step, z = Mathf.Round(cursorPoint.z / step) * step;
                    Handles.color = new Color(.35f, .65f, .68f, .2f);
                    for (int i = -half; i <= half; i++) { Handles.DrawLine(stroke.Author.transform.TransformPoint(new Vector3(x + i * step, cursorPoint.y, z - half * step)), stroke.Author.transform.TransformPoint(new Vector3(x + i * step, cursorPoint.y, z + half * step))); Handles.DrawLine(stroke.Author.transform.TransformPoint(new Vector3(x - half * step, cursorPoint.y, z + i * step)), stroke.Author.transform.TransformPoint(new Vector3(x + half * step, cursorPoint.y, z + i * step))); }
                }
                Handles.zTest = previous; Handles.Label(world + Vector3.up * .12f, "空地延展工作平面 H " + stroke.PlaneHeight * TerrainUnits.Unit + " m");
            }
        }
        void OnSurfaceScene(SceneView view)
        {
            if (stroke.Author == null) return; DrawSceneHint(); var e = Event.current;
            if (e.type == EventType.MouseLeaveWindow) { hasSurfaceCursor = false; hoverSelection = null; view.Repaint(); return; }
            if (!enabledTool || stroke.RestoringHistory) return;
            control = GUIUtility.GetControlID("LE01Stroke".GetHashCode(), FocusType.Passive);
            if (e.type == EventType.KeyDown && e.keyCode == KeyCode.Escape) { CancelInput(LE01InputKind.Escape); continuePick = false; hasSurfaceCursor = false; e.Use(); return; }
            if (e.alt || EditorGUIUtility.editingTextField || (e.type == EventType.MouseDown && e.button != 0)) { if (stroke.Active && !stroke.ReleasePending && !stroke.PendingConfirmation) CancelInput(); hasSurfaceCursor = false; return; }
            if (e.type == EventType.Layout) HandleUtility.AddDefaultControl(control);
            if (LE01Stroke.IsSculptMode(stroke.Mode)) { OnSculptScene(view, e); return; }
            if (SoftMode(stroke.Mode) && Current.GeneratorVersion != "le01.3") return;
            if (e.type == EventType.MouseUp && e.button == 0 && stroke.Active && !stroke.PendingConfirmation && !stroke.ReleasePending)
            {
                stroke.RequestEnd(); GUIUtility.hotControl = 0; if (!stroke.Active) capturedView = null; e.Use(); view.Repaint(); return;
            }
            if (stroke.ReleasePending) { DrawTerrainCursor(); return; }
            if (e.type == EventType.MouseDrag && e.button == 0 && stroke.Active && !stroke.PendingConfirmation && LE01Stroke.IsHeightMode(stroke.Command.Mode))
            { stroke.Handle(LE01InputKind.Drag, lastValidPoint, e.mousePosition.y); e.Use(); view.Repaint(); DrawTerrainCursor(); return; }
            bool input = e.type == EventType.MouseMove || e.type == EventType.MouseDown || e.type == EventType.MouseDrag;
            if (input && !stroke.PendingConfirmation) RefreshSurfaceCursor(HandleUtility.GUIPointToWorldRay(e.mousePosition), e.type == EventType.MouseDown);
            DrawTerrainCursor();
            if (!hasSurfaceCursor) { if (e.type == EventType.MouseDown) stroke.Status = surfaceHover.Message; return; }
            lastValidPoint = cursorPoint;
            if (e.type == EventType.MouseDown && e.button == 0 && !stroke.PendingConfirmation)
            {
                if (continuePick) { stroke.PlaneHeight = TerrainUnits.ToUnits(cursorPoint.y); continuePick = false; SetMode(BrushMode.Extend); e.Use(); Repaint(); return; }
                capturedView = view; if (stroke.Handle(LE01InputKind.Down, cursorPoint, e.mousePosition.y)) { GUIUtility.hotControl = control; e.Use(); }
            }
            else if (e.type == EventType.MouseDrag && e.button == 0 && stroke.Active && !stroke.PendingConfirmation) { stroke.Handle(LE01InputKind.Drag, cursorPoint, e.mousePosition.y); e.Use(); }
            if (input) view.Repaint();
        }
        void DrawSculptHeightHandles(SceneView view)
        {
            if (stroke.Active || stroke.SculptScope != SculptInfluence.HeightRange || hoverSelection == null || !hoverSelection.Valid) return;
            var point = new Vector3(hoverHit.X, hoverHit.Y, hoverHit.Z); var normal = new Vector3(hoverHit.NormalX, hoverHit.NormalY, hoverHit.NormalZ);
            var lo = stroke.Author.transform.TransformPoint(new Vector3(point.x, stroke.SculptMinHeight * TerrainUnits.Unit, point.z) + normal * .025f);
            var hi = stroke.Author.transform.TransformPoint(new Vector3(point.x, stroke.SculptMaxHeight * TerrainUnits.Unit, point.z) + normal * .025f);
            EditorGUI.BeginChangeCheck(); Handles.color = new Color(.4f,.8f,1); var low = Handles.Slider(lo, stroke.Author.transform.up, HandleUtility.GetHandleSize(lo)*.08f, Handles.ConeHandleCap, TerrainUnits.Unit);
            Handles.color = new Color(1,.75f,.3f); var high = Handles.Slider(hi, stroke.Author.transform.up, HandleUtility.GetHandleSize(hi)*.08f, Handles.ConeHandleCap, TerrainUnits.Unit);
            if (EditorGUI.EndChangeCheck())
            {
                stroke.SculptMinHeight = TerrainUnits.ToUnits(stroke.Author.transform.InverseTransformPoint(low).y); stroke.SculptMaxHeight = Mathf.Max(stroke.SculptMinHeight + 1, TerrainUnits.ToUnits(stroke.Author.transform.InverseTransformPoint(high).y));
                var snapshot=selectionCache.Get(stroke.Author);hoverSelection = stroke.Mode==BrushMode.SculptShape?snapshot.ResolveShapeHit(hoverHit,stroke.Radius,stroke.SculptScope,stroke.SculptMinHeight,stroke.SculptMaxHeight):snapshot.ResolveHit(hoverHit, stroke.Radius, stroke.SculptScope, stroke.SculptMinHeight, stroke.SculptMaxHeight); view.Repaint(); Repaint();
            }
        }
    }
}
