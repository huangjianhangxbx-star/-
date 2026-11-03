using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace XingHai.LE01.Editor
{
    // Presentation only; applying a preset remains a validated author transaction in the window.
    public static class LE02PresetCards
    {
        static readonly Dictionary<string, Texture2D> thumbnails = new Dictionary<string, Texture2D>();
        static double nextMissingRefresh;
        public static void Draw(string[] ids, string[] names, string[] descriptions, ref string selected)
        {
            EditorGUILayout.LabelField("程序风格预设", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("选择轮廓和细节的规则组合。应用前可先查看缩略图，已有保形与手修会进行冲突检查。", MessageType.None);
            float width = Mathf.Max(130, (EditorGUIUtility.currentViewWidth - 34) / 2);
            bool refreshMissing = EditorApplication.timeSinceStartup >= nextMissingRefresh;
            if (refreshMissing) nextMissingRefresh = EditorApplication.timeSinceStartup + 1;
            for (int row = 0; row < ids.Length; row += 2)
            {
                EditorGUILayout.BeginHorizontal();
                for (int i = row; i < Mathf.Min(row + 2, ids.Length); i++)
                {
                    Texture2D thumbnail;
                    if (!thumbnails.TryGetValue(ids[i], out thumbnail) || thumbnail == null && refreshMissing) thumbnails[ids[i]] = thumbnail = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/LE02/Thumbnails/" + ids[i] + ".png");
                    EditorGUILayout.BeginVertical(GUILayout.Width(width));
                    var old = GUI.backgroundColor; if (selected == ids[i]) GUI.backgroundColor = new Color(.45f,.8f,.7f);
                    var content = thumbnail != null ? new GUIContent(thumbnail, names[i]) : new GUIContent(names[i], "缩略图尚未生成；仍可选择此规则预设");
                    if (GUILayout.Button(content, GUILayout.Width(width), GUILayout.Height(width * .68f))) selected = ids[i]; GUI.backgroundColor = old;
                    GUILayout.Label((selected == ids[i] ? "● " : "") + names[i], EditorStyles.boldLabel);
                    GUILayout.Label(descriptions[i], EditorStyles.wordWrappedMiniLabel);
                    EditorGUILayout.EndVertical();
                }
                EditorGUILayout.EndHorizontal(); GUILayout.Space(6);
            }
        }
    }
}
