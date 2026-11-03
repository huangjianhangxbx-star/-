using System;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEngine;
using UnityEditor.Formats.Fbx.Exporter;

namespace XingHai.LE01.Editor
{
    public static class LE01Export
    {
        public static string TaskRoot { get { return Directory.GetParent(Directory.GetParent(Application.dataPath).FullName).FullName; } }
        public static string IterationRoot {get{return Path.Combine(Directory.GetParent(TaskRoot).FullName,"LE-01B");}}
        public static void Folder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            var parent = Path.GetDirectoryName(path).Replace('\\','/');
            Folder(parent); AssetDatabase.CreateFolder(parent, Path.GetFileName(path));
        }
        public static Texture2D Palette()
        {
            const string path="Assets/LE01/Materials/TerrainPalette.png";
            Folder("Assets/LE01/Materials");
            if (!File.Exists(path)) {
                var t = new Texture2D(8,1,TextureFormat.RGBA32,false);
                t.SetPixels(new[]{new Color(.61f,.69f,.65f),new Color(.40f,.46f,.50f),new Color(.26f,.33f,.39f),new Color(.23f,.27f,.30f),new Color(.52f,.58f,.56f),new Color(.69f,.72f,.66f),new Color(.45f,.51f,.49f),Color.white});
                t.Apply(); File.WriteAllBytes(path,t.EncodeToPNG()); UnityEngine.Object.DestroyImmediate(t);
                AssetDatabase.ImportAsset(path,ImportAssetOptions.ForceSynchronousImport);
            }
            var importer=(TextureImporter)AssetImporter.GetAtPath(path);
            importer.filterMode=FilterMode.Point; importer.mipmapEnabled=false; importer.textureCompression=TextureImporterCompression.Uncompressed; importer.wrapMode=TextureWrapMode.Clamp;
            if (importer.isReadable==false) {importer.isReadable=true;importer.SaveAndReimport();}
            return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }
        public static Material Material(bool gray=false)
        {
            Folder("Assets/LE01/Materials");
            string path="Assets/LE01/Materials/"+(gray?"TerrainGray":"TerrainSurface")+".mat";
            var m=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(m!=null)return m;
            if(m==null){m=new Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(m,path);}
            m.SetColor("_BaseColor",gray?new Color(.66f,.68f,.69f):Color.white);
            m.SetTexture("_BaseMap",gray?null:Palette());m.SetFloat("_Smoothness",.05f);EditorUtility.SetDirty(m);return m;
        }
        public static string Export(GameObject geometry,string destination)
        {
            if(geometry!=null&&LE01Stroke.IsEditing(geometry.GetComponentInParent<LE01TerrainAuthor>()))throw new InvalidOperationException("Finish or cancel the active stroke before exporting.");
            if(geometry==null||geometry.GetComponentsInChildren<MeshFilter>(true).Length==0)throw new InvalidOperationException("No committed terrain to export.");
            LE01Adapter.RequireTransformContract(geometry.transform);
            foreach(var child in geometry.GetComponentsInChildren<Transform>(true))if(child!=geometry.transform&&(child.localPosition.sqrMagnitude>.000001f||Quaternion.Angle(child.localRotation,Quaternion.identity)>.001f||(child.localScale-Vector3.one).sqrMagnitude>.000001f))throw new InvalidOperationException("Derived terrain chunks must keep identity local transforms. Rebuild the terrain before exporting.");
            destination=Path.GetFullPath(destination);Directory.CreateDirectory(Path.GetDirectoryName(destination));
            var sourceAuthor=geometry.GetComponentInParent<LE01TerrainAuthor>();bool basic=LE04TerrainSession.Has(sourceAuthor);bool mixed=!basic&&LE03Modules.HasLayer(sourceAuthor);
            if(mixed&&!LE01Adapter.GeometryMatchesAuthor(sourceAuthor)){var world=LE03Modules.BuildForEvidence(sourceAuthor);LE01Adapter.Upload(sourceAuthor,world.geometry,true,true);}
            var palette=basic?LE04TerrainFiles.ExportPalette(sourceAuthor):mixed?LE03Modules.ExportPalette(sourceAuthor):LE03ThemeMaterials.PaletteFor(LE03ThemeMaterials.ThemeFor(sourceAuthor));
            var clone=UnityEngine.Object.Instantiate(geometry);clone.name="LE01_Terrain";clone.transform.position=Vector3.zero;clone.transform.rotation=Quaternion.identity;clone.transform.localScale=Vector3.one;
            var mats=new System.Collections.Generic.List<Material>();
            try {
                foreach(var t in clone.GetComponentsInChildren<Transform>(true))t.gameObject.SetActive(true);
                foreach(var component in clone.GetComponentsInChildren<Component>(true))
                    if(component!=null&&!(component is Transform)&&!(component is MeshFilter)&&!(component is MeshRenderer))UnityEngine.Object.DestroyImmediate(component);
                foreach(var r in clone.GetComponentsInChildren<MeshRenderer>(true)){
                    r.SetPropertyBlock(null);
                    var m=new Material(Shader.Find("Standard"));m.name="LE01_PortablePalette";m.color=Color.white;m.mainTexture=palette;m.SetFloat("_Glossiness",0);mats.Add(m);r.sharedMaterial=m;
                }
                // The resolved official 4.2.1 package exposes texture embedding through its internal options.
                // Keep the version pinned and fail explicitly if that contract changes.
                var asm=typeof(ModelExporter).Assembly;
                var type=asm.GetType("UnityEditor.Formats.Fbx.Exporter.ExportModelSettingsSerialize",true);
                var options=Activator.CreateInstance(type,true);
                type.GetMethod("SetEmbedTextures").Invoke(options,new object[]{true});
                var fmt=asm.GetType("UnityEditor.Formats.Fbx.Exporter.ExportSettings+ExportFormat",true);
                type.GetMethod("SetExportFormat").Invoke(options,new[]{Enum.Parse(fmt,"Binary")});
                var method=typeof(ModelExporter).GetMethods(BindingFlags.Static|BindingFlags.NonPublic).Single(x=>x.Name=="ExportObject"&&x.GetParameters().Length==3);
                var result=method.Invoke(null,new object[]{destination,clone,options}) as string;
                if(string.IsNullOrEmpty(result)||!File.Exists(destination)||new FileInfo(destination).Length<100)throw new IOException("Official FBX export did not produce a file.");
                string palettePath=AssetDatabase.GetAssetPath(palette);File.Copy(palettePath,Path.Combine(Path.GetDirectoryName(destination),Path.GetFileName(palettePath)),true);
                Debug.Log("LE01_FBX_EXPORT_PASS file="+Path.GetFileName(destination)+" meshes="+clone.GetComponentsInChildren<MeshFilter>(true).Length+" embeddedPalette=true");return result;
            } finally {UnityEngine.Object.DestroyImmediate(clone);foreach(var m in mats)UnityEngine.Object.DestroyImmediate(m);}
        }
        public static void EarlyProbe()
        {
            var go=new GameObject("LE01_OneMetreProbe");var mesh=new Mesh();
            var v=new System.Collections.Generic.List<Vector3>();var uv=new System.Collections.Generic.List<Vector2>();var tr=new System.Collections.Generic.List<int>();
            Action<Vector3,Vector3,Vector3,Vector3,int> q=(a,b,c,d,slot)=>{int n=v.Count;v.AddRange(new[]{a,b,c,d});uv.AddRange(Enumerable.Repeat(new Vector2((slot+.5f)/8,.5f),4));tr.AddRange(new[]{n,n+1,n+2,n,n+2,n+3});};
            q(new Vector3(0,0,0),new Vector3(0,0,1),new Vector3(0,1,1),new Vector3(0,1,0),1);
            q(new Vector3(1,0,1),new Vector3(1,0,0),new Vector3(1,1,0),new Vector3(1,1,1),2);
            q(new Vector3(0,1,1),new Vector3(1,1,1),new Vector3(1,1,0),new Vector3(0,1,0),0);
            q(new Vector3(0,0,0),new Vector3(1,0,0),new Vector3(1,0,1),new Vector3(0,0,1),3);
            q(new Vector3(1,0,0),new Vector3(0,0,0),new Vector3(0,1,0),new Vector3(1,1,0),1);
            q(new Vector3(0,0,1),new Vector3(1,0,1),new Vector3(1,1,1),new Vector3(0,1,1),2);
            mesh.SetVertices(v);mesh.SetUVs(0,uv);mesh.SetTriangles(tr,0);mesh.RecalculateNormals();mesh.RecalculateBounds();
            go.AddComponent<MeshFilter>().sharedMesh=mesh;go.AddComponent<MeshRenderer>().sharedMaterial=Material();
            try{Export(go,Path.Combine(TaskRoot,"exports","probe-1m.fbx"));AssetDatabase.SaveAssets();Debug.Log("LE01_EARLY_FBX_PROBE_PASS bounds="+mesh.bounds);}
            finally{UnityEngine.Object.DestroyImmediate(go);UnityEngine.Object.DestroyImmediate(mesh);}
        }
    }
}
