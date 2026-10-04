using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;
namespace Xinghai.MapEditor.Editor {
 // Only native workbench exports with their exact material snapshot use this adapter.
 // FBX alone cannot preserve the source color space or editable voxel identity.
 public sealed class NativeAssetMaterials : AssetPostprocessor {
  public override int GetPostprocessOrder(){return 10000;}
  public override uint GetVersion(){return 5;}
  string Sidecar {get{var common=Path.ChangeExtension(assetPath,"xhmaterials.json");return File.Exists(common)?common:Path.ChangeExtension(assetPath,"xhasset.json");}}
  bool HasSidecar {get{return assetPath.EndsWith(".fbx",StringComparison.OrdinalIgnoreCase)&&File.Exists(Sidecar);}}
  void OnPreprocessModel(){if(HasSidecar)context.DependsOnSourceAsset(Sidecar);}
  static float Scalar(JToken token,string label,float max=1){if(token==null||(token.Type!=JTokenType.Float&&token.Type!=JTokenType.Integer))throw new Exception("材质缺少数值 "+label);float n=token.Value<float>();if(float.IsNaN(n)||float.IsInfinity(n)||n<0||n>max)throw new Exception("材质数值无效 "+label);return n;}
  static Color ColorValue(JToken token,string label,float max=1){if(!(token is JArray a)||a.Count!=3)throw new Exception("材质颜色无效 "+label);return new Color(Scalar(a[0],label,max),Scalar(a[1],label,max),Scalar(a[2],label,max),1);}
  void OnPostprocessModel(GameObject root){if(HasSidecar)foreach(var material in root.GetComponentsInChildren<Renderer>(true).SelectMany(r=>r.sharedMaterials).Distinct())Apply(material);}
  void Apply(Material material){
   if(!HasSidecar)return;var root=JObject.Parse(File.ReadAllText(Sidecar));var profile=root.Value<string>("schema")=="xinghai-fbx-materials-1"?root:root["materialProfile"];
   if(root.Value<string>("schema")!="xinghai-fbx-materials-1"&&(root.Value<string>("schema")!="xinghai-native-asset-1"||profile?.Value<string>("schema")!="xinghai-palette-1"))throw new Exception("原生资产/材质旁车契约无效："+Sidecar);
   var matches=((JArray)profile["colors"]).Where(c=>c.Value<string>("colorId")==material.name).ToArray();if(matches.Length!=1)throw new Exception("材质 colorId 缺失或重复："+material.name);var c=matches[0];
   var color=ColorValue(c["baseColor_sRGB"],"baseColor_sRGB");color.a=Scalar(c["alpha"],"alpha");string mode=c.Value<string>("alphaMode");var shader=Shader.Find(c.Value<bool>("doubleSided")?"Xinghai/Exchange Double Sided"+(mode=="BLEND"?" Blend":""):"Standard");if(shader==null)throw new Exception("缺少双面接收材质Shader");material.shader=shader;
   if(c.Value<bool>("baseColorTexture")){
    string relative=c.Value<string>("baseColorTexturePath");
    if(!string.IsNullOrEmpty(relative)){
     string directory=Path.GetFullPath(Path.GetDirectoryName(Sidecar)),full=Path.GetFullPath(Path.Combine(directory,relative));
     if(Path.IsPathRooted(relative)||!full.StartsWith(directory+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)||!File.Exists(full))throw new Exception("缺失或越界的FBX贴图依赖："+relative);
     string texturePath=Path.GetDirectoryName(Sidecar).Replace((char)92,(char)47)+"/"+relative.Replace((char)92,(char)47);context.DependsOnSourceAsset(texturePath);
     var texture=AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath);if(texture==null)throw new Exception("FBX贴图尚未导入或格式无效："+texturePath);material.mainTexture=texture;
    }
    if(material.mainTexture==null)throw new Exception("FBX颜色贴图缺失："+material.name);
   }
   material.color=color;material.SetFloat("_Metallic",Scalar(c["metallic"],"metallic"));material.SetFloat("_Glossiness",1-Scalar(c["roughness"],"roughness"));
   var emission=ColorValue(c["emissive"],"emissive",100000)*Scalar(c["emissiveStrength"],"emissiveStrength",100000);material.SetColor("_EmissionColor",emission.gamma);if(emission.maxColorComponent>0)material.EnableKeyword("_EMISSION");else material.DisableKeyword("_EMISSION");
   material.DisableKeyword("_ALPHATEST_ON");material.DisableKeyword("_ALPHABLEND_ON");material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
   if(mode=="OPAQUE"){material.SetFloat("_Mode",0);material.SetOverrideTag("RenderType","");material.SetInt("_SrcBlend",1);material.SetInt("_DstBlend",0);material.SetInt("_ZWrite",1);material.renderQueue=-1;}
   else if(mode=="MASK"){material.SetFloat("_Mode",1);material.SetOverrideTag("RenderType","TransparentCutout");material.EnableKeyword("_ALPHATEST_ON");material.SetFloat("_Cutoff",c["alphaCutoff"]==null?.5f:Scalar(c["alphaCutoff"],"alphaCutoff"));material.SetInt("_SrcBlend",1);material.SetInt("_DstBlend",0);material.SetInt("_ZWrite",1);material.renderQueue=2450;}
   else if(mode=="BLEND"){material.SetFloat("_Mode",2);material.SetOverrideTag("RenderType","Transparent");material.EnableKeyword("_ALPHABLEND_ON");material.SetInt("_SrcBlend",5);material.SetInt("_DstBlend",10);material.SetInt("_ZWrite",0);material.renderQueue=3000;}
   else throw new Exception("不支持的 alphaMode："+mode);

  }
 }
}
