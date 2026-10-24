import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectCanvasRows,
  planCanvasMerge,
} from "../desktop/canvas-list-state.ts";
import { CanvasSession } from "../core/workshop-canvases.ts";
import { createAsset } from "../core/workshop-documents.ts";
test("canvas list selection distinguishes target, ctrl removal and shift anchor without document history", () => {
  const state = { selected: ["a"], active: "a", anchor: "a" };
  const next = selectCanvasRows(["a", "b", "c", "d"], state, "c", "ctrl");
  assert.deepEqual(next.selected, ["a", "c"]);
  assert.equal(next.active, "c");
  const range = selectCanvasRows(
    ["a", "b", "c", "d"],
    { ...state, anchor: "a" },
    "c",
    "shift",
  );
  assert.deepEqual(range.selected, ["a", "b", "c"]);
  assert.equal(range.active, "c");
  const removed = selectCanvasRows(["a", "b", "c", "d"], next, "c", "ctrl");
  assert.equal(removed.active, "a");
  assert.deepEqual(state, { selected: ["a"], active: "a", anchor: "a" });
});
test("merge preflight reports named incompatibility and actual overlap order", () => {
  const s = new CanvasSession(createAsset("list"));
  s.add("第二张", 0.25);
  s.add("细格", 0.125);
  const model = s.model,
    c = model.canvases!;
  c[0].cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  c[1].cells = [{ x: 0, y: 0, z: 0, color: 1 }];
  const plan = planCanvasMerge(
    model,
    [c[0].canvasId, c[1].canvasId],
    c[1].canvasId,
  );
  assert.equal(plan.overlaps, 1);
  assert.deepEqual(plan.order, [c[1].canvasId, c[0].canvasId]);
  assert.throws(
    () =>
      planCanvasMerge(
        model,
        c.map((c) => c.canvasId),
        c[0].canvasId,
      ),
    /细格.*精度/,
  );
  c[1].locked = true;
  assert.throws(
    () => planCanvasMerge(model, [c[0].canvasId, c[1].canvasId], c[0].canvasId),
    /第二张.*锁定/,
  );
});
test("batch canvas deletion is atomic, refuses locked/last canvas, and is one undo", () => {
  const s = new CanvasSession(createAsset("delete"));
  s.add("B", 0.25);
  s.add("C", 0.25);
  const ids = s.model.canvases!.map((c) => c.canvasId),
    past = s.past.length;
  s.removeCanvases(ids.slice(1));
  assert.equal(s.model.canvases!.length, 1);
  assert.equal(s.past.length, past + 1);
  s.undo();
  assert.equal(s.model.canvases!.length, 3);
  s.patch({ locked: true }, ids[1]);
  const before = JSON.stringify(s.model);
  assert.throws(() => s.removeCanvases(ids.slice(1)), /锁定/);
  assert.equal(JSON.stringify(s.model), before);
  assert.throws(() => s.removeCanvases(ids), /至少/);
});
import { exportAssetGlb } from "../core/workshop-glb.ts";
import { validatePublishGlb } from "../core/publish-glb-validation.ts";
import { Box3, Vector3, Matrix4, Quaternion } from "three";
function exportedBounds(model: any) {
  const { json: j } = validatePublishGlb(exportAssetGlb(model)),
    box = new Box3();
  const visit = (id: number, parent: Matrix4) => {
    const n = j.nodes[id],
      local = n.matrix
        ? new Matrix4().fromArray(n.matrix)
        : new Matrix4().compose(
            new Vector3(
              ...((n.translation ?? [0, 0, 0]) as [number, number, number]),
            ),
            new Quaternion(
              ...((n.rotation ?? [0, 0, 0, 1]) as [
                number,
                number,
                number,
                number,
              ]),
            ),
            new Vector3(
              ...((n.scale ?? [1, 1, 1]) as [number, number, number]),
            ),
          ),
      world = parent.clone().multiply(local);
    if (n.mesh !== undefined)
      for (const p of j.meshes[n.mesh].primitives) {
        const a = j.accessors[p.attributes.POSITION];
        box.union(
          new Box3(
            new Vector3(...(a.min as [number, number, number])),
            new Vector3(...(a.max as [number, number, number])),
          ).applyMatrix4(world),
        );
      }
    for (const id of n.children ?? []) visit(id, world);
  };
  for (const id of j.scenes[j.scene ?? 0].nodes) visit(id, new Matrix4());
  return [box.min.toArray(), box.max.toArray()];
}
test("merge keeps painted/tone sources, distinct owners, collections, Root and export bounds through undo/reopen", () => {
  const a = createAsset("merge-layers");
  a.schema = "xinghai-workshop-asset-2";
  a.rootMode = "free";
  a.anchorM = [0.125, -0.25, 0.0625];
  a.cells = [];
  a.canvases = [0, 1, 2].map((i) => ({
    canvasId: "c" + i,
    name: "层" + i,
    visible: true,
    locked: false,
    voxelStepM: 0.25,
    originTicks: [i * 8, 0, 0],
    cells: [{ x: 0, y: 0, z: 0, color: i }],
    protectedColumns: [],
  }));
  a.canvases[0].paintSource = {
    schema: "xinghai-surface-paint-1",
    density: 64,
    faces: { "0,0,0,4": { "0": "#abcdef" } },
  };
  a.canvases[1].faceTone = {
    schema: "xinghai-face-tone-1",
    faces: { "0,0,0,4": { gain: 0.7, affectPaint: false } },
  };
  a.objects = a.canvases.map((c, i) => ({
    objectId: "o" + i,
    name: c.name,
    canvasIds: [c.canvasId],
    originTicks: [...c.originTicks],
    cellKeys: ["0,0,0"],
  }));
  a.objectCollections = [
    { collectionId: "g", name: "集合", memberIds: ["o0", "o1"] },
  ];
  const s = new CanvasSession(a),
    before = structuredClone(s.model),
    bounds = exportedBounds(before);
  s.mergeCanvases(["c0", "c1"], "c0");
  const after = structuredClone(s.model);
  assert.deepEqual(exportedBounds(after), bounds);
  assert.equal(s.active.paintSource!.faces["0,0,0,4"]["0"], "#abcdef");
  assert.equal(s.active.faceTone!.faces["1,0,0,4"].gain, 0.7);
  assert.deepEqual(after.anchorM, before.anchorM);
  assert.deepEqual(
    after.canvases!.find((c) => c.canvasId === "c2"),
    before.canvases!.find((c) => c.canvasId === "c2"),
  );
  assert.deepEqual(after.objectCollections, before.objectCollections);
  assert.deepEqual(
    after.objects!.map((o) => o.objectId),
    before.objects!.map((o) => o.objectId),
  );
  s.undo();
  assert.deepEqual(s.model.canvases, before.canvases);
  s.redo();
  assert.deepEqual(s.model.canvases, after.canvases);
  const reopened = new CanvasSession(JSON.parse(JSON.stringify(s.model)));
  assert.deepEqual(reopened.model.canvases, after.canvases);
  assert.deepEqual(exportedBounds(reopened.model), bounds);
});
test("misaligned and leased merges fail atomically", () => {
  const s = new CanvasSession(createAsset("atomic"));
  s.add("偏半格", 0.25);
  const first = s.model.canvases![0].canvasId,
    second = s.activeId;
  s.patch({ originTicks: [4, 0, 0] });
  const before = JSON.stringify(s.model);
  assert.throws(
    () => planCanvasMerge(s.model, [first, second], first),
    /偏半格.*对齐/,
  );
  assert.throws(() => s.mergeCanvases([first, second], first));
  assert.equal(JSON.stringify(s.model), before);
  s.patch({ originTicks: [8, 0, 0] });
  s.acquireWriter("writer");
  const leased = JSON.stringify(s.model);
  assert.throws(() => s.mergeCanvases([first, second], first), /绘画/);
  assert.equal(JSON.stringify(s.model), leased);
  s.releaseWriter("writer");
});
