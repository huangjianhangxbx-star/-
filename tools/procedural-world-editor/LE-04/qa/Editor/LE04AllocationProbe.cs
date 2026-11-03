using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Unity.Profiling;
using Unity.Profiling.LowLevel.Unsafe;
namespace XingHai.LE04.QA
{
 public static class LE04AllocationProbe
 {
  [Serializable] sealed class Probe{public string api,scope;public long before,after;public bool supported;public List<Sample> samples=new List<Sample>();public List<string> markers=new List<string>();}
  [Serializable] sealed class Sample{public long value,count;}
  static ProfilerRecorder recorder;static int frame;static byte[] keep;static Probe report;
  public static void Run()
  {
   report=new Probe{api="GC.GetAllocatedBytesForCurrentThread + Unity ProfilerRecorder GC Allocated In Frame",scope="Controlled 2 MiB allocation to verify counters before using them as evidence. Includes background Editor allocations; no heap delta. GC.Alloc marker is nanoseconds and is not a byte counter."};
   report.before=GC.GetAllocatedBytesForCurrentThread();keep=new byte[2*1024*1024];report.after=GC.GetAllocatedBytesForCurrentThread();
   var handles=new List<ProfilerRecorderHandle>();ProfilerRecorderHandle.GetAvailable(handles);foreach(var h in handles){var d=ProfilerRecorderHandle.GetDescription(h);if(d.Name.IndexOf("Alloc",StringComparison.OrdinalIgnoreCase)>=0)report.markers.Add(d.Name+"|"+d.UnitType);}
   recorder=ProfilerRecorder.StartNew(ProfilerCategory.Memory,"GC Allocated In Frame",64,ProfilerRecorderOptions.Default);
   EditorApplication.update+=Next;
  }
  static void Next()
  {
   frame++;if(frame==4)keep=new byte[2*1024*1024];
   if(frame<10)return;EditorApplication.update-=Next;recorder.Stop();
   foreach(var s in recorder.ToArray())report.samples.Add(new Sample{value=s.Value,count=s.Count});
   report.supported=report.samples.Any(s=>s.value>=2*1024*1024)||report.after-report.before>=2*1024*1024;
   recorder.Dispose();GC.KeepAlive(keep);File.WriteAllText(Path.Combine(Environment.GetEnvironmentVariable("LE04_REPORT_ROOT"),"allocation-counter-probe.json"),JsonUtility.ToJson(report,true));EditorApplication.Exit(0);
  }
 }
}
