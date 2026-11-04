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
    // Deliberate brush corner design is distinct from <=0.08m pointer denoising.
    // Long arms provide room for a real rounded path, with exact final endpoint.
    public static class BrushCornerQa
    {
        static readonly BindingFlags Hidden=BindingFlags.Instance|BindingFlags.NonPublic;
        static readonly MethodInfo SceneGui=typeof(ReplicaWindow).GetMethod("SceneGUI",Hidden);
        static readonly FieldInfo Scratch=typeof(ReplicaWindow).GetField("scratch",Hidden);
        [Serializable] sealed class Miss
        {
            public float arc,side,nearestAuthorSpanEndArc,arcMinusAuthorSpanEnd,nearestSourceStartArc,nearestSourceEndArc,
                sourceStartMinusAuthorSpanEnd,sourceEndMinusAuthorSpanEnd;
            public int nearestAuthorSpanIndex,frameIndex;
            public string nearestAuthorSpanId,diagnosis;
            public Vector3 rayOrigin,surfacePoint,frameLeft,frameRight;
            public double nearestActualTopTriangleDistance,expectedQuadDistance;
            public bool insideExpectedQuad,insideActualTopTriangle;
            public List<CurvePlacement> nearbySourcePlacements=new List<CurvePlacement>();
            public List<NearTriangle> nearestTriangles=new List<NearTriangle>();
        }
        [Serializable] sealed class NearTriangle
        {
            public string mesh;public int triangle;public Vector3 a,b,c,nearestPoint;public double horizontalDistance;
            public bool strictlyInside;public CurvePlacement sourcePlacement;
        }
        sealed class TopTriangle{public string mesh;public int triangle;public Vector3 a,b,c;}
        sealed class Closest{public Vector3 point;public double distance;public bool inside;}
        [Serializable] sealed class Check
        {
            public string name,level,status="PASS",error,lastStatus;
            public bool committed,sameAuthorOrExpectedNewAuthor,oldNodesPreserved,undoRestored,redoRestored,
                curveRetractionAttempted,curveRetractionSucceeded,hairpinRejected,selfCrossRejected;
            public int turningNodes,vertices,walkingRays,walkingMisses,cameraPixelWidth,cameraPixelHeight;
            public Rect nativeWindowRect;
            public float endpointError,minimumMeasuredRadius,maximumTurnDegrees,rawCornerDistance;
            public Vector3 expectedEndpoint,actualEndpoint,retractionPoint;
            public List<Miss> misses=new List<Miss>();
        }
        [Serializable] sealed class Report
        {
            public string status="FAIL",engine=Application.unityVersion,
                scope="Actual Window API and native SceneGUI L brush design, real committed source meshes/colliders, generated-curve retraction and one Undo/Redo. Rounding may intentionally depart by metres from a raw sharp corner; this is not a denoising fidelity test. No physical mouse claim.";
            public bool physicalInput=false;public List<Check> checks=new List<Check>();
        }
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException("SYMPTOM: "+message);}
        static void FixtureNeed(bool value,string message){if(!value)throw new InvalidOperationException("FIXTURE: "+message);}
        static ReplicaAuthor[] Authors(){return UnityEngine.Object.FindObjectsOfType<ReplicaAuthor>().Where(a=>a.Read()!=null).ToArray();}
        static Vector3 NodeWorld(ReplicaAuthor a,RouteNode n){return a.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z));}
        static Vector3 End(ReplicaAuthor a){return NodeWorld(a,a.Read().Nodes.Last());}
        static string Mesh(ReplicaAuthor a){return ReplicaGeometry.Fingerprint(ReplicaSession.Get(a).Geometry);}
        static float XZ(Vector3 a,Vector3 b){return Vector2.Distance(new Vector2(a.x,a.z),new Vector2(b.x,b.z));}
        sealed class Fixture:IDisposable
        {
            public ReplicaWindow Window;public ReplicaAuthor Existing;public SceneView View;public Vector3 PressPlane,ReleasePlane;
            EventHost events;Vector2 lastMouse;
            public Fixture(bool native=false)
            {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Selection.activeGameObject=null;Undo.ClearAll();
                Window=ScriptableObject.CreateInstance<ReplicaWindow>();
                SceneView.duringSceneGui-=(Action<SceneView>)Delegate.CreateDelegate(typeof(Action<SceneView>),Window,SceneGui);
                var d=new RouteDocument{SchemaVersion=2,Id="brush-corner",Width=2,KitId="workshop.bridge.A",KitVersion="1"};
                d.Nodes.Add(new RouteNode{Id="old-first",X=0,Y=2,Z=0});d.Nodes.Add(new RouteNode{Id="old-last",X=8,Y=2,Z=0});
                Existing=new GameObject("Corner_existing_bridge").AddComponent<ReplicaAuthor>();var s=ReplicaSession.Get(Existing);
                FixtureNeed(s.Preview(d,ReplicaKitRegistry.EnsureBase())&&s.ApplyNew(),"ordinary fixture failed: "+s.Status);
                Window.Select(Existing);Window.SetDrawMode(true);Undo.ClearAll();
                if(native)
                {
                    View=ScriptableObject.CreateInstance<SceneView>();View.wantsMouseMove=true;View.Show();View.position=new Rect(0,0,1100,800);View.Focus();
                    View.LookAt(new Vector3(11,2,3),Quaternion.Euler(55,-20,0),12,true,true);events=new EventHost(View);
                    events.Deliver(new Event{type=EventType.Layout},()=>FixtureNeed(View.camera.pixelHeight>=600,"native camera viewport too small after Show/resize: "+View.camera.pixelWidth+"x"+View.camera.pixelHeight+", window="+View.position));
                }
            }
            public ReplicaAuthor Live{get{return (ReplicaAuthor)Scratch.GetValue(Window)??Existing;}}
            public Vector3 CandidateEnd(){var s=ReplicaSession.Get(Live);FixtureNeed(s.HasCandidate,"no live candidate after the first straight arm");return NodeWorld(Live,s.Candidate.Document.Nodes.Last());}
            public void At(Vector3 world,EventType type)
            {
                Vector2 gui=lastMouse,native=lastMouse;
                events.Deliver(new Event{type=EventType.Layout,mousePosition=lastMouse},()=>{gui=HandleUtility.WorldToGUIPoint(world);native=GUIUtility.GUIToScreenPoint(gui)-View.position.position;});
                Vector2 actual=gui;var e=new Event{type=type,button=0,mousePosition=native,delta=gui-lastMouse};
                events.Deliver(e,()=>{
                    FixtureNeed(Vector2.Distance(Event.current.mousePosition,gui)<=.75f,"native GUI coordinate mismatch");
                    if(Event.current.type==type)
                    {
                        actual=Event.current.mousePosition;var ray=HandleUtility.GUIPointToWorldRay(actual);float distance;
                        FixtureNeed(new Plane(Vector3.up,world).Raycast(ray,out distance),"ordinary planar native pointer ray missed");
                        if(type==EventType.MouseDown)PressPlane=ray.GetPoint(distance);if(type==EventType.MouseUp)ReleasePlane=ray.GetPoint(distance);
                    }
                    SceneGui.Invoke(Window,new object[]{View});
                });lastMouse=actual;
            }
            public void Dispose()
            {
                if(Window!=null){Window.CancelInput();UnityEngine.Object.DestroyImmediate(Window);}if(events!=null)events.Dispose();if(View!=null)View.Close();
                foreach(var a in Authors())if(a!=null)ReplicaGeometry.Destroy(a.gameObject);
            }
        }
        sealed class EventHost:IDisposable
        {
            readonly SceneView view;Action pending;EventType expected;Exception failure;int delivered,callbacks;readonly List<string> trace=new List<string>();
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
                if(failure!=null)throw failure;FixtureNeed(delivered==before+1,"SceneView did not deliver "+expected+"; sent="+sent+",callbacks="+(callbacks-callbacksBefore)+",trace="+string.Join(" | ",trace));
            }
            public void Dispose(){SceneView.duringSceneGui-=OnGui;pending=null;}
        }
        static float DistanceToPath(ReplicaAuthor a,Vector3 p)
        {
            var n=a.Read().Nodes;float best=float.MaxValue;
            for(int i=1;i<n.Count;i++)
            {
                var x=NodeWorld(a,n[i-1]);var y=NodeWorld(a,n[i]);float dx=y.x-x.x,dz=y.z-x.z,den=dx*dx+dz*dz;
                float t=den<.0000001f?0:Mathf.Clamp01(((p.x-x.x)*dx+(p.z-x.z)*dz)/den);
                best=Mathf.Min(best,XZ(p,new Vector3(x.x+dx*t,p.y,x.z+dz*t)));
            }return best;
        }
        static double Cross(Vector3 a,Vector3 b,Vector3 p)
        {return ((double)b.x-a.x)*((double)p.z-a.z)-((double)b.z-a.z)*((double)p.x-a.x);}
        static bool StrictInside(Vector3 p,Vector3 a,Vector3 b,Vector3 c)
        {
            if(Math.Abs(Cross(a,b,c))<1e-18)return false;double x=Cross(a,b,p),y=Cross(b,c,p),z=Cross(c,a,p);
            return x>=0&&y>=0&&z>=0||x<=0&&y<=0&&z<=0;
        }
        static Closest Segment(Vector3 p,Vector3 a,Vector3 b)
        {
            double dx=(double)b.x-a.x,dz=(double)b.z-a.z,den=dx*dx+dz*dz;
            double t=den<1e-20?0:Math.Max(0,Math.Min(1,(((double)p.x-a.x)*dx+((double)p.z-a.z)*dz)/den));
            double x=a.x+dx*t,z=a.z+dz*t,ex=p.x-x,ez=p.z-z;
            // Keep distance in double before the diagnostic nearest point is
            // rounded back into Vector3, preserving sub-ULP sliver evidence.
            return new Closest{point=new Vector3((float)x,a.y+(b.y-a.y)*(float)t,(float)z),distance=Math.Sqrt(ex*ex+ez*ez)};
        }
        static Closest Triangle(Vector3 p,Vector3 a,Vector3 b,Vector3 c)
        {
            if(StrictInside(p,a,b,c))return new Closest{inside=true,point=new Vector3(p.x,a.y,p.z),distance=0};
            return new[]{Segment(p,a,b),Segment(p,b,c),Segment(p,c,a)}.OrderBy(q=>q.distance).First();
        }
        static Miss Diagnose(ReplicaAuthor a,CurveResult curve,CurvePlacement[] mapping,List<TopTriangle> triangles,float arc,float side,Vector3 rayOrigin)
        {
            var f=curve.FrameAt(arc);var p=new Vector3(rayOrigin.x,a.transform.TransformPoint(new Vector3(f.X,f.Y,f.Z)).y,rayOrigin.z);
            var span=curve.Spans.OrderBy(s=>Math.Abs(s.EndArc-arc)).First();
            int index=0;while(index<curve.Frames.Count-2&&curve.Frames[index+1].Arc<arc)index++;
            var first=curve.Frames[index];var next=curve.Frames[index+1];
            var l0=a.transform.TransformPoint(new Vector3(first.LeftX,first.Y,first.LeftZ));var r0=a.transform.TransformPoint(new Vector3(first.RightX,first.Y,first.RightZ));
            var l1=a.transform.TransformPoint(new Vector3(next.LeftX,next.Y,next.LeftZ));var r1=a.transform.TransformPoint(new Vector3(next.RightX,next.Y,next.RightZ));
            var quad=new[]{Triangle(p,l0,r0,l1),Triangle(p,r0,r1,l1)}.OrderBy(q=>q.distance).First();
            var m=new Miss{arc=arc,side=side,rayOrigin=rayOrigin,surfacePoint=p,frameIndex=index,
                frameLeft=a.transform.TransformPoint(new Vector3(f.LeftX,f.Y,f.LeftZ)),frameRight=a.transform.TransformPoint(new Vector3(f.RightX,f.Y,f.RightZ)),
                nearestAuthorSpanIndex=span.Index,nearestAuthorSpanId=span.Id,nearestAuthorSpanEndArc=span.EndArc,arcMinusAuthorSpanEnd=arc-span.EndArc,
                insideExpectedQuad=quad.inside,expectedQuadDistance=quad.distance};
            var nearby=mapping.Where(s=>s.role=="deck"||s.role=="tread")
                .OrderBy(s=>Math.Max(0,Math.Max(s.startArc-arc,arc-s.endArc))+Math.Abs(s.lateral-side*curve.Document.Width)*.00001f).Take(8).ToList();
            m.nearbySourcePlacements=nearby;
            if(nearby.Count>0)
            {var s=nearby[0];m.nearestSourceStartArc=s.startArc;m.nearestSourceEndArc=s.endArc;m.sourceStartMinusAuthorSpanEnd=s.startArc-span.EndArc;m.sourceEndMinusAuthorSpanEnd=s.endArc-span.EndArc;}
            var sameHeight=triangles.Where(t=>Math.Abs(t.a.y-p.y)<.0001f&&Math.Abs(t.b.y-p.y)<.0001f&&Math.Abs(t.c.y-p.y)<.0001f).ToList();
            var candidates=sameHeight.Count>0?sameHeight:triangles;
            m.nearestTriangles=candidates.Select(t=>{
                var q=Triangle(p,t.a,t.b,t.c);return new NearTriangle{mesh=t.mesh,triangle=t.triangle,a=t.a,b=t.b,c=t.c,nearestPoint=q.point,horizontalDistance=q.distance,strictlyInside=q.inside,
                    sourcePlacement=mapping.FirstOrDefault(s=>s.role==t.mesh&&t.triangle>=s.firstTriangle&&t.triangle<s.firstTriangle+s.triangleCount)};
            }).OrderBy(t=>t.horizontalDistance).Take(4).ToList();
            if(m.nearestTriangles.Count>0)
            {m.nearestActualTopTriangleDistance=m.nearestTriangles[0].horizontalDistance;m.insideActualTopTriangle=m.nearestTriangles.Any(t=>t.strictlyInside);}
            m.diagnosis=m.insideActualTopTriangle?"ACTUAL_TOP_PROJECTION_COVERS_RAY_BUT_COLLIDER_MISSED":m.insideExpectedQuad?"EXPECTED_STRIP_HAS_ACTUAL_TOP_COVERAGE_GAP":"POINT_OUTSIDE_EXPECTED_QUAD";
            return m;
        }
        static void Audit(ReplicaAuthor a,Check c,Vector3 rawCorner)
        {
            var result=ReplicaRoute.Solve(a.Read());Need(result.Valid&&result.Curve!=null,"committed rounded route is not geometrically valid: "+result.Message);
            var n=a.Read().Nodes;c.minimumMeasuredRadius=float.MaxValue;
            for(int i=1;i<n.Count-1;i++)
            {
                var p=new Vector2(n[i].X-n[i-1].X,n[i].Z-n[i-1].Z);var q=new Vector2(n[i+1].X-n[i].X,n[i+1].Z-n[i].Z);
                float angle=Vector2.Angle(p,q);if(angle<.05f)continue;c.turningNodes++;c.maximumTurnDegrees=Mathf.Max(c.maximumTurnDegrees,angle);
                float cross=Mathf.Abs(p.x*q.y-p.y*q.x);if(cross>.000001f)c.minimumMeasuredRadius=Mathf.Min(c.minimumMeasuredRadius,p.magnitude*q.magnitude*(p+q).magnitude/(2*cross));
            }
            if(c.minimumMeasuredRadius==float.MaxValue)c.minimumMeasuredRadius=0;c.rawCornerDistance=DistanceToPath(a,rawCorner);
            var geometry=ReplicaSession.Get(a).Geometry;FixtureNeed(geometry!=null,"committed bridge has no actual geometry");
            var filters=geometry.GetComponentsInChildren<MeshFilter>(true);c.vertices=filters.Where(f=>f.sharedMesh!=null).Sum(f=>f.sharedMesh.vertexCount);
            Need(c.vertices>0&&filters.All(f=>f.sharedMesh!=null&&f.GetComponent<MeshCollider>()!=null&&f.GetComponent<MeshCollider>().sharedMesh==f.sharedMesh),"actual source meshes and collision are missing or differ");
            var walking=filters.Where(f=>f.name=="deck"||f.name=="tread").ToArray();var decks=walking.Select(f=>f.GetComponent<Collider>()).ToArray();FixtureNeed(decks.Length>0,"no walking source meshes");Physics.SyncTransforms();
            var sourceMap=JsonUtility.FromJson<CurveMapping>(a.MappingJson);FixtureNeed(sourceMap!=null&&sourceMap.placements!=null,"actual source placement map missing");
            var topTriangles=new List<TopTriangle>();
            foreach(var mesh in walking)
            {
                var v=mesh.sharedMesh.vertices;var t=mesh.sharedMesh.triangles;
                for(int i=0;i<t.Length;i+=3)
                {
                    var p=mesh.transform.TransformPoint(v[t[i]]);var q=mesh.transform.TransformPoint(v[t[i+1]]);var r=mesh.transform.TransformPoint(v[t[i+2]]);
                    if(Math.Abs(p.y-q.y)<.0001f&&Math.Abs(p.y-r.y)<.0001f&&Vector3.Cross(q-p,r-p).y>0)
                        topTriangles.Add(new TopTriangle{mesh=mesh.name,triangle=i/3,a=p,b=q,c=r});
                }
            }
            var stations=new List<float>();for(float s=.1f;s<result.Curve.Length-.1f;s+=.211f)stations.Add(s);
            foreach(var span in result.Curve.Spans)foreach(float d in new[]{-.1f,-.04f,-.01f,0,.01f,.04f,.1f})stations.Add(Mathf.Clamp(span.EndArc+d,.005f,result.Curve.Length-.005f));
            foreach(float arc in stations)foreach(float side in new[]{-.45f,0,.45f})
            {
                var f=result.Curve.FrameAt(arc);var origin=a.transform.TransformPoint(new Vector3(f.X+(f.LeftX-f.RightX)*side,12,f.Z+(f.LeftZ-f.RightZ)*side));var ray=new Ray(origin,-a.transform.up);RaycastHit hit;c.walkingRays++;
                if(!decks.Any(d=>d.Raycast(ray,out hit,25))){c.walkingMisses++;c.misses.Add(Diagnose(a,result.Curve,sourceMap.placements,topTriangles,arc,side,origin));}
            }
        }
        static void RetractOnGeneratedCurve(Fixture f,Check c,Vector3 final)
        {
            var snapshot=ReplicaSession.Get(f.Live).Candidate.Curve;
            var corner=snapshot.Frames.Where(p=>p.Arc>8.1f&&Mathf.Abs(p.TangentX)>.25f&&Mathf.Abs(p.TangentZ)>.25f).OrderBy(p=>Mathf.Abs(Mathf.Abs(p.TangentX)-Mathf.Abs(p.TangentZ))).FirstOrDefault();
            Need(corner!=null,"rounding did not produce a generated curved span for the retraction test");c.curveRetractionAttempted=true;
            c.retractionPoint=f.Live.transform.TransformPoint(new Vector3(corner.X,corner.Y,corner.Z));
            f.Window.DragDraw(c.retractionPoint);c.curveRetractionSucceeded=Vector3.Distance(f.CandidateEnd(),c.retractionPoint)<.11f;
            Need(c.curveRetractionSucceeded,"pulling back along the generated rounded curve did not retract to that real designed path");
            foreach(var frame in snapshot.Frames.Where(p=>p.Arc>corner.Arc+.1f))f.Window.DragDraw(f.Live.transform.TransformPoint(new Vector3(frame.X,frame.Y,frame.Z)));
            f.Window.DragDraw(final);Need(Vector3.Distance(f.CandidateEnd(),final)<.11f,"re-extension after generated-curve retraction did not reach the true endpoint");
        }
        static Check Rounded(string name,bool fresh,float turn,bool native=false,bool retract=false)
        {
            var c=new Check{name=name,level=native?"SYNTHETIC_SCENEGUI":"WINDOW_API"};
            try
            {
                using(var f=new Fixture(native))
                {
                    if(native){c.cameraPixelWidth=f.View.camera.pixelWidth;c.cameraPixelHeight=f.View.camera.pixelHeight;c.nativeWindowRect=f.View.position;}
                    var original=f.Existing;string before=original.DocumentJson,beforeMesh=Mesh(original);var beforeDoc=original.Read();var kit=original.Kit;
                    var start=fresh?new Vector3(30,0,0):End(original);var press=start+(native?Vector3.forward*.8f:Vector3.zero);
                    float radians=turn*Mathf.Deg2Rad;var delta=Vector3.right*6+new Vector3(Mathf.Cos(radians),0,Mathf.Sin(radians))*6;var final=start+delta;var pointerFinal=press+delta;
                    if(native){f.At(press,EventType.MouseDown);f.At(press+Vector3.right*6,EventType.MouseDrag);f.At(pointerFinal,EventType.MouseDrag);}
                    else{f.Window.BeginDraw(press);f.Window.DragDraw(press+Vector3.right*6);f.Window.DragDraw(pointerFinal);}
                    if(retract&&Vector3.Distance(f.CandidateEnd(),final)<.11f)RetractOnGeneratedCurve(f,c,final);
                    if(native){f.At(pointerFinal,EventType.MouseUp);c.committed=original.DocumentJson!=before;final=start+f.ReleasePlane-f.PressPlane;}
                    else c.committed=f.Window.EndDraw();
                    var a=f.Window.Author;FixtureNeed(a!=null&&a.Read()!=null,"no committed author to inspect");c.lastStatus=f.Window.Status;c.expectedEndpoint=final;c.actualEndpoint=End(a);c.endpointError=Vector3.Distance(final,c.actualEndpoint);
                    c.sameAuthorOrExpectedNewAuthor=fresh?a!=original&&Authors().Length==2:a==original&&Authors().Length==1;
                    c.oldNodesPreserved=fresh?original.DocumentJson==before&&Mesh(original)==beforeMesh:a.Read().Nodes.Count>=2&&JsonUtility.ToJson(a.Read().Nodes[0])==JsonUtility.ToJson(beforeDoc.Nodes[0])&&JsonUtility.ToJson(a.Read().Nodes[1])==JsonUtility.ToJson(beforeDoc.Nodes[1]);
                    Audit(a,c,start+Vector3.right*6);string after=a.DocumentJson,afterMesh=Mesh(a),id=a.Read().Id;
                    Undo.FlushUndoRecordObjects();Undo.PerformUndo();c.undoRestored=original.DocumentJson==before&&Mesh(original)==beforeMesh&&(!fresh||!Authors().Any(x=>x.Read().Id==id));
                    Undo.PerformRedo();var restored=Authors().Single(x=>x.Read().Id==id);c.redoRestored=restored.DocumentJson==after&&Mesh(restored)==afterMesh&&restored.Kit==kit;
                    Need(c.committed&&c.sameAuthorOrExpectedNewAuthor&&c.oldNodesPreserved,"corner gesture did not commit the expected author/kit or altered prior nodes");
                    Need(c.endpointError<.11f,"large corner stopped at an older prefix instead of the actual final endpoint; expected "+final+", actual "+c.actualEndpoint+"; "+c.lastStatus);
                    Need(c.turningNodes>=3&&c.maximumTurnDegrees<=80.01f&&c.minimumMeasuredRadius>1.01f&&c.rawCornerDistance>.1f,"brush did not produce a spatially viable rounded corner (a sharp/chamfer corner is insufficient)");
                    Need(c.walkingMisses==0,"actual rounded walking surface/collider has holes, including dense miter stations: "+c.walkingMisses+"/"+c.walkingRays);
                    Need(c.undoRestored&&c.redoRestored,"one native Undo/Redo did not restore exact route, kit and actual mesh");
                    if(retract)Need(c.curveRetractionAttempted&&c.curveRetractionSucceeded,"generated-curve retraction was not exercised");
                }
            }
            catch(Exception e){var root=e.GetBaseException();c.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";c.error=root.ToString();}return c;
        }
        static Check Negative()
        {
            var c=new Check{name="raw-off-trail-hairpin-and-self-crossing-must-not-be-rounded-away",level="WINDOW_API"};
            try
            {
                using(var f=new Fixture())
                {
                    var start=new Vector3(30,0,0);f.Window.BeginDraw(start);Need(f.Window.DragDraw(start+Vector3.right*6),"straight hairpin prefix failed");
                    var s=ReplicaSession.Get(f.Live);string before=JsonUtility.ToJson(s.Candidate.Document);
                    // 0.5m is beyond live-retraction's 0.35m trail tolerance;
                    // this is a real near-180-degree hairpin, not a user undo.
                    bool accepted=f.Window.DragDraw(start+new Vector3(.5f,0,.5f));
                    c.hairpinRejected=!accepted&&before==JsonUtility.ToJson(s.Candidate.Document);Need(c.hairpinRejected,"rounding washed a true off-trail hairpin into an accepted route");
                }
                using(var f=new Fixture())
                {
                    var start=new Vector3(30,0,0);f.Window.BeginDraw(start);
                    foreach(var p in new[]{new Vector3(8,0,0),new Vector3(8,0,8),new Vector3(0,0,8)})f.Window.DragDraw(start+p);
                    Need(Vector3.Distance(f.CandidateEnd(),start+new Vector3(0,0,8))<.11f,"rounded non-crossing U prefix did not form, so the true crossing control was not exercised");
                    var s=ReplicaSession.Get(f.Live);string before=JsonUtility.ToJson(s.Candidate.Document);
                    bool accepted=f.Window.DragDraw(start+new Vector3(8,0,-2));
                    c.selfCrossRejected=!accepted&&before==JsonUtility.ToJson(s.Candidate.Document);Need(c.selfCrossRejected,"rounding washed a raw crossing into a different accepted path");
                }
            }
            catch(Exception e){var root=e.GetBaseException();c.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";c.error=root.ToString();}return c;
        }
        public static void Red(){Run("brush-corner-red");}
        public static void Green(){Run("brush-corner-green");}
        public static void Diagnostic(){Run("brush-corner-diagnostic",true);}
        static void Run(string name,bool nativeOnly=false)
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Use the existing isolated background QA project.");
            var r=new Report();
            if(!nativeOnly)
            {r.checks.Add(Rounded("existing-internal90-and-generated-curve-retraction",false,90,false,true));r.checks.Add(Rounded("new-long-arms100",true,100));r.checks.Add(Rounded("new-long-arms120",true,120));}
            r.checks.Add(Rounded("native-existing-internal90",false,90,true));if(!nativeOnly)r.checks.Add(Negative());
            r.status=r.checks.Any(c=>c.status=="ERROR")?"ERROR":r.checks.All(c=>c.status=="PASS")?"PASS":"FAIL";
            var output=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required");Directory.CreateDirectory(Path.Combine(output,"reports"));File.WriteAllText(Path.Combine(output,"reports",name+".json"),JsonUtility.ToJson(r,true));
            foreach(var c in r.checks)Debug.Log("BRUSH_CORNER "+c.name+" "+c.status+" "+c.error);EditorApplication.Exit(r.status=="PASS"?0:1);
        }
    }
}
