using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public static class LE01Evidence
    {
        [Serializable] public class Check {public string name,status,detail;public long milliseconds;}
        [Serializable] public class Report {public string engine,runUtc,sourceHash,inputEvidence="SceneView-shared dispatcher and controller replay, not physical mouse or GUI pixel capture";public List<Check> checks=new List<Check>();public List<string> images=new List<string>();}
        static Report report;
        static string Root {get{return LE01Export.TaskRoot;}}
        static void CheckThat(string name,bool value,string detail="",long ms=0){report.checks.Add(new Check{name=name,status=value?"PASS":"FAIL",detail=detail,milliseconds=ms});if(!value)throw new Exception("LE01 check failed: "+name+" "+detail);UnityEngine.Debug.Log("LE01_EDITOR_PASS "+name);}
        static LE01TerrainAuthor New(string id,int seed=719,int style=0)
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var go=new GameObject("LE01_Terrain");var a=go.AddComponent<LE01TerrainAuthor>();a.Write(new TerrainDocument{Id=id,Seed=seed,Style=style,BaseHeight=-48,ActiveQuantum=4});return a;
        }
        static LE01Stroke Stroke(LE01TerrainAuthor a,BrushMode mode,float radius=1.5f,int h=0,int q=4,int seed=719)
        {return new LE01Stroke{Author=a,Mode=mode,Radius=radius,PlaneHeight=h,Quantum=q,Seed=seed,TargetQuantum=q};}
        static void Draw(LE01TerrainAuthor a,BrushMode mode,float radius,int height,int q,params Vector3[] path)
        {
            var s=Stroke(a,mode,radius,height,q,a.Read().Seed);s.Begin(path[0],0);for(int i=1;i<path.Length;i++)s.Drag(path[i],0);s.End();if(s.PendingConfirmation)s.Apply();
        }
        public static void EarlyShape()
        {
            report=new Report{engine=Application.unityVersion};Directory.CreateDirectory(Path.Combine(Root,"samples/screenshots"));
            var a=New("first-round",719);Draw(a,BrushMode.Extend,3,0,4,Vector3.zero);LE01Adapter.SetGray(a,true);Stage();
            Capture(a,"first-round-gray-perspective.png",false,false);Capture(a,"first-round-gray-side.png",false,true);
            File.WriteAllText(Path.Combine(Root,"notes/first-shape-report.json"),JsonUtility.ToJson(report,true));
        }
        [MenuItem("星骸/LE-01/验证/生成示例与证据")]
        public static void Run()
        {
            if(!Application.isBatchMode){if(LE01Window.Instance!=null)LE01Window.Instance.Controller.Cancel();if(!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return;}
            report=new Report{engine=Application.unityVersion,runUtc=DateTime.UtcNow.ToString("O"),sourceHash=SourceHash()};Directory.CreateDirectory(Path.Combine(Root,"samples/screenshots"));Directory.CreateDirectory(Path.Combine(Root,"exports"));
            try{Transactions();Samples();LocalSeed();Performance();report.checks.Add(new Check{name="physical-held-Esc",status="NOT_RUN",detail="用户偏好后台，不主动占用桌面；回放不是物理鼠标。"});report.checks.Add(new Check{name="editor-tool-window-pixel-capture",status="NOT_CAPTURED",detail="后台batchmode没有桌面GUI像素截图；交付真实Unity Camera/RenderTexture图，不合成工具界面。"});}
            finally{File.WriteAllText(Path.Combine(Root,"notes/editor-validation.json"),JsonUtility.ToJson(report,true));AssetDatabase.SaveAssets();}
            UnityEngine.Debug.Log("LE01_EDITOR_VALIDATION_COMPLETE");
        }
        static void Transactions()
        {
            var a=New("event-tests");var s=Stroke(a,BrushMode.Extend,1.25f);
            Vector3 point;CheckThat("blank-independent-plane",s.IntersectLockedPlane(new Ray(new Vector3(0,10,0),Vector3.down),out point)&&Mathf.Abs(point.y)<1e-5f);
            string empty=TerrainQueries.ContentHash(a.Read());CheckThat("begin-empty-brush",s.Begin(Vector3.zero,100));s.Drag(new Vector3(3,99,0),100);CheckThat("preview-does-not-write-source",TerrainQueries.ContentHash(a.Read())==empty);
            bool blocked=false;try{LE01Adapter.NativeSave(a,Path.Combine(Root,"samples/forbidden.json"));}catch(InvalidOperationException){blocked=true;}CheckThat("active-save-blocked",blocked);
            CheckThat("release-commits",s.End());CheckThat("commit-revision-increment",a.Read().Revision==1);string painted=TerrainQueries.ContentHash(a.Read());CheckThat("fast-stroke-connected",TerrainQueries.HeightUnits(a.Read(),1.5f,0).HasValue);
            Undo.PerformUndo();s.UndoChanged();CheckThat("single-release-single-undo",TerrainQueries.ContentHash(a.Read())==empty);Undo.PerformRedo();s.UndoChanged();CheckThat("single-redo",TerrainQueries.ContentHash(a.Read())==painted);
            s.Begin(new Vector3(6,0,0),0);s.Drag(new Vector3(7,0,0),0);s.Cancel();CheckThat("cancel-keeps-author",TerrainQueries.ContentHash(a.Read())==painted);
            foreach(var kind in new[]{LE01InputKind.Escape,LE01InputKind.FocusLost,LE01InputKind.ToolChanged,LE01InputKind.SceneClosed}){
                s.Handle(LE01InputKind.Down,new Vector3(6,0,0),0);s.Handle(LE01InputKind.Drag,new Vector3(7,0,0),0);s.Handle(kind,Vector3.zero,0);CheckThat("input-"+kind+"-cancels",!s.Active&&TerrainQueries.ContentHash(a.Read())==painted);
            }
            CheckThat("navigation-down-ignored",!s.Handle(LE01InputKind.Down,Vector3.zero,0,true,false)&&!s.Active);CheckThat("text-down-ignored",!s.Handle(LE01InputKind.Down,Vector3.zero,0,false,true)&&!s.Active);
            s.Begin(new Vector3(8,0,0),0);s.Tick();s.Cancel();for(int i=0;i<200;i++){s.Tick();Thread.Sleep(2);}CheckThat("obsolete-preview-discarded",s.StaleResults>0,"stale="+s.StaleResults);
            s.Mode=BrushMode.Raise;s.Begin(Vector3.zero,100);s.Drag(new Vector3(20,100,20),68);CheckThat("height-selection-fixed",s.Command.Path.Count==1&&s.Command.TargetHeight==16);s.End();CheckThat("raise-original-selection",TerrainQueries.HeightUnits(a.Read(),0,0)==16&&TerrainQueries.HeightUnits(a.Read(),3,0)==0);
            var d=a.Read();CheckThat("height-plane-preserved",d.Planes.Any(p=>p.Height==0)&&d.Planes.Any(p=>p.Height==16));
            s.Mode=BrushMode.Lower;s.Begin(Vector3.zero,100);s.Drag(Vector3.zero,-10000);s.End();CheckThat("lower-bottom-limit",TerrainQueries.HeightUnits(a.Read(),0,0)>a.Read().BaseHeight);
            var frozen=a.Read();s.Mode=BrushMode.Raise;s.Quantum=2;s.Begin(new Vector3(3,0,0),100);s.Mode=BrushMode.Erase;s.Quantum=4;s.Drag(new Vector3(20,30,20),68);CheckThat("active-context-frozen",s.Command.Mode==BrushMode.Raise&&s.Command.Quantum==2&&s.Command.TargetHeight==8);s.Cancel();
            s.Mode=BrushMode.Extend;s.Begin(new Vector3(8,0,0),0);Vector3 invalid;CheckThat("parallel-ray-rejected",!s.IntersectLockedPlane(new Ray(Vector3.up,Vector3.right),out invalid));s.Handle(LE01InputKind.Up,new Vector3(8,0,0),0);CheckThat("release-after-invalid-ray",!s.Active);
            s.Begin(Vector3.zero,0);var replaced=a.Read();replaced.Id="external-replacement";a.Write(replaced);CheckThat("external-document-replacement-cancels",!s.End()&&!s.Active&&a.Read().Id=="external-replacement");
            string native=Path.Combine(Root,"samples/roundtrip-test.leterrain.json");LE01Adapter.NativeSave(a,native);string hash=TerrainQueries.ContentHash(a.Read());var reopened=LE01Adapter.NativeLoad(native);CheckThat("native-roundtrip-author",TerrainQueries.ContentHash(reopened)==hash);
            a.Write(reopened);s.Mode=BrushMode.Extend;s.PlaneHeight=24;s.Begin(new Vector3(6,1.5f,0),0);s.End();CheckThat("native-continue-editing",TerrainQueries.HeightUnits(a.Read(),6,0)==24);
            s.Mode=BrushMode.Reshape;s.Seed=1847;s.Begin(new Vector3(0,0,0),0);s.End();CheckThat("reshape-explicit-preview",s.Active&&s.PendingConfirmation);string before=TerrainQueries.ContentHash(a.Read());s.Cancel();CheckThat("reshape-cancel-seed-stable",TerrainQueries.ContentHash(a.Read())==before);
            s.Begin(Vector3.zero,0);bool exportBlocked=false;try{LE01Export.Export(LE01Adapter.Geometry(a),Path.Combine(Root,"exports/forbidden.fbx"));}catch(InvalidOperationException){exportBlocked=true;}s.Cancel();CheckThat("active-export-blocked",exportBlocked);
            var replace=a.Read();replace.Id="native-open-transaction";string oldId=a.Read().Id;s.ReplaceDocument(replace,"Open native test");Undo.PerformUndo();s.UndoChanged();CheckThat("native-open-one-undo",a.Read().Id==oldId);Undo.PerformRedo();s.UndoChanged();CheckThat("native-open-one-redo",a.Read().Id==replace.Id);
            var invalidNative=a.Read();invalidNative.Cells[0].Top=invalidNative.BaseHeight;File.WriteAllText(Path.Combine(Root,"samples/rejected-native-test.json"),JsonUtility.ToJson(invalidNative));bool rejected=false;try{LE01Adapter.NativeLoad(Path.Combine(Root,"samples/rejected-native-test.json"));}catch(InvalidDataException){rejected=true;}CheckThat("native-invalid-rejected",rejected);
        }
        static void Samples()
        {
            foreach(string shape in new[]{"Round","Bay","Multi"})foreach(int seed in new[]{719,1847}){
                string id=shape+"_"+seed;var a=New(id,seed,shape=="Multi"?1:0);
                if(shape=="Round")Draw(a,BrushMode.Extend,3.1f,0,4,Vector3.zero);
                if(shape=="Bay"){
                    Draw(a,BrushMode.Extend,2.3f,0,4,new Vector3(-2,0,0),new Vector3(-2,0,2),new Vector3(0,0,3),new Vector3(2.2f,0,2.4f),new Vector3(2.7f,0,0));
                    Draw(a,BrushMode.Erase,1.55f,0,2,new Vector3(.1f,0,-1.7f),new Vector3(.1f,0,.8f));
                    Draw(a,BrushMode.Extend,.3f,0,1,new Vector3(-2,0,-1.8f),new Vector3(2,0,-1.8f));
                }
                if(shape=="Multi"){
                    Draw(a,BrushMode.Extend,3.6f,0,4,new Vector3(-1,0,0),new Vector3(1.5f,0,0));
                    var s=Stroke(a,BrushMode.Raise,2.15f,0,2,seed);s.Begin(new Vector3(-1.5f,0,.25f),100);s.Drag(Vector3.zero,36);s.End();
                    s=Stroke(a,BrushMode.Raise,1.1f,0,1,seed);s.Begin(new Vector3(-2,1,.5f),100);s.Drag(Vector3.zero,20);s.End();
                }
                Stage();LE01Adapter.NativeSave(a,Path.Combine(Root,"samples/"+id+".leterrain.json"));
                LE01Adapter.SetGray(a,true);Capture(a,id+"-gray-perspective.png",false,false);Capture(a,id+"-gray-top.png",true,false);Capture(a,id+"-gray-side.png",false,true);
                LE01Adapter.SetGray(a,false);Capture(a,id+"-color-perspective.png",false,false);
                LE01Export.Export(LE01Adapter.Geometry(a),Path.Combine(Root,"exports/"+id+".fbx"));
                LE01Adapter.SaveSceneMeshes(a,"Assets/LE01/Scenes/"+id+".unity");
                CheckThat("sample-"+id,a.Read().Cells.Count>0,"author="+a.Read().Cells.Count+" triangles="+LE01Adapter.Geometry(a).GetComponentsInChildren<MeshFilter>().Sum(f=>f.sharedMesh.triangles.Length/3));
            }
            var settings=new[]{new EditorBuildSettingsScene("Assets/LE01/Scenes/Round_719.unity",true)};EditorBuildSettings.scenes=settings;
            EditorSceneManager.OpenScene("Assets/LE01/Scenes/Round_719.unity");
        }
        static void Stage()
        {
            RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.24f,.27f,.30f);RenderSettings.skybox=null;
            var l=new GameObject("PreviewKey").AddComponent<Light>();l.type=LightType.Directional;l.intensity=1.05f;l.transform.rotation=Quaternion.Euler(38,-55,0);l.shadows=LightShadows.Soft;l.shadowBias=.03f;l.shadowNormalBias=.05f;
        }
        static void LocalSeed()
        {
            var d=LE01Adapter.NativeLoad(Path.Combine(Root,"samples/Round_719.leterrain.json"));d.Id="Round_719-local-seed";
            var a=New(d.Id);a.Write(d);LE01Adapter.Upload(a,TerrainCompiler.Build(d),true,true);LE01Adapter.SetGray(a,true);Stage();
            var before=TerrainCompiler.Build(d);var remote=LE01Adapter.Geometry(a).GetComponentsInChildren<MeshFilter>().Where(f=>f.name!="chunk_0_-1").ToDictionary(f=>f.name,f=>f.sharedMesh.GetInstanceID());
            Capture(a,"LocalSeed-before-gray-perspective.png",false,false);
            var s=Stroke(a,BrushMode.Reshape,.9f,0,d.ActiveQuantum,1847);s.Handle(LE01InputKind.Down,new Vector3(2,0,-2),0);s.Handle(LE01InputKind.Up,new Vector3(2,0,-2),0);CheckThat("local-seed-preview-explicit",s.PendingConfirmation);
            Capture(a,"LocalSeed-preview-gray-perspective.png",false,false);s.Handle(LE01InputKind.Escape,Vector3.zero,0);CheckThat("local-seed-preview-cancel",TerrainQueries.ContentHash(a.Read())==TerrainQueries.ContentHash(d));Capture(a,"LocalSeed-cancel-gray-perspective.png",false,false);
            s.Handle(LE01InputKind.Down,new Vector3(2,0,-2),0);s.Handle(LE01InputKind.Up,new Vector3(2,0,-2),0);CheckThat("local-seed-apply",s.Apply());
            var after=TerrainCompiler.Build(a.Read());int unchanged=before.Chunks.Count(c=>c.Id!="chunk_0_-1"&&after.Chunks.Any(n=>n.Id==c.Id&&JsonUtility.ToJson(c)==JsonUtility.ToJson(n)));
            CheckThat("local-seed-far-chunks-stable",unchanged==3,"unchanged far chunks="+unchanged);
            CheckThat("local-commit-keeps-far-mesh-objects",remote.All(pair=>LE01Adapter.Geometry(a).transform.Find(pair.Key).GetComponent<MeshFilter>().sharedMesh.GetInstanceID()==pair.Value));
            CheckThat("local-seed-author-mask-height-stable",string.Join("|",d.Cells.Select(JsonUtility.ToJson))==string.Join("|",a.Read().Cells.Select(JsonUtility.ToJson)));
            Capture(a,"LocalSeed-applied-gray-perspective.png",false,false);LE01Adapter.NativeSave(a,Path.Combine(Root,"samples/Round_719-local-seed.leterrain.json"));LE01Adapter.SetGray(a,false);LE01Export.Export(LE01Adapter.Geometry(a),Path.Combine(Root,"exports/LocalSeed_Round_719to1847.fbx"));LE01Adapter.SaveSceneMeshes(a,"Assets/LE01/Scenes/LocalSeed.unity");
        }
        static void Capture(LE01TerrainAuthor a,string file,bool top,bool side)
        {
            var lights=UnityEngine.Object.FindObjectsOfType<Light>();var shadowStates=lights.Select(l=>l.shadows).ToArray();if(top)foreach(var light in lights)light.shadows=LightShadows.None;
            var b=LE01Adapter.Bounds(a);var camera=new GameObject("EvidenceCamera").AddComponent<Camera>();camera.orthographic=true;camera.backgroundColor=new Color(.105f,.13f,.16f);camera.clearFlags=CameraClearFlags.SolidColor;
            camera.transform.rotation=Quaternion.Euler(top?90:side?0:32,top?0:side?0:-37,0);float span=Mathf.Max(b.size.x,b.size.z);camera.orthographicSize=top?span*.66f:side?Mathf.Max(b.size.y*.75f,span*.42f):span*.61f;
            camera.transform.position=b.center-camera.transform.forward*(span+20);camera.nearClipPlane=.1f;camera.farClipPlane=300;
            var rt=new RenderTexture(1280,960,24,RenderTextureFormat.ARGB32);camera.targetTexture=rt;camera.Render();var old=RenderTexture.active;RenderTexture.active=rt;var texture=new Texture2D(rt.width,rt.height,TextureFormat.RGB24,false);texture.ReadPixels(new Rect(0,0,rt.width,rt.height),0,0);texture.Apply();
            string path=Path.Combine(Root,"samples/screenshots/"+file);File.WriteAllBytes(path,texture.EncodeToPNG());report.images.Add("samples/screenshots/"+file);RenderTexture.active=old;UnityEngine.Object.DestroyImmediate(texture);UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(camera.gameObject);
            for(int i=0;i<lights.Length;i++)lights[i].shadows=shadowStates[i];
        }
        public static void ReopenProbe()
        {
            report=new Report{engine=Application.unityVersion,runUtc=DateTime.UtcNow.ToString("O"),sourceHash=SourceHash()};
            try{
                EditorSceneManager.OpenScene("Assets/LE01/Scenes/Round_719.unity");var a=UnityEngine.Object.FindObjectOfType<LE01TerrainAuthor>();CheckThat("separate-process-scene-reopen",a!=null);
                var native=LE01Adapter.NativeLoad(Path.Combine(Root,"samples/Round_719.leterrain.json"));CheckThat("scene-native-source-match",TerrainQueries.ContentHash(a.Read())==TerrainQueries.ContentHash(native));
                native.Id="Round_719-reopened";var s=Stroke(a,BrushMode.Extend,.5f,native.ActivePlaneHeight,native.ActiveQuantum,native.Seed);s.ReplaceDocument(native,"Reopen native");string original=TerrainQueries.ContentHash(a.Read());s.Handle(LE01InputKind.Down,new Vector3(3.05f,0,0),0);s.Handle(LE01InputKind.Drag,new Vector3(3.7f,0,0),0);s.Handle(LE01InputKind.Up,new Vector3(3.7f,0,0),0);CheckThat("reopened-continue-real-command",!s.Active&&TerrainQueries.ContentHash(a.Read())!=original&&TerrainQueries.HeightUnits(a.Read(),3.7f,0).HasValue);
                LE01Adapter.NativeSave(a,Path.Combine(Root,"samples/Round_719-reopened.leterrain.json"));LE01Adapter.SaveSceneMeshes(a,"Assets/LE01/Scenes/ReopenProbe.unity");CheckThat("reopened-save",File.Exists(Path.Combine(Root,"samples/Round_719-reopened.leterrain.json")));
                EditorSceneManager.OpenScene("Assets/LE01/Scenes/ReopenProbe.unity");a=UnityEngine.Object.FindObjectOfType<LE01TerrainAuthor>();CheckThat("continued-scene-reopen",a!=null&&TerrainQueries.HeightUnits(a.Read(),3.7f,0).HasValue);
                EditorSceneManager.OpenScene("Assets/LE01/Scenes/Round_719.unity");
            }finally{File.WriteAllText(Path.Combine(Root,"notes/new-process-reopen.json"),JsonUtility.ToJson(report,true));AssetDatabase.SaveAssets();}
            UnityEngine.Debug.Log("LE01_NEW_PROCESS_REOPEN_PASS");
        }
        public static void OriginTransformProbe()
        {
            report=new Report{engine=Application.unityVersion,runUtc=DateTime.UtcNow.ToString("O"),sourceHash=SourceHash()};
            try{
                var a=New("origin-transform-test");Draw(a,BrushMode.Extend,.75f,0,4,Vector3.zero);var origin=new Vector3(8.25f,2f,-6.5f);a.transform.position=origin;
                string path=Path.Combine(Root,"samples/origin-transform-test.leterrain.json");LE01Adapter.NativeSave(a,path);var saved=LE01Adapter.NativeLoad(path);CheckThat("nonzero-origin-saved",new Vector3(saved.OriginX,saved.OriginY,saved.OriginZ)==origin);
                var s=Stroke(a,BrushMode.Extend);a.transform.position=Vector3.zero;s.ReplaceDocument(saved,"Restore origin");CheckThat("nonzero-origin-reopened",a.transform.position==origin);
                LE01Export.Export(LE01Adapter.Geometry(a),Path.Combine(Root,"exports/origin-transform-test.fbx"));CheckThat("translated-root-local-fbx",File.Exists(Path.Combine(Root,"exports/origin-transform-test.fbx")),"FBX root is normalized to local origin; native metadata retains world Origin.");
                a.transform.rotation=Quaternion.Euler(0,12,0);bool nativeBlocked=false,fbxBlocked=false;try{LE01Adapter.NativeSave(a,path);}catch(InvalidOperationException){nativeBlocked=true;}try{LE01Export.Export(LE01Adapter.Geometry(a),Path.Combine(Root,"exports/rotated-forbidden.fbx"));}catch(InvalidOperationException){fbxBlocked=true;}CheckThat("rotated-root-rejected",nativeBlocked&&fbxBlocked);
                a.transform.rotation=Quaternion.identity;a.transform.localScale=new Vector3(1,2,1);nativeBlocked=false;fbxBlocked=false;try{LE01Adapter.NativeSave(a,path);}catch(InvalidOperationException){nativeBlocked=true;}try{LE01Export.Export(LE01Adapter.Geometry(a),Path.Combine(Root,"exports/scaled-forbidden.fbx"));}catch(InvalidOperationException){fbxBlocked=true;}CheckThat("scaled-root-rejected",nativeBlocked&&fbxBlocked);a.transform.localScale=Vector3.one;
                EditorSceneManager.OpenScene("Assets/LE01/Scenes/Round_719.unity");
            }finally{File.WriteAllText(Path.Combine(Root,"notes/origin-transform-probe.json"),JsonUtility.ToJson(report,true));AssetDatabase.SaveAssets();}
            UnityEngine.Debug.Log("LE01_ORIGIN_TRANSFORM_PASS");
        }
        [Serializable] class Cost {public string scale,metric;public int count;public double p50,p95;}
        [Serializable] class Scale {public string id;public float quantum,width,depth;public int author,derived,chunks,triangles,objects;}
        [Serializable] class Costs {public string note="Wall-clock milliseconds, not physical-pointer/UI latency. Local finalize reuses dirty geometry; Undo/document replacement deliberately rebuilds the document.";public string runUtc,sourceHash;public List<Scale> scales=new List<Scale>();public List<Cost> costs=new List<Cost>();}
        static double Percentile(List<double> a,double p){a.Sort();return Math.Round(a[Math.Min(a.Count-1,(int)Math.Ceiling(a.Count*p)-1)],3);}
        static void Performance()
        {
            var costs=new Costs{runUtc=DateTime.UtcNow.ToString("O"),sourceHash=SourceHash()};for(int test=0;test<3;test++){
                int radius=new[]{6,12,3}[test],quantum=new[]{4,2,1}[test];string scale=new[]{"12m-coarse","24m-medium","6m-fine"}[test];
                var a=New("perf-"+scale);Draw(a,BrushMode.Extend,radius,0,quantum,Vector3.zero);var d=a.Read();var full=TerrainCompiler.Build(d);var bounds=LE01Adapter.Bounds(a);
                costs.scales.Add(new Scale{id=scale,quantum=quantum*TerrainUnits.Unit,width=bounds.size.x,depth=bounds.size.z,author=d.Cells.Count,derived=full.DerivedCells,chunks=full.Chunks.Count,triangles=full.Chunks.Sum(c=>c.Triangles.Length/3),objects=LE01Adapter.Geometry(a).transform.childCount});
                var compiler=new List<double>();var upload=new List<double>();var kernel=new List<double>();var save=new List<double>();var commit=new List<double>();var collider=new List<double>();
                for(int i=0;i<10;i++){
                    var c=new TerrainCommand{Mode=BrushMode.Reshape,Radius=.65f,Quantum=quantum,Seed=900+i,Path=new List<Point2>{new Point2(radius-.2f,0)}};var w=Stopwatch.StartNew();var r=TerrainKernel.Apply(d,c);w.Stop();kernel.Add(w.Elapsed.TotalMilliseconds);w.Restart();var build=TerrainCompiler.Build(r.Document,r.DirtyBounds);w.Stop();compiler.Add(w.Elapsed.TotalMilliseconds);w.Restart();LE01Adapter.Upload(a,build,false);w.Stop();upload.Add(w.Elapsed.TotalMilliseconds);w.Restart();LE01Adapter.Upload(a,build,true);w.Stop();collider.Add(w.Elapsed.TotalMilliseconds);
                    a.Write(d.Copy());var s=Stroke(a,BrushMode.Reshape,.65f,0,quantum,900+i);s.Begin(new Vector3(radius-.2f,0,0),0);s.End();w.Restart();s.Apply();w.Stop();commit.Add(w.Elapsed.TotalMilliseconds);
                    w.Restart();LE01Adapter.NativeSave(a,Path.Combine(Root,"samples/perf-native.json"));w.Stop();save.Add(w.Elapsed.TotalMilliseconds);
                }
                foreach(var pair in new[]{new {n="kernel-local",v=kernel},new {n="compiler-dirty",v=compiler},new {n="unity-upload-no-collider",v=upload},new {n="unity-upload-with-collider",v=collider},new {n="final-commit-reuse-dirty-with-undo-collider",v=commit},new {n="native-save",v=save}})costs.costs.Add(new Cost{scale=scale,metric=pair.n,count=pair.v.Count,p50=Percentile(pair.v,.5),p95=Percentile(pair.v,.95)});
                a.Write(d);LE01Adapter.Upload(a,full,true,true);
                var exports=new List<double>();for(int i=0;i<3;i++){var w=Stopwatch.StartNew();LE01Export.Export(LE01Adapter.Geometry(a),Path.Combine(Root,"exports/perf-"+scale+".fbx"));w.Stop();exports.Add(w.Elapsed.TotalMilliseconds);}costs.costs.Add(new Cost{scale=scale,metric="official-fbx-export",count=3,p50=Percentile(exports,.5),p95=Percentile(exports,.95)});
            }File.WriteAllText(Path.Combine(Root,"notes/performance.json"),JsonUtility.ToJson(costs,true));EditorSceneManager.OpenScene("Assets/LE01/Scenes/Round_719.unity");
        }
        static string SourceHash(){using(var hash=System.Security.Cryptography.SHA256.Create()){var files=Directory.GetFiles(Path.Combine(Application.dataPath,"LE01"),"*.cs",SearchOption.AllDirectories).OrderBy(x=>x).ToArray();var bytes=System.Text.Encoding.UTF8.GetBytes(string.Join("\n",files.Select(File.ReadAllText)));return BitConverter.ToString(hash.ComputeHash(bytes)).Replace("-","");}}
    }
}
