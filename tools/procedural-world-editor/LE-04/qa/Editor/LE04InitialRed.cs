using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01;
using XingHai.LE01.Editor;

namespace XingHai.LE04.QA
{
    public static class LE04InitialRed
    {
        public static void Run()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var author = new GameObject("LE04_CapabilityFixture").AddComponent<LE01TerrainAuthor>();
            var runtime = typeof(LE01TerrainAuthor).Assembly.GetType("XingHai.LE01.LE04TerrainState");
            var session = typeof(LE01Window).Assembly.GetType("XingHai.LE01.Editor.LE04TerrainSession");
            var files = typeof(LE01Window).Assembly.GetType("XingHai.LE01.Editor.LE04TerrainFiles");
            bool anchor = session != null && session.GetMethod("BeginAnchor") != null;
            bool persistence = files != null && files.GetMethod("Save") != null;
            string report = "{\"anchorRoute\":" + anchor.ToString().ToLowerInvariant() + ",\"v2SceneState\":" + (runtime != null).ToString().ToLowerInvariant() + ",\"v2SaveRoute\":" + persistence.ToString().ToLowerInvariant() + "}";
            string folder = Environment.GetEnvironmentVariable("LE04_REPORT_ROOT");
            if (!string.IsNullOrEmpty(folder)) { Directory.CreateDirectory(folder); File.WriteAllText(Path.Combine(folder,"editor-capability-initial-red.json"),report); }
            if (!anchor || runtime == null || !persistence) throw new InvalidOperationException("LE04 behavior missing: visible-surface anchor transaction, v2 scene state and full v2 native save route must exist.");
            UnityEngine.Object.DestroyImmediate(author.gameObject);
        }
    }
}
