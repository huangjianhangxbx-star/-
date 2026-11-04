using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.BridgeReplica.Research;

namespace XingHai.BridgeReplica.Editor
{
    /// <summary>Local research adapter only. The three source roles are our configuration,
    /// not a claim about Tiny Glade's original stair/bridge consumption algorithm.</summary>
    public static class ResearchKitImporter
    {
        public const string PrivateRoot = "Assets/BridgeReplica/ResearchPrivate";
        const string AdapterVersion = "native-json-affine-v2.1";
        static readonly string[] Roles = { "tread", "deck", "rail" };
        static readonly string[] Files = { "stair_step.json", "stairs_step.json", "wooden_plank_straight.json" };
        sealed class Input { public string Role, File; public ResearchSourceMesh Source; public ResearchConvertedMesh Converted; }
        [Serializable] sealed class SourceRecord
        {
            public string role, sourceFile, sourceSha256, meshAsset, meshSha256, normalizedGeometrySha256, attributeArchive, usage;
            public int vertices, triangles;
            public string[] originalAttributes;
            public float[] scale, offset;
            public int[] sourceAxisForOutput;
        }
        [Serializable] sealed class Descriptor
        {
            public int schema = 1;
            public bool researchOnly = true, originalGameConsumptionVerified = false, originalShaderRecovered = false;
            public string adapter = AdapterVersion, kitId, kitHash, inheritedKitId, inheritedKitHash;
            public string explanation = "Three actual Tiny Glade source meshes used in our roles. Other six roles explicitly inherit original A. Source units and native shader semantics are unknown. This is not a full original-game bridge kit.";
            public List<SourceRecord> sources = new List<SourceRecord>();
            public string[] inheritedRoles;
        }

