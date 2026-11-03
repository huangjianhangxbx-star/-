using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    // Explicitly started, observation-only recorder. It never sends input or changes tool state.
    public static class LE01CGuiEvidence
    {
        [Serializable] public sealed class State
        {
            public string author, scene, jsonSha256, status;
            public bool active, pending, editing;
            public int previewUploads, staleResults;
        }
        [Serializable] public sealed class InputObservation
        {
            public double seconds;
            public string phase, rawType, type, key, command;
            public int button, hotControl;
            public float x, y;
            public bool alt, control, shift;
            public State state;
        }
        [Serializable] public sealed class Snapshot
        {
            public double seconds;
            public string reason, authorContentHash, realMeshSha256, native, error;
            public int authorLeaves, sculptRecords, shapeLocks;
            public State state;
        }
        [Serializable] public sealed class Session
        {
            public string engine, utcStart, utcStop, sourceHash, stopReason;
            public string status = "RECORDING";
            public string method = "Observed actual SceneView raw events before/during callbacks, Undo callback and main-thread Editor update state. No input injection or production state mutation by this recorder.";
            public string boundary = "SceneView events only; keyboard input handled solely by another Editor window is not captured here. Event/result association only. Hashing and observation add overhead; timestamps are not latency/FPS or GUI P95 measurements. Computer-use screenshots are separate evidence. rawType alone does not distinguish human hardware from an authorized OS input tool.";
            public string physicalHeldEscape = "NOT_RUN: no physical held-mouse Escape proof is inferred from a drag or candidate Escape.";
            public bool eventLimitReached, snapshotLimitReached;
            public List<InputObservation> events = new List<InputObservation>();
            public List<Snapshot> snapshots = new List<Snapshot>();
        }
        static Session session;
        static double began, lastUpdate;
        static bool running, snapshotRequested;
        static string cachedJson, cachedJsonHash, signature;
        const int EventLimit = 2500, SnapshotLimit = 350;
        public static bool IsRecording { get { return running; } }
        public static string OutputPath { get { return Path.Combine(LE01CEditorTests.Root, "reports/gui-session.json"); } }
        static LE01Stroke Controller { get { return LE01Window.Instance == null ? null : LE01Window.Instance.Controller; } }
        static LE01TerrainAuthor Author { get { var c = Controller; return c != null && c.Author != null ? c.Author : UnityEngine.Object.FindObjectOfType<LE01TerrainAuthor>(); } }
        static string HashJson(string json)
        {
            if (!ReferenceEquals(cachedJson, json)) { cachedJson = json; using (var sha = SHA256.Create()) cachedJsonHash = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(json ?? ""))).Replace("-", ""); }
            return cachedJsonHash ?? "";
        }
        static State ReadState()
        {
            var c = Controller; var a = Author;
            return new State { author = a == null ? "" : a.name, scene = a == null ? SceneManager.GetActiveScene().path : a.gameObject.scene.path, jsonSha256 = a == null ? "" : HashJson(a.DocumentJson), status = c == null ? "No open terrain window" : c.Status, active = c != null && c.Active, pending = c != null && c.PendingConfirmation, editing = a != null && LE01Stroke.IsEditing(a), previewUploads = c == null ? 0 : c.PreviewUploads, staleResults = c == null ? 0 : c.StaleResults };
        }
        [MenuItem("星骸/LE-01C/验收/开始 GUI 记录")]
        public static void Start()
        {
            if (running) { Debug.LogWarning("LE01C_GUI_ALREADY_RECORDING"); return; }
            cachedJson = cachedJsonHash = signature = null; began = EditorApplication.timeSinceStartup; lastUpdate = began;
            session = new Session { engine = Application.unityVersion, utcStart = DateTime.UtcNow.ToString("O"), sourceHash = LE01BEvidence.SourceHash() };
            running = true; snapshotRequested = false;
            SceneView.beforeSceneGui += BeforeScene; SceneView.duringSceneGui += DuringScene; EditorApplication.update += Update;
            Undo.undoRedoPerformed += OnUndo; AssemblyReloadEvents.beforeAssemblyReload += OnReload; EditorApplication.quitting += OnQuit;
            Capture("start"); Write(); Debug.Log("LE01C_GUI_RECORDING_STARTED " + OutputPath);
        }
        [MenuItem("星骸/LE-01C/验收/结束 GUI 记录")]
        public static void Stop() { StopWithReason("menu-stop"); }
        static void OnReload() { StopWithReason("assembly-reload"); }
        static void OnQuit() { StopWithReason("editor-quit"); }
        static void StopWithReason(string reason)
        {
            if (!running) { Debug.LogWarning("LE01C_GUI_NOT_RECORDING"); return; }
            Capture(reason); running = false;
            SceneView.beforeSceneGui -= BeforeScene; SceneView.duringSceneGui -= DuringScene; EditorApplication.update -= Update;
            Undo.undoRedoPerformed -= OnUndo; AssemblyReloadEvents.beforeAssemblyReload -= OnReload; EditorApplication.quitting -= OnQuit;
            session.utcStop = DateTime.UtcNow.ToString("O"); session.stopReason = reason; session.status = "CAPTURED_NOT_AN_AUTOMATIC_PASS";
            Write(); Debug.Log("LE01C_GUI_RECORDING_SAVED " + OutputPath);
        }
        static void BeforeScene(SceneView view) { Observe("beforeSceneGui"); }
        static void DuringScene(SceneView view) { Observe("duringSceneGui"); }
        static void Observe(string phase)
        {
            if (!running || Event.current == null) return;
            var e = Event.current; var raw = e.rawType;
            if (raw != EventType.MouseDown && raw != EventType.MouseDrag && raw != EventType.MouseUp && raw != EventType.KeyDown && raw != EventType.ValidateCommand && raw != EventType.ExecuteCommand) return;
            if (session.events.Count >= EventLimit) { session.eventLimitReached = true; return; }
            session.events.Add(new InputObservation { seconds = EditorApplication.timeSinceStartup - began, phase = phase, rawType = raw.ToString(), type = e.type.ToString(), key = e.keyCode.ToString(), command = e.commandName, button = e.button, hotControl = GUIUtility.hotControl, x = e.mousePosition.x, y = e.mousePosition.y, alt = e.alt, control = e.control, shift = e.shift, state = ReadState() });
            // Defer expensive mesh hashing until an Editor update, outside the input callbacks.
            if (raw == EventType.MouseDown || raw == EventType.MouseUp || raw == EventType.KeyDown || raw == EventType.ExecuteCommand) snapshotRequested = true;
        }
        static void OnUndo()
        {
            if (!running) return; snapshotRequested = true;
            if (session.events.Count < EventLimit) session.events.Add(new InputObservation { seconds = EditorApplication.timeSinceStartup - began, phase = "Undo.undoRedoPerformed", rawType = "UndoRedoCallback", state = ReadState() });
            else session.eventLimitReached = true;
        }
        static void Update()
        {
            if (!running || EditorApplication.timeSinceStartup - lastUpdate < .05) return;
            lastUpdate = EditorApplication.timeSinceStartup; var state = ReadState();
            string current = state.author + "|" + state.scene + "|" + state.jsonSha256 + "|" + state.active + "|" + state.pending + "|" + state.previewUploads;
            if (snapshotRequested || current != signature) { signature = current; snapshotRequested = false; Capture("editor-update-state-change"); }
        }
        static void Capture(string reason, string native = null)
        {
            if (session == null) return;
            if (session.snapshots.Count >= SnapshotLimit) { session.snapshotLimitReached = true; return; }
            var snapshot = new Snapshot { seconds = EditorApplication.timeSinceStartup - began, reason = reason, state = ReadState(), native = native ?? "" };
            try
            {
                var author = Author;
                if (author != null) { var d = author.Read(); snapshot.authorContentHash = TerrainQueries.ContentHash(d); snapshot.authorLeaves = d.Cells.Count; snapshot.sculptRecords = d.SculptOverrides.Count; snapshot.shapeLocks = d.ShapeLocks.Count; snapshot.realMeshSha256 = LE01CEvidence.MeshFingerprint(author); }
            }
            catch (Exception error) { snapshot.error = error.ToString(); }
            session.snapshots.Add(snapshot);
        }
        static void Write()
        {
            if (session == null) return; Directory.CreateDirectory(Path.GetDirectoryName(OutputPath));
            File.WriteAllText(OutputPath, JsonUtility.ToJson(session, true), new UTF8Encoding(false));
        }
        [MenuItem("星骸/LE-01C/验收/保存 GUI 快照")]
        public static void SaveGuiSnapshot()
        {
            var author = Author; if (author == null) { Debug.LogWarning("LE01C_GUI_SNAPSHOT_NO_AUTHOR"); return; }
            try
            {
                string directory = Path.Combine(LE01CEditorTests.Root, "samples"); Directory.CreateDirectory(directory);
                string name = "GuiPractice_" + DateTime.Now.ToString("yyyyMMdd_HHmmss_fff"); string path = Path.Combine(directory, name + ".leterrain.json");
                for (int suffix = 1; File.Exists(path); suffix++) path = Path.Combine(directory, name + "_" + suffix + ".leterrain.json");
                LE01Adapter.NativeSave(author, path);
                if (session != null) { Capture("explicit-native-snapshot", "samples/" + Path.GetFileName(path)); Write(); }
                else File.WriteAllText(path + ".snapshot.json", JsonUtility.ToJson(new Snapshot { reason = "explicit-native-snapshot-without-recorder", state = ReadState(), native = Path.GetFileName(path), authorContentHash = TerrainQueries.ContentHash(author.Read()), realMeshSha256 = LE01CEvidence.MeshFingerprint(author) }, true));
                Debug.Log("LE01C_GUI_NATIVE_SNAPSHOT_SAVED " + path);
            }
            catch (Exception error) { Debug.LogError("LE01C_GUI_SNAPSHOT_FAILED " + error); }
        }
    }
}
