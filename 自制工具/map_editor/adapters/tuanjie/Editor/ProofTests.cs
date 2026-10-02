using System;
using UnityEditor;
using UnityEngine;
using Xinghai.MapEditor;
namespace Xinghai.MapEditor.Editor {
 public static class ProofTests {
  static void Equal(int actual,int expected,string name) { if(actual!=expected) throw new Exception(name+": expected "+expected+", got "+actual); }
  public static void Run() {
   try {
    var d=new MapDocument {mapId="proof",cells=new[]{new Cell {z=-1}}};
    Equal(SurfaceMesher.FaceCount(d),6,"zero top one thick must be solid");
    d.cells=new[]{new Cell{x=15,z=-1},new Cell{x=16,z=-1}};
    Equal(SurfaceMesher.FaceCount(d),10,"adjacent chunk boundary has no internal faces");
    d.cells=new[]{new Cell{x=-1,z=-1},new Cell{x=1,z=-1}};
    Equal(SurfaceMesher.FaceCount(d),12,"gap preserves facing walls");
    Debug.Log("XH_PROOF_TESTS_PASS"); EditorApplication.Exit(0);
   } catch(Exception e) {Debug.LogException(e); EditorApplication.Exit(1);}
  }
 }
}
