using System;
using System.Collections.Generic;
using System.Linq;
using XingHai.LE01.Core;
class Program {
 static int Main(string[] args) {try {
 if(args[0]=="local") {
 var d=new TerrainDocument{BaseHeight=0,Cells=new List<TerrainCell>{new TerrainCell{X=0,Z=0,Size=4,Top=48,PlaneId="p0"}}};
 var r=TerrainKernel.Apply(d,new TerrainCommand{Mode=BrushMode.Erase,Path=new List<Point2>{new Point2(.125f,.125f)},Radius=.2f,Quantum=4,StartHeight=24,TargetHeight=32});
 if(r.Rejected)throw new Exception("Harness rejected: "+r.Message);
 if(r.Document.Cells.Count==0)throw new InvalidOperationException("FAIL middle-band erase must preserve the lower/upper intervals; legacy erased the complete column");
 }else {
 var a=new VoxelModuleAsset{assetId="neutral",sourceHash=new string('a',64),size=new[]{1,1,1},palette=new List<VoxelPaletteEntry>{new VoxelPaletteEntry{id="neutral",rgba=new[]{.3f,.5f,.6f,1f}}},voxels=new List<VoxelCell>{new VoxelCell()}};
 var d=new VoxelLayerDocument{assets=new List<VoxelModuleAsset>{a}};
 d=VoxelModules.Place(d,new VoxelPlacement{id="first",assetId=a.assetId,sourceHash=a.sourceHash}).Document;
 d=VoxelModules.Place(d,new VoxelPlacement{id="second",assetId=a.assetId,sourceHash=a.sourceHash,x=1}).Document;
 if(d.placements.Count>0)throw new InvalidOperationException("FAIL reference sweep must author fused volume, not store whole-piece placements; legacy authored "+d.placements.Count+" placements");
 }
 return 0;
 }catch(Exception e){Console.WriteLine(e.Message);return 1;}}
}
