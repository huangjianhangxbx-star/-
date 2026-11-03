using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    // Uses the visible terrain mesh itself. Depth testing keeps the tint behind foreground objects.
    public static partial class LE02BrushOverlay
    {
        static Material material;
        static CommandBuffer activeCommands;
        static SculptSelection lastSelection;
        static string lastSignature;
        static LE01TerrainAuthor lastAuthor;
        static readonly HashSet<string> wanted = new HashSet<string>();
        sealed class Subset { public Mesh source, mesh; public string signature; }
        static readonly Dictionary<int, Subset> subsets = new Dictionary<int, Subset>();
        static Material Material()
        {
            if (material != null) return material;
            var shader = Shader.Find("Hidden/XingHai/LE02BrushOverlay");
            if (shader == null) shader = AssetDatabase.LoadAssetAtPath<Shader>("Assets/LE01/Editor/LE02BrushOverlay.shader");
            if (shader == null) return null;
            return material = new Material(shader) { hideFlags = HideFlags.HideAndDontSave };
        }
        static bool Begin(LE01TerrainAuthor author, bool pending, bool requireSceneRepaint)
        {
            if (author == null || activeCommands == null && requireSceneRepaint && (Event.current == null || Event.current.type != EventType.Repaint)) return false;
            if (lastAuthor != author) { Release(); lastAuthor = author; }
            var mat = Material(); if (mat == null) return false;
            mat.SetMatrix("_WorldToAuthor", author.transform.worldToLocalMatrix);
            mat.SetColor("_CoreColor", pending ? new Color(1,.7f,.25f,.4f) : new Color(.35f,.95f,.78f,.38f));
            mat.SetColor("_EdgeColor", pending ? new Color(1,.7f,.25f,.11f) : new Color(.25f,.75f,.9f,.11f));
            return true;
        }
        public static void DrawToCommands(CommandBuffer commands, Action draw)
        {
            if(commands==null)throw new ArgumentNullException("commands");if(draw==null)throw new ArgumentNullException("draw");
            var previous=activeCommands;activeCommands=commands;try{draw();}finally{activeCommands=previous;}
        }
        static void Submit(Mesh mesh, Matrix4x4 matrix)
        {
            if(activeCommands==null){if(material.SetPass(0))Graphics.DrawMeshNow(mesh,matrix);return;}
            // Command buffers execute later: capture uniforms per draw rather than relying
            // on the mutable shared editor Material at execution time.
            var properties=new MaterialPropertyBlock();properties.SetMatrix("_WorldToAuthor",material.GetMatrix("_WorldToAuthor"));
            float mode=material.GetFloat("_Mode");properties.SetFloat("_Mode",mode);properties.SetColor("_CoreColor",material.GetColor("_CoreColor"));properties.SetColor("_EdgeColor",material.GetColor("_EdgeColor"));
            if(mode>.5f&&mode<1.5f||mode>2.5f)properties.SetVector("_HeightRange",material.GetVector("_HeightRange"));
            if(mode<.5f||mode>1.5f){properties.SetVector("_Center",material.GetVector("_Center"));properties.SetVector("_Radii",material.GetVector("_Radii"));}
            if(mode<.5f)properties.SetVector("_Footprint",material.GetVector("_Footprint"));
            activeCommands.DrawMesh(mesh,matrix,material,0,0,properties);
        }
        public static void DrawTerrain(LE01TerrainAuthor author, Vector3 localCenter, float radius, float falloff, bool columns, bool pending, bool requireSceneRepaint = true)
        {
            if (!Begin(author, pending, requireSceneRepaint)) return;
            material.SetFloat("_Mode", columns ? 2 : 0); material.SetVector("_Center", localCenter);
            material.SetVector("_Footprint",new Vector4(1,0,1,0));
            material.SetVector("_Radii", new Vector4(radius, radius + Mathf.Max(0, falloff) + .0001f, 0, 0));
            foreach (var filter in LE01Adapter.Geometry(author).GetComponentsInChildren<MeshFilter>())
                if (filter.gameObject.activeInHierarchy && filter.sharedMesh != null) Submit(filter.sharedMesh, filter.transform.localToWorldMatrix);
        }
        public static void DrawSculpt(LE01TerrainAuthor author, SculptSelection selection, Func<MeshFilter, string[]> boundaryKeys, bool pending, bool requireSceneRepaint = true)
        {
            if (selection == null || !selection.Valid || !Begin(author, pending, requireSceneRepaint)) return;
            if (!ReferenceEquals(lastSelection, selection)) { lastSelection = selection; lastSignature = ((int)selection.LocalMask)+";"+string.Join(";", selection.Anchors.Select(a => a.Key+":"+a.LowerHeight+":"+a.UpperHeight+":"+a.PatchMinHeight+":"+a.PatchMaxHeight).OrderBy(k => k)); wanted.Clear(); foreach (var anchor in selection.Anchors) wanted.Add(anchor.Key); }
            bool patch=selection.Influence==SculptInfluence.LocalSurface&&selection.LocalMask==SculptLocalMask.StructurePatch;
            bool local=selection.Influence==SculptInfluence.LocalSurface&&!patch;
            material.SetFloat("_Mode", local?3:1);
            material.SetVector("_HeightRange", new Vector4(selection.MinHeight * TerrainUnits.Unit, selection.MaxHeight * TerrainUnits.Unit, selection.Influence == SculptInfluence.HeightRange ? .25f : 0, 0));
            if(local){material.SetVector("_Center",new Vector4(selection.LocalX,selection.LocalY,selection.LocalZ,0));material.SetVector("_Radii",new Vector4(selection.LocalRadius,0,0,0));}
            foreach (var filter in LE01Adapter.Geometry(author).GetComponentsInChildren<MeshFilter>())
            {
                var source = filter.sharedMesh; if (!filter.gameObject.activeInHierarchy || source == null) continue;
                Subset subset;
                if (!subsets.TryGetValue(source.GetInstanceID(), out subset) || subset.source != source || subset.signature != lastSignature)
                {
                    if (subset != null && subset.mesh != null) UnityEngine.Object.DestroyImmediate(subset.mesh);
                    subset = new Subset { source = source, signature = lastSignature };
                    var keys = boundaryKeys(filter); var all = source.triangles;
                    if (keys != null && keys.Length == all.Length / 3)
                    {
                        var triangles=new List<int>();var vertices=new List<Vector3>();var normals=new List<Vector3>();var ranges=new List<Vector2>();var tangents=new List<Vector2>();var anchors=selection.Anchors.ToDictionary(a=>a.Key);var sourceVertices=source.vertices;var sourceNormals=source.normals;
                        for(int i=0;i<keys.Length;i++)if(!string.IsNullOrEmpty(keys[i])&&wanted.Contains(keys[i]))
                        {
                            var anchor=anchors[keys[i]];var range=new Vector2((patch?Math.Max(anchor.LowerHeight,anchor.PatchMinHeight):anchor.LowerHeight)*TerrainUnits.Unit,(patch?Math.Min(anchor.UpperHeight,anchor.PatchMaxHeight):anchor.UpperHeight)*TerrainUnits.Unit);
                            var tangent=new Vector2((anchor.Axis==0?anchor.Z+.5f:anchor.X+.5f)*TerrainUnits.Unit,anchor.Axis);
                            // A shared source vertex may meet several author anchors.
                            // Keep per-triangle identity exact instead of overwriting UVs.
                            for(int corner=0;corner<3;corner++){int index=all[i*3+corner];triangles.Add(vertices.Count);vertices.Add(sourceVertices[index]);normals.Add(sourceNormals[index]);ranges.Add(range);tangents.Add(tangent);}
                        }
                        if(triangles.Count>0){subset.mesh=new Mesh{name="LE03_SelectedSurface",indexFormat=IndexFormat.UInt32,hideFlags=HideFlags.HideAndDontSave};subset.mesh.SetVertices(vertices);subset.mesh.SetNormals(normals);subset.mesh.SetUVs(1,ranges);subset.mesh.SetUVs(2,tangents);subset.mesh.SetTriangles(triangles,0);subset.mesh.bounds=source.bounds;}
                    }
                    subsets[source.GetInstanceID()] = subset;
                }
                if (subset.mesh != null) Submit(subset.mesh, filter.transform.localToWorldMatrix);
            }
            List<int> stale = null;
            foreach (var pair in subsets) if (pair.Value.source == null) { if (stale == null) stale = new List<int>(); stale.Add(pair.Key); }
            if (stale != null) foreach (int key in stale) { if (subsets[key].mesh != null) UnityEngine.Object.DestroyImmediate(subsets[key].mesh); subsets.Remove(key); }
        }
        public static void Release()
        {
            foreach (var item in subsets.Values) if (item.mesh != null) UnityEngine.Object.DestroyImmediate(item.mesh);
            subsets.Clear(); lastSelection = null; lastSignature = null; lastAuthor = null; wanted.Clear();
            if (material != null) UnityEngine.Object.DestroyImmediate(material); material = null;
            ReleaseHeightSurfaces();
        }
    }
}
