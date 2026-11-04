using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.BridgeReplica.Editor;

namespace XingHai.BridgeReplica.QA
{
    // Real shown IMGUI window, unlike the input-only CreateInstance fixtures.
    // The entry point is run by the root in the isolated background QA Editor.
    // No desktop mouse/keyboard injection and no claim of physical UI testing.
    public static class ReplicaWindowGuiQa
    {
        static readonly BindingFlags Hidden=BindingFlags.NonPublic|BindingFlags.Instance;
        static readonly FieldInfo DrawMode=typeof(ReplicaWindow).GetField("drawMode",Hidden);
        [Serializable] sealed class Fact
        {
            public string name,status="PASS",error="";
            public bool actualShownWindow,buttonActivated,physicalInput=false;
            public int sentMousePairs;
            public float clickedY;
            public List<string> layoutErrors=new List<string>();
        }
        [Serializable] sealed class Report
        {
            public string status="ERROR",engine=Application.unityVersion;
            public string scope="Actual shown ReplicaWindow IMGUI Layout/MouseDown/MouseUp/Repaint. Background event dispatch, not physical mouse acceptance. AssetPreview asynchronous race remains an independent hypothesis unless an actual error is observed.";
            public bool physicalInput=false;
            public List<Fact> checks=new List<Fact>();
        }
        static Report report;
        static Fact current;
        static bool IsLayoutFailure(string message,string stack)
        {
            bool layout=message.IndexOf("GUILayout",StringComparison.OrdinalIgnoreCase)>=0||
                message.IndexOf("Getting control",StringComparison.OrdinalIgnoreCase)>=0;
            return layout&&(message.Contains("ReplicaWindow")||(stack??"").Contains("ReplicaWindow.OnGUI"));
        }
        static void Log(string message,string stack,LogType type)
        {
            if(current!=null&&IsLayoutFailure(message,stack))
                current.layoutErrors.Add(message.Length>500?message.Substring(0,500):message);
        }
        static void Dispatch(ReplicaWindow window,EventType kind,Vector2 mouse)
        {
            try{window.SendEvent(new Event{type=kind,button=0,mousePosition=mouse});}
            catch(Exception error)
            {
                var root=error.GetBaseException();
                if(IsLayoutFailure(root.Message,root.StackTrace))current.layoutErrors.Add(root.Message);
                else throw;
            }
        }
        static void Paint(ReplicaWindow window)
        {Dispatch(window,EventType.Layout,new Vector2(20,20));Dispatch(window,EventType.Repaint,new Vector2(20,20));}
        static void Click(ReplicaWindow window,Vector2 mouse)
        {
            // Do not insert a compensating Layout between MouseUp changing
            // production state and that same GUI event finishing its controls.
            Paint(window);Dispatch(window,EventType.MouseDown,mouse);Dispatch(window,EventType.MouseUp,mouse);
            Dispatch(window,EventType.Repaint,mouse);current.sentMousePairs++;
        }
        static void Case(string name,float x,Func<ReplicaWindow,bool> activated)
        {
            var fact=new Fact{name=name};report.checks.Add(fact);current=fact;
            ReplicaWindow window=null;
            try
            {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
                Selection.activeGameObject=null;Undo.ClearAll();
                window=ScriptableObject.CreateInstance<ReplicaWindow>();
                window.titleContent=new GUIContent("Bridge shown GUI QA");window.position=new Rect(30,30,760,820);
                window.Show();fact.actualShownWindow=true;window.Focus();Paint(window);
                // The top row is the only click region. Never click the source
                // import/file-dialog buttons farther below the initial header.
                for(float y=48;y<=104&&!activated(window);y+=4)
                {Click(window,new Vector2(x,y));if(activated(window)){fact.buttonActivated=true;fact.clickedY=y;}}
                if(!fact.buttonActivated)throw new InvalidOperationException("FIXTURE: the real top-row button was not activated; this is not a product PASS.");
                Paint(window);
                if(fact.layoutErrors.Count>0){fact.status="FAIL";fact.error="Shown production OnGUI logged an actual GUILayout/control-tree error after the button changed its structure.";}
            }
            catch(Exception error)
            {fact.status="ERROR";fact.error=error.GetBaseException().ToString();}
            finally
            {
                try{if(window!=null)window.Close();}
                catch(Exception error){fact.status="ERROR";fact.error+="\nCleanup: "+error.GetBaseException();}
                foreach(var author in UnityEngine.Object.FindObjectsOfType<ReplicaAuthor>())
                    ReplicaGeometry.Destroy(author.gameObject);
                current=null;
            }
            Debug.Log("REPLICA_SHOWN_GUI "+fact.name+" "+fact.status+" "+fact.error);
        }
        public static void Run()
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Use the isolated background QA project only.");
            report=new Report();Application.logMessageReceived+=Log;
            try
            {
                Case("drawing-button-changes-shown-layout-without-invalid-gui",45,w=>(bool)DrawMode.GetValue(w));
                Case("sample-button-creates-author-in-shown-window-without-invalid-gui",280,w=>w.Author!=null&&w.Author.Read()!=null);
                report.status=report.checks.Any(f=>f.status=="ERROR")?"ERROR":report.checks.All(f=>f.status=="PASS")?"PASS":"FAIL";
            }
            finally
            {
                Application.logMessageReceived-=Log;
                var root=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT");
                if(string.IsNullOrWhiteSpace(root))throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required.");
                File.WriteAllText(Path.Combine(root,"reports/replica-shown-gui.json"),JsonUtility.ToJson(report,true));
            }
            EditorApplication.Exit(report.status=="PASS"?0:1);
        }
    }
}
