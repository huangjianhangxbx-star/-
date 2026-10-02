import fs from "node:fs/promises";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { createMap, EditorDocument } from "../core/document.ts";
import { meshMap, affectedChunks } from "../core/mesher.ts";
await fs.mkdir("validation/scale", { recursive: true });
const results: any[] = [];
for (const [name, size, depth] of [
  ["small", 16, 2],
  ["medium", 80, 4],
  ["large", 192, 5],
] as const) {
  const doc = createMap();
  doc.mapId = "scale-" + name;
  doc.sideColor = 3;
  for (let x = -size / 2; x < size / 2; x++)
    for (let y = -size / 2; y < size / 2; y++) {
      const top = (Math.floor(x / 16) + Math.floor(y / 16)) % 3;
      for (let z = top - depth; z < top; z++)
        doc.cells.push({
          x,
          y,
          z,
          color: Math.abs(Math.floor(x / 16)) % 3,
          owner: "height",
        });
    }
  let t = performance.now();
  const editor = new EditorDocument(doc);
  const loadMs = performance.now() - t;
  t = performance.now();
  const faces = meshMap(doc);
  const meshMs = performance.now() - t;
  t = performance.now();
  editor.begin();
  editor.height(0, 0, 2, 2, 1);
  editor.commit();
  const editMs = performance.now() - t;
  t = performance.now();
  const patch = meshMap(editor.doc, new Set(affectedChunks(0, 0, 1)));
  const partialMs = performance.now() - t;
  await fs.writeFile("validation/scale/" + name + ".json", JSON.stringify(doc));
  results.push({
    name,
    distribution:
      "stepped 16-voxel regions, three top colors, fixed dark sides",
    cells: doc.cells.length,
    loadMs,
    editMs,
    meshMs,
    partialMs,
    partialQuads: patch.length,
    quads: faces.length,
    vertices: faces.length * 4,
    triangles: faces.length * 2,
    chunks: new Set(faces.map((q) => q.chunk)).size,
    materials: 1,
    heapMiB: process.memoryUsage().heapUsed / 1048576,
  });
}
const golden: any[] = [];
for (let seed = 0; seed < 8; seed++) {
  const doc = createMap();
  doc.mapId = "golden-" + seed;
  doc.sideColor = seed % 2 ? 3 : null;
  for (let x = -17; x < 19; x++)
    for (let y = -2; y < 3; y++)
      for (let z = -2; z < 3; z++)
        if ((((x * 17 + y * 31 + z * 7 + seed) % 7) + 7) % 7 < 4)
          doc.cells.push({ x, y, z, color: Math.abs(x + y + seed) % 3 });
  golden.push({ doc, faces: meshMap(doc) });
}
await fs.writeFile("validation/scale/golden.json", JSON.stringify(golden));
await fs.writeFile(
  "validation/logs/scale-node.json",
  JSON.stringify(
    {
      cpu: os.cpus()[0].model,
      ramGiB: os.totalmem() / 1073741824,
      node: process.version,
      results,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(results));
