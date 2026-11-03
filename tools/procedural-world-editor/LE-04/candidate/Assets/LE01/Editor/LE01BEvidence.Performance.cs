using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public static partial class LE01BEvidence
    {
        [Serializable] class Metric {public string generator,operation,name;public int n,warmup=2;public double p50,p95,max;}
        [Serializable] class BenchScale {public string generator;public int author,derived,chunks,triangles;public long managedMemory,unityAllocatedMemory,observedPeakManagedMemory,observedPeakUnityAllocatedMemory;public float quantum,width,depth;}
        [Serializable] class BenchReport {public string engine,utc,sourceHash,note="Real Unity process, 2 warmups + 10 samples; milliseconds. Synthetic dispatch begins with prepared valid selection; physical GUI latency is NOT_RUN. Cold preparation/query recorded separately. Legacy stage sub-timers unavailable; only outer Build stopwatch is comparable across versions. P95 nearest-rank (n=10 therefore max); n<10 uses -1 (unavailable). Memory is total Editor managed/Unity allocator bytes, with observed peaks sampled at stage boundaries, not OS peak nor exclusive per-operation bytes.";public List<Metric> metrics=new List<Metric>();public List<BenchScale> scales=new List<BenchScale>();}
        static double Percent(List<double> values,double p){var sorted=values.OrderBy(v=>v).ToArray();return Math.Round(sorted[Math.Max(0,Math.Min(sorted.Length-1,(int)Math.Ceiling(p*sorted.Length)-1))],3);}
        static void AddMetric(BenchReport report,string generator,string operation,string name,List<double> values,int warmups=2){report.metrics.Add(new Metric{generator=generator,operation=operation,name=name,n=values.Count,warmup=warmups,p50=Percent(values,.5),p95=values.Count>=10?Percent(values,.95):-1,max=Math.Round(values.Max(),3)});}
        static void ObserveMemory(BenchScale scale){scale.observedPeakManagedMemory=Math.Max(scale.observedPeakManagedMemory,GC.GetTotalMemory(false));scale.observedPeakUnityAllocatedMemory=Math.Max(scale.observedPeakUnityAllocatedMemory,UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong());}
        public static void Performance()
        {
            var report=new BenchReport{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O"),sourceHash=SourceHash()};
            try{
                var original=new TerrainDocument{Id="B_Performance24",BaseHeight=-48,ActiveQuantum=2,Seed=719};var brush=new TerrainCommand{Mode=BrushMode.Extend,Radius=12,Quantum=2,PlaneHeight=0};brush.Path.Add(new Point2(0,0));original=TerrainKernel.Apply(original,brush).Document;
                foreach(var source in new[]{original,TerrainGenerators.UpgradeToV2(original)}){
                    var a=New(source);var initial=TerrainCompiler.Build(source);LE01Adapter.Upload(a,initial,true,true);var bounds=AuthorBounds(source);var scale=new BenchScale{generator=source.GeneratorVersion,author=source.Cells.Count,derived=initial.DerivedCells,chunks=initial.Chunks.Count,triangles=initial.Chunks.Sum(c=>c.Triangles.Length/3),managedMemory=GC.GetTotalMemory(false),unityAllocatedMemory=UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong(),quantum=.125f,width=bounds.size.x,depth=bounds.size.z};ObserveMemory(scale);report.scales.Add(scale);
                    var lists=new Dictionary<string,List<double>>();foreach(string name in new[]{"kernel-overlay","build-outer","mesh-upload-no-collider","mesh-upload-with-collider","commit-total","undo-json","commit-mesh-collider","native-save","picker","validation","boundary","profile","topology","mesh-emission"})lists[name]=new List<double>();
                    for(int i=0;i<12;i++){
                        a.Write(source.Copy());var command=new TerrainCommand{Mode=BrushMode.Reshape,Radius=.65f,Quantum=2,Seed=1847+i};command.Path.Add(new Point2(11.8f,0));var watch=Stopwatch.StartNew();var result=TerrainKernel.Apply(source,command);watch.Stop();double kernel=watch.Elapsed.TotalMilliseconds;watch.Restart();var built=TerrainCompiler.Build(result.Document,result.DirtyBounds);watch.Stop();double build=watch.Elapsed.TotalMilliseconds;watch.Restart();LE01Adapter.Upload(a,built,false);watch.Stop();double upload=watch.Elapsed.TotalMilliseconds;watch.Restart();LE01Adapter.Upload(a,built,true);watch.Stop();double collide=watch.Elapsed.TotalMilliseconds;
                        var controller=new LE01Stroke{Author=a,Mode=BrushMode.Reshape,Radius=.65f,Quantum=2,Seed=1847+i};controller.Begin(new Vector3(11.8f,0,0),0);controller.End();watch.Restart();controller.Apply();watch.Stop();double commit=watch.Elapsed.TotalMilliseconds;
                        watch.Restart();LE01Adapter.NativeSave(a,Path.Combine(Root,"notes/performance-"+source.GeneratorVersion+".leterrain.json"));watch.Stop();double save=watch.Elapsed.TotalMilliseconds;SurfaceHit hit;string message;bool picked=LE01Adapter.TryPickSculpt(a,new Ray(new Vector3(20,-1,0),Vector3.left),out hit,out message);if(!picked)throw new Exception("Performance side ray failed: "+message);
                        if(i>=2){lists["kernel-overlay"].Add(kernel);lists["build-outer"].Add(build);lists["mesh-upload-no-collider"].Add(upload);lists["mesh-upload-with-collider"].Add(collide);lists["commit-total"].Add(commit);lists["undo-json"].Add(controller.LastUndoMilliseconds);lists["commit-mesh-collider"].Add(controller.LastCommitUploadMilliseconds);lists["native-save"].Add(save);lists["picker"].Add(LE01Adapter.LastPickMilliseconds);if(source.GeneratorVersion=="le01.2"){lists["validation"].Add(built.ValidationMilliseconds);lists["boundary"].Add(built.BoundaryMilliseconds);lists["profile"].Add(built.ProfileMilliseconds);lists["topology"].Add(built.TopologyMilliseconds);lists["mesh-emission"].Add(built.MeshMilliseconds);}}
                        ObserveMemory(scale);
                    }
                    foreach(var pair in lists.Where(p=>p.Value.Count>0))AddMetric(report,source.GeneratorVersion,"same local seed patch radius .65 at x11.8,z0",pair.Key,pair.Value);
                    if(source.GeneratorVersion=="le01.2"){
                        var preview=new List<double>();var release=new List<double>();var prepare=new List<double>();var query=new List<double>();var cache=new LE01StructureSelectionCache();for(int i=0;i<12;i++){
                            a.Write(source.Copy());LE01Adapter.Upload(a,initial,true,true);SurfaceHit hit;string message;if(!LE01Adapter.TryPickSculpt(a,new Ray(new Vector3(20,-1,0),Vector3.left),out hit,out message))throw new Exception(message);var watch=Stopwatch.StartNew();var prepared=cache.Get(a);watch.Stop();double cold=watch.Elapsed.TotalMilliseconds;if(i==0)AddMetric(report,source.GeneratorVersion,"initial immutable boundary including author JSON read","cold-prepare-one-observation",new List<double>{cold},0);watch.Restart();var selection=cache.Get(a).ResolveHit(hit,.65f,SculptInfluence.LinkedColumn,-48,0);watch.Stop();double warm=watch.Elapsed.TotalMilliseconds;var stroke=new LE01Stroke{Author=a,Mode=BrushMode.SculptDepth,Radius=.65f,SculptStrength=-.125f,Quantum=2};watch.Restart();if(!stroke.BeginSculptSelection(selection,new Vector2(100,100)))throw new Exception(stroke.Status);while(stroke.PreviewUploads==0&&stroke.Active&&watch.ElapsedMilliseconds<10000){stroke.Tick();Thread.Sleep(3);}watch.Stop();if(stroke.PreviewUploads==0)throw new Exception("No actual preview upload");double first=watch.Elapsed.TotalMilliseconds;watch.Restart();if(!stroke.End())throw new Exception(stroke.Status);watch.Stop();if(i>=2){preview.Add(first);release.Add(watch.Elapsed.TotalMilliseconds);prepare.Add(cold);query.Add(warm);}ObserveMemory(scale);
                        }AddMetric(report,source.GeneratorVersion,"sculpt depth -.125m linked selection .65m","prepared-selection-dispatch-to-actual-mesh-upload",preview);AddMetric(report,source.GeneratorVersion,"sculpt depth -.125m linked selection .65m","release-to-final-commit",release);AddMetric(report,source.GeneratorVersion,"same-value JSON reuse after benchmark reset","prepare-or-reuse",prepare);AddMetric(report,source.GeneratorVersion,"cached immutable boundary","warm-selection-query",query);
                    }
                }
            }finally{File.WriteAllText(Path.Combine(Root,"notes/performance.json"),JsonUtility.ToJson(report,true));}UnityEngine.Debug.Log("LE01B_PERFORMANCE_COMPLETE");
        }
    }
}
