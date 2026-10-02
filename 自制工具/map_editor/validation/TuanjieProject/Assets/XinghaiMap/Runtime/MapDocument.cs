using System;
using System.Collections.Generic;
using UnityEngine;
namespace Xinghai.MapEditor {
 [Serializable] public class Cell { public int x,y,z; public int color; public string owner="height"; }
 [Serializable] public class Placement {public string id,assetId,kind,registryKey;public float x,y,z;public int rotation;public float[] anchor;}
 [Serializable] public class Surface {public int x,y,z,face;public string tag;}
 [Serializable] public class Decal {public string id,assetId;public float x,y,z,width,height;public int rotation,order;}
 [Serializable] public class MapDocument {public int? sideColor; public int version=1; public string mapId; public int revision; public float voxelSize=.25f; public Cell[] cells; public Placement[] instances=new Placement[0];public Surface[] surfaces=new Surface[0];public Decal[] decals=new Decal[0];public string[] protectedColumns=new string[0];public string[] palette={"#59737a","#cc8f38","#b1b8a5","#263640","#547861","#963f43","#63c8d0","#e4d8ba"}; }
 public static class SurfaceMesher {
  public static readonly Vector3Int[] Directions={Vector3Int.right,Vector3Int.left,Vector3Int.up,Vector3Int.down,new Vector3Int(0,0,1),new Vector3Int(0,0,-1)};
  public static int FaceCount(MapDocument doc) {
   var occupied=new HashSet<Vector3Int>();
   foreach(var c in doc.cells) occupied.Add(new Vector3Int(c.x,c.y,c.z));
   int count=0;
   foreach(var p in occupied) foreach(var dir in Directions) if(!occupied.Contains(p+dir)) count++;
   return count;
  }
 }
}
