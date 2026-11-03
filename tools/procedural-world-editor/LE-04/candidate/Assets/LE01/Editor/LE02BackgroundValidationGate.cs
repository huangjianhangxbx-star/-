using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace XingHai.LE01.Editor
{
    // Explicit, project-local validation requests only. No network or arbitrary code execution.
    [InitializeOnLoad]
    internal static class LE02BackgroundValidationGate
    {
        [Serializable] sealed class Request { public string id, operation; }
        [Serializable] sealed class SceneState { public string name, path; public bool dirty; }
        [Serializable] sealed class Backup { public string source, copy; public List<string> authors = new List<string>(); }
        [Serializable] sealed class Reply
        {
            public string id, operation, status, message, project, utc;
            public bool playing, editing;
            public List<SceneState> scenes = new List<SceneState>();
            public List<Backup> backups = new List<Backup>();
        }
        static double nextCheck;
        static string Root { get { return Path.Combine(Directory.GetParent(LE01Export.TaskRoot).FullName, "LE-02/qa"); } }
        static LE02BackgroundValidationGate() { EditorApplication.update += Check; }
        static void Check()
        {
            if (EditorApplication.timeSinceStartup < nextCheck || EditorApplication.isCompiling || EditorApplication.isUpdating) return;
            nextCheck = EditorApplication.timeSinceStartup + .5;
            string requestPath = Path.Combine(Root, "background-request.json");
            if (!File.Exists(requestPath)) return;
            Request request;
            try
            {
                if (new FileInfo(requestPath).Length > 4096) return;
                request = JsonUtility.FromJson<Request>(File.ReadAllText(requestPath));
                if (request == null || string.IsNullOrEmpty(request.id) || request.id.Length > 80 || request.id.Any(c => !char.IsLetterOrDigit(c) && c != '-')) return;
                if (request.operation != "inspect" && request.operation != "exit-clean" && request.operation != "backup-exit") return;
            }
            catch (IOException) { return; }
            catch (ArgumentException) { return; }
            var reply = new Reply { id = request.id, operation = request.operation, status = "PASS", project = Application.dataPath, utc = DateTime.UtcNow.ToString("O"), playing = EditorApplication.isPlayingOrWillChangePlaymode };
            for (int i = 0; i < SceneManager.sceneCount; i++)
            {
                var scene = SceneManager.GetSceneAt(i);
                reply.scenes.Add(new SceneState { name = scene.name, path = scene.path, dirty = scene.isDirty });
            }
            reply.editing = UnityEngine.Object.FindObjectsOfType<LE01TerrainAuthor>().Any(LE01Stroke.IsEditing);
            bool close = request.operation == "exit-clean" || request.operation == "backup-exit";
            if (close && (reply.playing || reply.editing || request.operation == "exit-clean" && reply.scenes.Any(s => s.dirty)))
            {
                reply.status = "REFUSED"; reply.message = "The research editor has unsaved scenes, a live stroke, or Play Mode. No scene was changed and the editor stays open."; close = false;
            }
            if (close && request.operation == "backup-exit")
            {
                try
                {
                    const string folder = "Assets/LE02/Recovery";
                    LE01Export.Folder(folder);
                    string nativeFolder = Path.Combine(Directory.GetParent(Root).FullName, "recovery");
                    Directory.CreateDirectory(nativeFolder);
                    string stamp = DateTime.Now.ToString("yyyyMMdd-HHmmssfff");
                    for (int i = 0; i < SceneManager.sceneCount; i++)
                    {
                        var scene = SceneManager.GetSceneAt(i);
                        if (!scene.isLoaded) continue;
                        string name = new string(scene.name.Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '_' : c).ToArray());
                        if (string.IsNullOrEmpty(name)) name = "Untitled";
                        string copy = AssetDatabase.GenerateUniqueAssetPath(folder + "/" + name + "-" + stamp + "-" + i + ".unity");
                        var backup = new Backup { source = scene.path, copy = copy };
                        int number = 0;
                        foreach (var author in scene.GetRootGameObjects().SelectMany(go => go.GetComponentsInChildren<LE01TerrainAuthor>(true)))
                        {
                            string native = Path.Combine(nativeFolder, name + "-" + stamp + "-" + i + "-" + number++ + ".leterrain.json");
                            File.WriteAllText(native, author.DocumentJson, new System.Text.UTF8Encoding(false)); backup.authors.Add(native);
                        }
                        if (!EditorSceneManager.SaveScene(scene, copy, true)) throw new IOException("Could not save the recovery Scene.");
                        reply.backups.Add(backup);
                    }
                    reply.message = "Recovery Scene copies and original author JSON have been preserved. Original scene paths were not overwritten.";
                }
                catch (Exception error) { reply.status = "REFUSED"; reply.message = error.Message; close = false; }
            }
            Directory.CreateDirectory(Root);
            string responsePath = Path.Combine(Root, "background-response-" + request.id + ".json");
            if (File.Exists(responsePath)) return;
            File.WriteAllText(responsePath, JsonUtility.ToJson(reply, true));
            File.Move(requestPath, Path.Combine(Root, "background-processed-" + request.id + ".json"));
            if (close) EditorApplication.delayCall += () => EditorApplication.Exit(0);
        }
    }
}
