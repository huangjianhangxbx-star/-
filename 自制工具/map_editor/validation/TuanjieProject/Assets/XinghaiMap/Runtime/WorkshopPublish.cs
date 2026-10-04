using System;
using System.Collections.Generic;
using UnityEngine;
namespace Xinghai.MapEditor {
 [Serializable] public class PublishFile {public string path,sha256;public long byteLength;}
 [Serializable] public class UnityBinding {public string route,runtimePath,imagePath,modelPath,materialsPath,recipe;public string[] texturePaths;}
 [Serializable] public class PublishDependency {public string assetId,kind,contentHash,sourcePath,glbPath;public int sourceRevision;public float[] anchorM;public UnityBinding unity;}
 [Serializable] public class PublishToolchain {public string workshopVersion,sourceFingerprint,blenderVersion,fbxRecipe;}
 [Serializable] public class PublishManifest {public string schema,publishId,kind,targetId,unit,sourceAxes,recipe,runtimePath;public int sourceRevision;public float voxelSize;public PublishDependency[] dependencies;public PublishFile[] outputFiles,payloadFiles;public PublishToolchain toolchain;}
 public sealed class PublishPackage {
  public readonly PublishManifest manifest;public readonly Dictionary<string,byte[]> files;public readonly string manifestHash,manifestCanonicalHash;
  public PublishPackage(PublishManifest manifest,Dictionary<string,byte[]> files,string manifestHash,string manifestCanonicalHash){this.manifest=manifest;this.files=files;this.manifestHash=manifestHash;this.manifestCanonicalHash=manifestCanonicalHash;}
 }
 [Serializable] public class WorkshopColor {public string colorId,alphaMode;public float[] baseColor_sRGB,emissive;public float alpha,roughness,metallic,emissiveStrength;public bool doubleSided;}
 [Serializable] public class WorkshopPalette {public string schema,profileId,paletteId,unit,axes;public int profileRevision,paletteRevision;public float gridStep;public WorkshopColor[] colors;}
 [Serializable] public class RuntimeVoxel {public string schema,assetId,name,rootMode;public int revision;public float voxelSize;public Cell[] cells;public string[] palette,protectedColumns;public int? sideColor;public float[] anchorM;public WorkshopPalette materialProfile;}
 [Serializable] public class WorkshopInstance {public string instanceId,assetId,groupId;public float[] positionM;public int rotationDeg;}
 [Serializable] public class WorkshopGroup {public string groupId,name;public bool visible;}
 [Serializable] public class WorkshopDecal {public string decalId,assetId;public float[] positionM;public int rotationDeg;public float widthM,heightM;}
 [Serializable] public class FrozenBinding {public string assetId,contentHash;public int sourceRevision;}
 [Serializable] public class RuntimeScene {public string schema,sceneId,name;public int revision;public float voxelSize;public FrozenBinding[] bindings;public WorkshopInstance[] instances;public WorkshopGroup[] groups;public WorkshopDecal[] decals;}
 [Serializable] public class ReceiveOptions {public string receiptId="primary";}
 public class PublishedModule {public string publishId,receiptId,directory,outputFingerprint;public GameObject prefab;}
 public sealed class PublishedScene:PublishedModule {}
 [Serializable] public class InstanceOverride {public string instanceId;public float[] sourcePositionM;public int rotationDeg;}
 public sealed class UpgradeReport {public List<string> conflicts=new List<string>();public bool canUpgrade=>conflicts.Count==0;}
 public static class WorkshopCoordinates {public static Vector3 Unity(float[] source){if(source==null||source.Length!=3)throw new ArgumentException("需要三个源坐标");return new Vector3(source[0],source[2],source[1]);}}
}
