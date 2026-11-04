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
    // Candidate-only Shift tests do not prove commit/cancel/Undo boundaries.
    // Here the existing public API is discovered at runtime so a prior Window
    // with no direct-port implementation remains a runnable red baseline.
    public static class EndpointHeightTransactionQa
    {
        static readonly BindingFlags Hidden=BindingFlags.Instance|BindingFlags.NonPublic;
        [Serializable] sealed class Check
        {
            public string name,status="PASS",error,lastStatus,documentBefore,documentAfter;
            public bool firstEndpoint,firstHeightAccepted,secondHeightAccepted,extensionAccepted,
                retainedHeightAfterFullRetraction,committed,sameAuthor,onlyExpectedEndpointChanged,
                oneRevisionIncrement,visibleMeshChanged,previewDidNotCommit,undoRestored,redoRestored,
                cancelRestored,openingRejected,openingReasonVisible;
            public int authorsBefore,authorsAfter;
            public float expectedHeight,actualHeight,expectedLength=12,actualLength;
        }
        [Serializable] sealed class Report
        {
            public string status="FAIL",engine=Application.unityVersion,
                scope="Independent actual Window public API direct existing-endpoint height transactions: commit, extend/retract, cancel, enabled-opening guard and one native Undo/Redo with exact Doc/Map/Mesh/Kit. No physical mouse or cross-process identity claim.";
            public bool physicalInput=false;public List<Check> checks=new List<Check>();
        }
        sealed class Snapshot
        {
            public string doc,map,mesh,kitIdentity;public ReplicaKit kit;
            public static Snapshot Take(ReplicaAuthor a)
            {return new Snapshot{doc=a.DocumentJson,map=a.MappingJson,mesh=Mesh(a),kit=a.Kit,kitIdentity=KitIdentity(a.Kit)};}
            public bool Same(ReplicaAuthor a)
            {return a!=null&&a.DocumentJson==doc&&a.MappingJson==map&&Mesh(a)==mesh&&a.Kit==kit&&KitIdentity(a.Kit)==kitIdentity;}
        }
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException("SYMPTOM: "+message);}
        static void FixtureNeed(bool value,string message){if(!value)throw new InvalidOperationException("FIXTURE: "+message);}
        static ReplicaAuthor[] Authors(){return UnityEngine.Object.FindObjectsOfType<ReplicaAuthor>().Where(a=>a.Read()!=null).ToArray();}
        static string Mesh(ReplicaAuthor a){return ReplicaGeometry.Fingerprint(ReplicaSession.Get(a).Geometry);}
        static string KitIdentity(ReplicaKit k){return k==null?null:k.Id+"|"+k.Version+"|"+k.ContentHash;}
        static RouteNode Endpoint(RouteDocument d,bool first){return first?d.Nodes.First():d.Nodes.Last();}
        static Vector3 EndpointWorld(ReplicaAuthor a,bool first)
        {var n=Endpoint(a.Read(),first);return a.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z));}
        static float Length(RouteDocument d)
        {float result=0;for(int i=1;i<d.Nodes.Count;i++)result+=Vector2.Distance(new Vector2(d.Nodes[i-1].X,d.Nodes[i-1].Z),new Vector2(d.Nodes[i].X,d.Nodes[i].Z));return result;}
        static bool Height(ReplicaWindow w,float y)
        {
            var method=typeof(ReplicaWindow).GetMethod("SetDrawHeight",BindingFlags.Instance|BindingFlags.Public,null,new[]{typeof(float)},null);
            Need(method!=null&&method.ReturnType==typeof(bool),"missing public bool SetDrawHeight(float targetWorldY)");
            return (bool)method.Invoke(w,new object[]{y});
        }
        sealed class Fixture:IDisposable
        {
            public ReplicaWindow Window;public ReplicaAuthor Author;
            public Fixture(bool opening=false)
            {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Selection.activeGameObject=null;Undo.ClearAll();
                Window=ScriptableObject.CreateInstance<ReplicaWindow>();var sceneGui=typeof(ReplicaWindow).GetMethod("SceneGUI",Hidden);
                SceneView.duringSceneGui-=(Action<SceneView>)Delegate.CreateDelegate(typeof(Action<SceneView>),Window,sceneGui);
                var d=new RouteDocument{SchemaVersion=2,Id="endpoint-height-transaction",Width=2,KitId="workshop.bridge.A",KitVersion="1"};
                d.Nodes.Add(new RouteNode{Id="first",X=0,Y=2,Z=0});d.Nodes.Add(new RouteNode{Id="middle",X=4,Y=2,Z=0});d.Nodes.Add(new RouteNode{Id="last",X=12,Y=2,Z=0});
                if(opening)d.Openings.Add(new RouteOpening{SegmentId=RouteDocument.GetSegmentId("middle","last"),Width=2,Height=1});
                Author=new GameObject("Endpoint_transaction_existing_bridge").AddComponent<ReplicaAuthor>();var s=ReplicaSession.Get(Author);
                FixtureNeed(s.Preview(d,ReplicaKitRegistry.EnsureBase())&&s.ApplyNew(),"ordinary transaction fixture failed: "+s.Status);
                Window.Select(Author);Window.SetDrawMode(true);Undo.ClearAll();
            }
            public void Dispose()
            {if(Window!=null){Window.CancelInput();UnityEngine.Object.DestroyImmediate(Window);}foreach(var a in Authors())if(a!=null)ReplicaGeometry.Destroy(a.gameObject);}
        }
        static bool OnlyEndpoint(RouteDocument before,RouteDocument after,bool first,float y)
        {
            if(before.Nodes.Count!=after.Nodes.Count)return false;
            int target=first?0:before.Nodes.Count-1;
            if(Mathf.Abs(after.Nodes[target].Y-y)>.0001f)return false;
            var normalized=after.Clone();normalized.Revision=before.Revision;normalized.Nodes[target].Y=before.Nodes[target].Y;
            return JsonUtility.ToJson(normalized)==JsonUtility.ToJson(before);
        }
        static void UndoRedo(ReplicaAuthor a,Check c,Snapshot before)
        {
            var after=Snapshot.Take(a);Undo.FlushUndoRecordObjects();Undo.PerformUndo();c.undoRestored=before.Same(a);
            Undo.PerformRedo();c.redoRestored=after.Same(a);
        }
        static Check Commit(bool first,bool retract=false)
        {
            var c=new Check{name=retract?"direct-tail-height-then-extend-and-fully-retract-keeps-height":first?"direct-first-zero-new-length-height3-then4-one-commit":"direct-tail-zero-new-length-height3-then4-one-commit",firstEndpoint=first,expectedHeight=retract?3:4};
            try
            {
                using(var f=new Fixture())
                {
                    var a=f.Author;var before=Snapshot.Take(a);var oldDoc=a.Read();c.documentBefore=before.doc;c.authorsBefore=Authors().Length;
                    var endpoint=EndpointWorld(a,first);f.Window.BeginDraw(endpoint);Need(f.Window.Drawing,"port press failed to begin the height gesture");
                    c.firstHeightAccepted=Height(f.Window,3);Need(c.firstHeightAccepted,"direct port with zero new length refused height3: "+f.Window.Status);
                    if(retract)
                    {
                        c.extensionAccepted=f.Window.DragDraw(endpoint+Vector3.right*4);Need(c.extensionAccepted,"extension after direct height failed: "+f.Window.Status);
                        f.Window.DragDraw(endpoint);
                        var session=ReplicaSession.Get(a);c.retainedHeightAfterFullRetraction=session.HasCandidate&&Mathf.Abs(Endpoint(session.Candidate.Document,false).Y-3)<.0001f&&Mathf.Abs(Length(session.Candidate.Document)-12)<.0001f;
                        Need(c.retainedHeightAfterFullRetraction,"removing all new length also discarded the already-previewed old endpoint height edit");
                    }
                    else
                    {c.secondHeightAccepted=Height(f.Window,4);Need(c.secondHeightAccepted,"second direct height request was refused: "+f.Window.Status);}
                    c.previewDidNotCommit=before.Same(a);Need(c.previewDidNotCommit,"direct height/extension preview changed committed Doc/Map/Mesh/Kit before release");
                    c.committed=f.Window.EndDraw();c.lastStatus=f.Window.Status;c.sameAuthor=f.Window.Author==a&&a.Kit==before.kit;
                    var after=a.Read();c.documentAfter=a.DocumentJson;c.actualHeight=Endpoint(after,first).Y;c.actualLength=Length(after);c.authorsAfter=Authors().Length;
                    c.onlyExpectedEndpointChanged=OnlyEndpoint(oldDoc,after,first,c.expectedHeight);c.oneRevisionIncrement=after.Revision==oldDoc.Revision+1;c.visibleMeshChanged=Mesh(a)!=before.mesh;
                    UndoRedo(a,c,before);
                    Need(c.committed&&c.sameAuthor&&c.authorsAfter==c.authorsBefore,"zero-new-length endpoint height did not commit once to the same author");
                    Need(c.onlyExpectedEndpointChanged&&c.oneRevisionIncrement&&Mathf.Abs(c.actualLength-12)<.0001f,"commit changed non-endpoint coordinates/IDs, kept new length, or created extra revisions");
                    Need(c.visibleMeshChanged,"committed endpoint height did not change the actual mesh");
                    Need(c.undoRestored&&c.redoRestored,"one native Undo/Redo failed exact Doc/complete Map/actual Mesh/Kit restoration");
                }
            }
            catch(Exception e){var root=e.GetBaseException();c.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";c.error=root.ToString();}return c;
        }
        static Check Cancel()
        {
            var c=new Check{name="direct-height-cancel-restores-original-document-map-mesh-kit"};
            try
            {
                using(var f=new Fixture())
                {
                    var a=f.Author;var before=Snapshot.Take(a);c.authorsBefore=Authors().Length;f.Window.BeginDraw(EndpointWorld(a,false));
                    c.firstHeightAccepted=Height(f.Window,3);Need(c.firstHeightAccepted&&ReplicaSession.Get(a).HasCandidate,"direct height did not establish a real cancellable preview");
                    Need(before.Same(a),"preview committed the endpoint height before cancellation");
                    // CancelInput is the same transaction path used by Esc.
                    f.Window.CancelInput();c.lastStatus=f.Window.Status;c.cancelRestored=before.Same(a)&&!f.Window.Drawing&&!ReplicaSession.Get(a).HasCandidate&&ReplicaSession.Get(a).Geometry.activeSelf;c.authorsAfter=Authors().Length;
                    Need(c.cancelRestored&&c.authorsAfter==c.authorsBefore&&!f.Window.EndDraw(),"cancel kept a candidate, committed a change or failed exact original restoration");
                }
            }
            catch(Exception e){var root=e.GetBaseException();c.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";c.error=root.ToString();}return c;
        }
        static Check Opening()
        {
            var c=new Check{name="enabled-terminal-opening-refuses-direct-height-without-changing-work"};
            try
            {
                using(var f=new Fixture(true))
                {
                    var a=f.Author;var before=Snapshot.Take(a);c.authorsBefore=Authors().Length;f.Window.BeginDraw(EndpointWorld(a,false));
                    c.openingRejected=!Height(f.Window,3);c.lastStatus=f.Window.Status;c.openingReasonVisible=c.lastStatus!=null&&(c.lastStatus.Contains("洞")||c.lastStatus.Contains("水平"));
                    Need(c.openingRejected&&c.openingReasonVisible,"enabled terminal opening did not visibly reject height that would destroy its horizontal span");
                    Need(before.Same(a)&&!ReplicaSession.Get(a).HasCandidate&&!f.Window.EndDraw(),"opening rejection changed original Doc/Map/Mesh/Kit or left a commit-ready candidate");
                    c.authorsAfter=Authors().Length;Need(c.authorsAfter==c.authorsBefore,"rejected opening-height gesture created a separate author");
                }
            }
            catch(Exception e){var root=e.GetBaseException();c.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";c.error=root.ToString();}return c;
        }
        public static void Red(){Run("endpoint-height-transaction-red");}
        public static void Green(){Run("endpoint-height-transaction-green");}
        static void Run(string name)
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Use the existing isolated background QA project.");
            var r=new Report();r.checks.Add(Commit(false));r.checks.Add(Commit(true));r.checks.Add(Commit(false,true));r.checks.Add(Cancel());r.checks.Add(Opening());
            r.status=r.checks.Any(c=>c.status=="ERROR")?"ERROR":r.checks.All(c=>c.status=="PASS")?"PASS":"FAIL";
            var output=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required");Directory.CreateDirectory(Path.Combine(output,"reports"));File.WriteAllText(Path.Combine(output,"reports",name+".json"),JsonUtility.ToJson(r,true));
            foreach(var c in r.checks)Debug.Log("ENDPOINT_HEIGHT_TRANSACTION "+c.name+" "+c.status+" "+c.error);EditorApplication.Exit(r.status=="PASS"?0:1);
        }
    }
}
