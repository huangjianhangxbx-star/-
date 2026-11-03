using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using XingHai.LE01.Core;
public static partial class Program
{
 static double Percentile95(IEnumerable<double> values){var sorted=values.OrderBy(v=>v).ToArray();return sorted[(int)Math.Ceiling(sorted.Length*.95)-1];}
 static string LegacyFingerprint(TerrainBuild b)
 {using(var s=new MemoryStream())using(var w=new BinaryWriter(s,Encoding.UTF8,true)){foreach(var c in b.Chunks){w.Write(c.Id);foreach(var a in new[]{c.Vertices,c.Normals,c.UV}){w.Write(a.Length);foreach(var v in a)w.Write(v);}foreach(var t in c.Triangles)w.Write(t);foreach(var a in new[]{c.TriangleGroupIds,c.TriangleChildIds,c.TriangleBoundaryKeys})foreach(var v in a)w.Write(v??"");}w.Flush();return Convert.ToHexString(SHA256.HashData(s.ToArray()));}}
 static void PerfTests()
 {
  string root=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../"));var json=new JsonSerializerOptions{IncludeFields=true,WriteIndented=true};
  var baseline=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"reports/baseline-core.json")));var legacyRows=new List<object>();
  foreach(var row in baseline.RootElement.EnumerateArray()){
   string id=row.GetProperty("id").GetString();var doc=JsonSerializer.Deserialize<TerrainDocument>(File.ReadAllText(Path.Combine(root,"qa/fixtures",id+".json")),json);var actual=TerrainCompiler.Build(doc);string hash=LegacyFingerprint(actual);Need(hash==row.GetProperty("mesh").GetString(),"Legacy full arrays unchanged "+id);Need(TerrainQueries.ContentHash(doc)==row.GetProperty("author").GetString(),"Legacy author unchanged "+id);legacyRows.Add(new{id,hash,unchanged=true});
  }
  var basis=JsonSerializer.Deserialize<TerrainDocument>(File.ReadAllText(Path.Combine(root,"qa/fixtures/LE04-baseline24.v3.json")),json);Need(basis.Cells.Count==28968,"Fixed 24m benchmark");
  var watch=Stopwatch.StartNew();long coldAllocationStart=GC.GetAllocatedBytesForCurrentThread();var captureCache=new TerrainEditCache();var source=TerrainEffectiveSource.Capture(basis,new TerrainEditState(),captureCache);double captureMs=watch.Elapsed.TotalMilliseconds;watch.Restart();var first=TerrainSurfaceMesher.Build(source,captureCache);double firstMeshMs=watch.Elapsed.TotalMilliseconds;long coldAllocated=GC.GetAllocatedBytesForCurrentThread()-coldAllocationStart;
  var rows=new List<object>();
  foreach(int quantum in new[]{4,2}){
   var localTimes=new List<double>();var meshTimes=new List<double>();var totalTimes=new List<double>();var allocations=new List<long>();var chunkCounts=new List<int>();var allocatedEdit=new List<long>();var allocatedMesh=new List<long>();
   for(int i=-5;i<20;i++){
    var command=new TerrainEditCommand{Mode=TerrainEditMode.Raise,Anchor=new TerrainPoint3(.5f,0,0),Radius=1.5f,Amount=4,Quantum=quantum,Falloff=1};command.Path.Add(command.Anchor);
    long alloc0=GC.GetAllocatedBytesForCurrentThread();watch.Restart();var edit=TerrainLocalEdits.Apply(source,command);double editMs=watch.Elapsed.TotalMilliseconds;long alloc1=GC.GetAllocatedBytesForCurrentThread();Need(edit.Changed&&!edit.Rejected,"Benchmark edit applies");watch.Restart();var mesh=TerrainSurfaceMesher.Build(edit.Snapshot,first.Cache,edit.Dirty);double meshMs=watch.Elapsed.TotalMilliseconds;long alloc2=GC.GetAllocatedBytesForCurrentThread();
    if(i>=0){localTimes.Add(editMs);meshTimes.Add(meshMs);totalTimes.Add(editMs+meshMs);allocations.Add(alloc2-alloc0);allocatedEdit.Add(alloc1-alloc0);allocatedMesh.Add(alloc2-alloc1);chunkCounts.Add(mesh.ChangedChunks.Count);}
    if(i==0){var full=TerrainSurfaceMesher.Build(edit.Snapshot);Need(MeshHash(mesh.Chunks)==MeshHash(full.Chunks),"Benchmark partial/full exact geometry");}
   }
   rows.Add(new{quantumMetres=quantum*TerrainUnits.Unit,radiusMetres=1.5,warmup=5,samples=20,localP95Ms=Percentile95(localTimes),meshP95Ms=Percentile95(meshTimes),totalP95Ms=Percentile95(totalTimes),totalMaxMs=totalTimes.Max(),maxAllocatedBytes=allocations.Max(),maxLocalAllocatedBytes=allocatedEdit.Max(),maxMeshAllocatedBytes=allocatedMesh.Max(),changedChunksMax=chunkCounts.Max(),allChunks=first.Chunks.Count,baseCompileCount=first.Cache.BaseCompileCount,hotTargetMet=Percentile95(totalTimes)<=150,allocationTargetMet=allocations.Max()<=64L*1024*1024});
   Console.WriteLine("q="+(quantum*TerrainUnits.Unit)+" local p95="+Percentile95(localTimes).ToString("F2")+" mesh p95="+Percentile95(meshTimes).ToString("F2")+" total p95="+Percentile95(totalTimes).ToString("F2")+" allocated max="+allocations.Max());
  }
  var report=new{scope="Actual synchronous Core local solve + partial prepared mesh, allocated bytes on executing thread. No Unity input/Upload/Collider/GPU/Undo/main-thread claim; Editor metrics recorded separately.",fixedLeaves=basis.Cells.Count,legacyFullArrayRegression=legacyRows,cold=new{captureMs,firstMeshMs,totalMs=captureMs+firstMeshMs,allocatedBytes=coldAllocated,baseCompileCount=captureCache.BaseCompileCount},geometry=new{oldTopTriangles=TopTriangles(source.BaseBuild),newTopTriangles=TopCount(first.Chunks),oldTriangles=source.BaseBuild.Chunks.Sum(c=>c.Triangles.Length/3),newTriangles=first.Chunks.Sum(c=>c.Triangles.Length/3)},hot=rows};File.WriteAllText(Path.Combine(root,"reports/core-performance.json"),JsonSerializer.Serialize(report,json));
 }
}