        public static ReplicaKit Import(string absoluteSourceDirectory)
        {
            if (string.IsNullOrWhiteSpace(absoluteSourceDirectory) || !Path.IsPathRooted(absoluteSourceDirectory) || !Directory.Exists(absoluteSourceDirectory)) throw new InvalidDataException("研究源目录须为实际存在的绝对目录。");
            var inputs = new List<Input>();
            for (int i = 0; i < Roles.Length; i++)
            {
                string file = ResolveSource(absoluteSourceDirectory, Files[i]);
                var source = ResearchMeshSource.Parse(File.ReadAllBytes(file));
                // Wooden source is a unit-bounds template, with no provable longest physical axis.
                // Our Z->X choice makes a thin upper beam rather than stretching a plank into a wall.
                var converted = Roles[i] == "rail"
                    ? ResearchMeshSource.ConvertToSlot(source, new[] { .5f, .125f, .125f }, new[] { -.25f, .875f, -.0625f }, new[] { 2, 1, 0 })
                    : ResearchMeshSource.Normalize(source, new[] { .5f, .25f, .5f });
                inputs.Add(new Input { Role = Roles[i], File = file, Source = source, Converted = converted });
            }
            var baseline = ReplicaKitRegistry.EnsureBase();
            var identity = new StringBuilder(AdapterVersion).Append('|').Append(baseline.Id).Append('|').Append(baseline.ContentHash);
            foreach (var input in inputs) identity.Append('\n').Append(input.Role).Append('|').Append(input.Source.SourceSha256).Append('|').Append(input.Converted.GeometrySha256);
            string hash = ResearchMeshSource.Hash(Encoding.UTF8.GetBytes(identity.ToString()));
            string folder = PrivateRoot + "/" + hash.Substring(0, 24), kitPath = folder + "/Kit.asset";
            var existing = AssetDatabase.LoadAssetAtPath<ReplicaKit>(kitPath);
            if (existing != null) { Validate(existing); return existing; }
            ReplicaKitRegistry.Folder(folder);
            Shader shader = EnsureShader(folder);
            var bindings = baseline.Bindings.Select(CloneInherited).ToList();
            var description = new Descriptor { kitId = "research.tinyglade.partial", kitHash = hash, inheritedKitId = baseline.Id, inheritedKitHash = baseline.ContentHash, inheritedRoles = bindings.Where(b => !Roles.Contains(b.Role)).Select(b => b.Role).ToArray() };
            foreach (var input in inputs)
            {
                string meshPath = folder + "/" + input.Role + ".asset", materialPath = folder + "/" + input.Role + ".mat", archivePath = folder + "/" + input.Role + ".archive.json";
                var mesh = CreateMesh(input); string meshSha = MeshFingerprint(mesh);
                var previousMesh = AssetDatabase.LoadAssetAtPath<Mesh>(meshPath);
                if (previousMesh == null) AssetDatabase.CreateAsset(mesh, meshPath);
                else
                {
                    if (MeshFingerprint(previousMesh) != meshSha) { UnityEngine.Object.DestroyImmediate(mesh); throw new InvalidDataException("私有研究产物已改变，请保留现场并检查：" + meshPath); }
                    UnityEngine.Object.DestroyImmediate(mesh); mesh = previousMesh;
                }
                var material = AssetDatabase.LoadAssetAtPath<Material>(materialPath);
                if (material == null)
                {
                    material = new Material(shader) { name = "Research compatibility " + input.Role };
                    material.SetColor("_Color", input.Role == "rail" ? new Color(.48f, .32f, .17f, 1) : input.Role == "deck" ? new Color(.62f, .64f, .61f, 1) : Color.white);
                    AssetDatabase.CreateAsset(material, materialPath);
                }
                string usage = Usage(input.Role);
                File.WriteAllText(archivePath, ResearchMeshSource.BuildArchive(input.Source, input.Converted, input.File, usage), new UTF8Encoding(false));
                AssetDatabase.ImportAsset(archivePath, ImportAssetOptions.ForceSynchronousImport);
                AssetDatabase.SaveAssets();
                var binding = new ReplicaBinding
                {
                    Role = input.Role, Id = "research.tinyglade." + Path.GetFileNameWithoutExtension(input.File), Title = "研究源件 " + Path.GetFileNameWithoutExtension(input.File),
                    ModelPath = meshPath, Mesh = mesh, ModelSha256 = meshSha, NativeSource = input.File, NativeSha256 = input.Source.SourceSha256,
                    PalettePath = materialPath, PaletteSha256 = ReplicaKitRegistry.HashFile(materialPath), Material = material,
                    Size = ReplicaKitRegistry.RequiredSize(input.Role), AdapterYaw = 0, AttributeArchivePath = archivePath, Usage = usage
                };
                int at = bindings.FindIndex(b => b.Role == input.Role); if (at < 0) throw new InvalidDataException("继承A缺少职责：" + input.Role); bindings[at] = binding;
                description.sources.Add(new SourceRecord { role = input.Role, sourceFile = input.File, sourceSha256 = input.Source.SourceSha256, meshAsset = meshPath, meshSha256 = meshSha, normalizedGeometrySha256 = input.Converted.GeometrySha256, attributeArchive = archivePath, usage = usage, vertices = input.Source.VertexCount, triangles = input.Source.Indices.Length / 3, originalAttributes = input.Source.Channels.Select(c => c.Name).ToArray(), scale = input.Converted.Scale, offset = input.Converted.Offset, sourceAxisForOutput = input.Converted.SourceAxisForOutput });
            }
            File.WriteAllText(folder + "/source-map.research.json", JsonUtility.ToJson(description, true), new UTF8Encoding(false));
            AssetDatabase.ImportAsset(folder + "/source-map.research.json", ImportAssetOptions.ForceSynchronousImport);
            var kit = ScriptableObject.CreateInstance<ReplicaKit>();
            kit.Id = description.kitId; kit.Version = AdapterVersion; kit.Family = ReplicaKitRegistry.Family; kit.ContentHash = hash; kit.ResearchOnly = true; kit.Bindings = bindings.ToArray();
            AssetDatabase.CreateAsset(kit, kitPath); AssetDatabase.SaveAssets(); Validate(kit); return kit;
        }

