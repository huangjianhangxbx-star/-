import test from "node:test";
import assert from "node:assert/strict";
import {
  paintPixels,
  paintFaceKey,
  paintResolution,
  validateSurfacePaint,
  sampleFace,
  remapPaint,
} from "../core/surface-paint.ts";
import { createAsset, validateAsset } from "../core/workshop-documents.ts";
import { CanvasSession } from "../core/workshop-canvases.ts";
test("surface sparse pixels validate sample erase and bound all steps", () => {
  for (const step of [0.25, 0.125, 0.0625])
    for (let f = 0; f < 6; f++) {
      const key = paintFaceKey(-1, 0, 2, f),
        n = paintResolution(step);
      let p = paintPixels(
        undefined,
        [{ key, index: n * n - 1 }],
        "#abcdef",
        step,
      );
      assert.equal(sampleFace(p, key, n * n - 1, "#000000"), "#abcdef");
      validateSurfacePaint(p, step);
      p = paintPixels(p, [{ key, index: n * n - 1 }], null, step);
      assert.deepEqual(p.faces, {});
    }
});
test("surface rejects malicious and noncanonical inputs", () => {
  for (const faces of [
    { "0,0,0,6": { "0": "#ffffff" } },
    { "0,0,0,0": { "256": "#ffffff" } },
    { "0,0,0,0": { NaN: "#ffffff" } },
    { "0,0,0,0": { "0": "red" } },
  ])
    assert.throws(() =>
      validateSurfacePaint(
        { schema: "xinghai-surface-paint-1", density: 64, faces },
        0.25,
      ),
    );
  assert.throws(() =>
    validateSurfacePaint({ schema: "future", density: 64, faces: {} }, 0.25),
  );
});
test("surface source survives upgrade ordered undo native validation and ownership scope", () => {
  const a = createAsset("paint-test");
  a.cells = [
    { x: 0, y: 0, z: 0, color: 0 },
    { x: 1, y: 0, z: 0, color: 0 },
  ];
  a.paintSource = paintPixels(
    undefined,
    [{ key: "0,0,0,0", index: 0 }],
    "#abcdef",
    0.25,
  );
  const s = new CanvasSession(a);
  assert.ok(s.active.paintSource);
  s.setEditObject(s.model.objects![0].objectId);
  const p = paintPixels(
    s.active.paintSource,
    [{ key: "0,0,0,1", index: 0 }],
    "#123456",
    0.25,
  );
  const cells = structuredClone(s.active.cells);
  s.paint(p);
  assert.deepEqual(s.active.cells, cells);
  assert.deepEqual(validateAsset(JSON.parse(JSON.stringify(s.model))), s.model);
  s.undo();
  assert.equal(s.active.paintSource!.faces["0,0,0,1"], undefined);
  s.redo();
  assert.ok(s.active.paintSource!.faces["0,0,0,1"]);
  assert.throws(() =>
    s.paint(
      paintPixels(
        s.active.paintSource,
        [{ key: "1,0,0,1", index: 0 }],
        "#123456",
        0.25,
      ),
    ),
  );
});
test("surface move and four quarter turns preserve exact pixels", () => {
  let p = paintPixels(
    undefined,
    [
      { key: "0,0,0,0", index: 19 },
      { key: "0,0,0,4", index: 253 },
    ],
    "#abcdef",
    0.25,
  );
  const original = structuredClone(p);
  for (let i = 0; i < 4; i++)
    p = remapPaint(p, new Map([["0,0,0", "0,0,0"]]), 0.25, 2, 1)!;
  assert.deepEqual(p, original);
});
test("paint member translation clipboard rotation and deletion follow exact owner", () => {
  const a = createAsset("lifecycle");
  a.cells = [
    { x: 0, y: 0, z: 0, color: 0 },
    { x: 1, y: 0, z: 0, color: 0 },
  ];
  a.paintSource = paintPixels(
    undefined,
    [
      { key: "0,0,0,0", index: 19 },
      { key: "1,0,0,2", index: 22 },
    ],
    "#aabbcc",
    0.25,
  );
  const s = new CanvasSession(a),
    id = s.model.objects![0].objectId;
  s.moveObjects([id], [16, 0, 0]);
  assert.ok(s.active.paintSource!.faces["2,0,0,0"]);
  assert.ok(s.active.paintSource!.faces["1,0,0,2"]);
  assert.equal(s.active.paintSource!.faces["0,0,0,0"], undefined);
  const copies = s.duplicateObjects([id]);
  assert.equal(Object.keys(s.active.paintSource!.faces).length, 3);
  s.rotateObjects([id], 2, 4);
  s.removeObjects(copies);
  assert.equal(Object.keys(s.active.paintSource!.faces).length, 2);
  s.undo();
  assert.equal(Object.keys(s.active.paintSource!.faces).length, 3);
});
test("paint canvas merge maps coordinate keys and later overwrite deletes prior paint", () => {
  const a = createAsset("merge-painted");
  a.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  a.paintSource = paintPixels(
    undefined,
    [{ key: "0,0,0,0", index: 19 }],
    "#aabbcc",
    0.25,
  );
  const s = new CanvasSession(a),
    first = s.activeId;
  s.add("second", 0.25);
  s.editor.begin();
  s.editor.put(0, 0, 0, 0, "volume");
  s.editor.commit();
  s.sync();
  const id = s.model.objects!.find(
    (o) => o.canvasIds[0] === s.activeId,
  )!.objectId;
  s.setEditObject(id);
  s.paint(
    paintPixels(undefined, [{ key: "0,0,0,4", index: 31 }], "#123456", 0.25),
  );
  s.setEditObject(null);
  s.mergeCanvases([first, s.activeId], first);
  assert.equal(s.active.paintSource!.faces["0,0,0,0"], undefined);
  assert.equal(s.active.paintSource!.faces["0,0,0,4"]["31"], "#123456");
  s.undo();
  assert.equal(s.model.canvases!.length, 2);
});
test("paint rotation texel mapping handles every axis face and precision", () => {
  for (const step of [0.25, 0.125, 0.0625])
    for (let axis = 0; axis < 3; axis++) {
      let p = paintPixels(
          undefined,
          Array.from({ length: 6 }, (_, f) => ({
            key: `0,0,0,${f}`,
            index: paintResolution(step) + 2,
          })),
          "#abc123",
          step,
        ),
        before = structuredClone(p);
      for (let t = 0; t < 4; t++)
        p = remapPaint(p, new Map([["0,0,0", "0,0,0"]]), step, axis, 1)!;
      assert.deepEqual(p, before);
    }
});
test("hidden locked and objectmode paint reject without source or history mutation", () => {
  const a = createAsset("permissions");
  a.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  const s = new CanvasSession(a),
    p = paintPixels(undefined, [{ key: "0,0,0,0", index: 0 }], "#123456", 0.25);
  assert.throws(() => s.paint(p));
  s.setEditObject(s.model.objects![0].objectId);
  for (const patch of [{ visible: false }, { visible: true, locked: true }]) {
    s.patch(patch);
    const before = JSON.stringify(s.model),
      history = s.past.length;
    assert.throws(() => s.paint(p));
    assert.equal(JSON.stringify(s.model), before);
    assert.equal(s.past.length, history);
  }
});
test("surface budgets reject covered pixels and excessive face counts", () => {
  const pixels = Object.fromEntries(
    Array.from({ length: 256 }, (_, i) => [i, "#abcdef"]),
  );
  const faces = Object.fromEntries(
    Array.from({ length: 1025 }, (_, i) => [`${i},0,0,0`, pixels]),
  );
  assert.throws(
    () =>
      validateSurfacePaint(
        { schema: "xinghai-surface-paint-1", density: 64, faces },
        0.25,
      ),
    /预算/,
  );
  const empty = Object.fromEntries(
    Array.from({ length: 16385 }, (_, i) => [`${i},0,0,0`, {}]),
  );
  assert.throws(
    () =>
      validateSurfacePaint(
        { schema: "xinghai-surface-paint-1", density: 64, faces: empty },
        0.25,
      ),
    /预算/,
  );
});
test("paint separation stays on source face and occluded faces survive geometry addition", () => {
  const a = createAsset("occluded");
  a.cells = [
    { x: 0, y: 0, z: 0, color: 0 },
    { x: 1, y: 0, z: 0, color: 0 },
  ];
  const s = new CanvasSession(a),
    id = s.joinObjects(s.model.objects!.map((o) => o.objectId))!;
  s.setEditObject(id);
  s.paint(
    paintPixels(undefined, [{ key: "0,0,0,0", index: 0 }], "#abcdef", 0.25),
  );
  const split = s.separateCells([{ x: 0, y: 0, z: 0 }])!;
  assert.ok(s.active.paintSource!.faces["0,0,0,0"]);
  s.setEditObject(split);
  s.editor.begin();
  s.editor.put(0, 1, 0, 0, "volume");
  s.editor.commit();
  s.sync();
  assert.ok(s.active.paintSource!.faces["0,0,0,0"]);
  s.editor.begin();
  s.editor.volume(0, 0, 0, 0, true);
  s.editor.commit();
  s.sync();
  assert.equal(s.active.paintSource!.faces["0,0,0,0"], undefined);
});

