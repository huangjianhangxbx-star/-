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
    // Keep the pointer's original grab offset throughout the gesture. Previous
    // tests pressed the side of the port, then teleported all drags to its centre.
    // These synthetic SceneView events retain that offset and exercise Hit too.
    public static class ContinuationActualGestureQa
    {
        static readonly BindingFlags Hidden=BindingFlags.Instance|BindingFlags.NonPublic;
        static readonly MethodInfo SceneGui=typeof(ReplicaWindow).GetMethod("SceneGUI",Hidden);
        [Serializable] sealed class Check
        {
            public string name,level,status="PASS",error,firstDragStatus,lastStatus;
            public Vector3 grabOffset,oldEndpoint,pointerEnd,actualPressPlane,actualReleasePlane,expectedEndpoint,actualEndpoint;
            public float viewSize;
            public int initialAuthors,finalAuthors;
            public bool began,committed,sameAuthor;
        }
        [Serializable] sealed class Report
        {public string status="FAIL",engine=Application.unityVersion,scope="Continuous pointer drag relative to its actual off-centre port press, through Window API and real SceneView synthetic callbacks. Not physical mouse proof.";public bool physicalInput=false;public List<Check> checks=new List<Check>();}
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException("SYMPTOM: "+message);}
        static ReplicaAuthor[] Authors(){return UnityEngine.Object.FindObjectsOfType<ReplicaAuthor>().Where(a=>a.Read()!=null).ToArray();}
        static Vector3 End(ReplicaAuthor a){var n=a.Read().Nodes.Last();return a.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z));}

        sealed class Fixture:IDisposable
        {
            public ReplicaWindow Window;public SceneView View;public ReplicaAuthor Author;
            public Vector3 PressPlane,ReleasePlane;
            EventHost events;Vector2 lastMouse;
            public Fixture(bool sceneGui,float size)
            {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Selection.activeGameObject=null;Undo.ClearAll();
                Window=ScriptableObject.CreateInstance<ReplicaWindow>();
                SceneView.duringSceneGui-=(Action<SceneView>)Delegate.CreateDelegate(typeof(Action<SceneView>),Window,SceneGui);
                var d=new RouteDocument{SchemaVersion=2,Id="continuous-grab-offset",Width=2,KitId="workshop.bridge.A",KitVersion="1"};
                d.Nodes.Add(new RouteNode{Id="first",X=0,Y=2,Z=0});d.Nodes.Add(new RouteNode{Id="last",X=8,Y=2,Z=0});
                Author=new GameObject("Visible_existing_bridge").AddComponent<ReplicaAuthor>();var s=ReplicaSession.Get(Author);
                Need(s.Preview(d,ReplicaKitRegistry.EnsureBase())&&s.ApplyNew(),"Fixture bridge cannot be built: "+s.Status);
                Window.Select(Author);Window.SetDrawMode(true);Undo.ClearAll();
                if(sceneGui)
                {View=ScriptableObject.CreateInstance<SceneView>();View.wantsMouseMove=true;View.position=new Rect(0,0,1100,800);View.Show();View.Focus();View.LookAt(new Vector3(8,2,0),Quaternion.Euler(55,-20,0),size,true,true);events=new EventHost(View);}
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
                    // Native mouse input quantizes each axis by up to half a
                    // pixel; the allowed 0.75 is a GUI-coordinate check only.
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
            public void Dispose(){if(Window!=null){Window.CancelInput();UnityEngine.Object.DestroyImmediate(Window);}if(events!=null)events.Dispose();if(View!=null)View.Close();}
        }
        sealed class EventHost:IDisposable
        {
            readonly SceneView view;Action pending;EventType expected;Exception failure;int delivered,callbacks;
            readonly List<string> trace=new List<string>();
            public EventHost(SceneView v){view=v;SceneView.duringSceneGui+=OnGui;}
            void OnGui(SceneView sender)
            {
                if(sender!=view)return;callbacks++;if(pending==null)return;
                trace.Add("type="+Event.current.type+",raw="+Event.current.rawType+",hot="+GUIUtility.hotControl+",nearest="+HandleUtility.nearestControl+",mouse="+Event.current.mousePosition);
                if(Event.current.type!=expected)return;var a=pending;pending=null;delivered++;try{a();}catch(Exception e){failure=e.GetBaseException();}
            }
            public void Deliver(Event e,Action action)
            {
                if(e.type!=EventType.Layout)Deliver(new Event{type=EventType.Layout,button=e.button,mousePosition=e.mousePosition},action);
                int before=delivered,callbacksBefore=callbacks;bool sent=false;trace.Clear();pending=action;expected=e.type;failure=null;try{sent=view.SendEvent(e);}finally{pending=null;}
                if(failure!=null)throw failure;if(delivered!=before+1)throw new Exception("FIXTURE: SceneView did not deliver "+expected+"; sent="+sent+",callbacks="+(callbacks-callbacksBefore)+",trace="+string.Join(" | ",trace));
            }
            public void Dispose(){SceneView.duringSceneGui-=OnGui;pending=null;}
        }
        static Check Gesture(string name,Vector3 offset,bool sceneGui,float viewSize)
        {
            var c=new Check{name=name,level=sceneGui?"SYNTHETIC_SCENEGUI":"WINDOW_API",grabOffset=offset,viewSize=viewSize};
            try
            {
                using(var f=new Fixture(sceneGui,viewSize))
                {
                    var a=f.Author;c.oldEndpoint=End(a);c.initialAuthors=Authors().Length;string old=a.DocumentJson;
                    var pressed=c.oldEndpoint+offset;
                    if(sceneGui){f.At(pressed,EventType.MouseMove);f.At(pressed,EventType.MouseDown);}else f.Window.BeginDraw(pressed);
                    c.began=f.Window.Drawing;
                    // Natural drag: the cursor keeps its side and along-port
                    // offset. A 4m mouse movement should extend by 4m, rather
                    // than interpreting the press offset as the first sharp leg.
                    for(int i=1;i<=40;i++)
                    {
                        var pointer=pressed+Vector3.right*(i*.1f);c.pointerEnd=pointer;
                        if(sceneGui)f.At(pointer,EventType.MouseDrag);else f.Window.DragDraw(pointer);
                        if(i==1)c.firstDragStatus=f.Window.Status;
                    }
                    if(sceneGui){f.At(c.pointerEnd,EventType.MouseUp);c.committed=a.DocumentJson!=old;}else c.committed=f.Window.EndDraw();
                    c.lastStatus=f.Window.Status;c.sameAuthor=f.Window.Author==a;c.finalAuthors=Authors().Length;c.actualEndpoint=End(a);c.expectedEndpoint=c.oldEndpoint+Vector3.right*4;
                    if(sceneGui){c.actualPressPlane=f.PressPlane;c.actualReleasePlane=f.ReleasePlane;c.expectedEndpoint=c.oldEndpoint+f.ReleasePlane-f.PressPlane;}
                    Need(c.began,"press inside visible endpoint face failed to start drawing");
                    Need(c.committed,"ordinary off-centre grab retained throughout the drag never committed: "+c.lastStatus);
                    Need(c.sameAuthor&&c.finalAuthors==c.initialAuthors,"continuous port gesture created a separate author");
                    Need(Vector3.Distance(c.actualEndpoint,c.expectedEndpoint)<.11f,"bridge did not follow mouse movement from its grabbed anchor; expected "+c.expectedEndpoint+", actual "+c.actualEndpoint);
                }
            }
            catch(Exception e){var root=e.GetBaseException();c.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";c.error=root.ToString();}
            return c;
        }
        public static void Red(){Run("continuation-actual-gesture-red");}
        public static void Green(){Run("continuation-actual-gesture-green");}
        static void Run(string name)
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Use the existing isolated background QA project.");
            var r=new Report();
            r.checks.Add(Gesture("centre-grab-positive-control",Vector3.zero,false,0));
            r.checks.Add(Gesture("side-grab-plus-0.8-keeps-pointer-offset",Vector3.forward*.8f,false,0));
            r.checks.Add(Gesture("side-grab-minus-0.8-keeps-pointer-offset",Vector3.back*.8f,false,0));
            r.checks.Add(Gesture("along-grab-0.35-keeps-actual-mouse-delta",Vector3.right*.35f,false,0));
            foreach(float size in new[]{4f,32f,80f})r.checks.Add(Gesture("real-scene-side-grab-size-"+size,Vector3.forward*.8f,true,size));
            r.status=r.checks.Any(c=>c.status=="ERROR")?"ERROR":r.checks.All(c=>c.status=="PASS")?"PASS":"FAIL";
            var root=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required");Directory.CreateDirectory(Path.Combine(root,"reports"));File.WriteAllText(Path.Combine(root,"reports",name+".json"),JsonUtility.ToJson(r,true));
            foreach(var c in r.checks)Debug.Log("CONTINUATION_ACTUAL_GESTURE "+c.name+" "+c.status+" "+c.error);
            EditorApplication.Exit(r.status=="PASS"?0:1);
        }
    }
}