        public static void Validate(ReplicaKit kit)
        {
            if (kit == null || !kit.ResearchOnly || kit.Family != ReplicaKitRegistry.Family || kit.Bindings == null || kit.Bindings.Length != 9 || kit.Bindings.Select(b => b == null ? "" : b.Role).Distinct().Count() != 9) throw new InvalidDataException("研究套件身份或职责不完整。");
            string path = AssetDatabase.GetAssetPath(kit);
            if (!path.StartsWith(PrivateRoot + "/", StringComparison.Ordinal)) throw new InvalidDataException("原作派生产物必须留在ResearchPrivate。");
            foreach (var b in kit.Bindings)
            {
                if (b.Material == null || b.AdapterYaw != 0 && Roles.Contains(b.Role) || Vector3.Distance(b.Size, ReplicaKitRegistry.RequiredSize(b.Role)) > .00001f) throw new InvalidDataException("研究职责材质/逻辑槽不匹配：" + b.Role);
                if (Roles.Contains(b.Role))
                {
                    if (b.Mesh == null || AssetDatabase.GetAssetPath(b.Mesh) != b.ModelPath || !b.ModelPath.StartsWith(PrivateRoot + "/", StringComparison.Ordinal) || MeshFingerprint(b.Mesh) != b.ModelSha256) throw new InvalidDataException("研究Mesh缺失或与实际源件转换结果不符：" + b.Role);
                    if (string.IsNullOrEmpty(b.NativeSource) || !File.Exists(b.NativeSource) || ResearchMeshSource.Hash(File.ReadAllBytes(b.NativeSource)) != b.NativeSha256) throw new InvalidDataException("原作研究源件缺失或已变更，请明确重新导入：" + b.Role);
                    if (string.IsNullOrEmpty(b.AttributeArchivePath) || !b.AttributeArchivePath.StartsWith(PrivateRoot + "/", StringComparison.Ordinal) || !File.Exists(b.AttributeArchivePath) || !File.ReadAllText(b.AttributeArchivePath).Contains("\"sourceSha256\":\"" + b.NativeSha256 + "\"")) throw new InvalidDataException("研究原始属性归档缺失或来源不符：" + b.Role);
                }
                else
                {
                    if (b.Usage == null || !b.Usage.Contains("inherited original A") || !File.Exists(b.ModelPath) || ReplicaKitRegistry.HashFile(b.ModelPath) != b.ModelSha256 || !File.Exists(b.PalettePath) || ReplicaKitRegistry.HashFile(b.PalettePath) != b.PaletteSha256) throw new InvalidDataException("明确继承的原创A源件缺失或已改变：" + b.Role);
                }
            }
        }

        public static string MeshFingerprint(Mesh mesh)
        {
            if (mesh == null) throw new InvalidDataException("不能对缺失Mesh取指纹。");
            using (var stream = new MemoryStream())
            using (var writer = new BinaryWriter(stream))
            {
                var positions = mesh.vertices; writer.Write(positions.Length); foreach (var p in positions) { writer.Write(p.x); writer.Write(p.y); writer.Write(p.z); }
                var normals = mesh.normals; writer.Write(normals.Length); foreach (var n in normals) { writer.Write(n.x); writer.Write(n.y); writer.Write(n.z); }
                var colors = mesh.colors; writer.Write(colors.Length); foreach (var c in colors) { writer.Write(c.r); writer.Write(c.g); writer.Write(c.b); writer.Write(c.a); }
                for (int channel = 0; channel < 3; channel++) { var uv = new List<Vector4>(); mesh.GetUVs(channel, uv); writer.Write(uv.Count); foreach (var p in uv) { writer.Write(p.x); writer.Write(p.y); writer.Write(p.z); writer.Write(p.w); } }
                var indices = mesh.triangles; writer.Write(indices.Length); foreach (int index in indices) writer.Write(index); writer.Flush(); return ResearchMeshSource.Hash(stream.ToArray());
            }
        }

