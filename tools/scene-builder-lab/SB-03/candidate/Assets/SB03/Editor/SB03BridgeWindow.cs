using System;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace XingHai.SB03.Editor
{
    public sealed class SB03BridgeWindow : EditorWindow
    {
        SB03BridgeAuthor author,drawAuthor;
        BridgeSpec draft=new BridgeSpec();
        Vector2 scroll;
        bool drawMode,drawing,handleActive;
        Vector3 start;
        string message="拖画一条直线路线，再整体调整尺寸。",highlight="";
        double lastPreview;
        int dragUndoGroup;
        int axisCapture;
        Vector2 axisMouseStart;
        Vector3 axisPositionStart;
        bool ownsTools,previousToolsHidden;
        public SB03BridgeAuthor Author {get{return author;}}
        public bool Drawing {get{return drawing;}}
        public bool DrawMode {get{return drawMode;}}
        public string Status {get{return message;}}

        [MenuItem("星骸/专用搭建/阶梯石拱桥")]
        public static void Open(){GetWindow<SB03BridgeWindow>("星骸 · 石拱桥").Show();}
        [MenuItem("星骸/专用搭建/打开石拱桥样例")]
        public static void OpenSample()
        {
            const string path="Assets/SB03/Scenes/SB03_Bridge.unity";
            if(!System.IO.File.Exists(path)){Open();return;}
            if(!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return;
            EditorSceneManager.OpenScene(path);Open();
            var a=FindObjectOfType<SB03BridgeAuthor>();if(a!=null){Selection.activeGameObject=a.gameObject;SceneView.lastActiveSceneView?.FrameSelected();}
        }
        void OnEnable(){SceneView.duringSceneGui+=SceneGUI;Selection.selectionChanged+=SelectionChanged;Undo.undoRedoPerformed+=HistoryChanged;SelectionChanged();}
        void OnDisable(){CancelInput();SceneView.duringSceneGui-=SceneGUI;Selection.selectionChanged-=SelectionChanged;Undo.undoRedoPerformed-=HistoryChanged;ReleaseTools();}
        void HistoryChanged()
        {
            // Session history restores source and meshes. The window must also
            // discard its old draft, otherwise the next width change can bring
            // back a height that the user just undid.
            CancelInput();SelectionChanged();if(author!=null)draft=author.Spec.Clone();
            message="已同步撤销 / 重做后的整桥参数。";Repaint();SceneView.RepaintAll();
        }
        void AcquireTools(){if(ownsTools)return;previousToolsHidden=Tools.hidden;Tools.hidden=true;ownsTools=true;}
        void ReleaseTools(){if(!ownsTools)return;Tools.hidden=previousToolsHidden;ownsTools=false;}
        void SelectionChanged()
        {
            var go=Selection.activeGameObject;var selected=go==null?null:go.GetComponentInParent<SB03BridgeAuthor>();
            if(selected!=null&&selected!=author){if(author!=null)SB03BridgeSession.Get(author).Cancel();author=selected;draft=author.Spec.Clone();}if(selected!=null)AcquireTools();else ReleaseTools();Repaint();
        }
        public void SelectAuthor(SB03BridgeAuthor a){author=a;draft=a.Spec.Clone();Selection.activeGameObject=a.gameObject;AcquireTools();Repaint();}
        public void SetDrawMode(bool active){FinishNavigation();drawMode=active;SceneView.RepaintAll();Repaint();}
        static float Snap(float n,float step){return Mathf.Round(n/step)*step;}
        void OnGUI()
        {
            GUILayout.Label("楼梯 · 桥面 · 拱洞",EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("一条路线对应一座桥。首版为直线单孔石桥，构件保持原比例；B 独立于基础地貌。",MessageType.Info);
            using(new EditorGUILayout.HorizontalScope())
            {
                if(GUILayout.Button(drawMode?"退出拖画":"在场景拖画新桥"))SetDrawMode(!drawMode);
                if(GUILayout.Button("创建标准桥"))CreateStandard();
                if(GUILayout.Button("打开样例"))OpenSample();
            }
            if(drawMode)EditorGUILayout.HelpBox("在场景地面按住左键拖向终点。默认有洞桥至少约13米；松手生成一座整桥。右/中键、Alt导航，Esc取消本次。复杂地形暂以起点水平面为支承面，不自动挖地。",MessageType.None);
            scroll=EditorGUILayout.BeginScrollView(scroll);
            var selected=(SB03BridgeAuthor)EditorGUILayout.ObjectField("当前整桥",author,typeof(SB03BridgeAuthor),true);if(selected!=author&&selected!=null)SelectAuthor(selected);
            if(author!=null)
            {
                var session=SB03BridgeSession.Get(author);
                EditorGUI.BeginChangeCheck();
                draft.Length=Snap(EditorGUILayout.Slider("总长（米）",draft.Length,3,40),.5f);
                draft.Width=Snap(EditorGUILayout.Slider("可走净宽",draft.Width,1,6),.5f);
                draft.DeckHeight=Snap(EditorGUILayout.Slider("桥面相对标高",draft.DeckHeight,.25f,5),.25f);
                draft.StartHeight=Snap(EditorGUILayout.Slider("起端标高",draft.StartHeight,0,5),.25f);
                draft.EndHeight=Snap(EditorGUILayout.Slider("终端标高",draft.EndHeight,0,5),.25f);
                draft.Opening=EditorGUILayout.Toggle("桥下留拱洞",draft.Opening);
                using(new EditorGUI.DisabledScope(!draft.Opening))
                {draft.ArchWidth=Snap(EditorGUILayout.Slider("拱洞跨度",draft.ArchWidth,1,12),.5f);draft.ArchHeight=Snap(EditorGUILayout.Slider("拱洞中心净高",draft.ArchHeight,.5f,4.25f),.25f);}
                draft.Rails=EditorGUILayout.Toggle("栏杆与端柱",draft.Rails);
                if(EditorGUI.EndChangeCheck())PreviewDraft();
                using(new EditorGUILayout.HorizontalScope())
                {
                    using(new EditorGUI.DisabledScope(!session.HasCandidate))if(GUILayout.Button("应用整桥")){session.Apply();draft=author.Spec.Clone();message=session.Status;}
                    if(GUILayout.Button("取消候选 / Esc")){session.Cancel();draft=author.Spec.Clone();message="已取消候选，保留上一座桥。";}
                    if(GUILayout.Button("定位")){Selection.activeGameObject=author.gameObject;SceneView.lastActiveSceneView?.FrameSelected();}
                }
                var p=session.PreviewPlan??session.LastPlan;
                if(p!=null&&p.Valid)EditorGUILayout.LabelField("结构",p.StartSteps+" + "+p.EndSteps+" 阶 / "+p.Parts.Count+" 构件 / "+p.Solids.Count+" 墙芯段");
                GUILayout.Space(8);GUILayout.Label("来源反查",EditorStyles.boldLabel);
                var kit=SB03BridgeGeometry.Kit;var labels=new[]{"全部构件"}.Concat(kit.assets.Select(a=>a.number.ToString("00")+" · "+a.title)).ToArray();
                int index=string.IsNullOrEmpty(highlight)?0:Array.FindIndex(kit.assets,a=>a.id==highlight)+1;
                int choice=EditorGUILayout.Popup("高亮实际使用位置",index,labels);highlight=choice==0?"":kit.assets[choice-1].id;
                if(choice>0)
                {
                    var source=kit.assets[choice-1];EditorGUILayout.LabelField(source.id,EditorStyles.miniLabel);
                    if(GUILayout.Button("在工程中显示这个源 FBX"))EditorGUIUtility.PingObject(AssetDatabase.LoadAssetAtPath<GameObject>(SB03BridgeGeometry.KitRoot+source.fbx));
                }
                GUILayout.Space(8);GUILayout.Label("保存与独立使用",EditorStyles.boldLabel);
                using(new EditorGUILayout.HorizontalScope())
                {
                    if(GUILayout.Button("保存整桥文件")){var path=EditorUtility.SaveFilePanel("保存整桥作者","",author.name+".bridge.json","json");if(path!=""){FinishNavigation();SB03BridgeFiles.SaveAuthor(author,path);message="整桥作者与来源已保存。";}}
                    if(GUILayout.Button("载入整桥文件")){var path=EditorUtility.OpenFilePanel("载入整桥作者","","json");if(path!=""){SB03BridgeFiles.LoadAuthor(author,path);draft=author.Spec.Clone();}}
                }
                using(new EditorGUILayout.HorizontalScope())
                {
                    if(GUILayout.Button("另存原生场景")){SB03BridgeFiles.EnsureFolder("Assets/SB03/WorkScenes");var path=EditorUtility.SaveFilePanelInProject("保存场景","SB03_Work","unity","保留可编辑作者和真实网格","Assets/SB03/WorkScenes");if(path!=""){FinishNavigation();SB03BridgeFiles.SaveScene(path);message="原生场景已保存。";}}
                    if(GUILayout.Button("烘焙独立预制体")){SB03BridgeFiles.EnsureFolder("Assets/SB03/Baked");var path=EditorUtility.SaveFilePanelInProject("烘焙桥梁","SB03_Bridge","prefab","输出独立网格、材质与碰撞","Assets/SB03/Baked");if(path!=""){FinishNavigation();var baked=SB03BridgeFiles.Bake(author,path);DestroyImmediate(baked);message="独立预制体已烘焙。";}}
                }
            }
            else EditorGUILayout.HelpBox("选择已生成桥梁的任一部分，可整体编辑；也可以创建标准桥后试调。",MessageType.None);
            EditorGUILayout.Space();EditorGUILayout.HelpBox(message??"",MessageType.None);EditorGUILayout.EndScrollView();
            if(Event.current.type==EventType.KeyDown&&Event.current.keyCode==KeyCode.Escape){CancelInput();Event.current.Use();}
        }
        public void CreateStandard()
        {
            var root=new GameObject("SB03_阶梯石拱桥");var a=root.AddComponent<SB03BridgeAuthor>();a.Spec.Id=Guid.NewGuid().ToString("N");
            var view=SceneView.lastActiveSceneView;if(view!=null){var p=view.pivot;root.transform.position=new Vector3(p.x-7,0,p.z);}
            var session=SB03BridgeSession.Get(a);if(!session.Preview(a.Spec)||!session.Apply()){message=session.Status;DestroyImmediate(root);return;}
            Undo.RegisterCreatedObjectUndo(root,"新建阶梯石拱桥");SelectAuthor(a);SceneView.lastActiveSceneView?.FrameSelected();
        }
        void PreviewDraft(){var s=SB03BridgeSession.Get(author);s.Preview(draft);message=s.Status;lastPreview=EditorApplication.timeSinceStartup;SceneView.RepaintAll();}
        bool Hit(Ray ray,out Vector3 point)
        {
            if(Physics.Raycast(ray,out var hit,500)&&hit.collider.GetComponentInParent<SB03BridgeAuthor>()==null){point=hit.point;return true;}
            var plane=new Plane(Vector3.up,drawing?start:Vector3.zero);if(plane.Raycast(ray,out float distance)){point=ray.GetPoint(distance);return true;}point=Vector3.zero;return false;
        }
        public void BeginDraw(Vector3 point)
        {
            if(author!=null)SB03BridgeSession.Get(author).Cancel();drawing=true;start=point;drawAuthor=null;Undo.IncrementCurrentGroup();dragUndoGroup=Undo.GetCurrentGroup();message="拖向终点，形成同一座桥。";
        }
        public bool DragDraw(Vector3 point)
        {
            if(!drawing)return false;var flat=point-start;flat.y=0;float length=Snap(flat.magnitude,.5f);
            var spec=draft.Clone();spec.Length=length;spec.Id=drawAuthor==null?"pending":drawAuthor.Spec.Id;
            var plan=BridgeSolver.Solve(spec);if(!plan.Valid){if(drawAuthor!=null)SB03BridgeSession.Get(drawAuthor).Cancel();message=plan.Message;return false;}
            if(drawAuthor==null){var go=new GameObject("SB03_阶梯石拱桥");go.hideFlags=HideFlags.DontSave;drawAuthor=go.AddComponent<SB03BridgeAuthor>();drawAuthor.Spec.Id=Guid.NewGuid().ToString("N");spec.Id=drawAuthor.Spec.Id;}
            drawAuthor.transform.position=start;drawAuthor.transform.rotation=Quaternion.LookRotation(Vector3.Cross(flat.normalized,Vector3.up),Vector3.up);
            bool ok=SB03BridgeSession.Get(drawAuthor).Preview(spec);message=SB03BridgeSession.Get(drawAuthor).Status;return ok;
        }
        public bool EndDraw()
        {
            if(!drawing)return false;drawing=false;
            if(drawAuthor==null)return false;var a=drawAuthor;drawAuthor=null;var session=SB03BridgeSession.Get(a);
            if(!session.Apply()){SB03BridgeGeometry.DestroyGeometry(a.gameObject);return false;}
            a.gameObject.hideFlags=HideFlags.None;Undo.RegisterCreatedObjectUndo(a.gameObject,"拖画一座石拱桥");Undo.CollapseUndoOperations(dragUndoGroup);SelectAuthor(a);message="路线已落实为一座整桥，可拖端点或调整参数。";return true;
        }
        public void CancelInput()
        {
            ReleaseAxisCapture();
            if(drawAuthor!=null){SB03BridgeSession.Get(drawAuthor).Cancel();DestroyImmediate(drawAuthor.gameObject);drawAuthor=null;}drawing=false;handleActive=false;
            if(author!=null){SB03BridgeSession.Get(author).Cancel();draft=author.Spec.Clone();}message="本次候选已取消。";Repaint();SceneView.RepaintAll();
        }
        public void FinishNavigation()
        {
            ReleaseAxisCapture();
            if(drawing)EndDraw();
            if(author!=null){var s=SB03BridgeSession.Get(author);if(s.HasCandidate){s.Apply();draft=author.Spec.Clone();message=s.Status;}}
            handleActive=false;
        }
        void ReleaseAxisCapture()
        {if(axisCapture!=0&&GUIUtility.hotControl==axisCapture)GUIUtility.hotControl=0;axisCapture=0;}
        Vector3 AxisHandle(int role,Vector3 position,Vector3 direction,float size,Handles.CapFunction cap,float quantum)
        {
            // These IDs belong to this editor/author pair, rather than the
            // allocation sequence of other SceneView observers in a GUI pass.
            int id=0x40000000|((GetInstanceID()*397^(author==null?0:author.GetInstanceID())*31^role*104729)&0x3fffffff);
            var e=Event.current;var orientation=Quaternion.LookRotation(direction);
            if(e.type==EventType.Layout||e.type==EventType.Repaint)cap(id,position,orientation,size,e.type);
            if(e.type==EventType.MouseDown&&e.button==0&&!e.alt&&GUIUtility.hotControl==0)
            {
                // A close cap hit also covers a SceneView layout refreshed by
                // another observer between Layout and MouseDown. Native gizmos
                // are hidden while this bridge editor owns its custom handles.
                float pixels=Vector2.Distance(e.mousePosition,HandleUtility.WorldToGUIPoint(position));
                if(HandleUtility.nearestControl==id||pixels<=7)
                {GUIUtility.hotControl=id;axisCapture=id;axisMouseStart=e.mousePosition;axisPositionStart=position;e.Use();}
            }
            else if(e.type==EventType.MouseDrag&&GUIUtility.hotControl==id&&axisCapture==id)
            {
                float amount=HandleUtility.CalcLineTranslation(axisMouseStart,e.mousePosition,axisPositionStart,direction);
                var result=axisPositionStart+direction*Snap(amount,quantum);e.Use();
                if((result-position).sqrMagnitude>.0000001f)GUI.changed=true;
                return result;
            }
            else if(e.type==EventType.MouseUp&&e.button==0&&GUIUtility.hotControl==id)
            {ReleaseAxisCapture();e.Use();}
            return position;
        }
        void SceneGUI(SceneView view)
        {
            var e=Event.current;if(e==null)return;
            if(e.type==EventType.KeyDown&&e.keyCode==KeyCode.Escape){CancelInput();e.Use();return;}
            if(e.alt||e.button==1||e.button==2){if(e.type==EventType.MouseDown||e.alt)FinishNavigation();return;}
            if(drawMode)
            {
                if(e.type==EventType.Layout)HandleUtility.AddDefaultControl(GUIUtility.GetControlID(FocusType.Passive));
                if(e.button==0&&e.type==EventType.MouseDown&&Hit(HandleUtility.GUIPointToWorldRay(e.mousePosition),out var point)){BeginDraw(point);e.Use();}
                if(drawing&&e.type==EventType.MouseDrag&&Hit(HandleUtility.GUIPointToWorldRay(e.mousePosition),out var target)){if(EditorApplication.timeSinceStartup-lastPreview>.04){DragDraw(target);lastPreview=EditorApplication.timeSinceStartup;}e.Use();Repaint();}
                if(drawing&&e.type==EventType.MouseUp&&e.button==0){if(Hit(HandleUtility.GUIPointToWorldRay(e.mousePosition),out var last))DragDraw(last);EndDraw();e.Use();Repaint();}
                return;
            }
            if(author==null){ReleaseAxisCapture();return;}
            if(Selection.activeGameObject==null||Selection.activeGameObject.GetComponentInParent<SB03BridgeAuthor>()!=author){ReleaseAxisCapture();ReleaseTools();return;}
            AcquireTools();
            var session=SB03BridgeSession.Get(author);var plan=session.PreviewPlan;if(plan==null||!plan.Valid)plan=session.LastPlan;if(plan==null||!plan.Valid){ReleaseAxisCapture();return;}
            // Tuanjie changes rawType to Used when a handle consumes release.
            // Remember release before drawing any cap so a completed drag commits.
            bool releasedHandle=handleActive&&e.type==EventType.MouseUp&&e.button==0;
            using(new Handles.DrawingScope(author.transform.localToWorldMatrix))
            {
                Handles.color=new Color(1,.77f,.28f,1);
                if(highlight!="")foreach(var part in plan.Parts.Where(p=>p.SourceId==highlight)){var b=SB03BridgeGeometry.SourceBounds(part.SourceId);Handles.DrawWireCube(new Vector3(part.X,part.Y,part.Z)+b.center,b.size+Vector3.one*.012f);}
                Handles.color=new Color(.32f,.88f,.84f,.9f);Handles.DrawLine(new Vector3(0,draft.StartHeight,0),new Vector3(draft.Length,draft.EndHeight,0));
                EditorGUI.BeginChangeCheck();float size=HandleUtility.GetHandleSize(new Vector3(draft.Length,draft.EndHeight,0))*.12f;
                var end=AxisHandle(1,new Vector3(draft.Length,draft.EndHeight,0),Vector3.right,size,Handles.ConeHandleCap,.5f);
                var middle=AxisHandle(2,new Vector3(draft.Length/2,draft.DeckHeight,0),Vector3.up,size,Handles.CubeHandleCap,.25f);
                var beginY=AxisHandle(3,new Vector3(0,draft.StartHeight,0),Vector3.up,size,Handles.DotHandleCap,.25f);
                // Length and endpoint-elevation controls need separate hit areas.
                var endY=AxisHandle(4,new Vector3(draft.Length,draft.EndHeight,draft.Width/2+.75f),Vector3.up,size,Handles.DotHandleCap,.25f);
                if(EditorGUI.EndChangeCheck())
                {
                    draft.Length=Snap(end.x,.5f);draft.DeckHeight=Snap(middle.y,.25f);draft.StartHeight=Snap(beginY.y,.25f);draft.EndHeight=Snap(endY.y,.25f);handleActive=true;PreviewDraft();Repaint();
                }
                Handles.Label(new Vector3(draft.Length/2,draft.DeckHeight+1.6f,0),"整桥标高 · 拖动方柄\n"+draft.Length+"m × "+draft.Width+"m");
            }
            if(releasedHandle){FinishNavigation();Repaint();}
        }
    }

    [CustomEditor(typeof(SB03BridgeAuthor))]
    public sealed class SB03BridgeAuthorInspector : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {var a=(SB03BridgeAuthor)target;EditorGUILayout.LabelField("阶梯石拱桥 · B 专用搭建",EditorStyles.boldLabel);EditorGUILayout.LabelField(a.Spec.Length+"m × "+a.Spec.Width+"m / 修订 "+a.Revision);if(GUILayout.Button("打开整桥编辑器")){SB03BridgeWindow.Open();EditorWindow.GetWindow<SB03BridgeWindow>().SelectAuthor(a);}EditorGUILayout.HelpBox("尺寸修改会重排原构件与桥洞。基础地貌和独立物件保持独立。",MessageType.None);}
    }
}
