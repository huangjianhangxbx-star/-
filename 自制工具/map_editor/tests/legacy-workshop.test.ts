import { test } from "node:test";
import assert from "node:assert/strict";
import { createMap } from "../core/document.ts";
import { createAsset, createScene } from "../core/workshop-documents.ts";
import { transformPoint } from "../core/coordinates.ts";
import { createReference } from "../core/references.ts";
let api: any = {};
try {
  api = await import("../core/legacy-workshop.ts");
} catch (e) {
  if (e.code !== "ERR_MODULE_NOT_FOUND") throw e;
}
function ids() {
  let n = 0;
  return () => `new-${++n}`;
}

test("copying a scene with a missing private voxel source preserves its kind and reports the unresolved source", () => {
  const scene = createScene("missing-source");
  scene.assets.push({
    kind: "voxel",
    assetId: "missing-module",
    source: "assets/missing-module.xhmodule.json",
  });
  scene.instances.push({
    instanceId: "instance",
    assetId: "missing-module",
    positionM: [-0.25, 1, 0],
    rotationDeg: 90,
    groupId: "base",
  });
  const copied = api.copyWorkshopScene(scene, new Map(), ids());
  assert.equal(copied.scene.assets[0].kind, "voxel");
  assert.notEqual(copied.scene.assets[0].assetId, "missing-module");
  assert.deepEqual(copied.scene.instances[0].positionM, [-0.25, 1, 0]);
  assert.ok(copied.issues.some((i) => i.code === "missing-asset"));
  assert.equal(copied.modules.length, 0);
});
test("terrain reference PNG and art decal retain separate editor and scene frames; support data stays attached", () => {
  const old = fixture();
  old.surfaces = [{ x: 0, y: 0, z: 0, face: 4, tag: "walk" }];
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGN4ppHyH4QZYAwAVugJxfB+DTwAAAAASUVORK5CYII=",
    "base64",
  );
  old.editor = {
    reference: createReference({
      id: "ref",
      name: "人",
      dataUrl: "data:image/png;base64," + png.toString("base64"),
      pixelWidth: 2,
      pixelHeight: 2,
    }),
  };
  old.decals = [
    {
      id: "decal",
      assetId: "picture",
      x: 0.5,
      y: 0.5,
      z: 0,
      rotation: 90,
      width: 0.5,
      height: 0.75,
    },
  ];
  const r = api.migrateLegacy(
    JSON.stringify(old),
    new Map([["picture", { kind: "texture", revision: 0, png }]]),
    ids(),
  );
  assert.deepEqual(r.modules[0].editor, old.editor);
  assert.deepEqual(r.scene.decals[0].positionM, [0.5, 0.5, 0]);
  assert.equal(r.scene.decals[0].widthM, 0.5);
  assert.equal(r.scene.decals[0].rotationDeg, 90);
  assert.deepEqual(JSON.parse(r.legacyJson).surfaces, old.surfaces);
  assert.ok(r.copiedFiles[0].bytes !== png);
  assert.deepEqual(r.issues, []);
});
function fixture() {
  const m = createMap();
  m.mapId = "old";
  m.cells = [];
  for (let y = -4; y < 8; y++)
    for (let x = -4; x < 8; x++)
      m.cells.push({
        x,
        y,
        z: -1,
        color: 0,
        owner: x < 0 ? "volume" : "height",
      });
  m.protectedColumns = ["-1,-1"];
  m.surfaces = [{ x: 0, y: 0, z: -1, face: 4, tag: "walk" }];
  m.extra = { retained: true };
  return m;
}
test("migration retains original text, negative local frame, protection, palette and gameplay attachment", () => {
  const old = fixture();
  old.surfaces = [];
  const json = JSON.stringify(old, null, 2),
    r = api.migrateLegacy(json, new Map(), ids());
  assert.equal(r.legacyJson, json);
  assert.deepEqual(r.modules[0].cells, old.cells);
  assert.deepEqual(r.modules[0].protectedColumns, ["-1,-1"]);
  assert.deepEqual(r.modules[0].anchorM, [0, 0, 0]);
  assert.deepEqual(r.modules[0].palette, old.palette);
  assert.deepEqual(r.scene.instances[0].positionM, [0, 0, 0]);
  assert.equal(r.scene.instances.length, 1);
  assert.equal(JSON.parse(r.legacyJson).extra.retained, true);
});
test("native and external anchors compensate four rotations and per-instance old anchors without moving world geometry", () => {
  const old = fixture();
  old.surfaces = [];
  const a = createAsset("native");
  a.anchorM = [0.125, -0.125, 0];
  a.rootMode = "legacy";
  a.cells = [{ x: 1, y: 2, z: 3, color: 0 }];
  for (const [i, rotation] of [0, 90, 180, 270].entries())
    old.instances.push({
      id: `i${i}`,
      assetId: i < 2 ? "native" : "external",
      kind: "model",
      x: 0.5,
      y: 0.5,
      z: 0,
      rotation,
      anchor: i % 2 ? [0.25, 0, 0] : [0, 0.25, 0],
    });
  const resolved = new Map<string, any>([
      ["native", { kind: "voxel", document: a }],
      [
        "external",
        {
          kind: "external",
          revision: 1,
          anchorM: [0.25, 0, 0],
          recipe: "glb-rh-y-up",
          glb: new Uint8Array([1]),
          files: [],
        },
      ],
    ]),
    r = api.migrateLegacy(JSON.stringify(old), resolved, ids());
  assert.equal(r.scene.instances.length, 5);
  assert.equal(r.scene.assets.length, 3);
  for (let i = 0; i < 4; i++) {
    const before = old.instances[i],
      after = r.scene.instances[i + 1],
      row = r.scene.assets.find((x: any) => x.assetId === after.assetId),
      root =
        row.kind === "voxel"
          ? r.modules.find((x: any) => x.assetId === row.assetId).anchorM
          : row.anchorM;
    const raw: [number, number, number] = [0.75, -0.25, 1.25];
    const legacyPoint: [number, number, number] =
      i < 2 ? [raw[0] - 0.125, raw[1] + 0.125, raw[2]] : raw;
    assert.deepEqual(
      transformPoint(raw, root, after.positionM, after.rotationDeg),
      transformPoint(
        legacyPoint,
        before.anchor,
        [0.5, 0.5, 0],
        before.rotation,
      ),
    );
  }
  assert.deepEqual(r.scene.instances[3].positionM, [0.25, 0.75, 0]);
  assert.deepEqual(r.scene.instances[4].positionM, [0.5, 0.5, 0]);
});
test("missing visual source preserves placement and event registry in attachment and reports unresolved reference", () => {
  const old = fixture();
  old.surfaces = [];
  old.instances = [
    {
      id: "event",
      assetId: "missing",
      kind: "event",
      registryKey: "trap",
      x: 0.5,
      y: 0.5,
      z: 0,
      rotation: 90,
      anchor: [0.25, 0, 0],
    },
  ];
  const r = api.migrateLegacy(JSON.stringify(old), new Map(), ids());
  assert.equal(r.scene.instances.length, 2);
  assert.deepEqual(r.scene.instances[1].positionM, [0.5, 0.25, 0]);
  assert.ok(r.issues.some((i: any) => i.code === "missing-asset"));
  assert.equal(JSON.parse(r.legacyJson).instances[0].registryKey, "trap");
  assert.equal(r.scene.assets.length, 2);
});
test("scene copy regenerates local identities but retains geometry, transforms and detached buffers", () => {
  const r = api.migrateLegacy(
      JSON.stringify({ ...fixture(), surfaces: [] }),
      new Map(),
      ids(),
    ),
    c = api.copyWorkshopScene(
      r.scene,
      new Map(
        r.modules.map((a: any) => [a.assetId, { kind: "voxel", document: a }]),
      ),
      () => crypto.randomUUID(),
    );
  assert.notEqual(c.scene.sceneId, r.scene.sceneId);
  assert.notEqual(
    c.scene.instances[0].instanceId,
    r.scene.instances[0].instanceId,
  );
  assert.notEqual(c.modules[0].assetId, r.modules[0].assetId);
  assert.deepEqual(
    c.scene.instances[0].positionM,
    r.scene.instances[0].positionM,
  );
  assert.deepEqual(c.modules[0].cells, r.modules[0].cells);
  c.modules[0].cells[0].x = 88;
  assert.equal(r.modules[0].cells[0].x, -4);
});
