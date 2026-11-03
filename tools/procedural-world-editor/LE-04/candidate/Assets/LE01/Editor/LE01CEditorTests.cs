using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    // These checks replay the production transaction boundary. They are not physical-input evidence.
    public static class LE01CEditorTests
    {
        [Serializable] public sealed class Check { public string name, status, detail; }
        [Serializable] public sealed class Report
        {
            public string engine, utc, sourceHash, status = "FAIL";
            public string input = "Production Unity controller/Physics replay; physical mouse and GUI pixels are separate evidence.";
            public List<Check> checks = new List<Check>();
            public int cases;
        }
        static Report report;
        public static string Root { get { return Path.Combine(Directory.GetParent(LE01Export.TaskRoot).FullName, "LE-01C"); } }
        static void Require(bool value, string name, string detail = "")
        {
            report.checks.Add(new Check { name = name, status = value ? "PASS" : "FAIL", detail = detail });
            Debug.Log("LE01C_EDITOR_" + (value ? "PASS " : "FAIL ") + name + " " + detail);
            if (!value) throw new InvalidOperationException(name + " " + detail);
        }
        static void Run(string filename, params Action[] cases)
        {
            report = new Report { engine = Application.unityVersion, utc = DateTime.UtcNow.ToString("O"), sourceHash = LE01BEvidence.SourceHash() };
            try { foreach (var test in cases) { test(); report.cases++; } report.status = "PASS"; }
            catch (Exception e) { report.checks.Add(new Check { name = "uncaught", status = "FAIL", detail = e.ToString() }); throw; }
            finally { Directory.CreateDirectory(Path.Combine(Root, "reports")); File.WriteAllText(Path.Combine(Root, "reports/" + filename + ".json"), JsonUtility.ToJson(report, true)); }
            Debug.Log("LE01C_EDITOR_TARGETED_COMPLETE " + filename);
        }
        public static void SceneSaveScopeRed() { Run("scene-save-scope", TestSceneScope); }
        public static void SceneIsolationRed() { Run("scene-isolation", TestSceneIsolation); }
        public static void RunTargeted() { Run("editor-targeted-validation", TestSceneScope, TestSceneIsolation, TestCancellationAndHistory, TestSaveGuards, TestStalePreview); }
        static LE01TerrainAuthor Fixture()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var d = TerrainGenerators.UpgradeToV2(new TerrainDocument { Id = "C_QA", BaseHeight = -64, ActiveQuantum = 2 });
            var command = new TerrainCommand { Mode = BrushMode.Extend, Radius = 2, Quantum = 2, PlaneHeight = 0 };
            command.Path.Add(new Point2(0, 0));
            var result = TerrainKernel.Apply(d, command);
            Require(!result.Rejected && result.Changed, "fixture generated from blank through public command");
            var author = new GameObject("LE01C_QA").AddComponent<LE01TerrainAuthor>();
            author.Write(result.Document); LE01Adapter.Upload(author, TerrainCompiler.Build(author.Read()), true, true); Physics.SyncTransforms(); return author;
        }
        static SurfaceHit Hit(LE01TerrainAuthor author)
        {
            SurfaceHit hit; string message;
            Require(LE01Adapter.TryPickSculpt(author, new Ray(new Vector3(0, -1.5f, -8), Vector3.forward), out hit, out message), "actual side-wall ray accepted", message); return hit;
        }
        static LE01Stroke Brush(LE01TerrainAuthor author) { return new LE01Stroke { Author = author, Mode = BrushMode.SculptDepth, Radius = .65f, SculptStrength = -.125f }; }
        static void TestSceneScope()
        {
            var author = Fixture();
            const string path = "Assets/LE01C/Scenes/SceneScopeProbe.unity";
            LE01Adapter.SaveSceneMeshes(author, path);
            Require(File.Exists(path), "v2 scene saves under LE01C Scenes");
            Require(LE01Adapter.Geometry(author).GetComponentsInChildren<MeshFilter>().All(f => AssetDatabase.GetAssetPath(f.sharedMesh).StartsWith("Assets/LE01C/Generated/", StringComparison.Ordinal)), "LE01C meshes use their own generated folder");
            bool denied = false;
            try { LE01Adapter.SaveSceneMeshes(author, "Assets/LE01/Scenes/C_MustNotWrite.unity"); } catch (InvalidOperationException) { denied = true; }
            Require(denied && !File.Exists("Assets/LE01/Scenes/C_MustNotWrite.unity"), "legacy scene location remains protected");
            denied = false;
            try { LE01Adapter.SaveSceneMeshes(author, "Assets/Unrelated/C_MustNotWrite.unity"); } catch (InvalidOperationException) { denied = true; }
            Require(denied && !File.Exists("Assets/Unrelated/C_MustNotWrite.unity"), "unrelated scene location remains protected");
        }
        static void TestSceneIsolation()
        {
            const string firstPath = "Assets/LE01C/Scenes/SceneIsolationProbe.unity", secondPath = "Assets/LE01C/WorkScenes/SceneIsolationProbe-Work.unity";
            var first = Fixture(); LE01Adapter.SaveSceneMeshes(first, firstPath); string firstHash = LE01CEvidence.MeshFingerprint(first);
            var firstMeshes = LE01Adapter.Geometry(first).GetComponentsInChildren<MeshFilter>().Select(f => AssetDatabase.GetAssetPath(f.sharedMesh)).ToArray();
            Require(firstMeshes.All(p => p.StartsWith("Assets/LE01C/Generated/Scenes/SceneIsolationProbe/", StringComparison.Ordinal)), "scene-owned generated assets follow relative scene path");
            // Save As copies serialized mesh references. The adapter must make them local to
            // the new scene even when a chunk is persistent and has not been regenerated.
            LE01Export.Folder("Assets/LE01C/WorkScenes"); EditorSceneManager.SaveScene(first.gameObject.scene, secondPath);
            var second = first; LE01Adapter.SaveSceneMeshes(second, secondPath);
            var secondMeshes = LE01Adapter.Geometry(second).GetComponentsInChildren<MeshFilter>().Select(f => AssetDatabase.GetAssetPath(f.sharedMesh)).ToArray();
            Require(!firstMeshes.Intersect(secondMeshes, StringComparer.OrdinalIgnoreCase).Any(), "Save As clones persistent meshes instead of sharing source scene assets");
            Require(secondMeshes.All(p => p.StartsWith("Assets/LE01C/Generated/WorkScenes/SceneIsolationProbe-Work/", StringComparison.Ordinal)), "work scene owns every generated chunk including unchanged chunks");
            var raise = new LE01Stroke { Author = second, Mode = BrushMode.Raise, Radius = .5f, Quantum = 2 };
            Require(raise.Begin(Vector3.zero, 100), "second same-ID scene edits begin"); raise.Drag(Vector3.zero, 84); Require(raise.End(), "second same-ID scene edits commit");
            LE01Adapter.SaveSceneMeshes(second, secondPath);
            secondMeshes = LE01Adapter.Geometry(second).GetComponentsInChildren<MeshFilter>().Select(f => AssetDatabase.GetAssetPath(f.sharedMesh)).ToArray();
            Require(!firstMeshes.Intersect(secondMeshes, StringComparer.OrdinalIgnoreCase).Any(), "same author ID across scenes cannot share mutable mesh assets");
            EditorSceneManager.OpenScene(firstPath); first = UnityEngine.Object.FindObjectOfType<LE01TerrainAuthor>();
            Require(LE01CEvidence.MeshFingerprint(first) == firstHash, "saving edited work scene preserves original scene geometry");
            foreach (string path in new[] { "Assets/LE01C/Scenes/../C_EscapeMustNotWrite.unity", "Assets/LE01C/Scenes/C_NotUnity.asset" })
            {
                bool denied = false; try { LE01Adapter.SaveSceneMeshes(first, path); } catch (InvalidOperationException) { denied = true; }
                Require(denied && !File.Exists(path), "invalid C scene path rejected before writing", path);
            }
        }
        static void TestCancellationAndHistory()
        {
            var author = Fixture(); string original = TerrainQueries.ContentHash(author.Read());
            foreach (var kind in new[] { LE01InputKind.Escape, LE01InputKind.FocusLost, LE01InputKind.ToolChanged, LE01InputKind.SceneClosed })
            {
                var stroke = Brush(author); Require(stroke.BeginSculpt(Hit(author), new Vector2(100, 100)), "begin before " + kind);
                stroke.DragSculpt(new Vector2(80, 100), true); stroke.Handle(kind, Vector3.zero, 0);
                Require(!stroke.Active && !LE01Stroke.IsEditing(author) && TerrainQueries.ContentHash(author.Read()) == original, kind + " cancels author transaction");
            }
            var committed = Brush(author); Require(committed.BeginSculpt(Hit(author), new Vector2(100, 100)), "history stroke begins");
            committed.DragSculpt(new Vector2(80, 100), true); committed.DragSculpt(new Vector2(80, 100), true);
            Require(committed.End() && author.Read().SculptOverrides.Count == 1, "one release creates one persistent override");
            string changed = TerrainQueries.ContentHash(author.Read());
            Undo.PerformUndo(); committed.UndoChanged(); Require(TerrainQueries.ContentHash(author.Read()) == original, "single Undo restores author");
            Undo.PerformRedo(); committed.UndoChanged(); Require(TerrainQueries.ContentHash(author.Read()) == changed, "single Redo restores author");
            Require(committed.BeginSculpt(Hit(author), new Vector2(100, 100)), "replace-during-stroke begins");
            var replacement = author.Read(); replacement.Revision++; string error;
            Require(TerrainKernel.Validate(replacement, out error), "external replacement fixture remains valid", error);
            author.Write(replacement); committed.Tick();
            Require(!committed.Active && !LE01Stroke.IsEditing(author) && author.Read().Revision == replacement.Revision && TerrainQueries.ContentHash(author.Read()) == changed, "valid author replacement cancels obsolete transaction and preserves sculpt content");
        }
        static void TestSaveGuards()
        {
            var author = Fixture(); string path = Path.Combine(Root, "qa/save-guard.leterrain.json"); Directory.CreateDirectory(Path.GetDirectoryName(path));
            LE01Adapter.NativeSave(author, path); string original = File.ReadAllText(path);
            var stroke = Brush(author); Require(stroke.BeginSculpt(Hit(author), new Vector2(100, 100)), "active save guard begins");
            bool denied = false; try { LE01Adapter.NativeSave(author, path); } catch (InvalidOperationException) { denied = true; }
            Require(denied && File.ReadAllText(path) == original, "active stroke save rejected without replacing native");
            string fbx = Path.Combine(Root, "qa/must-not-export-active.fbx"); denied = false;
            try { LE01Export.Export(LE01Adapter.Geometry(author), fbx); } catch (InvalidOperationException) { denied = true; }
            Require(denied && !File.Exists(fbx), "active stroke export rejected before creating FBX"); stroke.Cancel();
            author.transform.localScale = new Vector3(2, 1, 1); denied = false;
            try { LE01Adapter.NativeSave(author, path); } catch (InvalidOperationException) { denied = true; }
            Require(denied && File.ReadAllText(path) == original, "invalid transform save preserves prior native"); author.transform.localScale = Vector3.one;
            var d = author.Read(); d.Id += "_later"; author.Write(d); LE01Adapter.NativeSave(author, path);
            Require(File.ReadAllText(path + ".bak") == original && TerrainQueries.ContentHash(LE01Adapter.NativeLoad(path)) == TerrainQueries.ContentHash(author.Read()), "overwrite keeps backup and reloads latest author");
        }
        static void TestStalePreview()
        {
            var author = Fixture(); var hit = Hit(author); int evaluation = 0;
            Func<TerrainDocument, TerrainCommand, TerrainResult> delayed = (d, c) => { if (Interlocked.Increment(ref evaluation) == 1) { Thread.Sleep(80); throw new InvalidOperationException("controlled old failure"); } return TerrainKernel.Apply(d, c); };
            var stroke = new LE01Stroke(delayed) { Author = author, Mode = BrushMode.SculptDepth, Radius = .65f, SculptStrength = -.125f };
            Require(stroke.BeginSculpt(hit, new Vector2(100, 100)), "obsolete task begins"); stroke.Tick(); stroke.Cancel();
            Require(stroke.BeginSculpt(hit, new Vector2(100, 100)), "new transaction begins before obsolete completion");
            var watch = System.Diagnostics.Stopwatch.StartNew(); while (stroke.PreviewUploads == 0 && watch.ElapsedMilliseconds < 5000) { stroke.Tick(); Thread.Sleep(5); }
            Require(stroke.Active && stroke.PreviewUploads > 0, "obsolete task error cannot cancel newer transaction");
            string original = TerrainQueries.ContentHash(author.Read()); stroke.Cancel(); int uploads = stroke.PreviewUploads;
            for (int i = 0; i < 30; i++) { stroke.Tick(); Thread.Sleep(5); }
            Require(!stroke.Active && stroke.PreviewUploads == uploads && TerrainQueries.ContentHash(author.Read()) == original, "late completion cannot upload or commit after cancel");
        }
    }
}
