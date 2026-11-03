using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public static class LE03Modules
    {
        sealed class Work
        {
            internal int generation;internal TerrainBuild basis;internal VoxelWorldBuild world;internal VoxelLayerDocument layer;internal TerrainDocument terrain;internal Exception error;
        }
        sealed class Session
        {
            internal LE01TerrainAuthor author;internal LE03ModuleAuthor module;internal string status="选择完整母件，在表面放置";
            internal string cachedLayerJson,cachedBaseJson,frozenTerrain,frozenLayer,knownTerrain,knownLayer;internal VoxelLayerDocument layer;
            internal TerrainBuild basis;internal VoxelWorldBuild lastWorld,committedWorld;internal int baseBuilds,generation;
            internal bool active,released,history,previewed;internal Task<Work> job;internal Work ready;
        }
        static readonly Dictionary<LE01TerrainAuthor,Session> sessions=new Dictionary<LE01TerrainAuthor,Session>();
        static LE03Modules(){EditorApplication.update+=TickAll;Undo.undoRedoPerformed+=OnUndo;EditorSceneManager.sceneClosing+=(scene,removing)=>{foreach(var s in sessions.Values.ToArray())if(s.author!=null&&s.author.gameObject.scene==scene&&s.active){s.history=false;Cancel(s.author);}};}
        static Session Get(LE01TerrainAuthor author)
        {
            if(author==null)throw new ArgumentNullException("author");Session session;if(!sessions.TryGetValue(author,out session))sessions[author]=session=new Session{author=author,module=author.GetComponent<LE03ModuleAuthor>()};return session;
        }
        public static LE03ModuleAuthor GetOrCreate(LE01TerrainAuthor author)
        {
            var s=Get(author);if(s.module==null){s.module=author.gameObject.AddComponent<LE03ModuleAuthor>();s.module.Write(new VoxelLayerDocument());EditorUtility.SetDirty(s.module);EditorSceneManager.MarkSceneDirty(author.gameObject.scene);}return s.module;
        }
        public static bool HasLayer(LE01TerrainAuthor author){return author!=null&&author.GetComponent<LE03ModuleAuthor>()!=null;}
        public static bool Busy(LE01TerrainAuthor author){Session s;return author!=null&&sessions.TryGetValue(author,out s)&&s.active;}
        public static bool ReleasePending(LE01TerrainAuthor author){Session s;return author!=null&&sessions.TryGetValue(author,out s)&&s.active&&s.released;}
        public static bool RestoringHistory(LE01TerrainAuthor author){Session s;return author!=null&&sessions.TryGetValue(author,out s)&&s.active&&s.history;}
        public static string Status(LE01TerrainAuthor author){return author==null?"没有地形作者":Get(author).status;}
        public static int BaseBuildCount(LE01TerrainAuthor author){return Get(author).baseBuilds;}
        public static VoxelLayerDocument Layer(LE01TerrainAuthor author)
        {
            var s=Get(author);var module=author.GetComponent<LE03ModuleAuthor>();if(module==null)return new VoxelLayerDocument();s.module=module;
            if(s.layer==null||s.cachedLayerJson!=module.LayerJson){s.layer=module.Read();string error;if(!VoxelModules.ValidateLayer(s.layer,out error))throw new InvalidDataException(error);s.cachedLayerJson=module.LayerJson;}return s.layer;
        }
        static void MarkKnown(Session s){s.knownTerrain=s.author.DocumentJson;s.knownLayer=s.module==null?null:s.module.LayerJson;}
        static void RecordLayer(Session s,VoxelLayerDocument layer,string label)
        {
            Undo.IncrementCurrentGroup();int group=Undo.GetCurrentGroup();Undo.SetCurrentGroupName(label);Undo.RecordObject(s.module,label);s.module.Write(layer);EditorUtility.SetDirty(s.module);EditorSceneManager.MarkSceneDirty(s.author.gameObject.scene);Undo.FlushUndoRecordObjects();Undo.CollapseUndoOperations(group);s.layer=null;MarkKnown(s);LE01Adapter.AcknowledgeModuleLibrary(s.author);
        }
        public static bool SetUnit(LE01TerrainAuthor author,float unit)
        {
            if(LE01Stroke.IsEditing(author))return false;var current=Layer(author);if(current.assets.Count!=0||current.placements.Count!=0)return false;var next=current.Copy();next.voxelSize=unit;string error;if(!VoxelModules.ValidateLayer(next,out error)){Get(author).status=error;return false;}GetOrCreate(author);RecordLayer(Get(author),next,"改变模型格度");return true;
        }
        public static bool Import(LE01TerrainAuthor author,VoxelModuleAsset asset)
        {
            if(author==null||LE01Stroke.IsEditing(author))return false;var s=Get(author);string error;
            if(!VoxelModules.ValidateAsset(asset,out error)){s.status=error;return false;}var layer=Layer(author);
            if(Math.Abs(asset.voxelSize-layer.voxelSize)>.00001f){s.status="素材格度与模型层不一致；未缩放或替换已有素材";return false;}
            asset=asset.Copy();foreach(var voxel in asset.voxels)if(voxel.faces==null)voxel.faces=Enumerable.Repeat(voxel.material,6).ToArray();
            var existing=layer.assets.FirstOrDefault(a=>VoxelModules.AssetKey(a)==VoxelModules.AssetKey(asset));
            if(existing!=null){bool same=JsonUtility.ToJson(existing)==JsonUtility.ToJson(asset);s.status=same?"此源版本已在素材库中":"相同来源标识对应不同内容；请以新版本/Hash导入，已有素材保留";return same;}
            var candidate=layer.Copy();candidate.assets.Add(asset.Copy());candidate.revision++;
            if(!VoxelModules.ValidateLayer(candidate,out error)){s.status=error;return false;}GetOrCreate(author);RecordLayer(s,candidate,"导入完整模型素材");s.status="已导入完整母件 · "+asset.assetId;return true;
        }
        public static bool BeginPlace(LE01TerrainAuthor author,VoxelPlacement placement)
        {
            if(author==null||LE01Stroke.IsEditing(author))return false;var result=VoxelModules.Place(Layer(author),placement);if(result.Rejected||!result.Changed){Get(author).status=result.Message;return false;}return Begin(author,result.Document,null,false);
        }
        public static bool BeginRemove(LE01TerrainAuthor author,string id)
        {
            if(author==null||LE01Stroke.IsEditing(author))return false;var result=VoxelModules.Remove(Layer(author),id);if(result.Rejected||!result.Changed){Get(author).status=result.Message;return false;}return Begin(author,result.Document,null,false);
        }
        public static bool Place(LE01TerrainAuthor author,VoxelPlacement placement){if(!BeginPlace(author,placement))return false;return RequestEnd(author);}
        public static bool Remove(LE01TerrainAuthor author,string id){if(!BeginRemove(author,id))return false;return RequestEnd(author);}
        static bool Begin(LE01TerrainAuthor author,VoxelLayerDocument layer,TerrainDocument replacement,bool history)
        {
            var s=Get(author);if(s.active)return false;GetOrCreate(author);LE01Adapter.RequireTransformContract(author.transform);
            var source=replacement??author.Read();string error;if(!TerrainKernel.Validate(source,out error)||!VoxelModules.ValidateLayer(layer,out error)){s.status=error;return false;}
            s.frozenTerrain=author.DocumentJson;s.frozenLayer=s.module.LayerJson;s.active=true;s.released=history;s.history=history;s.previewed=false;s.ready=null;s.status=history?"正在恢复完整场景":"正在准备完整模型";int generation=++s.generation;
            LE01Adapter.CaptureCommitted(author);var cached=replacement==null&&s.cachedBaseJson==author.DocumentJson?s.basis:null;var frozenLayer=layer.Copy();
            s.job=Task.Run(()=>{var work=new Work{generation=generation,layer=frozenLayer,terrain=replacement};try{work.basis=cached;if(work.basis==null){Interlocked.Increment(ref s.baseBuilds);work.basis=TerrainCompiler.Build(source);}work.world=VoxelModuleCompiler.Build(work.basis,frozenLayer,source.TerrainThemeId);}catch(Exception e){work.error=e;}return work;});return true;
        }
        public static bool RequestEnd(LE01TerrainAuthor author){var s=Get(author);if(!s.active||s.history)return false;s.released=true;s.status="正在完成模型放置 · Esc可取消";return true;}
        static void Clear(Session s){s.active=false;s.released=false;s.history=false;s.previewed=false;s.generation++;s.job=null;s.ready=null;}
        public static void Cancel(LE01TerrainAuthor author)
        {
            if(ReferenceEquals(author,null))return;Session s;if(!sessions.TryGetValue(author,out s)||!s.active||s.history)return;
            Clear(s);if(author!=null){LE01Adapter.RestoreCommitted(author);LE01Adapter.DiscardCommitted(author);}s.lastWorld=s.committedWorld;s.status="已取消，完整模型层保持原样";
        }
        public static void Tick(LE01TerrainAuthor author)
        {
            if(author==null)return;var s=Get(author);if(!s.active)return;
            if(s.module==null||author.DocumentJson!=s.frozenTerrain||s.module.LayerJson!=s.frozenLayer){bool history=s.history;s.history=false;Cancel(author);s.status="作者或模型层已改变，旧任务已丢弃";if(history)HistoryChanged(author);return;}
            if(s.ready==null&&s.job!=null&&s.job.IsCompleted){s.ready=s.job.Result;s.job=null;if(s.ready.generation!=s.generation){s.ready=null;return;}if(s.ready.error!=null){string message=s.ready.error.Message;s.history=false;Cancel(author);s.status=message;return;}}
            if(s.ready==null)return;
            if(!s.released)
            {
                if(!s.previewed){LE01Adapter.Upload(author,s.ready.world.geometry,false,true);s.lastWorld=s.ready.world;s.previewed=true;s.status="模型候选已显示，松开左键提交";}return;
            }
            var work=s.ready;
            try
            {
                LE03ModuleMaterials.ForPalette(work.world.geometry.ModulePalette,true);
                if(!s.history)
                {
                    Undo.IncrementCurrentGroup();int group=Undo.GetCurrentGroup();Undo.SetCurrentGroupName("完整模型编辑");Undo.RecordObject(s.module,"完整模型编辑");
                    if(work.terrain!=null){Undo.RecordObject(author,"打开完整场景");Undo.RecordObject(author.transform,"打开完整场景");author.Write(work.terrain);author.transform.position=new Vector3(work.terrain.OriginX,work.terrain.OriginY,work.terrain.OriginZ);EditorUtility.SetDirty(author);}
                    s.module.Write(work.layer);EditorUtility.SetDirty(s.module);EditorSceneManager.MarkSceneDirty(author.gameObject.scene);Undo.FlushUndoRecordObjects();Undo.CollapseUndoOperations(group);
                }
                LE01Adapter.Upload(author,work.world.geometry,true,true);LE01Adapter.DiscardCommitted(author);
                // Opening a world (or undoing its terrain document) must update
                // the real Window controls before the next toolbar Save. Pure
                // module-only Undo keeps the user's current unsaved brush choices.
                if((work.terrain!=null||s.history&&s.knownTerrain!=author.DocumentJson)&&LE01Window.Instance!=null&&LE01Window.Instance.Controller.Author==author)
                    LE01Window.Instance.Controller.LoadParameters(work.terrain??author.Read());
                s.basis=work.basis;s.cachedBaseJson=author.DocumentJson;s.lastWorld=s.committedWorld=work.world;s.layer=null;MarkKnown(s);Clear(s);s.status="完整场景已提交";SceneView.RepaintAll();
            }
            catch(Exception e){s.history=false;Cancel(author);s.status=e.Message;}
        }
        public static bool Drain(LE01TerrainAuthor author,int timeoutMs)
        {
            var timer=System.Diagnostics.Stopwatch.StartNew();while(Busy(author)&&timer.ElapsedMilliseconds<timeoutMs){Tick(author);Thread.Sleep(2);}return !Busy(author);
        }
        static TerrainBuild Base(Session s)
        {
            if(s.basis==null||s.cachedBaseJson!=s.author.DocumentJson){s.basis=TerrainCompiler.Build(s.author.Read());s.cachedBaseJson=s.author.DocumentJson;s.baseBuilds++;}return s.basis;
        }
        public static VoxelWorldBuild BuildForEvidence(LE01TerrainAuthor author)
        {
            if(Busy(author))throw new InvalidOperationException("等待完整模型事务结束后再构建证据");var s=Get(author);var world=VoxelModuleCompiler.Build(Base(s),Layer(author),author.Read().TerrainThemeId);s.lastWorld=world;return world;
        }
        public static TerrainBuild ComposeForUpload(LE01TerrainAuthor author,TerrainBuild update,bool committed,bool clear)
        {
            if(update.ModuleComposed||!HasLayer(author))return update;var s=Get(author);var layer=Layer(author);
            if(layer.placements.Count==0)
            {
                // Importing a library alone does not change any visible voxel or UV.
                // Preserve the caller's incremental chunk set and its remote Meshes.
                if(committed){if(clear)s.basis=update;else if(s.basis!=null)s.basis=TerrainCompiler.MergeBase(s.basis,update);s.cachedBaseJson=s.basis==null?null:author.DocumentJson;s.lastWorld=s.committedWorld=null;MarkKnown(s);}return update;
            }
            if(clear){if(committed){s.basis=update;s.cachedBaseJson=author.DocumentJson;}}
            var complete=clear?update:TerrainCompiler.MergeBase(s.basis??Base(s),update);
            if(committed){s.basis=complete;s.cachedBaseJson=author.DocumentJson;}
            var world=VoxelModuleCompiler.Build(complete,layer,author.Read().TerrainThemeId);s.lastWorld=world;if(committed){s.committedWorld=world;MarkKnown(s);}return world.geometry;
        }
        public static Material MaterialFor(LE01TerrainAuthor author,TerrainBuild geometry,bool persistent)
        {
            if(author.Gray)return LE01Export.Material(true);return geometry.ModuleComposed?LE03ModuleMaterials.ForPalette(geometry.ModulePalette,persistent):LE03ThemeMaterials.MaterialFor(author,false);
        }
        public static Material CurrentMaterial(LE01TerrainAuthor author,bool gray)
        {
            if(gray)return LE01Export.Material(true);if(Layer(author).placements.Count==0)return LE03ThemeMaterials.MaterialFor(author,false);var s=Get(author);var world=s.lastWorld??BuildForEvidence(author);return LE03ModuleMaterials.ForPalette(world.geometry.ModulePalette,true);
        }
        public static Texture2D ExportPalette(LE01TerrainAuthor author){if(Layer(author).placements.Count==0)return LE03ThemeMaterials.PaletteFor(LE03ThemeMaterials.ThemeFor(author));return LE03ModuleMaterials.ForPalette((Get(author).lastWorld??BuildForEvidence(author)).geometry.ModulePalette,true).GetTexture("_BaseMap") as Texture2D;}
        public static void EnsurePersistentMaterials(LE01TerrainAuthor author)
        {
            if(!HasLayer(author))return;if(LE01Stroke.IsEditing(author))throw new InvalidOperationException("完整场景尚在编辑，不能保存");var material=CurrentMaterial(author,author.Gray);foreach(var r in LE01Adapter.Geometry(author).GetComponentsInChildren<MeshRenderer>())r.sharedMaterial=material;
        }
        public static void HistoryChanged(LE01TerrainAuthor author)
        {
            if(!HasLayer(author))return;var s=Get(author);if(s.active&&s.history&&s.frozenTerrain==author.DocumentJson&&s.frozenLayer==s.module.LayerJson)return;
            LE01Stroke.CancelAuthor(author);if(s.active){s.history=false;Cancel(author);}Begin(author,Layer(author),null,true);
        }
        static void OnUndo(){foreach(var module in UnityEngine.Object.FindObjectsOfType<LE03ModuleAuthor>()){var author=module.GetComponent<LE01TerrainAuthor>();if(author!=null)HistoryChanged(author);}}
        static void TickAll()
        {
            foreach(var s in sessions.Values.ToArray())
            {
                if(s.author==null){LE01Adapter.DiscardCommitted(s.author);Clear(s);sessions.Remove(s.author);continue;}if(s.active)Tick(s.author);
            }
        }
        public static bool TryReadWorld(string json,out VoxelWorldFile world)
        {
            world=null;try{var candidate=JsonUtility.FromJson<VoxelWorldFile>(json);if(candidate==null||candidate.terrain==null||candidate.layer==null)return false;string error=null;if(candidate.schemaVersion!=1||!TerrainKernel.Validate(candidate.terrain,out error)||!VoxelModules.ValidateLayer(candidate.layer,out error))throw new InvalidDataException(error??"Unsupported mixed scene version.");world=candidate;return true;}catch(ArgumentException){return false;}
        }
        public static void SaveWorld(LE01TerrainAuthor author,string path)
        {
            if(LE01Stroke.IsEditing(author))throw new InvalidOperationException("等待完整模型提交或取消后保存");LE01Adapter.RequireTransformContract(author.transform);var terrain=author.Read();terrain.OriginX=author.transform.position.x;terrain.OriginY=author.transform.position.y;terrain.OriginZ=author.transform.position.z;var layer=Layer(author);string error;if(!TerrainKernel.Validate(terrain,out error)||!VoxelModules.ValidateLayer(layer,out error))throw new InvalidDataException(error);
            var world=new VoxelWorldFile{terrain=terrain,layer=layer.Copy()};Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));string temporary=path+".tmp";File.WriteAllText(temporary,JsonUtility.ToJson(world,true),new System.Text.UTF8Encoding(false));if(File.Exists(path))File.Replace(temporary,path,path+".bak");else File.Move(temporary,path);
        }
        public static bool LoadWorld(LE01TerrainAuthor author,string path)
        {
            if(author==null||LE01Stroke.IsEditing(author))return false;VoxelWorldFile world;if(!TryReadWorld(File.ReadAllText(path),out world)){Get(author).status="不是完整场景文件";return false;}return LoadWorld(author,world);
        }
        public static bool LoadWorld(LE01TerrainAuthor author,VoxelWorldFile world){if(author==null||world==null||world.schemaVersion!=1||LE01Stroke.IsEditing(author))return false;if(!Begin(author,world.layer,world.terrain,false))return false;return RequestEnd(author);}
    }
}
