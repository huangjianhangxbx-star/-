using System;
using System.IO;
using System.Text;
using System.Globalization;
using System.Collections.Generic;
using System.Security.Cryptography;

namespace XingHai.BridgeReplica.Research
{
    public sealed class ResearchChannel
    {
        public string Name, ElementType;
        public int Components;
        public double[] Values;
    }
    public sealed class ResearchSourceMesh
    {
        public byte[] RawBytes;
        public string SourceSha256;
        public ResearchChannel[] Channels;
        public int[] Indices;
        public int VertexCount;
        public bool DoubleSided;
        public ResearchChannel Channel(string name)
        {
            foreach (var channel in Channels) if (channel.Name == name) return channel;
            return null;
        }
    }
    public sealed class ResearchConvertedMesh
    {
        public float[] Positions, Normals, Colors, Uv;
        public int[] Indices, SourceAxisForOutput;
        public float[] Scale, Offset, SourceMinimum, SourceMaximum;
        public string GeometrySha256;
        public bool WindingReversed;
    }

    /// <summary>Dependency-free, bounded reader for the observed native mesh JSON schema.
    /// Raw bytes and every declared channel remain available; no original shader semantics are inferred.</summary>
    public static class ResearchMeshSource
    {
        public static string BuildArchive(ResearchSourceMesh source, ResearchConvertedMesh converted, string sourcePath, string usage)
        {
            if (source == null || converted == null) throw new InvalidDataException("属性归档缺少源件或转换结果。");
            var json = new StringBuilder("{\n\"schema\":1,\"researchOnly\":true,\"nativeShaderSemanticsRecovered\":false,");
            json.Append("\n\"sourceFile\":").Append(Quote(sourcePath)).Append(",\n\"usage\":").Append(Quote(usage));
            json.Append(",\n\"sourceSha256\":").Append(Quote(source.SourceSha256)).Append(",\n\"geometrySha256\":").Append(Quote(converted.GeometrySha256));
            json.Append(",\n\"coordinatePolicy\":\"explicit affine template to our metre slot; source units unknown; normals inverse-transpose; no native algorithm claim\"");
            json.Append(",\n\"sourceAxisForOutput\":[").Append(string.Join(",", converted.SourceAxisForOutput)).Append(']');
            foreach (var field in new[] { "scale", "offset", "sourceMinimum", "sourceMaximum" })
            {
                float[] values = field == "scale" ? converted.Scale : field == "offset" ? converted.Offset : field == "sourceMinimum" ? converted.SourceMinimum : converted.SourceMaximum;
                json.Append(",\n").Append(Quote(field)).Append(":["); for (int i = 0; i < values.Length; i++) { if (i > 0) json.Append(','); json.Append(values[i].ToString("R", CultureInfo.InvariantCulture)); } json.Append(']');
            }
            json.Append(",\n\"windingReversed\":").Append(converted.WindingReversed ? "true" : "false");
            json.Append(",\n\"generatedDefaultColors\":").Append(source.Channel("Vertex_Color") == null ? "true" : "false").Append(",\n\"generatedDefaultUV\":").Append(source.Channel("Vertex_UV") == null ? "true" : "false");
            json.Append(",\n\"extraUnityChannels\":{"); bool extra = false;
            if (source.Channel("bevel_offset") != null) { json.Append("\"bevel_offset\":\"TEXCOORD1 raw values, native shader semantics not executed\""); extra = true; }
            if (source.Channel("is_bevel") != null) { if (extra) json.Append(','); json.Append("\"is_bevel\":\"TEXCOORD2.x raw values, native shader semantics not executed\""); } json.Append('}');
            json.Append(",\n\"originalBytesBase64\":").Append(Quote(Convert.ToBase64String(source.RawBytes)));
            json.Append(",\n\"originalMesh\":").Append(Encoding.UTF8.GetString(source.RawBytes).TrimStart('\ufeff')).Append("\n}");
            return json.ToString();
        }
        static string Quote(string value)
        {
            var text = new StringBuilder("\""); foreach (char c in value ?? "") { if (c == '"' || c == '\\') text.Append('\\').Append(c); else if (c < 32) text.Append("\\u").Append(((int)c).ToString("x4")); else text.Append(c); } return text.Append('"').ToString();
        }
        public static string Hash(byte[] bytes)
        {
            using (var hash = SHA256.Create()) return BitConverter.ToString(hash.ComputeHash(bytes)).Replace("-", "");
        }
        public static ResearchSourceMesh Parse(byte[] bytes)
        {
            if (bytes == null || bytes.Length == 0 || bytes.Length > 16 * 1024 * 1024) throw new InvalidDataException("源网格为空或超过16MiB预算。");
            var root = Object(new Json(Encoding.UTF8.GetString(bytes).TrimStart('\ufeff')).Read(), "mesh");
            var names = Array(Required(root, "attributes"), "attributes");
            if (names.Count == 0 || names.Count > 64) throw new InvalidDataException("顶点通道数量不合法。");
            var channels = new List<ResearchChannel>(); var used = new HashSet<string>(StringComparer.Ordinal);
            int vertexCount = -1;
            foreach (var nameValue in names)
            {
                var name = nameValue as string;
                if (name == null || !used.Add(name)) throw new InvalidDataException("顶点通道名重复或不合法。");
                var attr = Object(Required(root, name), name); var type = Array(Required(attr, "type"), name + ".type");
                if (type.Count != 2 || !(type[0] is string)) throw new InvalidDataException("通道type必须为[类型,维数]。");
                string elementType = (string)type[0]; int components = Integer(type[1], "components");
                if ((elementType != "float" && elementType != "int") || components < 1 || components > 16) throw new InvalidDataException("不支持的通道类型/维数：" + name);
                var buffer = Array(Required(attr, "buffer"), name + ".buffer");
                if (buffer.Count == 0 || buffer.Count > 1000000 || (vertexCount >= 0 && vertexCount != buffer.Count)) throw new InvalidDataException("顶点通道长度不一致或超过预算：" + name);
                vertexCount = buffer.Count; var values = new double[buffer.Count * components];
                for (int i = 0; i < buffer.Count; i++)
                {
                    var row = components == 1 && !(buffer[i] is List<object>) ? new List<object> { buffer[i] } : Array(buffer[i], name + " row");
                    if (row.Count != components) throw new InvalidDataException("通道元素维数不一致：" + name);
                    for (int c = 0; c < components; c++)
                    {
                        double v = Number(row[c], name);
                        if (elementType == "int" && v != Math.Truncate(v)) throw new InvalidDataException("整数通道含小数：" + name);
                        values[i * components + c] = v;
                    }
                }
                channels.Add(new ResearchChannel { Name = name, ElementType = elementType, Components = components, Values = values });
            }
            var index = Object(Required(root, "indices"), "indices"); var indexType = Array(Required(index, "type"), "indices.type");
            if (indexType.Count != 2 || (indexType[0] as string) != "int" || Integer(indexType[1], "index components") != 1) throw new InvalidDataException("仅支持三角形整数索引。");
            var indexBuffer = Array(Required(index, "buffer"), "indices.buffer");
            if (indexBuffer.Count == 0 || indexBuffer.Count > 3000000 || indexBuffer.Count % 3 != 0) throw new InvalidDataException("索引不是完整三角形或超过预算。");
            var indices = new int[indexBuffer.Count];
            for (int i = 0; i < indices.Length; i++) { indices[i] = Integer(indexBuffer[i], "index"); if (indices[i] < 0 || indices[i] >= vertexCount) throw new InvalidDataException("网格索引越界。"); }
            var result = new ResearchSourceMesh { RawBytes = (byte[])bytes.Clone(), SourceSha256 = Hash(bytes), Channels = channels.ToArray(), Indices = indices, VertexCount = vertexCount };
            object doubleSided; if (root.TryGetValue("double_sided", out doubleSided)) { if (!(doubleSided is bool)) throw new InvalidDataException("double_sided须为布尔值。"); result.DoubleSided = (bool)doubleSided; }
            RequireChannel(result, "Vertex_Position", 3); RequireChannel(result, "Vertex_Normal", 3);
            var uv = result.Channel("Vertex_UV"); if (uv != null && uv.Components != 2) throw new InvalidDataException("UV通道须为二维。");
            var color = result.Channel("Vertex_Color"); if (color != null && color.Components != 3 && color.Components != 4) throw new InvalidDataException("颜色通道须为RGB或RGBA。");
            return result;
        }
        public static ResearchConvertedMesh Normalize(ResearchSourceMesh source, float[] slotSize)
        {
            if (slotSize == null || slotSize.Length != 3) throw new InvalidDataException("逻辑槽需三维尺寸。");
            return ConvertToSlot(source, slotSize, new[] { -slotSize[0] / 2, 0, -slotSize[2] / 2 }, new[] { 0, 1, 2 });
        }
        /// <summary>Explicit affine template adaptation; slot coordinates are our metres, not inferred source units.
        /// SourceAxisForOutput maps output XYZ to source component indices. Odd permutations reverse triangle winding.</summary>
        public static ResearchConvertedMesh ConvertToSlot(ResearchSourceMesh source, float[] slotSize, float[] minimum, int[] sourceAxes)
        {
            if (source == null || slotSize == null || slotSize.Length != 3 || minimum == null || minimum.Length != 3 || sourceAxes == null || sourceAxes.Length != 3) throw new InvalidDataException("缺少源网格或仿射参数。");
            var unique = new HashSet<int>();
            for (int c = 0; c < 3; c++) if (sourceAxes[c] < 0 || sourceAxes[c] > 2 || !unique.Add(sourceAxes[c]) || !Finite(slotSize[c]) || slotSize[c] <= 0 || !Finite(minimum[c])) throw new InvalidDataException("坐标轴/目标尺寸不合法。");
            var position = RequireChannel(source, "Vertex_Position", 3); var normal = RequireChannel(source, "Vertex_Normal", 3);
            var lo = new[] { double.PositiveInfinity, double.PositiveInfinity, double.PositiveInfinity }; var hi = new[] { double.NegativeInfinity, double.NegativeInfinity, double.NegativeInfinity };
            for (int i = 0; i < source.VertexCount; i++) for (int c = 0; c < 3; c++) { double v = position.Values[i * 3 + c]; lo[c] = Math.Min(lo[c], v); hi[c] = Math.Max(hi[c], v); }
            var result = new ResearchConvertedMesh { Positions = new float[source.VertexCount * 3], Normals = new float[source.VertexCount * 3], Colors = new float[source.VertexCount * 4], Uv = new float[source.VertexCount * 2], Scale = new float[3], Offset = new float[3], SourceMinimum = new float[3], SourceMaximum = new float[3], SourceAxisForOutput = (int[])sourceAxes.Clone(), Indices = (int[])source.Indices.Clone() };
            for (int c = 0; c < 3; c++)
            {
                int a = sourceAxes[c]; if (hi[a] - lo[a] < 1e-8) throw new InvalidDataException("源件某轴退化，不能仿射到三维槽。");
                result.Scale[c] = (float)(slotSize[c] / (hi[a] - lo[a])); result.Offset[c] = (float)(minimum[c] - lo[a] * result.Scale[c]); result.SourceMinimum[c] = (float)lo[c]; result.SourceMaximum[c] = (float)hi[c];
            }
            var color = source.Channel("Vertex_Color"); var uv = source.Channel("Vertex_UV");
            for (int i = 0; i < source.VertexCount; i++)
            {
                double normLength = 0;
                for (int c = 0; c < 3; c++)
                {
                    int a = sourceAxes[c]; result.Positions[i * 3 + c] = (float)(position.Values[i * 3 + a] * result.Scale[c] + result.Offset[c]);
                    float n = (float)(normal.Values[i * 3 + a] / result.Scale[c]); result.Normals[i * 3 + c] = n; normLength += n * (double)n;
                }
                if (normLength < 1e-16) throw new InvalidDataException("源法线为零。");
                for (int c = 0; c < 3; c++) result.Normals[i * 3 + c] = (float)(result.Normals[i * 3 + c] / Math.Sqrt(normLength));
                for (int c = 0; c < 4; c++) result.Colors[i * 4 + c] = color == null || c >= color.Components ? 1 : (float)color.Values[i * color.Components + c];
                if (uv != null) for (int c = 0; c < 2; c++) result.Uv[i * 2 + c] = (float)uv.Values[i * 2 + c];
            }
            int inversions = 0; for (int a = 0; a < 3; a++) for (int b = a + 1; b < 3; b++) if (sourceAxes[a] > sourceAxes[b]) inversions++;
            result.WindingReversed = inversions % 2 != 0;
            if (result.WindingReversed) for (int i = 0; i < result.Indices.Length; i += 3) { int t = result.Indices[i + 1]; result.Indices[i + 1] = result.Indices[i + 2]; result.Indices[i + 2] = t; }
            using (var stream = new MemoryStream())
            using (var writer = new BinaryWriter(stream))
            {
                foreach (var values in new[] { result.Positions, result.Normals, result.Colors, result.Uv }) { writer.Write(values.Length); foreach (float v in values) writer.Write(v); }
                writer.Write(result.Indices.Length); foreach (int v in result.Indices) writer.Write(v); writer.Flush(); result.GeometrySha256 = Hash(stream.ToArray());
            }
            return result;
        }
        static ResearchChannel RequireChannel(ResearchSourceMesh source, string name, int components) { var channel = source.Channel(name); if (channel == null || channel.Components != components || channel.Values.Length != source.VertexCount * components) throw new InvalidDataException("缺少完整通道：" + name); return channel; }
        static bool Finite(double value) { return !double.IsNaN(value) && !double.IsInfinity(value) && Math.Abs(value) <= float.MaxValue; }
        static object Required(Dictionary<string, object> value, string key) { object result; if (!value.TryGetValue(key, out result)) throw new InvalidDataException("缺少字段：" + key); return result; }
        static Dictionary<string, object> Object(object value, string name) { var result = value as Dictionary<string, object>; if (result == null) throw new InvalidDataException(name + "须为对象。"); return result; }
        static List<object> Array(object value, string name) { var result = value as List<object>; if (result == null) throw new InvalidDataException(name + "须为数组。"); return result; }
        static double Number(object value, string name) { if (!(value is double) || !Finite((double)value)) throw new InvalidDataException(name + "须为有限数。"); return (double)value; }
        static int Integer(object value, string name) { double n = Number(value, name); if (n != Math.Truncate(n) || n < int.MinValue || n > int.MaxValue) throw new InvalidDataException(name + "须为整数。"); return (int)n; }

