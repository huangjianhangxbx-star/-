using System;
using System.Linq;
using XingHai.LE01.Core;
var d=new TerrainDocument{Id="paint-missing",GeneratorVersion="le01.2",BaseHeight=-8};
d.Cells.Add(new TerrainCell{X=0,Z=0,Size=4,Top=0,PlaneId="p0",Material=8});
var b=TerrainCompiler.Build(d);
var topUV=b.Chunks.SelectMany(c=>Enumerable.Range(0,c.Vertices.Length/3).Where(i=>c.Normals[i*3+1]>.9f).Select(i=>c.UV[i*2])).ToArray();
Console.WriteLine("Actual painted legacy top UVs: "+string.Join(",",topUV.Distinct()));
if(!topUV.All(u=>Math.Abs(u-8.5f/256)<.00001f))throw new InvalidOperationException("Missing behavior: generic paint color cannot survive the old compiler's hard-coded top color slot.");
