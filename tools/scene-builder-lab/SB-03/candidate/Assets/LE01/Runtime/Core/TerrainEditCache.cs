using System.Collections.Generic;
namespace XingHai.LE01.Core
{
 // Derived resources only. A worker returns a new cache; it never edits a published cache.
 public sealed class TerrainEditCache
 {
  internal TerrainBaseSource BaseSource;
  internal Dictionary<TerrainColumnKey,ChunkMesh> Meshes=new Dictionary<TerrainColumnKey,ChunkMesh>();
  internal string StateHash="";
  public int BaseCompileCount {get;internal set;}
  public int ChunkCount {get{return Meshes.Count;}}
 }
}
