using System;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.BridgeReplica.Editor;

namespace XingHai.BridgeReplica.QA
{
    // Deterministic replay of the real native near-coincident envelope failure.
    // The native red artifact is retained separately; this does not replace it.
    public static class HeightEnvelopeBoundaryQa
    {
        [Serializable] sealed class Report
        {
            public string status="FAIL",engine=Application.unityVersion,error,
                redEvidence="reports/height-envelope-near-coincident-red.json",
                scope="Actual Window API near-coincident automatic/ramp envelope boundary; real candidate mesh/collider and native creation Undo/Redo. No physical input claim.";
            public bool physicalInput=false,drawAccepted,heightAccepted,candidateValid,originalAutoNotLowered,
                xzLocked,meshColliderPresent,committed,undoRemovedNewAuthor,redoRestored;
            public float endpointY,endpointXZError,minimumSpan=float.MaxValue;
            public int beforeNodes,afterNodes,vertices;
        }
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException("SYMPTOM: "+message);}
        static void FixtureNeed(bool value,string message){if(!value)throw new InvalidOperationException("FIXTURE: "+message);}
        static ReplicaAuthor[] Authors(){return UnityEngine.Object.FindObjectsOfType<ReplicaAuthor>().Where(a=>a.Read()!=null).ToArray();}
        static float HeightAt(RouteDocument doc,RouteNode p)
        {
            float best=float.MaxValue,y=0;
            for(int i=1;i<doc.Nodes.Count;i++)
            {
                var a=doc.Nodes[i-1];var b=doc.Nodes[i];float dx=b.X-a.X,dz=b.Z-a.Z,den=dx*dx+dz*dz;
                float t=den<1e-12f?0:Mathf.Clamp01(((p.X-a.X)*dx+(p.Z-a.Z)*dz)/den),x=a.X+dx*t-p.X,z=a.Z+dz*t-p.Z,d=x*x+z*z;
                if(d<best){best=d;y=a.Y+(b.Y-a.Y)*t;}
            }
            Need(best<.000001f,"height adjustment moved the automatic reference's XZ contour");return y;
        }
        public static void Run()
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Use the existing isolated background QA project.");
            var r=new Report();ReplicaWindow window=null;
            try
            {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Selection.activeGameObject=null;Undo.ClearAll();
                window=ScriptableObject.CreateInstance<ReplicaWindow>();var hidden=BindingFlags.Instance|BindingFlags.NonPublic;
                var sceneGui=typeof(ReplicaWindow).GetMethod("SceneGUI",hidden);
                SceneView.duringSceneGui-=(Action<SceneView>)Delegate.CreateDelegate(typeof(Action<SceneView>),window,sceneGui);
                window.SetDrawMode(true);var origin=new Vector3(24,0,0);window.BeginDraw(origin);
                r.drawAccepted=window.DragDraw(origin+new Vector3(4.001459f,0,.006230354f));Need(r.drawAccepted,"near-boundary original automatic stroke did not form: "+window.Status);
                var scratch=typeof(ReplicaWindow).GetField("scratch",hidden);FixtureNeed(scratch!=null,"Window scratch observation hook missing");
                var a=(ReplicaAuthor)scratch.GetValue(window);FixtureNeed(a!=null,"new stroke has no real candidate author");var session=ReplicaSession.Get(a);
                FixtureNeed(session.HasCandidate,"automatic candidate missing");var before=session.Candidate.Document.Clone();r.beforeNodes=before.Nodes.Count;
                FixtureNeed(before.Nodes.Count>=4&&Mathf.Abs(before.Nodes.Max(n=>n.Y)-.75f)<.0001f,"replay did not contain the original .75m automatic approach");
                var height=typeof(ReplicaWindow).GetMethod("SetDrawHeight",BindingFlags.Instance|BindingFlags.Public,null,new[]{typeof(float)},null);
                Need(height!=null&&height.ReturnType==typeof(bool),"public height API missing");r.heightAccepted=(bool)height.Invoke(window,new object[]{2f});
                Need(r.heightAccepted,"feasible 2m height rejected at the near-coincident profile crossing: "+window.Status);
                FixtureNeed(session.HasCandidate,"height call removed the valid candidate");var after=session.Candidate.Document;r.afterNodes=after.Nodes.Count;
                var tip=after.Nodes.Last();var oldTip=before.Nodes.Last();r.endpointY=tip.Y;r.endpointXZError=Vector2.Distance(new Vector2(tip.X,tip.Z),new Vector2(oldTip.X,oldTip.Z));r.xzLocked=r.endpointXZError<.0001f;
                r.candidateValid=ReplicaRoute.Solve(after).Valid;r.originalAutoNotLowered=before.Nodes.All(n=>HeightAt(after,n)>=n.Y-.00001f);
                for(int i=1;i<after.Nodes.Count;i++)r.minimumSpan=Mathf.Min(r.minimumSpan,Vector2.Distance(new Vector2(after.Nodes[i-1].X,after.Nodes[i-1].Z),new Vector2(after.Nodes[i].X,after.Nodes[i].Z)));
                var preview=a.transform.Find("__RoutePreview");FixtureNeed(preview!=null,"height candidate has no actual preview geometry");var meshes=preview.GetComponentsInChildren<MeshFilter>(true);
                r.vertices=meshes.Where(m=>m.sharedMesh!=null).Sum(m=>m.sharedMesh.vertexCount);
                r.meshColliderPresent=r.vertices>0&&meshes.All(m=>m.sharedMesh!=null&&m.GetComponent<MeshCollider>()!=null&&m.GetComponent<MeshCollider>().sharedMesh==m.sharedMesh);
                Need(r.candidateValid&&r.xzLocked&&Mathf.Abs(r.endpointY-2)<.0001f&&r.minimumSpan>=.005f,"height boundary produced a rejected/zero-short-span profile or wrong endpoint");
                Need(r.originalAutoNotLowered&&r.meshColliderPresent,"height boundary lowered the old automatic approach or lost the real source mesh/collider");
                r.committed=window.EndDraw();Need(r.committed&&window.Author==a,"valid height candidate did not commit as the new bridge");
                string id=a.Read().Id,doc=a.DocumentJson,map=a.MappingJson,mesh=ReplicaGeometry.Fingerprint(ReplicaSession.Get(a).Geometry);var kit=a.Kit;
                Undo.FlushUndoRecordObjects();Undo.PerformUndo();r.undoRemovedNewAuthor=!Authors().Any(x=>x.Read().Id==id);
                Undo.PerformRedo();var restored=Authors().Single(x=>x.Read().Id==id);r.redoRestored=restored.DocumentJson==doc&&restored.MappingJson==map&&ReplicaGeometry.Fingerprint(ReplicaSession.Get(restored).Geometry)==mesh&&restored.Kit==kit;
                Need(r.undoRemovedNewAuthor&&r.redoRestored,"one creation Undo/Redo failed exact Doc/Map/Mesh/Kit restoration");r.status="PASS";
            }
            catch(Exception e){r.error=e.GetBaseException().ToString();r.status=e.GetBaseException().Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";}
            finally
            {
                if(window!=null){window.CancelInput();UnityEngine.Object.DestroyImmediate(window);}foreach(var a in Authors())if(a!=null)ReplicaGeometry.Destroy(a.gameObject);
            }
            var output=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required");Directory.CreateDirectory(Path.Combine(output,"reports"));
            File.WriteAllText(Path.Combine(output,"reports","height-envelope-boundary.json"),JsonUtility.ToJson(r,true));Debug.Log("HEIGHT_ENVELOPE_BOUNDARY "+r.status+" "+r.error);EditorApplication.Exit(r.status=="PASS"?0:1);
        }
    }
}
