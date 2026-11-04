using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.BridgeReplica.Editor;

namespace XingHai.BridgeReplica.QA
{
    // Catches the user's actual disconnect symptom, rather than only extending
    // an exact, selected last endpoint along its previous tangent. API and real
    // SceneGUI hit/event paths are explicitly separated. No physical input.
    public static class ContinuationRegressionQa
    {
        [Serializable] sealed class PointFact
        {public string label;public Vector3 pointerWorld,resolvedWorld;public float endpointHorizontalError,pixelDistance;public bool hit;}
        [Serializable] sealed class Check
        {public string name,level,status="PASS",error,statusText;public int authorsBefore,authorsAfter;public Vector3 actualPressPlane,actualReleasePlane;public List<PointFact> hits=new List<PointFact>();}
        [Serializable] sealed class Report
        {
            public string status="FAIL",engine=Application.unityVersion;
            public string scope="Actual Window API plus synthetic events inside real SceneView callbacks. Tests natural endpoint use; not a physical mouse test or original-game evidence.";
            public bool physicalInput=false;public List<Check> checks=new List<Check>();
        }
        static readonly BindingFlags Hidden=BindingFlags.Instance|BindingFlags.NonPublic;
        static readonly MethodInfo SceneGui=typeof(ReplicaWindow).GetMethod("SceneGUI",Hidden);
        static readonly MethodInfo HitMethod=typeof(ReplicaWindow).GetMethod("Hit",Hidden);
        static readonly FieldInfo CurrentAuthor=typeof(ReplicaWindow).GetField("author",Hidden);
        static Report report;
        static void Need(bool value,string error){if(!value)throw new InvalidOperationException("SYMPTOM: "+error);}
        static ReplicaAuthor[] Authors(){return UnityEngine.Object.FindObjectsOfType<ReplicaAuthor>().Where(a=>a.Read()!=null).ToArray();}
        static Vector3 World(ReplicaAuthor author,bool first=false)
        {var d=author.Read();var n=first?d.Nodes.First():d.Nodes.Last();return author.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z));}
        static string Json(ReplicaAuthor author){return author.DocumentJson;}
        static bool HasPoint(ReplicaAuthor author,Vector3 world,float tolerance=.11f)
        {return author.Read().Nodes.Any(n=>Vector3.Distance(author.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z)),world)<tolerance);}

        sealed class Fixture:IDisposable
        {
            public ReplicaWindow Window;public SceneView View;public Vector3 PressPlane,ReleasePlane;EventHost events;Vector2 lastMouse;
            public Fixture(bool gui=false)
            {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Selection.activeGameObject=null;Undo.ClearAll();
                Window=ScriptableObject.CreateInstance<ReplicaWindow>();
                // Invoke exactly once, with an actual SceneView camera/event
                // context. Keep production SceneGUI unchanged.
                SceneView.duringSceneGui-=(Action<SceneView>)Delegate.CreateDelegate(typeof(Action<SceneView>),Window,SceneGui);
                if(gui)
                {View=ScriptableObject.CreateInstance<SceneView>();View.wantsMouseMove=true;View.position=new Rect(0,0,1100,800);View.Show();View.Focus();Frame(8);events=new EventHost(View);}
            }
            public void Frame(float size)
            {View.LookAt(new Vector3(8,2,0),Quaternion.Euler(55,-20,0),size,true,true);}
            public ReplicaAuthor Straight(string id,float z=0)
            {
                var doc=new RouteDocument{SchemaVersion=2,Id=id,Width=2,KitId="workshop.bridge.A",KitVersion="1"};
                doc.Nodes.Add(new RouteNode{Id="a",X=0,Y=2,Z=z});doc.Nodes.Add(new RouteNode{Id="b",X=8,Y=2,Z=z});
                var a=new GameObject(id).AddComponent<ReplicaAuthor>();var session=ReplicaSession.Get(a);
                Need(session.Preview(doc,ReplicaKitRegistry.EnsureBase())&&session.ApplyNew(),"fixture failed to create valid straight bridge: "+session.Status);return a;
            }
            public void Select(ReplicaAuthor author){Window.Select(author);Window.SetDrawMode(true);Undo.ClearAll();}
            public void ClearAuthor()
            {
                Selection.activeGameObject=null;
                // A newly opened draw tool with no selected bridge is a real
                // supported state; avoid mutating production's private fields.
                Window.CancelInput();UnityEngine.Object.DestroyImmediate(Window);Window=ScriptableObject.CreateInstance<ReplicaWindow>();
                SceneView.duringSceneGui-=(Action<SceneView>)Delegate.CreateDelegate(typeof(Action<SceneView>),Window,SceneGui);Window.SetDrawMode(true);
                Need(CurrentAuthor.GetValue(Window)==null,"fixture cannot create an unselected input window");
            }
            public PointFact Hit(Vector3 pointer,Vector3 endpoint,string label)
            {
                PointFact fact=null;Vector2 gui=Vector2.zero,native=Vector2.zero;
                events.Deliver(new Event{type=EventType.Layout},()=>{gui=HandleUtility.WorldToGUIPoint(pointer);native=GUIUtility.GUIToScreenPoint(gui)-View.position.position;});
                // This is explicitly a read-only Hit API probe inside the real
                // SceneView camera context, not a hover/gesture acceptance test.
                events.Deliver(new Event{type=EventType.Layout,mousePosition=native},()=>{
                    // Native GUI coordinates are quantized to whole pixels.
                    if(Vector2.Distance(Event.current.mousePosition,gui)>.75f)throw new Exception("FIXTURE: native SceneView Hit coordinate mismatch; expected "+gui+", actual "+Event.current.mousePosition);
                    var ray=HandleUtility.GUIPointToWorldRay(Event.current.mousePosition);object[] args={ray,Vector3.zero};bool hit=(bool)HitMethod.Invoke(Window,args);var point=(Vector3)args[1];
                    fact=new PointFact{label=label,pointerWorld=pointer,resolvedWorld=point,hit=hit,pixelDistance=Vector2.Distance(gui,HandleUtility.WorldToGUIPoint(endpoint)),endpointHorizontalError=new Vector2(point.x-endpoint.x,point.z-endpoint.z).magnitude};
                });return fact;
            }
            public void At(Vector3 world,EventType type)
            {
                Vector2 gui=lastMouse,native=lastMouse;
                events.Deliver(new Event{type=EventType.Layout,mousePosition=lastMouse},()=>{
                    gui=HandleUtility.WorldToGUIPoint(world);native=GUIUtility.GUIToScreenPoint(gui)-View.position.position;
                });
                var input=new Event{type=type,button=0,mousePosition=native};if(type==EventType.MouseDrag)input.delta=gui-lastMouse;
                Vector2 deliveredGui=gui;
                events.Deliver(input,()=>{
                    if(Vector2.Distance(Event.current.mousePosition,gui)>.75f)throw new Exception("FIXTURE: native SceneView pointer coordinate mismatch; expected "+gui+", actual "+Event.current.mousePosition);
                    if(Event.current.type==type)
                    {
                        deliveredGui=Event.current.mousePosition;var ray=HandleUtility.GUIPointToWorldRay(deliveredGui);float distance;
                        if(!new Plane(Vector3.up,world).Raycast(ray,out distance))throw new Exception("FIXTURE: independent pointer plane ray missed");
                        if(type==EventType.MouseDown)PressPlane=ray.GetPoint(distance);
                        if(type==EventType.MouseUp)ReleasePlane=ray.GetPoint(distance);
                    }
                    SceneGui.Invoke(Window,new object[]{View});
                });
                if(type==EventType.MouseDown||type==EventType.MouseDrag||type==EventType.MouseUp)lastMouse=deliveredGui;
            }
            public void Dispose()
            {if(Window!=null){Window.CancelInput();UnityEngine.Object.DestroyImmediate(Window);}if(events!=null)events.Dispose();if(View!=null)View.Close();}
        }
        sealed class EventHost:IDisposable
        {
            readonly SceneView view;Action pending;EventType expected;Exception failure;int delivered,callbacks;
            readonly List<string> trace=new List<string>();
            public EventHost(SceneView target){view=target;SceneView.duringSceneGui+=OnGui;}
            void OnGui(SceneView sender)
            {
                if(sender!=view)return;callbacks++;if(pending==null)return;
                trace.Add("type="+Event.current.type+",raw="+Event.current.rawType+",hot="+GUIUtility.hotControl+",nearest="+HandleUtility.nearestControl+",mouse="+Event.current.mousePosition);
                if(Event.current.type!=expected)return;var action=pending;pending=null;delivered++;try{action();}catch(Exception e){failure=e.GetBaseException();}
            }
            public void Deliver(Event e,Action action)
            {
                if(e.type!=EventType.Layout)Deliver(new Event{type=EventType.Layout,button=e.button,mousePosition=e.mousePosition},action);
                int before=delivered,callbacksBefore=callbacks;bool sent=false;trace.Clear();pending=action;expected=e.type;failure=null;try{sent=view.SendEvent(e);}finally{pending=null;}
                if(failure!=null)throw failure;if(delivered!=before+1)throw new Exception("FIXTURE: SceneView did not deliver "+expected+"; sent="+sent+",callbacks="+(callbacks-callbacksBefore)+",trace="+string.Join(" | ",trace));
            }
            public void Dispose(){SceneView.duringSceneGui-=OnGui;pending=null;}
        }
        static void Case(string name,string level,bool gui,Action<Fixture,Check> test)
        {
            var check=new Check{name=name,level=level};try{using(var f=new Fixture(gui)){check.authorsBefore=Authors().Length;try{test(f,check);}finally{check.authorsAfter=Authors().Length;check.statusText=f.Window.Status;}}}
            catch(Exception e){var root=e.GetBaseException();check.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";check.error=root.ToString();}
            report.checks.Add(check);Debug.Log("CONTINUATION_REGRESSION "+check.name+" "+check.status+" "+check.error);
        }
        static void SameAuthor(ReplicaAuthor old,Fixture f,string oldJson,Vector3 target,int expectedAuthors=1)
        {
            Need(f.Window.Author==old,"endpoint drawing created a different route author instead of extending the touched bridge");
            Need(Authors().Length==expectedAuthors,"endpoint extension left an independent overlapping bridge object");
            Need(Json(old)!=oldJson&&HasPoint(old,target),"same author did not reach the intended new endpoint");
        }
        public static void Red(){Run("continuation-input-red");}
        public static void Green(){Run("continuation-input-green");}
        static void Run(string reportName)
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Use only the existing isolated background QA project.");report=new Report();
            Case("selected-last-endpoint-positive-control","WINDOW_API",false,(f,c)=>{
                var a=f.Straight("tail-control");f.Select(a);string before=Json(a);var end=World(a);f.Window.BeginDraw(end);f.Window.DragDraw(end+Vector3.right*.2f);f.Window.DragDraw(end+Vector3.right*.7f);f.Window.DragDraw(end+Vector3.right*4);
                Need(f.Window.EndDraw(),"exact last endpoint continuation failed: "+f.Window.Status);SameAuthor(a,f,before,end+Vector3.right*4);
            });
            Case("selected-first-endpoint-must-prepend-same-author","WINDOW_API",false,(f,c)=>{
                var a=f.Straight("first-end");f.Select(a);string before=Json(a);var start=World(a,true);f.Window.BeginDraw(start);f.Window.DragDraw(start+Vector3.left*.8f);f.Window.DragDraw(start+Vector3.left*4);
                Need(f.Window.EndDraw(),"start endpoint outward stroke could not commit: "+f.Window.Status);SameAuthor(a,f,before,start+Vector3.left*4);
            });
            Case("touching-another-visible-bridge-must-not-create-an-overlap","WINDOW_API",false,(f,c)=>{
                var a=f.Straight("touched-route");var b=f.Straight("selected-route",12);f.Select(b);string before=Json(a);var end=World(a);f.Window.BeginDraw(end);f.Window.DragDraw(end+Vector3.right*2);f.Window.DragDraw(end+Vector3.right*4);
                Need(f.Window.EndDraw(),"visible bridge tail could not be continued while another bridge was selected");SameAuthor(a,f,before,end+Vector3.right*4,2);
            });
            Case("unselected-visible-endpoint-must-extend-existing-author","WINDOW_API",false,(f,c)=>{
                var a=f.Straight("unselected-route");f.ClearAuthor();string before=Json(a);var end=World(a);f.Window.BeginDraw(end);f.Window.DragDraw(end+Vector3.right*2);f.Window.DragDraw(end+Vector3.right*4);
                Need(f.Window.EndDraw(),"unselected bridge endpoint continuation did not commit");SameAuthor(a,f,before,end+Vector3.right*4);
            });
            Case("selected-tail-gentle-20-degree-join-and-one-undo","WINDOW_API",false,(f,c)=>{
                var a=f.Straight("gentle-join");f.Select(a);string before=Json(a);var end=World(a);var direction=new Vector3(.9396926f,0,.3420201f);var pressed=end+new Vector3(.12f,0,.04f);f.Window.BeginDraw(pressed);
                for(int i=1;i<=20;i++)f.Window.DragDraw(pressed+direction*(i*.2f));Need(f.Window.EndDraw(),"gentle non-collinear endpoint continuation failed: "+f.Window.Status);SameAuthor(a,f,before,end+direction*4);
                Undo.FlushUndoRecordObjects();Undo.PerformUndo();Need(Json(a)==before,"one Undo did not restore the whole endpoint continuation");
            });
            Case("centimetre-jitter-at-start-must-recover-to-valid-outward-tail","WINDOW_API",false,(f,c)=>{
                var a=f.Straight("jittered-tail");f.Select(a);string before=Json(a);var end=World(a);f.Window.BeginDraw(end);
                foreach(var p in new[]{new Vector3(.06f,0,.05f),new Vector3(.03f,0,-.04f),new Vector3(.14f,0,.03f),new Vector3(.3f,0,-.02f),new Vector3(.8f,0,.01f),new Vector3(2,0,0),new Vector3(4,0,0)})f.Window.DragDraw(end+p);
                Need(f.Window.EndDraw(),"ordinary tiny starting wobble poisoned the entire continuation: "+f.Window.Status);SameAuthor(a,f,before,end+Vector3.right*4);
            });
            Case("short-endpoint-release-rejects-without-false-commit-feedback","WINDOW_API",false,(f,c)=>{
                var a=f.Straight("short-tail-release");f.Select(a);string before=Json(a),mesh=ReplicaGeometry.Fingerprint(ReplicaSession.Get(a).Geometry),oldSuccess=ReplicaSession.Get(a).Status;
                var end=World(a);f.Window.BeginDraw(end);Need(!f.Window.DragDraw(end+Vector3.right*.1f),"0.1m stroke unexpectedly produced a commit-ready bridge");string rejectedReason=f.Window.Status;
                Need(!f.Window.EndDraw(),"0.1m endpoint stroke falsely reported a successful commit");
                Need(Authors().Length==1&&f.Window.Author==a&&Json(a)==before&&ReplicaGeometry.Fingerprint(ReplicaSession.Get(a).Geometry)==mesh,"releasing a too-short stroke changed or duplicated the previous bridge");
                // Waiting while held and an unchanged short release have
                // different copy; both must be truthful, not the old commit.
                Need(!string.IsNullOrEmpty(rejectedReason)&&!string.IsNullOrEmpty(f.Window.Status)&&f.Window.Status!=oldSuccess&&f.Window.Status.IndexOf("已采用",StringComparison.Ordinal)<0,"a rejected short stroke replaced its reason with the old committed-success status");
            });
            Case("bridge-body-api-and-real-hit-refuse-overlapping-new-author","WINDOW_API_AND_SCENEVIEW_HIT",true,(f,c)=>{
                var a=f.Straight("bridge-body-refusal");f.Select(a);f.Frame(8);string before=Json(a),mesh=ReplicaGeometry.Fingerprint(ReplicaSession.Get(a).Geometry);var body=new Vector3(4,2,0);
                f.Window.BeginDraw(body);Need(!f.Window.Drawing&&!f.Window.DragDraw(body+Vector3.forward*3)&&!f.Window.EndDraw(),"public API began a new independent stroke on an existing bridge body");
                Need(f.Window.Status.Contains("桥身")&&f.Window.Status.Contains("首尾"),"bridge-body API refusal does not explain that an endpoint is required");
                var hit=f.Hit(body,World(a),"bridge-body-real-hit");c.hits.Add(hit);Need(!hit.hit,"actual SceneView Hit accepted the bridge body as a new-stroke point");
                f.At(body,EventType.MouseDown);f.At(body+Vector3.forward*3,EventType.MouseDrag);f.At(body+Vector3.forward*3,EventType.MouseUp);
                Need(!f.Window.Drawing&&Authors().Length==1&&Json(a)==before&&ReplicaGeometry.Fingerprint(ReplicaSession.Get(a).Geometry)==mesh,"bridge-body SceneGUI gesture created an overlapping author or changed the original mesh");
                Need(f.Window.Status.Contains("桥身")&&f.Window.Status.Contains("首尾"),"actual bridge-body click does not visibly explain the non-endpoint refusal");
            });
            Case("elevated-endpoint-hit-is-stable-across-camera-scale","SCENEVIEW_HIT",true,(f,c)=>{
                var a=f.Straight("elevated-hit");f.Select(a);var end=World(a);var pointer=end+Vector3.right*.35f;
                foreach(float size in new[]{32f,8f,4f}){f.Frame(size);var hit=f.Hit(pointer,end,"scene-size-"+size);c.hits.Add(hit);Need(hit.hit&&Math.Abs(hit.resolvedWorld.y-2)<.01f&&hit.endpointHorizontalError<=.6f,"a pointer 0.35m from an elevated bridge tail resolved to the ground/new-author plane at scene size "+size+", pixel distance "+hit.pixelDistance+", resolved "+hit.resolvedWorld);}
            });
            Case("actual-scene-gesture-near-elevated-tail-stays-one-author","SYNTHETIC_SCENEGUI",true,(f,c)=>{
                var a=f.Straight("scene-elevated-tail");f.Select(a);f.Frame(4);string before=Json(a);var end=World(a);
                f.At(end+Vector3.right*.35f,EventType.MouseDown);foreach(float d in new[]{.5f,.8f,1.4f,2.2f,4})f.At(end+Vector3.right*d,EventType.MouseDrag);f.At(end+Vector3.right*4,EventType.MouseUp);
                // Compare with the independently projected, actually delivered
                // pixel coordinates, not the unquantized requested world point.
                c.actualPressPlane=f.PressPlane;c.actualReleasePlane=f.ReleasePlane;
                SameAuthor(a,f,before,end+f.ReleasePlane-f.PressPlane);Need(!f.Window.Drawing,"real SceneGUI release did not finish the stroke");
            });
            report.status=report.checks.Any(c=>c.status=="ERROR")?"ERROR":report.checks.All(c=>c.status=="PASS")?"PASS":"FAIL";
            string root=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required");Directory.CreateDirectory(Path.Combine(root,"reports"));File.WriteAllText(Path.Combine(root,"reports",reportName+".json"),JsonUtility.ToJson(report,true));
            EditorApplication.Exit(report.status=="PASS"?0:1);
        }
    }
}
