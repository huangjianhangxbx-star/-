using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Security.Cryptography;
using XingHai.LE01.Core;
public static partial class Program {
 static void RealReferenceTests() {
  var root=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../"));
  foreach(var name in new[]{"ridge","notched-terrace"}) {
   var file=Path.Combine(root,"references",name,"source.voxel.json");var bytes=File.ReadAllBytes(file);var hash=Convert.ToHexString(SHA256.HashData(bytes));
   var asset=JsonSerializer.Deserialize<VoxelModuleAsset>(bytes,new JsonSerializerOptions{IncludeFields=true});var field=TerrainReferenceField.Compile(asset).Field;
   Need(field!=null,"real source certified "+name);
   Need(Math.Abs(field.Pivot.X-asset.pivot[0]*asset.voxelSize)<.00001f,"voxel source pivot is in cell coordinates, sampled field pivot uses metres: "+name);
   var c=new ReferenceBrushCommand{Quantum=4,BlendWidth=.25f,Path=new List<TerrainPoint3>{new TerrainPoint3(-.5f,2,-.5f),new TerrainPoint3(.5f,2,-.5f)}};
   var source=EditFixture();var result=TerrainReferenceEdits.Apply(source,c,field);Need(!result.Rejected&&result.Changed,"real source drag "+name+": "+result.Reason);
   var repeated=TerrainReferenceEdits.Apply(result.Snapshot,c,field);Need(!repeated.Rejected&&!repeated.Changed,"real source repeat idempotence "+name);
   var c2=new ReferenceBrushCommand{Quantum=2,ScaleX=2,ScaleY=.5f,ScaleZ=.5f,YawDegrees=90,Path=new List<TerrainPoint3>{new TerrainPoint3(-1,2,-1)}};
   var resized=TerrainReferenceEdits.Apply(source,c2,field);Need(!resized.Rejected&&resized.Changed,"real source .125m nonuniform stretch/yaw "+name+": "+resized.Reason);
   Need(object.ReferenceEquals(field,TerrainReferenceField.Compile(asset).Field),"real source compile field reused "+name);
   Need(Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(file)))==hash,"real source bytes unchanged "+name);
   Need(!result.Snapshot.State.Palette.Any(p=>p.role=="snow"),"real source generic colors only "+name);
   Console.WriteLine(name+": samples="+field.SampleCount+", edited columns="+result.Dirty.Columns.Count+", stretched columns="+resized.Dirty.Columns.Count+", sha="+hash);
  }
 }
}
