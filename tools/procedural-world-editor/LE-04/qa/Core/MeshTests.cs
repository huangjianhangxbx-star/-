using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using XingHai.LE01.Core;
public static partial class Program
{
 static void SurfaceTests()
 {
  foreach(var generator in new[]{"le01.1","le01.2","le01.3"})
  {
   var basis=Flat();basis.GeneratorVersion=generator;if(generator=="le01.3"){basis.SculptSchemaVersion=2;basis.SourceId="le02.column-shape";basis.SourceVersion=3;}var beforeHash=TerrainQueries.ContentHash(basis);var cache=new TerrainEditCache();var source=TerrainEffectiveSource.Capture(basis,new TerrainEditState(),cache);var merged=TerrainSurfaceMesher.Build(source,cache);
   SameAtoms(source.BaseBuild.Chunks,8,merged.Chunks,256,merged.PickIndex);int old=TopTriangles(source.BaseBuild);int after=TopCount(merged.Chunks);Need(after<=old/2,"Coplanar top reduction "+generator);Need(beforeHash==TerrainQueries.ContentHash(basis),"Original author unchanged");
   Console.WriteLine(generator+" atomic coverage/color/normal/pick PASS; top triangles "+old+" -> "+after);
   var state=source.State.Copy();state.Revision++;state.OwnedColumns.Add(new TerrainColumnOverride{X=2,Z=2,Spans=new List<TerrainVolumeSpan>{new TerrainVolumeSpan(-16,4)}});var edited=source.WithState(state);var dirty=new TerrainDirtySet();dirty.AddColumn(2,2);var partial=TerrainSurfaceMesher.Build(edited,merged.Cache,dirty);var full=TerrainSurfaceMesher.Build(edited);
   Need(MeshHash(partial.Chunks)==MeshHash(full.Chunks),"Partial and full mesh exact fingerprint");Need(Object.ReferenceEquals(merged.Chunks.First(c=>c.ChunkX==-1&&c.ChunkZ==-1),partial.Chunks.First(c=>c.ChunkX==-1&&c.ChunkZ==-1)),"Distant chunks retain exact objects");
   var again=TerrainSurfaceMesher.Build(edited,partial.Cache,new TerrainDirtySet());Need(again.ChangedChunks.Count==0,"No-op causes no rebuild");
   var captured=TerrainEffectiveSource.Capture(basis,state,partial.Cache);Need(partial.Cache.BaseCompileCount==1,"Base compiled once");Need(captured.ContentHash()==edited.ContentHash(),"Recapture stable");
  }
  var empty=new TerrainDocument{Id="micro",GeneratorVersion="le01.2",BaseHeight=-16};var s=TerrainEffectiveSource.Capture(empty,new TerrainEditState());var st=s.State.Copy();st.Palette.Add(new VoxelPaletteEntry{id="test",role="solid",rgba=new[]{.2f,.7f,.3f,1}});
  // Fine steps, a notch, narrow column, three Y bands, color boundaries and negative chunk crossings.
  for(int z=-2;z<3;z++)for(int x=-2;x<3;x++)st.OwnedColumns.Add(new TerrainColumnOverride{X=x,Z=z,Spans=x==0&&z==0?new List<TerrainVolumeSpan>{new TerrainVolumeSpan(-16,-8,8),new TerrainVolumeSpan(-4,0),new TerrainVolumeSpan(2,4,8)}:new List<TerrainVolumeSpan>{new TerrainVolumeSpan(-16,x+z+4,(x+z)%2==0?8:-1)}});
  s=s.WithState(st);var mesh=TerrainSurfaceMesher.Build(s);Need(mesh.Chunks.Count==4,"Negative cross-chunk geometry");foreach(var pair in Atoms(mesh.Chunks,256))Need(pair.Value==1,"No overlapping faces");
  foreach(var key in s.Columns())foreach(var span in s.ColumnAt(key.X,key.Z))for(int y=span.Min;y<span.Max;y++)for(int dir=0;dir<6;dir++)
  {int[] dx={-1,1,0,0,0,0},dy={0,0,-1,1,0,0},dz={0,0,0,0,-1,1};if(s.Occupied(key.X+dx[dir],y+dy[dir],key.Z+dz[dir]))continue;TerrainSurfacePick pick;Need(mesh.PickIndex.TryPick((key.X+.5f+dx[dir]*.5f)*TerrainUnits.Unit,(y+.5f+dy[dir]*.5f)*TerrainUnits.Unit,(key.Z+.5f+dz[dir]*.5f)*TerrainUnits.Unit,dir,out pick),"All micro exposed faces pick");Need(pick.X==key.X&&pick.Y==y&&pick.Z==key.Z,"Pick retains atomic identity");}
  var tomb=TerrainEffectiveSource.Capture(Flat(),new TerrainEditState());var ts=tomb.State.Copy();ts.OwnedColumns.Add(new TerrainColumnOverride{X=2,Z=2});Need(tomb.WithState(ts).ColumnAt(2,2).Count==0,"Empty override is authoritative tombstone");
  Console.WriteLine("micro bands/notches/colors/picking/tombstone PASS");
  var adjacent=TerrainEffectiveSource.Capture(empty,new TerrainEditState());var ast=adjacent.State.Copy();ast.Palette.Add(st.Palette[8]);ast.OwnedColumns.Add(new TerrainColumnOverride{X=0,Z=0,Spans=new List<TerrainVolumeSpan>{new TerrainVolumeSpan(0,2,0),new TerrainVolumeSpan(2,4,8)}});var ab=TerrainSurfaceMesher.Build(adjacent.WithState(ast));
  Need(!Atoms(ab.Chunks,256).Keys.Any(k=>k.StartsWith("2:2:")||k.StartsWith("3:2:")),"Adjacent colored bands must have no internal horizontal faces");
 }
 static int TopCount(IEnumerable<ChunkMesh> chunks){return chunks.Sum(c=>Enumerable.Range(0,c.Triangles.Length/3).Count(t=>c.Normals[c.Triangles[t*3]*3+1]>.5f));}
 static string MeshHash(IEnumerable<ChunkMesh> chunks)
 {var b=new StringBuilder();foreach(var c in chunks){b.Append(c.Id);foreach(var v in c.Vertices)b.Append(v.ToString("R",System.Globalization.CultureInfo.InvariantCulture)).Append(',');foreach(var v in c.Normals)b.Append(v).Append(',');foreach(var v in c.UV)b.Append(v.ToString("R",System.Globalization.CultureInfo.InvariantCulture)).Append(',');foreach(var i in c.Triangles)b.Append(i).Append(',');}return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(b.ToString())));}
 static Dictionary<string,int> Atoms(IEnumerable<ChunkMesh> chunks,int palette)
 {
  var atoms=new Dictionary<string,int>();foreach(var c in chunks)for(int v=0;v<c.Vertices.Length/3;v+=4)
  {
   int nx=(int)c.Normals[v*3],ny=(int)c.Normals[v*3+1],nz=(int)c.Normals[v*3+2],dir=nx<0?0:nx>0?1:ny<0?2:ny>0?3:nz<0?4:5;
   int[] lo={int.MaxValue,int.MaxValue,int.MaxValue},hi={int.MinValue,int.MinValue,int.MinValue};for(int j=v;j<v+4;j++)for(int a=0;a<3;a++){int p=TerrainUnits.ToUnits(c.Vertices[j*3+a]);lo[a]=Math.Min(lo[a],p);hi[a]=Math.Max(hi[a],p);}
   int axis=nx!=0?0:ny!=0?1:2,u=axis==0?2:0,w=axis==1?2:1,color=(int)Math.Floor(c.UV[v*2]*palette);
   // Every actual triangle must point along its stored normal.
   int a0=c.Triangles[(v/4)*6],b0=c.Triangles[(v/4)*6+1],d0=c.Triangles[(v/4)*6+2];double ax=c.Vertices[b0*3]-c.Vertices[a0*3],ay=c.Vertices[b0*3+1]-c.Vertices[a0*3+1],az=c.Vertices[b0*3+2]-c.Vertices[a0*3+2],bx=c.Vertices[d0*3]-c.Vertices[a0*3],by=c.Vertices[d0*3+1]-c.Vertices[a0*3+1],bz=c.Vertices[d0*3+2]-c.Vertices[a0*3+2];Need((ay*bz-az*by)*nx+(az*bx-ax*bz)*ny+(ax*by-ay*bx)*nz>0,"Triangle winding matches normal");
   for(int q=lo[w];q<hi[w];q++)for(int p=lo[u];p<hi[u];p++){var key=dir+":"+lo[axis]+":"+p+":"+q+":"+color;atoms[key]=atoms.TryGetValue(key,out int count)?count+1:1;}
  }return atoms;
 }
 static void SameAtoms(IEnumerable<ChunkMesh> old,int oldPalette,IEnumerable<ChunkMesh> current,int palette,SurfacePickIndex picking)
 {
  var a=Atoms(old,oldPalette);var b=Atoms(current,palette);Need(a.Count==b.Count,"Same atomic surface count "+a.Count+" vs "+b.Count);foreach(var pair in a)Need(b.TryGetValue(pair.Key,out int count)&&count==pair.Value,"Atomic geometry/normal/color equivalent "+pair.Key);
  foreach(var key in a.Keys){var p=key.Split(':').Select(int.Parse).ToArray();int dir=p[0];float plane=p[1],u=p[2]+.5f,v=p[3]+.5f,x=dir<2?plane:u,y=dir==2||dir==3?plane:v,z=dir<2?u:dir==2||dir==3?v:plane;TerrainSurfacePick hit;Need(picking.TryPick(x*TerrainUnits.Unit,y*TerrainUnits.Unit,z*TerrainUnits.Unit,dir,out hit)&&hit.ColorId==p[4],"Merged face picks actual atomic identity "+key);}
 }
}
