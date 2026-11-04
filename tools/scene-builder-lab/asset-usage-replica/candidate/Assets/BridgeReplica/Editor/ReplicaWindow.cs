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
        RouteDocument draft,axisStart,continuationStart,workingBase,lastStroke,autoHeightReference;
        ReplicaAuthor continuationAuthor;
        bool builtRounded;
        List<RouteNode> builtHeightKeys;
        string builtNotice;
        readonly List<RouteNode> samples=new List<RouteNode>();
        readonly List<RouteNode> heightKeys=new List<RouteNode>();
        bool drawing,drawMode,ownsTools,oldToolsHidden,continuing,continueArmed,rejectedTail,continuingFromFirst,waitingForLength;
        bool gestureModeLocked,trimExisting,explicitHeight,shiftHeightMode,havePointerMouse,baseHeightEdited;
        RouteNode pointerTail;
        sealed class Port
        {
            public ReplicaAuthor Author;public RouteDocument Document;public bool First;
            public Vector3 Local,World,Outward;
        }
        Port hoverPort;
        string pointerHint;
        Vector3 drawOrigin,axisPosition,axisDirection,planeAnchor,pointerGrabOffset,portOutward;
        Vector2 axisMouse,lastPointerMouse,heightMouseAnchor;
        float heightWorldAnchor;
        int selectedNode,selectedSegment,axisCapture,drawCapture,creationUndoGroup,sourceIndex;
        double lastPreview;
        Vector2 scroll;
        string message="按住左键画出缓弯路线，沿来路回拉裁短；Shift＋上下升降。",drawId,tailReason,trimCutId;
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
            if(drawMode)EditorGUILayout.HelpBox("左键按住画缓弯，沿来路回拉裁短；Shift＋上下鼠标升降端点，松开后继续平面绘制。已有桥端口向外续画，首次向内拖则缩短旧桥；松手更新同一作者，Esc取消本笔。",MessageType.None);
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
                    if(free&&GUILayout.Button("从首尾接着画"))BeginContinueDraw();
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
            FinishGesture();if(author==null||draft==null||draft.SchemaVersion!=2){message="请先选择自由路线，或开启连续绘制并靠近可见桥的首尾端口。";return false;}
            continueArmed=true;drawMode=true;message="从附近可见桥的首尾端口拖画；高亮显示将要接续的作者和端点。";SceneView.RepaintAll();Repaint();return true;
        }
        IEnumerable<Port> Ports()
        {
            foreach(var a in FindObjectsOfType<ReplicaAuthor>())
            {
                if(!a.gameObject.activeInHierarchy||a.Kit==null)continue;RouteDocument doc;try{doc=a.Read();}catch{continue;}if(doc==null||doc.SchemaVersion!=2||doc.Nodes==null||doc.Nodes.Count<2)continue;
                foreach(bool first in new[]{true,false})
                {
                    var n=first?doc.Nodes[0]:doc.Nodes[doc.Nodes.Count-1];var adjacent=first?doc.Nodes[1]:doc.Nodes[doc.Nodes.Count-2];
                    if(n==null||adjacent==null)continue;var outward=new Vector3(n.X-adjacent.X,0,n.Z-adjacent.Z);if(float.IsNaN(outward.sqrMagnitude)||float.IsInfinity(outward.sqrMagnitude)||outward.sqrMagnitude<.00001f)continue;outward.Normalize();
                    var local=new Vector3(n.X,n.Y,n.Z);yield return new Port{Author=a,Document=doc,First=first,Local=local,World=a.transform.TransformPoint(local),Outward=outward};
                }
            }
        }
        static bool InPortFace(Port port,Vector3 world,out float score,bool allowHeight=false)
        {
            var delta=port.Author.transform.InverseTransformPoint(world)-port.Local;float along=Vector3.Dot(delta,port.Outward);
            var side=new Vector3(-port.Outward.z,0,port.Outward.x);float across=Vector3.Dot(delta,side);
            score=Mathf.Abs(along)+Mathf.Max(0,Mathf.Abs(across)-port.Document.Width*.5f)+Mathf.Abs(across)*.02f;
            return along>=-.6f&&along<=.85f&&Mathf.Abs(across)<=port.Document.Width*.5f+.35f&&(allowHeight||Mathf.Abs(delta.y)<=.75f);
        }
        static float ScreenSegmentDistance(Vector2 p,Vector2 a,Vector2 b)
        {var delta=b-a;float t=delta.sqrMagnitude<.0001f?0:Mathf.Clamp01(Vector2.Dot(p-a,delta)/delta.sqrMagnitude);return Vector2.Distance(p,a+delta*t);}
        Port PickPort(Vector3 world)
        {
            Port best=null;float score=float.MaxValue;
            foreach(var p in Ports())if(InPortFace(p,world,out float distance))
            {distance+=p.Author==author?0:.0001f;if(distance<score){best=p;score=distance;}}
            return best;
        }
        Port PickPort(Ray ray)
        {
            Port best=null;float score=float.MaxValue;var scene=SceneView.currentDrawingSceneView;var camera=scene==null?null:scene.camera;
            bool blocked=Physics.Raycast(ray,out var front,500);
            foreach(var p in Ports())
            {
                if(camera!=null){var view=camera.WorldToViewportPoint(p.World);if(view.z<=0||view.x<-.1f||view.x>1.1f||view.y<-.1f||view.y>1.1f)continue;}
                var plane=new Plane(p.Author.transform.up,p.World);if(!plane.Raycast(ray,out float distance))continue;
                if(blocked&&front.distance<distance-.3f&&front.collider.GetComponentInParent<ReplicaAuthor>()!=p.Author)continue;
                bool face=InPortFace(p,ray.GetPoint(distance),out float candidate,true);
                float pixels=float.MaxValue;
                if(Event.current!=null&&camera!=null)
                {
                    var side=p.Author.transform.TransformDirection(new Vector3(-p.Outward.z,0,p.Outward.x))*p.Document.Width*.5f;
                    pixels=ScreenSegmentDistance(Event.current.mousePosition,HandleUtility.WorldToGUIPoint(p.World-side),HandleUtility.WorldToGUIPoint(p.World+side));
                }
                if(!face&&pixels>14)continue;
                candidate=(face?candidate:1)+Mathf.Min(pixels,1000)*.001f+(p.Author==author?0:.0001f);
                if(candidate<score){best=p;score=candidate;}
            }
            return best;
        }
        string PortLabel(Port port){return port.Author.name+" · "+(port.First?"首端":"尾端");}
        void ShowPort(Port port)
        {hoverPort=port;pointerHint=port==null?null:"接续 "+PortLabel(port)+"｜左键拖动，更新同一座桥";}
        static ReplicaAuthor SurfaceAuthor(Vector3 point)
        {
            foreach(var hit in Physics.RaycastAll(new Ray(point+Vector3.up*.3f,Vector3.down),.65f))
            {var a=hit.collider.GetComponentInParent<ReplicaAuthor>();if(a!=null)return a;}return null;
        }
        bool TryPressHit(Ray ray,out Vector3 point,out Port port)
        {
            port=PickPort(ray);ShowPort(port);
            if(port!=null)
            {
                var plane=new Plane(port.Author.transform.up,port.World);
                if(plane.Raycast(ray,out float distance)){point=ray.GetPoint(distance);return true;}
                point=Vector3.zero;return false;
            }
            if(Physics.Raycast(ray,out var hit,500))
            {
                var bridge=hit.collider.GetComponentInParent<ReplicaAuthor>();
                if(bridge!=null){pointerHint="此处是桥身；请从高亮的首尾端面接续，不会新建重叠桥段。";if(Event.current!=null&&Event.current.type==EventType.MouseDown)message=pointerHint;point=hit.point;return false;}
                point=hit.point;return true;
            }
            var ground=new Plane(Vector3.up,Vector3.zero);
            if(ground.Raycast(ray,out float depth)){point=ray.GetPoint(depth);return true;}point=Vector3.zero;return false;
        }
        bool Hit(Ray ray,out Vector3 point)
        {
            if(!drawing)
            {
                Port port;bool hit=TryPressHit(ray,out point,out port);
                // Hover and read-only callers display the snapped endpoint.
                // The press path below also retains the actual pointer plane
                // point, rather than throwing away its grab displacement.
                if(hit&&port!=null)point=port.World;return hit;
            }
            var normal=continuing&&continuationAuthor!=null?continuationAuthor.transform.up:Vector3.up;
            var plane=new Plane(normal,drawing?drawOrigin:Vector3.zero);if(plane.Raycast(ray,out float distance)){point=ray.GetPoint(distance);return true;}point=Vector3.zero;return false;
        }
        public void BeginDraw(Vector3 point)
        {
            BeginDraw(point,PickPort(point));
        }
        void BeginDraw(Vector3 point,Port port)
        {
            bool requested=continueArmed;var kit=port==null?(draftKit??ReplicaKitRegistry.EnsureBase()):port.Author.Kit;
            var body=port==null?SurfaceAuthor(point):null;
            CancelInput();
            if(port==null&&(requested||body!=null)){continueArmed=requested;message=body!=null?"此处是桥身；请从首尾端面接续，不会另建重叠桥段。":"请从高亮的首尾端面起笔；现有桥保持不变。";pointerHint=message;return;}
            if(port!=null)Select(port.Author);
            drawing=true;rejectedTail=false;tailReason=null;drawingKit=kit;drawOrigin=port==null?point:port.World;drawId=port==null?Guid.NewGuid().ToString("N"):port.Document.Id;samples.Clear();
            // The user can grab any position on the endpoint face. Keep that
            // single world-space displacement for the whole gesture so the
            // first tiny movement is not an artificial sideward sharp corner.
            // InverseTransformPoint below handles the author's local frame.
            pointerGrabOffset=port==null?Vector3.zero:port.World-point;
            trimCutId="cut-"+Guid.NewGuid().ToString("N");
            if(port!=null)
            {
                continuing=true;continuingFromFirst=port.First;continuationAuthor=port.Author;continuationStart=port.Document.Clone();workingBase=continuationStart.Clone();
                var endpoint=port.First?continuationStart.Nodes.First():continuationStart.Nodes.Last();var adjacent=port.First?continuationStart.Nodes[1]:continuationStart.Nodes[continuationStart.Nodes.Count-2];portOutward=new Vector3(endpoint.X-adjacent.X,0,endpoint.Z-adjacent.Z).normalized;
                samples.Add((port.First?continuationStart.Nodes.First():continuationStart.Nodes.Last()).Clone());
                message="正在接续 "+PortLabel(port)+"；保持同一作者和其素材套件。";pointerHint=message;
            }
            else
            {samples.Add(new RouteNode{Id="s0",X=0,Y=0,Z=0});Undo.IncrementCurrentGroup();creationUndoGroup=Undo.GetCurrentGroup();message="随笔迹搭桥中；长度达到0.5米开始显示结构。";}
        }
        public bool DragDraw(Vector3 point)
        {
            if(!drawing)return false;autoHeightReference=null;var local=continuing?continuationAuthor.transform.InverseTransformPoint(point+pointerGrabOffset):point+pointerGrabOffset-drawOrigin;float height=continuing?(continuingFromFirst?workingBase.Nodes.First().Y:workingBase.Nodes.Last().Y):0;var sample=new RouteNode{Id="s"+samples.Count,X=local.x,Y=height,Z=local.z};
            pointerTail=sample;waitingForLength=false;
            float tolerance=Mathf.Min(.35f,(continuing?continuationStart.Width:2)*.2f);
            if(continuing&&!gestureModeLocked)
            {
                var origin=samples[0];var delta=new Vector3(sample.X-origin.X,0,sample.Z-origin.Z);
                if(delta.magnitude>.15f)
                {
                    float arc;RouteNode foot;float distance=CurveGesture.Project(continuationStart,sample,out arc,out foot);
                    trimExisting=Vector3.Dot(delta,portOutward)<-.1f&&distance<=tolerance;gestureModeLocked=true;
                }
            }
            if(trimExisting)return PreviewTrim(sample,tolerance);
            // A fast return may skip over the original anchor. Clamp that
            // gesture there; extending and shortening the saved bridge are
            // deliberately different intentions, locked at its first movement.
            if(samples.Count>1)
            {
                var origin=samples[0];var next=samples[1];var direction=new Vector3(next.X-origin.X,0,next.Z-origin.Z).normalized;var delta=new Vector3(sample.X-origin.X,0,sample.Z-origin.Z);
                bool behind=Vector3.Dot(delta,direction)<0;bool close=false;
                if(behind&&continuing){float arc;RouteNode foot;close=CurveGesture.Project(continuationStart,sample,out arc,out foot)<=tolerance;}
                else if(behind)close=(delta-direction*Vector3.Dot(delta,direction)).magnitude<=tolerance;
                if(behind&&close)sample=origin.Clone();
            }
            List<RouteNode> trimmed;
            if(samples.Count>1&&CurveGesture.TryRetract(samples,sample,tolerance,out trimmed))return PreviewRetraction(trimmed);
            var last=samples[samples.Count-1];
            if(Mathf.Abs(last.X-sample.X)+Mathf.Abs(last.Z-sample.Z)<=.00001f)
            {
                bool valid=continuing?ReplicaSession.Get(continuationAuthor).HasCandidate:scratch!=null&&ReplicaSession.Get(scratch).HasCandidate;
                rejectedTail=false;tailReason=null;message=valid?"已回到有效端点，可以继续向前画；松手采用青色范围。":"继续向外拖至0.5米后显示桥体。";return valid;
            }
            // Only accepted input belongs to the active prefix. A temporary
            // invalid pointer excursion must not poison every later candidate.
            var attempt=new List<RouteNode>(samples);attempt.Add(sample);
            if(StrokeLength(attempt)<.5f)
            {waitingForLength=true;rejectedTail=false;tailReason=null;message="再向外拖一点：达到0.5米后显示桥体。";return false;}
            try
            {
                var doc=BuildStroke(attempt,explicitHeight?heightKeys:null);
                if(!PreviewStroke(doc))return false;AcceptBuiltStroke(doc,attempt,explicitHeight?heightKeys:null);return true;
            }catch(Exception e){SetDrawingStatus(false,e.Message);return false;}
        }
        static float StrokeLength(IList<RouteNode> nodes)
        {float length=0;for(int i=1;i<nodes.Count;i++)length+=Vector2.Distance(new Vector2(nodes[i-1].X,nodes[i-1].Z),new Vector2(nodes[i].X,nodes[i].Z));return length;}
        RouteDocument BuildStroke(List<RouteNode> input,List<RouteNode> keys)
        {
            var doc=CurveBrush.Build(input,keys!=null||continuing?0:newHeight,continuing?continuationStart.Width:2,keys,out builtRounded,out builtHeightKeys,out builtNotice);doc.Id=drawId;
            if(keys==null&&continuing){float y=continuingFromFirst?workingBase.Nodes.First().Y:workingBase.Nodes.Last().Y;foreach(var n in doc.Nodes)n.Y=y;}
            return doc;
        }
        void AcceptBuiltStroke(RouteDocument doc,List<RouteNode> input,List<RouteNode> keys)
        {
            // After a design corner was adopted, its visible centreline is
            // the accepted trail. Retracing must follow that arc, not the
            // now-replaced sharp pointer corner behind it.
            var accepted=(builtRounded?doc.Nodes:input).Select(n=>n.Clone()).ToArray();
            var mapped=keys==null?null:(builtHeightKeys??keys).Select(n=>n.Clone()).ToArray();
            samples.Clear();samples.AddRange(accepted);lastStroke=doc;
            if(mapped!=null){heightKeys.Clear();heightKeys.AddRange(mapped);}
            if(builtRounded){pointerTail=doc.Nodes.Last().Clone();message=builtNotice+" 青色圆弧为本次实际采用的路线。";}
        }
        bool PreviewStroke(RouteDocument stroke)
        {
            if(continuing)
            {
                var candidate=continuingFromFirst?CurveEdits.PrependStroke(workingBase,stroke.Nodes):CurveEdits.AppendStroke(workingBase,stroke.Nodes);
                bool valid=ReplicaSession.Get(continuationAuthor).Preview(candidate,drawingKit);if(valid)draft=candidate;SetDrawingStatus(valid,ReplicaSession.Get(continuationAuthor).Status);
                if(!valid&&ReplicaSession.Get(continuationAuthor).Status.Contains("转向过急"))
                {tailReason="旧桥接头转向过大；请先沿原桥方向延长，再在新笔里转弯。";message="当前尾段暂不采用；"+tailReason;}
                return valid;
            }
            if(scratch==null){var go=new GameObject("路线候选");go.hideFlags=HideFlags.DontSave;go.transform.position=drawOrigin;scratch=go.AddComponent<ReplicaAuthor>();}
            var session=ReplicaSession.Get(scratch);bool ok=session.Preview(stroke,drawingKit);SetDrawingStatus(ok,session.Status);return ok;
        }
        bool PreviewRetraction(List<RouteNode> trimmed)
        {
            if(StrokeLength(trimmed)<.5f)
            {
                if(continuing)
                {
                    var session=ReplicaSession.Get(continuationAuthor);session.Cancel();draft=workingBase.Clone();
                    if(baseHeightEdited&&!session.Preview(workingBase,drawingKit)){SetDrawingStatus(false,session.Status);return false;}
                }
                if(scratch!=null){ReplicaSession.Get(scratch).Cancel();ReplicaGeometry.Destroy(scratch.gameObject);scratch=null;}
                samples.Clear();samples.AddRange(trimmed);lastStroke=null;autoHeightReference=null;heightKeys.Clear();explicitHeight=false;rejectedTail=false;tailReason=null;waitingForLength=true;
                message=baseHeightEdited?"新增桥段已全部回拉；本笔已调整的旧端点高度仍保留，松手采用，Esc取消。":"本笔已回拉到起点附近，未保留较远桥段；向外重画，松手保持原作品。";return false;
            }
            try
            {
                List<RouteNode> keys=null;
                if(explicitHeight&&lastStroke!=null)
                {
                    float arc;RouteNode foot;CurveGesture.Project(lastStroke,trimmed.Last(),out arc,out foot);
                    keys=CurveGesture.ProfileKeys(CurveGesture.TrimAuthor(lastStroke,false,arc,trimCutId));
                }
                var doc=BuildStroke(trimmed,keys);
                if(!PreviewStroke(doc))return false;AcceptBuiltStroke(doc,trimmed,keys);return true;
            }catch(Exception e){SetDrawingStatus(false,e.Message);return false;}
        }
        bool PreviewTrim(RouteNode sample,float tolerance)
        {
            try
            {
                float arc;RouteNode foot;float distance=CurveGesture.Project(continuationStart,sample,out arc,out foot);
                if(distance>tolerance){SetDrawingStatus(false,"沿已有桥面向端口方向回拉，才能缩短旧桥。");return false;}
                float total=StrokeLength(continuationStart.Nodes),origin=continuingFromFirst?0:total;
                if(Mathf.Abs(arc-origin)<.0001f){ReplicaSession.Get(continuationAuthor).Cancel();draft=continuationStart.Clone();rejectedTail=false;tailReason=null;message="已恢复原端点；松手不修改旧桥。";return false;}
                var candidate=CurveGesture.TrimAuthor(continuationStart,continuingFromFirst,arc,trimCutId);
                bool valid=ReplicaSession.Get(continuationAuthor).Preview(candidate,drawingKit);if(valid){draft=candidate;pointerTail=foot;}
                SetDrawingStatus(valid,ReplicaSession.Get(continuationAuthor).Status);if(valid)message="正在缩短已有桥；松手采用，Esc恢复原桥。";return valid;
            }catch(Exception e){SetDrawingStatus(false,e.Message);return false;}
        }
        Vector3 DrawTipWorld()
        {
            RouteNode tip;
            if(trimExisting&&draft!=null)tip=continuingFromFirst?draft.Nodes.First():draft.Nodes.Last();
            else tip=lastStroke!=null?lastStroke.Nodes.Last():samples.LastOrDefault();
            if(tip==null)return drawOrigin;var local=new Vector3(tip.X,tip.Y,tip.Z);return continuing?continuationAuthor.transform.TransformPoint(local):drawOrigin+local;
        }
        public bool SetDrawHeight(float targetWorldY)
        {
            if(!drawing||trimExisting){message="先开始绘制或抓住已有端点；缩短旧桥时保持原有高度。";return false;}
            if(lastStroke==null||StrokeLength(lastStroke.Nodes)<.5f)
            {
                if(CanEditBaseHeight())return SetBaseHeight(targetWorldY);
                message="当前新笔不足0.5米，还没有新桥候选；先向外拉长。要直接升降旧桥，请松手后重新抓住端点按Shift。";return false;
            }
            var tip=lastStroke.Nodes.Last().Clone();float y=LocalHeight(targetWorldY);
            if(float.IsNaN(y)||float.IsInfinity(y)){SetDrawingStatus(false,"端点高度须为有限数字。");return false;}
            tip.Y=Snap(y,.25f);pointerTail=tip;waitingForLength=false;
            if(tip.Y<0||tip.Y>8){SetDrawingStatus(false,"端点高度须在作者局部0—8米范围内。");return false;}
            try
            {
                var reference=autoHeightReference??(!explicitHeight?lastStroke:null);
                var keys=reference!=null?EnvelopeHeightKeys(reference,tip.Y):EditableHeightKeys();
                if(reference==null)keys.Add(tip);
                var doc=BuildStroke(samples,keys);if(!PreviewStroke(doc))return false;
                if(reference!=null&&autoHeightReference==null)autoHeightReference=reference.Clone();
                explicitHeight=true;AcceptBuiltStroke(doc,samples,keys);pointerTail=doc.Nodes.Last().Clone();message="Shift升降端点："+DrawTipWorld().y.ToString("0.00")+"米；松开Shift继续平面绘制。";return true;
            }catch(Exception e){SetDrawingStatus(false,e.Message);return false;}
        }
        float LocalHeight(float worldY)
        {var world=DrawTipWorld();world.y=worldY;return continuing?continuationAuthor.transform.InverseTransformPoint(world).y:worldY-drawOrigin.y;}
        float WorldHeight(float localY)
        {
            if(!continuing)return drawOrigin.y+localY;
            var local=continuationAuthor.transform.InverseTransformPoint(DrawTipWorld());local.y=localY;return continuationAuthor.transform.TransformPoint(local).y;
        }
        bool CanEditBaseHeight()
        {
            if(!continuing||workingBase==null||trimExisting||lastStroke!=null||samples.Count==0)return false;
            return pointerTail==null||Vector2.Distance(new Vector2(pointerTail.X,pointerTail.Z),new Vector2(samples[0].X,samples[0].Z))<=.15f;
        }
        List<RouteNode> EditableHeightKeys()
        {
            // The first phase can use the complete new stroke. Once planar
            // drawing resumes, completed height anchors stay fixed and only
            // the new tail after the final anchor remains adjustable.
            var keys=explicitHeight?heightKeys.Select(n=>n.Clone()).ToList():new List<RouteNode>{lastStroke.Nodes.First().Clone()};
            var tip=lastStroke.Nodes.Last();
            if(keys.Count>1&&Vector2.Distance(new Vector2(keys.Last().X,keys.Last().Z),new Vector2(tip.X,tip.Z))<.0001f)keys.RemoveAt(keys.Count-1);
            return keys;
        }
        static List<RouteNode> EnvelopeHeightKeys(RouteDocument reference,float target)
        {
            float length=StrokeLength(reference.Nodes),start=reference.Nodes.First().Y,arc=0;bool raise=target>=reference.Nodes.Last().Y;
            var profile=reference.Clone();profile.Nodes.Clear();
            Func<float,float> ramp=a=>start+(target-start)*a/length;
            for(int i=0;i<reference.Nodes.Count;i++)
            {
                var node=reference.Nodes[i].Clone();float line=ramp(arc);node.Y=raise?Mathf.Max(node.Y,line):Mathf.Min(node.Y,line);profile.Nodes.Add(node);
                if(i==reference.Nodes.Count-1)break;
                var a=reference.Nodes[i];var b=reference.Nodes[i+1];float run=Vector2.Distance(new Vector2(a.X,a.Z),new Vector2(b.X,b.Z));
                float da=a.Y-ramp(arc),db=b.Y-ramp(arc+run);
                if((da>.00001f&&db<-.00001f)||(da<-.00001f&&db>.00001f))
                {
                    float t=da/(da-db),distance=run*t;
                    // Near-coincident automatic/ramp crossings must not create
                    // sub-minimum solver spans. The neighbouring envelope
                    // endpoints retain the raised/lowered side of the source
                    // profile; joining them also preserves its slope bound.
                    if(distance>=.00501f&&run-distance>=.00501f)
                        profile.Nodes.Add(new RouteNode{Id="envelope-"+i,X=a.X+(b.X-a.X)*t,Y=ramp(arc+distance),Z=a.Z+(b.Z-a.Z)*t});
                }
                arc+=run;
            }
            return CurveGesture.ProfileKeys(profile);
        }
        bool BaseEndpointHasOpening()
        {
            int i=continuingFromFirst?0:workingBase.Nodes.Count-2;
            string span=RouteDocument.GetSegmentId(workingBase.Nodes[i].Id,workingBase.Nodes[i+1].Id);
            return workingBase.Openings.Any(o=>o.Enabled&&o.SegmentId==span);
        }
        bool SetBaseHeight(float targetWorldY)
        {
            int index=continuingFromFirst?0:workingBase.Nodes.Count-1;var tip=workingBase.Nodes[index].Clone();float y=LocalHeight(targetWorldY);
            if(float.IsNaN(y)||float.IsInfinity(y)){SetDrawingStatus(false,"端点高度须为有限数字。");return false;}
            tip.Y=Snap(y,.25f);pointerTail=tip;waitingForLength=false;
            if(tip.Y<0||tip.Y>8){SetDrawingStatus(false,"端点高度须在作者局部0—8米范围内。");return false;}
            if(Mathf.Abs(tip.Y-workingBase.Nodes[index].Y)<.00001f){rejectedTail=false;tailReason=null;message="已有端点高度未变化；继续按Shift上下调整，松手采用。";return true;}
            if(BaseEndpointHasOpening()){SetDrawingStatus(false,"端点所在路段有启用桥洞，需要保留完整水平路段；先向外加新桥段，再升降新端点。");return false;}
            var candidate=workingBase.Clone();candidate.Nodes[index].Y=tip.Y;
            var session=ReplicaSession.Get(continuationAuthor);
            if(!session.Preview(candidate,drawingKit)){SetDrawingStatus(false,session.Status);return false;}
            workingBase=candidate;draft=candidate;int originalIndex=continuingFromFirst?0:continuationStart.Nodes.Count-1;
            baseHeightEdited=Mathf.Abs(tip.Y-continuationStart.Nodes[originalIndex].Y)>.00001f;
            if(!baseHeightEdited)session.Cancel();
            samples.Clear();samples.Add(tip.Clone());gestureModeLocked=true;trimExisting=false;rejectedTail=false;tailReason=null;
            message="正在升降已有端点："+DrawTipWorld().y.ToString("0.00")+"米；其余旧节点保持，松手采用，Esc取消。";return true;
        }
        bool HeightLimits(out float minimum,out float maximum,out string reason)
        {
            minimum=maximum=0;reason=null;
            if(!drawing||trimExisting){reason="缩短旧桥时保持原高度；请松手后重新抓端点按Shift升降。";return false;}
            if(lastStroke==null||StrokeLength(lastStroke.Nodes)<.5f)
            {
                if(!CanEditBaseHeight()){reason="当前新笔不足0.5米，还没有新桥候选；先向外拉长。要升降已有端点，请松手后重新抓端点按Shift。";return false;}
                int index=continuingFromFirst?0:workingBase.Nodes.Count-1,other=continuingFromFirst?1:index-1;
                var tip=workingBase.Nodes[index];var adjacent=workingBase.Nodes[other];
                if(BaseEndpointHasOpening()){minimum=maximum=tip.Y;reason="该端点所在路段有启用桥洞，必须保持水平；先向外加新桥段再升降。";return true;}
                float run=Vector2.Distance(new Vector2(tip.X,tip.Z),new Vector2(adjacent.X,adjacent.Z));
                minimum=Mathf.Max(0,adjacent.Y-run*.5f);maximum=Mathf.Min(8,adjacent.Y+run*.5f);return true;
            }
            var keys=autoHeightReference!=null?new List<RouteNode>{autoHeightReference.Nodes.First().Clone()}:EditableHeightKeys();var anchor=keys.Last();float anchorArc;RouteNode foot;
            CurveGesture.Project(lastStroke,anchor,out anchorArc,out foot);
            float remaining=Mathf.Max(0,StrokeLength(lastStroke.Nodes)-anchorArc);
            minimum=Mathf.Max(0,anchor.Y-remaining*.5f);maximum=Mathf.Min(8,anchor.Y+remaining*.5f);return true;
        }
        void HeightDrag(Vector2 mouse)
        {
            if(!shiftHeightMode){shiftHeightMode=true;heightMouseAnchor=havePointerMouse?lastPointerMouse:mouse;heightWorldAnchor=DrawTipWorld().y;}
            float minimum,maximum;string reason;
            if(!HeightLimits(out minimum,out maximum,out reason)){message=reason;lastPointerMouse=mouse;havePointerMouse=true;return;}
            float low=Mathf.Ceil(minimum/.25f-.00001f)*.25f,high=Mathf.Floor(maximum/.25f+.00001f)*.25f;
            string range="可调 "+WorldHeight(low).ToString("0.00")+"—"+WorldHeight(high).ToString("0.00")+"米";
            if(low>high+.00001f){message="当前位置没有可用的0.25米高度格；先加长这一段桥。"+(reason??"");lastPointerMouse=mouse;havePointerMouse=true;return;}
            float requested=LocalHeight(heightWorldAnchor+(heightMouseAnchor.y-mouse.y)*(.25f/12));
            float snapped=Snap(requested,.25f),target=Mathf.Clamp(snapped,low,high);bool limited=Mathf.Abs(target-snapped)>.00001f;
            float current=LocalHeight(DrawTipWorld().y);
            // Human input advances to the feasible boundary. The public API
            // remains strict; a rejected physical/asset constraint still keeps
            // its preceding real candidate unchanged.
            bool accepted=Mathf.Abs(target-current)<.00001f||SetDrawHeight(WorldHeight(target));
            if(accepted)
            {
                rejectedTail=false;tailReason=null;waitingForLength=false;
                pointerTail=(lastStroke!=null?lastStroke.Nodes.Last():continuing?(continuingFromFirst?workingBase.Nodes.First():workingBase.Nodes.Last()):samples.Last()).Clone();
                string mode=lastStroke==null&&continuing?"已有端点高度 ":"新笔端点高度 ";
                message=mode+DrawTipWorld().y.ToString("0.00")+"米；"+range;
                if(limited)message+=target<=.00001f&&requested<0?"（已到最低边界0米）":target>=7.99999f&&requested>8?"（已到当前最高边界8米）":"（已限制到该段可达高度；继续升降请先加长这一段桥）";
                else message+="；松开Shift继续平面绘制。";
                if(reason!=null)message+=" "+reason;
                if(high-low<.24999f&&reason==null)message+=" 当前可达变化不足一格，请先加长这一段桥。";
                if(limited){heightMouseAnchor=mouse;heightWorldAnchor=DrawTipWorld().y;}
            }
            else message+=" "+range+"；实际高度仍为"+DrawTipWorld().y.ToString("0.00")+"米。";
            lastPointerMouse=mouse;havePointerMouse=true;
        }
        void ClearGestureDetails()
        {lastStroke=null;workingBase=null;autoHeightReference=null;heightKeys.Clear();explicitHeight=false;gestureModeLocked=false;trimExisting=false;shiftHeightMode=false;havePointerMouse=false;baseHeightEdited=false;trimCutId=null;}
        void SetDrawingStatus(bool valid,string detail)
        {
            rejectedTail=!valid;tailReason=null;
            if(valid){message="青色范围可采用；继续绘制，松手更新同一条路线。";return;}
            string reason=detail;
            if(detail.Contains("转向过急")||detail.Contains("内侧空间不足")||detail.Contains("内侧折叠"))reason="这里转弯空间不足，请从青色端点向前走一段再转。";
            else if(detail.Contains("过陡"))reason="当前升降过陡；先加长这一段桥，再调整端点高度。";
            else if(detail.Contains("自交")||detail.Contains("折回")||detail.Contains("边界"))reason="当前尾段发生折回或交叠，请回到青色端点换个方向。";
            else if(detail.Contains("过近"))reason="当前尾段离已有桥面太近，请拉开间距。";
            tailReason=reason;message="红色尾段暂不采用；"+reason+" 松手保留已生成部分，Esc取消本笔。";
        }
        public bool EndDraw()
        {
            if(!drawing)return false;bool shortStroke=waitingForLength;ReleaseDraw();drawing=false;pointerGrabOffset=Vector3.zero;pointerTail=null;waitingForLength=false;ClearGestureDetails();
            if(continuing)
            {
                var target=continuationAuthor;bool ok=ReplicaSession.Get(target).Apply();message=rejectedTail?(ok?"已采用最后有效范围；末段未纳入：":"本笔未采用，已有桥保持；原因：")+tailReason:ReplicaSession.Get(target).Status;
                if(!ok&&!rejectedTail)message=shortStroke?"本笔不足0.5米，未新增桥段；已有桥保持。":"本笔没有新增有效部分，已有桥保持。";
                if(!ok)ReplicaSession.Get(target).Cancel();continuing=false;continuingFromFirst=false;continueArmed=false;continuationStart=null;continuationAuthor=null;pointerHint=null;samples.Clear();Select(target);return ok;
            }
            if(scratch==null){if(shortStroke)message="本笔不足0.5米，未新增桥段。";samples.Clear();return false;}var a=scratch;scratch=null;var s=ReplicaSession.Get(a);
            if(!s.ApplyNew()){message=s.Status;ReplicaGeometry.Destroy(a.gameObject);samples.Clear();return false;}a.name="随笔迹桥_路线作者";a.gameObject.hideFlags=HideFlags.None;Undo.RegisterCreatedObjectUndo(a.gameObject,"连续绘制一条路线");Undo.CollapseUndoOperations(creationUndoGroup);samples.Clear();Select(a);message=rejectedTail?"已采用最后有效范围；末段未纳入："+tailReason:s.Status;return true;
        }
        void ReleaseDraw(){if(drawCapture!=0&&GUIUtility.hotControl==drawCapture)GUIUtility.hotControl=0;drawCapture=0;}
        void ReleaseAxis(){if(axisCapture!=0&&GUIUtility.hotControl==axisCapture)GUIUtility.hotControl=0;axisCapture=0;axisStart=null;}
        public void CancelInput(){ReleaseAxis();ReleaseDraw();if(scratch!=null){ReplicaSession.Get(scratch).Cancel();ReplicaGeometry.Destroy(scratch.gameObject);scratch=null;}if(continuationAuthor!=null)ReplicaSession.Get(continuationAuthor).Cancel();drawing=false;continuing=false;continuingFromFirst=false;continueArmed=false;rejectedTail=false;waitingForLength=false;pointerTail=null;tailReason=null;continuationStart=null;continuationAuthor=null;drawingKit=null;hoverPort=null;pointerHint=null;pointerGrabOffset=Vector3.zero;samples.Clear();ClearGestureDetails();if(author!=null){ReplicaSession.Get(author).Cancel();ReloadDraft();}SceneView.RepaintAll();Repaint();}
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
        void PortFeedback(SceneView view)
        {
            if(!drawing)
            foreach(var port in Ports())
            {
                bool hot=hoverPort!=null&&hoverPort.Author==port.Author&&hoverPort.First==port.First;
                if(!hot&&port.Author!=author)continue;
                var side=port.Author.transform.TransformDirection(new Vector3(-port.Outward.z,0,port.Outward.x))*port.Document.Width*.5f;
                Handles.color=hot?new Color(.1f,1,.85f):new Color(.4f,.7f,.75f);
                Handles.DrawAAPolyLine(hot?6:3,port.World-side,port.World+side);Handles.DrawWireDisc(port.World,port.Author.transform.up,.2f);
                if(hot)Handles.Label(port.World+port.Author.transform.up*.35f,"接续 "+PortLabel(port));
            }
            string state;
            if(drawing)
            {
                string heading=continuing?(trimExisting?"正在缩短 ":lastStroke==null&&shiftHeightMode?"正在升降已有端点 ":"正在接续 ")+continuationAuthor.name+" · "+(continuingFromFirst?"首端":"尾端"):"正在绘制新桥";
                state=heading+"\n"+message;
            }
            else state=string.IsNullOrEmpty(pointerHint)||pointerHint==message?message:pointerHint+"\n"+message;
            if(string.IsNullOrEmpty(state))return;
            Handles.BeginGUI();GUI.Box(new Rect(12,12,Mathf.Clamp(view.position.width-32,220,680),drawing?94:52),state,EditorStyles.helpBox);Handles.EndGUI();
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
                if(!drawing&&(e.type==EventType.MouseMove||e.type==EventType.Repaint))
                {Hit(HandleUtility.GUIPointToWorldRay(e.mousePosition),out var unused);if(e.type==EventType.MouseMove)view.Repaint();}
                if(e.type==EventType.MouseDown&&e.button==0&&GUIUtility.hotControl==0&&TryPressHit(HandleUtility.GUIPointToWorldRay(e.mousePosition),out var point,out var pressedPort)){BeginDraw(point,pressedPort);if(drawing){drawCapture=control;GUIUtility.hotControl=control;lastPointerMouse=e.mousePosition;havePointerMouse=true;}e.Use();}
                // Capture the real input point, including the final release. A preview cadence
                // may never discard the middle of the authored route.
                if(drawing&&e.type==EventType.MouseDrag)
                {
                    if(e.shift)HeightDrag(e.mousePosition);
                    else if(Hit(HandleUtility.GUIPointToWorldRay(e.mousePosition),out var point2))
                    {
                        if(shiftHeightMode){shiftHeightMode=false;pointerGrabOffset=DrawTipWorld()-point2;}
                        DragDraw(point2);lastPointerMouse=e.mousePosition;havePointerMouse=true;
                    }
                    lastPreview=EditorApplication.timeSinceStartup;e.Use();view.Repaint();Repaint();
                }
                if(drawing&&released)
                {
                    if(e.shift)HeightDrag(e.mousePosition);
                    else if(!shiftHeightMode&&Hit(HandleUtility.GUIPointToWorldRay(e.mousePosition),out var end))DragDraw(end);
                    EndDraw();e.Use();Repaint();
                }
                if(drawing&&samples.Count>0)
                {
                    Func<RouteNode,Vector3> world=n=>continuing?continuationAuthor.transform.TransformPoint(new Vector3(n.X,n.Y+.03f,n.Z)):drawOrigin+new Vector3(n.X,n.Y+.03f,n.Z);
                    var guide=trimExisting&&draft!=null?draft.Nodes:lastStroke!=null?lastStroke.Nodes:samples;
                    Handles.color=Color.cyan;if(guide.Count>1)Handles.DrawAAPolyLine(3,guide.Select(world).ToArray());
                    var tip=DrawTipWorld()+(continuing?continuationAuthor.transform.up:Vector3.up)*.03f;Handles.DrawWireDisc(tip,continuing?continuationAuthor.transform.up:Vector3.up,HandleUtility.GetHandleSize(tip)*.06f);
                    if(shiftHeightMode)Handles.Label(tip+Vector3.up*.2f,"Shift高度 "+DrawTipWorld().y.ToString("0.00")+"米");
                    if(pointerTail!=null&&(rejectedTail||waitingForLength))
                    {Handles.color=waitingForLength?Color.yellow:new Color(1,.35f,.25f);Handles.DrawAAPolyLine(3,tip,world(pointerTail));if(rejectedTail)Handles.Label(tip,"回到这里继续画");}
                }
                PortFeedback(view);
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
