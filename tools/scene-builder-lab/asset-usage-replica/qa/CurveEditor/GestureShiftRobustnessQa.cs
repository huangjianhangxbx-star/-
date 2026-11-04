using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.BridgeReplica.Editor;

namespace XingHai.BridgeReplica.QA
{
    // Observational matrix: a clearly explained height constraint is LIMITED,
    // not proof that a common large mouse gesture works. Lost native events,
    // silent no-change, and rejected demonstrably feasible requests stay red.
    public static class GestureShiftRobustnessQa
    {
        static readonly BindingFlags Hidden=BindingFlags.Instance|BindingFlags.NonPublic;
        static readonly MethodInfo SceneGui=typeof(ReplicaWindow).GetMethod("SceneGUI",Hidden);
        static readonly FieldInfo Scratch=typeof(ReplicaWindow).GetField("scratch",Hidden);
        static readonly FieldInfo LastStroke=typeof(ReplicaWindow).GetField("lastStroke",Hidden);
        [Serializable] sealed class Check
        {
            public string name,status="PASS",classification,error,messageBefore,messageAfter;
            public string messageSource="ReplicaWindow.Status, the text used by the Window OnGUI HelpBox; not an OCR capture of the separate SceneView overlay.";
            public bool newStroke,hadCandidate,hasCandidateAfter,hasAutomaticApproach,shiftEventDelivered,heightChanged,
                promptChanged,estimatedRequestFeasible,committedAuthorUnchanged,continuing,rejectedTail,waitingForLength,shiftHeightMode;
            public bool constrainedOracle,requestClipped,concreteRangePrompt,candidateValid,actualPreviewMeshValid,
                automaticEnvelopeVerified,originalAutomaticProfileLowered,reversalPerformed,shiftRayHitOptionalPlane;
            public float requestedStrokeLength,actualStrokeLength,requestedPixels,deliveredPixels,requestedHeightDelta,
                lastProfileRunLength,lastProfileStartY,requestedLocalY,tipHeightDelta,xzMovement,rawPlanarLength,
                oracleMinHeight,oracleMaxHeight,oracleTargetHeight,linearProfileMaximumError,envelopeMaximumError,
                reversalExpectedY,reversalActualY,reversalEnvelopeMaximumError;
            public int actualPreviewVertices,trueEnvelopeCrossings,missingEnvelopeCrossings,cameraPixelWidth,cameraPixelHeight;
            public Rect nativeWindowRect;
            public Vector2 actualGuiBefore,actualGuiAfter;
            public Vector3 tipBefore,tipAfter;
            public List<RouteNode> strokeBefore=new List<RouteNode>(),strokeAfter=new List<RouteNode>();
        }
        [Serializable] sealed class Report
        {
            public string status="FAIL",engine=Application.unityVersion,
                scope="Real native SceneView mouse press, planar drag and one fast Shift mouse jump. No Event coordinate mutation, no physical mouse claim. LIMITED means an explicitly explained no-motion constraint, not usability acceptance.";
            public string baselineSourceAudit="HeightDrag requests the full target from its original mouse/Y anchor. SetDrawHeight rejects a whole too-steep target and preserves the prior candidate; it does not partially advance to the feasible boundary. Before a new >=0.5m stroke it only updates message. The baseline continuing SceneView overlay can prefer Shift-height text over that prerequisite message; runtime branch flags are recorded, not presented as rendered-text capture.";
            public bool physicalInput=false,expectConstrained;
            public int changed,limited,silentNoChange,eventErrors,feasibleRejected;
            public List<Check> checks=new List<Check>();
        }
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException("SYMPTOM: "+message);}
        static void FixtureNeed(bool value,string message){if(!value)throw new InvalidOperationException("FIXTURE: "+message);}
        static bool Flag(ReplicaWindow w,string name){var f=typeof(ReplicaWindow).GetField(name,Hidden);return f!=null&&(bool)f.GetValue(w);}
        static float Length(IList<RouteNode> n)
        {float result=0;for(int i=1;i<n.Count;i++)result+=Vector2.Distance(new Vector2(n[i-1].X,n[i-1].Z),new Vector2(n[i].X,n[i].Z));return result;}
        static string Mesh(ReplicaAuthor a){return ReplicaGeometry.Fingerprint(ReplicaSession.Get(a).Geometry);}

