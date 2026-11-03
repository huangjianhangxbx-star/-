using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    // CLI evidence generator. Uses the same public controller as SceneView, never synthetic geometry.
    public static class LE01CEvidence
    {
        public const string ScenePath = "Assets/LE01C/Scenes/SteppedTerrace_719.unity";
        public const string SampleName = "SteppedTerrace_719";
        public static string Root { get { return LE01CEditorTests.Root; } }
        [Serializable] public sealed class Check { public string name, status, detail; }
        [Serializable] public sealed class Frame { public string image, stage, view; public int leaves, triangles, chunks, revision; public float[] bounds; }
        [Serializable] public sealed class WorkflowReport
        {
            public string engine, utc, sourceHash, status = "FAIL", authorHash, meshHash, native, scene = ScenePath, export;
            public string input = "Real production LE01Stroke commands and Unity Physics/meshes in background Editor; not physical mouse or GUI evidence.";
            public List<Check> checks = new List<Check>();
            public List<Frame> images = new List<Frame>();
        }
        static WorkflowReport report;
        static void BeginReport()
        {
            foreach (string directory in new[] { "reports", "samples", "samples/screenshots", "exports", "qa" }) Directory.CreateDirectory(Path.Combine(Root, directory));
            report = new WorkflowReport { engine = Application.unityVersion, utc = DateTime.UtcNow.ToString("O"), sourceHash = LE01BEvidence.SourceHash() };
        }
        static void Require(bool condition, string name, string detail = "")
        {
            report.checks.Add(new Check { name = name, status = condition ? "PASS" : "FAIL", detail = detail });
            Debug.Log("LE01C_WORKFLOW_" + (condition ? "PASS " : "FAIL ") + name + " " + detail);
            if (!condition) throw new InvalidOperationException(name + " " + detail);
        }
        static void WriteReport(string name)
        {
            File.WriteAllText(Path.Combine(Root, "reports/" + name + ".json"), JsonUtility.ToJson(report, true));
        }
        public static string MeshFingerprint(LE01TerrainAuthor author)
        {
            using (var stream = new MemoryStream()) using (var writer = new BinaryWriter(stream))
            {
                foreach (var filter in LE01Adapter.Geometry(author).GetComponentsInChildren<MeshFilter>().OrderBy(f => f.name, StringComparer.Ordinal))
                {
                    writer.Write(filter.name); var mesh = filter.sharedMesh;
                    writer.Write(mesh.vertexCount); foreach (var v in mesh.vertices) { writer.Write(v.x); writer.Write(v.y); writer.Write(v.z); }
                    foreach (var v in mesh.normals) { writer.Write(v.x); writer.Write(v.y); writer.Write(v.z); }
                    foreach (var uv in mesh.uv) { writer.Write(uv.x); writer.Write(uv.y); }
                    writer.Write(mesh.triangles.Length); foreach (var i in mesh.triangles) writer.Write(i);
                }
                writer.Flush(); using (var sha = System.Security.Cryptography.SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(stream.ToArray())).Replace("-", "");
            }
        }
        static LE01TerrainAuthor Blank()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            RenderSettings.ambientMode = AmbientMode.Flat; RenderSettings.ambientLight = new Color(.35f, .35f, .35f); RenderSettings.skybox = null; RenderSettings.fog = false;
            var key = new GameObject("LE01C_PreviewKey").AddComponent<Light>(); key.type = LightType.Directional; key.intensity = .9f; key.transform.rotation = Quaternion.Euler(35, -48, 0); key.shadows = LightShadows.Soft;
            var d = TerrainGenerators.UpgradeToV2(new TerrainDocument { Id = SampleName, Seed = 719, BaseHeight = -64, ActiveQuantum = 2, BrushRadius = 1.5f }); d.Id = SampleName;
            var a = new GameObject("LE01C_Terrain").AddComponent<LE01TerrainAuthor>(); a.Write(d); return a;
        }
        static void Extend(LE01TerrainAuthor a, string label, float radius, float height, params Vector3[] path)
        {
            var stroke = new LE01Stroke { Author = a, Mode = BrushMode.Extend, Radius = radius, Quantum = 2, PlaneHeight = TerrainUnits.ToUnits(height) };
            Require(stroke.Begin(path[0], 100), label + " begins"); foreach (var point in path.Skip(1)) stroke.Drag(point, 100);
            Require(stroke.End(), label + " commits", stroke.Status);
        }
        static void Raise(LE01TerrainAuthor a, string label, Vector3 point, float radius, float heightDelta)
        {
            var stroke = new LE01Stroke { Author = a, Mode = BrushMode.Raise, Radius = radius, Quantum = 2 };
            Require(stroke.Begin(point, 200), label + " begins"); stroke.Drag(point, 200 - heightDelta / .125f * 8);
            Require(stroke.End(), label + " commits", stroke.Status);
        }
        static SurfaceHit Pick(LE01TerrainAuthor a, float x = -1.2f, float y = -2)
        {
            SurfaceHit hit; string message;
            Require(LE01Adapter.TryPickSculpt(a, new Ray(a.transform.TransformPoint(new Vector3(x, y, -12)), Vector3.forward), out hit, out message), "visible front wall is pickable", message); return hit;
        }
        static LE01Stroke Sculpt(LE01TerrainAuthor a, BrushMode mode, float strength, SculptInfluence influence = SculptInfluence.LinkedColumn)
        {
            return new LE01Stroke { Author = a, Mode = mode, Radius = .65f, Quantum = 2, SculptStrength = strength, SculptScope = influence, SculptMinHeight = -48, SculptMaxHeight = -24 };
        }
        static void WaitPreview(LE01Stroke stroke)
        {
            var timer = System.Diagnostics.Stopwatch.StartNew(); int count = stroke.PreviewUploads;
            while (stroke.Active && stroke.PreviewUploads == count && timer.ElapsedMilliseconds < 10000) { stroke.Tick(); Thread.Sleep(3); }
            Require(stroke.Active && stroke.PreviewUploads > count, "real mesh preview uploads before release", "elapsed=" + timer.ElapsedMilliseconds + "ms; controlled background polling, not GUI latency");
        }
        static Bounds Bounds(LE01TerrainAuthor a) { return LE01Adapter.Bounds(a); }
        static void Capture(LE01TerrainAuthor a, Bounds bounds, string stage, string view = "oblique")
        {
            string relative = "samples/screenshots/" + SampleName + "-" + stage + "-" + view + ".png";
            var go = new GameObject("EvidenceCamera"); var camera = go.AddComponent<Camera>();
            var rt = new RenderTexture(1280, 960, 24, RenderTextureFormat.ARGB32); var texture = new Texture2D(1280, 960, TextureFormat.RGB24, false); var previous = RenderTexture.active;
            try
            {
                camera.orthographic = true; camera.clearFlags = CameraClearFlags.SolidColor; camera.backgroundColor = new Color(.16f, .18f, .20f);
                camera.transform.rotation = Quaternion.Euler(view == "side" ? 0 : 25, view == "side" ? 0 : -28, 0);
                camera.orthographicSize = Mathf.Max(bounds.size.y * .75f, bounds.size.x * .54f, bounds.size.z * .62f);
                camera.transform.position = bounds.center - camera.transform.forward * 40; camera.nearClipPlane = .1f; camera.farClipPlane = 100;
                camera.targetTexture = rt; camera.Render(); RenderTexture.active = rt; texture.ReadPixels(new Rect(0, 0, 1280, 960), 0, 0); texture.Apply(); File.WriteAllBytes(Path.Combine(Root, relative), texture.EncodeToPNG());
                var meshes = LE01Adapter.Geometry(a).GetComponentsInChildren<MeshFilter>(); var d = a.Read();
                report.images.Add(new Frame { image = relative, stage = stage, view = view, leaves = d.Cells.Count, triangles = meshes.Sum(m => m.sharedMesh.triangles.Length / 3), chunks = meshes.Length, revision = d.Revision, bounds = new[] { bounds.center.x, bounds.center.y, bounds.center.z, bounds.size.x, bounds.size.y, bounds.size.z } });
            }
            finally { RenderTexture.active = previous; UnityEngine.Object.DestroyImmediate(texture); UnityEngine.Object.DestroyImmediate(rt); UnityEngine.Object.DestroyImmediate(go); }
        }
        public static void BuildWorkflow()
        {
            BeginReport();
            try
            {
                var author = Blank(); Require(author.Read().Cells.Count == 0, "starts from empty v2 author");
                Extend(author, "lower terrace continuous brush", 3, 0, new Vector3(-3, 0, 0), new Vector3(3, 0, 0));
                Raise(author, "middle terrace", new Vector3(0, 0, .75f), 2.2f, 2);
                Raise(author, "upper terrace", new Vector3(0, 2, 1), 1.1f, 1);
                Extend(author, "front approach upper step", .65f, -.5f, new Vector3(2.25f, -.5f, -3.3f));
                Extend(author, "front approach middle step", .65f, -1, new Vector3(2.25f, -1, -3.95f));
                Extend(author, "front approach lower step", .65f, -1.5f, new Vector3(2.25f, -1.5f, -4.6f));
                LE01Adapter.SetGray(author, false); var bounds = Bounds(author); Capture(author, bounds, "01-terrain");
                string original = TerrainQueries.ContentHash(author.Read()), mesh = MeshFingerprint(author);
                var linked = Sculpt(author, BrushMode.SculptDepth, -.125f); Require(linked.BeginSculpt(Pick(author), new Vector2(100, 100)), "linked wall stroke begins"); linked.Command.EditId = "C-linked-depth";
                linked.DragSculpt(new Vector2(80, 100), true); WaitPreview(linked);
                Require(TerrainQueries.ContentHash(author.Read()) == original && MeshFingerprint(author) != mesh, "preview changes displayed geometry but leaves author frozen"); Capture(author, bounds, "02-preview");
                linked.Handle(LE01InputKind.Escape, Vector3.zero, 0); Require(TerrainQueries.ContentHash(author.Read()) == original && MeshFingerprint(author) == mesh, "controller Escape restores author and geometry");
                Require(linked.BeginSculpt(Pick(author), new Vector2(100, 100)), "linked wall begins again"); linked.Command.EditId = "C-linked-depth"; linked.DragSculpt(new Vector2(80, 100), true); Require(linked.End(), "linked depth commits");
                string committed = TerrainQueries.ContentHash(author.Read()); Undo.PerformUndo(); linked.UndoChanged(); Require(TerrainQueries.ContentHash(author.Read()) == original && MeshFingerprint(author) == mesh, "one Undo restores pre-stroke result");
                Undo.PerformRedo(); linked.UndoChanged(); Require(TerrainQueries.ContentHash(author.Read()) == committed, "one Redo restores sculpt intent"); Capture(author, bounds, "03-depth");
                var local = Sculpt(author, BrushMode.SculptDepth, -.125f, SculptInfluence.HeightRange); Require(local.BeginSculpt(Pick(author), new Vector2(100, 100)), "local height stroke begins"); local.Command.EditId = "C-local-depth"; Require(local.End(), "local height depth commits");
                var parents = TerrainCompiler.Build(author.Read()).Structures.Where(g => string.IsNullOrEmpty(g.ParentId)).Select(g => g.GroupId).OrderBy(g => g).ToArray();
                var density = Sculpt(author, BrushMode.SculptDensity, .75f, SculptInfluence.HeightRange); Require(density.BeginSculpt(Pick(author), new Vector2(100, 100)), "local density begins"); density.Command.EditId = "C-local-density"; Require(density.End(), "density commits");
                Require(parents.SequenceEqual(TerrainCompiler.Build(author.Read()).Structures.Where(g => string.IsNullOrEmpty(g.ParentId)).Select(g => g.GroupId).OrderBy(g => g)), "density preserves primary group identities"); Capture(author, bounds, "04-local-density");
                var protect = Sculpt(author, BrushMode.LockShape, 0); Require(protect.BeginSculpt(Pick(author), new Vector2(100, 100)), "shape lock begins"); protect.Command.EditId = "C-wall-lock"; Require(protect.End() && author.Read().ShapeLocks.Count > 0, "shape lock commits");
                var blocked = Sculpt(author, BrushMode.SculptDepth, -.25f); string locked = TerrainQueries.ContentHash(author.Read()); Require(blocked.BeginSculpt(Pick(author), new Vector2(100, 100)), "attempt locked sculpt begins"); Require(!blocked.End() && TerrainQueries.ContentHash(author.Read()) == locked, "locked wall refuses conflicting sculpt atomically");
                Raise(author, "compatible neighbor raise", new Vector3(3.2f, 0, .25f), .35f, .25f);
                Require(author.Read().SculptOverrides.Count == 3 && author.Read().ShapeLocks.Count > 0, "compatible edit keeps local sculpt and protection"); Capture(author, bounds, "05-final"); Capture(author, bounds, "05-final", "side");
                report.native = "samples/" + SampleName + ".leterrain.json"; report.export = "exports/" + SampleName + ".fbx";
                LE01Adapter.NativeSave(author, Path.Combine(Root, report.native)); Require(TerrainQueries.ContentHash(LE01Adapter.NativeLoad(Path.Combine(Root, report.native))) == TerrainQueries.ContentHash(author.Read()), "native round trip preserves complete editable intent");
                LE01Adapter.SaveSceneMeshes(author, ScenePath); report.authorHash = TerrainQueries.ContentHash(author.Read()); report.meshHash = MeshFingerprint(author);
                LE01Export.Export(LE01Adapter.Geometry(author), Path.Combine(Root, report.export)); Require(File.Exists(Path.Combine(Root, report.export)), "committed real geometry exports to FBX");
                report.status = "PASS";
            }
            catch (Exception e) { report.checks.Add(new Check { name = "uncaught", status = "FAIL", detail = e.ToString() }); throw; }
            finally { WriteReport("workflow-validation"); AssetDatabase.SaveAssets(); }
            Debug.Log("LE01C_WORKFLOW_COMPLETE");
        }
        public static void ReopenWorkflow()
        {
            var previous = JsonUtility.FromJson<WorkflowReport>(File.ReadAllText(Path.Combine(Root, "reports/workflow-validation.json"))); BeginReport();
            try
            {
                EditorSceneManager.OpenScene(ScenePath); var author = UnityEngine.Object.FindObjectOfType<LE01TerrainAuthor>();
                Require(author != null, "saved scene reopens with author component");
                var doc = LE01Adapter.NativeLoad(Path.Combine(Root, previous.native));
                Require(TerrainQueries.ContentHash(doc) == previous.authorHash && TerrainQueries.ContentHash(author.Read()) == previous.authorHash, "new process native and scene match saved author hash");
                Require(MeshFingerprint(author) == previous.meshHash, "new process saved real mesh arrays match");
                Require(doc.GeneratorVersion == "le01.2" && doc.SculptOverrides.Count == 3 && doc.ShapeLocks.Count > 0, "reopened sculpt and shape protection remain editable");
                var controller = new LE01Stroke { Author = author }; controller.ReplaceDocument(doc, "LE01C Reopen native author");
                string sculpt = string.Join("|", author.Read().SculptOverrides.Select(o => o.EditId + ":" + o.Value));
                Raise(author, "continued neighbor raise after reload", new Vector3(-3.2f, 0, .25f), .35f, .25f);
                Require(string.Join("|", author.Read().SculptOverrides.Select(o => o.EditId + ":" + o.Value)) == sculpt && author.Read().ShapeLocks.Count > 0, "continued editing retains sculpt records and locks");
                report.native = "samples/" + SampleName + "_continued.leterrain.json"; LE01Adapter.NativeSave(author, Path.Combine(Root, report.native));
                Require(TerrainQueries.ContentHash(LE01Adapter.NativeLoad(Path.Combine(Root, report.native))) == TerrainQueries.ContentHash(author.Read()), "continued edit saves and reloads");
                Capture(author, Bounds(author), "06-reopened-continued"); report.authorHash = TerrainQueries.ContentHash(author.Read()); report.meshHash = MeshFingerprint(author); report.status = "PASS";
            }
            catch (Exception e) { report.checks.Add(new Check { name = "uncaught", status = "FAIL", detail = e.ToString() }); throw; }
            finally { WriteReport("new-process-workflow"); }
            Debug.Log("LE01C_NEW_PROCESS_WORKFLOW_COMPLETE");
        }
    }
}
