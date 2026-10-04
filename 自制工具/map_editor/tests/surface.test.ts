import { test } from "node:test";
import assert from "node:assert/strict";
import { EditorDocument, createMap, validateMap } from "../core/document.ts";
import { resolveFace, connectedTop, pickSurface, visibleTopLabels } from "../core/surface.ts";

test("plane coordinates resolve the actual unit voxel on all six exposed faces", () => {
  const cells = new Map([["-2,3,-4", { x: -2, y: 3, z: -4, color: 0 }]]);
  const faces = [
    [-1, 3, -4, 0], [-2, 3, -4, 1],
    [-2, 4, -4, 2], [-2, 3, -4, 3],
    [-2, 3, -3, 4], [-2, 3, -4, 5],
  ];
  for (const [x, y, z, face] of faces)
    assert.deepEqual(resolveFace(cells, x, y, z, face)?.cell, { x: -2, y: 3, z: -4, color: 0 });
  cells.set("-1,3,-4", { x: -1, y: 3, z: -4, color: 0 });
  assert.equal(resolveFace(cells, -1, 3, -4, 0), null);
});

test("same-height top fill crosses colors but stops at gaps, steps and internal cells", () => {
  const d = createMap();
  d.cells = [
    { x: 0, y: 0, z: 0, color: 0 },
    { x: 1, y: 0, z: 0, color: 1 },
    { x: 1, y: 0, z: 1, color: 1 },
    { x: 0, y: 1, z: 0, color: 1 },
    { x: 3, y: 0, z: 0, color: 0 },
  ];
  // The covered cell at (1,0,0) is not an exposed top, so the chain ends.
  assert.deepEqual(connectedTop(d.cells, 0, 0, 1).map((c) => [c.x, c.y]), [[0, 0], [0, 1]]);
});

test("picking current cells resolves each unit voxel even when the GPU merged their faces", () => {
  const cells = new Map([
    ["0,0,0", { x: 0, y: 0, z: 0, color: 0 }],
    ["1,0,0", { x: 1, y: 0, z: 0, color: 0 }],
  ]);
  assert.deepEqual(pickSurface(cells, [1.5, 0.5, 5], [0, 0, -1])?.cell, cells.get("1,0,0"));
  assert.equal(pickSurface(cells, [1.5, 0.5, 5], [0, 0, -1])?.face, 4);
  cells.delete("1,0,0"); // Edit newer than the Worker result.
  assert.equal(pickSurface(cells, [1.5, 0.5, 5], [0, 0, -1]), null);
  assert.equal(pickSurface(cells, [-2, 0.5, 0.5], [1, 0, 0])?.face, 1);
});
test("height labels show the visible top plane, never empty zero or covered layers", () => {
  const cells = [
    { x: 0, y: 0, z: -1, color: 0 },
    { x: 0, y: 0, z: 2, color: 0 },
    { x: 1, y: 0, z: -1, color: 0 },
  ];
  assert.deepEqual(visibleTopLabels(cells).map((c) => [c.x, c.y, c.top]), [[0, 0, 3], [1, 0, 0]]);
  assert.deepEqual(visibleTopLabels(cells, 0).map((c) => [c.x, c.y, c.top]), [[0, 0, 0], [1, 0, 0]]);
});

test("section labels regard clipped upper cells as hidden", () => {
  const cells = [
    { x: 2, y: 3, z: -1, color: 0 },
    { x: 2, y: 3, z: 0, color: 0 },
  ];
  assert.deepEqual(visibleTopLabels(cells, 0).map((c) => c.top), [0]);
});

test("surface operations reject empty references; stacking follows the selected face", () => {
  const e = new EditorDocument();
  e.begin();
  assert.equal(e.surface(0, 0, 0, 4, "walk")?.status, "skipped");
  e.volume(0, 0, 0, 0);
  e.stack(1, 0, 0, 0, "add", 1);
  e.stack(0, 0, 1, 4, "add", 1);
  e.stack(0, 0, 0, 5, "add", 1);
  assert.deepEqual(new Set(e.doc.cells.map((c: any) => `${c.x},${c.y},${c.z}`)), new Set(["0,0,0", "1,0,0", "0,0,1", "0,0,-1"]));
  e.stack(2, 0, 0, 0, "remove", 1);
  assert.equal(e.doc.cells.some((c: any) => c.x === 1), false);
  e.cancel();
  assert.equal(e.doc.cells.length, 0);
});

test("invalid persisted orphan surface and unsupported placement fail explicitly", () => {
  const d = createMap();
  d.surfaces.push({ x: 0, y: 0, z: 0, face: 4, tag: "ground" });
  assert.throws(() => validateMap(d), /表面/);
  d.surfaces = [];
  d.instances.push({ id: "a", assetId: "b", kind: "model", x: 0.125, y: 0.125, z: 0, rotation: 0 });
  assert.throws(() => validateMap(d), /支撑/);
});
test("removing support reports dependent content and one undo restores it", () => {
  const e = new EditorDocument();
  e.begin();
  e.volume(0, 0, -1, 0);
  e.surface(0, 0, 0, 4, "walk");
  e.place({ id: "model", assetId: "stone", kind: "model", x: 0.125, y: 0.125, z: 0, rotation: 0 });
  e.commit();
  e.begin();
  e.stack(0, 0, 0, 4, "remove", 0);
  e.commit();
  assert.deepEqual(e.detached, { surfaces: 1, instances: 1, decals: 0 });
  assert.equal(e.doc.surfaces.length + e.doc.instances.length, 0);
  e.undo();
  assert.equal(e.doc.surfaces.length + e.doc.instances.length, 2);
});

test("covering a tagged face removes its now-hidden label in the same undoable stroke", () => {
  const e = new EditorDocument();
  e.begin();
  e.volume(0, 0, 0, 0);
  e.surface(1, 0, 0, 0, "obstacle");
  e.commit();
  e.begin();
  e.volume(1, 0, 0, 1);
  e.commit();
  assert.equal(e.doc.surfaces.length, 0);
  assert.equal(e.detached.surfaces, 1);
  e.undo();
  assert.equal(e.doc.surfaces.length, 1);
});

test("covering the support top also removes its model without corrupting the map", () => {
  const e = new EditorDocument();
  e.begin();
  e.volume(0, 0, -1, 0);
  e.place({ id: "m", assetId: "stone", kind: "model", x: 0.125, y: 0.125, z: 0, rotation: 0 });
  e.commit();
  e.begin();
  e.volume(0, 0, 0, 0);
  e.commit();
  assert.equal(e.doc.instances.length, 0);
  assert.equal(e.detached.instances, 1);
});

test("a horizontal decal needs support under its whole footprint", () => {
  const e = new EditorDocument();
  const decal = { id: "d", assetId: "mark", kind: "decal", x: 0.25, y: 0.125,
    z: 0, rotation: 0, width: 0.5, height: 0.25, order: 0 };
  e.begin();
  e.volume(0, 0, -1, 0);
  assert.throws(() => e.decal(decal), /完整.*支撑/);
  e.volume(1, 0, -1, 0);
  e.decal(decal);
  e.commit();
  assert.equal(e.doc.decals.length, 1);
  e.begin();
  e.volume(1, 0, -1, 0, true);
  e.commit();
  assert.equal(e.doc.decals.length, 0);
});
