using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public static class LE01CPerformance
    {
        [Serializable] class Metric { public string name; public int n, warmups; public double p50, p95, max; public List<double> samples = new List<double>(); }
        [Serializable] class Report
        {
            public string status = "FAIL", engine, utc, sourceHash, error;
            public string input = "24m diameter disc, q .125m, Base -3m, seed719; sculpt radius .65m at right wall, -.125m depth; changed-release ends latest -.225m command.";
            public string scope = "Actual Unity process and actual mesh uploads, 2 warmups + 10 samples. Input dispatch is synthetic. Timing excludes physical input queue, GUI display and GPU completion. P95 nearest-rank n10=max. Cold prepare n1 has no P95. Historical LE-01B P95 is not a same-session paired baseline; do not derive strict percentages from it.";
            public int leaves, derived, chunks, triangles;
            public List<Metric> metrics = new List<Metric>();
        }
        static double Percent(List<double> values, double p) { var sorted = values.OrderBy(v => v).ToArray(); return Math.Round(sorted[Math.Max(0, (int)Math.Ceiling(sorted.Length * p) - 1)], 3); }
        static void Add(Report report, string name, List<double> values, int warmups = 2)
        {
            report.metrics.Add(new Metric { name = name, n = values.Count, warmups = warmups, p50 = Percent(values, .5), p95 = values.Count >= 10 ? Percent(values, .95) : -1, max = Math.Round(values.Max(), 3), samples = values });
        }
        static void Require(bool value, string reason) { if (!value) throw new Exception(reason); }
        static LE01Stroke Begin(LE01TerrainAuthor a, SculptSelection selection)
        {
            var stroke = new LE01Stroke { Author = a, Mode = BrushMode.SculptDepth, Radius = .65f, SculptStrength = -.125f, Quantum = 2 };
            Require(stroke.BeginSculptSelection(selection, new Vector2(100, 100)), stroke.Status); return stroke;
        }
        static void WaitForActualUpload(LE01Stroke stroke)
        {
            var watch = Stopwatch.StartNew(); while (stroke.PreviewUploads == 0 && stroke.Active && watch.ElapsedMilliseconds < 10000) { stroke.Tick(); Thread.Sleep(2); }
            Require(stroke.PreviewUploads > 0 && stroke.Active, "actual preview did not upload before timeout");
        }
        public static void Run()
        {
            var report = new Report { engine = Application.unityVersion, utc = DateTime.UtcNow.ToString("O"), sourceHash = LE01BEvidence.SourceHash() };
            LE01Stroke active = null;
            try {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                var source = new TerrainDocument { Id = "B_Performance24", BaseHeight = -48, ActiveQuantum = 2, Seed = 719 };
                var brush = new TerrainCommand { Mode = BrushMode.Extend, Radius = 12, Quantum = 2, PlaneHeight = 0 }; brush.Path.Add(new Point2(0, 0));
                source = TerrainGenerators.UpgradeToV2(TerrainKernel.Apply(source, brush).Document); Require(source.Cells.Count == 28968, "benchmark differs from frozen author scale");
                var author = new GameObject("LE01C_Benchmark").AddComponent<LE01TerrainAuthor>(); author.Write(source);
                var initial = TerrainCompiler.Build(source); LE01Adapter.Upload(author, initial, true, true); report.leaves = source.Cells.Count; report.derived = initial.DerivedCells; report.chunks = initial.Chunks.Count; report.triangles = initial.Chunks.Sum(c => c.Triangles.Length / 3);
                var names = new[] { "seed-command-cpu", "seed-local-build-cpu", "sculpt-command-cpu", "sculpt-local-build-cpu", "prepare-or-reuse-cpu", "warm-selection-query-cpu", "synthetic-dispatch-to-first-actual-mesh-upload", "unchanged-release-to-final-commit", "changed-release-to-final-commit" };
                var rows = names.ToDictionary(n => n, n => new List<double>()); var cache = new LE01StructureSelectionCache(); var watch = new Stopwatch();
                for (int i = 0; i < 12; i++) {
                    author.Write(source.Copy()); LE01Adapter.Upload(author, initial, true, true);
                    var seed = new TerrainCommand { Mode = BrushMode.Reshape, Radius = .65f, Quantum = 2, Seed = 1847 + i }; seed.Path.Add(new Point2(11.8f, 0));
                    watch.Restart(); var seedResult = TerrainKernel.Apply(source, seed); watch.Stop(); Require(!seedResult.Rejected, seedResult.Message); double kernel = watch.Elapsed.TotalMilliseconds;
                    watch.Restart(); TerrainCompiler.Build(seedResult.Document, seedResult.DirtyBounds); watch.Stop(); double build = watch.Elapsed.TotalMilliseconds;
                    SurfaceHit hit; string message; Require(LE01Adapter.TryPickSculpt(author, new Ray(new Vector3(20, -1, 0), Vector3.left), out hit, out message), message);
                    watch.Restart(); var prepared = cache.Get(author); watch.Stop(); double prepare = watch.Elapsed.TotalMilliseconds;
                    if (i == 0) Add(report, "cold-prepare-one-observation-cpu", new List<double> { prepare }, 0);
                    watch.Restart(); var selection = prepared.ResolveHit(hit, .65f, SculptInfluence.LinkedColumn, -48, 0); watch.Stop(); double query = watch.Elapsed.TotalMilliseconds; Require(selection.Valid, selection.Message);
                    var sculpt = new TerrainCommand { Mode = BrushMode.SculptDepth, Selection = selection, Strength = -.125f, EditId = "C-bench" };
                    watch.Restart(); var sculptResult = TerrainKernel.Apply(source, sculpt); watch.Stop(); Require(!sculptResult.Rejected, sculptResult.Message); double sculptKernel = watch.Elapsed.TotalMilliseconds;
                    watch.Restart(); TerrainCompiler.Build(sculptResult.Document, sculptResult.DirtyBounds); watch.Stop(); double sculptBuild = watch.Elapsed.TotalMilliseconds;
                    watch.Restart(); active = Begin(author, selection); WaitForActualUpload(active); watch.Stop(); double preview = watch.Elapsed.TotalMilliseconds;
                    watch.Restart(); Require(active.End(), active.Status); watch.Stop(); double release = watch.Elapsed.TotalMilliseconds; active = null;
                    Require(author.Read().SculptOverrides.Count == 1 && author.Read().SculptOverrides[0].Value == -.125f, "unchanged release lost committed value");
                    author.Write(source.Copy()); LE01Adapter.Upload(author, initial, true, true); active = Begin(author, selection); WaitForActualUpload(active); active.DragSculpt(new Vector2(80, 100), true);
                    watch.Restart(); Require(active.End(), active.Status); watch.Stop(); double changed = watch.Elapsed.TotalMilliseconds; active = null;
                    Require(Mathf.Abs(author.Read().SculptOverrides[0].Value + .225f) < .00001f, "changed release lost latest command");
                    if (i >= 2) {
                        double[] values = { kernel, build, sculptKernel, sculptBuild, prepare, query, preview, release, changed };
                        for (int j = 0; j < names.Length; j++) rows[names[j]].Add(values[j]);
                    }
                }
                foreach (var name in names) Add(report, name, rows[name]); report.status = "PASS";
            } catch (Exception e) { report.error = e.ToString(); throw; }
            finally {
                if (active != null) active.Cancel();
                string root = Path.GetFullPath(Path.Combine(Application.dataPath, "../../../LE-01C/reports")); Directory.CreateDirectory(root); File.WriteAllText(Path.Combine(root, "unity-performance.json"), JsonUtility.ToJson(report, true));
            }
            UnityEngine.Debug.Log("LE01C_PERFORMANCE_COMPLETE");
        }
    }
}
