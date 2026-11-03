using System;
using System.Collections.Generic;
using System.Linq;

namespace XingHai.LE01.Core
{
    // Signed shells relative to the original wall profile. Positive shells are unioned,
    // negative shells are removed. Author footprint/anchors remain the editable authority.
    internal sealed class RockWallShapes
    {
        sealed class OwnedBand {internal BoundaryAnchor Anchor;internal int Min,Max;}
        readonly Dictionary<CellKey,List<OwnedBand>> owners=new Dictionary<CellKey,List<OwnedBand>>();
        internal bool Any {get{return owners.Count>0;}}
        internal IEnumerable<BoundaryAnchor> OwnedAnchors {get{return owners.Values.SelectMany(list=>list).Select(b=>b.Anchor).GroupBy(a=>a.Key).Select(g=>g.First());}}
        internal static bool HasEdits(TerrainDocument doc){return doc.GeneratorVersion=="le01.3"&&doc.SculptOverrides.Any(e=>e.Enabled&&e.Status==SculptStatus.Active&&e.Kind==SculptKind.Shape);}
        internal RockWallShapes(TerrainDocument doc,RockBoundary boundary,RockProfile profile,TerrainSolidSurface solid,Bounds2 region)
        {
            var anchors=doc.SculptOverrides.Where(e=>e.Enabled&&e.Status==SculptStatus.Active&&e.Kind==SculptKind.Shape).SelectMany(e=>e.Anchors).Select(a=>a.Key).Distinct().OrderBy(k=>k,StringComparer.Ordinal);
            foreach(string key in anchors){
                BoundaryAnchor anchor;if(!boundary.Edges.TryGetValue(key,out anchor))continue;
                for(int distance=-16;distance<RockBoundary.Band+16;distance++){
                    int x=anchor.X,z=anchor.Z;
                    if(anchor.Axis==0)x-=(anchor.Sign>0?1:0)+anchor.Sign*distance;else z-=(anchor.Sign>0?1:0)+anchor.Sign*distance;
                    if(!region.Contains(x,z))continue;
                    var original=profile.Solid(anchor,distance+.5f,anchor.UpperHeight);var shaped=profile.ShapedSolid(anchor,distance+.5f,anchor.UpperHeight);
                    var added=TerrainSolidSurface.Visible(shaped,original);var removed=TerrainSolidSurface.Visible(original,shaped);
                    if(added.Count==0&&removed.Count==0)continue;
                    solid.RemoveAt(x,z,removed);solid.UnionAt(x,z,added,anchor.UpperHeight);
                    var cell=new CellKey(x,z,1);List<OwnedBand> bands;if(!owners.TryGetValue(cell,out bands))owners[cell]=bands=new List<OwnedBand>();
                    foreach(var span in added.Concat(removed))bands.Add(new OwnedBand{Anchor=anchor,Min=span.Min,Max=span.Max});
                    if(owners.Count>131072)throw new ArgumentException("Wall shape derived area exceeds its bounded work budget.");
                }
            }
        }
        List<OwnedBand> Bands(int x,int z){List<OwnedBand> bands;return owners.TryGetValue(new CellKey(x,z,1),out bands)?bands:null;}
        static void Coordinates(TerrainCell c,int direction,int offset,out int x,out int z,out int nx,out int nz)
        {
            x=direction==1?c.X+c.Size-1:direction>=2?c.X+offset:c.X;
            z=direction==3?c.Z+c.Size-1:direction<2?c.Z+offset:c.Z;
            nx=x+(direction==0?-1:direction==1?1:0);nz=z+(direction==2?-1:direction==3?1:0);
        }
        internal bool TouchesSide(TerrainCell cell,int direction)
        {
            for(int s=0;s<cell.Size;s++){int x,z,nx,nz;Coordinates(cell,direction,s,out x,out z,out nx,out nz);if(Bands(x,z)!=null||Bands(nx,nz)!=null)return true;}return false;
        }
        internal void EmitSide(RockMeshWriter writer,TerrainCell cell,int direction,int offset,TerrainSolidSurface.Span span,BoundaryAnchor fallback)
        {
            int x,z,nx,nz;Coordinates(cell,direction,offset,out x,out z,out nx,out nz);var bands=new List<OwnedBand>();var own=Bands(x,z);var neighbor=Bands(nx,nz);if(own!=null)bands.AddRange(own);if(neighbor!=null)bands.AddRange(neighbor);
            var cuts=new SortedSet<int>{span.Min,span.Max};foreach(var band in bands){if(band.Min>span.Min&&band.Min<span.Max)cuts.Add(band.Min);if(band.Max>span.Min&&band.Max<span.Max)cuts.Add(band.Max);}var levels=cuts.ToArray();
            for(int i=0;i<levels.Length-1;i++){float center=(levels[i]+levels[i+1])*.5f;var owner=bands.LastOrDefault(b=>center>=b.Min&&center<b.Max);var anchor=owner==null?fallback:owner.Anchor;if(anchor==null&&bands.Count>0)anchor=bands[0].Anchor;
                writer.Side(cell,direction,offset,offset+1,levels[i],levels[i+1],anchor==null?"":anchor.GroupId,anchor==null?"":anchor.ChildId,anchor==null?"":anchor.Key);
            }
        }
        internal BoundaryAnchor Owner(TerrainCell c)
        {var list=Bands(c.X,c.Z);if(list==null)foreach(var pair in new[]{new[]{c.X-1,c.Z},new[]{c.X+1,c.Z},new[]{c.X,c.Z-1},new[]{c.X,c.Z+1}}){list=Bands(pair[0],pair[1]);if(list!=null)break;}return list==null?null:list[0].Anchor;}
    }
}
