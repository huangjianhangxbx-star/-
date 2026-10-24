import test from "node:test";
import assert from "node:assert/strict";
import {
  createAsset,
  createScene,
  validateAsset,
  type AssetDocument,
  type Vec3,
} from "../core/workshop-documents.ts";
import { paletteFromMap } from "../core/palette.ts";
import { mergeSceneInstances } from "../core/scene-join.ts";
import { SceneSession } from "../core/scene-session.ts";

test("fine-first rotated offset-canvas merge remains valid for scene copy, move and rotation", () => {
  const f = setup();
  f.a.schema = "xinghai-workshop-asset-2";
  f.a.cells = [];
  f.a.rootMode = "free";
  f.a.anchorM = [0.11, 0.07, 0.03];
  f.scene.instances[0].positionM = [-0.07, 0.11, 0.03];
  f.scene.instances[0].rotationDeg = 90;
  f.a.canvases = [
    {
      canvasId: "fine",
      name: "fine",
      visible: true,
      locked: false,
      voxelStepM: 0.0625,
      originTicks: [1, 3, 0],
      cells: [{ x: 0, y: 0, z: 0, color: 0 }],
      protectedColumns: [],
    },
  ];
  const r = merge(f);
  const session = new SceneSession(
    r.scene,
    new Map([[r.asset.assetId, { kind: "voxel", document: r.asset }]]),
  );
  assert.doesNotThrow(() => session.duplicate("joined", "copy"));
  assert.doesNotThrow(() => session.translateMany(["joined"], [0.25, 0, 0]));
  assert.doesNotThrow(() =>
    session.transform(
      "joined",
      session.snapshot().instances.find((i) => i.instanceId === "joined")!
        .positionM,
      90,
    ),
  );
  assert.deepEqual(
    boxes(r.asset, r.instance.positionM)[0].min,
    [-0.15625, 0.03125, 0],
  );
});

