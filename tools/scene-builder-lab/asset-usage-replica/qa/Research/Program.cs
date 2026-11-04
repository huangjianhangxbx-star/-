using System.Text;
using System.Text.Json;
using XingHai.BridgeReplica.Research;

// Breaks caught: lost channels, bad index acceptance, incorrect affine/normal conversion,
// and a raw-position edit being hidden by a label-only hash or a substitute mesh.
var checks = new List<object>();
var failures = new List<string>();
void Check(string name, Action action)
{
    try { action(); checks.Add(new { name, status = "PASS" }); }
    catch (Exception e) { failures.Add(name); checks.Add(new { name, status = "FAIL", error = e.Message }); }
}
void Require(bool value, string why) { if (!value) throw new Exception(why); }
const string fixture = "{\"attributes\":[\"Vertex_Position\",\"Vertex_Normal\",\"Vertex_Color\",\"Vertex_UV\",\"bevel_offset\",\"is_bevel\"],\"indices\":{\"type\":[\"int\",1],\"buffer\":[0,1,2]},\"Vertex_Position\":{\"type\":[\"float\",3],\"buffer\":[[0,0,0],[2,0,0],[0,1,2]]},\"Vertex_Normal\":{\"type\":[\"float\",3],\"buffer\":[[1,1,0],[1,1,0],[1,1,0]]},\"Vertex_Color\":{\"type\":[\"float\",3],\"buffer\":[[1,0,0],[0,1,0],[0,0,1]]},\"Vertex_UV\":{\"type\":[\"float\",2],\"buffer\":[[0,0],[1,0],[0,1]]},\"bevel_offset\":{\"type\":[\"float\",3],\"buffer\":[[0.1,0,0],[0,0.2,0],[0,0,0.3]]},\"is_bevel\":{\"type\":[\"int\",1],\"buffer\":[0,1,0]},\"double_sided\":false}";
Check("retains every raw attribute and original bytes", () => {
    var data = ResearchMeshSource.Parse(Encoding.UTF8.GetBytes(fixture));
    Require(data.Channels.Length == 6 && data.VertexCount == 3 && data.Indices.SequenceEqual(new[] { 0, 1, 2 }), "channels or topology lost");
    Require(data.Channel("bevel_offset").Values[0] == .1 && data.Channel("is_bevel").Values[1] == 1, "extra attributes lost");
    Require(Encoding.UTF8.GetString(data.RawBytes) == fixture, "original bytes not retained");
});
Check("normalizes an explicit slot and uses inverse transpose normals", () => {
    var c = ResearchMeshSource.Normalize(ResearchMeshSource.Parse(Encoding.UTF8.GetBytes(fixture)), new[] { .5f, .5f, .5f });
    Require(c.Positions.SequenceEqual(new[] { -.25f, 0, -.25f, .25f, 0, -.25f, -.25f, .5f, .25f }), "wrong normalized vertices");
    Require(Math.Abs(c.Normals[0] - .89442719f) < 1e-6 && Math.Abs(c.Normals[1] - .44721359f) < 1e-6, "incorrect normal transformation");
    Require(c.Colors.Length == 12 && c.Colors[0] == 1 && c.Colors[3] == 1 && c.Uv.SequenceEqual(new float[] { 0, 0, 1, 0, 0, 1 }), "known appearance channels lost");
});
Check("rejects out of range topology before mesh construction", () => {
    bool rejected = false;
    try { ResearchMeshSource.Parse(Encoding.UTF8.GetBytes(fixture.Replace("[0,1,2]", "[0,1,3]"))); }
    catch (InvalidDataException) { rejected = true; }
    Require(rejected, "invalid index accepted");
});
Check("rejects channel length mismatch", () => {
    bool rejected = false;
    try { ResearchMeshSource.Parse(Encoding.UTF8.GetBytes(fixture.Replace("[0,1,0]}", "[0,1]}"))); }
    catch (InvalidDataException) { rejected = true; }
    Require(rejected, "partial channel accepted");
});
Check("swapped rail axes preserve a thin top beam and correct winding", () => {
    var c = ResearchMeshSource.ConvertToSlot(ResearchMeshSource.Parse(Encoding.UTF8.GetBytes(fixture)), new[] { .5f, .125f, .125f }, new[] { -.25f, .875f, -.0625f }, new[] { 2, 1, 0 });
    Require(c.Positions.SequenceEqual(new[] { -.25f, .875f, -.0625f, -.25f, .875f, .0625f, .25f, 1f, -.0625f }), "rail became full height panel or axes incorrect");
    Require(c.Indices.SequenceEqual(new[] { 0, 2, 1 }) && c.WindingReversed, "axis reflection reversed face without topology repair");
});
Check("archive round-trips exact original bytes and unconsumed shader channels", () => {
    var data=ResearchMeshSource.Parse(Encoding.UTF8.GetBytes(fixture));var converted=ResearchMeshSource.Normalize(data,new[]{.5f,.25f,.5f});
    using var archive=JsonDocument.Parse(ResearchMeshSource.BuildArchive(data,converted,"C:/private/source.json","our-role-only"));
    var a=archive.RootElement;Require(Convert.FromBase64String(a.GetProperty("originalBytesBase64").GetString()).SequenceEqual(data.RawBytes),"archive cannot reproduce exact original bytes");
    Require(a.GetProperty("originalMesh").GetProperty("bevel_offset").GetProperty("buffer")[2][2].GetDouble()==.3,"unconsumed shader attribute lost");
    Require(a.GetProperty("geometrySha256").GetString()==converted.GeometrySha256&&a.GetProperty("sourceSha256").GetString()==data.SourceSha256,"mesh/source trace lost");
    Require(a.GetProperty("sourceAxisForOutput")[2].GetInt32()==2,"affine coordinate mapping absent");
});
string sourceDirectory = args.Length > 0 ? Path.GetFullPath(args[0]) : "D:/steam/steamapps/common/Tiny Glade/assets/meshes";
var sourceFacts = new List<object>();
foreach (var entry in new[] { ("stair_step.json",448,588,"tread"), ("stairs_step.json",300,300,"deck"), ("wooden_plank_straight.json",228,228,"rail") })
    Check("parses actual source " + entry.Item1, () => {
        var file = Path.Combine(sourceDirectory, entry.Item1); var raw = File.ReadAllBytes(file);
        var data = ResearchMeshSource.Parse(raw); var c = entry.Item4 == "rail" ? ResearchMeshSource.ConvertToSlot(data,new[] { .5f,.125f,.125f },new[] { -.25f,.875f,-.0625f },new[] { 2,1,0 }) : ResearchMeshSource.Normalize(data,new[] { .5f,.25f,.5f });
        Require(data.VertexCount == entry.Item2 && data.Indices.Length == entry.Item3 && c.Positions.Length == entry.Item2 * 3, "actual source geometry not parsed");
        using(var archive=JsonDocument.Parse(ResearchMeshSource.BuildArchive(data,c,file,"our-role"))){var extra=archive.RootElement.GetProperty("extraUnityChannels");foreach(string name in new[]{"bevel_offset","is_bevel"})Require(extra.TryGetProperty(name,out _)==(data.Channel(name)!=null),"archive claims extra Unity channel absent from source: "+name);}
        if(args.Length>1){Directory.CreateDirectory(args[1]);File.WriteAllText(Path.Combine(args[1],"parsed-"+entry.Item4+".archive.json"),ResearchMeshSource.BuildArchive(data,c,file,"our adaptation "+entry.Item4+"; original role unconfirmed"));}
        sourceFacts.Add(new { file, role = entry.Item4, sourceSha256 = data.SourceSha256, meshSha256 = c.GeometrySha256, vertices = data.VertexCount, triangles = data.Indices.Length / 3, attributes = data.Channels.Select(x => new { x.Name, x.ElementType, x.Components, count = x.Values.Length / x.Components }), c.Scale, c.Offset });
    });
