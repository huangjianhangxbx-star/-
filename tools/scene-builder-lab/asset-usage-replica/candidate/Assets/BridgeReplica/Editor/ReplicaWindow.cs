using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
namespace XingHai.BridgeReplica.Editor
{
    public sealed class ReplicaWindow : EditorWindow
    {
        ReplicaAuthor author,scratch;
        ReplicaKit draftKit;
        RouteDocument draft,axisStart;
        readonly List<RouteNode> samples=new List<RouteNode>();
        bool drawing,drawMode,ownsTools,oldToolsHidden;
        Vector3 drawOrigin,axisPosition,axisDirection;
        Vector2 axisMouse;
        int selectedNode,selectedSegment,axisCapture,creationUndoGroup,sourceIndex;
        double lastPreview;
        Vector2 scroll;
        string message="按住左键画出路线，保留中间转折。",drawId;
        float newHeight=2;
        public ReplicaAuthor Author {get{return author;}}
        public RouteDocument Draft {get{return draft==null?null:draft.Clone();}}
        public bool Drawing {get{return drawing;}}
        public string Status {get{return message;}}
        [MenuItem("星骸/专用搭建/折线桥与套件")]
        public static void Open(){GetWindow<ReplicaWindow>("星骸 · 路线搭建").Show();}
        [MenuItem("星骸/专用搭建/打开折线桥样例")]
        public static void OpenSample()
        {
            const string path="Assets/BridgeReplica/Scenes/RouteWorkflow.unity";
            if(File.Exists(path)&&EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())EditorSceneManager.OpenScene(path);
            Open();var a=FindObjectOfType<ReplicaAuthor>();if(a!=null){GetWindow<ReplicaWindow>().Select(a);SceneView.lastActiveSceneView?.FrameSelected();}
        }
        void OnEnable(){SceneView.duringSceneGui+=SceneGUI;Selection.selectionChanged+=SelectionChanged;Undo.undoRedoPerformed+=History;SelectionChanged();}
        void OnDisable(){CancelInput();SceneView.duringSceneGui-=SceneGUI;Selection.selectionChanged-=SelectionChanged;Undo.undoRedoPerformed-=History;ReleaseTools();}
        void AcquireTools(){if(ownsTools)return;oldToolsHidden=Tools.hidden;Tools.hidden=true;ownsTools=true;}
        void ReleaseTools(){if(!ownsTools)return;Tools.hidden=oldToolsHidden;ownsTools=false;}
        void SelectionChanged()
        {
            var selected=Selection.activeGameObject==null?null:Selection.activeGameObject.GetComponentInParent<ReplicaAuthor>();
            if(selected!=null&&selected!=author){if(author!=null)ReplicaSession.Get(author).Cancel();author=selected;ReloadDraft();}
            if(selected!=null)AcquireTools();else{ReleaseAxis();ReleaseTools();}Repaint();
        }
        void ReloadDraft(){if(author==null)return;draft=author.Read();draftKit=author.Kit;selectedNode=Mathf.Clamp(selectedNode,0,Mathf.Max(0,(draft?.Nodes.Count??0)-1));selectedSegment=Mathf.Clamp(selectedSegment,0,Mathf.Max(0,(draft?.Nodes.Count??1)-2));}
        void History(){CancelInput();SelectionChanged();ReloadDraft();Repaint();}
        public void Select(ReplicaAuthor value){author=value;Selection.activeGameObject=value.gameObject;ReloadDraft();AcquireTools();Repaint();}
        public void SetDrawMode(bool value){FinishGesture();drawMode=value;Repaint();SceneView.RepaintAll();}
        static float Snap(float v,float q){return Mathf.Round(v/q)*q;}
        bool Preview(){if(author==null||draft==null)return false;bool ok=ReplicaSession.Get(author).Preview(draft,draftKit);message=ReplicaSession.Get(author).Status;lastPreview=EditorApplication.timeSinceStartup;Repaint();return ok;}
        public bool Apply(){if(author==null)return false;bool ok=ReplicaSession.Get(author).Apply();message=ReplicaSession.Get(author).Status;if(ok)ReloadDraft();return ok;}
        void OnGUI()
        {
            GUILayout.Label("路线决定结构 · 套件决定造型",EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("有限正交折线：中间转折会保留。0.5m长度格、0.25m标高格、整数米净宽。转角使用平台；洞口只放水平直段。",MessageType.Info);
            using(new EditorGUILayout.HorizontalScope())
            {
                if(GUILayout.Button(drawMode?"退出绘制":"连续绘制路线"))SetDrawMode(!drawMode);
                if(GUILayout.Button("直线样例"))Create(RouteExamples.Straight());
                if(GUILayout.Button("转折样例"))Create(RouteExamples.Detour());
            }
            if(drawMode)EditorGUILayout.HelpBox("左键按住画路线，沿X/Z转折；松手创建一个线路作者。默认架高2m，自动加入明确的两端台阶节点。过短或未形成合法路线时仅显示线，不提交旧预览。",MessageType.None);
            newHeight=Snap(EditorGUILayout.Slider("新路线默认抬高",newHeight,.5f,4),.25f);
            scroll=EditorGUILayout.BeginScrollView(scroll);
            var chosen=(ReplicaAuthor)EditorGUILayout.ObjectField("当前路线",author,typeof(ReplicaAuthor),true);if(chosen!=null&&chosen!=author)Select(chosen);
            if(author!=null&&draft!=null)
            {
                EditorGUI.BeginChangeCheck();draft.Width=EditorGUILayout.IntSlider("可走净宽（米）",(int)draft.Width,1,6);draft.Rails=EditorGUILayout.Toggle("栏杆与边缘",draft.Rails);
                var kits=ReplicaKitRegistry.All();if(kits.Length>0){int selected=Array.IndexOf(kits,draftKit);int next=EditorGUILayout.Popup("素材套件",Mathf.Max(0,selected),kits.Select(k=>k.Id+" / "+k.Version+(k.ResearchOnly?" · 本机研究":"")).ToArray());if(next!=selected)draftKit=kits[next];}
                if(EditorGUI.EndChangeCheck())Preview();
                using(new EditorGUILayout.HorizontalScope())
                {
                    if(GUILayout.Button("登记工坊套件…")){string path=EditorUtility.OpenFilePanel("选择 kit-manifest.json","","json");if(path!="")try{draftKit=ReplicaKitRegistry.Register(path);Preview();}catch(Exception e){message=e.Message;}}
                    using(new EditorGUI.DisabledScope(!ReplicaSession.Get(author).HasCandidate))if(GUILayout.Button("采用候选"))Apply();
                    if(GUILayout.Button("取消 / Esc")){CancelInput();message="已保留上一条路线及套件。";}
                }
                GUILayout.Space(8);GUILayout.Label("节点与局部标高",EditorStyles.boldLabel);
                selectedNode=EditorGUILayout.Popup("选中节点",Mathf.Clamp(selectedNode,0,draft.Nodes.Count-1),draft.Nodes.Select((n,i)=>i+" · "+n.Id+"  高 "+n.Y+"m").ToArray());
                var node=draft.Nodes[selectedNode];EditorGUI.BeginChangeCheck();
                float x=Snap(EditorGUILayout.FloatField("X",node.X),.5f),z=Snap(EditorGUILayout.FloatField("Z",node.Z),.5f),y=Snap(EditorGUILayout.Slider("该节点标高",node.Y,0,5),.25f);
                if(EditorGUI.EndChangeCheck()){node.X=x;node.Z=z;node.Y=y;Preview();}
                EditorGUILayout.HelpBox("场景黄色方柄改该点标高；青色圆柄沿平行方向偏移中间直段的两个拐点。保持正交，外端点不随中间直段移动。",MessageType.None);
                GUILayout.Space(8);GUILayout.Label("续接、删除与桥洞",EditorStyles.boldLabel);
                selectedSegment=EditorGUILayout.Popup("路段",Mathf.Clamp(selectedSegment,0,draft.Nodes.Count-2),Enumerable.Range(0,draft.Nodes.Count-1).Select(i=>i+" · "+draft.Nodes[i].Id+" → "+draft.Nodes[i+1].Id).ToArray());
                using(new EditorGUILayout.HorizontalScope())
                {
                    if(GUILayout.Button("沿末段续接4米")){var n=draft.Nodes.Last();var p=draft.Nodes[draft.Nodes.Count-2];float length=Mathf.Abs(n.X-p.X)+Mathf.Abs(n.Z-p.Z);if(length>.01f){draft.Nodes.Add(new RouteNode{Id=Guid.NewGuid().ToString("N"),X=n.X+(n.X-p.X)/length*4,Y=n.Y,Z=n.Z+(n.Z-p.Z)/length*4});Preview();}}
                    if(GUILayout.Button("删除最后一段")&&draft.Nodes.Count>2){var last=draft.Nodes.Last();draft.Nodes.RemoveAt(draft.Nodes.Count-1);draft.Openings.RemoveAll(o=>o.SegmentId.EndsWith("__"+last.Id,StringComparison.Ordinal));selectedNode=Mathf.Min(selectedNode,draft.Nodes.Count-1);selectedSegment=Mathf.Min(selectedSegment,draft.Nodes.Count-2);Preview();}
                }
                string id=RouteDocument.GetSegmentId(draft.Nodes[selectedSegment].Id,draft.Nodes[selectedSegment+1].Id);var opening=draft.Openings.FirstOrDefault(o=>o.SegmentId==id);EditorGUI.BeginChangeCheck();bool on=EditorGUILayout.Toggle("此路段开洞",opening!=null&&opening.Enabled);
                float width=opening==null?4:opening.Width,height=opening==null?1.25f:opening.Height;
                if(on){width=Snap(EditorGUILayout.Slider("洞宽",width,1,10),.5f);height=Snap(EditorGUILayout.Slider("中心净高",height,.5f,4),.25f);}
                if(EditorGUI.EndChangeCheck()){draft.Openings.RemoveAll(o=>o.SegmentId==id);if(on)draft.Openings.Add(new RouteOpening{SegmentId=id,Width=width,Height=height});Preview();}
                using(new EditorGUILayout.HorizontalScope())
                {
                    if(GUILayout.Button("保存路线文件")){string p=EditorUtility.SaveFilePanel("保存可编辑路线","","route.bridge.json","json");if(p!=""){FinishGesture();try{ReplicaFiles.SaveAuthor(author,p);message="路线、节点与套件版本已保存。";}catch(Exception e){message=e.Message;}}}
                    if(GUILayout.Button("打开路线文件")){string p=EditorUtility.OpenFilePanel("打开可编辑路线","","json");if(p!="")try{CancelInput();ReplicaFiles.LoadAuthor(author,p);ReloadDraft();}catch(Exception e){message=e.Message;}}
                }
                using(new EditorGUILayout.HorizontalScope())
                {
                    if(GUILayout.Button("另存原生场景")){ReplicaKitRegistry.Folder("Assets/BridgeReplica/WorkScenes");string p=EditorUtility.SaveFilePanelInProject("保存原生场景","RouteWork","unity","保留可编辑节点和真实网格","Assets/BridgeReplica/WorkScenes");if(p!="")try{FinishGesture();ReplicaFiles.SaveScene(p);}catch(Exception e){message=e.Message;}}
                    if(GUILayout.Button("烘焙独立预制体")){ReplicaKitRegistry.Folder("Assets/BridgeReplica/Baked");string p=EditorUtility.SaveFilePanelInProject("烘焙","RouteBridge","prefab","独立网格、材质和碰撞","Assets/BridgeReplica/Baked");if(p!="")try{FinishGesture();var baked=ReplicaFiles.Bake(author,p);DestroyImmediate(baked);}catch(Exception e){message=e.Message;}}
                }
                if(draftKit!=null&&draftKit.Bindings!=null&&draftKit.Bindings.Length>0)
                {
                    GUILayout.Space(8);GUILayout.Label("这部分用了哪个母件？",EditorStyles.boldLabel);
                    sourceIndex=EditorGUILayout.Popup("源件职责",Mathf.Clamp(sourceIndex,0,draftKit.Bindings.Length-1),draftKit.Bindings.Select(b=>b.Title+" · "+b.Role).ToArray());
                    var binding=draftKit.Bindings[sourceIndex];var model=AssetDatabase.LoadAssetAtPath<GameObject>(binding.ModelPath);
                    EditorGUILayout.ObjectField("实际模型",model,typeof(GameObject),false);
                    var image=AssetPreview.GetAssetPreview(model);if(image!=null)GUILayout.Label(image,GUILayout.Height(90),GUILayout.Width(130));
                    EditorGUILayout.LabelField("原尺寸",binding.Size.x+" × "+binding.Size.y+" × "+binding.Size.z+"m");
                    if(GUILayout.Button("在工程中定位源件"))EditorGUIUtility.PingObject(model);
                }
                var result=ReplicaSession.Get(author).Candidate??ReplicaSession.Get(author).Committed;if(result!=null&&result.Valid)EditorGUILayout.LabelField(result.Document.Nodes.Count+"节点 / "+result.Plan.Parts.Count+"构件 / "+result.Plan.Solids.Count+"承托剖面段");
            }
            EditorGUILayout.HelpBox(message??"",MessageType.None);EditorGUILayout.EndScrollView();
            if(Event.current.type==EventType.KeyDown&&Event.current.keyCode==KeyCode.Escape){CancelInput();Event.current.Use();}
        }
        public void Create(RouteDocument doc)
        {
            CancelInput();var go=new GameObject("折线桥_路线作者");var a=go.AddComponent<ReplicaAuthor>();doc=doc.Clone();doc.Id=Guid.NewGuid().ToString("N");var kit=ReplicaKitRegistry.EnsureBase();var s=ReplicaSession.Get(a);
            if(!s.Preview(doc,kit)||!s.ApplyNew()){message=s.Status;ReplicaGeometry.Destroy(go);return;}Undo.RegisterCreatedObjectUndo(go,"创建折线桥路线");Select(a);SceneView.lastActiveSceneView?.FrameSelected();
        }
        bool Hit(Ray ray,out Vector3 point)
        {if(!drawing&&Physics.Raycast(ray,out var hit,500)&&hit.collider.GetComponentInParent<ReplicaAuthor>()==null){point=hit.point;return true;}var plane=new Plane(Vector3.up,drawing?drawOrigin:Vector3.zero);if(plane.Raycast(ray,out float distance)){point=ray.GetPoint(distance);return true;}point=Vector3.zero;return false;}
        public void BeginDraw(Vector3 point)
        {CancelInput();drawing=true;drawOrigin=point;drawId=Guid.NewGuid().ToString("N");samples.Clear();samples.Add(new RouteNode{Id="s0",X=0,Y=0,Z=0});Undo.IncrementCurrentGroup();creationUndoGroup=Undo.GetCurrentGroup();message="路线采样中；明显的中间转折会保留。";}
        public bool DragDraw(Vector3 point)
        {
            if(!drawing)return false;var local=point-drawOrigin;var sample=new RouteNode{Id="s"+samples.Count,X=Snap(local.x,.5f),Y=0,Z=Snap(local.z,.5f)};
            var last=samples[samples.Count-1];if(Mathf.Abs(last.X-sample.X)+Mathf.Abs(last.Z-sample.Z)<=.01f)return scratch!=null&&ReplicaSession.Get(scratch).HasCandidate;samples.Add(sample);
            if(samples.Count<2)return false;
            try
            {
                var doc=RouteSketch.Build(samples,newHeight,2);doc.Id=drawId;
                if(scratch==null){var go=new GameObject("路线候选");go.hideFlags=HideFlags.DontSave;go.transform.position=drawOrigin;scratch=go.AddComponent<ReplicaAuthor>();}
                var s=ReplicaSession.Get(scratch);bool ok=s.Preview(doc,draftKit??ReplicaKitRegistry.EnsureBase());message=s.Status;return ok;
            }catch(Exception e){if(scratch!=null)ReplicaSession.Get(scratch).Cancel();message=e.Message;return false;}
        }
        public bool EndDraw()
        {
            if(!drawing)return false;drawing=false;if(scratch==null)return false;var a=scratch;scratch=null;var s=ReplicaSession.Get(a);
            if(!s.ApplyNew()){ReplicaGeometry.Destroy(a.gameObject);return false;}a.name="折线桥_路线作者";a.gameObject.hideFlags=HideFlags.None;Undo.RegisterCreatedObjectUndo(a.gameObject,"连续绘制一条路线");Undo.CollapseUndoOperations(creationUndoGroup);Select(a);return true;
        }
        void ReleaseAxis(){if(axisCapture!=0&&GUIUtility.hotControl==axisCapture)GUIUtility.hotControl=0;axisCapture=0;axisStart=null;}
        public void CancelInput(){ReleaseAxis();if(scratch!=null){ReplicaSession.Get(scratch).Cancel();ReplicaGeometry.Destroy(scratch.gameObject);scratch=null;}drawing=false;samples.Clear();if(author!=null){ReplicaSession.Get(author).Cancel();ReloadDraft();}SceneView.RepaintAll();Repaint();}
        public void FinishGesture(){ReleaseAxis();if(drawing)EndDraw();if(author!=null&&ReplicaSession.Get(author).HasCandidate)Apply();}
        bool Axis(int role,Vector3 point,Vector3 direction,float quantum,Handles.CapFunction cap,out float delta)
        {
            int id=0x40000000|((GetInstanceID()*397^role*104729)&0x3fffffff);var e=Event.current;float size=HandleUtility.GetHandleSize(point)*.1f;delta=0;
            if(e.type==EventType.Layout||e.type==EventType.Repaint)cap(id,point,Quaternion.LookRotation(direction),size,e.type);
            if(e.type==EventType.MouseDown&&e.button==0&&!e.alt&&GUIUtility.hotControl==0&&(HandleUtility.nearestControl==id||Vector2.Distance(e.mousePosition,HandleUtility.WorldToGUIPoint(point))<8))
            {GUIUtility.hotControl=id;axisCapture=id;axisMouse=e.mousePosition;axisPosition=point;axisDirection=direction;axisStart=draft.Clone();e.Use();}
            else if(e.type==EventType.MouseDrag&&GUIUtility.hotControl==id&&axisCapture==id){delta=Snap(HandleUtility.CalcLineTranslation(axisMouse,e.mousePosition,axisPosition,axisDirection),quantum);e.Use();return true;}
            else if(e.type==EventType.MouseUp&&e.button==0&&GUIUtility.hotControl==id){GUIUtility.hotControl=0;e.Use();}
            return false;
        }
        int MovableLeg(int node)
        {
            for(int j=Math.Max(1,node-1);j<=Math.Min(draft.Nodes.Count-3,node);j++)
            {var a=draft.Nodes[j-1];var b=draft.Nodes[j];var c=draft.Nodes[j+1];var d=draft.Nodes[j+2];bool legX=Mathf.Abs(c.X-b.X)>.01f;bool beforeX=Mathf.Abs(b.X-a.X)>.01f,afterX=Mathf.Abs(d.X-c.X)>.01f;if(legX!=beforeX&&legX!=afterX)return j;}return -1;
        }
        void SceneGUI(SceneView view)
        {
            var e=Event.current;if(e==null)return;bool released=e.type==EventType.MouseUp&&e.button==0;
            if(e.type==EventType.KeyDown&&e.keyCode==KeyCode.Escape){CancelInput();e.Use();return;}
            if(e.alt||e.button==1||e.button==2){if(e.type==EventType.MouseDown||e.alt)FinishGesture();return;}
            if(drawMode)
            {
                if(e.type==EventType.Layout)HandleUtility.AddDefaultControl(GUIUtility.GetControlID(FocusType.Passive));
                if(e.type==EventType.MouseDown&&e.button==0&&Hit(HandleUtility.GUIPointToWorldRay(e.mousePosition),out var point)){BeginDraw(point);e.Use();}
                // Capture every quantized input point. A visual preview cadence
                // may never discard the middle of the authored route.
                if(drawing&&e.type==EventType.MouseDrag&&Hit(HandleUtility.GUIPointToWorldRay(e.mousePosition),out var point2)){DragDraw(point2);lastPreview=EditorApplication.timeSinceStartup;e.Use();view.Repaint();Repaint();}
                if(drawing&&released){if(Hit(HandleUtility.GUIPointToWorldRay(e.mousePosition),out var end))DragDraw(end);EndDraw();e.Use();Repaint();}
                if(drawing&&samples.Count>1){Handles.color=Color.cyan;Handles.DrawAAPolyLine(3,samples.Select(n=>drawOrigin+new Vector3(n.X,.03f,n.Z)).ToArray());}
                return;
            }
            if(author==null||draft==null)return;if(Selection.activeGameObject==null||Selection.activeGameObject.GetComponentInParent<ReplicaAuthor>()!=author){ReleaseAxis();ReleaseTools();return;}AcquireTools();
            Handles.color=new Color(.2f,.85f,.9f);Handles.DrawAAPolyLine(3,draft.Nodes.Select(n=>author.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z))).ToArray());
            for(int i=0;i<draft.Nodes.Count;i++)
            {
                int index=i;var n=draft.Nodes[i];var point=author.transform.TransformPoint(new Vector3(n.X,n.Y+.25f,n.Z));Handles.color=index==selectedNode?Color.yellow:new Color(.6f,.8f,.8f);
                if(Axis(100+i,point,author.transform.up,.25f,Handles.CubeHandleCap,out float amount)){selectedNode=index;draft=axisStart.Clone();draft.Nodes[index].Y=axisStart.Nodes[index].Y+amount;Preview();}
                Handles.Label(point+Vector3.up*.2f,index+" · "+n.Y+"m");
            }
            int leg=MovableLeg(selectedNode);
            if(leg>=0)
            {
                var a=draft.Nodes[leg];var b=draft.Nodes[leg+1];var direction=author.transform.TransformDirection(new Vector3(-Math.Sign(b.Z-a.Z),0,Math.Sign(b.X-a.X)));var point=author.transform.TransformPoint(new Vector3((a.X+b.X)/2,Mathf.Max(a.Y,b.Y)+.45f,(a.Z+b.Z)/2));Handles.color=Color.cyan;
                if(Axis(500+leg,point,direction,.5f,Handles.ConeHandleCap,out float amount)){draft=RouteEdits.OffsetLeg(axisStart,leg,amount);Preview();}
            }
            if(released&&axisCapture!=0){FinishGesture();Repaint();}
        }
    }
    [CustomEditor(typeof(ReplicaAuthor))] public sealed class ReplicaInspector : UnityEditor.Editor
    {
        public override void OnInspectorGUI(){var a=(ReplicaAuthor)target;var d=a.Read();EditorGUILayout.LabelField("可编辑折线路线",EditorStyles.boldLabel);EditorGUILayout.LabelField(d==null?"尚未提交":d.Nodes.Count+"节点 / 修订 "+d.Revision);if(GUILayout.Button("打开路线与套件编辑器")){ReplicaWindow.Open();EditorWindow.GetWindow<ReplicaWindow>().Select(a);}}
    }
}
