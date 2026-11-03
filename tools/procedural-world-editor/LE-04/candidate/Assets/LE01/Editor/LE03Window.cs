using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public sealed partial class LE01Window
    {
        void DrawRuleControls()
        {
            if(Current.GeneratorVersion!="le01.3")return;
            EditorGUILayout.LabelField("结构规则",Current.RockRuleVersion==1?"主形与疏密组织":"原有规则 · 保持现状");
            if(Current.RockRuleVersion==0)
            {
                EditorGUILayout.HelpBox("局部选面可直接用于当前作品。新造型规则与方向坡形需另存候选；已有手修或保护的作品请保留，在未手修副本上采用。",MessageType.Info);
                using(new EditorGUI.DisabledScope(EditorBusy))if(GUILayout.Button("采用新结构规则，并另存候选…"))AdoptRulesCandidate();
            }
        }
        void DrawThemeControls()
        {
            if(Current.GeneratorVersion!="le01.3")return;
            using(new EditorGUI.DisabledScope(EditorBusy))
            {
                int current=Current.TerrainThemeId=="snow-rock"?1:0;
                int next=EditorGUILayout.Popup("基础材质主题",current,new[]{"石岩","雪岩 · 自动露顶雪"});
                if(next!=current)ApplyTerrainTheme(next==1?"snow-rock":"stone");
            }
        }
        public bool ApplyTerrainTheme(string id)
        {
            if(stroke.Author==null||EditorBusy)return false;
            var result=TerrainRuleStyles.Theme(Current,id);
            if(result.Rejected||!result.Changed){stroke.Status=result.Message;return false;}
            WriteBrushParameters(result.Document);
            string error;if(!TerrainKernel.Validate(result.Document,out error)){stroke.Status="当前画笔参数无效，请先修正平面高度与范围。";return false;}
            stroke.ReplaceDocument(result.Document,"改变基础材质主题");surfaceHover.Invalidate();hoverSelection=null;Repaint();return true;
        }
        void AdoptRulesCandidate()
        {
            if(stroke.Author==null||EditorBusy)return;
            try
            {
                var result=TerrainRuleStyles.Adopt(Current);
                if(result.Rejected||!result.Changed){stroke.Status=result.Rejected?"当前作品不能直接采用新规则：请保留已有手修与保护，在未手修副本上另存候选。":result.Message;return;}
                string path=EditorUtility.SaveFilePanel("另存新结构规则候选，保留原作品",Path.Combine(LE01CStart.CurrentRoot,"samples"),result.Document.Id+".leterrain","json");
                if(string.IsNullOrEmpty(path)||!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return;
                var origin=stroke.Author.transform.position;result.Document.OriginX=origin.x;result.Document.OriginY=origin.y;result.Document.OriginZ=origin.z;
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
                var author=new GameObject("LE03_Terrain").AddComponent<LE01TerrainAuthor>();author.Write(result.Document);author.transform.position=origin;stroke.Author=author;stroke.UndoChanged();
                stroke.SculptScope=SculptInfluence.LocalSurface;stroke.SculptMinHeight=result.Document.BaseHeight;stroke.SculptMaxHeight=result.Document.ActivePlaneHeight;EnsurePreviewLight();
                LE01Adapter.NativeSave(author,path);LE01Export.Folder("Assets/LE03/WorkScenes");
                LE01Adapter.SaveSceneMeshes(author,AssetDatabase.GenerateUniqueAssetPath("Assets/LE03/WorkScenes/"+result.Document.Id+".unity"));
                PrepareWorkspace(false);stroke.Status="已另存新结构规则候选；原作者文件与场景保持";
            }
            catch(Exception error){ShowFailure(error);}
        }
        void WriteBrushParameters(TerrainDocument document)
        {
            document.ActivePlaneHeight=stroke.PlaneHeight;document.ActiveQuantum=stroke.Quantum;document.BrushRadius=stroke.Radius;
            if(!document.Planes.Any(plane=>plane.Height==document.ActivePlaneHeight))document.Planes.Add(new WorkPlane{Id="p"+document.ActivePlaneHeight,Height=document.ActivePlaneHeight});
            if(document.RockRuleVersion==1){document.HeightBrushForm=stroke.HeightForm;document.HeightBrushRotation=stroke.RotationDegrees;document.HeightBrushAspect=stroke.AspectRatio;}
        }
    }
}