test("merge cannot expose hidden scene group contents", () => {
  const f = setup();
  f.scene.groups[1].visible = false;
  f.scene.instances[1].groupId = f.scene.groups[1].groupId;
  assert.throws(() => merge(f), /显隐/);
});
test("combined cell budget rejects atomically before altering sources", () => {
  const f = setup();
  for (const a of [f.a, f.b])
    a.cells = Array.from({ length: 125001 }, (_, i) => ({
      x: i % 100,
      y: Math.floor(i / 100),
      z: a === f.a ? 0 : 1,
      color: 0,
    }));
  const count = f.a.cells.length;
  assert.throws(() => merge(f), /250000/);
  assert.equal(f.a.cells.length, count);
  assert.equal(f.scene.instances.length, 2);
});
function setup() {
  const a = createAsset("a"),
    b = createAsset("b");
  a.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  b.cells = [{ x: 0, y: 0, z: 0, color: 1 }];
  const scene = createScene("s");
  scene.assets = [a, b].map((v) => ({
    kind: "voxel" as const,
    assetId: v.assetId,
    source: `assets/${v.assetId}.xhmodule.json`,
  }));
  scene.instances = [
    {
      instanceId: "i",
      assetId: "a",
      positionM: [0, 0, 0],
      rotationDeg: 0,
      groupId: "base",
    },
    {
      instanceId: "j",
      assetId: "b",
      positionM: [1, 0, 0],
      rotationDeg: 0,
      groupId: "base",
    },
  ];
  return {
    a,
    b,
    scene,
    assets: new Map([
      ["a", a],
      ["b", b],
    ]),
  };
}
function merge(f = setup()) {
  return mergeSceneInstances(f.scene, f.assets, ["i", "j"], "merged", "joined");
}
function boxes(a: AssetDocument, p: Vec3) {
  return a.canvases!.flatMap((c) =>
    c.cells.map((v) => ({
      min: [v.x, v.y, v.z].map((n, i) =>
        Number(
          (n * c.voxelStepM + c.originTicks[i] * 0.03125 + p[i]).toFixed(9),
        ),
      ),
      step: c.voxelStepM,
      color: a.palette[v.color],
    })),
  );
}
test("join replaces scene instances, preserves sources and makes editable joined ownership", () => {
  const f = setup(),
    before = structuredClone(f);
  const r = merge(f);
  assert.equal(r.scene.instances.length, 1);
  assert.equal(r.scene.assets.length, 3);
  assert.equal(r.instance.rotationDeg, 0);
  assert.equal(r.asset.canvases!.length, 1);
  assert.equal(r.asset.objects!.length, 1);
  assert.equal(r.asset.objects![0].cellKeys!.length, 2);
  assert.equal(r.asset.canvases![0].editor, undefined);
  assert.deepEqual(f, before);
  assert.deepEqual(validateAsset(r.asset), r.asset);
});
test("90/180/270 rotations bake cube minima with free roots and negative source offsets", () => {
  for (const angle of [90, 180, 270]) {
    const f = setup();
    f.a.rootMode = "free";
    f.a.anchorM = [0.11, -0.07, 0.03];
    f.a.canvases = [
      {
        canvasId: "c",
        name: "c",
        visible: true,
        locked: true,
        voxelStepM: 0.125,
        originTicks: [-4, 8, -2],
        cells: [{ x: -2, y: 1, z: -1, color: 0 }],
        protectedColumns: [],
      },
    ];
    f.a.schema = "xinghai-workshop-asset-2";
    f.a.cells = [];
    f.scene.instances[0].rotationDeg = angle;
    f.scene.instances[0].positionM =
      angle === 90
        ? [0.07, 0.11, 0.03]
        : angle === 180
          ? [-0.11, 0.07, 0.03]
          : [-0.07, -0.11, 0.03];
    const r = merge(f),
      actual = boxes(r.asset, r.instance.positionM).find(
        (c) => c.step === 0.125,
      )!;
    const x = -0.375,
      y = 0.375,
      z = -0.1875;
    const expected =
      angle === 90
        ? [-y - 0.125, x, z]
        : angle === 180
          ? [-x - 0.125, -y - 0.125, z]
          : [y, -x - 0.125, z];
    assert.deepEqual(actual.min, expected);
    assert.equal(
      r.asset.canvases!.find((c) => c.voxelStepM === 0.125)!.locked,
      false,
    );
  }
});
test("later selected same-grid overlap wins and material profiles remap by full values", () => {
  const f = setup();
  f.scene.instances[1].positionM = [0, 0, 0];
  f.b.materialProfile.colors[1].roughness = 0.2;
  const r = merge(f);
  assert.equal(r.asset.canvases![0].cells.length, 1);
  const c = r.asset.canvases![0].cells[0];
  assert.equal(r.asset.materialProfile.colors[c.color].roughness, 0.2);
  assert.equal(r.asset.palette[c.color], f.b.palette[1]);
});
test("mixed precision and grid phases stay distinct without resampling; visibility retained", () => {
  const f = setup();
  f.b.schema = "xinghai-workshop-asset-2";
  f.b.cells = [];
  f.b.canvases = [
    {
      canvasId: "c",
      name: "fine",
      visible: false,
      locked: true,
      voxelStepM: 0.0625,
      originTicks: [1, 0, 0],
      cells: [{ x: 0, y: 0, z: 0, color: 1 }],
      protectedColumns: [],
    },
  ];
  const r = merge(f);
  assert.equal(r.asset.canvases!.length, 2);
  assert.equal(r.asset.canvases![1].visible, false);
  assert.equal(r.asset.canvases![1].voxelStepM, 0.0625);
  assert.deepEqual(
    boxes(r.asset, r.instance.positionM)[1].min,
    [1.03125, 0, 0],
  );
});
test("incompatible transforms, selections, side colors and budgets fail atomically", () => {
  for (const kind of [
    "count",
    "missing",
    "external",
    "rotation",
    "phase",
    "side",
    "palette",
    "canvases",
    "collision",
  ]) {
    const f = setup();
    if (kind === "rotation") f.scene.instances[1].rotationDeg = 45;
    if (kind === "phase") f.scene.instances[1].positionM = [0.001, 0, 0];
    if (kind === "side") f.b.sideColor = 0;
    if (kind === "external")
      f.scene.assets[1] = {
        kind: "texture",
        assetId: "b",
        revision: 0,
        image: "textures/b.png",
      };
    if (kind === "palette") {
      for (const a of [f.a, f.b]) {
        a.palette = Array.from(
          { length: 64 },
          (_, i) =>
            "#" + (i + (a === f.b ? 100 : 0)).toString(16).padStart(6, "0"),
        );
        a.materialProfile = paletteFromMap(a);
        a.cells = Array.from({ length: 64 }, (_, i) => ({
          x: i,
          y: 0,
          z: 0,
          color: i,
        }));
      }
    }
    if (kind === "canvases") {
      f.a.schema = "xinghai-workshop-asset-2";
      f.a.canvases = [
        {
          canvasId: "ac",
          name: "ac",
          visible: true,
          locked: false,
          voxelStepM: 0.125,
          originTicks: [0, 0, 0],
          cells: f.a.cells,
          protectedColumns: [],
        },
      ];
      f.a.cells = [];
      f.b.schema = "xinghai-workshop-asset-2";
      f.b.cells = [];
      f.b.canvases = Array.from({ length: 32 }, (_, i) => ({
        canvasId: "c" + i,
        name: "c",
        visible: true,
        locked: false,
        voxelStepM: 0.25,
        originTicks: [i % 8, Math.floor(i / 8), 0],
        cells: [{ x: 0, y: 0, z: 0, color: 1 }],
        protectedColumns: [],
      }));
    }
    const before = structuredClone(f);
    assert.throws(
      () =>
        mergeSceneInstances(
          f.scene,
          f.assets,
          kind === "count"
            ? ["i"]
            : kind === "missing"
              ? ["i", "absent"]
              : ["i", "j"],
          kind === "collision" ? "a" : "merged",
          "joined",
        ),
      undefined,
      kind,
    );
    assert.deepEqual(f, before);
  }
});
test("cross-collection merge retains active collection and remaining members only once", () => {
  const f = setup();
  f.scene.instances.push({ ...f.scene.instances[0], instanceId: "k" });
  f.scene.collections = [
    { collectionId: "ca", name: "A", memberIds: ["i", "k"] },
    { collectionId: "cb", name: "B", memberIds: ["j"] },
  ];
  const r = merge(f);
  assert.deepEqual(r.scene.collections, [
    { collectionId: "ca", name: "A", memberIds: ["k"] },
    { collectionId: "cb", name: "B", memberIds: ["joined"] },
  ]);
});
test("unaligned legacy scene placements fail instead of creating an untransformable joined asset", () => {
  const f = setup();
  f.scene.instances[0].positionM = [0.013, 0.019, 0.023];
  f.scene.instances[1].positionM = [1.013, 0.019, 0.023];
  assert.throws(() => merge(f), /对齐/);
});
test("same effective side material remaps across different source palette indices", () => {
  const f = setup();
  f.a.sideColor = 0;
  f.b.sideColor = 1;
  f.b.palette[1] = f.a.palette[0];
  f.b.materialProfile.colors[1] = {
    ...structuredClone(f.a.materialProfile.colors[0]),
    colorId: "changed",
  };
  const r = merge(f);
  assert.equal(r.asset.sideColor, 0);
  assert.equal(r.asset.palette[0], f.a.palette[0]);
});

test("merging a scene without collections does not introduce an undefined field rejected by V2 IPC validation", () => {
  const f = setup(),
    r = merge(f);
  assert.equal(Object.hasOwn(r.scene, "collections"), false);
});
