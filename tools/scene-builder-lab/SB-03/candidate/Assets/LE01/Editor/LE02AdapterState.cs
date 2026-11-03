using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using UnityEditor;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public static partial class LE01Adapter
    {
        sealed class SurfaceMap { public LE01TerrainAuthor author; public Mesh mesh; public string[] keys; }
        sealed class ChunkState
        {
            public GameObject go; public Mesh mesh; public Material[] materials; public bool active, hadCollider, colliderEnabled, hiddenByPreview;
            public Vector3 position, scale; public Quaternion rotation;
        }
        sealed class GeometryStamp { public string json,layer; public int chunks; }
        sealed class CommittedState { public GameObject root; public GeometryStamp stamp; public readonly List<ChunkState> chunks = new List<ChunkState>(); public readonly HashSet<Mesh> meshes = new HashSet<Mesh>(); }
        sealed class HitOrder : IComparer<RaycastHit> { public int Compare(RaycastHit a, RaycastHit b) { return a.distance.CompareTo(b.distance); } }
        static readonly HitOrder hitOrder = new HitOrder();
        static readonly RaycastHit[] hitBuffer = new RaycastHit[128];
        static readonly Dictionary<int, SurfaceMap> surfaceMaps = new Dictionary<int, SurfaceMap>();
        static readonly Dictionary<int, int> geometryRevisions = new Dictionary<int, int>();
        static readonly Dictionary<int, GeometryStamp> geometryStamps = new Dictionary<int, GeometryStamp>();
        static readonly Dictionary<int, CommittedState> committed = new Dictionary<int, CommittedState>();
        static bool HasCommitted(LE01TerrainAuthor author) { return author != null && committed.ContainsKey(author.GetInstanceID()); }
        public static long SurfaceQueryCount { get; private set; }
        public static long SurfaceMetadataBuildCount { get; private set; }
        public static bool LastSurfaceBlocked { get; private set; }
        public static int GeometryRevision(LE01TerrainAuthor author) { int value; return author != null && geometryRevisions.TryGetValue(author.GetInstanceID(), out value) ? value : 0; }
        static void GeometryChanged(LE01TerrainAuthor author) { if (author != null) geometryRevisions[author.GetInstanceID()] = GeometryRevision(author) + 1; }
        static void StampGeometry(LE01TerrainAuthor author, bool complete)
        {
            int id=author.GetInstanceID();if(!complete){geometryStamps.Remove(id);return;}
            var module=author.GetComponent<LE03ModuleAuthor>();geometryStamps[id]=new GeometryStamp{json=author.DocumentJson,layer=module==null?null:module.LayerJson,chunks=Geometry(author).GetComponentsInChildren<MeshFilter>().Length};
        }
        internal static void AcknowledgeModuleLibrary(LE01TerrainAuthor author){StampGeometry(author,true);}
        public static bool GeometryMatchesAuthor(LE01TerrainAuthor author)
        {
            GeometryStamp stamp;if(author==null||LE01Stroke.IsEditing(author)||!geometryStamps.TryGetValue(author.GetInstanceID(),out stamp)||stamp.json!=author.DocumentJson)return false;
            var module=author.GetComponent<LE03ModuleAuthor>();if(stamp.layer!=(module==null?null:module.LayerJson))return false;var filters=Geometry(author).GetComponentsInChildren<MeshFilter>();return filters.Length==stamp.chunks&&filters.All(f=>f.sharedMesh!=null);
        }
        static void RegisterSurfaceMap(LE01TerrainAuthor author, Mesh mesh, string[] keys) { surfaceMaps[mesh.GetInstanceID()] = new SurfaceMap { author = author, mesh = mesh, keys = keys ?? new string[0] }; }
        static void InvalidateSurfaceMaps(LE01TerrainAuthor author) { foreach (int key in surfaceMaps.Where(p => p.Value.author == null || p.Value.mesh == null || p.Value.author == author).Select(p => p.Key).ToArray()) surfaceMaps.Remove(key); }
        public static bool TryPickSurface(LE01TerrainAuthor author, Ray worldRay, out SurfaceHit surface, out string message)
        {
            SurfaceQueryCount++; LastSurfaceBlocked = false; surface = new SurfaceHit(); message = "没有命中当前地形表面"; var timer = Stopwatch.StartNew();
            try
            {
                if (author == null) return false; RequireTransformContract(author.transform); Physics.SyncTransforms();
                if ((SurfaceQueryCount & 63) == 0) foreach (int key in surfaceMaps.Where(p => p.Value.author == null || p.Value.mesh == null).Select(p => p.Key).ToArray()) surfaceMaps.Remove(key);
                int count = Physics.RaycastNonAlloc(worldRay, hitBuffer, 10000, ~0, QueryTriggerInteraction.Ignore);
                RaycastHit[] hits = hitBuffer; if (count == hitBuffer.Length) { hits = Physics.RaycastAll(worldRay, 10000, ~0, QueryTriggerInteraction.Ignore); count = hits.Length; }
                Array.Sort(hits, 0, count, hitOrder);
                var geometry = author.transform.Find("TerrainGeometry");
                for (int i = 0; i < count; i++)
                {
                    var hit = hits[i]; var renderer = hit.collider.GetComponent<Renderer>(); if (renderer == null) renderer = hit.collider.GetComponentInParent<Renderer>();
                    if (renderer == null || !renderer.enabled || !renderer.gameObject.activeInHierarchy || SceneVisibilityManager.instance.IsHidden(renderer.gameObject)) continue;
                    if (geometry == null || !hit.collider.transform.IsChildOf(geometry)) { LastSurfaceBlocked = true; message = "前方可见对象遮挡，不能穿透绘制"; return false; }
                    var point = author.transform.InverseTransformPoint(hit.point); var normal = author.transform.InverseTransformDirection(hit.normal).normalized;
                    string key = null;
                    if (!LE04TerrainSession.Has(author)&&(Mathf.Abs(normal.y) < .35f||LE03Modules.HasLayer(author)))
                    {
                        var filter = hit.collider.GetComponent<MeshFilter>(); var collider = hit.collider as MeshCollider;
                        var keys = filter == null || collider != null && collider.sharedMesh != filter.sharedMesh ? null : SurfaceBoundaryKeys(author, filter);
                        if (keys != null && hit.triangleIndex >= 0 && hit.triangleIndex < keys.Length) key = keys[hit.triangleIndex];
                    }
                    surface = new SurfaceHit { X = point.x, Y = point.y, Z = point.z, NormalX = normal.x, NormalY = normal.y, NormalZ = normal.z, BoundaryKey = key };
                    message = "已命中当前可见模型表面"; return true;
                }
                return false;
            }
            catch (InvalidOperationException error) { message = error.Message; return false; }
            finally { timer.Stop(); LastPickMilliseconds = timer.Elapsed.TotalMilliseconds; }
        }
        public static string[] SurfaceBoundaryKeys(LE01TerrainAuthor author, MeshFilter filter)
        {
            if (author == null || filter == null || filter.sharedMesh == null) return null;
            SurfaceMap map; int id = filter.sharedMesh.GetInstanceID();
            if (surfaceMaps.TryGetValue(id, out map) && map.mesh == filter.sharedMesh && map.author == author) return map.keys;
            // Saved scenes contain real Mesh assets but no transient editor dictionaries.
            // Recover the complete author once, populate every matching chunk, and keep only keys.
            SurfaceMetadataBuildCount++; var built = LE03Modules.HasLayer(author)?LE03Modules.BuildForEvidence(author).geometry:TerrainCompiler.Build(author.Read()); var byId = built.Chunks.ToDictionary(c => c.Id);
            foreach (var candidate in Geometry(author).GetComponentsInChildren<MeshFilter>())
            {
                ChunkMesh data; var mesh = candidate.sharedMesh; if (mesh == null) continue;
                var keys = byId.TryGetValue(candidate.name, out data) && MatchesMesh(mesh, data) ? data.TriangleBoundaryKeys : new string[0];
                RegisterSurfaceMap(author, mesh, keys);
            }
            return surfaceMaps.TryGetValue(id, out map) ? map.keys : null;
        }
        static bool MatchesMesh(Mesh mesh, ChunkMesh data)
        {
            if (mesh.vertexCount * 3 != data.Vertices.Length) return false;
            var vertices = mesh.vertices; var triangles = mesh.triangles; if (triangles.Length != data.Triangles.Length) return false;
            for (int i = 0; i < triangles.Length; i++) if (triangles[i] != data.Triangles[i]) return false;
            for (int i = 0; i < vertices.Length; i++) if (vertices[i].x != data.Vertices[i*3] || vertices[i].y != data.Vertices[i*3+1] || vertices[i].z != data.Vertices[i*3+2]) return false;
            return true;
        }
        public static void CaptureCommitted(LE01TerrainAuthor author)
        {
            if (author == null) return; DiscardCommitted(author); GeometryStamp stamp;geometryStamps.TryGetValue(author.GetInstanceID(),out stamp);var snapshot = new CommittedState { root = Geometry(author),stamp=stamp };
            foreach (Transform child in snapshot.root.transform)
            {
                var filter = child.GetComponent<MeshFilter>(); if (filter == null) continue; var renderer = child.GetComponent<MeshRenderer>(); var collider = child.GetComponent<MeshCollider>();
                snapshot.chunks.Add(new ChunkState { go = child.gameObject, mesh = filter.sharedMesh, materials = renderer == null ? new Material[0] : renderer.sharedMaterials, active = child.gameObject.activeSelf, hadCollider = collider != null, colliderEnabled = collider != null && collider.enabled, position = child.localPosition, rotation = child.localRotation, scale = child.localScale });
                if (filter.sharedMesh != null) snapshot.meshes.Add(filter.sharedMesh);
            }
            committed[author.GetInstanceID()] = snapshot;
        }
        static bool IsPinned(Mesh mesh) { if (mesh == null) return false; foreach (var snapshot in committed.Values) if (snapshot.meshes.Contains(mesh)) return true; return false; }
        static void RetireMesh(Mesh mesh)
        {
            if (mesh == null || AssetDatabase.Contains(mesh) || IsPinned(mesh)) return;
            surfaceMaps.Remove(mesh.GetInstanceID()); UnityEngine.Object.DestroyImmediate(mesh);
        }
        static void RemoveChunk(LE01TerrainAuthor author, GameObject go)
        {
            CommittedState snapshot;
            if (author != null && committed.TryGetValue(author.GetInstanceID(), out snapshot))
                foreach (var state in snapshot.chunks) if (state.go == go) { state.hiddenByPreview = true; go.SetActive(false); return; }
            DestroyChild(go);
        }
        static void ReactivateChunk(LE01TerrainAuthor author, GameObject go)
        {
            CommittedState snapshot; if (author == null || !committed.TryGetValue(author.GetInstanceID(), out snapshot)) return;
            foreach (var state in snapshot.chunks) if (state.go == go && state.hiddenByPreview) { go.SetActive(state.active); state.hiddenByPreview = false; return; }
        }
        public static bool RestoreCommitted(LE01TerrainAuthor author)
        {
            CommittedState snapshot; if (author == null || !committed.TryGetValue(author.GetInstanceID(), out snapshot) || snapshot.root == null) return false;
            foreach (Transform child in snapshot.root.transform.Cast<Transform>().ToArray()) if (!snapshot.chunks.Any(s => s.go == child.gameObject)) DestroyChild(child.gameObject);
            foreach (var state in snapshot.chunks)
            {
                if (state.go == null || state.mesh == null) { DiscardCommitted(author); return false; }
                var go = state.go; go.SetActive(state.active); go.transform.localPosition = state.position; go.transform.localRotation = state.rotation; go.transform.localScale = state.scale;
                var filter = go.GetComponent<MeshFilter>(); if (filter == null) filter = go.AddComponent<MeshFilter>(); var previous = filter.sharedMesh; filter.sharedMesh = state.mesh;
                var renderer = go.GetComponent<MeshRenderer>(); if (renderer == null) renderer = go.AddComponent<MeshRenderer>(); renderer.sharedMaterials = state.materials;
                var collider = go.GetComponent<MeshCollider>(); if (state.hadCollider) { if (collider == null) collider = go.AddComponent<MeshCollider>(); collider.sharedMesh = state.mesh; collider.enabled = state.colliderEnabled; } else if (collider != null) UnityEngine.Object.DestroyImmediate(collider);
                if (previous != state.mesh) RetireMesh(previous);
            }
            committed.Remove(author.GetInstanceID());if(snapshot.stamp==null)geometryStamps.Remove(author.GetInstanceID());else geometryStamps[author.GetInstanceID()]=snapshot.stamp;GeometryChanged(author);return true;
        }
        public static void DiscardCommitted(LE01TerrainAuthor author)
        {
            if (ReferenceEquals(author, null)) return; int id = author.GetInstanceID(); CommittedState snapshot; if (!committed.TryGetValue(id, out snapshot)) return;
            committed.Remove(id);
            foreach (var state in snapshot.chunks) if (state.go != null && state.hiddenByPreview) DestroyChild(state.go);
            var live = snapshot.root == null ? new HashSet<Mesh>() : new HashSet<Mesh>(snapshot.root.GetComponentsInChildren<MeshFilter>(true).Select(f => f.sharedMesh));
            foreach (var mesh in snapshot.meshes) if (!live.Contains(mesh)) RetireMesh(mesh);
            if(author==null)
            {
                geometryStamps.Remove(id);geometryRevisions.Remove(id);
                foreach(int key in surfaceMaps.Where(p=>ReferenceEquals(p.Value.author,author)).Select(p=>p.Key).ToArray()){var mesh=surfaceMaps[key].mesh;surfaceMaps.Remove(key);RetireMesh(mesh);}
            }
        }
    }

    public sealed class LE02SurfaceHoverCache
    {
        LE01TerrainAuthor author; string json; Ray ray; Matrix4x4 transform; int revision; bool hasValue, wall;
        public SurfaceHit Hit { get; private set; }
        public string Message { get; private set; }
        public bool Valid { get; private set; }
        public bool Blocked { get; private set; }
        public void Invalidate() { hasValue = false; Valid = false; }
        public bool Resolve(LE01TerrainAuthor current, Ray worldRay, bool sculptOnly, bool force)
        {
            if (current == null) { Invalidate(); return false; }
            int version = LE01Adapter.GeometryRevision(current); var matrix = current.transform.localToWorldMatrix;
            if (!force && hasValue && author == current && json == current.DocumentJson && revision == version && wall == sculptOnly && transform == matrix && ray.origin == worldRay.origin && ray.direction == worldRay.direction) return Valid;
            author = current; json = current.DocumentJson; revision = version; wall = sculptOnly; transform = matrix; ray = worldRay; hasValue = true;
            SurfaceHit hit; string message; Valid = sculptOnly ? LE01Adapter.TryPickSculpt(current, worldRay, out hit, out message) : LE01Adapter.TryPickSurface(current, worldRay, out hit, out message);
            Hit = hit; Message = message; Blocked = LE01Adapter.LastSurfaceBlocked; return Valid;
        }
    }
}
