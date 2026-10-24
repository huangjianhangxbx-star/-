import test from "node:test";
import assert from "node:assert/strict";
import { EditorDocument, createMap } from "../core/document.ts";
import {
  EditOperationSession,
  buildBrushPlan,
  buildCreativePlan,
} from "../core/edit-operation.ts";
const config: any = {
  mode: "volume",
  action: "add",
  shape: "square",
  size: 1,
  thickness: 1,
  level: 0,
  direction: 1,
  color: 1,
  tag: "",
  symmetry: { axes: [true, false, false], center: [0, 0, 0] },
  symmetryOrigin: [0, 0, 0],
  symmetryStep: 0.25,
};
test("voxel candidates mirror add/erase/repaint with centre de-dup and atomic history", () => {
  const e = new EditorDocument(createMap()),
    op = new EditOperationSession(e);
  op.begin(config);
  const plan = op.brush({ x: 0, y: 0, z: 0 });
  assert.deepEqual(plan.candidates.map((p) => p.x).sort(), [-1, 0]);
  op.apply(plan);
  op.commit();
  assert.equal(e.cells.size, 2);
  e.undo();
  assert.equal(e.cells.size, 0);
  e.redo();
  op.begin({ ...config, action: "repaint", color: 2 });
  op.apply(op.brush({ x: 0, y: 0, z: 0 }));
  op.commit();
  assert.ok([...e.cells.values()].every((c) => c.color === 2));
  op.begin({ ...config, action: "erase" });
  op.apply(op.brush({ x: 0, y: 0, z: 0 }));
  op.commit();
  assert.equal(e.cells.size, 0);
  e.undo();
  assert.equal(e.cells.size, 2);
});
test("symmetry rejects other owners, protected cells and illegal centre, creative mirrors actual destination", () => {
  const e = new EditorDocument(createMap());
  const blocked = buildBrushPlan(
    e,
    { x: 0, y: 0, z: 0 },
    { ...config, blockedKeys: ["-1,0,0"] },
  );
  assert.equal(blocked.candidates.find((p) => p.x === -1)!.status, "skipped");
  assert.throws(
    () =>
      buildBrushPlan(
        e,
        { x: 0, y: 0, z: 0 },
        { ...config, symmetry: { ...config.symmetry, center: [0.01, 0, 0] } },
      ),
    /半格/,
  );
  const plan = buildCreativePlan(
    e,
    { x: 0, y: 0, z: 0, face: 4 },
    config,
    true,
  );
  assert.deepEqual(plan.candidates.map((p) => p.x).sort(), [-1, 0]);
});

test("three precision owner editing symmetry deletes paint and tone atomically and undo restores them", async () => {
  const { CanvasSession } = await import("../core/workshop-canvases.ts");
  const { createAsset } = await import("../core/workshop-documents.ts");
  for (const step of [0.25, 0.125, 0.0625]) {
    const a = createAsset("symmetry-owner");
    let s = new CanvasSession(a);
    s.active.voxelStepM = step;
    s.active.originTicks = [-32, 64, 0];
    s.active.cells = [
      { x: -2, y: 0, z: 0, color: 0 },
      { x: 1, y: 0, z: 0, color: 0 },
      { x: 8, y: 0, z: 0, color: 1 },
    ];
    s.model.objects = [
      {
        objectId: "own",
        name: "对称体",
        canvasIds: [s.activeId],
        originTicks: [0, 0, 0],
        cellKeys: ["-2,0,0", "1,0,0"],
      },
      {
        objectId: "other",
        name: "旁物体",
        canvasIds: [s.activeId],
        originTicks: [0, 0, 0],
        cellKeys: ["8,0,0"],
      },
    ];
    s.active.paintSource = {
      schema: "xinghai-surface-paint-1",
      density: 64,
      faces: { "-2,0,0,4": { "0": "#aabbcc" }, "1,0,0,4": { "0": "#aabbcc" } },
    };
    s.active.faceTone = {
      schema: "xinghai-face-tone-1",
      faces: { "-2,0,0,4": { gain: 0.5, affectPaint: true } },
    };
    s = new CanvasSession(s.model);
    s.setEditObject("own");
    const before = structuredClone(s.model),
      op = new EditOperationSession(s.editor);
    op.begin({
      ...config,
      action: "erase",
      symmetryOrigin: [-1, 2, 0],
      symmetryStep: step,
      symmetry: { axes: [true, false, false], center: [-1, 2, 0] },
    });
    op.apply(op.brush({ x: -2, y: 0, z: 0 }));
    op.commit();
    s.sync();
    assert.deepEqual(
      s.active.cells.map((c) => c.x),
      [8],
    );
    assert.equal(Object.keys(s.active.paintSource?.faces ?? {}).length, 0);
    assert.equal(Object.keys(s.active.faceTone?.faces ?? {}).length, 0);
    s.undo();
    assert.deepEqual(s.model.canvases, before.canvases);
    assert.equal(
      s.model.objects!.find((o) => o.objectId === "other")!.cellKeys![0],
      "8,0,0",
    );
  }
});