        sealed class Fixture:IDisposable
        {
            public ReplicaWindow Window;public SceneView View;public ReplicaAuthor Existing;
            public Vector2 LastMouse;public bool LastInputDelivered,LastPointerRayHit;public Vector3 PressPlane,LastPlane;
            readonly float pointerPlaneY;
            readonly EventHost events;
            public Fixture(bool fresh,float length)
            {
                pointerPlaneY=fresh?0:2;
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Selection.activeGameObject=null;Undo.ClearAll();
                FixtureNeed(SceneGui!=null&&Scratch!=null&&LastStroke!=null,"Window observation hooks are missing");
                Window=ScriptableObject.CreateInstance<ReplicaWindow>();
                SceneView.duringSceneGui-=(Action<SceneView>)Delegate.CreateDelegate(typeof(Action<SceneView>),Window,SceneGui);
                var d=new RouteDocument{SchemaVersion=2,Id="shift-robustness",Width=2,KitId="workshop.bridge.A",KitVersion="1"};
                d.Nodes.Add(new RouteNode{Id="first",X=0,Y=2,Z=0});d.Nodes.Add(new RouteNode{Id="last",X=8,Y=2,Z=0});
                Existing=new GameObject("Shift_matrix_original_bridge").AddComponent<ReplicaAuthor>();var session=ReplicaSession.Get(Existing);
                FixtureNeed(session.Preview(d,ReplicaKitRegistry.EnsureBase())&&session.ApplyNew(),"ordinary flat fixture cannot build: "+session.Status);
                Window.Select(Existing);Window.SetDrawMode(true);Undo.ClearAll();
                View=ScriptableObject.CreateInstance<SceneView>();View.wantsMouseMove=true;View.Show();View.position=new Rect(0,0,1100,800);View.Focus();
                View.LookAt(new Vector3((fresh?24:8)+length*.5f,fresh?0:2,0),Quaternion.Euler(55,-20,0),8,true,true);events=new EventHost(View);
                events.Deliver(new Event{type=EventType.Layout},()=>FixtureNeed(View.camera.pixelHeight>=600,"native camera viewport too small after Show/resize: "+View.camera.pixelWidth+"x"+View.camera.pixelHeight+", window="+View.position));
            }
            public ReplicaAuthor LiveAuthor{get{return (ReplicaAuthor)Scratch.GetValue(Window)??Existing;}}
            public RouteDocument Stroke{get{return (RouteDocument)LastStroke.GetValue(Window);}}
            public Vector3 Tip(Vector3 fallback)
            {
                var a=LiveAuthor;var session=ReplicaSession.Get(a);if(!session.HasCandidate)return fallback;
                var n=session.Candidate.Document.Nodes.Last();return a.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z));
            }
            public void At(Vector3 world,EventType type)
            {
                Vector2 gui=LastMouse,native=LastMouse;
                events.Deliver(new Event{type=EventType.Layout,mousePosition=LastMouse},()=>{
                    gui=HandleUtility.WorldToGUIPoint(world);native=GUIUtility.GUIToScreenPoint(gui)-View.position.position;
                });Send(gui,native,type,EventModifiers.None,type!=EventType.MouseUp||!Flag(Window,"shiftHeightMode"));
            }
            public void ShiftJump(float upwardPixels)
            {
                var gui=LastMouse+new Vector2(0,-upwardPixels);Vector2 native=gui;
                events.Deliver(new Event{type=EventType.Layout,mousePosition=LastMouse},()=>{native=GUIUtility.GUIToScreenPoint(gui)-View.position.position;});
                Send(gui,native,EventType.MouseDrag,EventModifiers.Shift,false);
            }
            void Send(Vector2 gui,Vector2 native,EventType type,EventModifiers modifiers,bool requirePlane)
            {
                LastInputDelivered=false;Vector2 actual=gui;var e=new Event{type=type,button=0,modifiers=modifiers,mousePosition=native,delta=gui-LastMouse};
                events.Deliver(e,()=>{
                    FixtureNeed(Vector2.Distance(Event.current.mousePosition,gui)<=.75f,"native pointer coordinate mismatch; expected "+gui+", actual "+Event.current.mousePosition);
                    if(Event.current.type==type)
                    {
                        actual=Event.current.mousePosition;LastInputDelivered=true;
                        var ray=HandleUtility.GUIPointToWorldRay(actual);float distance;
                        LastPointerRayHit=new Plane(Vector3.up,new Vector3(0,pointerPlaneY,0)).Raycast(ray,out distance);
                        // Shift height uses screen Y alone. A pointer beyond
                        // the horizon need not intersect the horizontal plane;
                        // ordinary planar drawing still strictly requires it.
                        if(requirePlane)FixtureNeed(LastPointerRayHit,"independent native pixel ray missed the gesture's horizontal plane");
                        if(LastPointerRayHit){LastPlane=ray.GetPoint(distance);if(type==EventType.MouseDown)PressPlane=LastPlane;}
                    }
                    SceneGui.Invoke(Window,new object[]{View});
                });LastMouse=actual;FixtureNeed(LastInputDelivered,"native target pointer event was not invoked");
            }
            public void Dispose()
            {
                if(Window!=null){Window.CancelInput();UnityEngine.Object.DestroyImmediate(Window);}if(events!=null)events.Dispose();if(View!=null)View.Close();
                if(Existing!=null)ReplicaGeometry.Destroy(Existing.gameObject);
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
                if(e.type!=EventType.Layout)Deliver(new Event{type=EventType.Layout,button=e.button,modifiers=e.modifiers,mousePosition=e.mousePosition},action);
                int before=delivered,callbacksBefore=callbacks;bool sent=false;trace.Clear();pending=action;expected=e.type;failure=null;try{sent=view.SendEvent(e);}finally{pending=null;}
                if(failure!=null)throw failure;FixtureNeed(delivered==before+1,"SceneView did not deliver "+expected+"; sent="+sent+",callbacks="+(callbacks-callbacksBefore)+",trace="+string.Join(" | ",trace));
            }
            public void Dispose(){SceneView.duringSceneGui-=OnGui;pending=null;}
        }
        static bool ConcreteRange(string text,float min,float max)
        {
            if(string.IsNullOrEmpty(text)||!(text.Contains("范围")||text.Contains("可达")||text.Contains("允许")||text.Contains("上限")||text.Contains("下限")||text.Contains("边界")))return false;
            var values=Regex.Matches(text,@"\d+(?:\.\d+)?").Cast<Match>().Select(m=>float.Parse(m.Value,System.Globalization.CultureInfo.InvariantCulture)).ToArray();
            return values.Any(v=>Mathf.Abs(v-min)<.011f)&&values.Any(v=>Mathf.Abs(v-max)<.011f);
        }
        static float AtXZ(IList<RouteNode> nodes,RouteNode point)
        {
            float best=float.MaxValue,height=0;
            for(int i=1;i<nodes.Count;i++)
            {
                var a=nodes[i-1];var b=nodes[i];float dx=b.X-a.X,dz=b.Z-a.Z,den=dx*dx+dz*dz;
                float t=den<.00000001f?0:Mathf.Clamp01(((point.X-a.X)*dx+(point.Z-a.Z)*dz)/den);
                float x=a.X+dx*t-point.X,z=a.Z+dz*t-point.Z,dist=x*x+z*z;
                if(dist<best){best=dist;height=a.Y+(b.Y-a.Y)*t;}
            }
            Need(best<.000001f,"height envelope changed the reference XZ contour");return height;
        }
        static float VerifyAutoEnvelope(IList<RouteNode> reference,IList<RouteNode> after,float target,Check c,bool countCrossings)
        {
            float total=Length(reference),at=0,start=reference[0].Y;bool raising=target>=reference[reference.Count-1].Y;float error=0;
            var samples=reference.Select(n=>n.Clone()).Concat(after.Select(n=>n.Clone())).ToList();
            for(int i=1;i<reference.Count;i++)
            {
                var a=reference[i-1];var b=reference[i];float run=Vector2.Distance(new Vector2(a.X,a.Z),new Vector2(b.X,b.Z));
                float d0=a.Y-(start+(target-start)*(at/total)),d1=b.Y-(start+(target-start)*((at+run)/total));
                if(d0*d1<-.00000001f)
                {
                    float t=d0/(d0-d1);var cross=new RouteNode{X=a.X+(b.X-a.X)*t,Z=a.Z+(b.Z-a.Z)*t,Y=a.Y+(b.Y-a.Y)*t};samples.Add(cross);
                    if(countCrossings)
                    {
                        c.trueEnvelopeCrossings++;
                        if(!after.Any(n=>Vector2.Distance(new Vector2(n.X,n.Z),new Vector2(cross.X,cross.Z))<.001f))c.missingEnvelopeCrossings++;
                    }
                }
                at+=run;
            }
            // These native fixtures draw one straight XZ stroke. Project each
            // sampled reference/crossing/after node onto that original segment,
            // independently of the production height-profile implementation.
            var first=reference[0];var last=reference[reference.Count-1];float vx=last.X-first.X,vz=last.Z-first.Z,denom=vx*vx+vz*vz;
            foreach(var p in samples)
            {
                float t=Mathf.Clamp01(((p.X-first.X)*vx+(p.Z-first.Z)*vz)/denom);
                float old=AtXZ(reference,p),line=start+(target-start)*t;
                float expected=raising?Mathf.Max(old,line):Mathf.Min(old,line),actual=AtXZ(after,p);
                error=Mathf.Max(error,Mathf.Abs(actual-expected));
                if(raising&&actual<old-.001f)c.originalAutomaticProfileLowered=true;
            }
            Need(!c.originalAutomaticProfileLowered,"raising the new automatic bridge lowered part of its original automatic profile");
            if(countCrossings)Need(c.missingEnvelopeCrossings==0,"automatic/linear envelope crossing was not retained as a real profile node");
            Need(error<.001f,"new automatic profile did not match the reference max/min envelope; max error="+error);return error;
        }
        static void ConstrainedOracle(Fixture f,Check c,float length)
        {
            c.constrainedOracle=true;
            float anchorY=c.newStroke?0:2,effectiveLength=c.rawPlanarLength;
            if(!c.newStroke&&length==0)
            {
                var d=f.Existing.Read();var neighbour=d.Nodes[d.Nodes.Count-2];var end=d.Nodes.Last();
                anchorY=neighbour.Y;effectiveLength=Vector2.Distance(new Vector2(neighbour.X,neighbour.Z),new Vector2(end.X,end.Z));
            }
            // Independent arithmetic from actual delivered pixel rays: first
            // explicit height uses the whole new stroke, not auto-approach keys.
            // These fixtures have identity author transforms, so local/world Y
            // coincide. Separate existing tests cover translated-author APIs.
            float lo=Mathf.Max(0,anchorY-effectiveLength*.5f),hi=Mathf.Min(8,anchorY+effectiveLength*.5f);
            c.oracleMinHeight=Mathf.Ceil((lo-.00001f)/.25f)*.25f;
            c.oracleMaxHeight=Mathf.Floor((hi+.00001f)/.25f)*.25f;
            float requested=c.tipBefore.y+c.requestedHeightDelta;
            c.oracleTargetHeight=Mathf.Clamp(requested,c.oracleMinHeight,c.oracleMaxHeight);
            c.requestClipped=Mathf.Abs(requested-c.oracleTargetHeight)>.001f;
            c.concreteRangePrompt=ConcreteRange(c.messageAfter,c.oracleMinHeight,c.oracleMaxHeight);
            bool shouldMove=Mathf.Abs(c.oracleTargetHeight-c.tipBefore.y)>=.24f;
            bool belowMinimum=length>0&&c.rawPlanarLength<.5f&&!shouldMove;
            if(belowMinimum)
            {
                Need(!c.heightChanged&&c.messageAfter!=null&&c.messageAfter.Contains("0.5"),"sub-half-metre input changed height or failed to explain the minimum new-stroke length");
                c.classification="NO_CHANGE_BELOW_MINIMUM_DRAW_LENGTH";return;
            }
            Need(Mathf.Abs(c.tipAfter.y-c.oracleTargetHeight)<.02f,"human Shift jump did not reach its independently computed reachable quarter-metre target; expected "+c.oracleTargetHeight+", actual "+c.tipAfter.y+", range "+c.oracleMinHeight+".."+c.oracleMaxHeight+"; "+c.messageAfter);
            if(c.requestClipped)Need(c.concreteRangePrompt,"clipped/boundary Shift request did not display the concrete reachable numeric height range; "+c.messageAfter);
            if(!shouldMove)
            {
                Need(!c.heightChanged,"request already at the reachable boundary changed height unexpectedly");
                c.classification="NO_CHANGE_AT_BOUNDARY";
            }
            else
            {
                Need(c.heightChanged&&c.hasCandidateAfter,"at least one reachable quarter-metre step existed but the large human Shift gesture froze");
                c.classification=c.requestClipped?"HEIGHT_CHANGED_CLIPPED_TO_REACHABLE_QUARTER":"HEIGHT_CHANGED";
            }
            if(c.hasCandidateAfter)
            {
                var live=f.LiveAuthor;var candidate=ReplicaSession.Get(live).Candidate.Document;
                c.candidateValid=ReplicaRoute.Solve(candidate).Valid;
                for(int i=0;i<candidate.Nodes.Count;i++)
                {
                    var n=candidate.Nodes[i];c.candidateValid&=n.Y>=0&&n.Y<=8;
                    if(i>0){var p=candidate.Nodes[i-1];float run=Vector2.Distance(new Vector2(p.X,p.Z),new Vector2(n.X,n.Z));c.candidateValid&=run>=.005f&&Mathf.Abs(n.Y-p.Y)<=run*.5f+.0001f;}
                }
                var preview=live.transform.Find("__RoutePreview");var meshes=preview==null?new MeshFilter[0]:preview.GetComponentsInChildren<MeshFilter>(true);
                c.actualPreviewVertices=meshes.Where(m=>m.sharedMesh!=null).Sum(m=>m.sharedMesh.vertexCount);
                c.actualPreviewMeshValid=meshes.Length>0&&c.actualPreviewVertices>0&&meshes.All(m=>m.sharedMesh!=null&&m.GetComponent<MeshCollider>()!=null&&m.GetComponent<MeshCollider>().sharedMesh==m.sharedMesh);
                Need(c.candidateValid&&c.actualPreviewMeshValid,"constrained human height produced an invalid range/slope candidate or lost its actual source mesh/collider");
            }
            if(shouldMove&&length>0)
            {
                var stroke=f.Stroke;Need(stroke!=null&&stroke.Nodes.Count>=2,"height change has no editable current-stroke profile");
                if(c.newStroke&&c.hasAutomaticApproach)
                {
                    c.envelopeMaximumError=VerifyAutoEnvelope(c.strokeBefore,stroke.Nodes,c.oracleTargetHeight,c,true);
                    c.automaticEnvelopeVerified=true;return;
                }
                float total=Length(stroke.Nodes),at=0,start=c.newStroke?0:2;
                for(int i=0;i<stroke.Nodes.Count;i++)
                {
                    if(i>0)at+=Vector2.Distance(new Vector2(stroke.Nodes[i-1].X,stroke.Nodes[i-1].Z),new Vector2(stroke.Nodes[i].X,stroke.Nodes[i].Z));
                    float expected=start+(c.oracleTargetHeight-start)*(at/total);
                    c.linearProfileMaximumError=Mathf.Max(c.linearProfileMaximumError,Mathf.Abs(stroke.Nodes[i].Y-expected));
                }
                    Need(c.linearProfileMaximumError<.001f,"flat-reference human height did not use the whole new stroke's linear start-to-tip profile");
            }
        }
        static Check Observe(Fixture f,bool fresh,float length,float pixels,bool expectConstrained)
        {
            var c=new Check{name=(fresh?"new-auto-approach":"existing-flat-port")+"-length"+length+"-shift"+pixels+"px",newStroke=fresh,requestedStrokeLength=length,requestedPixels=pixels,requestedHeightDelta=pixels*.25f/12};
            try
            {
                c.cameraPixelWidth=f.View.camera.pixelWidth;c.cameraPixelHeight=f.View.camera.pixelHeight;c.nativeWindowRect=f.View.position;
                f.Window.CancelInput();f.Window.SetDrawMode(true);
                string original=f.Existing.DocumentJson,originalMesh=Mesh(f.Existing);
                var press=fresh?new Vector3(24,0,0):new Vector3(8,2,.8f);var baseTip=fresh?press:new Vector3(8,2,0);
                f.At(press,EventType.MouseDown);FixtureNeed(f.Window.Drawing,"native press did not start the intended drawing gesture");
                if(length>0)f.At(press+Vector3.right*length,EventType.MouseDrag);
                c.rawPlanarLength=Vector2.Distance(new Vector2(f.PressPlane.x,f.PressPlane.z),new Vector2(f.LastPlane.x,f.LastPlane.z));
                c.hadCandidate=ReplicaSession.Get(f.LiveAuthor).HasCandidate;c.tipBefore=f.Tip(baseTip);c.messageBefore=f.Window.Status;c.actualGuiBefore=f.LastMouse;
                var stroke=f.Stroke;if(stroke!=null)
                {
                    c.strokeBefore=stroke.Nodes.Select(n=>n.Clone()).ToList();c.actualStrokeLength=Length(stroke.Nodes);
                    c.hasAutomaticApproach=stroke.Nodes.Max(n=>n.Y)>stroke.Nodes.Last().Y+.01f;
                    var keys=CurveGesture.ProfileKeys(stroke);if(keys.Count>1)
                    {
                        var a=keys[keys.Count-2];var b=keys.Last();c.lastProfileRunLength=Vector2.Distance(new Vector2(a.X,a.Z),new Vector2(b.X,b.Z));c.lastProfileStartY=a.Y;
                        c.requestedLocalY=b.Y+c.requestedHeightDelta;
                        c.estimatedRequestFeasible=c.actualStrokeLength>=.5f&&c.requestedLocalY>=0&&c.requestedLocalY<=8&&Mathf.Abs(c.requestedLocalY-a.Y)<=c.lastProfileRunLength*.5f+.0001f;
                    }
                }
                f.ShiftJump(pixels);c.shiftEventDelivered=f.LastInputDelivered;c.actualGuiAfter=f.LastMouse;c.deliveredPixels=c.actualGuiBefore.y-c.actualGuiAfter.y;
                c.shiftRayHitOptionalPlane=f.LastPointerRayHit;
                c.tipAfter=f.Tip(baseTip);c.hasCandidateAfter=ReplicaSession.Get(f.LiveAuthor).HasCandidate;c.messageAfter=f.Window.Status;
                c.tipHeightDelta=c.tipAfter.y-c.tipBefore.y;c.heightChanged=Mathf.Abs(c.tipHeightDelta)>.01f;
                c.xzMovement=Vector2.Distance(new Vector2(c.tipAfter.x,c.tipAfter.z),new Vector2(c.tipBefore.x,c.tipBefore.z));c.promptChanged=c.messageAfter!=c.messageBefore;
                c.continuing=Flag(f.Window,"continuing");c.rejectedTail=Flag(f.Window,"rejectedTail");c.waitingForLength=Flag(f.Window,"waitingForLength");c.shiftHeightMode=Flag(f.Window,"shiftHeightMode");
                if(f.Stroke!=null)c.strokeAfter=f.Stroke.Nodes.Select(n=>n.Clone()).ToList();
                c.committedAuthorUnchanged=f.Existing.DocumentJson==original&&Mesh(f.Existing)==originalMesh;
                Need(c.shiftEventDelivered&&Mathf.Abs(c.deliveredPixels-pixels)<=.75f,"large Shift jump was not delivered at its actual native pixel displacement");
                Need(c.committedAuthorUnchanged,"height preview changed the committed bridge before release");
                if(c.hadCandidate||(!fresh&&length==0))Need(c.xzMovement<.02f,"Shift height motion changed the locked XZ endpoint");
                if(expectConstrained)
                {
                    ConstrainedOracle(f,c,length);
                    if(fresh&&length==4&&pixels==120)
                    {
                        // Saturation rebases the mouse/height anchor at the
                        // reached boundary, removing a reverse-motion dead
                        // zone. The shape reference still remains the first
                        // automatic profile, never the raised envelope.
                        c.reversalPerformed=true;f.ShiftJump(-96);var reversed=f.Tip(baseTip);
                        c.reversalExpectedY=Mathf.Clamp(c.oracleTargetHeight-96*.25f/12,c.oracleMinHeight,c.oracleMaxHeight);c.reversalActualY=reversed.y;
                        Need(Mathf.Abs(reversed.y-c.reversalExpectedY)<.02f,"same-Shift reversal stayed locked to the previously raised endpoint");
                        Need(Vector2.Distance(new Vector2(reversed.x,reversed.z),new Vector2(c.tipBefore.x,c.tipBefore.z))<.02f,"same-Shift reversal moved locked XZ");
                        Need(f.Stroke!=null&&ReplicaSession.Get(f.LiveAuthor).HasCandidate&&ReplicaRoute.Solve(ReplicaSession.Get(f.LiveAuthor).Candidate.Document).Valid,"same-Shift reversal lost a valid candidate");
                        c.reversalEnvelopeMaximumError=VerifyAutoEnvelope(c.strokeBefore,f.Stroke.Nodes,c.reversalExpectedY,c,false);
                    }
                    return c;
                }
                if(c.heightChanged)
                {
                    c.classification="HEIGHT_CHANGED";Need(Mathf.Sign(c.tipHeightDelta)==Mathf.Sign(pixels),"Shift height moved opposite the actual pixel direction");
                }
                else if(c.messageAfter!=null&&(c.messageAfter.Contains("先向外")||c.messageAfter.Contains("0.5米")))
                {c.classification="PREREQUISITE_NO_NEW_HALF_METRE";c.status="LIMITED";}
                else if(c.messageAfter!=null&&c.messageAfter.Contains("过陡"))
                {c.classification="WHOLE_SLOPE_REQUEST_REJECTED_NO_PARTIAL_PROGRESS";c.status="LIMITED";}
                else if(c.messageAfter!=null&&(c.messageAfter.Contains("0—8")||c.messageAfter.Contains("0-8")))
                {c.classification="WHOLE_RANGE_REQUEST_REJECTED_NO_PARTIAL_PROGRESS";c.status="LIMITED";}
                else if(c.messageAfter!=null&&c.messageAfter.Contains("红色尾段暂不采用"))
                {c.classification="OTHER_EXPLAINED_HEIGHT_REJECTION";c.status="LIMITED";}
                else
                {c.classification="SILENT_NO_CHANGE";Need(false,"actual Shift event produced no endpoint-Y change and no actionable height/prerequisite explanation; message="+c.messageAfter);}
                if(c.hadCandidate&&c.estimatedRequestFeasible&&!c.heightChanged)
                {c.classification="FEASIBLE_REQUEST_REJECTED";Need(false,"a request inside the observed last height run's range/slope budget produced no height change");}
            }
            catch(Exception e){var root=e.GetBaseException();c.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";c.error=root.ToString();if(c.status=="ERROR")c.classification="NATIVE_EVENT_OR_FIXTURE_ERROR";}
            finally{f.Window.CancelInput();}
            return c;
        }
        public static void Red(){Run("gesture-shift-robustness-red",false);}
        public static void Green(){Run("gesture-shift-robustness-green",true);}
        public static void Diagnostic(){Run("gesture-shift-robustness-diagnostic",false);}
        static void Run(string name,bool expectConstrained)
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Use the existing isolated background QA project.");
            var r=new Report{expectConstrained=expectConstrained};
            using(var f=new Fixture(false,0))foreach(float pixels in new[]{24f,60f,120f})r.checks.Add(Observe(f,false,0,pixels,expectConstrained));
            foreach(bool fresh in new[]{false,true})foreach(float length in new[]{.5f,1f,2f,4f})
            using(var f=new Fixture(fresh,length))
            {
                foreach(float pixels in new[]{24f,60f,120f})r.checks.Add(Observe(f,fresh,length,pixels,expectConstrained));
                if(length==4)foreach(float pixels in new[]{-24f,-60f,-120f})r.checks.Add(Observe(f,fresh,length,pixels,expectConstrained));
            }
            r.changed=r.checks.Count(c=>c.heightChanged);r.limited=r.checks.Count(c=>c.status=="LIMITED");r.eventErrors=r.checks.Count(c=>c.status=="ERROR");
            r.silentNoChange=r.checks.Count(c=>c.classification=="SILENT_NO_CHANGE");r.feasibleRejected=r.checks.Count(c=>c.classification=="FEASIBLE_REQUEST_REJECTED");
            r.status=r.eventErrors>0?"ERROR":r.checks.Any(c=>c.status=="FAIL")?"FAIL":r.limited>0?"LIMITED":"PASS";
            var output=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required");
            Directory.CreateDirectory(Path.Combine(output,"reports"));File.WriteAllText(Path.Combine(output,"reports",name+".json"),JsonUtility.ToJson(r,true));
            foreach(var c in r.checks)Debug.Log("GESTURE_SHIFT_ROBUSTNESS "+c.name+" "+c.status+" "+c.classification+" "+c.error);
            EditorApplication.Exit(r.status=="ERROR"||r.status=="FAIL"?1:0);
        }
    }
}
