using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.SB03.Editor;

namespace XingHai.SB03.QA
{
    public static class SB03SceneInputTests
    {
        [Serializable] sealed class Check {public string name,status="PASS",detail;}
        [Serializable] sealed class Report
        {
            public string status="PASS",engine=Application.unityVersion;
            public string scope="Actual production SceneGUI routed inside real SceneView SendEvent callbacks; synthetic events, no desktop input or human feel claim.";
            public List<Check> checks=new List<Check>();
        }
        static Report report;
        static string Root {get{return Environment.GetEnvironmentVariable("SB03_REPORT_ROOT")??Path.GetFullPath("SB03-reports");}}
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException(message);}
        static MethodInfo Route {get{return typeof(SB03BridgeWindow).GetMethod("SceneGUI",BindingFlags.Instance|BindingFlags.NonPublic);}}
        static MethodInfo Disable {get{return typeof(SB03BridgeWindow).GetMethod("OnDisable",BindingFlags.Instance|BindingFlags.NonPublic);}}
        sealed class Fixture : IDisposable
        {
            public readonly SceneView View;
            public readonly SB03BridgeWindow Window;
            readonly EventHost host;
            Vector2 lastMouse;
            public Action<string> Trace;
            public Fixture()
            {
                // Isolated QA may reopen windows from its saved layout. Stop
                // their observers so they cannot consume this fixture's events.
                foreach(var previous in Resources.FindObjectsOfTypeAll<SB03BridgeWindow>()){Disable.Invoke(previous,null);previous.Close();}
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Undo.ClearAll();Selection.activeGameObject=null;
                Window=ScriptableObject.CreateInstance<SB03BridgeWindow>();
                // Keep the real lifecycle observers (selection, Undo, tool
                // ownership). Only route SceneGUI through this event host, to
                // deliver exactly once inside the intended SceneView callback.
                SceneView.duringSceneGui-=(Action<SceneView>)Delegate.CreateDelegate(typeof(Action<SceneView>),Window,Route);
                View=ScriptableObject.CreateInstance<SceneView>();View.position=new Rect(0,0,1000,700);View.Show();View.position=new Rect(0,0,1000,700);View.Focus();
                View.LookAt(new Vector3(7,0,0),Quaternion.Euler(35,-35,0),12,true,true);
                host=new EventHost(View);
            }
            public void At(Vector3 point,EventType type,int button=0,bool alt=false)
            {
                host.Deliver(new Event{type=type,button=button,alt=alt,mousePosition=new Vector2(500,350)},()=>{
                    var gui=HandleUtility.WorldToGUIPoint(point);Event.current.mousePosition=gui;
                    if(Event.current.type==EventType.MouseDrag)Event.current.delta=gui-lastMouse;
                    if(Event.current.type==EventType.MouseDown||Event.current.type==EventType.MouseDrag||Event.current.type==EventType.MouseUp)lastMouse=gui;
                    string before=Trace==null?"":Snapshot(Window);
                    Route.Invoke(Window,new object[]{View});
                    if(Trace!=null)Trace(type+" mouse="+gui+" delta="+Event.current.delta+" before={"+before+"} after={"+Snapshot(Window)+"}");
                });
            }
            public void Key(KeyCode key)
            {host.Deliver(new Event{type=EventType.KeyDown,keyCode=key},()=>Route.Invoke(Window,new object[]{View}));}
            public void Dispose(){Window.CancelInput();host.Dispose();View.Close();UnityEngine.Object.DestroyImmediate(Window);}
        }
        static string Snapshot(SB03BridgeWindow window)
        {
            var draft=(BridgeSpec)typeof(SB03BridgeWindow).GetField("draft",BindingFlags.Instance|BindingFlags.NonPublic).GetValue(window);
            var a=window.Author;var s=a==null?null:SB03BridgeSession.Get(a);
            return "event="+Event.current.type+",raw="+Event.current.rawType+",hot="+GUIUtility.hotControl+",nearest="+HandleUtility.nearestControl+",draftHeight="+draft.DeckHeight+",authorHeight="+(a==null?-1:a.Spec.DeckHeight)+",candidate="+(s==null?false:s.HasCandidate)+",status="+window.Status+",matrix="+Handles.matrix;
        }
        static SB03BridgeAuthor[] Authors(){return UnityEngine.Object.FindObjectsOfType<SB03BridgeAuthor>();}
        static string Json(SB03BridgeAuthor a){return JsonUtility.ToJson(a.Spec);}
        static void Draw(Fixture f,params float[] samples)
        {
            f.Window.SetDrawMode(true);f.At(Vector3.zero,EventType.MouseDown);Need(f.Window.Drawing,"Actual mouse down begins one drawing gesture.");
            foreach(float x in samples)f.At(new Vector3(x,0,0),EventType.MouseDrag);
            f.At(new Vector3(samples[samples.Length-1],0,0),EventType.MouseUp);Need(!f.Window.Drawing,"Actual release ends the gesture.");
        }
        static void ContinuousCreation()
        {
            using(var f=new Fixture())
            {
                Draw(f,10,12,13,14);Need(Authors().Length==1,"A continuous drag creates exactly one author, not repeated whole bridges.");
                var a=Authors().Single();Need(Math.Abs(a.Spec.Length-14)<.001f,"Mouse-up position determines bridge length.");
                Need(a.GetComponentsInChildren<MeshFilter>().Length>=9,"The one author has actual combined source meshes.");
                string authored=Json(a),mesh=SB03EditorTests.MeshHash(a.gameObject);
                foreach(int button in new[]{1,2}){f.At(new Vector3(7,0,0),EventType.MouseDown,button);f.At(new Vector3(8,0,0),EventType.MouseDrag,button);f.At(new Vector3(8,0,0),EventType.MouseUp,button);}
                Need(Json(a)==authored&&SB03EditorTests.MeshHash(a.gameObject)==mesh,"Right/middle navigation after release retains committed author and exact meshes.");
                Undo.FlushUndoRecordObjects();Undo.PerformUndo();Need(Authors().Length==0,"One native Undo removes the one continuously drawn bridge.");
                Undo.PerformRedo();Need(Authors().Length==1,"One native Redo restores the one bridge.");a=Authors().Single();Need(Json(a)==authored&&SB03EditorTests.MeshHash(a.gameObject)==mesh,"Redo restores exact whole-bridge data and display.");
            }
        }
        static void EscapeCancels()
        {
            using(var f=new Fixture())
            {
                Draw(f,14);var original=Authors().Single();string json=Json(original),mesh=SB03EditorTests.MeshHash(original.gameObject);
                f.At(new Vector3(0,0,5),EventType.MouseDown);f.At(new Vector3(14,0,5),EventType.MouseDrag);Need(f.Window.Drawing,"Second draw gesture active.");f.Key(KeyCode.Escape);
                Need(!f.Window.Drawing&&Authors().Length==1,"Esc discards complete drawing candidate.");Need(Json(original)==json&&SB03EditorTests.MeshHash(original.gameObject)==mesh,"Esc preserves earlier bridge author and geometry.");
            }
        }
        static void InvalidFinalPoint()
        {
            using(var f=new Fixture())
            {
                f.Window.SetDrawMode(true);f.At(Vector3.zero,EventType.MouseDown);f.At(new Vector3(14,0,0),EventType.MouseDrag);
                f.At(new Vector3(2,0,0),EventType.MouseDrag);f.At(new Vector3(2,0,0),EventType.MouseUp);
                Need(!f.Window.Drawing,"Invalid release still ends gesture.");Need(Authors().Length==0,"An invalid final endpoint cannot silently commit the previous valid 14m candidate.");
            }
        }
        static void NativeHeightHandle()
        {
            using(var f=new Fixture())
            {
                Draw(f,14);var a=Authors().Single();f.Window.SetDrawMode(false);f.Window.SelectAuthor(a);Undo.ClearAll();
                string before=Json(a),mesh=SB03EditorTests.MeshHash(a.gameObject);
                f.At(new Vector3(7,2,0),EventType.MouseDown);
                for(int i=1;i<=5;i++)f.At(new Vector3(7,2+i*.05f,0),EventType.MouseDrag);
                f.At(new Vector3(7,2.25f,0),EventType.MouseUp);
                Need(Math.Abs(a.Spec.DeckHeight-2.25f)<.001f,"Actual cube height handle commits the quantized bridge elevation.");
                Need(SB03EditorTests.MeshHash(a.gameObject)!=mesh,"Handle changes actual stair/support/deck meshes together.");
                Undo.FlushUndoRecordObjects();Undo.PerformUndo();Need(Json(a)==before&&SB03EditorTests.MeshHash(a.gameObject)==mesh,"One Undo restores whole bridge after height-handle drag.");
                var shown=(BridgeSpec)typeof(SB03BridgeWindow).GetField("draft",BindingFlags.Instance|BindingFlags.NonPublic).GetValue(f.Window);
                Need(Math.Abs(shown.DeckHeight-a.Spec.DeckHeight)<.001f,"Undo also restores visible editor parameters, so the next width edit cannot reapply an undone elevation.");
            }
        }
        static void DensityInvariant()
        {
            using(var f=new Fixture()){Draw(f,14);var a=Authors().Single();string one=SB03EditorTests.MeshHash(a.gameObject);SB03BridgeGeometry.DestroyGeometry(a.gameObject);f.Window.CancelInput();
                Draw(f,4,6,8,10,12,13,13.5f,14);var b=Authors().Single();Need(SB03EditorTests.MeshHash(b.gameObject)==one,"Input sample density changes neither final source geometry nor rule arrangement.");}
        }
        static void SourceRevisionGuard()
        {
            using(var f=new Fixture())
            {
                f.Window.CreateStandard();var a=Authors().Single();var session=SB03BridgeSession.Get(a);string json=Json(a),mesh=SB03EditorTests.MeshHash(a.gameObject);
                string path=SB03BridgeGeometry.KitRoot+SB03BridgeGeometry.Kit.assets.Single(v=>v.id=="sb03.deck").fbx;
                byte[] original=File.ReadAllBytes(path),changed=new byte[original.Length+1];Array.Copy(original,changed,original.Length);changed[changed.Length-1]=10;
                try
                {
                    // Appending a harmless byte tests file identity after the
                    // actual kit has already populated its material cache.
                    File.WriteAllBytes(path,changed);var spec=a.Spec.Clone();spec.Length+=2;
                    Need(!session.Preview(spec),"Changed source FBX after cache warmup must reject, rather than certify old hash for new file bytes.");
                    Need(Json(a)==json&&SB03EditorTests.MeshHash(a.gameObject)==mesh,"Source version rejection preserves committed author and exact old meshes.");
                    Need(!session.Apply(),"Changed-source candidate cannot be applied.");
                }
                finally{File.WriteAllBytes(path,original);session.Cancel();AssetDatabase.ImportAsset(path,ImportAssetOptions.ForceSynchronousImport);}
            }
        }
        static void WindowUndoDraft()
        {
            using(var f=new Fixture())
            {
                f.Window.CreateStandard();var a=Authors().Single();var session=SB03BridgeSession.Get(a);Undo.ClearAll();
                var spec=a.Spec.Clone();spec.DeckHeight=2.25f;typeof(SB03BridgeWindow).GetField("draft",BindingFlags.Instance|BindingFlags.NonPublic).SetValue(f.Window,spec.Clone());
                Need(session.Preview(spec)&&session.Apply(),"Height candidate commits through the real session.");Undo.FlushUndoRecordObjects();Undo.PerformUndo();
                var shown=(BridgeSpec)typeof(SB03BridgeWindow).GetField("draft",BindingFlags.Instance|BindingFlags.NonPublic).GetValue(f.Window);
                Need(Math.Abs(a.Spec.DeckHeight-2)<.001f,"Native Undo restores earlier bridge elevation.");Need(Math.Abs(shown.DeckHeight-2)<.001f,"Native Undo also restores editor draft, avoiding silent reapplication by the next edit.");
            }
        }
        static void ClosingCancelsCandidate()
        {
            using(var f=new Fixture())
            {
                f.Window.CreateStandard();var a=Authors().Single();var session=SB03BridgeSession.Get(a);string json=Json(a),mesh=SB03EditorTests.MeshHash(a.gameObject);
                var spec=a.Spec.Clone();spec.Length=16;Need(session.Preview(spec),"Close fixture starts valid visible candidate.");Disable.Invoke(f.Window,null);
                Need(Json(a)==json&&SB03EditorTests.MeshHash(a.gameObject)==mesh&&!session.HasCandidate,"Closing tool discards uncommitted candidate instead of implicitly applying it.");
                Need(!Tools.hidden,"Closing the B tool releases native transform tools.");
            }
        }
        static void Case(string name,Action body)
        {var check=new Check{name=name};try{body();}catch(Exception e){check.status="FAIL";check.detail=e.GetBaseException().ToString();report.status="FAIL";}report.checks.Add(check);Debug.Log("SB03_INPUT_CHECK "+name+" "+check.status+" "+check.detail);}
        public static void Run()
        {
            Need(Application.isBatchMode,"Run only in isolated batch QA project.");report=new Report();
            Case("continuous-one-author-navigation-undo-redo",ContinuousCreation);Case("esc-cancels-draft-keeps-previous",EscapeCancels);Case("invalid-final-endpoint-cannot-commit-stale-valid-candidate",InvalidFinalPoint);Case("actual-scene-height-handle-whole-bridge-undo",NativeHeightHandle);Case("draw-sample-density-invariant",DensityInvariant);Case("cached-kit-rejects-changed-fbx-preserves-committed-bridge",SourceRevisionGuard);Case("native-undo-restores-window-draft",WindowUndoDraft);Case("closing-tool-cancels-candidate-releases-tools",ClosingCancelsCandidate);
            Directory.CreateDirectory(Root);File.WriteAllText(Path.Combine(Root,"scene-input-tests.json"),JsonUtility.ToJson(report,true));
            if(report.status!="PASS")throw new InvalidOperationException("SB03 actual SceneView input tests failed; inspect scene-input-tests.json.");
        }
        public static void HeightProbe(){HeightProbeBody(false);}
        public static void HeightProbeWithoutNativeTools(){HeightProbeBody(true);}
        static void HeightProbeBody(bool suppressNative)
        {
            Need(Application.isBatchMode,"Run only in isolated batch QA project.");var lines=new List<string>();
            Tool oldTool=Tools.current;bool oldHidden=Tools.hidden;
            try{using(var f=new Fixture())
            {
                Draw(f,14);var a=Authors().Single();f.Window.SetDrawMode(false);f.Window.SelectAuthor(a);Undo.ClearAll();
                if(suppressNative){Tools.current=Tool.None;Tools.hidden=true;}
                lines.Add("suppressNative="+suppressNative+" tool="+Tools.current+" hidden="+Tools.hidden+" root="+a.transform.position+" rotation="+a.transform.rotation+" camera="+f.View.camera.transform.position+" view="+f.View.position+" cameraRect="+f.View.camera.pixelRect);
                f.Trace=message=>{lines.Add(message);Debug.Log("SB03_HANDLE_PROBE "+message);};
                f.At(a.transform.TransformPoint(new Vector3(7,2,0)),EventType.Repaint);
                f.At(a.transform.TransformPoint(new Vector3(7,2,0)),EventType.MouseMove);
                f.At(a.transform.TransformPoint(new Vector3(7,2,0)),EventType.MouseDown);
                for(int i=1;i<=5;i++){f.At(a.transform.TransformPoint(new Vector3(7,2+i*.05f,0)),EventType.MouseDrag);f.At(a.transform.TransformPoint(new Vector3(7,2+i*.05f,0)),EventType.Repaint);}
                f.At(a.transform.TransformPoint(new Vector3(7,2.25f,0)),EventType.MouseUp);
                lines.Add("finalHeight="+a.Spec.DeckHeight+" rootPosition="+a.transform.position+" rootRotation="+a.transform.rotation+" tool="+Tools.current+" hidden="+Tools.hidden);
            }}finally{Tools.current=oldTool;Tools.hidden=oldHidden;}
            Directory.CreateDirectory(Root);File.WriteAllLines(Path.Combine(Root,suppressNative?"height-probe-without-native.txt":"height-probe.txt"),lines);
        }
    }
    sealed class EventHost : IDisposable
    {
        readonly SceneView view;Action action;EventType expected;Exception failure;int deliveries;string skipped;
        public EventHost(SceneView value){view=value;SceneView.duringSceneGui+=OnGUI;}
        void OnGUI(SceneView sender)
        {
            if(sender!=view||action==null)return;
            if(Event.current.rawType==expected&&Event.current.type!=expected)skipped="raw="+Event.current.rawType+",type="+Event.current.type+",hot="+GUIUtility.hotControl;
            if(Event.current.type!=expected)return;var invoke=action;action=null;deliveries++;try{invoke();}catch(Exception e){failure=e.GetBaseException();}
        }
        public void Deliver(Event e,Action route)
        {
            if(e.type!=EventType.Layout)Deliver(new Event{type=EventType.Layout,button=e.button,alt=e.alt,mousePosition=e.mousePosition},route);
            int before=deliveries;action=route;expected=e.type;failure=null;skipped=null;try{view.SendEvent(e);}finally{action=null;}
            if(failure!=null)throw failure;if(deliveries!=before+1)throw new InvalidOperationException("Harness: SceneView did not deliver "+expected+"; "+skipped);
        }
        public void Dispose(){action=null;SceneView.duringSceneGui-=OnGUI;}
    }
}
