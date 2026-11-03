using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01;
using XingHai.LE01.Core;
using XingHai.LE01.Editor;

namespace XingHai.LE04.QA
{
    public static class LE04EditorTests
    {
        [Serializable] sealed class Report {public string engine,sourceHash=LE01BEvidence.SourceHash(),status="PASS",scope="Real controller and Mesh/Collider/native resources; synthetic SceneView events are not physical input.";public List<Check> checks=new List<Check>();}
        [Serializable] sealed class Reopened {public string status="PASS",engine=Application.unityVersion,sourceHash=LE01BEvidence.SourceHash();public bool newProcess=true;}
        [Serializable] sealed class Check {public string name,status="PASS",detail;}
        static Report report;static string Root {get{return Environment.GetEnvironmentVariable("LE04_REPORT_ROOT")??Path.GetFullPath("LE04-reports");}}
        static void Need(bool condition,string why){if(!condition)throw new InvalidOperationException(why);}
        public static void Drain(LE04TerrainSession session,bool preview=false)
        {
            var timer=System.Diagnostics.Stopwatch.StartNew();int uploads=session.PreviewUploads;
            do{session.Tick();if(preview&&session.PreviewUploads>uploads)return;if(!preview&&!session.Busy)return;Thread.Sleep(1);}while(timer.ElapsedMilliseconds<20000);
            throw new TimeoutException("LE04 background operation did not settle: "+session.Status);
        }
        public static LE01TerrainAuthor Fixture()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var doc=TerrainGenerators.UpgradeToV3(new TerrainDocument{Id="LE04_editor_fixture",BaseHeight=-16,ActiveQuantum=4});
            var command=new TerrainCommand{Mode=BrushMode.Extend,Radius=2,Quantum=4,PlaneHeight=0};command.Path.Add(new Point2(0,0));doc=TerrainKernel.Apply(doc,command).Document;
            var author=new GameObject("LE04_Terrain").AddComponent<LE01TerrainAuthor>();author.Write(doc);author.gameObject.AddComponent<LE04TerrainState>().Write(new TerrainEditState());
            var session=LE04TerrainSession.Get(author);Drain(session);Need(session.Ready,"Initial effective source and actual merged Mesh are ready");Undo.ClearAll();return author;
        }
        public static VoxelModuleAsset Reference()
        {
            return new VoxelModuleAsset{schemaVersion=1,assetId="le04.qa.neutral",assetVersion=1,sourceHash=new string('a',64),voxelSize=.25f,origin=new[]{0f,0f,0f},size=new[]{2,2,1},pivot=new[]{0f,0f,0f},palette=new List<VoxelPaletteEntry>{new VoxelPaletteEntry{id="warm",role="solid",rgba=new[]{.8f,.45f,.2f,1}},new VoxelPaletteEntry{id="white-is-color",role="snow",rgba=new[]{.95f,.95f,.95f,1}}},voxels=new List<VoxelCell>{new VoxelCell{x=0,y=0,z=0,material=0,faces=Enumerable.Repeat(0,6).ToArray()},new VoxelCell{x=1,y=0,z=0,material=0,faces=Enumerable.Repeat(0,6).ToArray()},new VoxelCell{x=0,y=1,z=0,material=1,faces=Enumerable.Repeat(1,6).ToArray()}}};
        }
        static void RunCase(string name,Action body){var c=new Check{name=name};try{body();}catch(Exception e){c.status="FAIL";c.detail=e.GetBaseException().ToString();report.status="FAIL";}report.checks.Add(c);Debug.Log("LE04_CHECK "+name+" "+c.status+" "+c.detail);}
        static string MeshHash(LE01TerrainAuthor a){return LE01CEvidence.MeshFingerprint(a);}
        static void AnchorCancelAndApply()
        {
            var a=Fixture();var s=LE04TerrainSession.Get(a);string before=s.Current.ContentHash(),mesh=MeshHash(a);var point=Vector3.zero;
            s.Settings.Mode="Raise";s.Settings.Amount=.25f;Need(s.BeginAnchor(point,Vector3.up),"Begin actual surface anchor");Drain(s,true);
            Need(s.Current.ContentHash()==before&&MeshHash(a)!=mesh,"Preview changes actual mesh without writing author");
            s.Settings.PositiveX=.75f;s.Settings.NegativeX=.25f;s.RequestPreview();Drain(s,true);Need(s.AnchorPoint==point,"Range slider keeps first anchor fixed");
            s.Cancel();Need(s.Current.ContentHash()==before&&MeshHash(a)==mesh,"Esc/cancel restores exact committed mesh and source");
            Need(s.BeginAnchor(point,Vector3.up),"Second anchor");Drain(s,true);s.Apply();Drain(s);Need(s.Current.State.Revision==1,"Anchor Apply produces one author revision");
            Undo.FlushUndoRecordObjects();Undo.PerformUndo();s.Rebuild(true);Drain(s);Need(s.Current.ContentHash()==before,"Undo restores original effective author");
            Undo.PerformRedo();s.Rebuild(true);Drain(s);Need(s.Current.State.Revision==1,"Redo restores one anchor application");
            LE04TerrainSession.Forget(a);
        }
        static void PaintReferenceAndPersistence()
        {
            var a=Fixture();var s=LE04TerrainSession.Get(a);s.Settings.Tool="paint";s.Settings.Paint=new Color(.8f,.2f,.3f,1);
            Need(s.BeginStroke(Vector3.zero,Vector3.up),"Paint start");s.Drag(new Vector3(.5f,0,0),Vector3.up);s.Release();Drain(s);Need(s.Current.State.PaintRuns.Count>0,"Continuous paint writes spatial runs");
            Need(s.AddReference(Reference(),"original-qa-source"),"Import actual certified source");s.Settings.Tool="reference";s.Settings.ScaleX=2;s.Settings.ScaleY=s.Settings.ScaleZ=1;s.Settings.BlendWidth=0;s.Settings.ReferenceMode=ReferenceBrushMode.Add;
            Need(s.BeginStroke(new Vector3(0,0,0),Vector3.up),"Reference start");s.Drag(new Vector3(1,0,0),Vector3.up);s.Release();Drain(s);
            Need(s.Current.State.OwnedColumns.Count>0&&s.Current.State.References.Count==1,"Reference writes effective volume and source library");
            string hash=s.Current.ContentHash();string path=Path.Combine(Root,"editor-native.basicterrain.json");LE04TerrainFiles.Save(a,path);
            var file=LE04TerrainFiles.Read(File.ReadAllText(path));Need(file.editState.OwnedColumns.Count==s.Current.State.OwnedColumns.Count&&file.editState.PaintRuns.Count==s.Current.State.PaintRuns.Count,"File contains volume and paint");
            LE04TerrainFiles.SaveScene(a,"Assets/LE04/Scenes/EditorPersistence.unity");
            LE01Export.Export(LE01Adapter.Geometry(a),Path.Combine(Root,"editor-persistence.fbx"));
            File.WriteAllText(Path.Combine(Root,"editor-persistence-expected.json"),JsonUtility.ToJson(new Expected{hash=hash,mesh=MeshHash(a),scene="Assets/LE04/Scenes/EditorPersistence.unity",file=path}));
            Need(LE01Adapter.Geometry(a).GetComponentsInChildren<MeshFilter>().All(f=>AssetDatabase.Contains(f.sharedMesh)),"Scene owns persistent meshes");LE04TerrainSession.Forget(a);
        }
        [Serializable] sealed class Expected {public string hash,mesh,scene,file;}
        static void BusyAndStale()
        {
            var a=Fixture();var s=LE04TerrainSession.Get(a);s.Settings.Mode="Raise";Need(s.BeginStroke(Vector3.zero,Vector3.up),"Busy stroke start");bool denied=false;
            try{LE04TerrainFiles.Save(a,Path.Combine(Root,"must-not-save.json"));}catch(InvalidOperationException){denied=true;}Need(denied,"Busy save rejected");
            string before=s.Current.ContentHash();s.Release();s.Cancel();for(int i=0;i<20;i++){s.Tick();Thread.Sleep(1);}Need(s.Current.ContentHash()==before&&!s.Active,"Cancelled late worker cannot overwrite author");LE04TerrainSession.Forget(a);
        }
        static void TranslationAndIndependentProp()
        {
            var a=Fixture();var s=LE04TerrainSession.Get(a);var prop=GameObject.CreatePrimitive(PrimitiveType.Cube);prop.name="IndependentOriginalQAProp";prop.transform.position=new Vector3(8,1,4);var propMesh=prop.GetComponent<MeshFilter>().sharedMesh;var propMatrix=prop.transform.localToWorldMatrix;
            s.Settings.Mode="Raise";Need(s.BeginStroke(Vector3.zero,Vector3.up),"Shape beside independent object");s.Release();Drain(s);Need(prop.GetComponent<MeshFilter>().sharedMesh==propMesh&&prop.transform.localToWorldMatrix==propMatrix&&prop.transform.parent==null,"A edits preserve separate root, mesh and placement");
            a.transform.position=new Vector3(12,3,-4);string path=Path.Combine(Root,"translated.basicterrain.json");LE04TerrainFiles.Save(a,path);var file=LE04TerrainFiles.Read(File.ReadAllText(path));
            Need(file.terrain.OriginX==12&&file.terrain.OriginY==3&&file.terrain.OriginZ==-4,"Translation persisted in complete file");Need(file.editState.BaseTerrainHash==TerrainQueries.ContentHash(file.terrain),"Translated basis and extension hashes agree");
            var loaded=TerrainEffectiveSource.Capture(file.terrain,file.editState);Need(loaded.State.OwnedColumns.Count==s.Current.State.OwnedColumns.Count,"Translated load keeps volume overrides");
            bool denied=false;a.transform.localScale=Vector3.one*2;try{LE04TerrainFiles.SaveScene(a,"Assets/LE04/Scenes/InvalidScale.unity");}catch(InvalidOperationException){denied=true;}Need(denied,"Native scene enforces metre grid transform contract");a.transform.localScale=Vector3.one;LE04TerrainSession.Forget(a);
        }
        static void DistinctStrokeUndo()
        {
            var a=Fixture();var s=LE04TerrainSession.Get(a);s.Settings.Mode="Raise";s.Settings.Radius=.35f;
            Need(s.BeginStroke(new Vector3(-.75f,0,0),Vector3.up),"First stroke starts");s.Release();Drain(s);Undo.FlushUndoRecordObjects();string first=s.Current.ContentHash();
            Need(s.BeginStroke(new Vector3(.75f,0,0),Vector3.up),"Second stroke starts");s.Release();Drain(s);Undo.FlushUndoRecordObjects();Need(s.Current.ContentHash()!=first,"Second settled stroke changes separate area");
            Undo.PerformUndo();s.Rebuild(true);Drain(s);Need(s.Current.ContentHash()==first&&s.Current.State.Revision==1,"One Undo removes only the second settled stroke, even when both finish in one editor frame");LE04TerrainSession.Forget(a);
        }
        static void PrimaryEntry()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);LE01Window.NewBasic();var window=LE01Window.Instance;Need(window!=null&&LE04TerrainSession.Has(window.Controller.Author),"Primary NewBasic menu creates adjacent v2 state");var session=window.BasicSession;Drain(session);
            window.SendEvent(new Event{type=EventType.Layout});window.SendEvent(new Event{type=EventType.Repaint});Need(session.Ready,"Primary window drawing keeps new v2 session usable");LE04TerrainSession.Forget(window.Controller.Author);window.Close();
        }
        static void LoadTransformUndo()
        {
            var a=Fixture();var s=LE04TerrainSession.Get(a);var original=a.transform.position;var terrain=a.Read();terrain.OriginX=8;terrain.OriginY=2;terrain.OriginZ=-6;var edits=s.Current.State.Copy();edits.BaseTerrainHash=TerrainQueries.ContentHash(terrain);
            LE04TerrainFiles.LoadInto(a,new BasicTerrainFile{terrain=terrain,editState=edits,brushJson=JsonUtility.ToJson(s.Settings)});Need(a.transform.position==new Vector3(8,2,-6),"Open changes the complete author placement");Undo.FlushUndoRecordObjects();Undo.PerformUndo();
            Need(a.transform.position==original,"Undo opening a translated complete file restores the old world transform as well as its data");LE04TerrainSession.Get(a).Rebuild(true);Drain(LE04TerrainSession.Get(a));LE04TerrainSession.Forget(a);
        }
        static void ClosedSceneReleasesCache()
        {
            var a=Fixture();var sessions=(System.Collections.IDictionary)typeof(LE04TerrainSession).GetField("sessions",BindingFlags.Static|BindingFlags.NonPublic).GetValue(null);int count=sessions.Count;Need(count>0,"Fixture owns a cached effective world");
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Need(sessions.Count<count,"Closing the scene removes its world and mesh cache from static session storage");
        }
        static void WindowNavigation()
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Window diagnostics may close QA windows only in the isolated batch project.");
            // A saved QA layout can reopen a production tool window before Run(). Its
            // duringSceneGui listener would legitimately consume the synthetic click
            // before this host can deliver it. Remove those QA-only observers first.
            var existingWindows=Resources.FindObjectsOfTypeAll<LE01Window>();
            foreach(var existing in existingWindows){typeof(LE01Window).GetMethod("OnDisable",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(existing,null);existing.Close();if(existing!=null)UnityEngine.Object.DestroyImmediate(existing);}
            Debug.Log("LE04_NAV_ISOLATION closedExistingToolWindows="+existingWindows.Length);
            var a=Fixture();var s=LE04TerrainSession.Get(a);var window=ScriptableObject.CreateInstance<LE01Window>();typeof(LE01Window).GetMethod("OnDisable",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(window,null);window.Controller.Author=a;
            var view=ScriptableObject.CreateInstance<SceneView>();view.position=new Rect(0,0,720,540);view.Show();view.position=new Rect(0,0,720,540);view.Focus();view.LookAt(Vector3.zero,Quaternion.Euler(45,-35,0),5,false,true);Debug.Log("LE04_NAV_VIEW position="+view.position+",cameraRect="+view.camera.pixelRect);
            var route=typeof(LE01Window).GetMethod("OnBasicScene",BindingFlags.Instance|BindingFlags.NonPublic);
            try {using(var host=new LE04EventHost(view))
            {
                Action call=()=>route.Invoke(window,new object[]{view});s.Settings.Mode="Raise";s.Settings.Amount=.25f;Need(s.BeginStroke(Vector3.zero,Vector3.up),"Start released navigation case");s.Release();
                host.Deliver(new Event{type=EventType.MouseDown,button=1,mousePosition=new Vector2(500,68)},call);Drain(s);Need(s.Current.State.Revision==1,"Real right-click route retains released commit");host.Deliver(new Event{type=EventType.MouseUp,button=1,mousePosition=new Vector2(500,68)},call);
                string hash=s.Current.ContentHash(),mesh=MeshHash(a);Need(s.BeginStroke(Vector3.zero,Vector3.up),"Active case");Drain(s,true);
                host.Deliver(new Event{type=EventType.MouseDown,button=2,mousePosition=new Vector2(500,68)},call);Need(!s.Active&&s.Current.ContentHash()==hash&&MeshHash(a)==mesh&&host.LastRouteHot==0,"Active middle navigation restores exact resources and releases brush capture; active="+s.Active+",authorSame="+(s.Current.ContentHash()==hash)+",meshSame="+(MeshHash(a)==mesh)+",brushRouteHot="+host.LastRouteHot+",nativeAfterHot="+GUIUtility.hotControl);host.Deliver(new Event{type=EventType.MouseUp,button=2,mousePosition=new Vector2(500,68)},call);
                s.Settings.AnchorMode=true;
                host.Deliver(new Event{type=EventType.MouseDown,button=0,mousePosition=new Vector2(360,260)},()=>{Event.current.mousePosition=HandleUtility.WorldToGUIPoint(new Vector3(.25f,.25f,.25f));call();});
                Need(s.Active&&s.Anchor,"Actual SceneView mouse hit starts fixed anchor");host.Deliver(new Event{type=EventType.MouseUp,button=0,mousePosition=new Vector2(360,260)},call);s.Cancel();
                Need(s.AddReference(Reference(),"original-qa-source"),"Window source ready");s.Settings.Tool="reference";s.Settings.AnchorMode=false;s.Settings.BlendWidth=0;s.Settings.ScaleX=s.Settings.ScaleY=s.Settings.ScaleZ=1;int revision=s.Current.State.Revision;
                Action<Vector3,EventType> at=(point,type)=>host.Deliver(new Event{type=type,button=0,mousePosition=new Vector2(360,260)},()=>{Event.current.mousePosition=HandleUtility.WorldToGUIPoint(point);call();});
                at(new Vector3(-1,.25f,.5f),EventType.MouseDown);Need(s.Active&&!s.Anchor,"Real mouse down starts continuous reference brush");
                for(int i=1;i<=12;i++)at(new Vector3(-1+i/6f,.25f,.5f),EventType.MouseDrag);
                at(new Vector3(1,.25f,.5f),EventType.MouseUp);Drain(s);
                Need(s.Current.State.Revision==revision+1&&s.Current.State.OwnedColumns.Count>0,"Real continuous SceneView drag commits one effective-volume stroke");
                Need(s.Current.ColumnAt(-12,9).Any(span=>span.Max>4)&&s.Current.ColumnAt(12,9).Any(span=>span.Max>4),"Continuous visible reference stroke covers both distant path points");
            }}
            finally{view.Close();if(window!=null)UnityEngine.Object.DestroyImmediate(window);LE04TerrainSession.Forget(a);}
        }
        public static void Run()
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Run only in isolated batch QA project.");Directory.CreateDirectory(Root);report=new Report{engine=Application.unityVersion};
            RunCase("anchor-slider-cancel-apply-undo-redo",AnchorCancelAndApply);RunCase("visible-paint-reference-native-scene-fbx",PaintReferenceAndPersistence);RunCase("busy-save-stale-result",BusyAndStale);RunCase("translation-independent-prop",TranslationAndIndependentProp);RunCase("actual-window-navigation-and-anchor-event",WindowNavigation);RunCase("two-settled-strokes-distinct-undo",DistinctStrokeUndo);RunCase("primary-v2-menu-and-window",PrimaryEntry);
            File.WriteAllText(Path.Combine(Root,"editor-integration.json"),JsonUtility.ToJson(report,true));if(report.status!="PASS")throw new InvalidOperationException("LE04 editor integration failed; inspect editor-integration.json");
        }
        public static void Reopen()
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Run only in isolated batch QA project.");var expected=JsonUtility.FromJson<Expected>(File.ReadAllText(Path.Combine(Root,"editor-persistence-expected.json")));
            EditorSceneManager.OpenScene(expected.scene);var a=UnityEngine.Object.FindObjectOfType<LE01TerrainAuthor>();Need(a!=null&&LE04TerrainSession.Has(a),"Scene restores adjacent v2 state");Need(MeshHash(a)==expected.mesh,"Persistent scene mesh exists before rebuild");
            var s=LE04TerrainSession.Get(a);Drain(s);Need(s.Current.ContentHash()==expected.hash&&MeshHash(a)==expected.mesh,"New process scene source and merged geometry equal");
            var file=LE04TerrainFiles.Read(File.ReadAllText(expected.file));Need(TerrainEffectiveSource.Capture(file.terrain,file.editState).ContentHash()==expected.hash,"Complete file in separate process equals scene");
            Need(s.Settings.Tool=="reference"&&s.Settings.ScaleX==2&&s.Current.State.References.Count==1,"Brush settings and actual source restore");s.Settings.Tool="shape";s.Settings.Mode="Raise";Need(s.BeginStroke(Vector3.zero,Vector3.up),"Continued edit after reopen");s.Release();Drain(s);
            Undo.FlushUndoRecordObjects();Undo.PerformUndo();s.Rebuild(true);Drain(s);Need(s.Current.ContentHash()==expected.hash,"Continued edit undo returns exact reopened author");
            File.WriteAllText(Path.Combine(Root,"editor-reopen.json"),JsonUtility.ToJson(new Reopened(),true));
        }
        public static void RunUndoOnly(){Directory.CreateDirectory(Root);report=new Report{engine=Application.unityVersion};RunCase("two-settled-strokes-distinct-undo",DistinctStrokeUndo);File.WriteAllText(Path.Combine(Root,"editor-distinct-undo.json"),JsonUtility.ToJson(report,true));if(report.status!="PASS")throw new InvalidOperationException("Distinct settled stroke Undo failed");}
        public static void RunLifecycleOnly(){Directory.CreateDirectory(Root);report=new Report{engine=Application.unityVersion};RunCase("translated-file-load-undo",LoadTransformUndo);RunCase("closed-scene-releases-world-cache",ClosedSceneReleasesCache);File.WriteAllText(Path.Combine(Root,"editor-lifecycle.json"),JsonUtility.ToJson(report,true));if(report.status!="PASS")throw new InvalidOperationException("LE04 lifecycle behavior failed");}
        public static void RunNavigationOnly(){Directory.CreateDirectory(Root);report=new Report{engine=Application.unityVersion};RunCase("actual-window-navigation-anchor-and-continuous-drag",WindowNavigation);File.WriteAllText(Path.Combine(Root,"editor-navigation.json"),JsonUtility.ToJson(report,true));if(report.status!="PASS")throw new InvalidOperationException("LE04 actual window event behavior failed");}
    }
    sealed class LE04EventHost : IDisposable
    {
        readonly SceneView view;Action route;EventType expected;Exception failure;int deliveries;public int LastRouteHot;string skipped;
        public LE04EventHost(SceneView view){this.view=view;SceneView.duringSceneGui+=OnGUI;}
        void OnGUI(SceneView sender){if(sender!=view||route==null)return;if(Event.current.rawType==expected&&Event.current.type!=expected)skipped="raw="+Event.current.rawType+",type="+Event.current.type+",hot="+GUIUtility.hotControl;if(Event.current.type!=expected)return;var action=route;route=null;deliveries++;try{action();LastRouteHot=GUIUtility.hotControl;}catch(Exception e){failure=e.GetBaseException();}}
        public void Deliver(Event e,Action action){if(e.type!=EventType.Layout)Deliver(new Event{type=EventType.Layout},action);int before=deliveries;route=action;expected=e.type;var requested=expected;failure=null;skipped=null;int beforeHot=GUIUtility.hotControl;try{view.SendEvent(e);}finally{route=null;}if(failure!=null)throw failure;if(deliveries!=before+1)throw new InvalidOperationException("Harness: real SceneView did not deliver "+requested+"; "+skipped+"; beforeHot="+beforeHot+",afterHot="+GUIUtility.hotControl+",position="+e.mousePosition);}
        public void Dispose(){route=null;SceneView.duringSceneGui-=OnGUI;}
    }
}
