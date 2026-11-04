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
    // Backtracking over this gesture's own accepted route retracts its live
    // endpoint; it must not author a loop or keep a stale, farther candidate.
    public static class StrokeRetractionHeightQa
    {
        static readonly BindingFlags Hidden=BindingFlags.Instance|BindingFlags.NonPublic;
        static readonly MethodInfo SceneGui=typeof(ReplicaWindow).GetMethod("SceneGUI",Hidden);
        [Serializable] sealed class Check
        {
            public string name,level,status="PASS",error,lastStatus;
            public bool began,committed,sameAuthor,undoRestored,redoRestored,oldAuthorUnchanged,noCommittedExtraAuthor,candidateClearedWhenRetracted;
            public int authorsBefore,authorsAfter,cameraPixelWidth,cameraPixelHeight;
            public Rect nativeWindowRect;
            public float expectedLength,actualLength,endpointError,initialHeight,finalHeight,shiftPixels;
            public bool noZeroLengthSpans,rangeRejected,slopeRejected,rejectedHeightKeptCandidate;
            public Vector3 expectedEndpoint,actualEndpoint,actualPressPlane,actualReleasePlane;
        }
        [Serializable] sealed class Report
        {
            public string status="FAIL",engine=Application.unityVersion,
                scope="Actual Window API and complete synthetic SceneGUI stroke retraction. Native pixel coordinates and independent camera-plane projection; no physical mouse claim.";
            public bool physicalInput=false;
            public List<Check> checks=new List<Check>();
        }
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException("SYMPTOM: "+message);}
        static void FixtureNeed(bool value,string message){if(!value)throw new InvalidOperationException("FIXTURE: "+message);}
        static ReplicaAuthor[] Authors(){return UnityEngine.Object.FindObjectsOfType<ReplicaAuthor>().Where(a=>a.Read()!=null).ToArray();}
        static Vector3 End(ReplicaAuthor a,bool first=false)
        {var d=a.Read();var n=first?d.Nodes.First():d.Nodes.Last();return a.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z));}
        static float Length(ReplicaAuthor a)
        {var n=a.Read().Nodes;float result=0;for(int i=1;i<n.Count;i++)result+=Vector2.Distance(new Vector2(n[i-1].X,n[i-1].Z),new Vector2(n[i].X,n[i].Z));return result;}
        static string Mesh(ReplicaAuthor a){return ReplicaGeometry.Fingerprint(ReplicaSession.Get(a).Geometry);}

        sealed class Fixture:IDisposable
        {
            public ReplicaWindow Window;public SceneView View;public ReplicaAuthor Author;public Vector3 PressPlane,ReleasePlane,LastPlane;
            EventHost events;Vector2 lastMouse;
            public Fixture(bool sceneGui=false)
            {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Selection.activeGameObject=null;Undo.ClearAll();
                Window=ScriptableObject.CreateInstance<ReplicaWindow>();
                SceneView.duringSceneGui-=(Action<SceneView>)Delegate.CreateDelegate(typeof(Action<SceneView>),Window,SceneGui);
                var d=new RouteDocument{SchemaVersion=2,Id="stroke-retraction",Width=2,KitId="workshop.bridge.A",KitVersion="1"};
                d.Nodes.Add(new RouteNode{Id="old-first",X=0,Y=2,Z=0});d.Nodes.Add(new RouteNode{Id="old-last",X=8,Y=2,Z=0});
                Author=new GameObject("Retraction_existing_bridge").AddComponent<ReplicaAuthor>();var s=ReplicaSession.Get(Author);
                FixtureNeed(s.Preview(d,ReplicaKitRegistry.EnsureBase())&&s.ApplyNew(),"ordinary fixture bridge failed: "+s.Status);
                Window.Select(Author);Window.SetDrawMode(true);Undo.ClearAll();
                if(sceneGui)
                {
                    View=ScriptableObject.CreateInstance<SceneView>();View.wantsMouseMove=true;View.Show();View.position=new Rect(0,0,1100,800);View.Focus();
                    View.LookAt(new Vector3(8,2,0),Quaternion.Euler(55,-20,0),16,true,true);events=new EventHost(View);
                    events.Deliver(new Event{type=EventType.Layout},()=>FixtureNeed(View.camera.pixelHeight>=600,"native camera viewport too small after Show/resize: "+View.camera.pixelWidth+"x"+View.camera.pixelHeight+", window="+View.position));
                }
            }
            public void At(Vector3 world,EventType type,EventModifiers modifiers=EventModifiers.None)
            {
                Vector2 gui=lastMouse,native=lastMouse;
                events.Deliver(new Event{type=EventType.Layout,mousePosition=lastMouse},()=>{
                    gui=HandleUtility.WorldToGUIPoint(world);native=GUIUtility.GUIToScreenPoint(gui)-View.position.position;
                });
                var input=new Event{type=type,button=0,mousePosition=native,modifiers=modifiers};if(type==EventType.MouseDrag)input.delta=gui-lastMouse;
                Vector2 deliveredGui=gui;
                events.Deliver(input,()=>{
                    // A real native event quantizes each GUI axis by <=0.5px.
                    FixtureNeed(Vector2.Distance(Event.current.mousePosition,gui)<=.75f,"native pointer coordinate mismatch; expected "+gui+", actual "+Event.current.mousePosition);
                    if(Event.current.type==type)
                    {
                        deliveredGui=Event.current.mousePosition;var ray=HandleUtility.GUIPointToWorldRay(deliveredGui);float distance;
                        FixtureNeed(new Plane(Vector3.up,world).Raycast(ray,out distance),"independent pointer plane ray missed");
                        LastPlane=ray.GetPoint(distance);
                        if(type==EventType.MouseDown)PressPlane=ray.GetPoint(distance);if(type==EventType.MouseUp)ReleasePlane=ray.GetPoint(distance);
                    }
                    SceneGui.Invoke(Window,new object[]{View});
                });
                if(type==EventType.MouseDown||type==EventType.MouseDrag||type==EventType.MouseUp)lastMouse=deliveredGui;
            }
            public void AtGuiDelta(Vector2 delta,EventModifiers modifiers,EventType type=EventType.MouseDrag,float planeY=2)
            {
                var gui=lastMouse+delta;Vector2 native=gui;
                events.Deliver(new Event{type=EventType.Layout,mousePosition=lastMouse},()=>{native=GUIUtility.GUIToScreenPoint(gui)-View.position.position;});
                Vector2 deliveredGui=gui;
                events.Deliver(new Event{type=type,button=0,modifiers=modifiers,mousePosition=native,delta=delta},()=>{
                    FixtureNeed(Vector2.Distance(Event.current.mousePosition,gui)<=.75f,"native GUI delta coordinate mismatch");
                    if(Event.current.type==type)
                    {
                        deliveredGui=Event.current.mousePosition;var ray=HandleUtility.GUIPointToWorldRay(deliveredGui);float distance;
                        FixtureNeed(new Plane(Vector3.up,new Vector3(0,planeY,0)).Raycast(ray,out distance),"independent GUI delta plane ray missed");
                        LastPlane=ray.GetPoint(distance);if(type==EventType.MouseUp)ReleasePlane=LastPlane;
                    }
                    SceneGui.Invoke(Window,new object[]{View});
                });
                lastMouse=deliveredGui;
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
                if(sender!=view)return;callbacks++;if(pending==null)return;
                trace.Add("type="+Event.current.type+",raw="+Event.current.rawType+",hot="+GUIUtility.hotControl+",nearest="+HandleUtility.nearestControl+",mouse="+Event.current.mousePosition);
                if(Event.current.type!=expected)return;var a=pending;pending=null;delivered++;try{a();}catch(Exception e){failure=e.GetBaseException();}
            }
            public void Deliver(Event e,Action action)
            {
                if(e.type!=EventType.Layout)Deliver(new Event{type=EventType.Layout,button=e.button,mousePosition=e.mousePosition,modifiers=e.modifiers},action);
                int before=delivered,callbacksBefore=callbacks;bool sent=false;trace.Clear();pending=action;expected=e.type;failure=null;try{sent=view.SendEvent(e);}finally{pending=null;}
                if(failure!=null)throw failure;FixtureNeed(delivered==before+1,"SceneView did not deliver "+expected+"; sent="+sent+",callbacks="+(callbacks-callbacksBefore)+",trace="+string.Join(" | ",trace));
            }
            public void Dispose(){SceneView.duringSceneGui-=OnGui;pending=null;}
        }
        static void UndoRedo(ReplicaAuthor a,Check c,string before,string beforeMesh,ReplicaKit kit)
        {
            string after=a.DocumentJson,afterMesh=Mesh(a);Undo.FlushUndoRecordObjects();Undo.PerformUndo();
            c.undoRestored=a.DocumentJson==before&&Mesh(a)==beforeMesh&&a.Kit==kit;
            Undo.PerformRedo();c.redoRestored=a.DocumentJson==after&&Mesh(a)==afterMesh&&a.Kit==kit;
        }
        static Check Retraction(string name,bool sceneGui,bool fullRetraction=false,bool first=false,bool inward=false,bool newStroke=false,bool opening=false,bool crossBase=false)
        {
            var c=new Check{name=name,level=sceneGui?"SYNTHETIC_SCENEGUI":"WINDOW_API"};
            try
            {
                using(var f=new Fixture(sceneGui))
                {
                    if(sceneGui){c.cameraPixelWidth=f.View.camera.pixelWidth;c.cameraPixelHeight=f.View.camera.pixelHeight;c.nativeWindowRect=f.View.position;}
                    var a=f.Author;var kit=a.Kit;
                    if(opening)
                    {
                        var d=a.Read();d.Openings.Add(new RouteOpening{SegmentId=RouteDocument.GetSegmentId(d.Nodes[0].Id,d.Nodes[1].Id),Width=2,Height=1});var s=ReplicaSession.Get(a);
                        FixtureNeed(s.Preview(d,kit)&&s.Apply(),"enabled opening fixture failed: "+s.Status);f.Window.Select(a);Undo.ClearAll();
                    }
                    string before=a.DocumentJson,beforeMesh=Mesh(a);c.authorsBefore=Authors().Length;
                    Vector3 endpoint=End(a,first),press=newStroke?new Vector3(30,0,20):endpoint+(sceneGui?Vector3.forward*.8f:Vector3.zero);
                    if(sceneGui)f.At(press,EventType.MouseDown);else f.Window.BeginDraw(press);c.began=f.Window.Drawing;
                    float sign=first?-1:1;float[] deltas=inward?new[]{-2f,-4f}:crossBase?new[]{2f,-3f}:fullRetraction?new[]{4f,6f,4f,2f,0f}:new[]{4f,6f,4f,2f,5f};
                    foreach(float d in deltas)
                    {var pointer=press+Vector3.right*(d*sign);if(sceneGui)f.At(pointer,EventType.MouseDrag);else f.Window.DragDraw(pointer);}
                    if(fullRetraction&&!newStroke)c.candidateClearedWhenRetracted=!ReplicaSession.Get(a).HasCandidate;
                    var release=press+Vector3.right*(deltas.Last()*sign);
                    if(sceneGui){f.At(release,EventType.MouseUp);c.committed=a.DocumentJson!=before;}
                    else c.committed=f.Window.EndDraw();
                    c.lastStatus=f.Window.Status;c.sameAuthor=f.Window.Author==a&&a.Kit==kit;c.authorsAfter=Authors().Length;
                    c.oldAuthorUnchanged=a.DocumentJson==before&&Mesh(a)==beforeMesh;
                    c.noCommittedExtraAuthor=c.authorsAfter==c.authorsBefore;
                    c.actualEndpoint=End(a,first);c.actualLength=Length(a);
                    c.actualPressPlane=f.PressPlane;c.actualReleasePlane=f.ReleasePlane;
                    c.expectedEndpoint=fullRetraction?endpoint:endpoint+Vector3.right*(deltas.Last()*sign);
                    if(sceneGui&&!fullRetraction)c.expectedEndpoint=endpoint+f.ReleasePlane-f.PressPlane;
                    c.expectedLength=inward?4:fullRetraction?8:13;
                    if(sceneGui&&!fullRetraction)c.expectedLength=first?8-c.expectedEndpoint.x:c.expectedEndpoint.x;
                    c.endpointError=Vector3.Distance(c.actualEndpoint,c.expectedEndpoint);
                    if(!fullRetraction&&!newStroke&&!opening)UndoRedo(a,c,before,beforeMesh,kit);
                    Need(c.began,"gesture did not begin");
                    Need(c.noCommittedExtraAuthor,"retraction created an independent bridge author");
                    if(opening)
                    {
                        Need(!c.committed&&c.oldAuthorUnchanged,"inward trim silently destroyed or moved an enabled opening instead of rejecting it");
                    }
                    else if(fullRetraction)
                    {
                        if(crossBase)Need(c.candidateClearedWhenRetracted,"crossing the extension base did not immediately clear the live outward candidate");
                        Need(!c.committed,"returning completely to this stroke's starting anchor committed a stale farther candidate");
                        Need(c.oldAuthorUnchanged,"fully retracted stroke changed the original author or actual mesh");
                    }
                    else
                    {
                        Need(c.committed&&c.sameAuthor,"retracted/shortened endpoint did not commit to the same author: "+c.lastStatus);
                        Need(c.endpointError<.11f,"endpoint kept stale forward extent instead of the live retracted pointer; expected "+c.expectedEndpoint+", actual "+c.actualEndpoint);
                        Need(Mathf.Abs(c.actualLength-c.expectedLength)<.11f,"retraction authored a loop or kept overshoot; length expected "+c.expectedLength+", actual "+c.actualLength);
                        Need(c.undoRestored&&c.redoRestored,"one Undo/Redo did not restore the exact prior/final route and actual mesh");
                    }
                }
            }
            catch(Exception e){var root=e.GetBaseException();c.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";c.error=root.ToString();}
            return c;
        }
        static MethodInfo HeightMethod()
        {
            var method=typeof(ReplicaWindow).GetMethod("SetDrawHeight",BindingFlags.Instance|BindingFlags.Public,null,new[]{typeof(float)},null);
            Need(method!=null&&method.ReturnType==typeof(bool),"missing public bool SetDrawHeight(float targetWorldY); height contract is not implemented");return method;
        }
        static Vector3 CandidateEnd(ReplicaAuthor a)
        {
            var s=ReplicaSession.Get(a);FixtureNeed(s.HasCandidate,"fixture has no live bridge candidate");var n=s.Candidate.Document.Nodes.Last();
            return a.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z));
        }
        static bool HasNoZeroSpans(RouteDocument doc)
        {
            for(int i=1;i<doc.Nodes.Count;i++)
            {var a=doc.Nodes[i-1];var b=doc.Nodes[i];float distance=Vector2.Distance(new Vector2(a.X,a.Z),new Vector2(b.X,b.Z));if(distance<.005f||Mathf.Abs(a.Y-b.Y)>distance*.5f+.0001f)return false;}return true;
        }
        static string PreviewMesh(ReplicaAuthor a)
        {var t=a.transform.Find("__RoutePreview");FixtureNeed(t!=null,"live candidate has no actual preview mesh");return ReplicaGeometry.Fingerprint(t.gameObject);}
        static Check Height(int kind)
        {
            var names=new[]{"api-height-same-tip-edits-profile-without-zero-span","api-height-invalid-range-and-slope-keep-valid-candidate","api-height-absolute-world-converts-author-local","scene-shift-height-locks-xz-and-normal-drag-resumes-without-jump"};
            var c=new Check{name=names[kind],level=kind==3?"SYNTHETIC_SCENEGUI":"WINDOW_API"};
            try
            {
                var method=HeightMethod();
                using(var f=new Fixture(kind==3))
                {
                    if(kind==3){c.cameraPixelWidth=f.View.camera.pixelWidth;c.cameraPixelHeight=f.View.camera.pixelHeight;c.nativeWindowRect=f.View.position;}
                    var a=f.Author;if(kind==2)a.transform.position=Vector3.up;
                    var kit=a.Kit;string before=a.DocumentJson,beforeMesh=Mesh(a);var oldDoc=a.Read();var endpoint=End(a);var press=endpoint+(kind==3?Vector3.forward*.8f:Vector3.zero);
                    c.authorsBefore=Authors().Length;c.initialHeight=endpoint.y;
                    if(kind==3){f.At(press,EventType.MouseDown);f.At(press+Vector3.right*4,EventType.MouseDrag);}
                    else{f.Window.BeginDraw(press);f.Window.DragDraw(press+Vector3.right*4);}
                    c.began=f.Window.Drawing;var tipBefore=CandidateEnd(a);Vector3 target;
                    if(kind==3)
                    {
                        // Sensitivity is a UI choice. Send real upward pixels
                        // until its first .25m step, checking XZ after every
                        // event; this never fabricates height through the API.
                        var raised=tipBefore;
                        for(int i=0;i<48&&raised.y<=tipBefore.y+.01f;i++)
                        {
                            f.AtGuiDelta(Vector2.up*-1,EventModifiers.Shift);c.shiftPixels++;
                            raised=CandidateEnd(a);
                            Need(Vector2.Distance(new Vector2(raised.x,raised.z),new Vector2(tipBefore.x,tipBefore.z))<.02f,"Shift vertical drag moved the locked XZ endpoint");
                        }
                        float dy=raised.y-tipBefore.y;
                        Need(dy>=.24f&&Mathf.Abs(dy/.25f-Mathf.Round(dy/.25f))<.001f,"Shift upward pixels did not produce a positive quarter-metre height step");
                        f.AtGuiDelta(Vector2.zero,EventModifiers.None);var released=CandidateEnd(a);var planeAtRelease=f.LastPlane;
                        Need(Vector3.Distance(released,raised)<.02f,"releasing Shift with stationary pointer jumped the endpoint");
                        f.AtGuiDelta(Vector2.right*8,EventModifiers.None);var moved=CandidateEnd(a);var planeMotion=f.LastPlane-planeAtRelease;
                        target=raised+planeMotion;target.y=raised.y;
                        Need(Vector3.Distance(moved,target)<.11f,"ordinary drag after Shift did not follow independent actual pixel displacement without a jump");
                        f.AtGuiDelta(Vector2.zero,EventModifiers.None,EventType.MouseUp);c.committed=a.DocumentJson!=before;
                    }
                    else
                    {
                        float worldHeight=kind==2?4:3;
                        Need((bool)method.Invoke(f.Window,new object[]{worldHeight}),"valid same-tip height request was rejected: "+f.Window.Status);
                        target=new Vector3(tipBefore.x,worldHeight,tipBefore.z);
                        Need(Vector3.Distance(CandidateEnd(a),target)<.02f,"height API changed XZ or did not honor absolute world height");
                        if(kind==0)
                        {
                            target.y=3.25f;Need((bool)method.Invoke(f.Window,new object[]{target.y}),"second same-tip height request was rejected");
                            Need(Vector3.Distance(CandidateEnd(a),target)<.02f,"repeated same-tip height did not update the height profile");
                        }
                        if(kind==1)
                        {
                            string candidate=JsonUtility.ToJson(ReplicaSession.Get(a).Candidate.Document),mesh=PreviewMesh(a);c.rejectedHeightKeptCandidate=true;
                            c.rangeRejected=!(bool)method.Invoke(f.Window,new object[]{-.25f});
                            c.rejectedHeightKeptCandidate&=candidate==JsonUtility.ToJson(ReplicaSession.Get(a).Candidate.Document)&&mesh==PreviewMesh(a);
                            c.rangeRejected&=!(bool)method.Invoke(f.Window,new object[]{8.25f});
                            c.rejectedHeightKeptCandidate&=candidate==JsonUtility.ToJson(ReplicaSession.Get(a).Candidate.Document)&&mesh==PreviewMesh(a);
                            c.slopeRejected=!(bool)method.Invoke(f.Window,new object[]{5f});
                            c.rejectedHeightKeptCandidate&=candidate==JsonUtility.ToJson(ReplicaSession.Get(a).Candidate.Document)&&mesh==PreviewMesh(a);
                            Need(c.rangeRejected&&c.slopeRejected&&c.rejectedHeightKeptCandidate,"invalid range/slope height changed or removed the last valid actual candidate");
                        }
                        Need(a.DocumentJson==before,"height preview committed before release");
                        c.noZeroLengthSpans=HasNoZeroSpans(ReplicaSession.Get(a).Candidate.Document);
                        Need(c.noZeroLengthSpans,"same-XZ height change appended a vertical zero-length segment or violated slope");
                        c.committed=f.Window.EndDraw();
                    }
                    c.lastStatus=f.Window.Status;c.actualEndpoint=End(a);c.expectedEndpoint=target;c.endpointError=Vector3.Distance(c.actualEndpoint,target);c.finalHeight=c.actualEndpoint.y;
                    c.sameAuthor=f.Window.Author==a&&a.Kit==kit;c.authorsAfter=Authors().Length;c.noZeroLengthSpans=HasNoZeroSpans(a.Read());
                    UndoRedo(a,c,before,beforeMesh,kit);
                    Need(c.began&&c.committed&&c.sameAuthor&&c.authorsAfter==c.authorsBefore,"height gesture failed to update one existing bridge author: "+c.lastStatus);
                    Need(c.endpointError<.11f&&c.noZeroLengthSpans,"committed height differs from the live endpoint or has invalid zero-length/slope spans");
                    Need(a.Read().Nodes.Count>=2&&JsonUtility.ToJson(a.Read().Nodes[0])==JsonUtility.ToJson(oldDoc.Nodes[0])&&JsonUtility.ToJson(a.Read().Nodes[1])==JsonUtility.ToJson(oldDoc.Nodes[1]),"height edit rewrote the pre-existing bridge instead of this gesture's profile");
                    if(kind==2)Need(Mathf.Abs(a.Read().Nodes.Last().Y-3)<.001f,"world height was stored as unconverted local height");
                    Need(c.undoRestored&&c.redoRestored,"one native Undo/Redo did not restore route and real mesh after height drawing");
                }
            }
            catch(Exception e){var root=e.GetBaseException();c.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";c.error=root.ToString();}
            return c;
        }
        public static void Red(){Run("stroke-retraction-height-red");}
        public static void Green(){Run("stroke-retraction-height-green");}
        static void Run(string name)
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Use the existing isolated background QA project.");
            var r=new Report();
            r.checks.Add(Retraction("api-tail-live4-6-back4-back2-continue5",false));
            r.checks.Add(Retraction("api-first-live4-6-back4-back2-continue5",false,false,true));
            r.checks.Add(Retraction("api-tail-completely-retract-keeps-original",false,true));
            // User-defined interaction change: the first outward movement
            // latches extension mode. A later fast move past the original port
            // retracts only this stroke, never switches into trimming old work.
            r.checks.Add(Retraction("api-outward-then-retract-past-base-does-not-trim-old",false,fullRetraction:true,crossBase:true));
            r.checks.Add(Retraction("api-new-completely-retract-creates-no-author",false,true,false,false,true));
            r.checks.Add(Retraction("api-existing-tail-inward-shortens-and-undo",false,false,false,true));
            r.checks.Add(Retraction("api-existing-first-inward-shortens-and-undo",false,false,true,true));
            r.checks.Add(Retraction("api-inward-trim-preserves-enabled-opening",false,false,false,true,false,true));
            r.checks.Add(Retraction("scene-tail-live-retract-and-continue5",true));
            r.checks.Add(Retraction("scene-tail-completely-retract-keeps-original",true,true));
            for(int i=0;i<4;i++)r.checks.Add(Height(i));
            r.status=r.checks.Any(c=>c.status=="ERROR")?"ERROR":r.checks.All(c=>c.status=="PASS")?"PASS":"FAIL";
            var output=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required");
            Directory.CreateDirectory(Path.Combine(output,"reports"));File.WriteAllText(Path.Combine(output,"reports",name+".json"),JsonUtility.ToJson(r,true));
            foreach(var c in r.checks)Debug.Log("STROKE_RETRACTION_HEIGHT "+c.name+" "+c.status+" "+c.error);
            EditorApplication.Exit(r.status=="PASS"?0:1);
        }
    }
}
