using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public static class LE01CPerfEditorTests
    {
        [Serializable] class Check { public string name, status, detail; }
        [Serializable] class Report { public string engine, utc, status; public List<Check> checks = new List<Check>(); }
        static void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
        static LE01TerrainAuthor Fixture()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var d = new TerrainDocument { Id = "C-release-fixture", GeneratorVersion = "le01.2", BaseHeight = -48, ActiveQuantum = 4 };
            for (int z = -16; z < 16; z += 4) for (int x = -16; x < 16; x += 4) d.Cells.Add(new TerrainCell { X = x, Z = z, Size = 4, Top = 0, PlaneId = "p0" });
            var a = new GameObject("C_ReleaseFixture").AddComponent<LE01TerrainAuthor>(); a.Write(d); LE01Adapter.Upload(a, TerrainCompiler.Build(d), true, true); return a;
        }
        static SculptSelection Selection(LE01TerrainAuthor a) { var s = TerrainStructures.ResolveHit(a.Read(), new SurfaceHit(0, -1, -1, 0, 0, -1), .65f, SculptInfluence.LinkedColumn, -48, 0); Require(s.Valid, s.Message); return s; }
        static void WaitForPreview(LE01Stroke stroke)
        {
            var t = System.Diagnostics.Stopwatch.StartNew(); while (stroke.Active && stroke.PreviewUploads == 0 && t.ElapsedMilliseconds < 5000) { stroke.Tick(); Thread.Sleep(2); }
            Require(stroke.PreviewUploads > 0, "actual preview never uploaded");
        }
        static void LatestPreviewRelease()
        {
            var a = Fixture(); int count = 0;
            var stroke = new LE01Stroke((d, c) => { Interlocked.Increment(ref count); return TerrainKernel.Apply(d, c); }) { Author = a, Mode = BrushMode.SculptDepth, SculptStrength = -.125f };
            try {
                Require(stroke.BeginSculptSelection(Selection(a), new Vector2(100, 100)), stroke.Status); WaitForPreview(stroke); int before = count;
                Require(stroke.End(), "release did not commit");
                Require(a.Read().SculptOverrides.Count == 1 && a.Read().SculptOverrides[0].Value == -.125f, "release changed accepted author intent");
                Require(count == before, "unchanged completed preview was evaluated again on release");
                Require(a.GetComponentsInChildren<MeshCollider>().Length > 0, "reused release failed to restore colliders");
            } finally { stroke.Cancel(); }
        }
        static void ChangedCommandRelease()
        {
            var a = Fixture(); int count = 0;
            var stroke = new LE01Stroke((d, c) => { Interlocked.Increment(ref count); return TerrainKernel.Apply(d, c); }) { Author = a, Mode = BrushMode.SculptDepth, SculptStrength = -.125f };
            try {
                Require(stroke.BeginSculptSelection(Selection(a), new Vector2(100, 100)), stroke.Status); WaitForPreview(stroke); int before = count;
                stroke.DragSculpt(new Vector2(80, 100), true); Require(stroke.End(), "changed command release did not commit");
                Require(count == before + 1, "release failed to evaluate latest changed command");
                Require(Mathf.Abs(a.Read().SculptOverrides[0].Value + .225f) < .00001f, "release reused stale preview instead of latest strength");
            } finally { stroke.Cancel(); }
        }
        static void DirectMutationRelease()
        {
            var a = Fixture(); int count = 0;
            var stroke = new LE01Stroke((d, c) => { Interlocked.Increment(ref count); return TerrainKernel.Apply(d, c); }) { Author = a, Mode = BrushMode.SculptDepth, SculptStrength = -.125f };
            try {
                Require(stroke.BeginSculptSelection(Selection(a), new Vector2(100, 100)), stroke.Status); WaitForPreview(stroke); int before = count;
                // Command is a public mutable object: no Drag/Request accompanies these changes.
                stroke.Command.Strength = -.375f; stroke.Command.EditId = "C-direct-mutated";
                Require(stroke.End(), "direct mutation did not commit");
                Require(count == before + 1, "direct mutation reused stale completed preview");
                Require(a.Read().SculptOverrides[0].Value == -.375f && a.Read().SculptOverrides[0].EditId == "C-direct-mutated", "direct mutation lost author values");
            } finally { stroke.Cancel(); }
        }
        public static void Run()
        {
            var report = new Report { engine = Application.unityVersion, utc = DateTime.UtcNow.ToString("O"), status = "PASS" };
            var cases = new Action[] { LatestPreviewRelease, ChangedCommandRelease, DirectMutationRelease, LE01BEditorTests.ObsoleteFaultRed };
            foreach (var test in cases) {
                try { test(); report.checks.Add(new Check { name = test.Method.Name, status = "PASS", detail = "Actual Unity controller and mesh transaction; synthetic input, not physical GUI." }); }
                catch (Exception e) { report.status = "FAIL"; report.checks.Add(new Check { name = test.Method.Name, status = "FAIL", detail = e.Message }); }
            }
            string root = Path.GetFullPath(Path.Combine(Application.dataPath, "../../../LE-01C/reports")); Directory.CreateDirectory(root); File.WriteAllText(Path.Combine(root, "release-reuse.json"), JsonUtility.ToJson(report, true));
            if (report.status != "PASS") throw new Exception("LE01C release reuse checks failed; see LE-01C/reports/release-reuse.json");
            Debug.Log("LE01C_RELEASE_REUSE_COMPLETE");
        }
    }
}
