using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    [Serializable] public sealed class LE04BrushSettings
    {
        public string Tool="shape",Mode="SmoothRaise";public bool AnchorMode,VisibleOnly=true,UseColor=true,OverwriteManual;public int Quantum=4,FaceMask=63,ReferenceIndex,Seed=719;
        public float Radius=1.5f,NegativeX=1.5f,PositiveX=1.5f,NegativeZ=1.5f,PositiveZ=1.5f,YBelow=1.5f,YAbove=1.5f,Amount=.25f,Falloff=.5f,ScaleX=1,ScaleY=1,ScaleZ=1,Yaw,BlendWidth=.125f,WorkPlane;
        public ReferenceBrushMode ReferenceMode;public Color Paint=new Color(.55f,.66f,.62f,1);
        public LE04BrushSettings Copy(){return (LE04BrushSettings)MemberwiseClone();}
    }
    [InitializeOnLoad] public sealed class LE04TerrainSession
    {
        static readonly Dictionary<int,LE04TerrainSession> sessions=new Dictionary<int,LE04TerrainSession>();
        static LE04TerrainSession(){EditorSceneManager.sceneClosing+=ReleaseScene;AssemblyReloadEvents.beforeAssemblyReload+=ReleaseAll;}
        static void ReleaseScene(UnityEngine.SceneManagement.Scene scene,bool removing){foreach(var pair in sessions.Where(p=>p.Value.sceneHandle==scene.handle).ToArray()){pair.Value.Cancel();sessions.Remove(pair.Key);}}
        static void ReleaseAll(){foreach(var session in sessions.Values.ToArray())session.Cancel();sessions.Clear();}
        public static bool Has(LE01TerrainAuthor author){return author!=null&&author.GetComponent<LE04TerrainState>()!=null;}
        public static bool IsBusy(LE01TerrainAuthor author){LE04TerrainSession s;return author!=null&&sessions.TryGetValue(author.GetInstanceID(),out s)&&s.Busy;}
        public static LE04TerrainSession Get(LE01TerrainAuthor author)
        {
            if(!Has(author))return null;LE04TerrainSession session;int id=author.GetInstanceID();
            if(!sessions.TryGetValue(id,out session)){session=new LE04TerrainSession(author);sessions[id]=session;}else if(!session.Ready&&!session.Busy)session.Rebuild(false);return session;
        }
        public static void Forget(LE01TerrainAuthor author){if(author==null)return;LE04TerrainSession session;if(sessions.TryGetValue(author.GetInstanceID(),out session)){session.Cancel();session.generation++;sessions.Remove(author.GetInstanceID());}}
        public readonly LE01TerrainAuthor Author;
        public LE04BrushSettings Settings;
        public TerrainEditSnapshot Current {get;private set;}
        public TerrainSurfaceBuild Build {get;private set;}
        public TerrainEditResult Preview {get;private set;}
        public bool Active {get;private set;}public bool Anchor {get;private set;}public bool Released {get;private set;}
        public bool Busy {get{return Active||job!=null||previewRequested;}}
        public bool Ready {get{return Current!=null&&Build!=null;}}
        public Vector3 AnchorPoint {get;private set;}public Vector3 AnchorNormal {get;private set;}
        public string Status="正在后台准备基础地貌…";
        public int StaleResults,PreviewUploads;public double LastInputMilliseconds,LastTickMilliseconds,LastWorkerMilliseconds;
        public IReadOnlyList<Vector3> Path {get{return path;}}
        readonly LE04TerrainState component;
        readonly List<Vector3> path=new List<Vector3>();readonly List<SurfaceHit> hits=new List<SurfaceHit>();
        TerrainEditSnapshot frozen;TerrainSurfaceBuild committedBuild;TerrainEditCache committedCache;
        string frozenJson,frozenBasis;int generation,sequence,appliedSequence,sceneHandle;
        Task<Job> job;bool previewRequested,initial,history;double lastLaunch;
        readonly Dictionary<string,CompiledReferenceField> referenceFields=new Dictionary<string,CompiledReferenceField>();
        sealed class Job {public int Generation,Sequence;public string Json,Basis;public TerrainEditResult Result;public TerrainSurfaceBuild Build;public Exception Error;public double Milliseconds;public Dictionary<string,CompiledReferenceField> Fields;}
        LE04TerrainSession(LE01TerrainAuthor author)
        {
            Author=author;component=author.GetComponent<LE04TerrainState>();Settings=string.IsNullOrEmpty(component.BrushJson)?new LE04BrushSettings():JsonUtility.FromJson<LE04BrushSettings>(component.BrushJson);
            sceneHandle=author.gameObject.scene.handle;Rebuild(false);
        }
        public void Rebuild(bool undo)
        {
            Cancel();generation++;history=undo;initial=true;frozenJson=component.EditJson;frozenBasis=Author.DocumentJson;
            if(!string.IsNullOrEmpty(component.BrushJson))Settings=JsonUtility.FromJson<LE04BrushSettings>(component.BrushJson);
            var basis=Author.Read();var state=component.Read();var previousCache=Build==null?null:Build.Cache;var previous=Current;int version=generation;string json=frozenJson,baseJson=frozenBasis;
            job=Task.Run(()=>{var timer=System.Diagnostics.Stopwatch.StartNew();try{var source=TerrainEffectiveSource.Capture(basis,state,previousCache);var dirty=HistoryDirty(previous,source);var build=TerrainSurfaceMesher.Build(source,previousCache,dirty);var fields=new Dictionary<string,CompiledReferenceField>();foreach(var record in state.References){var compiled=TerrainReferenceField.Compile(record.Asset,new ReferenceCompileSettings());if(compiled.Rejected)throw new ArgumentException(compiled.Reason);fields[record.Id+"#"+record.SourceHash]=compiled.Field;}return new Job{Generation=version,Json=json,Basis=baseJson,Result=new TerrainEditResult{Snapshot=source},Build=build,Fields=fields,Milliseconds=timer.Elapsed.TotalMilliseconds};}catch(Exception error){return new Job{Generation=version,Json=json,Basis=baseJson,Error=error};}});
            Status=undo?"正在后台恢复历史…":"正在后台准备基础地貌…";
        }
        public bool BeginAnchor(Vector3 point,Vector3 normal){return Begin(point,normal,true);}
        public bool BeginStroke(Vector3 point,Vector3 normal){return Begin(point,normal,false);}
        bool Begin(Vector3 point,Vector3 normal,bool anchor)
        {
            if(!Ready||Busy||LE03Modules.Busy(Author))return false;
            if((Tools.current!=Tool.None&&Tools.current!=Tool.View)&&EditorGUIUtility.editingTextField)return false;
            frozen=Current;committedBuild=Build;committedCache=Build.Cache;frozenJson=component.EditJson;frozenBasis=Author.DocumentJson;generation++;sequence=appliedSequence=0;
            AnchorPoint=point;AnchorNormal=normal;path.Clear();hits.Clear();AddHit(point,normal);Active=true;Anchor=anchor;Released=false;Preview=null;
            LE01Adapter.CaptureCommitted(Author);Status=anchor?"锚点已固定；调整范围后预览，应用为一条撤销记录。":"绘制中；松手提交，Esc取消。";RequestPreview();return true;
        }
        void AddHit(Vector3 point,Vector3 normal)
        {
            if(path.Count==0||(path[path.Count-1]-point).sqrMagnitude>.000001f){path.Add(point);hits.Add(new SurfaceHit{X=point.x,Y=point.y,Z=point.z,NormalX=normal.x,NormalY=normal.y,NormalZ=normal.z});}
        }
        public void Drag(Vector3 point,Vector3 normal)
        {
            if(!Active||Anchor||Released)return;var timer=System.Diagnostics.Stopwatch.StartNew();
            // Reference is sampled against the frozen horizontal plane, never its own new top.
            if(Settings.Tool=="reference")point.y=AnchorPoint.y;AddHit(point,normal);RequestPreview();LastInputMilliseconds=timer.Elapsed.TotalMilliseconds;
        }
        public Bounds2 EditBounds()
        {
            return new Bounds2(TerrainUnits.ToUnits(AnchorPoint.x-Settings.NegativeX),TerrainUnits.ToUnits(AnchorPoint.z-Settings.NegativeZ),TerrainUnits.ToUnits(AnchorPoint.x+Settings.PositiveX),TerrainUnits.ToUnits(AnchorPoint.z+Settings.PositiveZ));
        }
        public void RequestPreview()
        {
            if(!Active)return;sequence++;previewRequested=true;
        }
        Func<TerrainEditSnapshot,TerrainEditResult> PrepareOperation()
        {
            var setting=Settings.Copy();var points=path.Select(p=>new TerrainPoint3(p.x,p.y,p.z)).ToList();var visible=hits.ToList();int revision=frozen.State.Revision;
            if(setting.Tool=="paint")
            {
                var color=setting.Paint;var command=new TerrainPaintCommand{UseRegion=Anchor,Region=EditBounds(),Hits=visible,Radius=setting.Radius,YMin=TerrainUnits.ToUnits(AnchorPoint.y-setting.YBelow),YMax=TerrainUnits.ToUnits(AnchorPoint.y+setting.YAbove),FaceMask=setting.FaceMask,Rgba=new[]{color.r,color.g,color.b,1f},VisibleOnly=setting.VisibleOnly};
                return s=>TerrainPaintEdits.Apply(s,command);
            }
            else if(setting.Tool=="reference")
            {
                if(frozen.State.References.Count==0)return s=>new TerrainEditResult{Snapshot=s,Rejected=true,Reason="请先导入一个参考源。"};int index=Mathf.Clamp(setting.ReferenceIndex,0,frozen.State.References.Count-1);
                CompiledReferenceField field;if(!referenceFields.TryGetValue(frozen.State.References[index].Id+"#"+frozen.State.References[index].SourceHash,out field))return s=>new TerrainEditResult{Snapshot=s,Rejected=true,Reason="参考未完成认证，请重新导入。"};
                var command=new ReferenceBrushCommand{Mode=setting.ReferenceMode,Path=points,Quantum=setting.Quantum,ScaleX=setting.ScaleX,ScaleY=setting.ScaleY,ScaleZ=setting.ScaleZ,YawDegrees=setting.Yaw,UseColor=setting.UseColor,OverwriteManual=setting.OverwriteManual,BlendWidth=setting.BlendWidth,Seed=setting.Seed,ExpectedRevision=revision};
                return s=>TerrainReferenceEdits.Apply(s,command,field);
            }
            else
            {
                TerrainEditMode mode;if(!Enum.TryParse(setting.Mode,out mode))mode=TerrainEditMode.SmoothRaise;
                var command=new TerrainEditCommand{Mode=mode,Path=points,Anchor=new TerrainPoint3(AnchorPoint.x,AnchorPoint.y,AnchorPoint.z),Normal=new TerrainPoint3(AnchorNormal.x,AnchorNormal.y,AnchorNormal.z),Radius=setting.Radius,YMin=TerrainUnits.ToUnits(AnchorPoint.y-setting.YBelow),YMax=TerrainUnits.ToUnits(AnchorPoint.y+setting.YAbove),Amount=TerrainUnits.ToUnits(setting.Amount),Quantum=setting.Quantum,Falloff=setting.Falloff,ExpectedRevision=revision};
                if(Anchor)command.Bounds=EditBounds();return s=>TerrainLocalEdits.Apply(s,command);
            }
        }
        public void Release(){if(!Active||Anchor)return;Released=true;if(job==null&&!previewRequested)Commit();}
        public bool Apply(){if(!Active)return false;Released=true;if(job==null&&!previewRequested)return Commit();Status="正在完成最新候选后应用…";return true;}
        bool Commit()
        {
            if(Preview==null||Preview.Rejected||!Preview.Changed){string reason=Preview==null?Status:Preview.Reason;Cancel();Status=string.IsNullOrEmpty(reason)?"没有形体或颜色变化。":reason;return false;}
            if(!ValidTicket()){Cancel();Status="作者或场景已经变化，旧候选作废。";return false;}
            string undoLabel=Settings.Tool=="paint"?"基础地貌上色":Settings.Tool=="reference"?"参考形色绘制":"基础地貌塑形";Undo.IncrementCurrentGroup();int undoGroup=Undo.GetCurrentGroup();Undo.SetCurrentGroupName(undoLabel);Undo.RecordObject(component,undoLabel);
            Current=Preview.Snapshot;component.Write(Current.State);component.BrushJson=JsonUtility.ToJson(Settings);EditorUtility.SetDirty(component);EditorSceneManager.MarkSceneDirty(Author.gameObject.scene);
            Undo.FlushUndoRecordObjects();Undo.CollapseUndoOperations(undoGroup);LE01Adapter.DiscardCommitted(Author);Active=Anchor=Released=false;frozen=null;committedBuild=null;Preview=null;generation++;Status="已提交；可撤销、继续绘制或保存。";return true;
        }
        bool ValidTicket(){return Author!=null&&component!=null&&Author.gameObject.scene.handle==sceneHandle&&Author.DocumentJson==frozenBasis&&component.EditJson==frozenJson;}
        public void Cancel()
        {
            generation++;previewRequested=false;job=null;
            if(Active&&Author!=null){LE01Adapter.RestoreCommitted(Author);Build=committedBuild;}
            Active=Anchor=Released=false;Preview=null;frozen=null;committedBuild=null;GUIUtility.hotControl=0;
        }
        public void Navigate(){if(Active&&!Anchor&&!Released)Cancel();}
        public void Tick()
        {
            var timer=System.Diagnostics.Stopwatch.StartNew();
            try
            {
                if(Author==null||component==null){Cancel();return;}
                if(job!=null&&job.IsCompleted)
                {
                    var completed=job.Result;job=null;
                    if(completed.Generation!=generation||completed.Json!=component.EditJson||completed.Basis!=Author.DocumentJson||Author.gameObject.scene.handle!=sceneHandle){StaleResults++;return;}
                    if(completed.Error!=null){Status=completed.Error.Message;if(Active)Cancel();return;}
                    LastWorkerMilliseconds=completed.Milliseconds;
                    if(initial){bool clear=Build==null;Current=completed.Result.Snapshot;Build=completed.Build;LE01Adapter.UploadBasic(Author,Build,clear);referenceFields.Clear();if(completed.Fields!=null)foreach(var pair in completed.Fields)referenceFields[pair.Key]=pair.Value;initial=false;history=false;if(string.IsNullOrEmpty(component.EditJson))component.Write(Current.State);Status="基础地貌已就绪。";}
                    else if(Active&&completed.Sequence==sequence&&completed.Result!=null)
                    {
                        Preview=completed.Result;appliedSequence=completed.Sequence;
                        if(!Preview.Rejected&&Preview.Changed){LE01Adapter.RestoreCommitted(Author);LE01Adapter.CaptureCommitted(Author);Build=completed.Build;LE01Adapter.UploadBasic(Author,Build);PreviewUploads++;Status=Anchor?"候选已更新；应用或取消。":"预览已更新；松手提交。";}else{LE01Adapter.RestoreCommitted(Author);LE01Adapter.CaptureCommitted(Author);Build=committedBuild;Status=Preview.Reason;}
                        SceneView.RepaintAll();
                    }
                }
                if(Active&&!ValidTicket()){Cancel();Status="作者发生变化，已取消旧候选。";return;}
                if(Active&&job==null&&previewRequested&&(Released||EditorApplication.timeSinceStartup-lastLaunch>=.05))
                {
                    var operation=PrepareOperation();previewRequested=false;lastLaunch=EditorApplication.timeSinceStartup;var source=frozen;var cache=committedCache;int ticket=generation,seq=sequence;string json=frozenJson,basis=frozenBasis;
                    job=Task.Run(()=>{var watch=System.Diagnostics.Stopwatch.StartNew();try{var result=operation(source);return new Job{Generation=ticket,Sequence=seq,Json=json,Basis=basis,Result=result,Build=result.Rejected||!result.Changed?null:TerrainSurfaceMesher.Build(result.Snapshot,cache,result.Dirty),Milliseconds=watch.Elapsed.TotalMilliseconds};}catch(Exception error){return new Job{Generation=ticket,Sequence=seq,Json=json,Basis=basis,Error=error};}});
                }
                if(Active&&Released&&job==null&&!previewRequested&&appliedSequence==sequence)Commit();
            }
            finally {LastTickMilliseconds=timer.Elapsed.TotalMilliseconds;}
        }
        public void PersistSettings()
        {
            if(Busy)throw new InvalidOperationException("候选未结束，不能保存。");component.BrushJson=JsonUtility.ToJson(Settings);
            var state=Current.State.Copy();state.Settings=new TerrainEditSettings{Quantum=Settings.Quantum,Radius=Settings.Radius,Amount=TerrainUnits.ToUnits(Settings.Amount),NegativeX=Settings.NegativeX,PositiveX=Settings.PositiveX,NegativeZ=Settings.NegativeZ,PositiveZ=Settings.PositiveZ,YMin=TerrainUnits.ToUnits(AnchorPoint.y-Settings.YBelow),YMax=TerrainUnits.ToUnits(AnchorPoint.y+Settings.YAbove),Falloff=Settings.Falloff,Tool=Settings.Tool,Mode=Settings.Mode,InputMode=Settings.AnchorMode?"anchor":"continuous",ExtraJson=component.BrushJson};component.Write(state);Current=Current.WithState(state);EditorUtility.SetDirty(component);
        }
        static TerrainDirtySet HistoryDirty(TerrainEditSnapshot before,TerrainEditSnapshot after)
        {
            var dirty=new TerrainDirtySet();if(before==null||before.State.BaseTerrainHash!=after.State.BaseTerrainHash){dirty.All=true;return dirty;}
            var a=before.State.OwnedColumns.ToDictionary(c=>new TerrainColumnKey(c.X,c.Z));var b=after.State.OwnedColumns.ToDictionary(c=>new TerrainColumnKey(c.X,c.Z));
            var keys=new HashSet<TerrainColumnKey>(a.Keys);keys.UnionWith(b.Keys);
            foreach(var key in keys){TerrainColumnOverride x,y;a.TryGetValue(key,out x);b.TryGetValue(key,out y);bool same=x!=null&&y!=null&&x.Spans.Count==y.Spans.Count;if(same)for(int i=0;i<x.Spans.Count;i++){var p=x.Spans[i];var q=y.Spans[i];if(p.Min!=q.Min||p.Max!=q.Max||p.BaseColorId!=q.BaseColorId||p.TopColorId!=q.TopColorId||p.BottomColorId!=q.BottomColorId){same=false;break;}}if(!same)dirty.AddColumn(key.X,key.Z);}
            var paintA=before.State.PaintRuns.GroupBy(p=>new TerrainColumnKey(p.X,p.Z)).ToDictionary(g=>g.Key,g=>g.ToArray());var paintB=after.State.PaintRuns.GroupBy(p=>new TerrainColumnKey(p.X,p.Z)).ToDictionary(g=>g.Key,g=>g.ToArray());keys=new HashSet<TerrainColumnKey>(paintA.Keys);keys.UnionWith(paintB.Keys);
            foreach(var key in keys){TerrainPaintRun[] x,y;paintA.TryGetValue(key,out x);paintB.TryGetValue(key,out y);bool same=x!=null&&y!=null&&x.Length==y.Length;if(same)for(int i=0;i<x.Length;i++)if(x[i].YMin!=y[i].YMin||x[i].YMax!=y[i].YMax||x[i].FaceMask!=y[i].FaceMask||x[i].ColorId!=y[i].ColorId||x[i].Priority!=y[i].Priority){same=false;break;}if(!same)dirty.AddColumn(key.X,key.Z);}
            return dirty;
        }
        public bool AddReference(VoxelModuleAsset asset,string path)
        {
            if(Busy||!Ready)return false;var compiled=TerrainReferenceField.Compile(asset,new ReferenceCompileSettings());if(compiled.Rejected){Status=compiled.Reason;return false;}
            referenceFields[asset.assetId+"#"+compiled.Field.SourceHash]=compiled.Field;
            var persisted=asset.Copy();foreach(var cell in persisted.voxels)if(cell.faces==null)cell.faces=Enumerable.Repeat(cell.material,6).ToArray();
            var state=Current.State.Copy();var record=new TerrainReferenceRecord{Id=asset.assetId,SourceHash=compiled.Field.SourceHash,SourcePath=path,Asset=persisted};int index=state.References.FindIndex(r=>r.Id==record.Id&&r.SourceHash==record.SourceHash);if(index<0){state.References.Add(record);index=state.References.Count-1;}else state.References[index]=record;
            Undo.RecordObject(component,"导入地貌参考");state.Revision++;Current=Current.WithState(state);component.Write(state);Settings.ReferenceIndex=index;component.BrushJson=JsonUtility.ToJson(Settings);EditorUtility.SetDirty(component);EditorSceneManager.MarkSceneDirty(Author.gameObject.scene);Status="参考已采样；按住左键连续绘制。";return true;
        }
    }
}
