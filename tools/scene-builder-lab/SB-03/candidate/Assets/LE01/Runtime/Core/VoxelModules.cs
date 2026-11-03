using System;
using System.Collections.Generic;
using System.Linq;
namespace XingHai.LE01.Core
{
 [Serializable] public sealed class VoxelPaletteEntry {public string id,role="solid";public float[] rgba;public VoxelPaletteEntry Copy(){return new VoxelPaletteEntry{id=id,role=role,rgba=rgba==null?null:(float[])rgba.Clone()};}}
 [Serializable] public sealed class VoxelCell {public int x,y,z,material;public int[] faces;public VoxelCell Copy(){return new VoxelCell{x=x,y=y,z=z,material=material,faces=faces==null?null:(int[])faces.Clone()};}}
 [Serializable] public sealed class VoxelModuleAsset
 {
  public int schemaVersion=1,assetVersion=1;public string assetId,sourceHash;public float voxelSize=.25f;public float[] origin=new float[3],pivot=new float[3];public int[] size;
  public List<VoxelPaletteEntry> palette=new List<VoxelPaletteEntry>();public List<VoxelCell> voxels=new List<VoxelCell>();
  public VoxelModuleAsset Copy(){var a=(VoxelModuleAsset)MemberwiseClone();a.origin=origin==null?null:(float[])origin.Clone();a.pivot=pivot==null?null:(float[])pivot.Clone();a.size=size==null?null:(int[])size.Clone();a.palette=palette==null?null:palette.Select(p=>p==null?null:p.Copy()).ToList();a.voxels=voxels==null?null:voxels.Select(v=>v==null?null:v.Copy()).ToList();return a;}
 }
 [Serializable] public sealed class VoxelPlacement {public string id,assetId,sourceHash;public int assetVersion=1,x,y,z,yaw;public bool replaceBase=true;public VoxelPlacement Copy(){return (VoxelPlacement)MemberwiseClone();}}
 [Serializable] public sealed class VoxelLayerDocument
 {
  public int schemaVersion=1,revision;public float voxelSize=.25f;public List<VoxelModuleAsset> assets=new List<VoxelModuleAsset>();public List<VoxelPlacement> placements=new List<VoxelPlacement>();
  public VoxelLayerDocument Copy(){var d=(VoxelLayerDocument)MemberwiseClone();d.assets=assets==null?null:assets.Select(a=>a==null?null:a.Copy()).ToList();d.placements=placements==null?null:placements.Select(p=>p==null?null:p.Copy()).ToList();return d;}
 }
 [Serializable] public sealed class VoxelWorldFile {public int schemaVersion=1;public TerrainDocument terrain;public VoxelLayerDocument layer;}
 public sealed class VoxelEditResult {public bool Rejected,Changed;public string Message;public VoxelLayerDocument Document;}
 public sealed class VoxelWorldBuild {public TerrainBuild geometry;public List<VoxelPaletteEntry> palette;public int affectedColumns,moduleVoxels;}
 public static class VoxelModules
 {
  static bool Finite(float v){return !float.IsNaN(v)&&!float.IsInfinity(v);}
  static bool Named(string s){return !string.IsNullOrWhiteSpace(s)&&s.Length<=160;}
  static bool Hash(string s){return s!=null&&s.Length==64&&s.All(c=>c>='0'&&c<='9'||c>='a'&&c<='f'||c>='A'&&c<='F');}
  static bool Unit(float s){return Finite(s)&&s>=TerrainUnits.Unit&&s<=4&&Math.Abs(s/TerrainUnits.Unit-Math.Round(s/TerrainUnits.Unit))<.00001;}
  public static string AssetKey(VoxelModuleAsset a){return a.assetId+"@"+a.assetVersion+"#"+a.sourceHash;}
  public static string AssetKey(VoxelPlacement p){return p.assetId+"@"+p.assetVersion+"#"+p.sourceHash;}
  public static bool ValidateAsset(VoxelModuleAsset a,out string error)
  {
   error="Malformed or unsupported voxel module.";
   if(a==null||a.schemaVersion!=1||a.assetVersion<1||!Named(a.assetId)||!Hash(a.sourceHash)||!Unit(a.voxelSize)||a.origin==null||a.origin.Length!=3||a.origin.Any(v=>!Finite(v)||Math.Abs(v)>1000000)||a.pivot==null||a.pivot.Length!=3||a.pivot.Any(v=>!Finite(v)||Math.Abs(v)>1024)||a.size==null||a.size.Length!=3||a.size.Any(v=>v<1||v>256)||a.palette==null||a.palette.Count==0||a.palette.Count>256||a.voxels==null||a.voxels.Count==0||a.voxels.Count>200000)return false;
   foreach(var p in a.palette)if(p==null||!Named(p.id)||p.rgba==null||p.rgba.Length!=4||p.rgba.Any(v=>!Finite(v)||v<0||v>1)||p.role!="rock"&&p.role!="snow"&&p.role!="solid")return false;
   var seen=new HashSet<int>();foreach(var v in a.voxels){if(v==null||v.x<0||v.y<0||v.z<0||v.x>=a.size[0]||v.y>=a.size[1]||v.z>=a.size[2]||v.material<0||v.material>=a.palette.Count||v.faces!=null&&(v.faces.Length!=6||v.faces.Any(i=>i<0||i>=a.palette.Count))||!seen.Add(v.x+256*(v.y+256*v.z)))return false;}
   error=null;return true;
  }
  public static bool ValidateLayer(VoxelLayerDocument d,out string error)
  {
   error="Malformed or unsupported module layer.";if(d==null||d.schemaVersion!=1||!Unit(d.voxelSize)||d.assets==null||d.assets.Count>64||d.placements==null||d.placements.Count>4096)return false;
   var keys=new HashSet<string>();int count=0;foreach(var a in d.assets){if(!ValidateAsset(a,out error)||Math.Abs(a.voxelSize-d.voxelSize)>.00001||!keys.Add(AssetKey(a))){error=error??"Module grid or source identity mismatch.";return false;}count+=a.voxels.Count;if(count>2000000){error="Module library exceeds work budget.";return false;}}
   var ids=new HashSet<string>();foreach(var p in d.placements)if(p==null||!Named(p.id)||!ids.Add(p.id)||p.yaw<0||p.yaw>3||Math.Abs((long)p.x)*d.voxelSize>256||Math.Abs((long)p.y)*d.voxelSize>256||Math.Abs((long)p.z)*d.voxelSize>256||!keys.Contains(AssetKey(p))){error="Placement references a missing source version, invalid transform or duplicate identity.";return false;}
   error=null;return true;
  }
  public static VoxelEditResult Place(VoxelLayerDocument layer,VoxelPlacement placement)
  {
   var r=new VoxelEditResult{Document=layer==null?new VoxelLayerDocument():layer.Copy()};string error;if(!ValidateLayer(layer,out error)||placement==null){r.Rejected=true;r.Message=error??"Missing placement.";return r;}
   r.Document.placements.RemoveAll(p=>p.id==placement.id);r.Document.placements.Add(placement.Copy());if(!ValidateLayer(r.Document,out error)){r.Document=layer.Copy();r.Rejected=true;r.Message=error;return r;}
   r.Document.revision++;r.Changed=true;r.Message="Module placement candidate ready.";return r;
  }
  public static VoxelEditResult Remove(VoxelLayerDocument layer,string id)
  {
   var r=new VoxelEditResult{Document=layer==null?new VoxelLayerDocument():layer.Copy()};string error;if(!ValidateLayer(layer,out error)){r.Rejected=true;r.Message=error;return r;}
   r.Changed=r.Document.placements.RemoveAll(p=>p.id==id)>0;if(r.Changed)r.Document.revision++;r.Message=r.Changed?"Module removed; underlying author terrain retained.":"No change";return r;
  }
 }
}
