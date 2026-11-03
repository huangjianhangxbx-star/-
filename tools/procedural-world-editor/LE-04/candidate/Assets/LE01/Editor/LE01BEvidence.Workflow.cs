using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public static partial class LE01BEvidence
    {
        [Serializable] class StepCheck {public string name,status,detail;}
        [Serializable] class WorkflowReport {public string engine,utc,sourceHash,input="Actual Unity ray/mesh/controller replay; not physical mouse input";public List<StepCheck> checks=new List<StepCheck>();}
        static WorkflowReport workflow;
        static void Good(string name,bool pass,string detail=""){workflow.checks.Add(new StepCheck{name=name,status=pass?"PASS":"FAIL",detail=detail});Debug.Log("LE01B_WORKFLOW "+(pass?"PASS ":"FAIL ")+name+" "+detail);if(!pass)throw new Exception("LE01B workflow failed: "+name);}
        internal static string SourceHash(){using(var hash=System.Security.Cryptography.SHA256.Create()){var files=Directory.GetFiles(Path.Combine(Application.dataPath,"LE01"),"*.cs",SearchOption.AllDirectories).OrderBy(p=>p).ToArray();return BitConverter.ToString(hash.ComputeHash(System.Text.Encoding.UTF8.GetBytes(string.Join("\n",files.Select(File.ReadAllText))))).Replace("-","");}}
        static string MeshFingerprint(LE01TerrainAuthor a){using(var hash=System.Security.Cryptography.SHA256.Create()){var text=string.Join("|",LE01Adapter.Geometry(a).GetComponentsInChildren<MeshFilter>().OrderBy(f=>f.name).Select(f=>f.name+":"+string.Join(",",f.sharedMesh.vertices.Select(v=>v.x.ToString("R",CultureInfo.InvariantCulture)+"/"+v.y.ToString("R",CultureInfo.InvariantCulture)+"/"+v.z.ToString("R",CultureInfo.InvariantCulture)))));return BitConverter.ToString(hash.ComputeHash(System.Text.Encoding.UTF8.GetBytes(text))).Replace("-","");}}
        static SurfaceHit Pick(LE01TerrainAuthor a,float x=0,float y=-4)
        {
            SurfaceHit hit;string message;Good("visible wall ray",LE01Adapter.TryPickSculpt(a,new Ray(a.transform.TransformPoint(new Vector3(x,y,-12)),a.transform.forward),out hit,out message),message);return hit;
        }
        static LE01Stroke Sculpt(LE01TerrainAuthor a,BrushMode mode,float strength,SculptInfluence scope=SculptInfluence.LinkedColumn,int min=-128,int max=0)
        {return new LE01Stroke{Author=a,Mode=mode,Radius=.65f,Quantum=a.Read().ActiveQuantum,SculptStrength=strength,SculptScope=scope,SculptMinHeight=min,SculptMaxHeight=max};}
        static void WaitPreview(LE01Stroke stroke)
        {
            int count=stroke.PreviewUploads;var watch=System.Diagnostics.Stopwatch.StartNew();while(stroke.Active&&stroke.PreviewUploads==count&&watch.ElapsedMilliseconds<5000){stroke.Tick();Thread.Sleep(3);}Good("actual mesh preview before release",stroke.Active&&stroke.PreviewUploads>count,"uploads="+stroke.PreviewUploads);
        }
        static void Shot(LE01TerrainAuthor a,Bounds bounds,string stage,TerrainDocument displayed=null){Capture(a,TerrainCompiler.Build(displayed??a.Read()),bounds,719,stage,"oblique","samples/SculptedTall_719.leterrain.json","Brush");}
        static string LockedRays(LE01TerrainAuthor author,SculptSelection selection)
        {
            var pieces=new List<string>();var colliders=LE01Adapter.Geometry(author).GetComponentsInChildren<MeshCollider>();Physics.SyncTransforms();
            foreach(var anchor in selection.Anchors){int lo=Math.Max(anchor.LowerHeight,selection.MinHeight),hi=Math.Min(anchor.UpperHeight,selection.MaxHeight);if(hi<=lo)continue;var normal=anchor.Axis==0?new Vector3(anchor.Sign,0,0):new Vector3(0,0,anchor.Sign);
                foreach(float portion in new[]{.2f,.5f,.8f}){var p=new Vector3((anchor.X+(anchor.Axis==1?.5f:0))*TerrainUnits.Unit,(lo+(hi-lo)*portion)*TerrainUnits.Unit,(anchor.Z+(anchor.Axis==0?.5f:0))*TerrainUnits.Unit);var ray=new Ray(author.transform.TransformPoint(p+normal*2),author.transform.TransformDirection(-normal));float distance=float.MaxValue;foreach(var collider in colliders){RaycastHit hit;if(collider.Raycast(ray,out hit,10))distance=Math.Min(distance,hit.distance);}pieces.Add(anchor.Key+":"+portion+":"+(distance==float.MaxValue?"MISS":distance.ToString("0.0000",CultureInfo.InvariantCulture)));}
            }return string.Join("|",pieces);
        }
        public static void Workflow()
        {
            workflow=new WorkflowReport{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O"),sourceHash=SourceHash()};manifest=new Manifest{engine=Application.unityVersion,runUtc=workflow.utc,sourceHash=workflow.sourceHash};Directory.CreateDirectory(Path.Combine(Root,"exports"));Directory.CreateDirectory(Path.Combine(Root,"samples/screenshots"));
            try{
                var doc=LE01Adapter.NativeLoad(Path.Combine(Root,"samples/Tall_719_v2.leterrain.json"));doc.Id="B_SculptedTall_719";doc.OriginX=1.25f;doc.OriginY=.5f;doc.OriginZ=-2;var a=New(doc);Light();LE01Adapter.SetGray(a,true);LE01Adapter.Upload(a,TerrainCompiler.Build(doc),true,true);var bounds=AuthorBounds(doc);Shot(a,bounds,"before");string original=TerrainQueries.ContentHash(a.Read()),meshBefore=MeshFingerprint(a);
                var hit=Pick(a);var stroke=Sculpt(a,BrushMode.SculptDepth,-.25f);Good("linked down",stroke.BeginSculpt(hit,new Vector2(100,100)));var frozen=stroke.Command.Selection.Copy();stroke.DragSculpt(new Vector2(80,100),true);WaitPreview(stroke);Good("preview author remains frozen",TerrainQueries.ContentHash(a.Read())==original);Good("preview actual geometry changed",MeshFingerprint(a)!=meshBefore);Shot(a,bounds,"linked-preview",stroke.Preview.Document);stroke.Handle(LE01InputKind.Escape,Vector3.zero,0);Good("cancel source and geometry",TerrainQueries.ContentHash(a.Read())==original&&MeshFingerprint(a)==meshBefore);Shot(a,bounds,"cancel");
                Good("linked second down",stroke.BeginSculpt(hit,new Vector2(100,100)));stroke.DragSculpt(new Vector2(80,100),true);Good("linked release commit",stroke.End());string applied=TerrainQueries.ContentHash(a.Read());Shot(a,bounds,"linked-applied");Undo.PerformUndo();stroke.UndoChanged();Good("linked single undo",TerrainQueries.ContentHash(a.Read())==original&&MeshFingerprint(a)==meshBefore);Shot(a,bounds,"undo");Undo.PerformRedo();stroke.UndoChanged();Good("linked single redo",TerrainQueries.ContentHash(a.Read())==applied);
                var local=Sculpt(a,BrushMode.SculptDepth,-.125f,SculptInfluence.HeightRange,-96,-56);Good("local height down",local.BeginSculpt(Pick(a),new Vector2(100,100)));local.DragSculpt(new Vector2(92,100),true);Good("local height commit",local.End());Shot(a,bounds,"height-range");
                var parents=TerrainCompiler.Build(a.Read()).Structures.Where(s=>string.IsNullOrEmpty(s.ParentId)).Select(s=>s.GroupId).OrderBy(s=>s).ToArray();var density=Sculpt(a,BrushMode.SculptDensity,.75f,SculptInfluence.HeightRange,-96,-56);Good("density down",density.BeginSculpt(Pick(a),new Vector2(100,100)));Good("density commit",density.End());var afterParents=TerrainCompiler.Build(a.Read()).Structures.Where(s=>string.IsNullOrEmpty(s.ParentId)).Select(s=>s.GroupId).OrderBy(s=>s).ToArray();Good("density retains parent identities",parents.SequenceEqual(afterParents));Shot(a,bounds,"density");
                var protect=Sculpt(a,BrushMode.LockShape,0);Good("shape lock down",protect.BeginSculpt(Pick(a),new Vector2(100,100)));frozen=protect.Command.Selection.Copy();Good("shape lock commit",protect.End());Good("shape lock persisted",a.Read().ShapeLocks.Count>0);string lockedBefore=LockedRays(a,frozen);Good("locked ray coverage",!lockedBefore.Contains("MISS"));
                var reseed=new LE01Stroke{Author=a,Mode=BrushMode.Reshape,Radius=1.4f,Quantum=2,Seed=1847};reseed.Begin(new Vector3(.3f,0,-2.8f),0);reseed.End();Good("reseed preview explicit",reseed.PendingConfirmation);Good("reseed commit",reseed.Apply());Good("locked real surface survives reseed",LockedRays(a,frozen)==lockedBefore);Good("manual records survive reseed",a.Read().SculptOverrides.Count==3);Shot(a,bounds,"locked-reseed");
                string beforeConflict=TerrainQueries.ContentHash(a.Read());var conflict=new LE01Stroke{Author=a,Mode=BrushMode.Raise,Radius=.5f,Quantum=2};conflict.Begin(new Vector3(0,0,-2.8f),100);conflict.Drag(Vector3.zero,68);Good("locked height conflict rejected",!conflict.End()&&TerrainQueries.ContentHash(a.Read())==beforeConflict,conflict.Status);
                var raise=new LE01Stroke{Author=a,Mode=BrushMode.Raise,Radius=.4f,Quantum=2};Good("compatible neighboring raise down",raise.Begin(new Vector3(4,0,0),100));raise.Drag(new Vector3(4,0,0),84);Good("compatible neighboring raise commit",raise.End());Good("compatible height retains locked surface",LockedRays(a,frozen)==lockedBefore);Good("compatible height retains manual intent",a.Read().SculptOverrides.Count==3&&a.Read().ShapeLocks.Count>0);Shot(a,bounds,"final");
                LE01Adapter.SetGray(a,false);LE01Adapter.NativeSave(a,Path.Combine(Root,"samples/SculptedTall_719.leterrain.json"));LE01Adapter.SaveSceneMeshes(a,"Assets/LE01B/Scenes/SculptedTall_719.unity");LE01Export.Export(LE01Adapter.Geometry(a),Path.Combine(Root,"exports/SculptedTall_719.fbx"));Good("sculpted native and FBX",File.Exists(Path.Combine(Root,"exports/SculptedTall_719.fbx")));
                string fixture=Path.Combine(Root,"notes/version-protection-test.leterrain.json");File.Copy(Path.Combine(Root,"samples/legacy/Round_719.leterrain.json"),fixture,true);string old=File.ReadAllText(fixture);bool blocked=false;try{LE01Adapter.NativeSave(a,fixture);}catch(InvalidOperationException){blocked=true;}Good("cross-generator old file protected",blocked&&File.ReadAllText(fixture)==old);
            }finally{File.WriteAllText(Path.Combine(Root,"notes/workflow-validation.json"),JsonUtility.ToJson(workflow,true));File.WriteAllText(Path.Combine(Root,"notes/workflow-image-manifest.json"),JsonUtility.ToJson(manifest,true));AssetDatabase.SaveAssets();}
            Debug.Log("LE01B_WORKFLOW_COMPLETE");
        }
        public static void ReopenWorkflow()
        {
            workflow=new WorkflowReport{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O"),sourceHash=SourceHash()};
            try{
                EditorSceneManager.OpenScene("Assets/LE01B/Scenes/SculptedTall_719.unity");var a=UnityEngine.Object.FindObjectOfType<LE01TerrainAuthor>();var d=LE01Adapter.NativeLoad(Path.Combine(Root,"samples/SculptedTall_719.leterrain.json"));Good("independent process scene-native intent match",a!=null&&TerrainQueries.ContentHash(a.Read())==TerrainQueries.ContentHash(d));Good("reopened covers locks version origin",d.GeneratorVersion=="le01.2"&&d.SculptOverrides.Count==3&&d.ShapeLocks.Count>0&&a.transform.position==new Vector3(1.25f,.5f,-2));
                var controller=new LE01Stroke{Author=a};controller.ReplaceDocument(d,"Reopen sculpt native");string intent=string.Join("|",a.Read().SculptOverrides.Select(o=>o.EditId+":"+o.Value));var raise=new LE01Stroke{Author=a,Mode=BrushMode.Raise,Radius=.35f,Quantum=2};Good("reopened neighbor raise begins",raise.Begin(new Vector3(-4,0,0),100));raise.Drag(new Vector3(-4,0,0),84);Good("reopened neighbor raise commits",raise.End());Good("reopened intent retained",intent==string.Join("|",a.Read().SculptOverrides.Select(o=>o.EditId+":"+o.Value))&&a.Read().ShapeLocks.Count>0);
                LE01Adapter.NativeSave(a,Path.Combine(Root,"samples/SculptedTall_719_reopened.leterrain.json"));Good("reopened save can reload",TerrainQueries.ContentHash(LE01Adapter.NativeLoad(Path.Combine(Root,"samples/SculptedTall_719_reopened.leterrain.json")))==TerrainQueries.ContentHash(a.Read()));
            }finally{File.WriteAllText(Path.Combine(Root,"notes/new-process-workflow.json"),JsonUtility.ToJson(workflow,true));}
            Debug.Log("LE01B_NEW_PROCESS_WORKFLOW_COMPLETE");
        }
        public static void Comparisons()
        {
            manifest=new Manifest{engine=Application.unityVersion,runUtc=DateTime.UtcNow.ToString("O"),sourceHash=SourceHash()};
            try{
                foreach(string shape in new[]{"Round","Bay","Multi"})foreach(int seed in new[]{719,1847}){
                    string source="samples/legacy/"+shape+"_"+seed+".leterrain.json";var legacy=LE01Adapter.NativeLoad(Path.Combine(Root,source));var bounds=AuthorBounds(legacy);var a=New(legacy);Light();LE01Adapter.SetGray(a,true);var old=TerrainCompiler.Build(legacy);LE01Adapter.Upload(a,old,true,true);Capture(a,old,bounds,seed,"legacy","oblique",source,shape);
                    var candidate=TerrainGenerators.UpgradeToV2(legacy);a.Write(candidate);var current=TerrainCompiler.Build(candidate);LE01Adapter.Upload(a,current,true,true);string native="samples/"+shape+"_"+seed+"_v2.leterrain.json";Capture(a,current,bounds,seed,"v2","oblique",native,shape);LE01Adapter.NativeSave(a,Path.Combine(Root,native));LE01Adapter.SetGray(a,false);LE01Adapter.SaveSceneMeshes(a,"Assets/LE01B/Scenes/"+shape+"_"+seed+".unity");
                }
            }finally{File.WriteAllText(Path.Combine(Root,"notes/comparison-manifest.json"),JsonUtility.ToJson(manifest,true));AssetDatabase.SaveAssets();}Debug.Log("LE01B_COMPARISONS_COMPLETE");
        }
    }
}
