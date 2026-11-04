using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEditor;

namespace XingHai.BridgeReplica.Editor
{
    // Version 2 has a distinct adaptation contract. Source topology, UVs and
    // colours are retained; only structural templates are swept. Rigid details
    // are placed in the tangent frame without scaling or bending.
    public static class CurveGeometry
    {
        sealed class Source {public Vector3[] v;public Vector2[] uv;public Color[] colors;public int[] t;}
        sealed class Batch
        {
            public ReplicaBinding binding;
            public readonly List<Vector3> v=new List<Vector3>();
            public readonly List<Vector2> uv=new List<Vector2>();
            public readonly List<Color> colors=new List<Color>();
            public readonly List<int> t=new List<int>();
            public int count;
        }
        static readonly Dictionary<string,Source> cache=new Dictionary<string,Source>();
        static Source Read(ReplicaBinding binding)
        {
            string key=binding.ModelSha256+"|"+binding.AdapterYaw;
            Source cached;if(cache.TryGetValue(key,out cached))return cached;
            var verts=new List<Vector3>();var uv=new List<Vector2>();var colors=new List<Color>();var triangles=new List<int>();
            GameObject instance=null;
            try
            {
                var rotation=Matrix4x4.Rotate(Quaternion.Euler(0,binding.AdapterYaw,0));
                if(binding.Mesh!=null)Append(binding.Mesh,rotation,verts,uv,colors,triangles);
                else
                {
                    var model=AssetDatabase.LoadAssetAtPath<GameObject>(binding.ModelPath);
                    if(model==null)throw new InvalidDataException("无法读取源件："+binding.ModelPath);
                    instance=UnityEngine.Object.Instantiate(model);instance.transform.position=Vector3.zero;instance.hideFlags=HideFlags.HideAndDontSave;
                    foreach(var f in instance.GetComponentsInChildren<MeshFilter>(true))Append(f.sharedMesh,rotation*f.transform.localToWorldMatrix,verts,uv,colors,triangles);
                }
                if(verts.Count==0)throw new InvalidDataException("源件没有真实顶点："+binding.Role);
                cached=new Source{v=verts.ToArray(),uv=uv.ToArray(),colors=colors.ToArray(),t=triangles.ToArray()};
                double volume=0;for(int i=0;i<cached.t.Length;i+=3)volume+=Vector3.Dot(cached.v[cached.t[i]],Vector3.Cross(cached.v[cached.t[i+1]],cached.v[cached.t[i+2]]))/6;
                if(volume<0)for(int i=0;i<cached.t.Length;i+=3){int q=cached.t[i+1];cached.t[i+1]=cached.t[i+2];cached.t[i+2]=q;}
                cache[key]=cached;return cached;
            }
            finally{if(instance!=null)UnityEngine.Object.DestroyImmediate(instance);}
        }
        static void Append(Mesh mesh,Matrix4x4 matrix,List<Vector3> v,List<Vector2> uv,List<Color> colors,List<int> t)
        {
            if(mesh==null||mesh.uv.Length!=mesh.vertexCount)throw new InvalidDataException("源网格没有完整UV。");
            int start=v.Count;foreach(var p in mesh.vertices)v.Add(matrix.MultiplyPoint3x4(p));uv.AddRange(mesh.uv);
            var c=mesh.colors;if(c.Length==mesh.vertexCount)colors.AddRange(c);else for(int i=0;i<mesh.vertexCount;i++)colors.Add(Color.white);
            foreach(int index in mesh.triangles)t.Add(start+index);
        }
        // A walking cell reaches its next quarter-metre riser. Banker's Round
        // turns exact half-riser samples into alternating 0/0.5m jumps.
        static float Top(CurveResult curve,float arc){return Mathf.Ceil(curve.FrameAt(arc).Y/.25f-.00001f)*.25f;}
        static Vector3 Offset(CurveFrame f,float lateral,float width)
        {return new Vector3(f.X+(f.LeftX-f.RightX)*lateral/width,0,f.Z+(f.LeftZ-f.RightZ)*lateral/width);}
        public static List<CurvePlacement> Layout(CurveResult curve)
        {
            var list=new List<CurvePlacement>();int cells=Math.Max(1,(int)Math.Ceiling(curve.Length/.5f));
            int lanes=Math.Max(1,(int)Math.Ceiling(curve.Document.Width/.5f));float laneWidth=curve.Document.Width/lanes;
            for(int i=0;i<cells;i++)
            {
                float a=curve.Length*i/cells,b=curve.Length*(i+1)/cells,top=Top(curve,(a+b)*.5f);
                bool stairs=Math.Abs(curve.FrameAt(a).Y-curve.FrameAt(b).Y)>.00001f;
                for(int lane=0;lane<lanes;lane++)list.Add(new CurvePlacement{role=stairs?"tread":"deck",startArc=a,endArc=b,lateral=-curve.Document.Width*.5f+(lane+.5f)*laneWidth,baseY=top-.25f,yaw=stairs&&curve.FrameAt(b).Y<curve.FrameAt(a).Y?180:0,edge="centre",usage="swept-v2; lane-width="+laneWidth.ToString("R",System.Globalization.CultureInfo.InvariantCulture)});
            }
            foreach(bool left in new[]{true,false})
            {
                var last=curve.Frames[curve.Frames.Count-1];float length=left?last.LeftArc:last.RightArc;
                int edgeCells=Math.Max(1,(int)Math.Ceiling(length/.5f));
                for(int i=0;i<edgeCells;i++)
                {
                    float a=length*i/edgeCells,b=length*(i+1)/edgeCells;
                    list.Add(new CurvePlacement{role="coping",startArc=a,endArc=b,edge=left?"left":"right",usage="independent-edge-sweep-v2"});
                    if(curve.Document.Rails)list.Add(new CurvePlacement{role="rail",startArc=a,endArc=b,edge=left?"left":"right",usage="independent-edge-sweep-v2"});
                }
                if(curve.Document.Rails)
                {
                    int posts=Math.Max(1,(int)Math.Ceiling(length));
                    for(int i=0;i<=posts;i++)list.Add(new CurvePlacement{role="post",startArc=length*i/posts,endArc=length*i/posts,edge=left?"left":"right",rigid=true,usage="rigid-tangent-v2"});
                }
            }
            foreach(var opening in curve.Openings)
            foreach(var p in opening.Plan.Parts.Where(p=>p.SourceId=="sb03.arch-stone"||p.SourceId=="sb03.arch-foot"||p.SourceId=="sb03.keystone"))
                list.Add(new CurvePlacement{role=p.SourceId.Substring(5),startArc=opening.SpanStartArc+p.X,endArc=opening.SpanStartArc+p.X,lateral=p.Z,baseY=p.Y,yaw=p.Yaw,edge="arch",rigid=true,usage="rigid-arch-v2"});
            return list;
        }
        public static GameObject Build(CurveResult curve,ReplicaKit kit)
        {
            if(curve==null||!curve.Valid)throw new InvalidOperationException(curve==null?"缺少曲线路线":curve.Message);
            ReplicaKitRegistry.Validate(kit);var root=new GameObject("__RouteGeometry");
            try
            {
                var records=Layout(curve);var batches=new Dictionary<string,Batch>();
                foreach(var p in records)
                {
                    Batch batch;if(!batches.TryGetValue(p.role,out batch)){batch=new Batch{binding=kit.Bindings.Single(b=>b.Role==p.role)};batches.Add(p.role,batch);}
                    Add(curve,p,batch);
                }
                foreach(var pair in batches)
                {
                    var b=pair.Value;var mesh=new Mesh{name=pair.Key,indexFormat=IndexFormat.UInt32};mesh.SetVertices(b.v);mesh.SetUVs(0,b.uv);mesh.SetColors(b.colors);mesh.SetTriangles(b.t,0);mesh.RecalculateNormals();mesh.RecalculateBounds();
                    Chunk(root,mesh,b.binding.Material,pair.Key,b.binding.Id,b.binding.ModelSha256,b.count);
                }
                var core=Support(curve);if(core.vertexCount>0)Chunk(root,core,CoreMaterial(),"generated-core","recipe:swept-stone-core-v2","",curve.Frames.Count-1);else UnityEngine.Object.DestroyImmediate(core);
                return root;
            }catch{ReplicaGeometry.Destroy(root);throw;}
        }
        static void Add(CurveResult curve,CurvePlacement p,Batch b)
        {
            var source=Read(b.binding);int start=b.v.Count;p.firstVertex=start;p.vertexCount=source.v.Length;p.firstTriangle=b.t.Count/3;p.triangleCount=source.t.Length/3;
            p.sourceId=b.binding.Id;p.sourceHash=b.binding.ModelSha256;
            float laneWidth=curve.Document.Width/Math.Max(1,(int)Math.Ceiling(curve.Document.Width/.5f));
            bool edge=p.edge=="left"||p.edge=="right",left=p.edge=="left";
            foreach(var original in source.v)
            {
                var local=!p.rigid&&p.yaw!=0?Quaternion.Euler(0,p.yaw,0)*original:original;
                Vector3 world;float t=(local.x/b.binding.Size.x+.5f),a=p.startArc+(p.endArc-p.startArc)*t;
                var f=edge?curve.EdgeFrameAt(left,p.rigid?p.startArc:a):curve.FrameAt(p.rigid?p.startArc:a);
                if(p.rigid)
                {
                    var pos=edge?new Vector3(f.X,Top(curve,f.Arc),f.Z):Offset(f,p.lateral,curve.Document.Width)+Vector3.up*p.baseY;
                    var rigid=Quaternion.Euler(0,p.yaw,0)*local;
                    world=pos+new Vector3(f.TangentX*rigid.x+f.NormalX*rigid.z,rigid.y,f.TangentZ*rigid.x+f.NormalZ*rigid.z);
                }
                else if(edge)
                {
                    float baseY=curve.FrameAt(f.Arc).Y+(p.role=="rail"?.25f:0);
                    world=new Vector3(f.X+f.NormalX*local.z,baseY+local.y,f.Z+f.NormalZ*local.z);
                }
                else world=Offset(f,p.lateral+local.z*(laneWidth/.5f),curve.Document.Width)+Vector3.up*(p.baseY+local.y);
                b.v.Add(world);
            }
            b.uv.AddRange(source.uv);b.colors.AddRange(source.colors);foreach(int index in source.t)b.t.Add(start+index);b.count++;
        }
        static void Chunk(GameObject root,Mesh mesh,Material mat,string role,string id,string hash,int count)
        {
            var go=new GameObject(role);go.transform.SetParent(root.transform,false);go.AddComponent<MeshFilter>().sharedMesh=mesh;go.AddComponent<MeshRenderer>().sharedMaterial=mat;
            go.AddComponent<MeshCollider>().sharedMesh=mesh;var tag=go.AddComponent<ReplicaChunk>();tag.Role=role;tag.SourceId=id;tag.SourceHash=hash;tag.Placements=count;
        }
        static Material CoreMaterial()
        {
            const string path="Assets/BridgeReplica/Materials/CurveSupport.mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);if(m!=null)return m;
            ReplicaKitRegistry.Folder("Assets/BridgeReplica/Materials");m=new Material(Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard"));m.color=new Color(.35f,.4f,.4f);if(m.HasProperty("_BaseColor"))m.SetColor("_BaseColor",m.color);if(m.HasProperty("_Smoothness"))m.SetFloat("_Smoothness",0);AssetDatabase.CreateAsset(m,path);return m;
        }
        static Mesh Support(CurveResult curve)
        {
            var v=new List<Vector3>();var t=new List<int>();
            Action<Vector3,Vector3,Vector3,Vector3> face=(a,b,c,d)=>{int n=v.Count;v.AddRange(new[]{a,b,c,d});t.AddRange(new[]{n,n+1,n+2,n,n+2,n+3});};
            int cells=Math.Max(1,(int)Math.Ceiling(curve.Length/.5f));
            for(int cell=0;cell<cells;cell++)
            {
                float start=curve.Length*cell/cells,end=curve.Length*(cell+1)/cells,top=Top(curve,(start+end)*.5f)-.25f;
                if(top<=0)continue;
                var cuts=new SortedSet<float>{start,end};foreach(var f in curve.Frames)if(f.Arc>start&&f.Arc<end)cuts.Add(f.Arc);
                // Exact quarter-metre opening columns share the original arch's
                // quantized soffit. A row never bridges across the hole border.
                foreach(var o in curve.Openings)for(float a=o.StartArc;a<=o.EndArc+.00001f;a+=.25f)if(a>start&&a<end)cuts.Add(a);
                var rows=cuts.ToArray();
                for(int i=0;i<rows.Length-1;i++)
                {
                    var a=curve.FrameAt(rows[i]);var b=curve.FrameAt(rows[i+1]);float bottom=curve.OpeningHeightAt((rows[i]+rows[i+1])*.5f);if(bottom>=top)continue;
                    var al=new Vector3(a.LeftX,bottom,a.LeftZ);var ar=new Vector3(a.RightX,bottom,a.RightZ);var bl=new Vector3(b.LeftX,bottom,b.LeftZ);var br=new Vector3(b.RightX,bottom,b.RightZ);
                    var AL=new Vector3(al.x,top,al.z);var AR=new Vector3(ar.x,top,ar.z);var BL=new Vector3(bl.x,top,bl.z);var BR=new Vector3(br.x,top,br.z);
                    face(al,AL,BL,bl);face(br,BR,AR,ar);face(AL,AR,BR,BL);face(bl,br,ar,al);face(ar,AR,AL,al);face(bl,BL,BR,br);
                }
            }
            for(int i=0;i<t.Count;i+=3){int q=t[i+1];t[i+1]=t[i+2];t[i+2]=q;}
            var m=new Mesh{name="swept-support-v2",indexFormat=IndexFormat.UInt32};m.SetVertices(v);m.SetTriangles(t,0);m.RecalculateNormals();m.RecalculateBounds();return m;
        }
        public static string Mapping(CurveResult curve,ReplicaKit kit)
        {
            ReplicaKitRegistry.Validate(kit);var records=Layout(curve);var offsets=new Dictionary<string,int[]>();
            foreach(var p in records)
            {
                var b=kit.Bindings.Single(x=>x.Role==p.role);var s=Read(b);int[] values;if(!offsets.TryGetValue(p.role,out values)){values=new[]{0,0};offsets.Add(p.role,values);}
                p.sourceId=b.Id;p.sourceHash=b.ModelSha256;p.firstVertex=values[0];p.vertexCount=s.v.Length;p.firstTriangle=values[1];p.triangleCount=s.t.Length/3;values[0]+=p.vertexCount;values[1]+=p.triangleCount;
            }
            return JsonUtility.ToJson(new CurveMapping{kitId=kit.Id,kitVersion=kit.Version,kitFingerprint=kit.ContentHash,researchOnly=kit.ResearchOnly,route=curve.Document,placements=records.ToArray(),sources=kit.Bindings},true);
        }
    }
}
