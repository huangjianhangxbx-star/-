import test from "node:test";
import assert from "node:assert/strict";
import * as assembly from "../desktop/assembly-view.ts";
import { createAsset } from "../core/workshop-documents.ts";
test("model outline ignores color seams and chunk boundaries on solid boxes", () => {
  const createEdges = (assembly as any).modelEdgeGeometry;
  assert.equal(
    typeof createEdges,
    "function",
    "model structure edge builder exists",
  );
  const asset = createAsset("a");
  asset.cells = [];
  for (let x = 0; x < 18; x++)
    for (let y = 0; y < 3; y++)
      for (let z = 0; z < 2; z++)
        asset.cells.push({ x, y, z, color: (x + y + z) % 2 });
  const edges = createEdges(asset),
    p = edges.getAttribute("position");
  assert.equal(
    p.count,
    24,
    "rectangular model has twelve structural edges, regardless of colors/voxels/chunks",
  );
  edges.dispose();
});
test("model outline includes concave corners without coplanar grid edges", () => {
  const createEdges = (assembly as any).modelEdgeGeometry;
  assert.equal(typeof createEdges, "function");
  const asset = createAsset("a");
  asset.cells = [
    { x: 0, y: 0, z: 0, color: 0 },
    { x: 1, y: 0, z: 0, color: 1 },
    { x: 0, y: 1, z: 0, color: 1 },
  ];
  const edges = createEdges(asset),
    p = edges.getAttribute("position");
  assert.equal(
    p.count,
    36,
    "extruded L outline has six vertical and twelve horizontal edges",
  );
  edges.dispose();
});
