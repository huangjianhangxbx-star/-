using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    internal static class LE02EditableSurfaces
    {
        internal struct Key : IEquatable<Key>
        {
            internal int x, z, q;
            internal Key(TerrainCell c) { x=c.X;z=c.Z;q=c.Size; }
            internal Key(int px,int pz,int size) { x=px;z=pz;q=size; }
            public bool Equals(Key k) { return x==k.x&&z==k.z&&q==k.q; }
            public override bool Equals(object obj) { return obj is Key&&Equals((Key)obj); }
            public override int GetHashCode() { unchecked { return x*73856093^z*19349663^q*83492791; } }
        }
        internal sealed class Component { internal readonly HashSet<Key> cells=new HashSet<Key>(); internal int id; }
        internal sealed class Source
        {
            internal readonly Dictionary<Key,TerrainCell> cells = new Dictionary<Key,TerrainCell>();
            readonly Dictionary<Key,Component> components = new Dictionary<Key,Component>(); int componentSequence;
            internal Source(TerrainDocument doc) { foreach(var cell in doc.Cells) cells.Add(new Key(cell),cell); }
            internal TerrainCell At(float x,float z) { return AtUnits(Mathf.FloorToInt(x/TerrainUnits.Unit),Mathf.FloorToInt(z/TerrainUnits.Unit)); }
            internal TerrainCell AtUnits(int x,int z)
            {
                TerrainCell cell; for(int q=1;q<=4;q*=2) if(cells.TryGetValue(new Key(x&~(q-1),z&~(q-1),q),out cell))return cell; return null;
            }
            internal Component Connected(Vector3 point,int height)
            {
                var first=At(point.x,point.z); if(first==null||first.Top!=height)return null; var firstKey=new Key(first); Component component;
                if(components.TryGetValue(firstKey,out component))return component;
                component=new Component{id=++componentSequence};var pending=new Queue<TerrainCell>();pending.Enqueue(first);
                while(pending.Count>0)
                {
                    var cell=pending.Dequeue();var key=new Key(cell);if(!component.cells.Add(key))continue;
                    for(int s=0;s<cell.Size;s++)
                    {
                        Enqueue(AtUnits(cell.X-1,cell.Z+s),height,pending,component); Enqueue(AtUnits(cell.X+cell.Size,cell.Z+s),height,pending,component);
                        Enqueue(AtUnits(cell.X+s,cell.Z-1),height,pending,component); Enqueue(AtUnits(cell.X+s,cell.Z+cell.Size),height,pending,component);
                    }
                }
                foreach(var key in component.cells)components[key]=component;return component;
            }
            static void Enqueue(TerrainCell cell,int height,Queue<TerrainCell> pending,Component component) { if(cell!=null&&cell.Top==height&&!component.cells.Contains(new Key(cell)))pending.Enqueue(cell); }
        }
        static LE01TerrainAuthor lastAuthor;static string lastJson;static Source cached;
        internal static Source Get(LE01TerrainAuthor author)
        {
            if(cached==null||author!=lastAuthor||author.DocumentJson!=lastJson){lastAuthor=author;lastJson=author.DocumentJson;cached=new Source(author.Read());}
            return cached;
        }
        internal static bool CanEdit(LE01TerrainAuthor author,SurfaceHit hit)
        {
            if(author==null||hit.NormalY<.35f||!string.IsNullOrEmpty(hit.BoundaryKey)&&hit.BoundaryKey.StartsWith("module:",StringComparison.Ordinal))return false;var cell=Get(author).At(hit.X,hit.Z);return cell!=null&&Mathf.Abs(cell.Top*TerrainUnits.Unit-hit.Y)<.001f;
        }
        internal static void Clear() { cached=null;lastAuthor=null;lastJson=null; }
    }
    public static partial class LE01Adapter
    {
        public static bool CanEditHeightSurface(LE01TerrainAuthor author,SurfaceHit hit) { return LE02EditableSurfaces.CanEdit(author,hit); }
    }
    public static partial class LE02BrushOverlay
    {
        sealed class TopSubset { internal Mesh source,mesh;internal LE02EditableSurfaces.Source document;internal int height,component;internal bool preview; }
        static readonly Dictionary<int,TopSubset> topSubsets=new Dictionary<int,TopSubset>();
        public static long HeightSubsetBuilds {get;private set;}
        public static void DrawHeightRange(LE01TerrainAuthor author,Vector3 localCenter,float radius,float falloff,int startHeightUnits,bool entirePlateau,bool soft,bool pending,bool requireSceneRepaint=true)
        {
            DrawHeightForm(author,localCenter,radius,falloff,startHeightUnits,entirePlateau,soft,pending,TerrainHeightForm.RoundTerrace,0,1,requireSceneRepaint);
        }
        public static void DrawHeightForm(LE01TerrainAuthor author,Vector3 localCenter,float radius,float falloff,int startHeightUnits,bool entirePlateau,bool soft,bool pending,TerrainHeightForm form,float rotationDegrees,float aspectRatio,bool requireSceneRepaint=true)
        {
            if(!Begin(author,pending,requireSceneRepaint))return;var source=LE02EditableSurfaces.Get(author);
            int height=soft?int.MinValue:startHeightUnits;var component=entirePlateau&&!soft?source.Connected(localCenter,startHeightUnits):null;
            if(entirePlateau&&!soft&&component==null)return;
            material.SetFloat("_Mode",0);material.SetVector("_Center",localCenter);material.SetVector("_Radii",new Vector4(radius,radius+Mathf.Max(0,falloff)+.0001f,component==null?0:1,0));
            float angle=rotationDegrees*Mathf.Deg2Rad;material.SetVector("_Footprint",new Vector4(Mathf.Cos(angle),Mathf.Sin(angle),Mathf.Clamp(aspectRatio,1,4),soft&&form!=TerrainHeightForm.RoundTerrace?1:0));
            var used=new HashSet<int>();
            foreach(var filter in LE01Adapter.Geometry(author).GetComponentsInChildren<MeshFilter>())
            {
                var mesh=filter.sharedMesh;var renderer=filter.GetComponent<Renderer>();
                if(!filter.gameObject.activeInHierarchy||mesh==null||renderer==null||!renderer.enabled||UnityEditor.SceneVisibilityManager.instance.IsHidden(filter.gameObject))continue;
                int id=mesh.GetInstanceID();used.Add(id);TopSubset subset;
                int componentId=component==null?0:component.id;
                if(!topSubsets.TryGetValue(id,out subset)||subset.source!=mesh||subset.document!=source||subset.height!=height||subset.component!=componentId||subset.preview!=pending)
                {
                    if(subset!=null&&subset.mesh!=null)UnityEngine.Object.DestroyImmediate(subset.mesh);
                    subset=new TopSubset{source=mesh,document=source,height=height,component=componentId,preview=pending};
                    subset.mesh=EditableTopMesh(mesh,source,height,component,pending);topSubsets[id]=subset;HeightSubsetBuilds++;
                }
                if(subset.mesh!=null)Submit(subset.mesh,filter.transform.localToWorldMatrix);
            }
            List<int> stale=null;foreach(var pair in topSubsets)if(!used.Contains(pair.Key)){if(stale==null)stale=new List<int>();stale.Add(pair.Key);}
            if(stale!=null)foreach(int id in stale){if(topSubsets[id].mesh!=null)UnityEngine.Object.DestroyImmediate(topSubsets[id].mesh);topSubsets.Remove(id);}
        }
        static Mesh EditableTopMesh(Mesh source,LE02EditableSurfaces.Source document,int height,LE02EditableSurfaces.Component component,bool preview)
        {
            var vertices=source.vertices;var normals=source.normals;var uv=source.uv;var all=source.triangles;var selected=new List<int>();
            if(uv.Length!=vertices.Length||normals.Length!=vertices.Length)return null;
            for(int i=0;i<all.Length;i+=3)
            {
                int index=all[i];if(normals[index].y<.35f||Mathf.Abs(uv[index].x-.0625f)>.0001f)continue;
                var center=(vertices[index]+vertices[all[i+1]]+vertices[all[i+2]])/3;var cell=document.At(center.x,center.z);
                if(cell==null||height!=int.MinValue&&cell.Top!=height||component!=null&&!component.cells.Contains(new LE02EditableSurfaces.Key(cell))||!preview&&Mathf.Abs(cell.Top*TerrainUnits.Unit-center.y)>.001f)continue;
                selected.Add(index);selected.Add(all[i+1]);selected.Add(all[i+2]);
            }
            if(selected.Count==0)return null;
            var result=new Mesh{name="LE02_EditableTopRange",indexFormat=IndexFormat.UInt32,hideFlags=HideFlags.HideAndDontSave};result.vertices=vertices;result.normals=normals;result.uv=uv;result.triangles=selected.ToArray();result.bounds=source.bounds;return result;
        }
        static void ReleaseHeightSurfaces()
        {
            foreach(var subset in topSubsets.Values)if(subset.mesh!=null)UnityEngine.Object.DestroyImmediate(subset.mesh);topSubsets.Clear();LE02EditableSurfaces.Clear();
        }
    }
}