        static string ResolveSource(string root, string name)
        {
            root = Path.GetFullPath(root);
            foreach (string relative in new[] { name, Path.Combine("assets", "meshes", name), Path.Combine("meshes", name) })
            {
                string path = Path.GetFullPath(Path.Combine(root, relative));
                if (File.Exists(path)) return path;
            }
            throw new FileNotFoundException("选定研究源件缺失；不使用原创A伪装该职责：" + name, Path.Combine(root, "assets", "meshes", name));
        }
        static ReplicaBinding CloneInherited(ReplicaBinding b)
        {
            return new ReplicaBinding { Role = b.Role, Id = b.Id, Title = b.Title, ModelPath = b.ModelPath, PalettePath = b.PalettePath, NativeSource = b.NativeSource, ModelSha256 = b.ModelSha256, PaletteSha256 = b.PaletteSha256, NativeSha256 = b.NativeSha256, Size = b.Size, AdapterYaw = b.AdapterYaw, Material = b.Material, Mesh = b.Mesh, AttributeArchivePath = b.AttributeArchivePath, Usage = "inherited original A role; not Tiny Glade: " + b.Role };
        }
        static string Usage(string role)
        {
            return "our configured " + role + "; original-game role unconfirmed; source units unknown; explicit affine template adaptation; " + (role == "rail" ? "source Z->route X, Y->Y, X->Z; thin upper beam only at y=.875..1m; native is_bevel semantics not executed" : role == "deck" ? "XYZ preserved into .5x.25x.5m slot; raw bevel_offset retained but native shader semantics not executed" : "XYZ preserved into .5x.25x.5m slot; RGB vertex colors retained");
        }
        static Mesh CreateMesh(Input input)
        {
            var c = input.Converted; var mesh = new Mesh { name = "TG research " + input.Role + " " + input.Source.SourceSha256.Substring(0, 12), indexFormat = input.Source.VertexCount > 65535 ? IndexFormat.UInt32 : IndexFormat.UInt16 };
            var positions = new Vector3[input.Source.VertexCount]; var normals = new Vector3[positions.Length]; var colors = new Color[positions.Length]; var uv = new Vector2[positions.Length];
            for (int i = 0; i < positions.Length; i++) { positions[i] = new Vector3(c.Positions[i * 3], c.Positions[i * 3 + 1], c.Positions[i * 3 + 2]); normals[i] = new Vector3(c.Normals[i * 3], c.Normals[i * 3 + 1], c.Normals[i * 3 + 2]); colors[i] = new Color(c.Colors[i * 4], c.Colors[i * 4 + 1], c.Colors[i * 4 + 2], c.Colors[i * 4 + 3]); uv[i] = new Vector2(c.Uv[i * 2], c.Uv[i * 2 + 1]); }
            mesh.vertices = positions; mesh.normals = normals; mesh.colors = colors; mesh.uv = uv; mesh.triangles = c.Indices;
            var bevel = input.Source.Channel("bevel_offset");
            if (bevel != null) { if (bevel.Components != 3) throw new InvalidDataException("bevel_offset维数不是3。"); var values = new List<Vector3>(); for (int i = 0; i < positions.Length; i++) values.Add(new Vector3((float)bevel.Values[i * 3], (float)bevel.Values[i * 3 + 1], (float)bevel.Values[i * 3 + 2])); mesh.SetUVs(1, values); }
            var isBevel = input.Source.Channel("is_bevel");
            if (isBevel != null) { if (isBevel.Components != 1) throw new InvalidDataException("is_bevel维数不是1。"); var values = new List<Vector2>(); for (int i = 0; i < positions.Length; i++) values.Add(new Vector2((float)isBevel.Values[i], 0)); mesh.SetUVs(2, values); }
            mesh.RecalculateBounds(); return mesh;
        }
        static Shader EnsureShader(string folder)
        {
            string path = folder + "/ResearchCompatibility.shader";
            const string source = "Shader \"XingHai/PrivateResearchVertexColor\" { Properties { _Color (\"Compatibility tint\", Color) = (1,1,1,1) } SubShader { Tags { \"RenderType\"=\"Opaque\" \"Queue\"=\"Geometry\" } Pass { Tags { \"LightMode\"=\"SRPDefaultUnlit\" } Cull Back CGPROGRAM\n#pragma vertex vert\n#pragma fragment frag\n#include \"UnityCG.cginc\"\nstruct A { float4 p:POSITION;float3 n:NORMAL;float4 c:COLOR; };struct V { float4 p:SV_POSITION;float4 c:COLOR; };float4 _Color;V vert(A a){ V o;o.p=UnityObjectToClipPos(a.p);float3 n=UnityObjectToWorldNormal(a.n);float l=.45+.55*saturate(dot(normalize(n),normalize(float3(.45,.8,.35))));o.c=float4(a.c.rgb*_Color.rgb*l,1);return o;}float4 frag(V i):SV_Target{return i.c;}\nENDCG } } }";
            if (!File.Exists(path)) File.WriteAllText(path, source, new UTF8Encoding(false));
            else if (File.ReadAllText(path) != source) throw new InvalidDataException("私有兼容shader已被修改，请保留现场：" + path);
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
            var shader = AssetDatabase.LoadAssetAtPath<Shader>(path); if (shader == null || ShaderUtil.ShaderHasError(shader)) throw new InvalidDataException("研究兼容shader导入失败。"); return shader;
        }
    }
}
