using System;
using System.Collections.Generic;
using System.Linq;
namespace XingHai.LE01.Core
{
 public static class TerrainCompiler
 {
  public static TerrainBuild Build(TerrainDocument doc,Bounds2? dirty=null,int featureLevel=2)
  {var result=TerrainGenerators.IsRockDocument(doc)?TerrainCompilerV2.Build(doc,dirty,featureLevel):TerrainCompilerLegacy.Build(doc,dirty);if(doc.Cells.Count==0)result.ClearPrevious=true;return result;}
  // A partial compile contains a complete source-volume halo but only some mesh
  // chunks. Keep the cached geometry and solid outside the actual rebuilt chunks.
  public static TerrainBuild MergeBase(TerrainBuild previous,TerrainBuild update)
  {
   if(update==null)throw new ArgumentNullException("update");if(previous==null)return update;
   if(previous.ModuleComposed||update.ModuleComposed)throw new ArgumentException("Merge the uncomposed terrain cache, not mixed module geometry.");
   if(update.ClearPrevious)return update;
   var chunks=previous.Chunks.ToDictionary(c=>c.Id,StringComparer.Ordinal);var changed=new HashSet<CellKey>();
   foreach(var chunk in update.Chunks){chunks[chunk.Id]=chunk;changed.Add(new CellKey(chunk.ChunkX,chunk.ChunkZ,0));}
   var result=new TerrainBuild{AuthorLeaves=update.AuthorLeaves,DerivedCells=update.DerivedCells,SourceRevision=update.SourceRevision,Milliseconds=update.Milliseconds,ValidationMilliseconds=update.ValidationMilliseconds,BoundaryMilliseconds=update.BoundaryMilliseconds,ProfileMilliseconds=update.ProfileMilliseconds,TopologyMilliseconds=update.TopologyMilliseconds,MeshMilliseconds=update.MeshMilliseconds,Chunks=chunks.Values.OrderBy(c=>c.ChunkX).ThenBy(c=>c.ChunkZ).ToList()};
   if(result.Chunks.Count>0)result.RebuiltBounds=new Bounds2(result.Chunks.Min(c=>c.ChunkX)*64,result.Chunks.Min(c=>c.ChunkZ)*64,(result.Chunks.Max(c=>c.ChunkX)+1)*64,(result.Chunks.Max(c=>c.ChunkZ)+1)*64);
   if(previous.Solid!=null&&update.Solid!=null)
   {
    var cells=new List<TerrainCell>();var spans=new List<List<TerrainSolidSurface.Span>>();
    Action<TerrainSolidSurface,bool> append=(solid,isUpdate)=>{foreach(var cell in solid.Index.Map.Values){bool included=changed.Contains(new CellKey(TerrainUnits.FloorDiv(cell.X,64),TerrainUnits.FloorDiv(cell.Z,64),0));if(included!=isUpdate)continue;cells.Add(cell.Copy());spans.Add(new List<TerrainSolidSurface.Span>(solid.For(cell)));}};
    append(previous.Solid,false);append(update.Solid,true);int bottom=0;if(spans.Any(s=>s.Count>0))bottom=spans.Where(s=>s.Count>0).Min(s=>s[0].Min);
    result.Solid=new TerrainSolidSurface(cells,bottom);for(int i=0;i<cells.Count;i++)result.Solid.SetSpans(cells[i],spans[i]);
   }
   else result.Solid=update.Solid??previous.Solid;
   var structures=previous.Structures.ToDictionary(s=>s.GroupId,StringComparer.Ordinal);foreach(var s in update.Structures)structures[s.GroupId]=s;result.Structures=structures.Values.OrderBy(s=>s.GroupId,StringComparer.Ordinal).ToList();return result;
  }
 }
}
