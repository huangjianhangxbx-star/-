using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
namespace XingHai.LE01.Core
{
 [Serializable] public sealed class ReferenceCompileSettings {public int SamplingVersion=1,MaxSamples=65536;}
 public sealed class ReferenceCompileResult {public CompiledReferenceField Field;public bool Rejected;public string Reason="";}
 internal struct ReferenceVoxelKey : IEquatable<ReferenceVoxelKey>
 {internal int X,Y,Z;internal ReferenceVoxelKey(int x,int y,int z){X=x;Y=y;Z=z;}public bool Equals(ReferenceVoxelKey k){return X==k.X&&Y==k.Y&&Z==k.Z;}public override bool Equals(object o){return o is ReferenceVoxelKey&&Equals((ReferenceVoxelKey)o);}public override int GetHashCode(){unchecked{return X*73856093^Y*19349663^Z*83492791;}}}
 internal sealed class ReferenceVoxel {internal int Material;internal int[] Faces;}
 public sealed class CompiledReferenceField
 {
  public string SourceHash {get;internal set;}public string Key {get;internal set;}public int SampleCount {get{return Voxels.Count;}}public int CompileCount {get{return 1;}}
  public float VoxelSize {get;internal set;}public TerrainPoint3 Size {get;internal set;}public TerrainPoint3 Pivot {get;internal set;}
  internal readonly Dictionary<ReferenceVoxelKey,ReferenceVoxel> Voxels=new Dictionary<ReferenceVoxelKey,ReferenceVoxel>();
  internal readonly List<VoxelPaletteEntry> Palette=new List<VoxelPaletteEntry>();
  internal ReferenceVoxel Sample(double x,double y,double z){ReferenceVoxel v;return Voxels.TryGetValue(new ReferenceVoxelKey((int)Math.Floor(x/VoxelSize),(int)Math.Floor(y/VoxelSize),(int)Math.Floor(z/VoxelSize)),out v)?v:null;}
  public bool Occupied(float x,float y,float z){return Sample(x+Pivot.X,y+Pivot.Y,z+Pivot.Z)!=null;}
 }
 public static class TerrainReferenceField
 {
  static readonly Dictionary<string,CompiledReferenceField> Cache=new Dictionary<string,CompiledReferenceField>(StringComparer.Ordinal);
  static readonly object Gate=new object();
  public static ReferenceCompileResult Compile(VoxelModuleAsset source,ReferenceCompileSettings settings=null)
  {
   try {
    settings=settings??new ReferenceCompileSettings();string error;
    if(!VoxelModules.ValidateAsset(source,out error))throw new ArgumentException(error);
    if(settings.SamplingVersion!=1||settings.MaxSamples<1||settings.MaxSamples>65536||source.voxels.Count>settings.MaxSamples)throw new ArgumentException("Reference source exceeds the 65536 sample budget or uses unsupported sampling settings.");
    string key=GeometryKey(source,settings);
    lock(Gate) {
     CompiledReferenceField cached;if(Cache.TryGetValue(key,out cached))return new ReferenceCompileResult{Field=cached};
     var field=new CompiledReferenceField{SourceHash=source.sourceHash,Key=key,VoxelSize=source.voxelSize,Size=new TerrainPoint3(source.size[0]*source.voxelSize,source.size[1]*source.voxelSize,source.size[2]*source.voxelSize),Pivot=new TerrainPoint3(source.pivot[0]*source.voxelSize,source.pivot[1]*source.voxelSize,source.pivot[2]*source.voxelSize)};
     foreach(var p in source.palette)field.Palette.Add(new VoxelPaletteEntry{id=p.id,role="solid",rgba=(float[])p.rgba.Clone()});
     foreach(var v in source.voxels)field.Voxels.Add(new ReferenceVoxelKey(v.x,v.y,v.z),new ReferenceVoxel{Material=v.material,Faces=v.faces==null?null:(int[])v.faces.Clone()});
     if(Cache.Count>=64)Cache.Remove(Cache.Keys.OrderBy(k=>k,StringComparer.Ordinal).First());Cache.Add(key,field);return new ReferenceCompileResult{Field=field};
    }
   }catch(ArgumentException e){return new ReferenceCompileResult{Rejected=true,Reason=e.Message};}
  }
  static string GeometryKey(VoxelModuleAsset a,ReferenceCompileSettings s)
  {
   var b=new StringBuilder();b.Append("reference-v").Append(s.SamplingVersion).Append(':').Append(s.MaxSamples).Append(':').Append(a.sourceHash).Append(':').Append(a.voxelSize.ToString("R",CultureInfo.InvariantCulture));
   foreach(var n in a.size)b.Append(',').Append(n);foreach(var v in a.pivot)b.Append(',').Append(v.ToString("R",CultureInfo.InvariantCulture));
   foreach(var p in a.palette){b.Append('|');foreach(var c in p.rgba)b.Append(c.ToString("R",CultureInfo.InvariantCulture)).Append(',');}
   foreach(var v in a.voxels.OrderBy(v=>v.x).ThenBy(v=>v.y).ThenBy(v=>v.z)){b.Append('|').Append(v.x).Append(',').Append(v.y).Append(',').Append(v.z).Append(',').Append(v.material);if(v.faces!=null)foreach(int f in v.faces)b.Append(',').Append(f);}
   using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(b.ToString()))).Replace("-","");
  }
 }
}