import { cloneAsset } from "../core/asset-copy.ts";
import { toNativeV1 } from "../core/workshop-adapter.ts";
test("paint asset cloning keeps independent source and legacy native refuses silent loss", () => {
  const a = createAsset("paint-clone");
  a.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  a.paintSource = paintPixels(
    undefined,
    [{ key: "0,0,0,0", index: 0 }],
    "#123456",
    0.25,
  );
  const copy = cloneAsset(a, "paint-cloned");
  assert.deepEqual(copy.paintSource, a.paintSource);
  copy.paintSource!.faces["0,0,0,0"]["0"] = "#abcdef";
  assert.equal(a.paintSource.faces["0,0,0,0"]["0"], "#123456");
  assert.throws(() => toNativeV1(a), /表面绘画/);
});
test("quarter turn around Z rotates positive X face to positive Y with mirrored U", () => {
  const p = paintPixels(
      undefined,
      [{ key: "0,0,0,0", index: 19 }],
      "#abcdef",
      0.25,
    ),
    rotated = remapPaint(p, new Map([["0,0,0", "2,3,4"]]), 0.25, 2, 1)!;
  assert.deepEqual(rotated.faces, { "2,3,4,2": { "28": "#abcdef" } });
});
test("document refuses orphan painted owners and V2 root source", () => {
  const a = createAsset("orphan");
  a.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  a.paintSource = paintPixels(
    undefined,
    [{ key: "1,0,0,0", index: 0 }],
    "#abcdef",
    0.25,
  );
  assert.throws(() => validateAsset(a), /所属体素/);
  delete a.paintSource;
  const s = new CanvasSession(a);
  assert.throws(
    () =>
      validateAsset({
        ...s.model,
        paintSource: paintPixels(
          undefined,
          [{ key: "0,0,0,0", index: 0 }],
          "#abcdef",
          0.25,
        ),
      }),
    /画布内/,
  );
});

test("opaque paint cannot silently replace transparent face materials", () => {
  const a = createAsset("transparent-paint");
  a.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  a.materialProfile.colors[1].alpha = 0.5;
  a.materialProfile.colors[1].alphaMode = "BLEND";
  a.sideColor = 1;
  a.paintSource = paintPixels(
    undefined,
    [{ key: "0,0,0,4", index: 0 }],
    "#ff0000",
    0.25,
  );
  validateAsset(a);
  a.paintSource = paintPixels(
    a.paintSource,
    [{ key: "0,0,0,0", index: 0 }],
    "#ff0000",
    0.25,
  );
  assert.throws(() => validateAsset(a), /不透明/);
});
