using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using UnityEditor;
using UnityEngine;
namespace XingHai.BridgeReplica.Editor
{
    [Serializable] public sealed class KitInputAsset
    {
        public string role,id,title,fbx,palette,source,preview;
        public float[] logicalSizeMeters;
        public float unityAdapterYaw=180;
    }
    [Serializable] public sealed class KitInput
    {public string id,version,family;public KitInputAsset[] assets;}
    public static class ReplicaKitRegistry
    {
        public const string Family="bridge-orthogonal-v1";
        static readonly Dictionary<string,Vector3> sizes=new Dictionary<string,Vector3>{
            {"tread",new Vector3(.5f,.25f,.5f)},{"deck",new Vector3(.5f,.25f,.5f)},
            {"coping",new Vector3(.5f,.25f,.25f)},{"rail",new Vector3(.5f,1,.125f)},
            {"post",new Vector3(.25f,1.25f,.25f)},{"arch-stone",new Vector3(.25f,.25f,.25f)},
            {"arch-foot",new Vector3(.5f,.5f,.25f)},{"keystone",new Vector3(.5f,.5f,.25f)},
            {"abutment-cap",new Vector3(.5f,.25f,.5f)}};
        public static void Folder(string path)
        {path=path.Replace('\\','/');if(path=="Assets"||AssetDatabase.IsValidFolder(path))return;if(!path.StartsWith("Assets/"))throw new InvalidOperationException("资源目录须位于Assets内。");Folder(Path.GetDirectoryName(path).Replace('\\','/'));AssetDatabase.CreateFolder(Path.GetDirectoryName(path).Replace('\\','/'),Path.GetFileName(path));}
        public static string Hash(byte[] data){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(data)).Replace("-","");}
        public static string HashFile(string path){return Hash(File.ReadAllBytes(path));}
        public static ReplicaKit[] All(){return AssetDatabase.FindAssets("t:ReplicaKit",new[]{"Assets/BridgeReplica"}).Select(g=>AssetDatabase.LoadAssetAtPath<ReplicaKit>(AssetDatabase.GUIDToAssetPath(g))).Where(k=>k!=null).OrderBy(k=>k.Id,StringComparer.Ordinal).ThenBy(k=>k.Version,StringComparer.Ordinal).ToArray();}
        public static Vector3 RequiredSize(string role){Vector3 s;if(!sizes.TryGetValue(role,out s))throw new InvalidDataException("不支持的构件职责："+role);return s;}
        static string SafeSource(string folder,string relative)
        {
            if(string.IsNullOrWhiteSpace(relative)||Path.IsPathRooted(relative))throw new InvalidDataException("源路径须相对于套件目录。");
            string root=Path.GetFullPath(folder)+Path.DirectorySeparatorChar,full=Path.GetFullPath(Path.Combine(folder,relative));
            if(!full.StartsWith(root,StringComparison.OrdinalIgnoreCase)||!File.Exists(full))throw new InvalidDataException("源文件不存在或越出套件目录："+relative);return full;
        }
        public static ReplicaKit Register(string descriptor)
        {
            var input=JsonUtility.FromJson<KitInput>(File.ReadAllText(descriptor));string dir=Path.GetDirectoryName(Path.GetFullPath(descriptor));
            return RegisterInput(input,(a,kind)=>SafeSource(dir,kind=="model"?a.fbx:kind=="palette"?a.palette:a.source));
        }
        public static ReplicaKit EnsureBase()
        {
            foreach(var old in All())if(old.Id=="workshop.bridge.A"){Validate(old);return old;}
            const string root="Assets/SB03/Kit/";var oldKit=JsonUtility.FromJson<XingHai.SB03.Editor.SB03KitContract>(File.ReadAllText(root+"contracts.json"));
            var input=new KitInput{id="workshop.bridge.A",version="1",family=Family,assets=oldKit.assets.Select(a=>new KitInputAsset{role=a.id.Substring("sb03.".Length),id=a.id,title=a.title,fbx=a.fbx,palette=a.palette,source=a.source,logicalSizeMeters=a.logicalSizeMeters,unityAdapterYaw=a.unityAdapterYaw}).ToArray()};
            return RegisterInput(input,(a,kind)=>kind=="native"?null:root+(kind=="model"?a.fbx:a.palette));
        }
        static ReplicaKit RegisterInput(KitInput input,Func<KitInputAsset,string,string> source)
        {
            if(input==null||input.family!=Family||string.IsNullOrWhiteSpace(input.id)||string.IsNullOrWhiteSpace(input.version)||input.assets==null)throw new InvalidDataException("缺少套件身份或不属于桥梁固定接口族v1。");
            if(input.id.Length>100||input.version.Length>40)throw new InvalidDataException("套件身份过长。");
            if(input.assets.Length!=sizes.Count||input.assets.Select(a=>a.role).Distinct().Count()!=sizes.Count)throw new InvalidDataException("本轮登记需明确提供9种职责；不以默认方块补缺件。");
            var files=new List<Tuple<KitInputAsset,string,string,string>>();var fingerprints=new StringBuilder();
            foreach(var a in input.assets.OrderBy(a=>a.role,StringComparer.Ordinal))
            {
                Vector3 required=RequiredSize(a.role);if(a.logicalSizeMeters==null||a.logicalSizeMeters.Length!=3||Vector3.Distance(required,new Vector3(a.logicalSizeMeters[0],a.logicalSizeMeters[1],a.logicalSizeMeters[2]))>.00001f)throw new InvalidDataException(a.role+"逻辑尺寸不兼容；本轮不支持改变接口尺寸。");
                if(a.unityAdapterYaw!=0&&a.unityAdapterYaw!=90&&a.unityAdapterYaw!=180&&a.unityAdapterYaw!=270)throw new InvalidDataException(a.role+"适配旋转须为正交角度。");
                string model=source(a,"model"),palette=source(a,"palette"),native=source(a,"native");
                if(model==null||palette==null||!File.Exists(model)||!File.Exists(palette)||new FileInfo(model).Length>16*1024*1024)throw new InvalidDataException(a.role+"模型/色板缺失或超过单件预算。");
                if(!model.EndsWith(".fbx",StringComparison.OrdinalIgnoreCase)||!palette.EndsWith(".png",StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("本族消费palette FBX和PNG。");
                fingerprints.Append(a.role).Append('|').Append(a.id).Append('|').Append(a.unityAdapterYaw).Append('|').Append(HashFile(model)).Append('|').Append(HashFile(palette)).Append('\n');files.Add(Tuple.Create(a,model,palette,native));
            }
            string hash=Hash(Encoding.UTF8.GetBytes(Family+"|"+input.id+"|"+input.version+"\n"+fingerprints));
            string folder="Assets/BridgeReplica/Kits/"+Hash(Encoding.UTF8.GetBytes(input.id)).Substring(0,12)+"/"+hash.Substring(0,16);Folder(folder);
            string kitPath=folder+"/Kit.asset";var existing=AssetDatabase.LoadAssetAtPath<ReplicaKit>(kitPath);if(existing!=null){Validate(existing);return existing;}
            var kit=ScriptableObject.CreateInstance<ReplicaKit>();kit.Id=input.id;kit.Version=input.version;kit.Family=Family;kit.ContentHash=hash;var bindings=new List<ReplicaBinding>();
            try
            {
                foreach(var pair in files)
                {
                    var a=pair.Item1;string fbx=folder+"/"+a.role+".fbx",png=folder+"/"+a.role+".png";File.Copy(pair.Item2,fbx,true);File.Copy(pair.Item3,png,true);AssetDatabase.ImportAsset(fbx,ImportAssetOptions.ForceSynchronousImport);AssetDatabase.ImportAsset(png,ImportAssetOptions.ForceSynchronousImport);
                    var importer=(ModelImporter)AssetImporter.GetAtPath(fbx);importer.isReadable=true;importer.SaveAndReimport();
                    var textureImporter=(TextureImporter)AssetImporter.GetAtPath(png);textureImporter.filterMode=FilterMode.Point;textureImporter.wrapMode=TextureWrapMode.Clamp;textureImporter.mipmapEnabled=false;textureImporter.SaveAndReimport();
                    var material=new Material(Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard"));var texture=AssetDatabase.LoadAssetAtPath<Texture2D>(png);material.mainTexture=texture;material.color=Color.white;if(material.HasProperty("_BaseMap"))material.SetTexture("_BaseMap",texture);if(material.HasProperty("_BaseColor"))material.SetColor("_BaseColor",Color.white);if(material.HasProperty("_Smoothness"))material.SetFloat("_Smoothness",0);AssetDatabase.CreateAsset(material,folder+"/"+a.role+".mat");
                    var binding=new ReplicaBinding{Role=a.role,Id=a.id,Title=a.title,Size=RequiredSize(a.role),AdapterYaw=a.unityAdapterYaw,ModelPath=fbx,PalettePath=png,ModelSha256=HashFile(fbx),PaletteSha256=HashFile(png),NativeSource=pair.Item4,NativeSha256=pair.Item4!=null&&File.Exists(pair.Item4)?HashFile(pair.Item4):"inherited SB03 original source",Material=material};
                    CheckEnvelope(binding);bindings.Add(binding);
                }
                kit.Bindings=bindings.ToArray();AssetDatabase.CreateAsset(kit,kitPath);AssetDatabase.SaveAssets();return kit;
            }
            catch{UnityEngine.Object.DestroyImmediate(kit);throw;}
        }
        static void CheckEnvelope(ReplicaBinding binding)
        {
            var model=AssetDatabase.LoadAssetAtPath<GameObject>(binding.ModelPath);if(model==null)throw new InvalidDataException(binding.Role+"没有可导入模型。");var temp=UnityEngine.Object.Instantiate(model);temp.transform.position=Vector3.zero;
            try
            {
                bool any=false;var bounds=new Bounds();var rotation=Matrix4x4.Rotate(Quaternion.Euler(0,binding.AdapterYaw,0));
                foreach(var f in temp.GetComponentsInChildren<MeshFilter>(true)){if(f.sharedMesh==null||f.sharedMesh.uv.Length!=f.sharedMesh.vertexCount)throw new InvalidDataException(binding.Role+"缺少完整UV。");foreach(var p in f.sharedMesh.vertices){var point=(rotation*f.transform.localToWorldMatrix).MultiplyPoint3x4(p);if(!any){bounds=new Bounds(point,Vector3.zero);any=true;}else bounds.Encapsulate(point);}}
                var expected=new Bounds(new Vector3(0,binding.Size.y/2,0),binding.Size);
                if(!any||Vector3.Distance(bounds.min,expected.min)>.001f||Vector3.Distance(bounds.max,expected.max)>.001f)throw new InvalidDataException(binding.Role+"实际包围盒/枢轴不符合登记接口。实际"+bounds+"；要求"+expected);
            }finally{UnityEngine.Object.DestroyImmediate(temp);}
        }
        public static void Validate(ReplicaKit kit)
        {
            if(kit==null||kit.Family!=Family||kit.Bindings==null||kit.Bindings.Length!=9)throw new InvalidDataException("套件缺失或接口族不兼容。");
            foreach(var b in kit.Bindings){if(b==null||!File.Exists(b.ModelPath)||HashFile(b.ModelPath)!=b.ModelSha256||!File.Exists(b.PalettePath)||HashFile(b.PalettePath)!=b.PaletteSha256||b.Material==null)throw new InvalidDataException("套件源文件或版本发生变化；请重新登记为新版本，当前作品保留。");if(Vector3.Distance(b.Size,RequiredSize(b.Role))>.00001f)throw new InvalidDataException("固定接口尺寸不符："+b.Role);}
        }
    }
}
