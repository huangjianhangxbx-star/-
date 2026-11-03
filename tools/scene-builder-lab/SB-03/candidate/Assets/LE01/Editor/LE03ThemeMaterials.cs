using System.IO;
using System.Runtime.CompilerServices;
using UnityEditor;
using UnityEngine;

namespace XingHai.LE01.Editor
{
    public static class LE03ThemeMaterials
    {
        sealed class ThemeCache { internal string json, id; }
        static readonly ConditionalWeakTable<LE01TerrainAuthor,ThemeCache> themes = new ConditionalWeakTable<LE01TerrainAuthor,ThemeCache>();
        static Material snowMaterial;
        static Texture2D snowPalette;
        const string Folder = "Assets/LE03/Materials";
        public static string ThemeFor(LE01TerrainAuthor author)
        {
            if(author==null)return "stone";
            var cache=themes.GetValue(author,_=>new ThemeCache());
            if(cache.json!=author.DocumentJson){cache.json=author.DocumentJson;cache.id=author.Read().TerrainThemeId;}
            return cache.id=="snow-rock"?"snow-rock":"stone";
        }
        public static Texture2D PaletteFor(string themeId)
        {
            if(themeId!="snow-rock")return LE01Export.Palette();
            if(snowPalette!=null)return snowPalette;
            LE01Export.Folder(Folder);string path=Folder+"/SnowRockPalette.png";
            if(!File.Exists(path))
            {
                var texture=new Texture2D(8,1,TextureFormat.RGBA32,false);
                try
                {
                    texture.SetPixels(new[]{new Color(.92f,.95f,.94f,1),new Color(.32f,.40f,.48f,1),new Color(.23f,.31f,.40f,1),new Color(.16f,.22f,.29f,1),new Color(.36f,.44f,.51f,1),new Color(.45f,.53f,.59f,1),new Color(.76f,.84f,.88f,1),new Color(.59f,.68f,.75f,1)});
                    texture.Apply();File.WriteAllBytes(path,texture.EncodeToPNG());
                }
                finally{Object.DestroyImmediate(texture);}
                AssetDatabase.ImportAsset(path,ImportAssetOptions.ForceSynchronousImport);
            }
            var importer=AssetImporter.GetAtPath(path) as TextureImporter;
            if(importer!=null&&(!importer.isReadable||!importer.sRGBTexture||importer.filterMode!=FilterMode.Point||importer.mipmapEnabled||importer.textureCompression!=TextureImporterCompression.Uncompressed||importer.wrapMode!=TextureWrapMode.Clamp))
            {
                importer.isReadable=true;importer.sRGBTexture=true;importer.filterMode=FilterMode.Point;importer.mipmapEnabled=false;importer.textureCompression=TextureImporterCompression.Uncompressed;importer.wrapMode=TextureWrapMode.Clamp;importer.SaveAndReimport();
            }
            return snowPalette=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }
        public static Material MaterialFor(LE01TerrainAuthor author,bool gray)
        {
            if(gray)return LE01Export.Material(true);
            if(ThemeFor(author)!="snow-rock")return LE01Export.Material(false);
            if(snowMaterial!=null)return snowMaterial;
            LE01Export.Folder(Folder);string path=Folder+"/SnowRockSurface.mat";
            snowMaterial=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(snowMaterial==null)
            {
                snowMaterial=new Material(Shader.Find("Universal Render Pipeline/Lit"));
                snowMaterial.SetColor("_BaseColor",Color.white);snowMaterial.SetTexture("_BaseMap",PaletteFor("snow-rock"));snowMaterial.SetFloat("_Smoothness",.05f);
                AssetDatabase.CreateAsset(snowMaterial,path);EditorUtility.SetDirty(snowMaterial);AssetDatabase.SaveAssetIfDirty(snowMaterial);
            }
            return snowMaterial;
        }
    }
}
