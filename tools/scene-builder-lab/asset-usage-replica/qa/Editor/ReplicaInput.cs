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
    public static class ReplicaInput
    {
        [Serializable] sealed class Check{public string name,status="PASS",error;}
        [Serializable] sealed class Report{public string status="PASS",engine=Application.unityVersion,level="SYNTHETIC_SCENEVIEW",scope="Production SceneGUI executed inside real SceneView SendEvent callbacks with synthetic events. Does not replace physical mouse/keyboard operation or user art/feel acceptance.";public List<Check> checks=new List<Check>();}
        static Report report;
        static MethodInfo SceneGUI{get{return typeof(ReplicaWindow).GetMethod("SceneGUI",BindingFlags.Instance|BindingFlags.NonPublic);}}
        static void Need(bool ok,string text){if(!ok)throw new InvalidOperationException(text);}
        static string Json(ReplicaAuthor a){return JsonUtility.ToJson(a.Read());}
        static ReplicaAuthor[] Authors(){return UnityEngine.Object.FindObjectsOfType<ReplicaAuthor>();}
        sealed class Fixture:IDisposable
        {
            public ReplicaWindow Window;public SceneView View;readonly EventHost events;Vector2 lastMouse;
            public Fixture()
            {
                foreach(var w in Resources.FindObjectsOfTypeAll<ReplicaWindow>())w.Close();
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Selection.activeGameObject=null;Undo.ClearAll();
                Window=ScriptableObject.CreateInstance<ReplicaWindow>();SceneView.duringSceneGui-=(Action<SceneView>)Delegate.CreateDelegate(typeof(Action<SceneView>),Window,SceneGUI);
                View=ScriptableObject.CreateInstance<SceneView>();View.position=new Rect(0,0,1100,800);View.Show();View.Focus();Frame();events=new EventHost(View);
            }
            public void Frame(){View.LookAt(new Vector3(7,1,4),Quaternion.Euler(48,-32,0),16,true,true);}
            public void At(Vector3 position,EventType type,int button=0)
            {
                events.Deliver(new Event{type=type,button=button,mousePosition=new Vector2(550,400)},()=>{
                    var gui=HandleUtility.WorldToGUIPoint(position);Event.current.mousePosition=gui;
                    if(Event.current.type==EventType.MouseDrag)Event.current.delta=gui-lastMouse;
                    if(Event.current.type==EventType.MouseDown||Event.current.type==EventType.MouseDrag||Event.current.type==EventType.MouseUp)lastMouse=gui;
                    SceneGUI.Invoke(Window,new object[]{View});
                });
            }
            public void Key(KeyCode key){events.Deliver(new Event{type=EventType.KeyDown,keyCode=key},()=>SceneGUI.Invoke(Window,new object[]{View}));}
            public void SelectNode(int index){typeof(ReplicaWindow).GetField("selectedNode",BindingFlags.Instance|BindingFlags.NonPublic).SetValue(Window,index);}
            public ReplicaAuthor CreateDetour(){Window.Create(RouteExamples.Detour());Window.SetDrawMode(false);Frame();Undo.ClearAll();return Window.Author;}
            public void Dispose(){Window.CancelInput();events.Dispose();View.Close();UnityEngine.Object.DestroyImmediate(Window);}
        }
        static void DrawU(Fixture f)
        {
            f.Window.SetDrawMode(true);f.At(Vector3.zero,EventType.MouseDown);
            foreach(var p in new[]{new Vector3(0,0,8),new Vector3(14,0,8),new Vector3(14,0,0)})f.At(p,EventType.MouseDrag);
            f.At(new Vector3(14,0,0),EventType.MouseUp);
        }
        static void FastContinuousMiddle()
        {
            using(var f=new Fixture())
            {
                DrawU(f);Need(!f.Window.Drawing&&Authors().Length==1,"Fast continuous release produces one route author.");var a=Authors().Single();var d=a.Read();
                Need(d.Nodes.Any(n=>Math.Abs(n.Z-8)<.001f)&&d.Nodes.Count>=6,"Every input sample matters: the two middle corners survive a gesture faster than40ms between callbacks.");
                Need(Math.Abs(d.Nodes[0].X)<.001f&&Math.Abs(d.Nodes[d.Nodes.Count-1].X-14)<.001f&&Math.Abs(d.Nodes[d.Nodes.Count-1].Z)<.001f,"U route retains the same endpoints as the straight example.");
                Need(ReplicaSession.Get(a).Committed.Plan.Parts.Any(p=>p.Z>7),"Actual generated source geometry follows the middle detour.");
                string before=Json(a),mesh=ReplicaGeometry.Fingerprint(a.gameObject);foreach(int button in new[]{1,2}){f.At(new Vector3(7,0,0),EventType.MouseDown,button);f.At(new Vector3(8,0,0),EventType.MouseDrag,button);f.At(new Vector3(8,0,0),EventType.MouseUp,button);}
                Need(Json(a)==before&&ReplicaGeometry.Fingerprint(a.gameObject)==mesh,"Right/middle navigation preserves committed route and geometry.");Undo.FlushUndoRecordObjects();Undo.PerformUndo();Need(Authors().Length==0,"One Undo removes one drawn route.");Undo.PerformRedo();Need(Authors().Length==1,"One Redo restores one drawn route.");a=Authors().Single();Need(Json(a)==before&&ReplicaGeometry.Fingerprint(a.gameObject)==mesh,"Redo restores full editable detour and mesh.");
            }
        }
        static void PreviewCadenceCannotDiscardSamples()
        {
            using(var f=new Fixture())
            {
                typeof(ReplicaWindow).GetField("lastPreview",BindingFlags.Instance|BindingFlags.NonPublic).SetValue(f.Window,EditorApplication.timeSinceStartup+10);
                DrawU(f);Need(Authors().Length==1,"One route is committed at release even if previews were not due during drawing.");
                var d=Authors().Single().Read();Need(d.Nodes.Count>=6&&d.Nodes.Any(n=>Math.Abs(n.Z-8)<.001f),"Preview cadence must not discard the U route's intermediate input samples.");
            }
        }
        static void MiddleLegHandle()
        {
            using(var f=new Fixture())
            {
                var a=f.CreateDetour();f.SelectNode(2);var before=a.Read();string mesh=ReplicaGeometry.Fingerprint(a.gameObject);var point=a.transform.TransformPoint(new Vector3(7,2.45f,8));
                f.At(point,EventType.MouseDown);f.At(point+a.transform.forward,EventType.MouseDrag);f.At(point+a.transform.forward*2,EventType.MouseDrag);f.At(point+a.transform.forward*2,EventType.MouseUp);
                var d=a.Read();Need(d.Nodes[2].Z==10&&d.Nodes[3].Z==10,"Actual cyan handle moves both middle corners by2m.");Need(d.Nodes[0].X==before.Nodes[0].X&&d.Nodes[0].Z==before.Nodes[0].Z&&d.Nodes[d.Nodes.Count-1].X==before.Nodes[before.Nodes.Count-1].X&&d.Nodes[d.Nodes.Count-1].Z==before.Nodes[before.Nodes.Count-1].Z,"Middle handle preserves outer endpoints.");
                Need(ReplicaGeometry.Fingerprint(a.gameObject)!=mesh,"Middle handle changes actual combined meshes.");Undo.FlushUndoRecordObjects();Undo.PerformUndo();Need(JsonUtility.ToJson(a.Read())==JsonUtility.ToJson(before)&&ReplicaGeometry.Fingerprint(a.gameObject)==mesh,"One Undo restores middle path and exact meshes.");Need(JsonUtility.ToJson(f.Window.Draft)==JsonUtility.ToJson(before),"Undo synchronizes editor draft with author.");
            }
        }
        static void LocalHeightHandle()
        {
            using(var f=new Fixture())
            {
                var a=f.CreateDetour();f.SelectNode(4);string before=Json(a),mesh=ReplicaGeometry.Fingerprint(a.gameObject);var p=a.transform.TransformPoint(new Vector3(14,2.25f,4));
                f.At(p,EventType.MouseDown);f.At(p-a.transform.up*.25f,EventType.MouseDrag);f.At(p-a.transform.up*.25f,EventType.MouseUp);
                Need(a.Read().Nodes[4].Y==1.75f,"Actual yellow node handle commits local height.");Need(a.Read().Nodes[3].Y==2&&a.Read().Nodes[0].Y==0,"Local height preserves unrelated node elevations.");Need(ReplicaGeometry.Fingerprint(a.gameObject)!=mesh,"Local height changes actual stairs/support/guard meshes.");
                Undo.FlushUndoRecordObjects();Undo.PerformUndo();Need(Json(a)==before&&ReplicaGeometry.Fingerprint(a.gameObject)==mesh,"One Undo restores local height and exact geometry.");
            }
        }
        static void VerticalMiddleLegHandle()
        {
            using(var f=new Fixture())
            {
                var doc=RouteExamples.Detour();foreach(var n in doc.Nodes){float x=n.X;n.X=-n.Z;n.Z=x;}f.Window.Create(doc);f.Window.SetDrawMode(false);var a=f.Window.Author;f.SelectNode(2);f.View.LookAt(new Vector3(-4,1,7),Quaternion.Euler(48,-32,0),16,true,true);Undo.ClearAll();
                var point=a.transform.TransformPoint(new Vector3(-8,2.45f,7));f.At(point,EventType.MouseDown);f.At(point-Vector3.right,EventType.MouseDrag);f.At(point-Vector3.right*2,EventType.MouseDrag);f.At(point-Vector3.right*2,EventType.MouseUp);
                Need(a.Read().Nodes[2].X==-10&&a.Read().Nodes[3].X==-10,"Vertical leg follows drag -X rather than moving in opposite direction.");
                Need(a.Read().Nodes[0].X==0&&a.Read().Nodes[a.Read().Nodes.Count-1].Z==14,"Rotated leg manipulation retains original endpoints.");
            }
        }
        static void EscapeKeepsPrevious()
        {
            using(var f=new Fixture())
            {
                var a=f.CreateDetour();string before=Json(a),mesh=ReplicaGeometry.Fingerprint(a.gameObject);f.Window.SetDrawMode(true);f.Window.BeginDraw(new Vector3(0,0,20));f.Window.DragDraw(new Vector3(14,0,20));Need(f.Window.Drawing,"Second route candidate is active.");f.Key(KeyCode.Escape);
                Need(!f.Window.Drawing&&Authors().Length==1&&Json(a)==before&&ReplicaGeometry.Fingerprint(a.gameObject)==mesh,"Esc discards only current route draft and preserves previous author/mesh.");
            }
        }
        static void InvalidFinalNeverCommitsOldPreview()
        {
            using(var f=new Fixture())
            {
                var a=f.CreateDetour();string before=Json(a),mesh=ReplicaGeometry.Fingerprint(a.gameObject);f.Window.SetDrawMode(true);f.Window.BeginDraw(new Vector3(0,0,20));
                f.Window.DragDraw(new Vector3(0,0,28));f.Window.DragDraw(new Vector3(14,0,28));Need(f.Window.DragDraw(new Vector3(14,0,20)),"Fixture has a valid detour candidate first.");
                Need(!f.Window.DragDraw(new Vector3(0,0,20)),"Returning to initial point creates invalid self-intersecting path.");Need(!f.Window.EndDraw(),"Invalid last state cannot apply a previous valid route candidate.");
                Need(Authors().Length==1&&Json(a)==before&&ReplicaGeometry.Fingerprint(a.gameObject)==mesh,"Invalid release preserves previous committed route exactly.");
            }
        }
        static void Case(string name,Action action){var c=new Check{name=name};try{action();}catch(Exception e){c.status="FAIL";c.error=e.GetBaseException().ToString();report.status="FAIL";}report.checks.Add(c);Debug.Log("REPLICA_INPUT "+name+" "+c.status+" "+c.error);}
        public static void Run()
        {
            Need(Application.isBatchMode,"Run only in isolated batch QA.");report=new Report();Case("fast-continuous-U-draw-keeps-middle-and-single-undo",FastContinuousMiddle);Case("preview-cadence-cannot-discard-input-samples",PreviewCadenceCannotDiscardSamples);Case("actual-cyan-handle-middle-leg-and-draft-undo",MiddleLegHandle);Case("vertical-cyan-handle-follows-visible-direction",VerticalMiddleLegHandle);Case("actual-yellow-handle-local-height",LocalHeightHandle);Case("Esc-preserves-previous-route",EscapeKeepsPrevious);Case("invalid-final-cannot-commit-stale-valid-route",InvalidFinalNeverCommitsOldPreview);
            string root=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??Path.GetFullPath(".");Directory.CreateDirectory(Path.Combine(root,"reports"));File.WriteAllText(Path.Combine(root,"reports/route-input-synthetic.json"),JsonUtility.ToJson(report,true));if(report.status!="PASS")throw new InvalidOperationException("Focused synthetic route input failed; inspect route-input-synthetic.json.");
        }
    }
    sealed class EventHost:IDisposable
    {
        readonly SceneView view;Action action;EventType expected;Exception failure;int delivered;
        public EventHost(SceneView target){view=target;SceneView.duringSceneGui+=OnGUI;}
        void OnGUI(SceneView sender){if(sender!=view||action==null||Event.current.type!=expected)return;var next=action;action=null;delivered++;try{next();}catch(Exception e){failure=e.GetBaseException();}}
        public void Deliver(Event e,Action route)
        {
            if(e.type!=EventType.Layout)Deliver(new Event{type=EventType.Layout,button=e.button,mousePosition=e.mousePosition},route);
            int before=delivered;action=route;expected=e.type;failure=null;try{view.SendEvent(e);}finally{action=null;}if(failure!=null)throw failure;if(delivered!=before+1)throw new InvalidOperationException("SceneView did not deliver synthetic "+expected);
        }
        public void Dispose(){SceneView.duringSceneGui-=OnGUI;action=null;}
    }
}
