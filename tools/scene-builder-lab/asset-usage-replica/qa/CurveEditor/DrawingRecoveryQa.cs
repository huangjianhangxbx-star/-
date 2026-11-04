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
    // A rejected pointer excursion is not an instruction to retain that
    // excursion forever. These gestures return to an ordinary straight route,
    // entirely outside the pre-existing bridge. They do not ask the solver to
    // accept a real self-intersection or a final route back through the bridge.
    public static class DrawingRecoveryQa
    {
        static readonly BindingFlags Hidden=BindingFlags.Instance|BindingFlags.NonPublic;
        static readonly MethodInfo SceneGui=typeof(ReplicaWindow).GetMethod("SceneGUI",Hidden);
        [Serializable] sealed class Check
        {
            public string name,level,status="PASS",error,invalidStatus,lastStatus;
            public bool began,validBeforeExcursion,excursionRejected,oldAuthorUntouchedWhileDrawing,
                committed,sameAuthor,undoRestored,redoRestored;
            public int initialAuthors,finalAuthors,samples;
            public Vector3 grabOffset,pointerRelease,actualPressPlane,actualReleasePlane,expectedEndpoint,actualEndpoint;
            public float endpointError,viewSize;
        }
        [Serializable] sealed class Report
        {
            public string status="FAIL",engine=Application.unityVersion,
                scope="Window API and complete synthetic SceneGUI press/drag/release. Rejected temporary side excursions must not poison later feasible pointer positions; strict invalid final geometry remains rejected. Not physical mouse proof.";
            public bool physicalInput=false;
            public List<Check> checks=new List<Check>();
        }
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException("SYMPTOM: "+message);}
        static void FixtureNeed(bool value,string message){if(!value)throw new InvalidOperationException("FIXTURE: "+message);}
        static ReplicaAuthor[] Authors(){return UnityEngine.Object.FindObjectsOfType<ReplicaAuthor>().Where(a=>a.Read()!=null).ToArray();}
        static Vector3 End(ReplicaAuthor a){return WorldNode(a,a.Read().Nodes.Last());}
        static Vector3 WorldNode(ReplicaAuthor a,RouteNode n){return a.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z));}
        static string Mesh(ReplicaAuthor a){return ReplicaGeometry.Fingerprint(ReplicaSession.Get(a).Geometry);}
        static string Candidate(ReplicaAuthor a){var s=ReplicaSession.Get(a);return s.HasCandidate?JsonUtility.ToJson(s.Candidate.Document):null;}

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
                var d=new RouteDocument{SchemaVersion=2,Id="drawing-recovery",Width=2,KitId="workshop.bridge.A",KitVersion="1"};
                d.Nodes.Add(new RouteNode{Id="first",X=0,Y=2,Z=0});d.Nodes.Add(new RouteNode{Id="last",X=8,Y=2,Z=0});
                Author=new GameObject("Recovery_existing_bridge").AddComponent<ReplicaAuthor>();var s=ReplicaSession.Get(Author);
                FixtureNeed(s.Preview(d,ReplicaKitRegistry.EnsureBase())&&s.ApplyNew(),"ordinary straight bridge could not be built: "+s.Status);
                Window.Select(Author);Window.SetDrawMode(true);Undo.ClearAll();
                if(sceneGui)
                {
                    View=ScriptableObject.CreateInstance<SceneView>();View.wantsMouseMove=true;View.position=new Rect(0,0,1100,800);View.Show();View.Focus();
                    View.LookAt(new Vector3(8,2,0),Quaternion.Euler(55,-20,0),size,true,true);events=new EventHost(View);
                }
            }
            public void At(Vector3 world,EventType type)
            {
                // Projection requires the real SceneView GUI camera context.
                // Resolve it in Layout *before* sending the pointer event:
                // changing Event.current.mousePosition in duringSceneGui was
                // too late for SceneView's own native pointer handling.
                Vector2 gui=lastMouse,native=lastMouse;
                events.Deliver(new Event{type=EventType.Layout,mousePosition=lastMouse},()=>{
                    gui=HandleUtility.WorldToGUIPoint(world);
                    native=GUIUtility.GUIToScreenPoint(gui)-View.position.position;
                });
                var input=new Event{type=type,button=0,mousePosition=native};
                if(type==EventType.MouseDrag)input.delta=gui-lastMouse;
                Vector2 deliveredGui=gui;
                events.Deliver(input,()=>{
                    // Native input rounds to whole pixels, at most 0.5 on
                    // each axis (sqrt(0.5^2+0.5^2) < 0.75 pixels).
                    FixtureNeed(Vector2.Distance(Event.current.mousePosition,gui)<=.75f,"native SceneView pointer coordinate mismatch; expected "+gui+", actual "+Event.current.mousePosition);
                    if(Event.current.type==type)
                    {
                        deliveredGui=Event.current.mousePosition;
                        var ray=HandleUtility.GUIPointToWorldRay(deliveredGui);float distance;
                        FixtureNeed(new Plane(Vector3.up,world).Raycast(ray,out distance),"independent camera ray missed the pointer's horizontal plane");
                        if(type==EventType.MouseDown)PressPlane=ray.GetPoint(distance);
                        if(type==EventType.MouseUp)ReleasePlane=ray.GetPoint(distance);
                    }
                    SceneGui.Invoke(Window,new object[]{View});
                });
                if(type==EventType.MouseDown||type==EventType.MouseDrag||type==EventType.MouseUp)lastMouse=deliveredGui;
            }
            public void Dispose()
            {
                if(Window!=null){Window.CancelInput();UnityEngine.Object.DestroyImmediate(Window);}
                if(events!=null)events.Dispose();if(View!=null)View.Close();
                foreach(var a in Authors())if(a!=null)ReplicaGeometry.Destroy(a.gameObject);
            }
        }
        sealed class EventHost:IDisposable
        {
            readonly SceneView view;Action pending;EventType expected;Exception failure;int delivered,callbacks;
            readonly List<string> trace=new List<string>();
            public EventHost(SceneView v){view=v;SceneView.duringSceneGui+=OnGui;}
            void OnGui(SceneView sender)
            {
                if(sender!=view)return;callbacks++;
                if(pending==null)return;
                trace.Add("type="+Event.current.type+",raw="+Event.current.rawType+",hot="+GUIUtility.hotControl+",nearest="+HandleUtility.nearestControl+",mouse="+Event.current.mousePosition);
                if(Event.current.type!=expected)return;
                var a=pending;pending=null;delivered++;try{a();}catch(Exception e){failure=e.GetBaseException();}
            }
            public void Deliver(Event e,Action action)
            {
                if(e.type!=EventType.Layout)Deliver(new Event{type=EventType.Layout,button=e.button,mousePosition=e.mousePosition},action);
                int before=delivered,callbacksBefore=callbacks;bool sent=false;trace.Clear();pending=action;expected=e.type;failure=null;try{sent=view.SendEvent(e);}finally{pending=null;}
                if(failure!=null)throw failure;
                FixtureNeed(delivered==before+1,"SceneView did not deliver "+expected+"; sent="+sent+",callbacks="+(callbacks-callbacksBefore)+",trace="+string.Join(" | ",trace));
            }
            public void Dispose(){SceneView.duringSceneGui-=OnGui;pending=null;}
        }

        // Deltas are from the actual off-centre pointer press, never from the
        // snapped endpoint. MouseUp can have a final position not yet dragged.
        static Check Gesture(string name,Vector3[] deltas,Vector3 release,int invalidIndex=-1,
            bool sceneGui=false,float size=0,Vector3? grab=null,bool permanentInvalid=false)
        {
            var c=new Check{name=name,level=sceneGui?"SYNTHETIC_SCENEGUI":"WINDOW_API",viewSize=size,grabOffset=grab??Vector3.zero,samples=deltas.Length};
            try
            {
                using(var f=new Fixture(sceneGui,size))
                {
                    var a=f.Author;var endpoint=End(a);var pressed=endpoint+c.grabOffset;
                    string before=a.DocumentJson,beforeMesh=Mesh(a);var kit=a.Kit;c.initialAuthors=Authors().Length;
                    // Recovery needs a genuine press/drag/release chain, not
                    // prior hover delivery. MouseDown itself runs PickPort and
                    // TryPressHit; the original seven grab tests cover hover.
                    if(sceneGui)f.At(pressed,EventType.MouseDown);else f.Window.BeginDraw(pressed);
                    c.began=f.Window.Drawing;c.oldAuthorUntouchedWhileDrawing=true;
                    for(int i=0;i<deltas.Length;i++)
                    {
                        string previousCandidate=Candidate(a);bool accepted=false;
                        if(i==invalidIndex)c.validBeforeExcursion=previousCandidate!=null;
                        if(sceneGui)f.At(pressed+deltas[i],EventType.MouseDrag);else accepted=f.Window.DragDraw(pressed+deltas[i]);
                        c.oldAuthorUntouchedWhileDrawing&=a.DocumentJson==before&&Mesh(a)==beforeMesh;
                        if(i==invalidIndex)
                        {
                            c.invalidStatus=f.Window.Status;
                            c.excursionRejected=(sceneGui||!accepted)&&Candidate(a)==previousCandidate;
                        }
                    }
                    c.pointerRelease=pressed+release;
                    if(sceneGui){f.At(c.pointerRelease,EventType.MouseUp);c.committed=a.DocumentJson!=before;}
                    else {f.Window.DragDraw(c.pointerRelease);c.committed=f.Window.EndDraw();}
                    c.lastStatus=f.Window.Status;c.sameAuthor=f.Window.Author==a&&a.Kit==kit;
                    c.finalAuthors=Authors().Length;c.actualEndpoint=End(a);
                    c.expectedEndpoint=endpoint+(permanentInvalid?deltas[invalidIndex-1]:release);
                    if(sceneGui){c.actualPressPlane=f.PressPlane;c.actualReleasePlane=f.ReleasePlane;c.expectedEndpoint=endpoint+f.ReleasePlane-f.PressPlane;}
                    c.endpointError=Vector3.Distance(c.expectedEndpoint,c.actualEndpoint);
                    string after=a.DocumentJson,afterMesh=Mesh(a);
                    Undo.FlushUndoRecordObjects();Undo.PerformUndo();
                    c.undoRestored=a.DocumentJson==before&&Mesh(a)==beforeMesh&&a.Kit==kit;
                    Undo.PerformRedo();c.redoRestored=a.DocumentJson==after&&Mesh(a)==afterMesh&&a.Kit==kit;
                    Need(c.began,"endpoint press did not start drawing");
                    if(invalidIndex>=0)FixtureNeed(c.excursionRejected,"chosen temporary sharp side excursion was not actually rejected");
                    Need(c.oldAuthorUntouchedWhileDrawing,"pointer previews changed the committed author before release");
                    Need(c.committed,"feasible final route did not commit: "+c.lastStatus);
                    Need(c.sameAuthor&&c.initialAuthors==c.finalAuthors,"gesture did not update the same bridge author and kit");
                    Need(c.endpointError<.11f,(permanentInvalid?"genuinely invalid final return should keep the last valid endpoint":"recovered route did not reach the feasible pointer release")+"; expected "+c.expectedEndpoint+", actual "+c.actualEndpoint+"; "+c.lastStatus);
                    Need(c.undoRestored&&c.redoRestored,"one native Undo/Redo did not restore the complete route, kit and actual geometry");
                }
            }
            catch(Exception e){var root=e.GetBaseException();c.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";c.error=root.ToString();}
            return c;
        }
        static Vector3 X(float x){return new Vector3(x,0,0);}
        static Vector3 Side(float x,float z){return new Vector3(x,0,z);}
        public static void Red(){Run("drawing-recovery-red");}
        public static void Green(){Run("drawing-recovery-green");}
        static void Run(string name)
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Use the existing isolated background QA project.");
            var r=new Report();
            r.checks.Add(Gesture("api-valid-side-detour-return-valid-frontier",new[]{X(2),Side(2.1f,1),X(2),X(4)},X(4),1));
            r.checks.Add(Gesture("api-valid-side-detour-direct-correction",new[]{X(2),Side(2.1f,1),X(4)},X(4),1));
            r.checks.Add(Gesture("api-endpoint-side-overrun-then-straight",new[]{Side(.1f,1),X(.2f),X(1),X(4)},X(4),0));
            r.checks.Add(Gesture("api-short-initial-distance-waits-then-recovers",new[]{X(.1f),X(.2f),X(.4f),X(1),X(4)},X(4)));
            r.checks.Add(Gesture("api-fast-collinear-release-is-final-sample",new[]{X(2),X(4)},X(5)));
            var slow=Enumerable.Range(1,16).Select(i=>X(i*.25f)).ToArray();
            r.checks.Add(Gesture("api-slow-same-collinear-path-and-release",slow,X(5)));
            r.checks.Add(Gesture("scene-fast-side-detour-return-and-release-size32",new[]{X(2),Side(2.1f,1),X(2),X(4)},X(5),1,true,32,Vector3.forward*.8f));
            r.checks.Add(Gesture("scene-endpoint-side-overrun-correct-and-release-size4",new[]{Side(.1f,1),X(.2f),X(1),X(4)},X(5),0,true,4,Vector3.back*.8f));
            // Positive strictness control: this final pointer really doubles
            // back into the original bridge, and must not extend through it.
            r.checks.Add(Gesture("api-final-return-across-old-bridge-remains-rejected",new[]{X(2),X(-3)},X(-3),1,false,0,null,true));
            r.status=r.checks.Any(c=>c.status=="ERROR")?"ERROR":r.checks.All(c=>c.status=="PASS")?"PASS":"FAIL";
            var root=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required");
            Directory.CreateDirectory(Path.Combine(root,"reports"));File.WriteAllText(Path.Combine(root,"reports",name+".json"),JsonUtility.ToJson(r,true));
            foreach(var c in r.checks)Debug.Log("DRAWING_RECOVERY "+c.name+" "+c.status+" "+c.error);
            EditorApplication.Exit(r.status=="PASS"?0:1);
        }
    }
}
