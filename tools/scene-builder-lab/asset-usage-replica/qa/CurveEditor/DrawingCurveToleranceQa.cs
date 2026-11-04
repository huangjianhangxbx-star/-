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
    // A physically open R6 bend starts 45 degrees from the existing bridge.
    // Coarse sampling must not turn that feasible gesture into an input failure.
    // These checks examine committed source meshes/colliders as well as author
    // authority. They do not merely assert EndDraw's boolean or solver validity.
    public static class DrawingCurveToleranceQa
    {
        [Serializable] sealed class Check
        {
            public string name,status="PASS",error,lastStatus,meshFingerprint;
            public float startHeadingDegrees,sampleGap,radius=6,totalTurnDegrees=45,endpointError;
            public Vector3 expectedEndpoint,actualEndpoint;
            public bool began,committed,sameAuthor,stableOldNodes,undoRestored,redoRestored;
            public int acceptedSamples,rejectedSamples,actualDeckMeshes,walkingRays,walkingMisses,topTriangles,flippedOrDegenerateTopTriangles;
            public List<Miss> misses=new List<Miss>();
        }
        [Serializable] sealed class Miss
        {
            public string diagnosis;
            public float arc,lateral,frameStartArc,frameEndArc,nearestActualTopDistance;
            public int frameIndex;
            public Vector3 rayOrigin,surfacePoint,frameLeft,frameRight;
            public bool insideIntendedStripQuad,coveredByActualTopTriangles;
            public List<NearTriangle> nearestActualTriangles=new List<NearTriangle>();
            public List<CurvePlacement> nearbySourceSpans=new List<CurvePlacement>();
        }
        [Serializable] sealed class NearTriangle
        {
            public string mesh;
            public int triangle;
            public Vector3 a,b,c,closestPoint;
            public float horizontalDistance;
        }
        sealed class TopTriangle
        {public string mesh;public int triangle;public Vector3 a,b,c;}
        [Serializable] sealed class Report
        {
            public string status="FAIL",engine=Application.unityVersion,
                scope="Independent Window API R6/45-degree circular stroke, 0/45-degree initial heading and 2m/0.25m pointer sampling. Same raw endpoint, real committed mesh winding/collider walking rays and Undo/Redo. No physical mouse proof.";
            public bool physicalInput=false;
            public List<Check> checks=new List<Check>();
        }
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException("SYMPTOM: "+message);}
        static void FixtureNeed(bool value,string message){if(!value)throw new InvalidOperationException("FIXTURE: "+message);}
        static ReplicaAuthor[] Authors(){return UnityEngine.Object.FindObjectsOfType<ReplicaAuthor>().Where(a=>a.Read()!=null).ToArray();}
        static Vector3 End(ReplicaAuthor a){var n=a.Read().Nodes.Last();return a.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z));}
        static string Mesh(ReplicaAuthor a){return ReplicaGeometry.Fingerprint(ReplicaSession.Get(a).Geometry);}
        static Vector3 Arc(float headingDegrees,float distance)
        {
            float h=headingDegrees*Mathf.Deg2Rad,t=distance/6;
            return new Vector3(6*(Mathf.Sin(h+t)-Mathf.Sin(h)),0,6*(Mathf.Cos(h)-Mathf.Cos(h+t)));
        }
        static float CrossXZ(Vector3 a,Vector3 b,Vector3 p){return (b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);}
        static bool InsideTriangleXZ(Vector3 p,Vector3 a,Vector3 b,Vector3 c)
        {
            if(Mathf.Abs(CrossXZ(a,b,c))<=.00000001f)return false;
            float x=CrossXZ(a,b,p),y=CrossXZ(b,c,p),z=CrossXZ(c,a,p);
            return (x>=-.000001f&&y>=-.000001f&&z>=-.000001f)||(x<=.000001f&&y<=.000001f&&z<=.000001f);
        }
        static Vector3 ClosestSegmentXZ(Vector3 p,Vector3 a,Vector3 b)
        {
            float dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
            float u=den<.000000001f?0:Mathf.Clamp01(((p.x-a.x)*dx+(p.z-a.z)*dz)/den);return a+(b-a)*u;
        }
        static float DistanceXZ(Vector3 a,Vector3 b){float dx=a.x-b.x,dz=a.z-b.z;return Mathf.Sqrt(dx*dx+dz*dz);}
        static Vector3 ClosestTriangleXZ(Vector3 p,TopTriangle t)
        {
            if(InsideTriangleXZ(p,t.a,t.b,t.c))return new Vector3(p.x,t.a.y,p.z);
            var points=new[]{ClosestSegmentXZ(p,t.a,t.b),ClosestSegmentXZ(p,t.b,t.c),ClosestSegmentXZ(p,t.c,t.a)};
            return points.OrderBy(q=>DistanceXZ(p,q)).First();
        }
        static Miss DiagnoseMiss(ReplicaAuthor a,CurveResult curve,List<TopTriangle> triangles,CurvePlacement[] mapping,float arc,float side,Vector3 rayOrigin)
        {
            var f=curve.FrameAt(arc);var p=a.transform.TransformPoint(new Vector3(f.X+(f.LeftX-f.RightX)*side,f.Y,f.Z+(f.LeftZ-f.RightZ)*side));
            int index=0;while(index<curve.Frames.Count-2&&curve.Frames[index+1].Arc<arc)index++;
            var first=curve.Frames[index];var last=curve.Frames[index+1];
            var l0=a.transform.TransformPoint(new Vector3(first.LeftX,first.Y,first.LeftZ));var r0=a.transform.TransformPoint(new Vector3(first.RightX,first.Y,first.RightZ));
            var l1=a.transform.TransformPoint(new Vector3(last.LeftX,last.Y,last.LeftZ));var r1=a.transform.TransformPoint(new Vector3(last.RightX,last.Y,last.RightZ));
            var miss=new Miss{arc=arc,lateral=side,frameIndex=index,frameStartArc=first.Arc,frameEndArc=last.Arc,rayOrigin=rayOrigin,surfacePoint=p,
                frameLeft=a.transform.TransformPoint(new Vector3(f.LeftX,f.Y,f.LeftZ)),frameRight=a.transform.TransformPoint(new Vector3(f.RightX,f.Y,f.RightZ)),
                insideIntendedStripQuad=InsideTriangleXZ(p,l0,r0,l1)||InsideTriangleXZ(p,r0,r1,l1)};
            miss.nearestActualTriangles=triangles.Select(t=>{
                var q=ClosestTriangleXZ(p,t);return new NearTriangle{mesh=t.mesh,triangle=t.triangle,a=t.a,b=t.b,c=t.c,closestPoint=q,horizontalDistance=DistanceXZ(p,q)};
            }).OrderBy(t=>t.horizontalDistance).Take(4).ToList();
            miss.nearestActualTopDistance=miss.nearestActualTriangles.Min(t=>t.horizontalDistance);
            miss.coveredByActualTopTriangles=miss.nearestActualTopDistance<=.00001f;
            miss.nearbySourceSpans=mapping.Where(m=>(m.role=="deck"||m.role=="tread")&&m.startArc<=arc+.6f&&m.endArc>=arc-.6f).ToList();
            miss.diagnosis=miss.coveredByActualTopTriangles?"ACTUAL_TOP_PROJECTION_COVERS_RAY_BUT_COLLIDER_MISSED":
                miss.insideIntendedStripQuad?"INTENDED_STRIP_NOT_COVERED_BY_ACTUAL_TOP_TRIANGLES":"RAY_OUTSIDE_INTENDED_STRIP_QUAD";
            return miss;
        }
        static void AuditActualGeometry(ReplicaAuthor a,Check c)
        {
            var root=ReplicaSession.Get(a).Geometry;FixtureNeed(root!=null,"committed author has no actual geometry");
            var decks=root.GetComponentsInChildren<MeshFilter>(true).Where(f=>f.name=="deck"||f.name=="tread").ToArray();
            c.actualDeckMeshes=decks.Length;FixtureNeed(decks.Length>0,"kit did not produce actual walking meshes");
            var topTriangles=new List<TopTriangle>();
            foreach(var f in decks)
            {
                var mesh=f.sharedMesh;var collider=f.GetComponent<MeshCollider>();
                FixtureNeed(mesh!=null&&collider!=null&&collider.sharedMesh==mesh,"visible deck and walking collider do not share the actual mesh");
                var v=mesh.vertices;var t=mesh.triangles;float top=v.Max(p=>p.y);
                for(int i=0;i<t.Length;i+=3)
                {
                    var p=v[t[i]];var q=v[t[i+1]];var r=v[t[i+2]];
                    // Flat, constant-height fixtures let us identify actual top
                    // triangles without relying on generated vertex numbering.
                    if(Mathf.Abs(p.y-top)>.0001f||Mathf.Abs(q.y-top)>.0001f||Mathf.Abs(r.y-top)>.0001f)continue;
                    c.topTriangles++;
                    topTriangles.Add(new TopTriangle{mesh=f.name,triangle=i/3,a=f.transform.TransformPoint(p),b=f.transform.TransformPoint(q),c=f.transform.TransformPoint(r)});
                    var up=Vector3.Cross(f.transform.TransformPoint(q)-f.transform.TransformPoint(p),f.transform.TransformPoint(r)-f.transform.TransformPoint(p));
                    if(up.y<=.0000001f)c.flippedOrDegenerateTopTriangles++;
                }
            }
            var solved=ReplicaRoute.Solve(a.Read());FixtureNeed(solved.Valid&&solved.Curve!=null,"committed authority does not solve: "+solved.Message);
            var sourceMap=JsonUtility.FromJson<CurveMapping>(a.MappingJson);FixtureNeed(sourceMap!=null&&sourceMap.placements!=null,"committed author has no actual source-span mapping");
            Physics.SyncTransforms();var colliders=decks.Select(f=>f.GetComponent<Collider>()).ToArray();
            var stations=new List<float>();for(float s=.025f;s<solved.Curve.Length-.025f;s+=.127f)stations.Add(s);
            // Denser rays straddle the real old/new join rather than just
            // sampling the middle of each authored route segment.
            foreach(float delta in new[]{-.3f,-.15f,-.05f,-.01f,0,.01f,.05f,.15f,.3f})stations.Add(8+delta);
            foreach(float arc in stations)
            foreach(float side in new[]{-.45f,0,.45f})
            {
                var f=solved.Curve.FrameAt(arc);
                var world=a.transform.TransformPoint(new Vector3(f.X+(f.LeftX-f.RightX)*side,12,f.Z+(f.LeftZ-f.RightZ)*side));
                var ray=new Ray(world,-a.transform.up);RaycastHit hit;c.walkingRays++;
                if(!colliders.Any(d=>d.Raycast(ray,out hit,25)))
                {c.walkingMisses++;c.misses.Add(DiagnoseMiss(a,solved.Curve,topTriangles,sourceMap.placements,arc,side,world));}
            }
            c.meshFingerprint=Mesh(a);
        }
        static Check Gesture(float heading,float gap)
        {
            var c=new Check{name="r6-start"+heading+"-turn45-gap"+gap,startHeadingDegrees=heading,sampleGap=gap};ReplicaWindow window=null;
            try
            {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Selection.activeGameObject=null;Undo.ClearAll();
                window=ScriptableObject.CreateInstance<ReplicaWindow>();
                var sceneGui=typeof(ReplicaWindow).GetMethod("SceneGUI",BindingFlags.Instance|BindingFlags.NonPublic);
                SceneView.duringSceneGui-=(Action<SceneView>)Delegate.CreateDelegate(typeof(Action<SceneView>),window,sceneGui);
                var doc=new RouteDocument{SchemaVersion=2,Id="curve-speed-tolerance",Width=2,KitId="workshop.bridge.A",KitVersion="1"};
                doc.Nodes.Add(new RouteNode{Id="old-first",X=0,Y=2,Z=0});doc.Nodes.Add(new RouteNode{Id="old-last",X=8,Y=2,Z=0});
                var a=new GameObject("Tolerance_existing_bridge").AddComponent<ReplicaAuthor>();var session=ReplicaSession.Get(a);var kit=ReplicaKitRegistry.EnsureBase();
                FixtureNeed(session.Preview(doc,kit)&&session.ApplyNew(),"ordinary fixture bridge could not build: "+session.Status);
                window.Select(a);window.SetDrawMode(true);Undo.ClearAll();
                string before=a.DocumentJson,beforeMesh=Mesh(a);var endpoint=End(a);var press=endpoint+Vector3.forward*.8f;
                window.BeginDraw(press);c.began=window.Drawing;float length=6*Mathf.PI/4;
                for(float d=gap;d<length;d+=gap)
                {if(window.DragDraw(press+Arc(heading,d)))c.acceptedSamples++;else c.rejectedSamples++;}
                // The actual final mouse coordinate is shared by fast and slow
                // sampling, including a release not seen as a previous drag.
                if(window.DragDraw(press+Arc(heading,length)))c.acceptedSamples++;else c.rejectedSamples++;
                c.committed=window.EndDraw();c.lastStatus=window.Status;c.sameAuthor=window.Author==a&&Authors().Length==1&&a.Kit==kit;
                c.expectedEndpoint=endpoint+Arc(heading,length);c.actualEndpoint=End(a);c.endpointError=Vector3.Distance(c.expectedEndpoint,c.actualEndpoint);
                var actual=a.Read();c.stableOldNodes=actual.Nodes.Count>=2&&JsonUtility.ToJson(actual.Nodes[0])==JsonUtility.ToJson(doc.Nodes[0])&&JsonUtility.ToJson(actual.Nodes[1])==JsonUtility.ToJson(doc.Nodes[1]);
                AuditActualGeometry(a,c);string after=a.DocumentJson,afterMesh=Mesh(a);
                Undo.FlushUndoRecordObjects();Undo.PerformUndo();c.undoRestored=a.DocumentJson==before&&Mesh(a)==beforeMesh&&a.Kit==kit;
                Undo.PerformRedo();c.redoRestored=a.DocumentJson==after&&Mesh(a)==afterMesh&&a.Kit==kit;
                Need(c.began&&c.committed,"feasible circular continuation did not commit: "+c.lastStatus);
                Need(c.sameAuthor&&c.stableOldNodes,"continuation changed author, kit or the pre-existing route nodes");
                Need(c.endpointError<.11f,"sampling speed lost the actual final pointer endpoint; expected "+c.expectedEndpoint+", actual "+c.actualEndpoint+"; "+c.lastStatus);
                Need(c.topTriangles>0&&c.flippedOrDegenerateTopTriangles==0,"actual walking top mesh contains flipped/degenerate triangles");
                Need(c.walkingRays>0&&c.walkingMisses==0,"actual walking collider has gaps, including the old/new join ("+c.walkingMisses+"/"+c.walkingRays+")");
                Need(c.undoRestored&&c.redoRestored,"one native Undo/Redo did not restore complete route, kit and actual geometry");
            }
            catch(Exception e){var root=e.GetBaseException();c.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";c.error=root.ToString();}
            finally{if(window!=null){window.CancelInput();UnityEngine.Object.DestroyImmediate(window);}foreach(var a in Authors())if(a!=null)ReplicaGeometry.Destroy(a.gameObject);}
            return c;
        }
        public static void Red(){Run("drawing-curve-tolerance-red");}
        public static void Green(){Run("drawing-curve-tolerance-green");}
        public static void Diagnostic(){Run("drawing-curve-tolerance-diagnostic");}
        static void Run(string name)
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Use the existing isolated background QA project.");
            var r=new Report();foreach(float heading in new[]{0f,45f})foreach(float gap in new[]{2f,.25f})r.checks.Add(Gesture(heading,gap));
            r.status=r.checks.Any(c=>c.status=="ERROR")?"ERROR":r.checks.All(c=>c.status=="PASS")?"PASS":"FAIL";
            var output=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required");
            Directory.CreateDirectory(Path.Combine(output,"reports"));File.WriteAllText(Path.Combine(output,"reports",name+".json"),JsonUtility.ToJson(r,true));
            foreach(var c in r.checks)Debug.Log("DRAWING_CURVE_TOLERANCE "+c.name+" "+c.status+" "+c.error);
            EditorApplication.Exit(r.status=="PASS"?0:1);
        }
    }
}
