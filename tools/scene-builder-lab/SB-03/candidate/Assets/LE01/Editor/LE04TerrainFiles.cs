using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    [Serializable] public sealed class BasicTerrainFile
    {
        public int schemaVersion=2;public string kind="basic-terrain-v2";
        public TerrainDocument terrain;public TerrainEditState editState;public string brushJson;
    }
    public static class LE04TerrainFiles
    {
        static readonly Dictionary<string,Material> preview=new Dictionary<string,Material>();
        public static bool IsFile(string json) { return json!=null&&json.IndexOf("\"basic-terrain-v2\"",StringComparison.Ordinal)>=0; }
        public static BasicTerrainFile Read(string json)
        {
            var file=JsonUtility.FromJson<BasicTerrainFile>(json);
            if(file==null||file.kind!="basic-terrain-v2"||file.schemaVersion!=2||file.editState==null||file.editState.Version!=2)throw new InvalidDataException("未知基础地貌版本，未修改当前作品。");
            string error;if(!TerrainKernel.Validate(file.terrain,out error))throw new InvalidDataException(error);
            TerrainEffectiveSource.Validate(file.editState);
            foreach(var reference in file.editState.References){if(reference==null||!VoxelModules.ValidateAsset(reference.Asset,out error)||reference.SourceHash!=reference.Asset.sourceHash)throw new InvalidDataException(error??"参考来源身份不一致。");}
            TerrainEffectiveSource.Capture(file.terrain,file.editState);return file;
        }
        public static void Save(LE01TerrainAuthor author,string path)
        {
            var session=LE04TerrainSession.Get(author);if(session==null||session.Busy)throw new InvalidOperationException("请先应用或取消当前候选，并等待后台完成。");
            LE01Adapter.RequireTransformContract(author.transform);session.PersistSettings();var state=author.GetComponent<LE04TerrainState>();var terrain=author.Read();
            terrain.OriginX=author.transform.position.x;terrain.OriginY=author.transform.position.y;terrain.OriginZ=author.transform.position.z;
            var edits=state.Read();edits.BaseTerrainHash=TerrainQueries.ContentHash(terrain);
            var file=new BasicTerrainFile{terrain=terrain,editState=edits,brushJson=state.BrushJson};string json=JsonUtility.ToJson(file,true);Read(json);
            if(File.Exists(path)&&!IsFile(File.ReadAllText(path)))throw new InvalidOperationException("请另存基础地貌 v2 文件，保留原版作者或完整模型场景。");
            string full=Path.GetFullPath(path);Directory.CreateDirectory(Path.GetDirectoryName(full));File.WriteAllText(full+".tmp",json,new System.Text.UTF8Encoding(false));
            if(File.Exists(full))File.Replace(full+".tmp",full,full+".bak");else File.Move(full+".tmp",full);
        }
        public static void LoadInto(LE01TerrainAuthor author,BasicTerrainFile file)
        {
            if(LE03Modules.HasLayer(author))throw new InvalidOperationException("旧混合场景保持原样；请在新基础地貌对象中打开 v2 文件。");
            LE04TerrainSession.Forget(author);Undo.IncrementCurrentGroup();int undoGroup=Undo.GetCurrentGroup();Undo.SetCurrentGroupName("打开基础地貌 v2");Undo.RecordObject(author,"打开基础地貌 v2");Undo.RecordObject(author.transform,"打开基础地貌 v2");author.Write(file.terrain);
            author.transform.position=new Vector3(file.terrain.OriginX,file.terrain.OriginY,file.terrain.OriginZ);
            var component=author.GetComponent<LE04TerrainState>();if(component==null)component=Undo.AddComponent<LE04TerrainState>(author.gameObject);Undo.RecordObject(component,"打开基础地貌 v2");component.Write(file.editState);component.BrushJson=file.brushJson;
            EditorUtility.SetDirty(author);EditorUtility.SetDirty(component);EditorSceneManager.MarkSceneDirty(author.gameObject.scene);Undo.FlushUndoRecordObjects();Undo.CollapseUndoOperations(undoGroup);LE04TerrainSession.Get(author);
        }
        public static Texture2D TextureFor(IList<VoxelPaletteEntry> palette)
        {
            var texture=new Texture2D(256,1,TextureFormat.RGBA32,false,false){filterMode=FilterMode.Point,wrapMode=TextureWrapMode.Clamp};var colors=Enumerable.Repeat(Color.magenta,256).ToArray();
            for(int i=0;i<palette.Count&&i<256;i++){var c=palette[i].rgba;colors[i]=new Color(c[0],c[1],c[2],c[3]);}texture.SetPixels(colors);texture.Apply();return texture;
        }
        public static Material MaterialFor(IList<VoxelPaletteEntry> palette,bool persistent)
        {
            string json=JsonUtility.ToJson(new PaletteWrapper{entries=palette.ToList()});string key;using(var sha=SHA256.Create())key=BitConverter.ToString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(json))).Replace("-","").ToLowerInvariant();
            if(!persistent){Material cached;if(preview.TryGetValue(key,out cached)&&cached!=null)return cached;var texture=TextureFor(palette);texture.hideFlags=HideFlags.HideAndDontSave;cached=MakeMaterial(texture);cached.hideFlags=HideFlags.HideAndDontSave;preview[key]=cached;return cached;}
            const string folder="Assets/LE04/Materials";LE01Export.Folder(folder);string png=folder+"/"+key+".png",mat=folder+"/"+key+".mat";
            if(!File.Exists(png)){var texture=TextureFor(palette);File.WriteAllBytes(png,texture.EncodeToPNG());UnityEngine.Object.DestroyImmediate(texture);AssetDatabase.ImportAsset(png,ImportAssetOptions.ForceSynchronousImport);}
            var importer=(TextureImporter)AssetImporter.GetAtPath(png);if(!importer.isReadable||importer.filterMode!=FilterMode.Point||importer.mipmapEnabled||importer.textureCompression!=TextureImporterCompression.Uncompressed||importer.npotScale!=TextureImporterNPOTScale.None){importer.isReadable=true;importer.filterMode=FilterMode.Point;importer.mipmapEnabled=false;importer.wrapMode=TextureWrapMode.Clamp;importer.sRGBTexture=true;importer.npotScale=TextureImporterNPOTScale.None;importer.textureCompression=TextureImporterCompression.Uncompressed;importer.SaveAndReimport();}
            var result=AssetDatabase.LoadAssetAtPath<Material>(mat);if(result==null){result=MakeMaterial(AssetDatabase.LoadAssetAtPath<Texture2D>(png));AssetDatabase.CreateAsset(result,mat);}return result;
        }
        [Serializable] sealed class PaletteWrapper {public List<VoxelPaletteEntry> entries;}
        static Material MakeMaterial(Texture2D texture){var material=new Material(Shader.Find("Universal Render Pipeline/Lit"));material.SetColor("_BaseColor",Color.white);material.SetTexture("_BaseMap",texture);material.SetFloat("_Smoothness",.05f);return material;}
        public static Texture2D ExportPalette(LE01TerrainAuthor author){var material=MaterialFor(author.GetComponent<LE04TerrainState>().Read().Palette,true);return material.GetTexture("_BaseMap") as Texture2D;}
        public static void SaveScene(LE01TerrainAuthor author,string scene)
        {
            var session=LE04TerrainSession.Get(author);if(session==null||session.Busy)throw new InvalidOperationException("请先应用或取消候选，并等待后台完成。");
            LE01Adapter.RequireTransformContract(author.transform);
            string normalized=scene.Replace('\\','/');if(!normalized.StartsWith("Assets/LE04/Scenes/",StringComparison.Ordinal)&&!normalized.StartsWith("Assets/LE04/WorkScenes/",StringComparison.Ordinal))throw new InvalidOperationException("基础地貌 v2 场景请另存到 Assets/LE04/Scenes 或 WorkScenes。");
            if(normalized.Split('/').Any(s=>s==".."||s==".")||Path.GetExtension(normalized)!=".unity")throw new InvalidOperationException("无效研究场景路径。");
            session.PersistSettings();LE01Export.Folder(Path.GetDirectoryName(normalized).Replace('\\','/'));string folder="Assets/LE04/Generated/"+normalized.Substring("Assets/LE04/".Length,normalized.Length-"Assets/LE04/".Length-".unity".Length);LE01Export.Folder(folder);
            var material=MaterialFor(author.GetComponent<LE04TerrainState>().Read().Palette,true);
            foreach(var filter in LE01Adapter.Geometry(author).GetComponentsInChildren<MeshFilter>())
            {
                var source=filter.sharedMesh;if(source==null)continue;string path=folder+"/"+source.name+".asset";var existing=AssetDatabase.LoadAssetAtPath<Mesh>(path);
                if(existing!=source){if(existing==null){existing=UnityEngine.Object.Instantiate(source);existing.name=source.name;AssetDatabase.CreateAsset(existing,path);}else EditorUtility.CopySerialized(source,existing);filter.sharedMesh=existing;var collider=filter.GetComponent<MeshCollider>();if(collider!=null)collider.sharedMesh=existing;}
                filter.GetComponent<MeshRenderer>().sharedMaterial=material;
            }
            AssetDatabase.SaveAssets();if(!EditorSceneManager.SaveScene(author.gameObject.scene,normalized))throw new IOException("场景保存未成功。");
        }
        public static VoxelModuleAsset ReadReference(string json)
        {
            if(System.Text.RegularExpressions.Regex.IsMatch(json,"\"faces\"\\s*:\\s*\\[\\s*\\]"))throw new InvalidDataException("显式空 faces 无效；请导出完整面色或省略 faces。");
            var asset=JsonUtility.FromJson<VoxelModuleAsset>(json);if(asset==null||asset.voxels==null)throw new InvalidDataException("参考源没有真实占据。");
            foreach(var cell in asset.voxels)if(cell.faces==null||cell.faces.Length==0)cell.faces=Enumerable.Repeat(cell.material,6).ToArray();
            string error;if(!VoxelModules.ValidateAsset(asset,out error))throw new InvalidDataException(error);return asset;
        }
    }
}
