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
        ReplicaKit draftKit,drawingKit;
        RouteDocument draft,axisStart,continuationStart;
        ReplicaAuthor continuationAuthor;
        readonly List<RouteNode> samples=new List<RouteNode>();
        bool drawing,drawMode,ownsTools,oldToolsHidden,continuing,continueArmed,rejectedTail;
        Vector3 drawOrigin,axisPosition,axisDirection,planeAnchor;
        Vector2 axisMouse;
        int selectedNode,selectedSegment,axisCapture,drawCapture,creationUndoGroup,sourceIndex;
        double lastPreview;
        Vector2 scroll;
        string message="按住左键画出缓弯路线，桥体会随笔迹出现。",drawId,tailReason;
        float newHeight=2;
        public ReplicaAuthor Author {get{return author;}}
        public RouteDocument Draft {get{return draft==null?null:draft.Clone();}}
        public bool Drawing {get{return drawing;}}
        public string Status {get{return message;}}
        [MenuItem("星骸/专用搭建/随笔迹搭桥")]
        [MenuItem("星骸/专用搭建/折线桥与套件")]
        public static void Open(){GetWindow<ReplicaWindow>("星骸 · 随笔迹搭桥").Show();}
        [MenuItem("星骸/专用搭建/打开随笔迹桥样例")]
        public static void OpenCurveSample()
        {
            const string path="Assets/BridgeReplica/Scenes/CurveWorkflow.unity";
            if(File.Exists(path)&&EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())EditorSceneManager.OpenScene(path);
            Open();var a=FindObjectsOfType<ReplicaAuthor>().FirstOrDefault(x=>x.Read()!=null&&x.Read().SchemaVersion==2);if(a!=null){GetWindow<ReplicaWindow>().Select(a);SceneView.lastActiveSceneView?.FrameSelected();}
        }
        [MenuItem("星骸/专用搭建/打开原作素材研究样例（本机）")]
        public static void OpenResearchSample()
        {
            const string folder="Assets/BridgeReplica/ResearchPrivate/SourceConsumption";
            string path=AssetDatabase.IsValidFolder(folder)?AssetDatabase.FindAssets("t:Scene",new[]{folder}).Select(AssetDatabase.GUIDToAssetPath).Where(p=>p.EndsWith("/U-source-baseline.unity",StringComparison.Ordinal)).OrderByDescending(p=>p,StringComparer.Ordinal).FirstOrDefault():null;
            if(path==null){EditorUtility.DisplayDialog("本机研究样例","此公开包不含原作数据。请先通过工具接入本机研究源件。","知道了");return;}
            if(!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return;
            EditorSceneManager.OpenScene(path);Open();var a=FindObjectsOfType<ReplicaAuthor>().FirstOrDefault(x=>x.Kit!=null&&x.Kit.ResearchOnly);if(a!=null){GetWindow<ReplicaWindow>().Select(a);SceneView.lastActiveSceneView?.FrameSelected();}
        }
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
            GUILayout.Label("随笔迹搭桥 · 套件决定造型",EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("自由路线按实际平面笔迹连续搭建，C / U / S 缓弯不改成直角。过急转弯或相交会给出原因并保留已提交作品；洞口只放水平直段。",MessageType.Info);
            using(new EditorGUILayout.HorizontalScope())
            {
                if(GUILayout.Button(drawMode?"退出绘制":"连续绘制路线"))SetDrawMode(!drawMode);
                if(GUILayout.Button("斜线样例"))Create(CurveExamples.Diagonal());
                if(GUILayout.Button("U 弯样例"))Create(CurveExamples.U());
                if(GUILayout.Button("S 弯样例"))Create(CurveExamples.S());
            }
            if(drawMode)EditorGUILayout.HelpBox(continueArmed?"从所选路线末端按住左键续画；新增部分保持末端标高，松手更新同一作者。":"左键按住画缓弯，0.5m 起显示桥体。新路线随长度逐渐抬到默认高度，两端为台阶；松手提交同一份可见候选。靠近所选自由路线末端起笔可续画。",MessageType.None);
            newHeight=Snap(EditorGUILayout.Slider("新路线默认抬高",newHeight,.5f,4),.25f);
            if(GUILayout.Button("接入本机 Tiny Glade 研究素材…"))
            {
                string folder=EditorUtility.OpenFolderPanel("选择含原作三件 JSON 的研究目录","","");
                if(folder!="")try{draftKit=ResearchKitImporter.Import(folder);if(author!=null&&draft!=null)Preview();else message="已选本机研究套件；下一笔将使用该套件。";}catch(Exception ex){message=ex.Message;}
            }
            scroll=EditorGUILayout.BeginScrollView(scroll);
            var chosen=(ReplicaAuthor)EditorGUILayout.ObjectField("当前路线",author,typeof(ReplicaAuthor),true);if(chosen!=null&&chosen!=author)Select(chosen);
            if(author!=null&&draft!=null)
            {
                bool free=draft.SchemaVersion==2;
                EditorGUILayout.LabelField("路线格式",free?"自由路线 v2":"旧正交路线 v1（保持原形）");
                if(!free&&GUILayout.Button("保留旧作，另建自由版"))DuplicateAsFree();
                EditorGUI.BeginChangeCheck();draft.Width=free?EditorGUILayout.Slider("可走净宽（米）",draft.Width,.5f,6):EditorGUILayout.IntSlider("可走净宽（米）",(int)draft.Width,1,6);draft.Rails=EditorGUILayout.Toggle("栏杆与边缘",draft.Rails);
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
                float x=EditorGUILayout.FloatField("X",node.X),z=EditorGUILayout.FloatField("Z",node.Z);if(!free){x=Snap(x,.5f);z=Snap(z,.5f);}bool horizontalChanged=EditorGUI.EndChangeCheck();
                EditorGUI.BeginChangeCheck();float y=EditorGUILayout.Slider("该节点标高",node.Y,0,8);bool heightChanged=EditorGUI.EndChangeCheck();
                if(horizontalChanged||heightChanged){node.X=x;node.Z=z;if(heightChanged)node.Y=Snap(y,.25f);Preview();}
                EditorGUILayout.HelpBox(free?"场景圆柄在水平面自由移动单个节点；上方黄色方柄改该节点标高。松手采用，一次撤销；Esc 取消。":"旧作保持正交：方柄改标高，青色锥柄平移中间直段。",MessageType.None);
                GUILayout.Space(8);GUILayout.Label("续接、删除与桥洞",EditorStyles.boldLabel);
                selectedSegment=EditorGUILayout.Popup("路段",Mathf.Clamp(selectedSegment,0,draft.Nodes.Count-2),Enumerable.Range(0,draft.Nodes.Count-1).Select(i=>i+" · "+draft.Nodes[i].Id+" → "+draft.Nodes[i+1].Id).ToArray());
                using(new EditorGUILayout.HorizontalScope())
                {
                    if(free&&GUILayout.Button("从末端连续续画"))BeginContinueDraw();
                    if(GUILayout.Button("沿末段续接4米")){var n=draft.Nodes.Last();var p=draft.Nodes[draft.Nodes.Count-2];float length=free?Mathf.Sqrt((n.X-p.X)*(n.X-p.X)+(n.Z-p.Z)*(n.Z-p.Z)):Mathf.Abs(n.X-p.X)+Mathf.Abs(n.Z-p.Z);if(length>.01f){draft.Nodes.Add(new RouteNode{Id=Guid.NewGuid().ToString("N"),X=n.X+(n.X-p.X)/length*4,Y=n.Y,Z=n.Z+(n.Z-p.Z)/length*4});Preview();}}
                    if(GUILayout.Button("删除最后一段")&&draft.Nodes.Count>2){var last=draft.Nodes.Last();draft.Nodes.RemoveAt(draft.Nodes.Count-1);draft.Openings.RemoveAll(o=>o.SegmentId.EndsWith("__"+last.Id,StringComparison.Ordinal));selectedNode=Mathf.Min(selectedNode,draft.Nodes.Count-1);selectedSegment=Mathf.Min(selectedSegment,draft.Nodes.Count-2);Preview();}
                }
                string id=RouteDocument.GetSegmentId(draft.Nodes[selectedSegment].Id,draft.Nodes[selectedSegment+1].Id);var opening=draft.Openings.FirstOrDefault(o=>o.SegmentId==id);EditorGUI.BeginChangeCheck();bool on=EditorGUILayout.Toggle("此路段开洞",opening!=null&&opening.Enabled);
                float width=opening==null?4:opening.Width,height=opening==null?1.25f:opening.Height;
                if(on){width=Snap(EditorGUILayout.Slider("洞宽",width,1,10),.5f);height=Snap(EditorGUILayout.Slider("中心净高",height,.5f,4),.25f);}
                if(EditorGUI.EndChangeCheck()){draft.Openings.RemoveAll(o=>o.SegmentId==id);if(on)draft.Openings.Add(new RouteOpening{SegmentId=id,Width=width,Height=height});Preview();}
                using(new EditorGUILayout.HorizontalScope())
                {
                    if(GUILayout.Button("保存路线文件")){string p=EditorUtility.SaveFilePanel("保存可编辑路线",ResearchAuthor()?PrivateDirectory("WorkFiles"):"","route.bridge.json","json");if(p!=""){FinishGesture();try{ReplicaFiles.SaveAuthor(author,p);message="路线、节点与套件版本已保存。";}catch(Exception e){message=e.Message;}}}
                    if(GUILayout.Button("打开路线文件")){string p=EditorUtility.OpenFilePanel("打开可编辑路线","","json");if(p!="")try{CancelInput();ReplicaFiles.LoadAuthor(author,p);ReloadDraft();}catch(Exception e){message=e.Message;}}
                }
                using(new EditorGUILayout.HorizontalScope())
                {
                    if(GUILayout.Button("另存原生场景")){string folder=ResearchAuthor()?ResearchKitImporter.PrivateRoot+"/WorkScenes":"Assets/BridgeReplica/WorkScenes";ReplicaKitRegistry.Folder(folder);string p=EditorUtility.SaveFilePanelInProject("保存原生场景","RouteWork","unity","保留可编辑节点和真实网格",folder);if(p!="")try{FinishGesture();ReplicaFiles.SaveScene(p);}catch(Exception e){message=e.Message;}}
                    using(new EditorGUI.DisabledScope(ResearchAuthor()))if(GUILayout.Button("烘焙独立预制体")){ReplicaKitRegistry.Folder("Assets/BridgeReplica/Baked");string p=EditorUtility.SaveFilePanelInProject("烘焙","RouteBridge","prefab","独立网格、材质和碰撞","Assets/BridgeReplica/Baked");if(p!="")try{FinishGesture();var baked=ReplicaFiles.Bake(author,p);DestroyImmediate(baked);}catch(Exception e){message=e.Message;}}
                }
                if(ResearchAuthor())EditorGUILayout.HelpBox("本机原作研究套件默认保存到私有研究目录，不提供公开烘焙。",MessageType.None);
                if(draftKit!=null&&draftKit.Bindings!=null&&draftKit.Bindings.Length>0)
                {
                    GUILayout.Space(8);GUILayout.Label("这部分用了哪个母件？",EditorStyles.boldLabel);
                    sourceIndex=EditorGUILayout.Popup("源件职责",Mathf.Clamp(sourceIndex,0,draftKit.Bindings.Length-1),draftKit.Bindings.Select(b=>b.Title+" · "+b.Role).ToArray());
                    var binding=draftKit.Bindings[sourceIndex];UnityEngine.Object model=binding.Mesh!=null?(UnityEngine.Object)binding.Mesh:AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(binding.ModelPath);
                    EditorGUILayout.ObjectField("实际模型",model,typeof(UnityEngine.Object),false);
                    var image=AssetPreview.GetAssetPreview(model);if(image!=null)GUILayout.Label(image,GUILayout.Height(90),GUILayout.Width(130));
                    EditorGUILayout.LabelField("原尺寸",binding.Size.x+" × "+binding.Size.y+" × "+binding.Size.z+"m");
                    if(!string.IsNullOrEmpty(binding.Usage))EditorGUILayout.HelpBox(binding.Usage,MessageType.None);
                    if(GUILayout.Button("在工程中定位源件"))EditorGUIUtility.PingObject(model);
                }
                var result=ReplicaSession.Get(author).Candidate??ReplicaSession.Get(author).Committed;if(result!=null&&result.Valid)EditorGUILayout.LabelField(result.Document.Nodes.Count+"节点 / "+(result.Curve==null?result.Plan.Parts.Count+"构件":result.Curve.Length.ToString("0.0")+"m 自由路线"));
            }
            EditorGUILayout.HelpBox(message??"",MessageType.None);EditorGUILayout.EndScrollView();
            if(Event.current.type==EventType.KeyDown&&Event.current.keyCode==KeyCode.Escape){CancelInput();Event.current.Use();}
        }
        bool ResearchAuthor(){return (draftKit!=null&&draftKit.ResearchOnly)||(author!=null&&author.Kit!=null&&author.Kit.ResearchOnly);}
        static string PrivateDirectory(string child){string path=ResearchKitImporter.PrivateRoot+"/"+child;ReplicaKitRegistry.Folder(path);return Path.GetFullPath(path);}
        public void Create(RouteDocument doc)
        {
            var kit=draftKit??ReplicaKitRegistry.EnsureBase();CancelInput();var go=new GameObject(doc.SchemaVersion==2?"随笔迹桥_路线作者":"折线桥_路线作者");var a=go.AddComponent<ReplicaAuthor>();doc=doc.Clone();doc.Id=Guid.NewGuid().ToString("N");var s=ReplicaSession.Get(a);
            if(!s.Preview(doc,kit)||!s.ApplyNew()){message=s.Status;ReplicaGeometry.Destroy(go);return;}Undo.RegisterCreatedObjectUndo(go,"创建折线桥路线");Select(a);SceneView.lastActiveSceneView?.FrameSelected();
        }
        void DuplicateAsFree()
        {
            var copy=draft.Clone();copy.SchemaVersion=2;copy.Id=Guid.NewGuid().ToString("N");var check=CurveSolver.Solve(copy);
            if(!check.Valid){message="旧作保持原样；当前节点不能直接另建自由版："+check.Message;return;}
            Create(copy);message="已另建自由版，旧作者及其节点未改变。";
        }
        public bool BeginContinueDraw()
        {
            FinishGesture();if(author==null||draft==null||draft.SchemaVersion!=2){message="先选择一条自由路线，再从末端续画。";return false;}
            continueArmed=true;drawMode=true;message="从所选路线末端按住左键续画，松手更新同一作者。";SceneView.RepaintAll();Repaint();return true;
        }
        bool Hit(Ray ray,out Vector3 point)
        {
            if(!drawing&&author!=null&&draft!=null&&draft.SchemaVersion==2)
            {
                var end=draft.Nodes.Last();var endpoint=author.transform.TransformPoint(new Vector3(end.X,end.Y,end.Z));
                if(continueArmed||Vector2.Distance(Event.current==null?HandleUtility.WorldToGUIPoint(endpoint):Event.current.mousePosition,HandleUtility.WorldToGUIPoint(endpoint))<12)
                {var endPlane=new Plane(author.transform.up,endpoint);if(endPlane.Raycast(ray,out float d)){point=ray.GetPoint(d);return true;}}
            }
            if(!drawing&&Physics.Raycast(ray,out var hit,500)&&hit.collider.GetComponentInParent<ReplicaAuthor>()==null){point=hit.point;return true;}
            var normal=continuing&&continuationAuthor!=null?continuationAuthor.transform.up:Vector3.up;
            var plane=new Plane(normal,drawing?drawOrigin:Vector3.zero);if(plane.Raycast(ray,out float distance)){point=ray.GetPoint(distance);return true;}point=Vector3.zero;return false;
        }
        public void BeginDraw(Vector3 point)
        {
            bool requested=continueArmed;var selected=author;var baseDoc=draft==null?null:draft.Clone();var kit=draftKit??ReplicaKitRegistry.EnsureBase();
            bool canContinue=false;Vector3 endpoint=Vector3.zero;
            if(selected!=null&&baseDoc!=null&&baseDoc.SchemaVersion==2)
            {var n=baseDoc.Nodes.Last();endpoint=selected.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z));var localDelta=selected.transform.InverseTransformVector(point-endpoint);canContinue=new Vector2(localDelta.x,localDelta.z).magnitude<=.6f;}
            CancelInput();
            if(requested&&!canContinue){continueArmed=true;message="请从当前路线末端起笔；已提交路线保持原样。";return;}
            drawing=true;rejectedTail=false;tailReason=null;drawingKit=kit;drawOrigin=canContinue?endpoint:point;drawId=canContinue?baseDoc.Id:Guid.NewGuid().ToString("N");samples.Clear();
            if(canContinue)
            {continuing=true;continuationAuthor=selected;continuationStart=baseDoc;var n=baseDoc.Nodes.Last();samples.Add(n.Clone());message="正在续画同一条路线；既有节点保持不变。";}
            else
            {samples.Add(new RouteNode{Id="s0",X=0,Y=0,Z=0});Undo.IncrementCurrentGroup();creationUndoGroup=Undo.GetCurrentGroup();message="随笔迹搭桥中；长度达到0.5米开始显示结构。";}
        }
        public bool DragDraw(Vector3 point)
        {
            if(!drawing)return false;var local=continuing?continuationAuthor.transform.InverseTransformPoint(point):point-drawOrigin;var sample=new RouteNode{Id="s"+samples.Count,X=local.x,Y=continuing?continuationStart.Nodes.Last().Y:0,Z=local.z};
            var last=samples[samples.Count-1];if(Mathf.Abs(last.X-sample.X)+Mathf.Abs(last.Z-sample.Z)<=.00001f)return continuing?ReplicaSession.Get(continuationAuthor).HasCandidate:scratch!=null&&ReplicaSession.Get(scratch).HasCandidate;samples.Add(sample);
            if(samples.Count<2)return false;
            try
            {
                var doc=CurveSketch.Build(samples,continuing?0:newHeight,continuing?continuationStart.Width:2);doc.Id=drawId;
                if(continuing)
                {
                    foreach(var n in doc.Nodes)n.Y=continuationStart.Nodes.Last().Y;
                    draft=CurveEdits.AppendStroke(continuationStart,doc.Nodes);bool valid=ReplicaSession.Get(continuationAuthor).Preview(draft,drawingKit);message=ReplicaSession.Get(continuationAuthor).Status;rejectedTail=!valid;tailReason=valid?null:message;return valid;
                }
                if(scratch==null){var go=new GameObject("路线候选");go.hideFlags=HideFlags.DontSave;go.transform.position=drawOrigin;scratch=go.AddComponent<ReplicaAuthor>();}
                var s=ReplicaSession.Get(scratch);bool ok=s.Preview(doc,drawingKit);message=s.Status;rejectedTail=!ok;tailReason=ok?null:message;return ok;
            }catch(Exception e){rejectedTail=true;tailReason=e.Message;message=e.Message;return false;}
        }
        public bool EndDraw()
        {
            if(!drawing)return false;ReleaseDraw();drawing=false;
            if(continuing)
            {
                var target=continuationAuthor;bool ok=ReplicaSession.Get(target).Apply();message=ok&&rejectedTail?"已采用最后有效范围；末段未纳入："+tailReason:ReplicaSession.Get(target).Status;
                if(!ok)ReplicaSession.Get(target).Cancel();continuing=false;continueArmed=false;continuationStart=null;continuationAuthor=null;samples.Clear();Select(target);return ok;
            }
            if(scratch==null){samples.Clear();return false;}var a=scratch;scratch=null;var s=ReplicaSession.Get(a);
            if(!s.ApplyNew()){message=s.Status;ReplicaGeometry.Destroy(a.gameObject);samples.Clear();return false;}a.name="随笔迹桥_路线作者";a.gameObject.hideFlags=HideFlags.None;Undo.RegisterCreatedObjectUndo(a.gameObject,"连续绘制一条路线");Undo.CollapseUndoOperations(creationUndoGroup);samples.Clear();Select(a);message=rejectedTail?"已采用最后有效范围；末段未纳入："+tailReason:s.Status;return true;
        }
        void ReleaseDraw(){if(drawCapture!=0&&GUIUtility.hotControl==drawCapture)GUIUtility.hotControl=0;drawCapture=0;}
        void ReleaseAxis(){if(axisCapture!=0&&GUIUtility.hotControl==axisCapture)GUIUtility.hotControl=0;axisCapture=0;axisStart=null;}
        public void CancelInput(){ReleaseAxis();ReleaseDraw();if(scratch!=null){ReplicaSession.Get(scratch).Cancel();ReplicaGeometry.Destroy(scratch.gameObject);scratch=null;}if(continuationAuthor!=null)ReplicaSession.Get(continuationAuthor).Cancel();drawing=false;continuing=false;continueArmed=false;rejectedTail=false;tailReason=null;continuationStart=null;continuationAuthor=null;drawingKit=null;samples.Clear();if(author!=null){ReplicaSession.Get(author).Cancel();ReloadDraft();}SceneView.RepaintAll();Repaint();}
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
        void PlanarNode(int index,Vector3 point)
        {
            int id=0x40000000|((GetInstanceID()*397^(900+index)*104729)&0x3fffffff);var e=Event.current;float size=HandleUtility.GetHandleSize(point)*.08f;
            if(e.type==EventType.Layout||e.type==EventType.Repaint)Handles.CircleHandleCap(id,point,Quaternion.LookRotation(author.transform.up),size,e.type);
            var plane=new Plane(author.transform.up,point);
            if(e.type==EventType.MouseDown&&e.button==0&&!e.alt&&GUIUtility.hotControl==0&&(HandleUtility.nearestControl==id||Vector2.Distance(e.mousePosition,HandleUtility.WorldToGUIPoint(point))<8))
            {
                if(plane.Raycast(HandleUtility.GUIPointToWorldRay(e.mousePosition),out float distance))
                {planeAnchor=HandleUtility.GUIPointToWorldRay(e.mousePosition).GetPoint(distance);axisStart=draft.Clone();axisPosition=point;axisCapture=id;selectedNode=index;GUIUtility.hotControl=id;e.Use();}
            }
            else if(e.type==EventType.MouseDrag&&axisCapture==id&&GUIUtility.hotControl==id)
            {
                var ray=HandleUtility.GUIPointToWorldRay(e.mousePosition);plane=new Plane(author.transform.up,axisPosition);
                if(plane.Raycast(ray,out float distance)){var delta=author.transform.InverseTransformVector(ray.GetPoint(distance)-planeAnchor);draft=CurveEdits.MoveNode(axisStart,index,axisStart.Nodes[index].X+delta.x,axisStart.Nodes[index].Z+delta.z);Preview();}e.Use();
            }
            else if(e.type==EventType.MouseUp&&e.button==0&&GUIUtility.hotControl==id){GUIUtility.hotControl=0;e.Use();}
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
                int control=GUIUtility.GetControlID(GetInstanceID()^0x1627,FocusType.Passive);
                if(e.type==EventType.Layout)HandleUtility.AddDefaultControl(control);
                if(e.type==EventType.MouseDown&&e.button==0&&GUIUtility.hotControl==0&&Hit(HandleUtility.GUIPointToWorldRay(e.mousePosition),out var point)){BeginDraw(point);if(drawing){drawCapture=control;GUIUtility.hotControl=control;}e.Use();}
                // Capture the real input point, including the final release. A preview cadence
                // may never discard the middle of the authored route.
                if(drawing&&e.type==EventType.MouseDrag&&Hit(HandleUtility.GUIPointToWorldRay(e.mousePosition),out var point2)){DragDraw(point2);lastPreview=EditorApplication.timeSinceStartup;e.Use();view.Repaint();Repaint();}
                if(drawing&&released){if(Hit(HandleUtility.GUIPointToWorldRay(e.mousePosition),out var end))DragDraw(end);EndDraw();e.Use();Repaint();}
                if(drawing&&samples.Count>1){Handles.color=rejectedTail?new Color(1,.35f,.25f):Color.cyan;Handles.DrawAAPolyLine(3,samples.Select(n=>continuing?continuationAuthor.transform.TransformPoint(new Vector3(n.X,n.Y+.03f,n.Z)):drawOrigin+new Vector3(n.X,.03f,n.Z)).ToArray());}
                if(!drawing&&author!=null&&draft!=null&&draft.SchemaVersion==2){var n=draft.Nodes.Last();var p=author.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z));Handles.color=Color.cyan;Handles.DrawWireDisc(p,author.transform.up,.3f);Handles.Label(p+author.transform.up*.3f,"末端 · 可从此续画");}
                return;
            }
            if(author==null||draft==null)return;if(Selection.activeGameObject==null||Selection.activeGameObject.GetComponentInParent<ReplicaAuthor>()!=author){ReleaseAxis();ReleaseTools();return;}AcquireTools();
            Handles.color=new Color(.2f,.85f,.9f);Handles.DrawAAPolyLine(3,draft.Nodes.Select(n=>author.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z))).ToArray());
            for(int i=0;i<draft.Nodes.Count;i++)
            {
                int index=i;var n=draft.Nodes[i];var point=author.transform.TransformPoint(new Vector3(n.X,n.Y+.25f,n.Z));Handles.color=index==selectedNode?Color.yellow:new Color(.6f,.8f,.8f);
                if(draft.SchemaVersion==2){PlanarNode(i,point);point+=author.transform.up*.45f;}
                if(Axis(100+i,point,author.transform.up,.25f,Handles.CubeHandleCap,out float amount)){selectedNode=index;draft=axisStart.Clone();draft.Nodes[index].Y=axisStart.Nodes[index].Y+amount;Preview();}
                if(draft.SchemaVersion!=2||index==selectedNode||i==0||i==draft.Nodes.Count-1)Handles.Label(point+author.transform.up*.2f,index+" · "+n.Y.ToString("0.00")+"m");
            }
            int leg=draft.SchemaVersion==2?-1:MovableLeg(selectedNode);
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
        public override void OnInspectorGUI(){var a=(ReplicaAuthor)target;var d=a.Read();EditorGUILayout.LabelField(d!=null&&d.SchemaVersion==2?"可编辑自由路线":"可编辑正交路线",EditorStyles.boldLabel);EditorGUILayout.LabelField(d==null?"尚未提交":d.Nodes.Count+"节点 / 修订 "+d.Revision);if(GUILayout.Button("打开随笔迹搭桥")){ReplicaWindow.Open();EditorWindow.GetWindow<ReplicaWindow>().Select(a);}}
    }
}