Check("controlled private copy position edit changes mesh then byte restoration reproduces it", () => {
    var raw = File.ReadAllBytes(Path.Combine(sourceDirectory, "stair_step.json"));
    var original = ResearchMeshSource.Parse(raw); var baseline = ResearchMeshSource.Normalize(original, new[] { .5f, .25f, .5f });
    string json = Encoding.UTF8.GetString(raw); const string before = "0.0945904478430748"; const string after = "0.1045904478430748";
    int at = json.IndexOf(before, StringComparison.Ordinal); Require(at >= 0, "controlled interior vertex not found");
    var changedBytes = Encoding.UTF8.GetBytes(json.Substring(0, at) + after + json.Substring(at + before.Length));
    var changed = ResearchMeshSource.Parse(changedBytes); var modified = ResearchMeshSource.Normalize(changed, new[] { .5f, .25f, .5f });
    Require(original.SourceSha256 != changed.SourceSha256 && baseline.GeometrySha256 != modified.GeometrySha256, "position change did not affect real mesh");
    Require(baseline.Positions[0] != modified.Positions[0] && baseline.Indices.SequenceEqual(modified.Indices), "change affected only metadata or wrong topology");
    var restored = ResearchMeshSource.Normalize(ResearchMeshSource.Parse(raw), new[] { .5f, .25f, .5f });
    Require(restored.GeometrySha256 == baseline.GeometrySha256, "restored source did not reproduce mesh");
    if (args.Length > 1) { var folder = Path.GetFullPath(args[1]); Directory.CreateDirectory(folder); File.WriteAllBytes(Path.Combine(folder, "controlled-stair-step.before.json"), raw); File.WriteAllBytes(Path.Combine(folder, "controlled-stair-step.changed.json"), changedBytes); File.WriteAllBytes(Path.Combine(folder, "controlled-stair-step.restored.json"), raw); File.WriteAllText(Path.Combine(folder,"controlled-position-result.json"),JsonSerializer.Serialize(new { source = "private research copy only", original.SourceSha256, changedSourceSha256=changed.SourceSha256, baselineMeshSha256=baseline.GeometrySha256, changedMeshSha256=modified.GeometrySha256, restoredMeshSha256=restored.GeometrySha256, beforeX=baseline.Positions[0],changedX=modified.Positions[0],indicesUnchanged=true,unityMeshCreation="root engine validation pending"},new JsonSerializerOptions{WriteIndented=true})); }
});
var result = new { status = failures.Count == 0 ? "PASS" : "FAIL", checks, sourceFacts, scope = "pure C# actual JSON parse/convert; not Unity generated bridge consumption or T11" };
string output = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
Console.WriteLine(output);
if (args.Length > 1) { Directory.CreateDirectory(args[1]); File.WriteAllText(Path.Combine(args[1], "pure-parser-result.json"), output); }
return failures.Count == 0 ? 0 : 1;
