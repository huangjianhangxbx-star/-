using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    // Research-only entry points. No automatic startup, no physical-input claims.
    public static class LE02EditorTests
    {
        [Serializable] sealed class Check { public string name, status, detail; }
        [Serializable] sealed class Report { public string engine, utc, sourceHash, status = "PASS"; public List<Check> checks = new List<Check>(); }
        static Report report;
        static void Require(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
        static LE01TerrainAuthor Fixture()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var d = TerrainGenerators.UpgradeToV2(new TerrainDocument { Id = "LE02_surface_fixture", BaseHeight = -64, ActiveQuantum = 2 });
            var c = new TerrainCommand { Mode = BrushMode.Extend, Radius = 2, Quantum = 2, PlaneHeight = 0 }; c.Path.Add(new Point2(0, 0));
            var result = TerrainKernel.Apply(d, c); Require(result.Changed && !result.Rejected, "fixture is real terrain");
            var a = new GameObject("LE02_SurfaceFixture").AddComponent<LE01TerrainAuthor>(); a.Write(result.Document); LE01Adapter.Upload(a, TerrainCompiler.Build(a.Read()), true, true); Physics.SyncTransforms(); return a;
        }
        static MethodInfo SurfacePicker()
        {
            var method = typeof(LE01Adapter).GetMethod("TryPickSurface", BindingFlags.Static | BindingFlags.Public);
            Require(method != null, "nearest actual surface picker exists"); return method;
        }
        static bool Pick(MethodInfo picker, LE01TerrainAuthor a, Ray ray, out SurfaceHit hit)
        {
            object[] args = { a, ray, null, null }; bool ok = (bool)picker.Invoke(null, args); hit = ok ? (SurfaceHit)args[2] : new SurfaceHit(); return ok;
        }
        static void ActualSurfaceAndOcclusion()
        {
            var a = Fixture(); a.transform.position = new Vector3(3.25f, 2, -4.5f); Physics.SyncTransforms(); var picker = SurfacePicker();
            SurfaceHit hit; Require(Pick(picker, a, new Ray(a.transform.TransformPoint(new Vector3(0, 6, 0)), Vector3.down), out hit), "visible actual top is picked");
            Require(Mathf.Abs(hit.Y) < .0001f && hit.NormalY > .9f, "top cursor remains on local model y0, independent of working plane");
            var blocker = GameObject.CreatePrimitive(PrimitiveType.Cube); blocker.transform.position = a.transform.TransformPoint(new Vector3(0, 3, 0)); Physics.SyncTransforms();
            Require(!Pick(picker, a, new Ray(a.transform.TransformPoint(new Vector3(0, 6, 0)), Vector3.down), out hit), "foreground prop blocks terrain cursor instead of click-through");
            UnityEngine.Object.DestroyImmediate(blocker);
        }
        static void RepeatedMissUsesCache()
        {
            var a = Fixture(); var type = typeof(LE01Window).Assembly.GetType("XingHai.LE01.Editor.LE02SurfaceHoverCache");
            Require(type != null, "hover state caches hits and misses");
            var resolve = type.GetMethod("Resolve", new[] { typeof(LE01TerrainAuthor), typeof(Ray), typeof(bool), typeof(bool) }); Require(resolve != null, "hover resolve input seam exists");
            var count = typeof(LE01Adapter).GetProperty("SurfaceQueryCount", BindingFlags.Static | BindingFlags.Public); Require(count != null, "actual query diagnostic is available");
            var hover = Activator.CreateInstance(type); var ray = new Ray(new Vector3(100, 10, 100), Vector3.up);
            Require(!(bool)resolve.Invoke(hover, new object[] { a, ray, false, false }), "empty-space hover has no surface"); long first = Convert.ToInt64(count.GetValue(null));
            for (int i = 0; i < 20; i++) Require(!(bool)resolve.Invoke(hover, new object[] { a, ray, false, false }), "cached empty-space result remains a miss");
            Require(Convert.ToInt64(count.GetValue(null)) == first, "idle/layout reuse must not repeat Physics queries after a miss");
            resolve.Invoke(hover, new object[] { a, ray, false, true }); Require(Convert.ToInt64(count.GetValue(null)) == first + 1, "mouse down can explicitly refresh a cached miss");
        }
        static void MetadataRecoversOnceForColdMesh()
        {
            var a = Fixture();
            // A persisted scene reopens with Mesh instances not yet seen by the adapter cache.
            // New instances here exercise that boundary without mutating any retained scene asset.
            foreach (var f in LE01Adapter.Geometry(a).GetComponentsInChildren<MeshFilter>()) { var clone = UnityEngine.Object.Instantiate(f.sharedMesh); clone.name = f.sharedMesh.name; f.sharedMesh = clone; f.GetComponent<MeshCollider>().sharedMesh = clone; }
            Physics.SyncTransforms();
            var field = typeof(SurfaceHit).GetField("BoundaryKey"); Require(field != null, "actual surface carries a stable author boundary key");
            var count = typeof(LE01Adapter).GetProperty("SurfaceMetadataBuildCount", BindingFlags.Static | BindingFlags.Public); Require(count != null, "cold metadata preparation is measured");
            long before = Convert.ToInt64(count.GetValue(null)); SurfaceHit hit; string message;
            Require(LE01Adapter.TryPickSculpt(a, new Ray(new Vector3(0, -1.5f, -8), Vector3.forward), out hit, out message), "cold actual side mesh is selectable: " + message);
            Require(!string.IsNullOrEmpty((string)field.GetValue(hit)), "cold mesh recovers actual triangle to author boundary mapping");
            var selection = TerrainStructures.ResolveHit(a.Read(), hit, .65f, SculptInfluence.LinkedColumn, -64, 0); Require(selection.Valid, "carved visible face resolves to its author structure");
            long prepared = Convert.ToInt64(count.GetValue(null)); Require(prepared == before + 1, "first cold side hit prepares metadata once");
            Require(LE01Adapter.TryPickSculpt(a, new Ray(new Vector3(.1f, -1.5f, -8), Vector3.forward), out hit, out message), "another side hit remains selectable");
            Require(Convert.ToInt64(count.GetValue(null)) == prepared, "second side hit reuses metadata instead of compiling terrain again");
        }
        static void CancelRestoresCommittedMeshes()
        {
            var a = Fixture(); var capture = typeof(LE01Adapter).GetMethod("CaptureCommitted"); var restore = typeof(LE01Adapter).GetMethod("RestoreCommitted");
            Require(capture != null && restore != null, "committed mesh snapshot supports cheap cancellation");
            var filters = LE01Adapter.Geometry(a).GetComponentsInChildren<MeshFilter>(); var original = new Dictionary<string, Mesh>(); foreach (var f in filters) original[f.name] = f.sharedMesh;
            capture.Invoke(null, new object[] { a }); var d = a.Read(); var c = new TerrainCommand { Mode = BrushMode.Raise, Radius = .5f, Quantum = 2, StartHeight = 0, TargetHeight = 4 }; c.Path.Add(new Point2(0, 0)); var result = TerrainKernel.Apply(d, c);
            LE01Adapter.Upload(a, TerrainCompiler.Build(result.Document, result.DirtyBounds), false);
            Require((bool)restore.Invoke(null, new object[] { a }), "committed mesh restoration succeeds");
            var restored = LE01Adapter.Geometry(a).GetComponentsInChildren<MeshFilter>(); Require(restored.Length == original.Count, "cancel restores every committed chunk and removes preview-only chunks");
            foreach (var pair in original) Require(pair.Value != null, "preview must not destroy committed mesh before cancellation");
            foreach (var f in restored) Require(original.ContainsKey(f.name) && f.sharedMesh == original[f.name] && f.GetComponent<MeshCollider>() != null && f.GetComponent<MeshCollider>().sharedMesh == original[f.name], "cancel restores original mesh references and collider without rebuilding geometry");
        }
        static void ValidAuthorChangeWithOldMesh()
        {
            var author = Fixture(); string originalMesh = LE01CEvidence.MeshFingerprint(author);
            var command = new TerrainCommand { Mode = BrushMode.Raise, Radius = 1.25f, Quantum = 2, StartHeight = 0, TargetHeight = 4 }; command.Path.Add(new Point2(0, 0));
            var result = TerrainKernel.Apply(author.Read(), command); Require(result.Changed && !result.Rejected, "changed author fixture is valid");
            author.Write(result.Document); string json = author.DocumentJson;
            Require(LE01CEvidence.MeshFingerprint(author) == originalMesh, "fixture deliberately retains stale nonempty meshes after author change");
            LE01Window.Open(); Require(LE01Window.Instance.PrepareWorkspace(false), "resume opens the edited author workspace");
            Require(LE01CEvidence.MeshFingerprint(author) != originalMesh && Mathf.Abs(LE01Adapter.Bounds(author).max.y - .25f) < .001f, "resume rebuilds stale nonempty meshes after a valid author change");
            Require(author.DocumentJson == json, "geometry recovery does not rewrite author intent");
            var matches = typeof(LE01Adapter).GetMethod("GeometryMatchesAuthor", BindingFlags.Static | BindingFlags.Public); Require(matches != null && (bool)matches.Invoke(null, new object[] { author }), "committed geometry stamp matches restored author");
        }
        public static void RunGeometryStampRed() { RunCases("geometry-stamp.json", new Action[] { ValidAuthorChangeWithOldMesh }); }
        public static void RunRed()
        {
            RunCases(Environment.GetEnvironmentVariable("LE02_EDITOR_REPORT") ?? "editor-surface-tests.json", new Action[] { ActualSurfaceAndOcclusion, RepeatedMissUsesCache, MetadataRecoversOnceForColdMesh, CancelRestoresCommittedMeshes, ValidAuthorChangeWithOldMesh });
        }
        static void RunCases(string filename, Action[] tests)
        {
            report = new Report { engine = Application.unityVersion, utc = DateTime.UtcNow.ToString("O"), sourceHash = LE01BEvidence.SourceHash() };
            foreach (var test in tests)
            {
                try { test(); report.checks.Add(new Check { name = test.Method.Name, status = "PASS", detail = "Actual Unity mesh/Physics and production state; not physical mouse." }); }
                catch (Exception error) { report.status = "FAIL"; report.checks.Add(new Check { name = test.Method.Name, status = "FAIL", detail = error.GetBaseException().Message }); }
            }
            string root = Path.GetFullPath(Path.Combine(Application.dataPath, "../../../LE-02/reports")); Directory.CreateDirectory(root); File.WriteAllText(Path.Combine(root, filename), JsonUtility.ToJson(report, true));
            if (report.status != "PASS") throw new InvalidOperationException("LE02 surface/interaction checks failed; inspect LE-02/reports");
            Debug.Log("LE02_EDITOR_SURFACE_COMPLETE");
        }
    }
}
