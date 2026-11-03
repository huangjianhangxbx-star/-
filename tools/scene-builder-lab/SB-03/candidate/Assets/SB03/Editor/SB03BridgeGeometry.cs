using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using Object = UnityEngine.Object;

namespace XingHai.SB03.Editor
{
    [Serializable] public sealed class SB03KitAsset
    {
        public string id,title,role,fbx,palette,source,preview,sourceSha256,fbxSha256;
        public int number;
        public float[] logicalSizeMeters;
        public float unityAdapterYaw = 180;
    }
    [Serializable] public sealed class SB03KitContract
    {
        public string kitId,version;
        public int schemaVersion;
        public SB03KitAsset[] assets;
    }

    public static class SB03BridgeGeometry
    {
        public const string KitRoot = "Assets/SB03/Kit/";
        static SB03KitContract kit;
        static readonly Dictionary<string, Material> materials = new Dictionary<string, Material>();
        public static SB03KitContract Kit { get { PrepareKit(); return kit; } }
        public static double LastBuildMilliseconds { get; private set; }

        public static void Folder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            string parent = Path.GetDirectoryName(path).Replace('\\','/');
            Folder(parent); AssetDatabase.CreateFolder(parent, Path.GetFileName(path));
        }
        public static void PrepareKit()
        {
            if (kit != null && materials.Count == kit.assets.Length && materials.Values.All(m=>m!=null)) return;
            string file = KitRoot + "contracts.json";
            if (!File.Exists(file)) throw new InvalidOperationException("桥梁素材契约缺失："+file);
            kit = JsonUtility.FromJson<SB03KitContract>(File.ReadAllText(file));
            if (kit == null || kit.schemaVersion != 1 || kit.assets == null || kit.assets.Length != 9)
                throw new InvalidOperationException("桥梁套件契约不完整；保留原桥。");
            Folder("Assets/SB03/Materials");
            foreach (var asset in kit.assets)
            {
                string fbx = KitRoot + asset.fbx, png = KitRoot + asset.palette;
                if (!File.Exists(fbx) || FileHash(fbx) != asset.fbxSha256)
                    throw new InvalidOperationException("源模型缺失或版本改变："+asset.id);
                var importer = AssetImporter.GetAtPath(fbx) as ModelImporter;
                if (importer == null) throw new InvalidOperationException("FBX无法导入："+fbx);
                if (!importer.isReadable) { importer.isReadable = true; importer.SaveAndReimport(); }
                var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(png);
                if (texture == null) throw new InvalidOperationException("源色板缺失："+png);
                texture.filterMode = FilterMode.Point; texture.wrapMode = TextureWrapMode.Clamp;
                string matPath = "Assets/SB03/Materials/"+asset.id+".mat";
                var mat = AssetDatabase.LoadAssetAtPath<Material>(matPath);
                if (mat == null)
                {
                    var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                    mat = new Material(shader); AssetDatabase.CreateAsset(mat,matPath);
                }
                mat.mainTexture=texture;mat.color=Color.white;
                if(mat.HasProperty("_BaseMap"))mat.SetTexture("_BaseMap",texture);
                if(mat.HasProperty("_BaseColor"))mat.SetColor("_BaseColor",Color.white);
                if(mat.HasProperty("_Smoothness"))mat.SetFloat("_Smoothness",0);
                EditorUtility.SetDirty(mat); materials[asset.id]=mat;
            }
        }
        public static string FileHash(string file)
        {using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(file))).Replace("-","");}
        static SB03KitAsset Source(string id)
        {var source=Kit.assets.FirstOrDefault(a=>a.id==id);if(source==null)throw new InvalidOperationException("未知构件："+id);return source;}
        public static Bounds SourceBounds(string id)
        {var s=Source(id);return new Bounds(new Vector3(0,s.logicalSizeMeters[1]/2,0),new Vector3(s.logicalSizeMeters[0],s.logicalSizeMeters[1],s.logicalSizeMeters[2]));}
        public static GameObject Build(BridgePlan plan)
        {
            if(plan==null||!plan.Valid)throw new InvalidOperationException(plan==null?"缺少候选桥":plan.Message);
            var watch=System.Diagnostics.Stopwatch.StartNew();PrepareKit();VerifySources();var root=new GameObject("__SB03_Generated");
            try
            {
                foreach(var group in plan.Parts.GroupBy(p=>p.SourceId))
                {
                    var source=Source(group.Key);var model=AssetDatabase.LoadAssetAtPath<GameObject>(KitRoot+source.fbx);
                    if(model==null)throw new InvalidOperationException("不能读取源模型："+source.id);
                    var instance=Object.Instantiate(model);instance.hideFlags=HideFlags.HideAndDontSave;instance.transform.position=Vector3.zero;
                    var combines=new List<CombineInstance>();Mesh mesh=null;
                    try
                    {
                        foreach(var part in group)
                        {
                            var matrix=Matrix4x4.TRS(new Vector3(part.X,part.Y,part.Z),Quaternion.Euler(0,part.Yaw,0),Vector3.one)*Matrix4x4.Rotate(Quaternion.Euler(0,source.unityAdapterYaw,0));
                            foreach(var filter in instance.GetComponentsInChildren<MeshFilter>(true))
                            {
                                if(filter.sharedMesh==null||filter.sharedMesh.uv.Length!=filter.sharedMesh.vertexCount)throw new InvalidOperationException("原构件UV不完整："+source.id);
                                for(int i=0;i<filter.sharedMesh.subMeshCount;i++)combines.Add(new CombineInstance{mesh=filter.sharedMesh,subMeshIndex=i,transform=matrix*filter.transform.localToWorldMatrix});
                            }
                        }
                        if(combines.Count==0)throw new InvalidOperationException("构件没有实际网格："+source.id);
                        mesh=new Mesh{name=source.id,indexFormat=IndexFormat.UInt32};mesh.CombineMeshes(combines.ToArray(),true,true,false);
                        CorrectWinding(mesh);mesh.RecalculateBounds();
                        Chunk(root,source.id,mesh,materials[source.id],source.id,source.role,group.Count(),KitRoot+source.fbx,source.fbxSha256);mesh=null;
                    }
                    finally { Object.DestroyImmediate(instance);if(mesh!=null)Object.DestroyImmediate(mesh); }
                }
                var core=CoreSurface(plan);
                Chunk(root,"generated-wall-core",core,CoreMaterial(),"recipe.generated-core","support.generated-core",plan.Solids.Count,"recipe:sb03.stone-arch/core-v1","");
                watch.Stop();LastBuildMilliseconds=watch.Elapsed.TotalMilliseconds;return root;
            }
            catch{DestroyGeometry(root);throw;}
        }
        static void Chunk(GameObject root,string name,Mesh mesh,Material material,string source,string role,int placements,string path,string hash)
        {
            var go=new GameObject(name);go.transform.SetParent(root.transform,false);
            go.AddComponent<MeshFilter>().sharedMesh=mesh;go.AddComponent<MeshRenderer>().sharedMaterial=material;
            go.AddComponent<MeshCollider>().sharedMesh=mesh;
            var tag=go.AddComponent<SB03Chunk>();tag.SourceId=source;tag.Role=role;tag.Placements=placements;tag.SourcePath=path;tag.SourceSha256=hash;
        }
        static Material CoreMaterial()
        {
            const string path="Assets/SB03/Materials/WallCore.mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);if(m!=null)return m;
            m=new Material(Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard"));m.color=new Color(.33f,.41f,.44f);
            if(m.HasProperty("_BaseColor"))m.SetColor("_BaseColor",m.color);if(m.HasProperty("_Smoothness"))m.SetFloat("_Smoothness",0);AssetDatabase.CreateAsset(m,path);return m;
        }
        static Mesh CoreSurface(BridgePlan plan)
        {
            var vertices=new List<Vector3>();var triangles=new List<int>();var uv=new List<Vector2>();
            Action<Vector3,Vector3,Vector3,Vector3> face=(a,b,c,d)=>{int n=vertices.Count;vertices.AddRange(new[]{a,b,c,d});uv.AddRange(new[]{Vector2.zero,Vector2.up,Vector2.one,Vector2.right});triangles.AddRange(new[]{n,n+1,n+2,n,n+2,n+3});};
            var solids=plan.Solids;
            for(int i=0;i<solids.Count;i++)
            {
                var b=solids[i];float x=b.MinX,X=b.MaxX,y=b.MinY,Y=b.MaxY,z=b.MinZ,Z=b.MaxZ;
                face(new Vector3(x,y,z),new Vector3(x,Y,z),new Vector3(X,Y,z),new Vector3(X,y,z));
                face(new Vector3(X,y,Z),new Vector3(X,Y,Z),new Vector3(x,Y,Z),new Vector3(x,y,Z));
                face(new Vector3(x,Y,z),new Vector3(x,Y,Z),new Vector3(X,Y,Z),new Vector3(X,Y,z));
                face(new Vector3(x,y,Z),new Vector3(x,y,z),new Vector3(X,y,z),new Vector3(X,y,Z));
                // Only the part of an end face not covered by an adjacent core prism is exposed.
                for(int side=-1;side<=1;side+=2)
                {
                    var neighbor=side<0?(i>0?solids[i-1]:null):(i+1<solids.Count?solids[i+1]:null);
                    bool touches=neighbor!=null&&Mathf.Abs((side<0?neighbor.MaxX:neighbor.MinX)-(side<0?x:X))<.0001f;
                    var intervals=new List<Vector2>();
                    if(!touches)intervals.Add(new Vector2(y,Y));
                    else {if(neighbor.MinY>y)intervals.Add(new Vector2(y,Mathf.Min(Y,neighbor.MinY)));if(neighbor.MaxY<Y)intervals.Add(new Vector2(Mathf.Max(y,neighbor.MaxY),Y));}
                    foreach(var interval in intervals)
                    {
                        if(interval.y-interval.x<.0001f)continue;float a=interval.x,c=interval.y;
                        if(side<0)face(new Vector3(x,a,Z),new Vector3(x,c,Z),new Vector3(x,c,z),new Vector3(x,a,z));
                        else face(new Vector3(X,a,z),new Vector3(X,c,z),new Vector3(X,c,Z),new Vector3(X,a,Z));
                    }
                }
            }
            var mesh=new Mesh{name="generated-wall-core",indexFormat=IndexFormat.UInt32};mesh.SetVertices(vertices);mesh.SetTriangles(triangles,0);mesh.SetUVs(0,uv);mesh.RecalculateNormals();mesh.RecalculateBounds();return mesh;
        }
        static void CorrectWinding(Mesh mesh)
        {
            var v=mesh.vertices;var t=mesh.triangles;double volume=0;for(int i=0;i<t.Length;i+=3)volume+=Vector3.Dot(v[t[i]],Vector3.Cross(v[t[i+1]],v[t[i+2]]))/6;
            if(volume>=0)return;for(int i=0;i<t.Length;i+=3){int n=t[i+1];t[i+1]=t[i+2];t[i+2]=n;}mesh.triangles=t;mesh.RecalculateNormals();
        }
        public static string SourceMap(BridgePlan plan)
        {VerifySources();return JsonUtility.ToJson(new SB03SourceMap{kitId=Kit.kitId,kitVersion=Kit.version,spec=plan.Spec,parts=plan.Parts.ToArray(),generatedCore=plan.Solids.ToArray(),sources=Kit.assets.Select(a=>new SB03SourceRecord{id=a.id,title=a.title,number=a.number,fbx=KitRoot+a.fbx,fbxSha256=a.fbxSha256,sourceSha256=a.sourceSha256}).ToArray()},true);}
        static void VerifySources()
        {
            foreach(var source in Kit.assets)
                if(!File.Exists(KitRoot+source.fbx)||FileHash(KitRoot+source.fbx)!=source.fbxSha256)
                    throw new InvalidOperationException("源模型版本改变："+source.title+"。请恢复本套件版本，原桥保持不变。");
        }
        public static void DestroyGeometry(GameObject root)
        {
            if(root==null)return;foreach(var mesh in root.GetComponentsInChildren<MeshFilter>(true).Select(f=>f.sharedMesh).Where(m=>m!=null).Distinct())if(!AssetDatabase.Contains(mesh))Object.DestroyImmediate(mesh);Object.DestroyImmediate(root);
        }
        public static void PersistMeshes(GameObject root,string folder)
        {
            Folder(folder);foreach(var f in root.GetComponentsInChildren<MeshFilter>(true))
            {
                if(f.sharedMesh==null)continue;string path=folder+"/"+f.name+".asset";var old=f.sharedMesh;
                if(AssetDatabase.Contains(old)&&AssetDatabase.GetAssetPath(old)==path)continue;
                var stored=AssetDatabase.LoadAssetAtPath<Mesh>(path);
                if(stored==null){stored=Object.Instantiate(old);stored.name=f.name;AssetDatabase.CreateAsset(stored,path);}
                else EditorUtility.CopySerialized(old,stored);
                f.sharedMesh=stored;var collider=f.GetComponent<MeshCollider>();if(collider!=null){collider.sharedMesh=null;collider.sharedMesh=stored;}
                if(!AssetDatabase.Contains(old))Object.DestroyImmediate(old);
            }
        }
        public static string MeshFingerprint(GameObject root)
        {
            using(var stream=new MemoryStream())using(var w=new BinaryWriter(stream))
            {foreach(var f in root.GetComponentsInChildren<MeshFilter>(true).OrderBy(f=>f.name,StringComparer.Ordinal)){if(f.sharedMesh==null)continue;w.Write(f.name);foreach(var p in f.sharedMesh.vertices){w.Write(p.x);w.Write(p.y);w.Write(p.z);}foreach(int n in f.sharedMesh.triangles)w.Write(n);}w.Flush();using(var hash=SHA256.Create())return BitConverter.ToString(hash.ComputeHash(stream.ToArray())).Replace("-","");}
        }
    }
}
