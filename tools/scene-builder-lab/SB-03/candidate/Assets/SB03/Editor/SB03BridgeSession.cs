using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace XingHai.SB03.Editor
{
    [InitializeOnLoad]
    public sealed class SB03BridgeSession
    {
        static readonly Dictionary<int,SB03BridgeSession> sessions=new Dictionary<int,SB03BridgeSession>();
        readonly SB03BridgeAuthor author;
        GameObject candidate;
        public BridgePlan PreviewPlan {get;private set;}
        public BridgePlan LastPlan {get;private set;}
        public BridgeSpec CurrentSpec {get{return author.Spec.Clone();}}
        public string Status {get;private set;}
        public bool HasCandidate {get{return candidate!=null&&PreviewPlan!=null&&PreviewPlan.Valid;}}
        static SB03BridgeSession()
        {
            Undo.undoRedoPerformed+=()=>{foreach(var s in sessions.Values.ToArray())if(s.author!=null){s.Cancel();s.Rebuild();}};
            AssemblyReloadEvents.beforeAssemblyReload+=()=>{foreach(var s in sessions.Values.ToArray())s.Cancel();};
            EditorSceneManager.sceneSaving+=(scene,path)=>{foreach(var a in UnityEngine.Object.FindObjectsOfType<SB03BridgeAuthor>())if(a.gameObject.scene==scene)Get(a).Cancel();};
        }
        SB03BridgeSession(SB03BridgeAuthor value){author=value;LastPlan=BridgeSolver.Solve(author.Spec);}
        public static SB03BridgeSession Get(SB03BridgeAuthor author)
        {
            if(author==null)throw new ArgumentNullException("author");int id=author.GetInstanceID();SB03BridgeSession s;
            if(!sessions.TryGetValue(id,out s)||s.author!=author){s=new SB03BridgeSession(author);sessions[id]=s;}return s;
        }
        GameObject Committed {get{var t=author.transform.Find("__SB03_Generated");return t==null?null:t.gameObject;}}
        public bool Preview(BridgeSpec spec)
        {
            var plan=BridgeSolver.Solve(spec);Cancel();PreviewPlan=plan;
            if(!plan.Valid){Status=plan.Message;return false;}
            try
            {
                candidate=SB03BridgeGeometry.Build(plan);candidate.name="__SB03_Preview";candidate.hideFlags=HideFlags.DontSave;
                candidate.transform.SetParent(author.transform,false);
                foreach(var c in candidate.GetComponentsInChildren<Collider>())c.enabled=false;
                var current=Committed;if(current!=null)current.SetActive(false);Status="候选已更新；应用提交，Esc取消。";SceneView.RepaintAll();return true;
            }
            catch(Exception e){PreviewPlan=null;Status=e.Message;return false;}
        }
        public bool Apply()
        {
            if(!HasCandidate)return false;
            var plan=PreviewPlan;
            // Compute all source metadata before changing either committed data or geometry.
            string sourceMap;try{sourceMap=SB03BridgeGeometry.SourceMap(plan);}catch(Exception e){Status=e.Message;Cancel();return false;}
            Undo.RecordObject(author,"修改阶梯石拱桥");author.Spec=plan.Spec.Clone();author.SourceMapJson=sourceMap;author.Revision++;
            var current=Committed;if(current!=null)SB03BridgeGeometry.DestroyGeometry(current);
            candidate.name="__SB03_Generated";candidate.hideFlags=HideFlags.None;
            foreach(var c in candidate.GetComponentsInChildren<Collider>())c.enabled=true;
            candidate=null;LastPlan=plan;PreviewPlan=null;EditorUtility.SetDirty(author);EditorSceneManager.MarkSceneDirty(author.gameObject.scene);
            Status="已提交整桥；一次撤销恢复上一个设计。";SceneView.RepaintAll();return true;
        }
        public void Cancel()
        {
            if(candidate!=null)SB03BridgeGeometry.DestroyGeometry(candidate);candidate=null;PreviewPlan=null;
            if(author==null)return;var current=Committed;if(current!=null)current.SetActive(true);SceneView.RepaintAll();
        }
        public bool Rebuild()
        {
            Cancel();var plan=BridgeSolver.Solve(author.Spec);if(!plan.Valid){Status=plan.Message;return false;}
            try
            {
                var generated=SB03BridgeGeometry.Build(plan);generated.transform.SetParent(author.transform,false);
                var old=author.transform.Cast<Transform>().FirstOrDefault(t=>t.gameObject!=generated&&t.name=="__SB03_Generated");if(old!=null)SB03BridgeGeometry.DestroyGeometry(old.gameObject);
                LastPlan=plan;Status="已从整桥作者恢复构件。";return true;
            }catch(Exception e){Status=e.Message;return false;}
        }
    }
}
