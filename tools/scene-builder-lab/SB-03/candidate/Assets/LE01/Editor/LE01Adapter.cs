using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public static partial class LE01Adapter
    {
        public static long LastUploadMilliseconds;
        public static double LastPickMilliseconds;
        public static bool TryPickSculpt(LE01TerrainAuthor author,Ray worldRay,out SurfaceHit surface,out string message)
        {
            if(!TryPickSurface(author,worldRay,out surface,out message))return false;
            if(!string.IsNullOrEmpty(surface.BoundaryKey)&&surface.BoundaryKey.StartsWith("module:",StringComparison.Ordinal)){message="这是完整模型表面；请到模型画笔删除或替换，不会绑定到下方原岩壁";return false;}
            if(Mathf.Abs(surface.NormalY)>.35f){message="岩壁塑形只选择侧壁；顶面继续使用地形工具";return false;}
            message="已拾取当前可见前壁";return true;
        }
        public static GameObject Geometry(LE01TerrainAuthor author)
        {
            var t=author.transform.Find("TerrainGeometry");
            if(t!=null)return t.gameObject;
            var go=new GameObject("TerrainGeometry");go.transform.SetParent(author.transform,false);return go;
        }
        public static void Upload(LE01TerrainAuthor author,TerrainBuild build,bool colliders=true,bool clear=false)
        {
            clear|=build.ClearPrevious;
            build=LE03Modules.ComposeForUpload(author,build,colliders,clear);
            clear|=build.ClearPrevious;
            var watch=Stopwatch.StartNew();var root=Geometry(author);
            if(clear)foreach(Transform child in root.transform.Cast<Transform>().ToArray())RemoveChunk(author,child.gameObject);
            var material=LE03Modules.MaterialFor(author,build,colliders);
            foreach(var data in build.Chunks)
            {
                var found=root.transform.Find(data.Id);
                if(data.Triangles.Length==0){if(found!=null)RemoveChunk(author,found.gameObject);continue;}
                var go=found!=null?found.gameObject:new GameObject(data.Id);if(found==null)go.transform.SetParent(root.transform,false);
                ReactivateChunk(author,go);
                var filter=go.GetComponent<MeshFilter>();if(filter==null)filter=go.AddComponent<MeshFilter>();
                var old=filter.sharedMesh;
                var mesh=new Mesh{name=data.Id,indexFormat=IndexFormat.UInt32};
                var vertices=new Vector3[data.Vertices.Length/3];var normals=new Vector3[vertices.Length];var uv=new Vector2[vertices.Length];
                for(int i=0;i<vertices.Length;i++){vertices[i]=new Vector3(data.Vertices[i*3],data.Vertices[i*3+1],data.Vertices[i*3+2]);normals[i]=new Vector3(data.Normals[i*3],data.Normals[i*3+1],data.Normals[i*3+2]);uv[i]=new Vector2(data.UV[i*2],data.UV[i*2+1]);}
                mesh.vertices=vertices;mesh.normals=normals;mesh.uv=uv;mesh.triangles=data.Triangles;mesh.RecalculateBounds();filter.sharedMesh=mesh;
                RegisterSurfaceMap(author,mesh,data.TriangleBoundaryKeys);
                var renderer=go.GetComponent<MeshRenderer>();if(renderer==null)renderer=go.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;
                var collider=go.GetComponent<MeshCollider>();if(colliders){if(collider==null)collider=go.AddComponent<MeshCollider>();collider.sharedMesh=mesh;}else if(collider!=null&&!HasCommitted(author))UnityEngine.Object.DestroyImmediate(collider);
                RetireMesh(old);
            }
            GeometryChanged(author);
            StampGeometry(author,colliders);
            watch.Stop();LastUploadMilliseconds=watch.ElapsedMilliseconds;
        }
        static void DestroyChild(GameObject child){var f=child.GetComponent<MeshFilter>();var mesh=f==null?null:f.sharedMesh;UnityEngine.Object.DestroyImmediate(child);RetireMesh(mesh);}
        public static void SetGray(LE01TerrainAuthor author,bool gray)
        {
            author.Gray=gray;var material=LE03Modules.HasLayer(author)?LE03Modules.CurrentMaterial(author,gray):LE03ThemeMaterials.MaterialFor(author,gray);foreach(var r in Geometry(author).GetComponentsInChildren<MeshRenderer>())r.sharedMaterial=material;
        }
        public static Bounds Bounds(LE01TerrainAuthor author)
        {
            var renderers=Geometry(author).GetComponentsInChildren<MeshRenderer>();var b=new Bounds(author.transform.position,Vector3.one);
            if(renderers.Length>0){b=renderers[0].bounds;foreach(var r in renderers.Skip(1))b.Encapsulate(r.bounds);}return b;
        }
        public static void NativeSave(LE01TerrainAuthor author,string path)
        {
            if(LE04TerrainSession.Has(author)){LE04TerrainFiles.Save(author,path);return;}if(LE03Modules.HasLayer(author)){LE03Modules.SaveWorld(author,path);return;}
            if(LE01Stroke.IsEditing(author))throw new InvalidOperationException("Finish or cancel the active stroke before saving.");
            RequireTransformContract(author.transform);
            var d=author.Read();d.OriginX=author.transform.position.x;d.OriginY=author.transform.position.y;d.OriginZ=author.transform.position.z;string error;if(!TerrainKernel.Validate(d,out error))throw new InvalidDataException(error);
            if(File.Exists(path)){
                var previous=JsonUtility.FromJson<TerrainDocument>(File.ReadAllText(path));
                if(previous!=null&&previous.GeneratorVersion!=d.GeneratorVersion)throw new InvalidOperationException("Generator versions must be saved to separate candidate files. Choose a new path; the old author file is preserved.");
            }
            var dir=Path.GetDirectoryName(Path.GetFullPath(path));Directory.CreateDirectory(dir);var temporary=path+".tmp";
            File.WriteAllText(temporary,JsonUtility.ToJson(d,true),new System.Text.UTF8Encoding(false));
            if(File.Exists(path))File.Replace(temporary,path,path+".bak");else File.Move(temporary,path);
        }
        public static void RequireTransformContract(Transform root)
        {
            if(Quaternion.Angle(root.rotation,Quaternion.identity)>.001f||(root.lossyScale-Vector3.one).sqrMagnitude>.000001f)
                throw new InvalidOperationException("LE-01 uses a horizontal metre grid: root rotation must be identity and world scale (1,1,1). Translation is supported and saved as Origin. Restore rotation/scale before saving or exporting.");
        }
        public static TerrainDocument NativeLoad(string path)
        {
            string json=File.ReadAllText(path);if(json.IndexOf("\"terrain\"",StringComparison.Ordinal)>=0||json.IndexOf("\"layer\"",StringComparison.Ordinal)>=0)throw new InvalidDataException("这是地形与模型的完整场景；请使用地编窗口的打开入口，保留模型层。");
            var d=JsonUtility.FromJson<TerrainDocument>(json);
            string error;if(!TerrainKernel.Validate(d,out error))throw new InvalidDataException(error);return d;
        }
        public static void SaveSceneMeshes(LE01TerrainAuthor author,string scene)
        {
            if(LE04TerrainSession.Has(author)){LE04TerrainFiles.SaveScene(author,scene);return;}
            if(LE01Stroke.IsEditing(author))throw new InvalidOperationException("Finish or cancel the active stroke or history restoration before saving a scene.");
            string normalized=scene.Replace('\\','/');var segments=normalized.Split('/');
            bool namesC=segments.Length>1&&segments[0]=="Assets"&&segments[1]=="LE01C";
            bool namesD=segments.Length>1&&segments[0]=="Assets"&&segments[1]=="LE02";
            bool namesE=segments.Length>1&&segments[0]=="Assets"&&segments[1]=="LE03";
            bool isolated=(namesC||namesD||namesE)&&segments.Length>=4&&(segments[2]=="Scenes"||segments[2]=="WorkScenes")&&string.Equals(Path.GetExtension(normalized),".unity",StringComparison.OrdinalIgnoreCase)
                &&segments.All(s=>!string.IsNullOrWhiteSpace(s)&&s!="."&&s!=".."&&s.IndexOfAny(Path.GetInvalidFileNameChars())<0);
            if((namesC||namesD||namesE)&&!isolated)throw new InvalidOperationException("Research scenes must be .unity files inside their Scenes or WorkScenes folder, without path traversal.");
            string generator=author.Read().GeneratorVersion;bool current=generator=="le01.2"||normalized.StartsWith("Assets/LE01B/",StringComparison.Ordinal)||isolated;
            if(generator=="le01.3"&&(!(namesD||namesE)||!isolated))throw new InvalidOperationException("Save the editable v3 scene under Assets/LE02 or Assets/LE03 Scenes/WorkScenes; earlier scenes are preserved.");
            if(generator=="le01.2"&&(!normalized.StartsWith("Assets/LE01B/Scenes/",StringComparison.Ordinal)&&!isolated||segments.Any(s=>s=="."||s=="..")))throw new InvalidOperationException("Save v2 candidate scenes under the explicit B/C/LE02 scene folders; legacy scene files are preserved.");
            LE01Export.Folder(Path.GetDirectoryName(scene).Replace('\\','/'));
            LE03Modules.EnsurePersistentMaterials(author);
            string prefix=namesE?"Assets/LE03/":namesD?"Assets/LE02/":"Assets/LE01C/";
            string dir=isolated?prefix+"Generated/"+normalized.Substring(prefix.Length,normalized.Length-prefix.Length-".unity".Length):(current?"Assets/LE01B/Generated/":"Assets/LE01/Generated/")+author.Read().Id;LE01Export.Folder(dir);
            foreach(var filter in Geometry(author).GetComponentsInChildren<MeshFilter>())
            {
                var mesh=filter.sharedMesh;bool persistent=AssetDatabase.Contains(mesh);
                string path=dir+"/"+mesh.name+".asset";var previous=AssetDatabase.LoadAssetAtPath<Mesh>(path);
                if(persistent){
                    if(!isolated||string.Equals(AssetDatabase.GetAssetPath(mesh),path,StringComparison.OrdinalIgnoreCase))continue;
                    // A copied Scene can still reference the original Scene's persistent
                    // chunks. Give every LE-01C Scene its own assets, even unchanged chunks.
                    var copy=UnityEngine.Object.Instantiate(mesh);copy.name=mesh.name;mesh=copy;
                }
                if(previous==null){AssetDatabase.CreateAsset(mesh,path);filter.sharedMesh=mesh;var c=filter.GetComponent<MeshCollider>();if(c!=null)c.sharedMesh=mesh;}
                else{EditorUtility.CopySerialized(mesh,previous);filter.sharedMesh=previous;var c=filter.GetComponent<MeshCollider>();if(c!=null)c.sharedMesh=previous;UnityEngine.Object.DestroyImmediate(mesh);}
            }
            AssetDatabase.SaveAssets();EditorSceneManager.SaveScene(author.gameObject.scene,scene);InvalidateSurfaceMaps(author);GeometryChanged(author);
        }
    }
}
