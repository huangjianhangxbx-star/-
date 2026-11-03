using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
namespace XingHai.LE01.Core
{
 internal sealed class TerrainBaseSource
 {
  internal string Hash;internal TerrainBuild Build;internal Bounds2 Bounds;
  internal Dictionary<TerrainColumnKey,TerrainVolumeSpan[]> Columns=new Dictionary<TerrainColumnKey,TerrainVolumeSpan[]>();
 }
 public sealed class TerrainEditSnapshot
 {
  internal readonly TerrainBaseSource Base;
  internal readonly Dictionary<TerrainColumnKey,TerrainVolumeSpan[]> Overrides=new Dictionary<TerrainColumnKey,TerrainVolumeSpan[]>();
  readonly Dictionary<TerrainColumnKey,TerrainColumnOverride> overrideOwners=new Dictionary<TerrainColumnKey,TerrainColumnOverride>();
  internal readonly Dictionary<TerrainColumnKey,List<TerrainPaintRun>> Paint=new Dictionary<TerrainColumnKey,List<TerrainPaintRun>>();
  static readonly TerrainVolumeSpan[] Empty=new TerrainVolumeSpan[0];
  public TerrainDocument Basis {get;private set;}public TerrainEditState State {get;private set;}public Bounds2 Bounds {get;private set;}
  public TerrainBuild BaseBuild {get{return Base.Build;}}
  internal TerrainEditSnapshot(TerrainDocument basis,TerrainEditState state,TerrainBaseSource source,TerrainEditSnapshot previous=null)
  {
   Basis=basis;State=state;Base=source;Bounds=source.Bounds;
   foreach(var c in state.OwnedColumns){var key=new TerrainColumnKey(c.X,c.Z);if(Overrides.ContainsKey(key))throw new ArgumentException("Duplicate owned column.");TerrainColumnOverride old;Overrides[key]=previous!=null&&previous.overrideOwners.TryGetValue(key,out old)&&ReferenceEquals(c,old)?previous.Overrides[key]:c.Spans.ToArray();overrideOwners[key]=c;if(c.Spans.Count>0)Bounds=Union(Bounds,new Bounds2(c.X,c.Z,c.X+1,c.Z+1));}
   foreach(var run in state.PaintRuns){var key=new TerrainColumnKey(run.X,run.Z);List<TerrainPaintRun> list;if(!Paint.TryGetValue(key,out list))Paint[key]=list=new List<TerrainPaintRun>();list.Add(run);}
  }
  static Bounds2 Union(Bounds2 a,Bounds2 b){return a.Empty?b:new Bounds2(Math.Min(a.MinX,b.MinX),Math.Min(a.MinZ,b.MinZ),Math.Max(a.MaxX,b.MaxX),Math.Max(a.MaxZ,b.MaxZ));}
  public IReadOnlyList<TerrainVolumeSpan> ColumnAt(int x,int z)
  {TerrainVolumeSpan[] spans;var key=new TerrainColumnKey(x,z);return Overrides.TryGetValue(key,out spans)?spans:Base.Columns.TryGetValue(key,out spans)?spans:Empty;}
  public bool IsOwned(int x,int z){return Overrides.ContainsKey(new TerrainColumnKey(x,z));}
  public IEnumerable<TerrainColumnKey> Columns(){foreach(var k in Base.Columns.Keys)yield return k;foreach(var k in Overrides.Keys)if(!Base.Columns.ContainsKey(k))yield return k;}
  public TerrainEditSnapshot WithState(TerrainEditState state){return new TerrainEditSnapshot(Basis,state,Base,this);}
  public bool Occupied(int x,int y,int z){foreach(var s in ColumnAt(x,z))if(y>=s.Min&&y<s.Max)return true;return false;}
  public int ColorAt(int x,int y,int z,int direction)
  {
   int color=direction==0||direction==4?2:direction==1||direction==5?1:direction==2?3:0;
   foreach(var s in ColumnAt(x,z))if(y>=s.Min&&y<s.Max){if(s.BaseColorId>=0)color=s.BaseColorId;if(direction==3&&y==s.Max-1&&s.TopColorId>=0)color=s.TopColorId;if(direction==2&&y==s.Min&&s.BottomColorId>=0)color=s.BottomColorId;break;}
   List<TerrainPaintRun> runs;if(Paint.TryGetValue(new TerrainColumnKey(x,z),out runs)){int priority=int.MinValue;foreach(var p in runs)if(p.Priority>=priority&&y>=p.YMin&&y<p.YMax&&(p.FaceMask&(1<<direction))!=0){color=p.ColorId;priority=p.Priority;}}
   return color;
  }
  public string ContentHash()
  {
   var b=new StringBuilder(Base.Hash);foreach(var c in State.OwnedColumns.OrderBy(c=>c.X).ThenBy(c=>c.Z)){b.Append('C').Append(c.X).Append(',').Append(c.Z);foreach(var s in c.Spans)b.Append(':').Append(s.Min).Append(',').Append(s.Max).Append(',').Append(s.BaseColorId).Append(',').Append(s.TopColorId).Append(',').Append(s.BottomColorId);}
   foreach(var p in State.PaintRuns)b.Append('P').Append(p.X).Append(',').Append(p.Z).Append(',').Append(p.YMin).Append(',').Append(p.YMax).Append(',').Append(p.FaceMask).Append(',').Append(p.ColorId).Append(',').Append(p.Priority);
   foreach(var p in State.Palette){b.Append('R');foreach(var f in p.rgba)b.Append(f.ToString("R",CultureInfo.InvariantCulture)).Append(',');}
   unchecked{ulong h=14695981039346656037UL;foreach(char c in b.ToString()){h^=c;h*=1099511628211UL;}return h.ToString("X16",CultureInfo.InvariantCulture);}
  }
 }
 public static class TerrainEffectiveSource
 {
  struct Endpoint {internal int Y,Color;internal bool Up;}
  public static TerrainEditSnapshot Capture(TerrainDocument basis,TerrainEditState edits,TerrainEditCache cache=null)
  {
   if(basis==null)throw new ArgumentNullException("basis");var hash=TerrainQueries.ContentHash(basis);if(edits==null)edits=new TerrainEditState();if(edits.Version!=2)throw new ArgumentException("Unsupported basic terrain state version.");
   ValidateStructure(edits);
   if(!string.IsNullOrEmpty(edits.BaseTerrainHash)&&edits.BaseTerrainHash!=hash)throw new ArgumentException("Basic terrain state belongs to another base terrain.");
   TerrainBaseSource source=cache==null?null:cache.BaseSource;
   if(source==null||source.Hash!=hash){source=ReadBase(basis,hash);if(cache!=null){cache.BaseSource=source;cache.BaseCompileCount++;}}
   if(edits.Palette.Count==0||string.IsNullOrEmpty(edits.BaseTerrainHash)){edits=edits.Copy();edits.BaseTerrainHash=hash;if(edits.Palette.Count==0)edits.Palette=DefaultPalette(basis.TerrainThemeId);}
   Validate(edits);return new TerrainEditSnapshot(basis,edits,source);
  }
  public static void Validate(TerrainEditState state)
  {
   ValidateStructure(state);
   if(state.Version!=2||state.Revision<0)throw new ArgumentException("Unsupported basic terrain version or revision.");
   if(!string.IsNullOrEmpty(state.BaseTerrainHash)&&(state.BaseTerrainHash.Length!=16||state.BaseTerrainHash.Any(c=>!Uri.IsHexDigit(c))))throw new ArgumentException("Invalid base terrain fingerprint.");
   if(state.Palette.Count<8||state.Palette.Count>256)throw new ArgumentException("Palette must contain 8 to 256 stable slots.");
   foreach(var p in state.Palette)if(p==null||string.IsNullOrWhiteSpace(p.id)||p.id.Length>160||p.role==null||p.role.Length>160||p.rgba==null||p.rgba.Length!=4||p.rgba.Any(f=>!Finite(f)||f<0||f>1))throw new ArgumentException("Invalid RGBA palette.");
   if(state.OwnedColumns.Count>65536)throw new ArgumentException("Active fine-column budget exceeded (65536).");long count=0;
   var coordinates=new HashSet<TerrainColumnKey>();foreach(var c in state.OwnedColumns){if(c==null||!Coordinate(c.X,c.Z)||c.Spans==null||!coordinates.Add(new TerrainColumnKey(c.X,c.Z)))throw new ArgumentException("Invalid or duplicate owned column.");int end=int.MinValue;foreach(var s in c.Spans){if(s.Min>=s.Max||s.Min<end||s.Min< -4096||s.Max>4096||s.BaseColorId< -1||s.BaseColorId>=state.Palette.Count||s.TopColorId< -1||s.TopColorId>=state.Palette.Count||s.BottomColorId< -1||s.BottomColorId>=state.Palette.Count)throw new ArgumentException("Invalid ordered volume span.");end=s.Max;count++;}}
   if(count>262144)throw new ArgumentException("Active span budget exceeded (262144).");
   if(state.PaintRuns.Count>262144)throw new ArgumentException("Paint run budget exceeded (262144).");
   foreach(var p in state.PaintRuns)if(p==null||!Coordinate(p.X,p.Z)||p.YMin>=p.YMax||p.YMin< -4096||p.YMax>4096||p.ColorId<0||p.ColorId>=state.Palette.Count||p.FaceMask==0||(p.FaceMask&~63)!=0)throw new ArgumentException("Invalid paint run.");
   if(state.References.Count>64)throw new ArgumentException("Reference library budget exceeded (64).");var identities=new HashSet<string>(StringComparer.Ordinal);long samples=0;
   foreach(var reference in state.References){string error;if(reference==null||string.IsNullOrWhiteSpace(reference.Id)||reference.Id.Length>160||!identities.Add(reference.Id+"#"+reference.SourceHash)||!VoxelModules.ValidateAsset(reference.Asset,out error)||reference.Asset.sourceHash!=reference.SourceHash||reference.Asset.voxels.Count>65536)throw new ArgumentException("Invalid cached reference source snapshot.");samples+=reference.Asset.voxels.Count;}if(samples>2000000)throw new ArgumentException("Reference library sample budget exceeded.");
   var settings=state.Settings;
   if(!TerrainUnits.ValidQuantum(settings.Quantum)||settings.YMin>=settings.YMax||settings.YMin< -4096||settings.YMax>4096||Math.Abs((long)settings.Amount)>4096||settings.ColorId<0||settings.ColorId>255||!Finite(settings.Radius)||settings.Radius<=0||settings.Radius>32||!Finite(settings.Falloff)||settings.Falloff<0||settings.Falloff>1||new[]{settings.NegativeX,settings.PositiveX,settings.NegativeZ,settings.PositiveZ}.Any(v=>!Finite(v)||v<0||v>32)||new[]{settings.Tool,settings.Mode,settings.InputMode,settings.ReferenceId,settings.ExtraJson}.Any(v=>v==null)||settings.ExtraJson.Length>1048576)throw new ArgumentException("Invalid basic terrain brush settings.");
  }
  static bool Finite(float value){return !float.IsNaN(value)&&!float.IsInfinity(value);}
  static bool Coordinate(int x,int z){return x>= -4096&&x<4096&&z>= -4096&&z<4096;}
  static void ValidateStructure(TerrainEditState state)
  {if(state==null||state.OwnedColumns==null||state.PaintRuns==null||state.Palette==null||state.References==null||state.Settings==null||state.OwnedColumns.Any(c=>c==null||c.Spans==null)||state.PaintRuns.Any(p=>p==null)||state.Palette.Any(p=>p==null)||state.References.Any(r=>r==null))throw new ArgumentException("Missing basic terrain collections, records or settings.");}
  static TerrainBaseSource ReadBase(TerrainDocument basis,string hash)
  {
   var build=TerrainCompiler.Build(basis);if(build.ModuleComposed)throw new ArgumentException("A source must be the original base, never mixed placements.");
   var endpoints=new Dictionary<TerrainColumnKey,List<Endpoint>>();
   // The actual compiled horizontal faces delimit each solid band. This also supports
   // legacy builds which predate TerrainBuild.Solid, without editing that compiler.
   foreach(var chunk in build.Chunks)for(int v=0;v<chunk.Vertices.Length/3;v+=4)
   {
    int n=v*3;if(Math.Abs(chunk.Normals[n+1])<.5f)continue;
    int x0=int.MaxValue,z0=int.MaxValue,x1=int.MinValue,z1=int.MinValue;
    for(int i=v;i<v+4;i++){int x=TerrainUnits.ToUnits(chunk.Vertices[i*3]),z=TerrainUnits.ToUnits(chunk.Vertices[i*3+2]);x0=Math.Min(x0,x);x1=Math.Max(x1,x);z0=Math.Min(z0,z);z1=Math.Max(z1,z);}
    var e=new Endpoint{Y=TerrainUnits.ToUnits(chunk.Vertices[n+1]),Up=chunk.Normals[n+1]>0,Color=(int)Math.Floor(chunk.UV[v*2]*8)};
    for(int z=z0;z<z1;z++)for(int x=x0;x<x1;x++){var k=new TerrainColumnKey(x,z);List<Endpoint> list;if(!endpoints.TryGetValue(k,out list))endpoints[k]=list=new List<Endpoint>(2);list.Add(e);}
   }
   var source=new TerrainBaseSource{Hash=hash,Build=build};
   foreach(var pair in endpoints){var e=pair.Value.OrderBy(p=>p.Y).ThenBy(p=>p.Up).ToArray();var spans=new List<TerrainVolumeSpan>();for(int i=0;i<e.Length;i+=2){if(i+1>=e.Length||e[i].Up||!e[i+1].Up||e[i].Y>=e[i+1].Y)throw new ArgumentException("Compiled base has invalid horizontal interval endpoints.");spans.Add(new TerrainVolumeSpan(e[i].Y,e[i+1].Y){TopColorId=e[i+1].Color,BottomColorId=e[i].Color});}source.Columns[pair.Key]=spans.ToArray();}
   if(source.Columns.Count>0)source.Bounds=new Bounds2(source.Columns.Keys.Min(k=>k.X),source.Columns.Keys.Min(k=>k.Z),source.Columns.Keys.Max(k=>k.X)+1,source.Columns.Keys.Max(k=>k.Z)+1);return source;
  }
  public static List<VoxelPaletteEntry> DefaultPalette(string theme="stone")
  {
   float[][] values=theme=="snow-rock"?new[]{new[]{.92f,.95f,.94f,1},new[]{.32f,.40f,.48f,1},new[]{.23f,.31f,.40f,1},new[]{.16f,.22f,.29f,1},new[]{.36f,.44f,.51f,1},new[]{.45f,.53f,.59f,1},new[]{.76f,.84f,.88f,1},new[]{.59f,.68f,.75f,1}}:new[]{new[]{.61f,.69f,.65f,1},new[]{.40f,.46f,.50f,1},new[]{.26f,.33f,.39f,1},new[]{.23f,.27f,.30f,1},new[]{.52f,.58f,.56f,1},new[]{.69f,.72f,.66f,1},new[]{.45f,.51f,.49f,1},new[]{1f,1f,1f,1}};
   return values.Select((p,i)=>new VoxelPaletteEntry{id="base."+i,role="solid",rgba=p}).ToList();
  }
 }
}
