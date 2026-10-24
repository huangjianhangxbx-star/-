import { transformPoint } from "../core/coordinates.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAsset,
  createScene,
  validateAsset,
} from "../core/workshop-documents.ts";
import {
  assetRootBounds,
  rootFacePoint,
  snapRootPoint,
  canvasPointMeters,
} from "../core/asset-root.ts";
import { WorkshopSession } from "../desktop/workshop-session.ts";

const hollow = () => {
  const a = createAsset("root-test");
  a.cells = [
    { x: -2, y: 0, z: 0, color: 0 },
    { x: 2, y: 2, z: 4, color: 0 },
  ];
  return a;
};
test("root anchors use outer cell extents and can occupy the empty center of a bottom face", () => {
  const bounds = assetRootBounds(hollow())!;
  assert.deepEqual(bounds, { min: [-0.5, 0, 0], max: [0.75, 0.75, 1.25] });
  assert.deepEqual(rootFacePoint(bounds, "bottom"), [0.125, 0.375, 0]);
  assert.deepEqual(rootFacePoint(bounds, "top", 1, 0), [0.75, 0, 1.25]);
  assert.deepEqual(rootFacePoint(bounds, "front", 0, 1), [-0.5, 0, 1.25]);
  assert.deepEqual(rootFacePoint(bounds, "back", 1, 0), [0.75, 0.75, 0]);
  assert.deepEqual(rootFacePoint(bounds, "left", 1, 1), [-0.5, 0.75, 1.25]);
  assert.deepEqual(rootFacePoint(bounds, "right", 0, 0), [0.75, 0, 0]);
});
test("root bounds include offset fine canvases and hidden geometry, ignoring empty canvases", () => {
  const a = createAsset("multi");
  a.schema = "xinghai-workshop-asset-2";
  a.canvases = [
    {
      canvasId: "a",
      name: "a",
      visible: true,
      locked: false,
      voxelStepM: 0.25,
      originTicks: [0, 0, 0],
      cells: [{ x: 0, y: 0, z: 0, color: 0 }],
      protectedColumns: [],
    },
    {
      canvasId: "b",
      name: "b",
      visible: false,
      locked: true,
      voxelStepM: 0.0625,
      originTicks: [-16, 32, 4],
      cells: [{ x: 1, y: -1, z: 2, color: 0 }],
      protectedColumns: [],
    },
    {
      canvasId: "empty",
      name: "empty",
      visible: true,
      locked: false,
      voxelStepM: 0.25,
      originTicks: [999, 999, 999],
      cells: [],
      protectedColumns: [],
    },
  ];
  assert.deepEqual(assetRootBounds(a), {
    min: [-0.4375, 0, 0],
    max: [0.25, 1, 0.3125],
  });
  assert.equal(assetRootBounds(createAsset("empty")), null);
  assert.deepEqual(
    canvasPointMeters([0.25, -0.5, 0.75], 0.0625, [-16, 32, 4]),
    [-0.4375, 0.875, 0.3125],
  );
});
test("free roots retain coordinates; snaps use active grid origin and never displace chosen face", () => {
  const bounds = { min: [-0.5, 0, 0.03125], max: [0.75, 0.75, 1.25] } as const;
  assert.deepEqual(
    snapRootPoint([0.13, 0.37, 0.03125], "free", 0.25, [0, 0, 0]),
    [0.13, 0.37, 0.03125],
  );
  assert.deepEqual(
    snapRootPoint(
      [0.13, 0.37, 0.03125],
      "vertex",
      0.25,
      [0, 0, 0],
      "bottom",
      bounds,
    ),
    [0.25, 0.25, 0.03125],
  );
  assert.deepEqual(
    snapRootPoint(
      [0.13, 0.37, 0.03125],
      "center",
      0.25,
      [0, 0, 0],
      "bottom",
      bounds,
    ),
    [0.125, 0.375, 0.03125],
  );
  assert.deepEqual(
    snapRootPoint(
      [0.14, 0.3, 0.03125],
      "vertex",
      0.125,
      [0.03125, 0.03125, 0],
      "bottom",
      bounds,
    ),
    [0.15625, 0.28125, 0.03125],
  );
});
test("arbitrary Root is saved as free and supports undo redo without moving voxels or object pivots", () => {
  const m = new WorkshopSession(),
    s = m.openAsset(hollow(), null),
    before = structuredClone(s.asset.cells);
  m.reanchor(s.sessionId, [0.13, 0.375, 0]);
  assert.equal(s.asset.rootMode, "free");
  assert.deepEqual(
    validateAsset(JSON.parse(JSON.stringify(s.asset))).anchorM,
    [0.13, 0.375, 0],
  );
  assert.deepEqual(s.asset.cells, before);
  m.undo(s.sessionId);
  assert.deepEqual(s.asset.anchorM, [0, 0, 0]);
  m.redo(s.sessionId);
  assert.deepEqual(s.asset.anchorM, [0.13, 0.375, 0]);
});

test("free Root preserves a rotated scene instance world geometry and joint history", () => {
  const m = new WorkshopSession(),
    a = hollow(),
    s = m.openAsset(a, null);
  const scene = createScene("root-scene");
  scene.assets = [
    {
      kind: "voxel",
      assetId: a.assetId,
      source: "assets/root-test.xhmodule.json",
    },
  ];
  scene.instances = [
    {
      instanceId: "i",
      assetId: a.assetId,
      positionM: [1, 2, 0],
      rotationDeg: 90,
      groupId: "base",
    },
  ];
  const sc = m.openScene(scene, null),
    before = transformPoint([-0.5, 0, 0], a.anchorM, [1, 2, 0], 90);
  m.reanchor(s.sessionId, [0.13, 0.375, 0]);
  const instance = sc.snapshot().instances[0];
  assert.equal(s.asset.rootMode, "free");
  assert.deepEqual(instance.positionM, [0.625, 2.13, 0]);
  const after = transformPoint(
    [-0.5, 0, 0],
    s.asset.anchorM,
    instance.positionM,
    90,
  );
  after.forEach((n, i) => assert.ok(Math.abs(n - before[i]) < 1e-10));
  m.undoScene("root-scene");
  assert.deepEqual(s.asset.anchorM, [0, 0, 0]);
  assert.deepEqual(sc.snapshot().instances[0].positionM, [1, 2, 0]);
  m.redo(s.sessionId);
  assert.equal(s.asset.rootMode, "free");
});
