using System;
using System.Linq;
using XingHai.LE01.Core;
public static partial class Program
{
 public static int Main(string[] args)
 {
  try {var group=args.Length==0?"surface":args[0];if(group=="baseline-red")BaselineRed();else if(group=="surface")SurfaceTests();else if(group=="local")LocalTests();else if(group=="reference")ReferenceTests();else if(group=="paint")PaintTests();else if(group=="paint-audit")PaintAuditTests();else if(group=="perf")PerfTests();else if(group=="validation")ValidationTests();else if(group=="real-reference")RealReferenceTests();else throw new Exception("Unknown test group "+group);Console.WriteLine("PASS "+group);return 0;}
  catch(Exception e){Console.Error.WriteLine("FAIL "+e);return 1;}
 }
 public static void Need(bool value,string text){if(!value)throw new InvalidOperationException(text);}
 static TerrainDocument Flat()
 {
  var d=new TerrainDocument{Id="le04-flat",GeneratorVersion="le01.2",BaseHeight=-16};
  for(int z=-64;z<128;z+=4)for(int x=-64;x<128;x+=4)d.Cells.Add(new TerrainCell{X=x,Z=z,Size=4,Top=0,PlaneId="p0"});return d;
 }
 static int TopTriangles(TerrainBuild b){return b.Chunks.Sum(c=>Enumerable.Range(0,c.Triangles.Length/3).Count(t=>c.Normals[c.Triangles[t*3]*3+1]>.5f));}
 static void BaselineRed()
 {
  var old=TerrainCompiler.Build(Flat());var top=TopTriangles(old);
  Console.WriteLine("Legacy flat top triangles="+top+"; requested target <="+(top/2));
  Need(top<=top/2,"Missing behavior: current legacy flat surface does not merge coplanar leaf tops.");
 }
}
