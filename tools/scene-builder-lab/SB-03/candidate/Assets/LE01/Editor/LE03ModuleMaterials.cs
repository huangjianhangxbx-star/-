using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public static class LE03ModuleMaterials
    {
        sealed class Resource {internal Texture2D texture;internal Material preview,persistent;}
        static readonly Dictionary<string,Resource> resources=new Dictionary<string,Resource>();
        static string Key(VoxelPaletteEntry[] palette)
        {
            using(var bytes=new MemoryStream())using(var writer=new BinaryWriter(bytes))using(var hash=SHA256.Create())
            {writer.Write(palette.Length);foreach(var entry in palette)foreach(float value in entry.rgba)writer.Write(value);writer.Flush();return BitConverter.ToString(hash.ComputeHash(bytes.ToArray())).Replace("-","").ToLowerInvariant();}
        }
        public static Material ForPalette(VoxelPaletteEntry[] palette,bool persistent)
        {
            if(palette==null||palette.Length==0||palette.Length>SystemInfo.maxTextureSize)throw new InvalidDataException("Mixed palette exceeds supported texture width.");
            string key=Key(palette);Resource resource;if(!resources.TryGetValue(key,out resource))resources[key]=resource=new Resource();
            if(persistent)
            {
                if(resource.persistent!=null)return resource.persistent;
                const string folder="Assets/LE03/Materials/Mixed";LE01Export.Folder(folder);string png=folder+"/"+key+".png",mat=folder+"/"+key+".mat";
                if(!File.Exists(png))
                {
                    var texture=Texture(palette);try{File.WriteAllBytes(png,texture.EncodeToPNG());}finally{UnityEngine.Object.DestroyImmediate(texture);}AssetDatabase.ImportAsset(png,ImportAssetOptions.ForceSynchronousImport);
                }
                var importer=AssetImporter.GetAtPath(png) as TextureImporter;
                if(importer!=null&&(!importer.isReadable||importer.filterMode!=FilterMode.Point||importer.mipmapEnabled||!importer.sRGBTexture||importer.textureCompression!=TextureImporterCompression.Uncompressed||importer.wrapMode!=TextureWrapMode.Clamp||importer.npotScale!=TextureImporterNPOTScale.None||importer.maxTextureSize<palette.Length))
                {importer.isReadable=true;importer.filterMode=FilterMode.Point;importer.mipmapEnabled=false;importer.sRGBTexture=true;importer.textureCompression=TextureImporterCompression.Uncompressed;importer.wrapMode=TextureWrapMode.Clamp;importer.npotScale=TextureImporterNPOTScale.None;importer.maxTextureSize=Mathf.Max(importer.maxTextureSize,Mathf.Max(32,Mathf.NextPowerOfTwo(palette.Length)));importer.SaveAndReimport();}
                resource.persistent=AssetDatabase.LoadAssetAtPath<Material>(mat);
                if(resource.persistent==null){resource.persistent=Material(AssetDatabase.LoadAssetAtPath<Texture2D>(png));AssetDatabase.CreateAsset(resource.persistent,mat);EditorUtility.SetDirty(resource.persistent);AssetDatabase.SaveAssetIfDirty(resource.persistent);}return resource.persistent;
            }
            if(resource.preview==null){resource.texture=Texture(palette);resource.texture.hideFlags=HideFlags.HideAndDontSave;resource.preview=Material(resource.texture);resource.preview.hideFlags=HideFlags.HideAndDontSave;}return resource.preview;
        }
        static Texture2D Texture(VoxelPaletteEntry[] palette)
        {
            var texture=new Texture2D(palette.Length,1,TextureFormat.RGBA32,false,false){filterMode=FilterMode.Point,wrapMode=TextureWrapMode.Clamp};var colors=new Color[palette.Length];for(int i=0;i<colors.Length;i++){var rgba=palette[i].rgba;colors[i]=new Color(rgba[0],rgba[1],rgba[2],rgba[3]);}texture.SetPixels(colors);texture.Apply();return texture;
        }
        static Material Material(Texture2D texture){var material=new Material(Shader.Find("Universal Render Pipeline/Lit"));material.SetColor("_BaseColor",Color.white);material.SetTexture("_BaseMap",texture);material.SetFloat("_Smoothness",.05f);return material;}
    }
}
