using System;
using System.Collections.Generic;
namespace XingHai.LE01.Core
{
 [Flags] public enum TerrainFaceMask {None=0,NegativeX=1,PositiveX=2,NegativeY=4,PositiveY=8,NegativeZ=16,PositiveZ=32,Sides=51,All=63}
 [Serializable] public struct TerrainColumnKey : IEquatable<TerrainColumnKey>
 {
  public int X,Z;public TerrainColumnKey(int x,int z){X=x;Z=z;}
  public bool Equals(TerrainColumnKey o){return X==o.X&&Z==o.Z;}public override bool Equals(object o){return o is TerrainColumnKey&&Equals((TerrainColumnKey)o);}public override int GetHashCode(){unchecked{return X*73856093^Z*19349663;}}
 }
 [Serializable] public struct TerrainVolumeSpan
 {
  public int Min,Max,BaseColorId,TopColorId,BottomColorId;
  public TerrainVolumeSpan(int min,int max,int color=-1){Min=min;Max=max;BaseColorId=color;TopColorId=BottomColorId=-1;}
 }
 [Serializable] public sealed class TerrainColumnOverride
 {public int X,Z;public List<TerrainVolumeSpan> Spans=new List<TerrainVolumeSpan>();public TerrainColumnOverride Copy(){return new TerrainColumnOverride{X=X,Z=Z,Spans=new List<TerrainVolumeSpan>(Spans)};}}
 [Serializable] public sealed class TerrainPaintRun
 {public int X,Z,YMin,YMax,FaceMask=63,ColorId,Priority=100;public TerrainPaintRun Copy(){return (TerrainPaintRun)MemberwiseClone();}}
 [Serializable] public sealed class TerrainReferenceRecord
 {public string Id="",SourceHash="",SourcePath="";public VoxelModuleAsset Asset;}
 [Serializable] public sealed class TerrainEditSettings
 {
  public int Quantum=4,YMin=-4096,YMax=4096,Amount=4,ColorId=8;
  public float Radius=1.5f,NegativeX=1.5f,PositiveX=1.5f,NegativeZ=1.5f,PositiveZ=1.5f,Falloff=.3f;
  public string Tool="shape",Mode="Raise",InputMode="continuous",ReferenceId="",ExtraJson="";
 }
 [Serializable] public sealed class TerrainEditState
 {
  public int Version=2,Revision;public string BaseTerrainHash="";
  public List<TerrainColumnOverride> OwnedColumns=new List<TerrainColumnOverride>();
  public List<TerrainPaintRun> PaintRuns=new List<TerrainPaintRun>();
  public List<VoxelPaletteEntry> Palette=new List<VoxelPaletteEntry>();
  public List<TerrainReferenceRecord> References=new List<TerrainReferenceRecord>();
  public TerrainEditSettings Settings=new TerrainEditSettings();
  public TerrainEditState Copy()
  {
   var r=(TerrainEditState)MemberwiseClone();r.OwnedColumns=OwnedColumns.ConvertAll(c=>c.Copy());r.PaintRuns=PaintRuns.ConvertAll(p=>p.Copy());r.Palette=Palette.ConvertAll(p=>p.Copy());r.References=new List<TerrainReferenceRecord>(References);r.Settings=Settings==null?new TerrainEditSettings():CopySettings(Settings);return r;
  }
  static TerrainEditSettings CopySettings(TerrainEditSettings s){return new TerrainEditSettings{Quantum=s.Quantum,YMin=s.YMin,YMax=s.YMax,Amount=s.Amount,ColorId=s.ColorId,Radius=s.Radius,NegativeX=s.NegativeX,PositiveX=s.PositiveX,NegativeZ=s.NegativeZ,PositiveZ=s.PositiveZ,Falloff=s.Falloff,Tool=s.Tool,Mode=s.Mode,InputMode=s.InputMode,ReferenceId=s.ReferenceId,ExtraJson=s.ExtraJson};}
 }
 public sealed class TerrainDirtySet
 {
  public bool All,ColorOnly;public Bounds2 Bounds;public readonly HashSet<TerrainColumnKey> Columns=new HashSet<TerrainColumnKey>();
  public void AddColumn(int x,int z){if(Columns.Add(new TerrainColumnKey(x,z)))Bounds=Columns.Count==1?new Bounds2(x,z,x+1,z+1):new Bounds2(Math.Min(x,Bounds.MinX),Math.Min(z,Bounds.MinZ),Math.Max(x+1,Bounds.MaxX),Math.Max(z+1,Bounds.MaxZ));}
 }
 public sealed class TerrainEditResult
 {public TerrainEditSnapshot Snapshot;public TerrainDirtySet Dirty=new TerrainDirtySet();public bool Changed,Rejected;public string Reason="";}
 public struct TerrainSurfacePick
 {public int X,Y,Z,Direction,ColorId;public bool Owned;public string LogicalKey;}
 public sealed class TerrainSurfaceBuild
 {
  public List<ChunkMesh> Chunks=new List<ChunkMesh>(),ChangedChunks=new List<ChunkMesh>();
  public List<string> EmptyChunkKeys=new List<string>();public List<VoxelPaletteEntry> Palette;
  public SurfacePickIndex PickIndex;public TerrainEditSnapshot Snapshot;public TerrainEditCache Cache;
  public long Milliseconds;public int InputColumns,Quads;
 }
}
