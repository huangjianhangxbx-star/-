using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public enum LE01InputKind {Down,Drag,Up,Escape,FocusLost,ToolChanged,SceneClosed}
    // SceneView and replay tests share this transaction boundary. No event is a physical-input claim.
    public sealed class LE01Stroke
    {
        static readonly Dictionary<LE01TerrainAuthor,LE01Stroke> editing=new Dictionary<LE01TerrainAuthor,LE01Stroke>();
        public static bool IsEditing(LE01TerrainAuthor author){return author!=null&&(editing.ContainsKey(author)||LE03Modules.Busy(author)||LE04TerrainSession.IsBusy(author));}
        public static void CancelAuthor(LE01TerrainAuthor author){LE01Stroke owner;if(author!=null&&editing.TryGetValue(author,out owner))owner.Cancel();}
        LE01TerrainAuthor guardedAuthor;
        bool AcquireGuard(LE01TerrainAuthor author)
        {
            if(author==null)return false;LE01Stroke owner;if(editing.TryGetValue(author,out owner)&&owner!=this)return false;
            editing[author]=this;guardedAuthor=author;return true;
        }
        void ReleaseGuard()
        {
            if(!ReferenceEquals(guardedAuthor,null)){LE01Stroke owner;if(editing.TryGetValue(guardedAuthor,out owner)&&owner==this)editing.Remove(guardedAuthor);}guardedAuthor=null;
        }
        public LE01TerrainAuthor Author;
        public BrushMode Mode;
        public float Radius=1.5f;
        public int Quantum=2,PlaneHeight,Seed=719,TargetQuantum=2;
        public float SculptStrength=-.125f;
        public float Falloff=1.5f,HeightStrength=.5f;
        public TerrainHeightForm HeightForm=TerrainHeightForm.Mound;
        public float RotationDegrees,AspectRatio=1.7f;
        public SculptInfluence SculptScope=SculptInfluence.LocalSurface;
        public int SculptMinHeight=-48,SculptMaxHeight;
        public bool SculptPreviewOnly;
        public bool EntirePlateau,PendingConfirmation;
        public string Status="就绪";
        public long LastKernelMilliseconds,LastBuildMilliseconds;
        public double LastUndoMilliseconds,LastCommitUploadMilliseconds;
        public int StaleResults;
        public int PreviewUploads {get;private set;}
        public bool Active {get{return frozen!=null;}}
        public bool ReleasePending {get;private set;}
        public bool RestoringHistory {get;private set;}
        public bool Busy {get{return Active||RestoringHistory;}}
        public bool Handle(LE01InputKind kind,Vector3 point,float screenY,bool navigation=false,bool textFocus=false)
        {
            if(navigation||textFocus){if(Active)Cancel();return false;}
            switch(kind){
                case LE01InputKind.Down:return Begin(point,screenY);
                case LE01InputKind.Drag:Drag(point,screenY);return Active;
                case LE01InputKind.Up:return End();
                default:Cancel();return false;
            }
        }
        public TerrainResult Preview {get;private set;}
        public TerrainCommand Command {get;private set;}
        TerrainDocument frozen;
        LE01TerrainAuthor frozenAuthor;
        string frozenJson;
        TerrainBuild finalBuild;
        TerrainCommand previewCommand;
        TerrainCommand runningCommand;
        TerrainStrokeCoverage coverage;
        Bounds2? touched;
        float downY;
        Vector2 sculptDownScreen;
        float sculptStartStrength;
        float heightStartStrength;
        readonly RevisionGate gate=new RevisionGate();
        readonly Func<TerrainDocument,TerrainCommand,TerrainResult> evaluate;
        public LE01Stroke(Func<TerrainDocument,TerrainCommand,TerrainResult> evaluate=null){this.evaluate=evaluate??((source,command)=>TerrainKernel.Apply(source,command));}
        Task<PreviewJob> job;
        bool queued;
        int requestedSequence,appliedSequence;
        double lastLaunch;
        Task<HistoryResult> historyJob;
        LE01TerrainAuthor historyAuthor;
        TerrainDocument historySource;
        string historyJson;
        int historyGeneration;
        bool historyQueued;
        sealed class HistoryResult {public TerrainBuild Build;public int Generation;public Exception Error;}
        sealed class PreviewJob {public GenerationTicket Ticket;public TerrainResult Result;public TerrainBuild Build;public TerrainCommand Command;public long Kernel;public int Sequence;public Exception Error;}
        public static bool IsSculptMode(BrushMode mode){return mode==BrushMode.SculptDepth||mode==BrushMode.SculptDensity||mode==BrushMode.LockShape||mode==BrushMode.UnlockShape||mode==BrushMode.RestoreShape||mode==BrushMode.RestoreOrphan||mode==BrushMode.SculptShape;}
        public static bool IsHeightMode(BrushMode mode){return mode==BrushMode.Raise||mode==BrushMode.Lower||mode==BrushMode.SmoothRaise||mode==BrushMode.SmoothLower;}
        public void LoadParameters(TerrainDocument source)
        {
            PlaneHeight=source.ActivePlaneHeight;Quantum=source.ActiveQuantum;Radius=source.BrushRadius;
            HeightForm=source.RockRuleVersion==0?TerrainHeightForm.RoundTerrace:source.HeightBrushForm;
            RotationDegrees=source.RockRuleVersion==0?0:source.HeightBrushRotation;AspectRatio=source.RockRuleVersion==0?1:source.HeightBrushAspect;
        }
        public bool BeginSculpt(SurfaceHit hit,Vector2 screen)
        {
            if(RestoringHistory){Status="历史几何正在恢复，请稍候";return false;}Cancel();if(Author==null)return false;if(IsEditing(Author)){Status="此地形有另一笔操作尚未结束";return false;}var source=Author.Read();
            if(!TerrainGenerators.IsRockDocument(source)){Status="旧生成器保持原样；先显式采用新版候选";return false;}
            var selection=Mode==BrushMode.SculptShape?TerrainStructures.ResolveShapeHit(source,hit,Radius,SculptScope,SculptMinHeight,SculptMaxHeight):TerrainStructures.ResolveHit(source,hit,Radius,SculptScope,SculptMinHeight,SculptMaxHeight);
            return StartSculpt(source,selection,screen);
        }
        public bool BeginSculptSelection(SculptSelection selection,Vector2 screen)
        {
            if(RestoringHistory){Status="历史几何正在恢复，请稍候";return false;}Cancel();if(IsEditing(Author)){Status="此地形有另一笔操作尚未结束";return false;}return Author!=null&&StartSculpt(Author.Read(),selection,screen);
        }
        bool StartSculpt(TerrainDocument source,SculptSelection selection,Vector2 screen)
        {
            if(Author==null||selection==null||!selection.Valid){Status=selection==null?"无可编辑结构":selection.Message;return false;}
            frozen=source;if(!TerrainGenerators.IsRockDocument(frozen)){frozen=null;Status="岩壁塑形需要显式新版候选";return false;}frozenAuthor=Author;
            frozenJson=Author.DocumentJson;sculptDownScreen=screen;sculptStartStrength=SculptStrength;PendingConfirmation=false;ReleasePending=false;touched=null;finalBuild=null;previewCommand=null;coverage=null;requestedSequence=appliedSequence=0;
            Command=new TerrainCommand{Mode=Mode,Radius=Radius,Quantum=Quantum,PlaneHeight=frozen.ActivePlaneHeight,Selection=selection.Copy(),Strength=BoundStrength(Mode,SculptStrength),EditId=Guid.NewGuid().ToString("N")};
            if(!AcquireGuard(Author)){frozen=null;frozenAuthor=null;Status="此地形有另一笔操作尚未结束";return false;}LE01Adapter.CaptureCommitted(Author);Request();return true;
        }
        static float BoundStrength(BrushMode mode,float value){float limit=mode==BrushMode.SculptDensity||mode==BrushMode.SculptShape?1f:.5f;return Mathf.Clamp(value,-limit,limit);}
        public void DragSculpt(Vector2 screen,bool editable)
        {
            if(!Active||PendingConfirmation||ReleasePending||!CheckDocument()||!IsSculptMode(Command.Mode))return;
            if(!editable){Status="已离开冻结的可编辑投影；本次位置跳过，目标保持";return;}
            if(Command.Mode!=BrushMode.SculptDepth&&Command.Mode!=BrushMode.SculptDensity&&Command.Mode!=BrushMode.SculptShape)return;
            float next=BoundStrength(Command.Mode,sculptStartStrength+(screen.x-sculptDownScreen.x)*(Command.Mode==BrushMode.SculptDensity?.01f:.005f));if(next==Command.Strength)return;Command.Strength=next;Request();
        }
        public bool Begin(Vector3 localPoint,float screenY)
        {
            if(RestoringHistory){Status="历史几何正在恢复，请稍候";return false;}Cancel();if(Author==null)return false;if(IsEditing(Author)){Status="此地形有另一笔操作尚未结束";return false;}
            frozen=Author.Read();frozenAuthor=Author;frozenJson=Author.DocumentJson;downY=screenY;heightStartStrength=HeightStrength;PendingConfirmation=false;ReleasePending=false;touched=null;finalBuild=null;previewCommand=null;coverage=new TerrainStrokeCoverage();requestedSequence=appliedSequence=0;
            int? height=TerrainQueries.HeightUnits(frozen,localPoint.x,localPoint.z);
            if(IsHeightMode(Mode)&&!height.HasValue){frozen=null;Status="先在台面上按下";return false;}
            var form=frozen.RockRuleVersion==0?TerrainHeightForm.RoundTerrace:HeightForm;
            Command=new TerrainCommand{Mode=Mode,Radius=Radius,Falloff=Falloff,HeightForm=form,RotationDegrees=form==TerrainHeightForm.RoundTerrace?0:Mathf.Repeat(RotationDegrees,360),AspectRatio=form==TerrainHeightForm.RoundTerrace?1:Mathf.Clamp(AspectRatio,1,4),Quantum=Quantum,PlaneHeight=PlaneHeight,StartHeight=height??PlaneHeight,TargetHeight=height??PlaneHeight,Seed=Seed,TargetQuantum=TargetQuantum,EntirePlateau=EntirePlateau,Strength=Mode==BrushMode.SmoothRaise||Mode==BrushMode.SmoothLower?Mathf.Clamp(HeightStrength,0,8):0};
            if(!AcquireGuard(Author)){frozen=null;frozenAuthor=null;Status="此地形有另一笔操作尚未结束";return false;}LE01Adapter.CaptureCommitted(Author);Command.Path.Add(new Point2(localPoint.x,localPoint.z));Request();return true;
        }
        public void Drag(Vector3 localPoint,float screenY)
        {
            if(!Active||PendingConfirmation||ReleasePending||!CheckDocument())return;
            if(Command.Mode==BrushMode.Raise||Command.Mode==BrushMode.Lower)
            {
                int delta=Mathf.RoundToInt(Mathf.Abs(screenY-downY)/8f)*Command.Quantum;
                int next=Command.Mode==BrushMode.Raise?Command.StartHeight+delta:Math.Max(frozen.BaseHeight+Command.Quantum,Command.StartHeight-delta);if(next==Command.TargetHeight)return;Command.TargetHeight=next;
            }
            else if(Command.Mode==BrushMode.SmoothRaise||Command.Mode==BrushMode.SmoothLower){float next=Mathf.Clamp(heightStartStrength+(downY-screenY)*.01f,0,8);if(next==Command.Strength)return;Command.Strength=next;}
            else if(Command.Mode==BrushMode.Extend||Command.Mode==BrushMode.Erase){var last=Command.Path[Command.Path.Count-1];if(last.X==localPoint.x&&last.Z==localPoint.z)return;Command.Path.Add(new Point2(localPoint.x,localPoint.z));}
            Request();
        }
        void Request(){requestedSequence++;queued=true;Status="预览计算中";}
        TerrainCommand CopyCommand()
        {
            return new TerrainCommand{Mode=Command.Mode,Path=new List<Point2>(Command.Path),Radius=Command.Radius,Falloff=Command.Falloff,HeightForm=Command.HeightForm,RotationDegrees=Command.RotationDegrees,AspectRatio=Command.AspectRatio,Quantum=Command.Quantum,PlaneHeight=Command.PlaneHeight,StartHeight=Command.StartHeight,TargetHeight=Command.TargetHeight,Seed=Command.Seed,TargetQuantum=Command.TargetQuantum,EntirePlateau=Command.EntirePlateau,Selection=Command.Selection==null?null:Command.Selection.Copy(),Strength=Command.Strength,EditId=Command.EditId};
        }
        // Sequence equality alone is insufficient: callers can edit the public Command
        // object without requesting another preview. Compare the exact frozen input.
        static bool SameCommand(TerrainCommand a,TerrainCommand b)
        {
            if(a==null||b==null||a.Mode!=b.Mode||a.Radius!=b.Radius||a.Falloff!=b.Falloff||a.HeightForm!=b.HeightForm||a.RotationDegrees!=b.RotationDegrees||a.AspectRatio!=b.AspectRatio||a.Quantum!=b.Quantum||a.PlaneHeight!=b.PlaneHeight||a.StartHeight!=b.StartHeight||a.TargetHeight!=b.TargetHeight||a.Seed!=b.Seed||a.TargetQuantum!=b.TargetQuantum||a.EntirePlateau!=b.EntirePlateau||a.Strength!=b.Strength||a.EditId!=b.EditId)return false;
            if(a.Path==null||b.Path==null||a.Path.Count!=b.Path.Count)return false;
            for(int i=0;i<a.Path.Count;i++)if(a.Path[i].X!=b.Path[i].X||a.Path[i].Z!=b.Path[i].Z)return false;
            var s=a.Selection;var t=b.Selection;if(s==null||t==null)return s==t;
            if(s.DocumentId!=t.DocumentId||s.SourceRevision!=t.SourceRevision||s.MinHeight!=t.MinHeight||s.MaxHeight!=t.MaxHeight||s.Valid!=t.Valid||s.Influence!=t.Influence||s.LocalMask!=t.LocalMask||s.LocalX!=t.LocalX||s.LocalY!=t.LocalY||s.LocalZ!=t.LocalZ||s.LocalRadius!=t.LocalRadius||s.Message!=t.Message||s.Bounds.MinX!=t.Bounds.MinX||s.Bounds.MinZ!=t.Bounds.MinZ||s.Bounds.MaxX!=t.Bounds.MaxX||s.Bounds.MaxZ!=t.Bounds.MaxZ)return false;
            if(s.GroupIds==null||t.GroupIds==null||s.Anchors==null||t.Anchors==null||s.GroupIds.Count!=t.GroupIds.Count||s.Anchors.Count!=t.Anchors.Count)return false;
            for(int i=0;i<s.GroupIds.Count;i++)if(s.GroupIds[i]!=t.GroupIds[i])return false;
            for(int i=0;i<s.Anchors.Count;i++){
                var x=s.Anchors[i];var y=t.Anchors[i];if(x==null||y==null){if(x!=y)return false;continue;}
                if(x.X!=y.X||x.Z!=y.Z||x.Axis!=y.Axis||x.Sign!=y.Sign||x.LowerHeight!=y.LowerHeight||x.UpperHeight!=y.UpperHeight||x.PatchMinHeight!=y.PatchMinHeight||x.PatchMaxHeight!=y.PatchMaxHeight||x.GroupId!=y.GroupId||x.ChildId!=y.ChildId)return false;
            }
            return true;
        }
        public void Tick()
        {
            if(RestoringHistory){TickHistory();return;}
            if(historyJob!=null&&historyJob.IsCompleted)historyJob=null;
            if(Active&&!CheckDocument())return;
            if(ReleasePending&&HasFinalPreview()){FinishRelease();return;}
            if(job!=null&&job.IsCompleted)
            {
                if(job.IsFaulted){StaleResults++;job=null;runningCommand=null;return;}
                var result=job.Result;job=null;runningCommand=null;
                bool current=Active&&Author!=null&&result.Sequence>appliedSequence&&gate.CanApply(result.Ticket,frozen);
                if(result.Error!=null){if(current){string message=result.Error.Message;Cancel();Status=message;}else StaleResults++;}
                else if(current){
                    appliedSequence=result.Sequence;Preview=result.Result;finalBuild=result.Build;previewCommand=result.Command;LastKernelMilliseconds=result.Kernel;LastBuildMilliseconds=result.Build.Milliseconds;
                    if(ReleasePending&&HasFinalPreview()){FinishRelease();return;}
                    Touch(Preview.DirtyBounds);LE01Adapter.Upload(Author,result.Build,false);PreviewUploads++;Status=ReleasePending?"正在完成最后一笔，可按 Esc 取消":Preview.Message;SceneView.RepaintAll();
                }
                else StaleResults++;
            }
            if(!Active||!queued||job!=null||EditorApplication.timeSinceStartup-lastLaunch<.045)return;
            queued=false;lastLaunch=EditorApplication.timeSinceStartup;var source=frozen;var cmd=CopyCommand();runningCommand=cmd;var ticket=gate.Capture(frozen);int sequence=requestedSequence;var strokeCoverage=coverage;
            job=Task.Run(()=>{try{var watch=Stopwatch.StartNew();var result=Evaluate(source,cmd,strokeCoverage);watch.Stop();return new PreviewJob{Ticket=ticket,Result=result,Build=TerrainCompiler.Build(result.Document,result.DirtyBounds),Command=cmd,Kernel=watch.ElapsedMilliseconds,Sequence=sequence};}catch(Exception error){return new PreviewJob{Ticket=ticket,Sequence=sequence,Error=error};}});
        }
        TerrainResult Evaluate(TerrainDocument source,TerrainCommand command,TerrainStrokeCoverage strokeCoverage)
        {
            if(strokeCoverage!=null&&(command.Mode==BrushMode.Extend||command.Mode==BrushMode.Erase)){
                try{command.Coverage=strokeCoverage.Prepare(command);}catch(ArgumentException){command.Coverage=null;}
            }
            return evaluate(source,command);
        }
        bool HasFinalPreview(){return Preview!=null&&finalBuild!=null&&appliedSequence==requestedSequence&&SameCommand(Command,previewCommand);}
        bool NeedsConfirmation(){return Command.Mode==BrushMode.Convert||Command.Mode==BrushMode.Reshape||IsSculptMode(Command.Mode)&&SculptPreviewOnly;}
        // The SceneView release callback only requests completion. The worker and Tick
        // settle the exact latest command while the author remains guarded and cancellable.
        public bool RequestEnd()
        {
            if(!Active||PendingConfirmation||!CheckDocument())return false;
            if(ReleasePending)return true;
            ReleasePending=true;
            if(!HasFinalPreview()&&!queued&&(job==null||!SameCommand(Command,runningCommand)))Request();
            Status="正在完成最后一笔，可按 Esc 取消";return true;
        }
        bool FinishRelease()
        {
            ReleasePending=false;queued=false;
            Status=Preview==null?"没有候选":Preview.Message;
            if(NeedsConfirmation()){
                Touch(Preview.DirtyBounds);LE01Adapter.Upload(Author,finalBuild,false);PreviewUploads++;PendingConfirmation=true;Status+=" · 检查后应用或取消";SceneView.RepaintAll();return false;
            }
            return Apply();
        }
        public bool End()
        {
            if(!Active||!CheckDocument())return false;
            ReleasePending=false;bool reuse=HasFinalPreview();gate.Invalidate();queued=false;
            if(!reuse){var watch=Stopwatch.StartNew();Preview=Evaluate(frozen,CopyCommand(),coverage);watch.Stop();LastKernelMilliseconds=watch.ElapsedMilliseconds;
                finalBuild=TerrainCompiler.Build(Preview.Document,Preview.DirtyBounds);LastBuildMilliseconds=finalBuild.Milliseconds;Touch(Preview.DirtyBounds);LE01Adapter.Upload(Author,finalBuild,false);}
            Status=Preview.Message;
            if(NeedsConfirmation()){PendingConfirmation=true;Status+=" · 检查后应用或取消";return false;}
            return Apply();
        }
        public bool Apply()
        {
            if(Active&&!CheckDocument())return false;
            if(!Active||Preview==null||!Preview.Changed||Preview.Rejected){string message=Preview==null?"没有候选":Preview.Message;Cancel();Status=message;return false;}
            var commitWatch=Stopwatch.StartNew();Undo.IncrementCurrentGroup();int group=Undo.GetCurrentGroup();Undo.SetCurrentGroupName("LE01 "+Command.Mode);Undo.RecordObject(Author,"LE01 "+Command.Mode);
            var d=Preview.Document;if(d.RockRuleVersion==1&&(Command.Mode==BrushMode.SmoothRaise||Command.Mode==BrushMode.SmoothLower)){d.HeightBrushForm=Command.HeightForm;d.HeightBrushRotation=Command.RotationDegrees;d.HeightBrushAspect=Command.AspectRatio;}d.Revision=frozen.Revision+1;Author.Write(d);EditorUtility.SetDirty(Author);EditorSceneManager.MarkSceneDirty(Author.gameObject.scene);Undo.FlushUndoRecordObjects();Undo.CollapseUndoOperations(group);
            commitWatch.Stop();LastUndoMilliseconds=commitWatch.Elapsed.TotalMilliseconds;ReleaseGuard();frozen=null;frozenAuthor=null;PendingConfirmation=false;ReleasePending=false;gate.Invalidate();queued=false;
            commitWatch.Restart();LE01Adapter.Upload(Author,finalBuild??TerrainCompiler.Build(d,Preview.DirtyBounds),true);LE01Adapter.DiscardCommitted(Author);commitWatch.Stop();LastCommitUploadMilliseconds=commitWatch.Elapsed.TotalMilliseconds;touched=null;finalBuild=null;previewCommand=null;coverage=null;PlaneHeight=d.ActivePlaneHeight;Status="已提交："+Command.Mode;return true;
        }
        public void Cancel()
        {
            bool had=Active;var original=frozenAuthor;if(had)ReleaseGuard();gate.Invalidate();queued=false;frozen=null;frozenAuthor=null;PendingConfirmation=false;ReleasePending=false;Preview=null;
            if(had){
                if(original!=null&&touched.HasValue&&!LE01Adapter.RestoreCommitted(original))LE01Adapter.Upload(original,TerrainCompiler.Build(original.Read(),touched.Value),true);
                if(!ReferenceEquals(original,null))LE01Adapter.DiscardCommitted(original);Status="已取消，作者数据未改变";
            }touched=null;finalBuild=null;previewCommand=null;coverage=null;
        }
        public void UndoChanged()
        {
            var original=frozenAuthor;ClearHistory();ReleaseGuard();gate.Invalidate();queued=false;frozen=null;frozenAuthor=null;PendingConfirmation=false;ReleasePending=false;Preview=null;
            touched=null;finalBuild=null;previewCommand=null;coverage=null;if(!ReferenceEquals(original,null))LE01Adapter.DiscardCommitted(original);
            if(Author!=null){if(IsEditing(Author)){Status="此地形有另一笔操作尚未结束";return;}var d=Author.Read();LoadParameters(d);LE01Adapter.Upload(Author,TerrainCompiler.Build(d),true,true);Status="历史已恢复（文档全量恢复）";}
        }
        public void RequestUndoChanged()
        {
            Cancel();ClearHistory();if(Author==null)return;if(!AcquireGuard(Author)){Status="此地形有另一笔操作尚未结束";return;}
            historyAuthor=Author;historyJson=Author.DocumentJson;historySource=Author.Read();historyQueued=true;RestoringHistory=true;
            LoadParameters(historySource);Status="正在恢复历史几何，请稍候";
            EditorApplication.update-=TickHistoryStandalone;EditorApplication.update+=TickHistoryStandalone;
        }
        void TickHistoryStandalone(){if(RestoringHistory)TickHistory();else EditorApplication.update-=TickHistoryStandalone;}
        void ClearHistory()
        {
            historyGeneration++;historyQueued=false;RestoringHistory=false;ReleaseGuard();historyAuthor=null;historySource=null;historyJson=null;EditorApplication.update-=TickHistoryStandalone;
        }
        void TickHistory()
        {
            if(!RestoringHistory)return;
            if(Author==null||Author!=historyAuthor){ClearHistory();return;}
            if(Author.DocumentJson!=historyJson){RequestUndoChanged();return;}
            if(historyJob!=null&&historyJob.IsCompleted){
                var result=historyJob.Result;historyJob=null;
                if(result.Generation==historyGeneration){
                    if(result.Error!=null){string message=result.Error.Message;ClearHistory();Status="历史几何未完成："+message;return;}
                    LE01Adapter.Upload(Author,result.Build,true,true);ClearHistory();Status="历史已恢复";SceneView.RepaintAll();return;
                }StaleResults++;
            }
            if(!historyQueued||historyJob!=null)return;
            historyQueued=false;var source=historySource;int generation=historyGeneration;
            historyJob=Task.Run(()=>{try{return new HistoryResult{Build=TerrainCompiler.Build(source),Generation=generation};}catch(Exception error){return new HistoryResult{Generation=generation,Error=error};}});
        }
        void Touch(Bounds2 b){touched=touched.HasValue?new Bounds2(Math.Min(touched.Value.MinX,b.MinX),Math.Min(touched.Value.MinZ,b.MinZ),Math.Max(touched.Value.MaxX,b.MaxX),Math.Max(touched.Value.MaxZ,b.MaxZ)):b;}
        bool CheckDocument(){if(Author!=null&&Author==frozenAuthor&&Author.DocumentJson==frozenJson)return true;UndoChanged();Status="作者文档已替换，旧笔触已取消";return false;}
        public void ReplaceDocument(TerrainDocument document,string label)
        {
            string error;if(!TerrainKernel.Validate(document,out error))throw new System.IO.InvalidDataException(error);Cancel();ClearHistory();if(IsEditing(Author))throw new InvalidOperationException("此地形有另一笔操作尚未结束");
            Undo.IncrementCurrentGroup();int group=Undo.GetCurrentGroup();Undo.SetCurrentGroupName(label);Undo.RecordObject(Author,label);Undo.RecordObject(Author.transform,label);
            Author.Write(document.Copy());Author.transform.position=new Vector3(document.OriginX,document.OriginY,document.OriginZ);Author.transform.rotation=Quaternion.identity;Author.transform.localScale=Vector3.one;
            EditorUtility.SetDirty(Author);EditorSceneManager.MarkSceneDirty(Author.gameObject.scene);Undo.FlushUndoRecordObjects();Undo.CollapseUndoOperations(group);UndoChanged();
        }
        public bool IntersectLockedPlane(Ray worldRay,out Vector3 localPoint)
        {
            localPoint=Vector3.zero;if(Author==null)return false;
            int height=Active?Command.PlaneHeight:PlaneHeight;
            var plane=new Plane(Author.transform.up,Author.transform.TransformPoint(new Vector3(0,height*TerrainUnits.Unit,0)));
            float enter;if(!plane.Raycast(worldRay,out enter))return false;localPoint=Author.transform.InverseTransformPoint(worldRay.GetPoint(enter));return true;
        }
    }
}
