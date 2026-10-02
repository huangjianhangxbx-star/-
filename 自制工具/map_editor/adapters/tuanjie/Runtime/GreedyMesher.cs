using System.Collections.Generic;
using System;
using System.Linq;
using UnityEngine;
namespace Xinghai.MapEditor {
 [Serializable] public class Quad {public int axis,sign,plane,a,b,w,h,color;public string chunk;}
 public static class GreedyMesher {
  class Group {public Quad q;public HashSet<Vector2Int> mask=new HashSet<Vector2Int>();}
  public static List<Quad> Build(MapDocument doc){
   var occupied=new HashSet<Vector3Int>(doc.cells.Select(c=>new Vector3Int(c.x,c.y,c.z)));var groups=new Dictionary<string,Group>();
   foreach(var c in doc.cells){int[] p={c.x,c.y,c.z};string chunk=string.Join(",",p.Select(v=>Mathf.FloorToInt(v/16f)));
    for(int axis=0;axis<3;axis++)foreach(int sign in new[]{-1,1}){var n=new Vector3Int(c.x,c.y,c.z);n[axis]+=sign;if(occupied.Contains(n))continue;int plane=p[axis]+(sign==1?1:0);int[] axes=Enumerable.Range(0,3).Where(a=>a!=axis).ToArray();int faceColor=axis==2&&sign==1?c.color:(doc.sideColor??c.color);string key=chunk+"|"+axis+"|"+sign+"|"+plane+"|"+faceColor;
     if(!groups.TryGetValue(key,out var g)){g=new Group{q=new Quad{axis=axis,sign=sign,plane=plane,color=faceColor,chunk=chunk}};groups.Add(key,g);}g.mask.Add(new Vector2Int(p[axes[0]],p[axes[1]]));
    }
   }
   var output=new List<Quad>();foreach(var g in groups.Values){foreach(var p in g.mask.OrderBy(v=>v.y).ThenBy(v=>v.x).ToArray()){
    if(!g.mask.Contains(p))continue;int w=1,h=1;while(g.mask.Contains(new Vector2Int(p.x+w,p.y)))w++;bool full=true;while(full){for(int x=0;x<w;x++)if(!g.mask.Contains(new Vector2Int(p.x+x,p.y+h))){full=false;break;}if(full)h++;}
    for(int y=0;y<h;y++)for(int x=0;x<w;x++)g.mask.Remove(new Vector2Int(p.x+x,p.y+y));
    output.Add(new Quad{axis=g.q.axis,sign=g.q.sign,plane=g.q.plane,color=g.q.color,chunk=g.q.chunk,a=p.x,b=p.y,w=w,h=h});
   }}return output;
  }
 }
}
