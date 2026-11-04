using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.SB03;
namespace XingHai.BridgeReplica.Editor
{
    public static class ReplicaGeometry
    {
        public static GameObject Build(RouteResult result,ReplicaKit kit)
        {
            if(result!=null&&result.Curve!=null)return CurveGeometry.Build(result.Curve,kit);
            if(result==null||!result.Valid)throw new InvalidOperationException(result==null?"缺少路线":result.Message);ReplicaKitRegistry.Validate(kit);
            var root=new GameObject("__RouteGeometry");
            try
            {
                foreach(var group in result.Plan.Parts.GroupBy(p=>p.SourceId))
                {
                    string role=group.Key.StartsWith("sb03.")?group.Key.Substring(5):group.Key;
                    var binding=kit.Bindings.SingleOrDefault(b=>b.Role==role);if(binding==null)throw new InvalidDataException("套件缺少职责："+role);
                    var model=AssetDatabase.LoadAssetAtPath<GameObject>(binding.ModelPath);if(model==null)throw new InvalidDataException("源模型不能加载："+binding.ModelPath);
                    var instance=UnityEngine.Object.Instantiate(model);instance.transform.position=Vector3.zero;instance.hideFlags=HideFlags.HideAndDontSave;
                    try
                    {
                        var sources=instance.GetComponentsInChildren<MeshFilter>(true);var combines=new List<CombineInstance>();
                        foreach(var part in group)
                        {
                            var matrix=Matrix4x4.TRS(new Vector3(part.X,part.Y,part.Z),Quaternion.Euler(0,part.Yaw,0),Vector3.one)*Matrix4x4.Rotate(Quaternion.Euler(0,binding.AdapterYaw,0));
                            foreach(var filter in sources){if(filter.sharedMesh==null||filter.sharedMesh.uv.Length!=filter.sharedMesh.vertexCount)throw new InvalidDataException(role+"源网格UV无效。");for(int j=0;j<filter.sharedMesh.subMeshCount;j++)combines.Add(new CombineInstance{mesh=filter.sharedMesh,subMeshIndex=j,transform=matrix*filter.transform.localToWorldMatrix});}
                        }
                        var mesh=new Mesh{name=role,indexFormat=IndexFormat.UInt32};mesh.CombineMeshes(combines.ToArray(),true,true,false);Outward(mesh);mesh.RecalculateBounds();Chunk(root,mesh,binding.Material,role,binding.Id,binding.ModelSha256,group.Count());
                    }finally{UnityEngine.Object.DestroyImmediate(instance);}
                }
                var core=Core(result.Plan.Solids);Chunk(root,core,CoreMaterial(),"generated-core","recipe:orthogonal-stone-core-v1","",result.Plan.Solids.Count);return root;
            }catch{Destroy(root);throw;}
        }
        static void Chunk(GameObject root,Mesh mesh,Material mat,string role,string id,string hash,int count)
        {var go=new GameObject(role);go.transform.SetParent(root.transform,false);go.AddComponent<MeshFilter>().sharedMesh=mesh;go.AddComponent<MeshRenderer>().sharedMaterial=mat;go.AddComponent<MeshCollider>().sharedMesh=mesh;var tag=go.AddComponent<ReplicaChunk>();tag.Role=role;tag.SourceId=id;tag.SourceHash=hash;tag.Placements=count;}
        static Material CoreMaterial()
        {
            const string path="Assets/BridgeReplica/Materials/RecipeCore.mat";var mat=AssetDatabase.LoadAssetAtPath<Material>(path);if(mat!=null)return mat;ReplicaKitRegistry.Folder("Assets/BridgeReplica/Materials");mat=new Material(Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard"));mat.color=new Color(.32f,.4f,.43f);if(mat.HasProperty("_BaseColor"))mat.SetColor("_BaseColor",mat.color);if(mat.HasProperty("_Smoothness"))mat.SetFloat("_Smoothness",0);AssetDatabase.CreateAsset(mat,path);return mat;
        }
        static Mesh Core(List<BridgeSolid> solids)
        {
            // Coarse recipe prisms, rather than per-voxel scene objects. Junction
            // platform and segment volumes are trimmed by the route solver.
            var v=new List<Vector3>();var t=new List<int>();
            Action<Vector3,Vector3,Vector3,Vector3> face=(a,b,c,d)=>{int i=v.Count;v.AddRange(new[]{a,b,c,d});t.AddRange(new[]{i,i+1,i+2,i,i+2,i+3});};
            foreach(var b in solids)
            {
                float x=b.MinX,X=b.MaxX,y=b.MinY,Y=b.MaxY,z=b.MinZ,Z=b.MaxZ;
                face(new Vector3(x,y,z),new Vector3(x,Y,z),new Vector3(X,Y,z),new Vector3(X,y,z));face(new Vector3(X,y,Z),new Vector3(X,Y,Z),new Vector3(x,Y,Z),new Vector3(x,y,Z));
                face(new Vector3(x,Y,z),new Vector3(x,Y,Z),new Vector3(X,Y,Z),new Vector3(X,Y,z));face(new Vector3(x,y,Z),new Vector3(x,y,z),new Vector3(X,y,z),new Vector3(X,y,Z));
                face(new Vector3(x,y,Z),new Vector3(x,Y,Z),new Vector3(x,Y,z),new Vector3(x,y,z));face(new Vector3(X,y,z),new Vector3(X,Y,z),new Vector3(X,Y,Z),new Vector3(X,y,Z));
            }
            var m=new Mesh{name="generated-core",indexFormat=IndexFormat.UInt32};m.SetVertices(v);m.SetTriangles(t,0);m.RecalculateNormals();m.RecalculateBounds();return m;
        }
        static void Outward(Mesh mesh)
        {var v=mesh.vertices;var t=mesh.triangles;double volume=0;for(int i=0;i<t.Length;i+=3)volume+=Vector3.Dot(v[t[i]],Vector3.Cross(v[t[i+1]],v[t[i+2]]))/6;if(volume>=0)return;for(int i=0;i<t.Length;i+=3){int q=t[i+1];t[i+1]=t[i+2];t[i+2]=q;}mesh.triangles=t;mesh.RecalculateNormals();}
        public static void Destroy(GameObject root)
        {if(root==null)return;foreach(var m in root.GetComponentsInChildren<MeshFilter>(true).Select(f=>f.sharedMesh).Where(m=>m!=null).Distinct())if(!AssetDatabase.Contains(m))UnityEngine.Object.DestroyImmediate(m);UnityEngine.Object.DestroyImmediate(root);}
        public static string Mapping(RouteResult result,ReplicaKit kit)
        {if(result!=null&&result.Curve!=null)return CurveGeometry.Mapping(result.Curve,kit);ReplicaKitRegistry.Validate(kit);return JsonUtility.ToJson(new ReplicaMapping{kitId=kit.Id,kitVersion=kit.Version,kitFingerprint=kit.ContentHash,route=result.Document,parts=result.Plan.Parts.ToArray(),generatedCore=result.Plan.Solids.ToArray(),sources=kit.Bindings},true);}
        public static void Persist(GameObject root,string folder)
        {
            ReplicaKitRegistry.Folder(folder);foreach(var f in root.GetComponentsInChildren<MeshFilter>(true))
            {if(f.sharedMesh==null)continue;string path=folder+"/"+f.name+".asset";var old=f.sharedMesh;if(AssetDatabase.GetAssetPath(old)==path)continue;var persistent=AssetDatabase.LoadAssetAtPath<Mesh>(path);if(persistent==null){persistent=UnityEngine.Object.Instantiate(old);persistent.name=f.name;AssetDatabase.CreateAsset(persistent,path);}else EditorUtility.CopySerialized(old,persistent);f.sharedMesh=persistent;var c=f.GetComponent<MeshCollider>();if(c!=null){c.sharedMesh=null;c.sharedMesh=persistent;}if(!AssetDatabase.Contains(old))UnityEngine.Object.DestroyImmediate(old);}
        }
        public static string Fingerprint(GameObject root)
        {
            using(var bytes=new MemoryStream())using(var w=new BinaryWriter(bytes))
            {foreach(var f in root.GetComponentsInChildren<MeshFilter>(true).Where(f=>f.sharedMesh!=null).OrderBy(f=>f.name,StringComparer.Ordinal)){w.Write(f.name);foreach(var p in f.sharedMesh.vertices){w.Write(p.x);w.Write(p.y);w.Write(p.z);}foreach(var uv in f.sharedMesh.uv){w.Write(uv.x);w.Write(uv.y);}foreach(int n in f.sharedMesh.triangles)w.Write(n);}w.Flush();return ReplicaKitRegistry.Hash(bytes.ToArray());}
        }
    }
}
