using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
namespace Xinghai.MapEditor.Editor {
 public static class GreedyProof {
  public static void Run(){try{
   var d=new MapDocument{mapId="rect"};var cells=new List<Cell>();for(int x=0;x<3;x++)for(int y=0;y<2;y++)for(int z=0;z<2;z++)cells.Add(new Cell{x=x,y=y,z=z});d.cells=cells.ToArray();
   if(GreedyMesher.Build(d).Count!=6)throw new Exception("Same color cuboid must merge to six quads");
   d.cells=new[]{new Cell{x=15},new Cell{x=16}};if(GreedyMesher.Build(d).Count!=10)throw new Exception("Cross chunk faces incorrect");
   d=JsonUtility.FromJson<MapDocument>(File.ReadAllText("Assets/Fixtures/bridge.json"));var quads=GreedyMesher.Build(d);int area=0;foreach(var q in quads)area+=q.w*q.h;if(area!=30)throw new Exception("Merged bridge surface area changed");
   File.WriteAllText("../logs/greedy.json",JsonUtility.ToJson(new Output{quads=quads.ToArray()},true));Debug.Log("XH_GREEDY_PASS");EditorApplication.Exit(0);
  }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
  [Serializable] class Output {public Quad[] quads;}
 }
}
