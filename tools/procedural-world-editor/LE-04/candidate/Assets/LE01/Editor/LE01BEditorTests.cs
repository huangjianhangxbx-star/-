using System;
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public static class LE01BEditorTests
    {
        static int assertions;
        [Serializable] class Summary {public string engine,utc,sourceHash,status,input="Unity controller/Physics replay, not physical mouse or GUI pixels";public int assertions,cases;}
        public static string Root {get{return LE01Export.IterationRoot;}}
        static void Require(bool condition,string message){if(!condition)throw new Exception("LE01B_EDITOR_CHECK_FAIL "+message);assertions++;Debug.Log("LE01B_EDITOR_CHECK_PASS "+message);}
        public static void RunTargeted()
        {
            assertions=0;var summary=new Summary{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O"),sourceHash=LE01BEvidence.SourceHash(),status="FAIL"};
            try{PickerRed();summary.cases++;SculptTransactionRed();summary.cases++;ContinuousPreviewRed();summary.cases++;ObsoleteFaultRed();summary.cases++;HoverCacheRed();summary.cases++;summary.status="PASS";}
            finally{summary.assertions=assertions;Directory.CreateDirectory(Path.Combine(Root,"notes"));File.WriteAllText(Path.Combine(Root,"notes/editor-targeted-validation.json"),JsonUtility.ToJson(summary,true));}
            Debug.Log("LE01B_EDITOR_TARGETED_COMPLETE");
        }
        public static LE01TerrainAuthor WallFixture()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var go=new GameObject("LE01B_TestAuthor");var a=go.AddComponent<LE01TerrainAuthor>();
            var d=new TerrainDocument{Id="B_picker-fixture",BaseHeight=-64,ActiveQuantum=4};
            var command=new TerrainCommand{Mode=BrushMode.Extend,Radius=2,Quantum=4,PlaneHeight=0};command.Path.Add(new Point2(0,0));
            var result=TerrainKernel.Apply(d,command);Require(!result.Rejected&&result.Changed,"fixture has real terrain");a.Write(result.Document);LE01Adapter.Upload(a,TerrainCompiler.Build(a.Read()),true,true);Physics.SyncTransforms();return a;
        }
        public static void PickerRed()
        {
            var a=WallFixture();
            var picker=typeof(LE01Adapter).GetMethod("TryPickSculpt",BindingFlags.Public|BindingFlags.Static);
            Require(picker!=null,"side-wall picker exists");
            Func<Ray,bool> pick=ray=>{object[] args={a,ray,null,null};return (bool)picker.Invoke(null,args);};
            Require(pick(new Ray(new Vector3(0,-1,-8),Vector3.forward)),"nearest visible front side accepted");
            Require(!pick(new Ray(new Vector3(0,4,0),Vector3.down)),"horizontal top is not a wall");
            var blocker=GameObject.CreatePrimitive(PrimitiveType.Cube);blocker.name="VisibleOtherObject";blocker.transform.position=new Vector3(0,-1,-4);blocker.transform.localScale=new Vector3(2,2,.25f);Physics.SyncTransforms();
            Require(!pick(new Ray(new Vector3(0,-1,-8),Vector3.forward)),"front occluder prevents painting wall behind");
            UnityEngine.Object.DestroyImmediate(blocker);a.transform.position=new Vector3(8.25f,2,-6.5f);Physics.SyncTransforms();
            Require(pick(new Ray(a.transform.position+new Vector3(0,-1,-8),Vector3.forward)),"translated author side accepted in local coordinates");
            Directory.CreateDirectory(Path.Combine(Root,"notes"));File.WriteAllText(Path.Combine(Root,"notes/picker-green.txt"),"Real Unity Physics ray + visible nearest-surface policy; no physical mouse input.\n");
            Debug.Log("LE01B_PICKER_GREEN");
        }
        public static void SculptTransactionRed()
        {
            var begin=typeof(LE01Stroke).GetMethod("BeginSculpt",new[]{typeof(SurfaceHit),typeof(Vector2)});
            var drag=typeof(LE01Stroke).GetMethod("DragSculpt",new[]{typeof(Vector2),typeof(bool)});
            Require(begin!=null&&drag!=null,"fixed wall sculpt transaction entry exists");
            var a=WallFixture();a.Write(TerrainGenerators.UpgradeToV2(a.Read()));LE01Adapter.Upload(a,TerrainCompiler.Build(a.Read()),true,true);
            SurfaceHit hit;string message;Require(LE01Adapter.TryPickSculpt(a,new Ray(new Vector3(0,-1,-8),Vector3.forward),out hit,out message),"actual generated wall ray selects sculpt target");
            var s=new LE01Stroke{Author=a,Mode=BrushMode.SculptDepth,Radius=.65f};typeof(LE01Stroke).GetField("SculptStrength").SetValue(s,-.125f);
            string source=TerrainQueries.ContentHash(a.Read());Require((bool)begin.Invoke(s,new object[]{hit,new Vector2(100,100)}),"sculpt down starts fixed author selection");string selected=JsonUtility.ToJson(s.Command.Selection);
            drag.Invoke(s,new object[]{new Vector2(80,100),true});float value=s.Command.Strength;drag.Invoke(s,new object[]{new Vector2(80,100),true});Require(Mathf.Abs(value+.225f)<.00001f&&s.Command.Strength==value,"repeated horizontal input has bounded snapshot strength");
            Require(JsonUtility.ToJson(s.Command.Selection)==selected&&TerrainQueries.ContentHash(a.Read())==source,"drag does not repick target or write author");
            s.End();Require(!s.Active&&a.Read().SculptOverrides.Count==1,"release commits one persistent sculpt record");string changed=TerrainQueries.ContentHash(a.Read());Undo.PerformUndo();s.UndoChanged();Require(TerrainQueries.ContentHash(a.Read())==source,"one sculpt undo restores author intent");Undo.PerformRedo();s.UndoChanged();Require(TerrainQueries.ContentHash(a.Read())==changed,"one sculpt redo restores author intent");
            begin.Invoke(s,new object[]{hit,new Vector2(100,100)});drag.Invoke(s,new object[]{new Vector2(130,100),true});s.Handle(LE01InputKind.Escape,Vector3.zero,0);Require(!s.Active&&TerrainQueries.ContentHash(a.Read())==changed,"sculpt escape cancels intent");Debug.Log("LE01B_SCULPT_TRANSACTION_GREEN");
        }
        public static void ContinuousPreviewRed()
        {
            var constructor=typeof(LE01Stroke).GetConstructor(new[]{typeof(Func<TerrainDocument,TerrainCommand,TerrainResult>)});Require(constructor!=null,"preview evaluator seam for controlled slow pipeline");
            Func<TerrainDocument,TerrainCommand,TerrainResult> slow=(doc,command)=>{System.Threading.Thread.Sleep(50);return TerrainKernel.Apply(doc,command);};var s=(LE01Stroke)constructor.Invoke(new object[]{slow});
            var a=WallFixture();a.Write(TerrainGenerators.UpgradeToV2(a.Read()));LE01Adapter.Upload(a,TerrainCompiler.Build(a.Read()),true,true);SurfaceHit hit;string message;Require(LE01Adapter.TryPickSculpt(a,new Ray(new Vector3(0,-1,-8),Vector3.forward),out hit,out message),"preview fixture ray accepted");
            s.Author=a;s.Mode=BrushMode.SculptDepth;s.Radius=.65f;s.SculptStrength=-.125f;Require(s.BeginSculpt(hit,new Vector2(100,100)),"controlled slow stroke begins");
            var uploads=typeof(LE01Stroke).GetProperty("PreviewUploads");Require(uploads!=null,"actual preview uploads observable");
            for(int i=0;i<30;i++){s.DragSculpt(new Vector2(100-i,100),true);s.Tick();System.Threading.Thread.Sleep(10);}
            Require((int)uploads.GetValue(s,null)>0&&s.Active,"continuous inputs still upload actual mesh before release");
            s.DragSculpt(new Vector2(80,100),true);s.End();Require(Mathf.Abs(a.Read().SculptOverrides[a.Read().SculptOverrides.Count-1].Value+.225f)<.00001f,"release commits latest strength");
            string committed=TerrainQueries.ContentHash(a.Read());s.BeginSculpt(hit,new Vector2(100,100));s.Tick();s.Cancel();int count=(int)uploads.GetValue(s,null);for(int i=0;i<30;i++){s.Tick();System.Threading.Thread.Sleep(10);}
            Require((int)uploads.GetValue(s,null)==count&&TerrainQueries.ContentHash(a.Read())==committed,"late preview cannot upload or write after cancel");Debug.Log("LE01B_CONTINUOUS_PREVIEW_GREEN");
        }
        public static void ObsoleteFaultRed()
        {
            var a=WallFixture();a.Write(TerrainGenerators.UpgradeToV2(a.Read()));LE01Adapter.Upload(a,TerrainCompiler.Build(a.Read()),true,true);SurfaceHit hit;string message;Require(LE01Adapter.TryPickSculpt(a,new Ray(new Vector3(0,-1,-8),Vector3.forward),out hit,out message),"obsolete fault fixture ray accepted");
            int count=0;Func<TerrainDocument,TerrainCommand,TerrainResult> evaluator=(d,c)=>{if(System.Threading.Interlocked.Increment(ref count)==1){System.Threading.Thread.Sleep(80);throw new InvalidOperationException("controlled obsolete task failure");}return TerrainKernel.Apply(d,c);};
            var s=new LE01Stroke(evaluator){Author=a,Mode=BrushMode.SculptDepth,Radius=.65f};Require(s.BeginSculpt(hit,new Vector2(100,100)),"old task starts");s.Tick();s.Cancel();Require(s.BeginSculpt(hit,new Vector2(100,100)),"new transaction starts while obsolete task runs");
            for(int i=0;i<30;i++){s.Tick();System.Threading.Thread.Sleep(10);}Require(s.Active&&s.PreviewUploads>0,"obsolete task failure cannot cancel newer transaction");s.Cancel();Debug.Log("LE01B_OBSOLETE_FAULT_GREEN");
        }
        public static void HoverCacheRed()
        {
            var type=typeof(LE01Adapter).Assembly.GetType("XingHai.LE01.Editor.LE01StructureSelectionCache");Require(type!=null,"hover immutable snapshot cache exists");var cache=Activator.CreateInstance(type);var get=type.GetMethod("Get");var a=WallFixture();a.Write(TerrainGenerators.UpgradeToV2(a.Read()));
            var first=(TerrainStructureSnapshot)get.Invoke(cache,new object[]{a});var again=(TerrainStructureSnapshot)get.Invoke(cache,new object[]{a});Require(ReferenceEquals(first,again),"unchanged author reuses prepared boundary");var point=new SurfaceHit(0,-1,-2,0,0,-1);Require(first.ResolveHit(point,.65f,SculptInfluence.LinkedColumn,-64,0).Valid,"cached wall selection valid");
            var changed=a.Read();changed.Cells.Clear();changed.Revision++;a.Write(changed);var next=(TerrainStructureSnapshot)get.Invoke(cache,new object[]{a});Require(!ReferenceEquals(first,next)&&!next.ResolveHit(point,.65f,SculptInfluence.LinkedColumn,-64,0).Valid,"changed JSON invalidates cached wall");Require(first.ResolveHit(point,.65f,SculptInfluence.LinkedColumn,-64,0).Valid,"prior prepared snapshot stays immutable");Debug.Log("LE01B_HOVER_CACHE_GREEN");
        }
    }
}
