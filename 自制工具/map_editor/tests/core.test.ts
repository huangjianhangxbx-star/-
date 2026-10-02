import { test } from "node:test";
import assert from "node:assert/strict";
import { createMap, validateMap, EditorDocument } from "../core/document.ts";
import { meshMap, affectedChunks } from "../core/mesher.ts";
test("zero top and thickness create negative solid cells, not empty", () => {
  const e = new EditorDocument();
  e.begin();
  e.height(-1, 0, 0, 2, 0);
  e.commit();
  assert.deepEqual(e.doc.cells.map((c: any) => c.z).sort(), [-1, -2]);
});
test("one stroke undoes all cells and redo restores it", () => {
  const e = new EditorDocument();
  e.begin();
  e.height(0, 0, 1, 1, 0);
  e.height(1, 0, 1, 1, 0);
  e.commit();
  e.undo();
  assert.equal(e.doc.cells.length, 0);
  e.redo();
  assert.equal(e.doc.cells.length, 2);
});
test("cancel restores pre-stroke state", () => {
  const e = new EditorDocument();
  e.begin();
  e.height(0, 0, 1, 1, 0);
  e.cancel();
  assert.equal(e.doc.cells.length, 0);
});
test("height editing cannot fill protected bridge space", () => {
  const e = new EditorDocument();
  e.begin();
  e.volume(0, 0, 4, 0);
  e.commit();
  e.begin();
  assert.throws(() => e.height(0, 0, 6, 6, 1), /三维/);
  e.cancel();
  assert.equal(e.doc.cells.length, 1);
});
test("flood respects disconnected and other-height cells", () => {
  const d = createMap();
  d.cells = [
    { x: 0, y: 0, z: 0, color: 0, owner: "height" },
    { x: 1, y: 0, z: 0, color: 0, owner: "height" },
    { x: 4, y: 0, z: 0, color: 0, owner: "height" },
    { x: 0, y: 0, z: 2, color: 0, owner: "volume" },
  ];
  const e = new EditorDocument(d);
  e.begin();
  e.flood(0, 0, 0, 1);
  e.commit();
  assert.deepEqual(
    e.doc.cells.map((c: any) => c.color),
    [1, 1, 0, 0],
  );
});
test("bad version, coordinates, duplicate cells, palette and instances rejected", () => {
  for (const mutate of [
    (d: any) => (d.version = 99),
    (d: any) => (d.voxelSize = 0),
    (d: any) => (d.cells = [{ x: 0.5, y: 0, z: 0, color: 0 }]),
    (d: any) =>
      (d.cells = [
        { x: 0, y: 0, z: 0, color: 0 },
        { x: 0, y: 0, z: 0, color: 0 },
      ]),
    (d: any) => (d.palette = ["bad"]),
    (d: any) => (d.instances = [{ id: "a" }, { id: "a" }]),
  ]) {
    const d = createMap();
    mutate(d);
    assert.throws(() => validateMap(d));
  }
});
test("one same-color rectangular block greedily becomes six quads", () => {
  const d = createMap();
  for (let x = 0; x < 3; x++)
    for (let y = 0; y < 2; y++)
      for (let z = 0; z < 2; z++) d.cells.push({ x, y, z, color: 0 });
  assert.equal(meshMap(d).length, 6);
});
test("cross-chunk neighbors do not emit internal faces", () => {
  const d = createMap();
  d.cells = [
    { x: 15, y: 0, z: 0, color: 0 },
    { x: 16, y: 0, z: 0, color: 0 },
  ];
  assert.equal(meshMap(d).length, 10);
});
test("negative chunk neighbors are invalidated on boundaries", () => {
  assert.deepEqual(
    new Set(affectedChunks(-1, 0, 0)),
    new Set(["-1,0,0", "0,0,0", "-1,-1,0", "-1,0,-1"]),
  );
});
test("bridge underside exists and palette seam remains", () => {
  const d = createMap();
  d.cells = [
    { x: 0, y: 0, z: 0, color: 0 },
    { x: 0, y: 0, z: 1, color: 0 },
    { x: 2, y: 0, z: 0, color: 0 },
    { x: 2, y: 0, z: 1, color: 0 },
    { x: 0, y: 0, z: 2, color: 1 },
    { x: 1, y: 0, z: 2, color: 1 },
    { x: 2, y: 0, z: 2, color: 1 },
  ];
  const faces = meshMap(d);
  assert.ok(
    faces.some(
      (q: any) => q.axis === 2 && q.sign === -1 && q.plane === 2 && q.a === 1,
    ),
  );
  assert.equal(new Set(faces.map((q: any) => q.color)).size, 2);
});
test("event registry key is distinct from preview asset and anchor must be finite", () => {
  const d = createMap();
  d.cells = [{ x: 0, y: 0, z: -1, color: 0 }];
  d.instances = [
    {
      id: "one",
      assetId: "preview",
      kind: "event",
      x: 0,
      y: 0,
      z: 0,
      rotation: 0,
    },
  ];
  assert.throws(() => validateMap(d));
  d.instances[0].registryKey = "sample.switch";
  assert.doesNotThrow(() => validateMap(d));
  d.instances[0].anchor = [0, NaN, 0];
  assert.throws(() => validateMap(d));
});
test("fixed side color leaves top color and rejects invalid palette slot", () => {
  const d = createMap();
  d.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  d.sideColor = 2;
  const faces = meshMap(validateMap(d));
  assert.equal(faces.find((q) => q.axis === 2 && q.sign === 1)?.color, 0);
  assert.ok(
    faces
      .filter((q) => q.axis !== 2 || q.sign !== 1)
      .every((q) => q.color === 2),
  );
  assert.throws(() => validateMap({ ...d, sideColor: 90 }));
});
test("logic tags distinguish bridge underside and top without modifying geometry", () => {
  const e = new EditorDocument();
  e.begin();
  e.height(0, 0, 0, 1, 0);
  e.volume(0, 0, 3, 1);
  e.volume(1, 0, -1, 0);
  e.surface(0, 0, 0, 4, "walk");
  e.surface(0, 0, 3, 5, "obstacle");
  e.surface(0, 0, 4, 4, "walk");
  e.surface(1, 0, 0, 4, "deploy");
  e.commit();
  assert.equal(e.doc.cells.length, 3);
  assert.equal(e.doc.surfaces.length, 4);
  assert.equal(e.doc.surfaces.filter((s) => s.tag === "walk").length, 2);
  assert.equal(e.doc.surfaces.find((s) => s.face === 5).tag, "obstacle");
});
