using System;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
namespace XingHai.BridgeReplica.Editor
{
    [InitializeOnLoad] public sealed class ReplicaSession
    {
        static readonly Dictionary<int,ReplicaSession> sessions=new Dictionary<int,ReplicaSession>();
        readonly ReplicaAuthor author;GameObject preview;ReplicaKit previewKit;
        public RouteResult Candidate {get;private set;}
        public RouteResult Committed {get;private set;}
        public string Status {get;private set;}
        public bool HasCandidate {get{return preview!=null&&Candidate!=null&&Candidate.Valid;}}
        public GameObject Geometry {get{var t=author.transform.Find("__RouteGeometry");return t==null?null:t.gameObject;}}
        static ReplicaSession(){Undo.undoRedoPerformed+=()=>{foreach(var pair in sessions.ToArray()){if(pair.Value.author==null){sessions.Remove(pair.Key);continue;}pair.Value.Rebuild();}};AssemblyReloadEvents.beforeAssemblyReload+=()=>{foreach(var s in sessions.Values.ToArray())s.Cancel();};}
        ReplicaSession(ReplicaAuthor value){author=value;var doc=author.Read();if(doc!=null)Committed=ReplicaRoute.Solve(doc);}
        public static ReplicaSession Get(ReplicaAuthor author){if(author==null)throw new ArgumentNullException("author");int id=author.GetInstanceID();ReplicaSession s;if(!sessions.TryGetValue(id,out s)||s.author!=author){s=new ReplicaSession(author);sessions[id]=s;}return s;}
        public bool Preview(RouteDocument document,ReplicaKit kit)
        {
            GameObject built=null;try
            {
                ReplicaKitRegistry.Validate(kit);if(document==null)throw new ArgumentNullException("document");var copy=document.Clone();copy.KitId=kit.Id;copy.KitVersion=kit.Version;var result=ReplicaRoute.Solve(copy);
                if(!result.Valid){Status=result.Message+"；保留上次有效预览。";return false;}
                // Validate and construct first. A rejected sample or missing source
                // must never remove the preceding visible, valid candidate.
                built=ReplicaGeometry.Build(result,kit);built.name="__RoutePreviewCandidate";built.hideFlags=HideFlags.DontSave;built.transform.SetParent(author.transform,false);foreach(var c in built.GetComponentsInChildren<Collider>())c.enabled=false;
                Cancel();built.name="__RoutePreview";preview=built;built=null;previewKit=kit;Candidate=result;if(Geometry!=null)Geometry.SetActive(false);Status="路线候选已更新；应用采用，Esc取消。";SceneView.RepaintAll();return true;
            }catch(Exception e){if(built!=null)ReplicaGeometry.Destroy(built);Status=e.Message+"；保留上次有效预览。";return false;}
        }
        public bool Apply(){return Commit(true);}
        public bool ApplyNew()
        {
            if(author.Read()!=null||Geometry!=null){Status="新建提交只适用于尚未提交的作者。";return false;}
            return Commit(false);
        }
        bool Commit(bool recordUndo)
        {
            if(!HasCandidate)return false;string map;var doc=Candidate.Document.Clone();doc.Revision=(author.Read()==null?0:author.Read().Revision)+1;Candidate.Document=doc.Clone();if(Candidate.Curve!=null)Candidate.Curve.Document=Candidate.Document;
            try{map=ReplicaGeometry.Mapping(Candidate,previewKit);}catch(Exception e){Status=e.Message+"；候选保持，请恢复素材后重试或取消。";return false;}
            int group=-1;if(recordUndo){Undo.IncrementCurrentGroup();group=Undo.GetCurrentGroup();Undo.SetCurrentGroupName("修改桥梁路线／套件");Undo.RecordObject(author,"修改桥梁路线／套件");}
            if(Geometry!=null)ReplicaGeometry.Destroy(Geometry);author.Write(doc);author.Kit=previewKit;author.MappingJson=map;preview.name="__RouteGeometry";preview.hideFlags=HideFlags.None;foreach(var c in preview.GetComponentsInChildren<Collider>())c.enabled=true;
            Committed=Candidate;preview=null;Candidate=null;previewKit=null;EditorUtility.SetDirty(author);EditorSceneManager.MarkSceneDirty(author.gameObject.scene);if(recordUndo){Undo.FlushUndoRecordObjects();Undo.CollapseUndoOperations(group);}Status="已采用整条路线；一次撤销恢复路线及套件。";SceneView.RepaintAll();return true;
        }
        public void Cancel(){if(preview!=null)ReplicaGeometry.Destroy(preview);preview=null;previewKit=null;Candidate=null;if(author!=null&&Geometry!=null)Geometry.SetActive(true);SceneView.RepaintAll();}
        public bool Rebuild()
        {
            Cancel();if(author==null||author.Read()==null||author.Kit==null)return false;
            try
            {
                var result=ReplicaRoute.Solve(author.Read());if(!result.Valid){Status=result.Message;return false;}
                // Source ranges are derived from the same layout as the mesh.
                // Rebuild (including native Undo/Redo) must also refresh an old
                // cache when a corrected corner split changes placement counts.
                string mapping=ReplicaGeometry.Mapping(result,author.Kit);var built=ReplicaGeometry.Build(result,author.Kit);
                if(Geometry!=null)ReplicaGeometry.Destroy(Geometry);built.transform.SetParent(author.transform,false);Committed=result;
                if(author.MappingJson!=mapping){author.MappingJson=mapping;EditorUtility.SetDirty(author);EditorSceneManager.MarkSceneDirty(author.gameObject.scene);}
                Status="已从已保存路线恢复。";return true;
            }catch(Exception e){Status=e.Message;return false;}
        }
    }
}
