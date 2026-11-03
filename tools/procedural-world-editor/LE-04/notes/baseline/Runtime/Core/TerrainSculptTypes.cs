using System;
using System.Collections.Generic;
using System.Globalization;
namespace XingHai.LE01.Core
{
 public enum SculptInfluence {LinkedColumn,HeightRange,LocalSurface}
 public enum SculptLocalMask {Circle,StructurePatch}
 public enum SculptKind {Depth,Density,Shape}
 public enum SculptStatus {Active,Orphaned,Conflict}
 [Serializable] public struct SurfaceHit {public float X,Y,Z,NormalX,NormalY,NormalZ;public string BoundaryKey;public SurfaceHit(float x,float y,float z,float nx,float ny,float nz){X=x;Y=y;Z=z;NormalX=nx;NormalY=ny;NormalZ=nz;BoundaryKey=null;}}
 [Serializable] public sealed class BoundaryAnchor
 {
  public int X,Z,Axis,Sign,LowerHeight,UpperHeight;
  public int PatchMinHeight,PatchMaxHeight;
  public string GroupId,ChildId;
  [NonSerialized] string cachedKey;
  [NonSerialized] int keyX,keyZ,keyAxis,keySign;
  public BoundaryAnchor Copy(){return (BoundaryAnchor)MemberwiseClone();}
  public string Key{get{if(cachedKey==null||keyX!=X||keyZ!=Z||keyAxis!=Axis||keySign!=Sign){keyX=X;keyZ=Z;keyAxis=Axis;keySign=Sign;cachedKey=X.ToString(CultureInfo.InvariantCulture)+":"+Z.ToString(CultureInfo.InvariantCulture)+":"+Axis.ToString(CultureInfo.InvariantCulture)+":"+Sign.ToString(CultureInfo.InvariantCulture);}return cachedKey;}}
 }
 [Serializable] public sealed class SculptSelection
 {
  public string DocumentId,Message="";public int SourceRevision,MinHeight,MaxHeight;public Bounds2 Bounds;public bool Valid;public SculptInfluence Influence;
  public float LocalX,LocalY,LocalZ,LocalRadius;
  public SculptLocalMask LocalMask;
  public List<string> GroupIds=new List<string>();public List<BoundaryAnchor> Anchors=new List<BoundaryAnchor>();
  public SculptSelection Copy(){var s=(SculptSelection)MemberwiseClone();s.GroupIds=GroupIds==null?null:new List<string>(GroupIds);s.Anchors=Anchors==null?null:Anchors.ConvertAll(a=>a==null?null:a.Copy());return s;}
 }
 [Serializable] public sealed class SculptOverride
 {
  public int Version=1,Revision,MinHeight,MaxHeight,ShapeFalloffMinHeight,ShapeFalloffMaxHeight;public string EditId,DocumentId,GeneratorVersion="le01.2";public Bounds2 Bounds;public SculptInfluence Influence;public SculptKind Kind;public float Value;public bool Enabled=true;public SculptStatus Status;
  public int ShapeProfileVersion;public float LocalX,LocalY,LocalZ,LocalRadius;
  public SculptLocalMask LocalMask;
  public List<string> GroupIds=new List<string>();public List<BoundaryAnchor> Anchors=new List<BoundaryAnchor>();
  public SculptOverride Copy(){var s=(SculptOverride)MemberwiseClone();s.GroupIds=GroupIds==null?null:new List<string>(GroupIds);s.Anchors=Anchors==null?null:Anchors.ConvertAll(a=>a==null?null:a.Copy());return s;}
 }
 [Serializable] public sealed class PinnedShape {public string GroupId,BoundaryKey;public int Seed;public PinnedShape Copy(){return (PinnedShape)MemberwiseClone();}}
 [Serializable] public sealed class ShapeLock
 {
  public int Version=1,MinHeight,MaxHeight;public string Id;public Bounds2 Bounds;public bool Enabled=true;public List<BoundaryAnchor> Anchors=new List<BoundaryAnchor>();public List<PinnedShape> Pins=new List<PinnedShape>();
  public ShapeLock Copy(){var s=(ShapeLock)MemberwiseClone();s.Anchors=Anchors==null?null:Anchors.ConvertAll(a=>a==null?null:a.Copy());s.Pins=Pins==null?null:Pins.ConvertAll(p=>p==null?null:p.Copy());return s;}
 }
 [Serializable] public sealed class StructureInfo {public string GroupId,ParentId,ConstraintReason;public Bounds2 Bounds;public int MinHeight,MaxHeight;public int[] EventHeights=new int[0];}
 public static class TerrainGenerators
 {
  public static bool IsRockDocument(TerrainDocument doc){return doc!=null&&(doc.GeneratorVersion=="le01.2"||doc.GeneratorVersion=="le01.3");}
  public static TerrainDocument UpgradeToV3(TerrainDocument source)
  {
   string error;if(!TerrainKernel.Validate(source,out error))throw new ArgumentException(error);
   if(source.GeneratorVersion=="le01.3")return source.Copy();
   var d=source.GeneratorVersion=="le01.1"?UpgradeToV2(source):source.Copy();
   d.Id=source.Id+".v3";d.GeneratorVersion="le01.3";d.SourceId="le02.column-shape";d.SourceVersion=3;d.SculptSchemaVersion=2;d.Revision=0;
   foreach(var edit in d.SculptOverrides){edit.DocumentId=d.Id;edit.GeneratorVersion=d.GeneratorVersion;}return d;
  }
  public static TerrainDocument UpgradeToV2(TerrainDocument source){string e;if(!TerrainKernel.Validate(source,out e))throw new ArgumentException(e);if(source.GeneratorVersion=="le01.3")throw new ArgumentException("An advanced terrain cannot be downgraded. Open its preserved older source instead.");if(source.GeneratorVersion=="le01.2")return source.Copy();var d=source.Copy();d.GeneratorVersion="le01.2";d.Id=source.Id+".v2";d.SourceId="le01.column-profile";d.SourceVersion=2;d.SculptSchemaVersion=1;d.StableLayoutSeed=271828;d.SculptOverrides=d.SculptOverrides??new List<SculptOverride>();d.ShapeLocks=d.ShapeLocks??new List<ShapeLock>();d.Revision=0;return d;}
 }
 public static class TerrainStructures
 {
  public static TerrainStructureSnapshot Prepare(TerrainDocument doc){return new TerrainStructureSnapshot(doc);}
  public static SculptSelection ResolveHit(TerrainDocument doc,SurfaceHit hit,float radius,SculptInfluence influence,int minHeight,int maxHeight){return RockBoundary.Resolve(doc,hit,radius,influence,minHeight,maxHeight);}
  public static SculptSelection ResolveShapeHit(TerrainDocument doc,SurfaceHit hit,float radius,SculptInfluence influence,int minHeight,int maxHeight){return RockBoundary.ResolveShape(doc,hit,radius,influence,minHeight,maxHeight);}
 }
 public sealed class TerrainStructureSnapshot
 {
  readonly RockBoundary boundary;
  public string DocumentId{get{return boundary.Doc.Id;}}
  public int SourceRevision{get{return boundary.Doc.Revision;}}
  internal TerrainStructureSnapshot(TerrainDocument doc)
  {
   if(doc==null)throw new ArgumentException("Missing terrain document.");var frozen=doc.Copy();string error;
   if(!TerrainKernel.Validate(frozen,out error))throw new ArgumentException(error);
   if(!TerrainGenerators.IsRockDocument(frozen))throw new ArgumentException("Explicit rock-generator upgrade is required for sculpt picking.");
   boundary=new RockBoundary(frozen);
  }
  public SculptSelection ResolveHit(SurfaceHit hit,float radius,SculptInfluence influence,int minHeight,int maxHeight){return boundary.Resolve(hit,radius,influence,minHeight,maxHeight);}
  public SculptSelection ResolveShapeHit(SurfaceHit hit,float radius,SculptInfluence influence,int minHeight,int maxHeight){return boundary.ResolveShape(hit,radius,influence,minHeight,maxHeight);}
 }
}

