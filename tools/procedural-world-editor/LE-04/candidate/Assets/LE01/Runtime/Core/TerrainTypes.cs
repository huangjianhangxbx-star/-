using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace XingHai.LE01.Core
{
    public static class TerrainUnits
    {
        public const float Unit = .0625f;
        public const int Chunk = 64;
        public static int FloorDiv(int x,int d) { return (int)Math.Floor((double)x/d); }
        public static int ToUnits(float m) { return (int)Math.Round(m/Unit,MidpointRounding.AwayFromZero); }
        public static bool ValidQuantum(int q) { return q==1||q==2||q==4; }
    }
    [Serializable] public struct Point2 { public float X,Z; public Point2(float x,float z){X=x;Z=z;} }
    [Serializable] public struct Bounds2
    {
        public int MinX,MinZ,MaxX,MaxZ;
        public Bounds2(int x0,int z0,int x1,int z1){MinX=x0;MinZ=z0;MaxX=x1;MaxZ=z1;}
        public bool Empty {get{return MaxX<=MinX||MaxZ<=MinZ;}}
        public Bounds2 Expand(int n){return new Bounds2(MinX-n,MinZ-n,MaxX+n,MaxZ+n);}
        public bool Contains(int x,int z){return x>=MinX&&x<MaxX&&z>=MinZ&&z<MaxZ;}
        public bool Intersects(Bounds2 b){return MinX<b.MaxX&&MaxX>b.MinX&&MinZ<b.MaxZ&&MaxZ>b.MinZ;}
    }
    [Serializable] public sealed class TerrainCell
    {
        public int X,Z,Size,Top,Material;
        public string PlaneId;
        public TerrainCell Copy(){return (TerrainCell)MemberwiseClone();}
    }
    [Serializable] public sealed class WorkPlane {public string Id; public int Height,OriginX,OriginZ; public WorkPlane Copy(){return (WorkPlane)MemberwiseClone();}}
    [Serializable] public sealed class SeedPatch {public Bounds2 Bounds;public int Seed;public SeedPatch Copy(){return (SeedPatch)MemberwiseClone();}}
    [Serializable] public sealed class TerrainDocument
    {
        public int SchemaVersion=1,Revision,BaseHeight=-48,ActivePlaneHeight,ActiveQuantum=2,Seed=719,Style,MaterialVersion=1;
        public string GeneratorVersion="le01.1",Id="terrain-01",SourceKind="builtin-procedural",SourceId="le01.column-surface";
        public int SourceVersion=1;
        public string RockPresetId="classic";
        public int RockRuleVersion;
        public string TerrainThemeId="stone";
        public TerrainHeightForm HeightBrushForm;
        public float HeightBrushRotation,HeightBrushAspect=1.7f;
        public float OriginX,OriginY,OriginZ,BrushRadius=1.5f;
        public List<TerrainCell> Cells=new List<TerrainCell>();
        public List<WorkPlane> Planes=new List<WorkPlane>{new WorkPlane{Id="p0",Height=0}};
        public List<SeedPatch> SeedPatches=new List<SeedPatch>();
        public int SculptSchemaVersion=1,StableLayoutSeed=271828;
        public List<SculptOverride> SculptOverrides=new List<SculptOverride>();
        public List<ShapeLock> ShapeLocks=new List<ShapeLock>();
        public TerrainDocument Copy(){var d=(TerrainDocument)MemberwiseClone();d.Cells=Cells==null?null:Cells.ConvertAll(x=>x==null?null:x.Copy());d.Planes=Planes==null?null:Planes.ConvertAll(x=>x==null?null:x.Copy());d.SeedPatches=SeedPatches==null?null:SeedPatches.ConvertAll(x=>x==null?null:x.Copy());d.SculptOverrides=SculptOverrides==null?null:SculptOverrides.ConvertAll(x=>x==null?null:x.Copy());d.ShapeLocks=ShapeLocks==null?null:ShapeLocks.ConvertAll(x=>x==null?null:x.Copy());return d;}
    }
    public enum BrushMode {Extend,Raise,Lower,Erase,Reshape,Convert,SculptDepth,SculptDensity,LockShape,UnlockShape,RestoreShape,RestoreOrphan,SmoothRaise,SmoothLower,SculptShape}
    public enum TerrainHeightForm {RoundTerrace,Ridge,Slope,Mound}
    [Serializable] public sealed class TerrainCommand
    {
        public BrushMode Mode;
        public List<Point2> Path=new List<Point2>();
        public float Radius=1.5f;
        public float Falloff;
        public TerrainHeightForm HeightForm;
        public float RotationDegrees,AspectRatio=1;
        [NonSerialized] public TerrainCoverageSnapshot Coverage;
        public int Quantum=2,PlaneHeight,StartHeight,TargetHeight,Seed=719,TargetQuantum=2;
        public bool EntirePlateau;
        public SculptSelection Selection;
        public float Strength;
        public string EditId;
    }
    public sealed class TerrainResult
    {
        public TerrainDocument Document;
        public Bounds2 DirtyBounds;
        public bool Changed,Rejected;
        public string Message="";
        public int LostCells;
        public SculptSelection Selection;
        public int ConflictCount,OrphanCount;
        public string ConstraintMessage="";
    }
    [Serializable] public sealed class ChunkMesh
    {
        public string Id;
        public int ChunkX,ChunkZ;
        public float[] Vertices=new float[0],Normals=new float[0],UV=new float[0];
        public int[] Triangles=new int[0];
        public string[] TriangleGroupIds=new string[0],TriangleChildIds=new string[0];
        public string[] TriangleBoundaryKeys=new string[0];
    }
    public sealed class TerrainBuild
    {
        [NonSerialized] internal TerrainSolidSurface Solid;
        [NonSerialized] public bool ModuleComposed;
        [NonSerialized] public bool ClearPrevious;
        [NonSerialized] public VoxelPaletteEntry[] ModulePalette;
        public List<ChunkMesh> Chunks=new List<ChunkMesh>();
        public int AuthorLeaves,DerivedCells,SourceRevision;
        public long Milliseconds;
        public long ValidationMilliseconds,BoundaryMilliseconds,ProfileMilliseconds,TopologyMilliseconds,MeshMilliseconds;
        public Bounds2 RebuiltBounds;
        public List<StructureInfo> Structures=new List<StructureInfo>();
    }
    public struct GenerationTicket {public string DocumentId;public int Revision,Generation;}
    public sealed class RevisionGate
    {
        private int generation;
        public GenerationTicket Capture(TerrainDocument d){return new GenerationTicket{DocumentId=d.Id,Revision=d.Revision,Generation=generation};}
        public void Invalidate(){generation++;}
        public bool CanApply(GenerationTicket t,TerrainDocument d){return t.Generation==generation&&t.DocumentId==d.Id&&t.Revision==d.Revision;}
    }
    internal struct CellKey : IEquatable<CellKey>
    {
        public int X,Z,Q;
        public CellKey(int x,int z,int q){X=x;Z=z;Q=q;}
        public bool Equals(CellKey b){return X==b.X&&Z==b.Z&&Q==b.Q;}
        public override bool Equals(object o){return o is CellKey&&Equals((CellKey)o);}
        public override int GetHashCode(){unchecked{return (X*73856093)^(Z*19349663)^(Q*83492791);}}
    }
    internal sealed class CellIndex
    {
        private static readonly int[] Quanta={1,2,4};
        public Dictionary<CellKey,TerrainCell> Map=new Dictionary<CellKey,TerrainCell>();
        public CellIndex(IEnumerable<TerrainCell> cells){foreach(var c in cells)Map[new CellKey(c.X,c.Z,c.Size)]=c;}
        public TerrainCell At(int x,int z){foreach(int q in Quanta){TerrainCell c;if(Map.TryGetValue(new CellKey(x&~(q-1),z&~(q-1),q),out c))return c;}return null;}
        public void Split(TerrainCell c,int q)
        {
            if(c==null||c.Size<=q)return;
            Map.Remove(new CellKey(c.X,c.Z,c.Size));
            for(int z=c.Z;z<c.Z+c.Size;z+=q)for(int x=c.X;x<c.X+c.Size;x+=q){var n=c.Copy();n.X=x;n.Z=z;n.Size=q;Map[new CellKey(x,z,q)]=n;}
        }
    }
    public static class TerrainQueries
    {
        public static TerrainCell CellAtUnits(TerrainDocument d,int x,int z){return new CellIndex(d.Cells).At(x,z);}
        public static int? HeightUnits(TerrainDocument d,float x,float z){var c=CellAtUnits(d,(int)Math.Floor(x/TerrainUnits.Unit),(int)Math.Floor(z/TerrainUnits.Unit));return c==null?(int?)null:c.Top;}
        public static string ContentHash(TerrainDocument d)
        {
            var b=new StringBuilder();b.Append(d.Id).Append('|').Append(d.SchemaVersion).Append('|').Append(d.GeneratorVersion).Append('|').Append(d.SourceKind).Append('|').Append(d.SourceId).Append('|').Append(d.SourceVersion).Append('|').Append(d.MaterialVersion).Append('|').Append(d.OriginX.ToString("R",CultureInfo.InvariantCulture)).Append('|').Append(d.OriginY.ToString("R",CultureInfo.InvariantCulture)).Append('|').Append(d.OriginZ.ToString("R",CultureInfo.InvariantCulture)).Append('|').Append(d.BrushRadius.ToString("R",CultureInfo.InvariantCulture)).Append('|').Append(d.BaseHeight).Append('|').Append(d.ActivePlaneHeight).Append('|').Append(d.ActiveQuantum).Append('|').Append(d.Seed).Append('|').Append(d.Style);
            var cells=new List<TerrainCell>(d.Cells);cells.Sort((a,c)=>a.X!=c.X?a.X.CompareTo(c.X):a.Z!=c.Z?a.Z.CompareTo(c.Z):a.Size.CompareTo(c.Size));
            foreach(var c in cells)b.Append(';').Append(c.X).Append(',').Append(c.Z).Append(',').Append(c.Size).Append(',').Append(c.Top).Append(',').Append(c.Material).Append(',').Append(c.PlaneId);
            foreach(var p in d.Planes)b.Append('W').Append(p.Id).Append(',').Append(p.Height).Append(',').Append(p.OriginX).Append(',').Append(p.OriginZ);
            foreach(var p in d.SeedPatches)b.Append('P').Append(p.Bounds.MinX).Append(',').Append(p.Bounds.MinZ).Append(',').Append(p.Bounds.MaxX).Append(',').Append(p.Bounds.MaxZ).Append(',').Append(p.Seed);
            if(d.GeneratorVersion=="le01.3")b.Append("PRESET:").Append(string.IsNullOrEmpty(d.RockPresetId)?"classic":d.RockPresetId);
            if(d.RockRuleVersion!=0)b.Append("RULE:").Append(d.RockRuleVersion);
            if(!string.IsNullOrEmpty(d.TerrainThemeId)&&d.TerrainThemeId!="stone")b.Append("THEME:").Append(d.TerrainThemeId);
            if(d.RockRuleVersion!=0)b.Append("BRUSH:").Append((int)d.HeightBrushForm).Append(':').Append(d.HeightBrushRotation.ToString("R",CultureInfo.InvariantCulture)).Append(':').Append(d.HeightBrushAspect.ToString("R",CultureInfo.InvariantCulture));
            TerrainSculptEdits.AppendHash(d,b);
            unchecked{ulong h=14695981039346656037UL;foreach(char c in b.ToString()){h^=c;h*=1099511628211UL;}return h.ToString("X16",CultureInfo.InvariantCulture);}
        }
    }
}