        // Kept local to this narrow source adapter: no dependency on Unity's limited nested-array serializer.
        sealed class Json
        {
            readonly string text; int at;
            public Json(string text) { this.text = text; }
            public object Read() { object value = Value(0); Space(); if (at != text.Length) Bad(); return value; }
            void Space() { while (at < text.Length && char.IsWhiteSpace(text[at])) at++; }
            void Bad() { throw new InvalidDataException("源JSON格式错误，位置 " + at + "。"); }
            object Value(int depth)
            {
                if (depth > 64) Bad(); Space(); if (at >= text.Length) Bad(); char c = text[at];
                if (c == '{')
                {
                    at++; var obj = new Dictionary<string, object>(StringComparer.Ordinal); Space(); if (Take('}')) return obj;
                    do { Space(); if (at >= text.Length || text[at] != '"') Bad(); string key = String(); Space(); if (!Take(':')) Bad(); if (obj.ContainsKey(key)) Bad(); obj.Add(key, Value(depth + 1)); Space(); if (Take('}')) return obj; } while (Take(',')); Bad();
                }
                if (c == '[')
                {
                    at++; var list = new List<object>(); Space(); if (Take(']')) return list;
                    do { list.Add(Value(depth + 1)); Space(); if (Take(']')) return list; } while (Take(',')); Bad();
                }
                if (c == '"') return String();
                foreach (var literal in new[] { "true", "false", "null" }) if (text.Length - at >= literal.Length && string.CompareOrdinal(text, at, literal, 0, literal.Length) == 0) { at += literal.Length; return literal == "null" ? null : (object)(literal == "true"); }
                int start = at;
                if (Take('-')) { if (at >= text.Length) Bad(); }
                if (Take('0')) { if (at < text.Length && char.IsDigit(text[at])) Bad(); }
                else { if (at >= text.Length || text[at] < '1' || text[at] > '9') Bad(); while (at < text.Length && char.IsDigit(text[at])) at++; }
                if (Take('.')) { int digits = at; while (at < text.Length && char.IsDigit(text[at])) at++; if (digits == at) Bad(); }
                if (Take('e') || Take('E')) { if (!Take('+')) Take('-'); int digits = at; while (at < text.Length && char.IsDigit(text[at])) at++; if (digits == at) Bad(); }
                double number; if (!double.TryParse(text.Substring(start, at - start), NumberStyles.Float, CultureInfo.InvariantCulture, out number) || !Finite(number)) Bad(); return number;
            }
            bool Take(char c) { if (at < text.Length && text[at] == c) { at++; return true; } return false; }
            string String()
            {
                if (!Take('"')) Bad(); var value = new StringBuilder();
                while (at < text.Length)
                {
                    char c = text[at++]; if (c == '"') return value.ToString(); if (c < 32) Bad();
                    if (c != '\\') { value.Append(c); continue; } if (at >= text.Length) Bad(); c = text[at++];
                    switch (c)
                    {
                        case '"': case '\\': case '/': value.Append(c); break;
                        case 'b': value.Append('\b'); break; case 'f': value.Append('\f'); break; case 'n': value.Append('\n'); break; case 'r': value.Append('\r'); break; case 't': value.Append('\t'); break;
                        case 'u': int code; if (text.Length - at < 4 || !int.TryParse(text.Substring(at, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out code)) { Bad(); code = 0; } at += 4; value.Append((char)code); break;
                        default: Bad(); break;
                    }
                }
                Bad(); return null;
            }
        }
    }
}
