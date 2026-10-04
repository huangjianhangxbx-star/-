import test from "node:test";
import assert from "node:assert/strict";
import { createMap } from "../core/document.ts";
const palette = await import("../core/palette.ts").catch(() => ({}));
const native = await import("../core/native-asset.ts").catch(() => ({}));
const glb = await import("../core/glb.ts").catch(() => ({}));
function fixture() {
  const d = createMap();
  d.mapId = "source";
  d.palette = ["#808080", "#ff0000"];
  d.cells = [
    { x: 100, y: -20, z: 3, color: 0, owner: "volume" },
    { x: 101, y: -20, z: 3, color: 1, owner: "volume" },
  ];
  return d;
}
const bounds = { min: [100, -20, 3], max: [101, -20, 3] };
test("map palette preserves source RGB and namespaces equal indices by source identity", () => {
  assert.equal(typeof palette.paletteFromMap, "function");
  const a = palette.paletteFromMap(fixture()),
    b = palette.paletteFromMap({ ...fixture(), mapId: "other" });
  assert.deepEqual(a.colors[0].baseColor_sRGB, [
    128 / 255,
    128 / 255,
    128 / 255,
  ]);
  assert.notEqual(a.paletteId, b.paletteId);
  assert.equal(palette.srgbToLinear(0.5), 0.21404114048223255);
});
test("profile adapter preserves semantic color IDs and distinct material families", () => {
  assert.equal(typeof palette.paletteFromProfile, "function");
  const p = palette.paletteFromProfile({
    id: "old.profile",
    revision: 3,
    unit: "METERS",
    grid_step: 0.125,
    palette: {
      stone: { color: [0.5, 0.5, 0.5, 1], roughness: 0.9 },
      signal: { color: [0.5, 0.5, 0.5, 0.5], roughness: 0.2, emission: 2 },
    },
  });
  assert.equal(p.colors[0].colorId, "stone");
  assert.equal(p.colors[1].roughness, 0.2);
  assert.equal(p.colors[1].emissiveStrength, 2);
  assert.equal(p.gridStep, 0.125);
});
test("native asset captures only selection in local cells with bottom anchor and reopens losslessly", () => {
  assert.equal(typeof native.createNativeAsset, "function");
  const d = fixture();
  d.references = [{ id: "excluded" }];
  d.cells.push({ x: 300, y: 0, z: 0, color: 1 });
  const a = native.createNativeAsset(d, bounds, {
    assetId: "wall",
    name: "Wall",
  });
  assert.equal(a.assetId, "wall");
  assert.deepEqual(
    a.cells.map((c) => [c.x, c.y, c.z]),
    [
      [0, 0, 0],
      [1, 0, 0],
    ],
  );
  assert.deepEqual(a.anchor, [0.25, 0.125, 0]);
  assert.equal(a.references, undefined);
  const reopened = native.assetToMap(a);
  assert.deepEqual(reopened.palette, d.palette);
  assert.deepEqual(reopened.cells, a.cells);
  const updated = native.updateNativeAsset(a, reopened, {
    min: [0, 0, 0],
    max: [1, 0, 0],
  });
  assert.equal(updated.assetId, "wall");
  assert.equal(updated.revision, 2);
  assert.deepEqual(updated.anchor, a.anchor);
  assert.throws(
    () => native.createNativeAsset(d, { min: [0, 0, 0], max: [0, 0, 0] }),
    /empty|空/i,
  );
});
function decode(raw) {
  const v = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  assert.equal(v.getUint32(0, true), 0x46546c67);
  assert.equal(v.getUint32(8, true), raw.length);
  const n = v.getUint32(12, true);
  return {
    json: JSON.parse(new TextDecoder().decode(raw.slice(20, 20 + n))),
    bin: raw.slice(28 + n),
  };
}
test("GLB contains real linear base colors, outward faces, Y-up meters and separate chunks", () => {
  assert.equal(typeof glb.exportNativeAssetGlb, "function");
  const a = native.createNativeAsset(fixture(), bounds, { assetId: "wall" });
  const { json: j, bin } = decode(glb.exportNativeAssetGlb(a));
  assert.equal(
    j.materials[0].pbrMetallicRoughness.baseColorFactor[0],
    0.21586050011389923,
  );
  assert.equal(j.materials[1].pbrMetallicRoughness.baseColorFactor[0], 1);
  assert.ok(
    j.meshes
      .flatMap((m) => m.primitives)
      .every((p) => p.attributes.COLOR_0 === undefined),
  );
  const positions = [];
  for (const m of j.meshes)
    for (const p of m.primitives) {
      const ac = j.accessors[p.attributes.POSITION],
        bv = j.bufferViews[ac.bufferView];
      const ps = new Float32Array(
        bin.buffer,
        bin.byteOffset + bv.byteOffset,
        ac.count * 3,
      );
      positions.push(...ps);
      const nc = j.accessors[p.attributes.NORMAL],
        nv = j.bufferViews[nc.bufferView];
      const ns = new Float32Array(
        bin.buffer,
        bin.byteOffset + nv.byteOffset,
        nc.count * 3,
      );
      for (let i = 0; i < ps.length; i += 9) {
        const u = [0, 1, 2].map((k) => ps[i + 3 + k] - ps[i + k]),
          v = [0, 1, 2].map((k) => ps[i + 6 + k] - ps[i + k]);
        const cross = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ];
        assert.ok(cross.reduce((s, c, k) => s + c * ns[i + k], 0) > 0);
      }
    }
  assert.equal(Math.min(...positions.filter((_, i) => i % 3 === 0)), -0.25);
  assert.equal(Math.max(...positions.filter((_, i) => i % 3 === 1)), 0.25);
  const d = fixture();
  d.cells.push({ x: 200, y: 0, z: 0, color: 0 });
  assert.ok(decode(glb.exportMapGlb(d)).json.nodes.length >= 2);
});
test("large native selection stays within supported voxel budget without argument overflow", () => {
  const d = createMap();
  d.cells = [];
  for (let x = 0; x < 500; x++)
    for (let y = 0; y < 300; y++) d.cells.push({ x, y, z: 0, color: 0 });
  const a = native.createNativeAsset(d, { min: [0, 0, 0], max: [499, 299, 0] });
  assert.equal(a.cells.length, 150000);
  assert.deepEqual(a.anchor, [62.5, 37.5, 0]);
});
test("reopened asset palette edits update color values without discarding material identity or family", () => {
  const a = native.createNativeAsset(fixture(), bounds, { assetId: "wall" });
  a.materialProfile.colors[0].roughness = 0.3;
  const d = native.assetToMap(a);
  d.palette[0] = "#00ff00";
  const p = palette.paletteFromMap(d);
  assert.deepEqual(p.colors[0].baseColor_sRGB, [0, 1, 0]);
  assert.equal(p.colors[0].colorId, a.materialProfile.colors[0].colorId);
  assert.equal(p.colors[0].roughness, 0.3);
  assert.ok(p.paletteRevision > a.materialProfile.paletteRevision);
});
test("updating reopened source preserves its local frame after removing origin voxels", () => {
  const a = native.createNativeAsset(fixture(), bounds, { assetId: "wall" });
  const d = native.assetToMap(a);
  d.cells = d.cells.filter((c) => c.x === 1);
  const updated = native.updateNativeAsset(a, d, {
    min: [1, 0, 0],
    max: [1, 0, 0],
  });
  assert.equal(updated.cells[0].x, 1);
  assert.deepEqual(updated.anchor, a.anchor);
  assert.deepEqual(updated.sourceOrigin, a.sourceOrigin);
});
test("GLB preserves transparent and emissive material families with equal RGB", () => {
  const d = fixture();
  d.palette = ["#808080", "#808080"];
  d.materialProfile = palette.paletteFromMap(d);
  Object.assign(d.materialProfile.colors[1], {
    alpha: 0.4,
    alphaMode: "BLEND",
    roughness: 0.2,
    metallic: 0.7,
    emissiveStrength: 3,
  });
  const { json: j } = decode(glb.exportMapGlb(d));
  assert.equal(j.materials.length, 2);
  assert.equal(j.materials[1].pbrMetallicRoughness.baseColorFactor[3], 0.4);
  assert.equal(j.materials[1].alphaMode, "BLEND");
  assert.equal(j.materials[1].pbrMetallicRoughness.roughnessFactor, 0.2);
  assert.equal(
    j.materials[1].extensions.KHR_materials_emissive_strength.emissiveStrength,
    3,
  );
});
test("scene GLB includes shared native instances with source placement rotation and anchor", async () => {
  const scene = await import("../core/scene-glb.ts").catch(() => ({}));
  assert.equal(typeof scene.exportSceneGlb, "function");
  const a = native.createNativeAsset(fixture(), bounds, { assetId: "wall" });
  const d = createMap();
  d.cells = [
    { x: 0, y: 0, z: -1, color: 0 },
    { x: 8, y: 12, z: 15, color: 0 },
    { x: 20, y: 24, z: 27, color: 0 },
  ];
  d.instances = [
    {
      id: "one",
      assetId: "wall",
      x: 2,
      y: 3,
      z: 4,
      rotation: 90,
      anchor: [0.5, 0, 0],
    },
    { id: "two", assetId: "wall", x: 5, y: 6, z: 7, rotation: 0 },
    {
      id: "event",
      assetId: "wall",
      kind: "event",
      registryKey: "door",
      x: 0,
      y: 0,
      z: 0,
      rotation: 0,
    },
  ];
  const { json: j } = decode(
    scene.exportSceneGlb(d, new Map([["wall", glb.exportNativeAssetGlb(a)]])),
  );
  const one = j.nodes.find((n) => n.extras?.instanceId === "one"),
    two = j.nodes.find((n) => n.extras?.instanceId === "two");
  assert.deepEqual(one.translation, [2, 4, -3]);
  assert.ok(Math.abs(one.rotation[1] - Math.SQRT1_2) < 1e-10);
  assert.deepEqual(j.nodes[one.children[0]].translation, [-0.5, 0, 0]);
  assert.ok(two);
  const meshNodes = j.nodes.filter(
    (n) => n.mesh !== undefined && n.name.startsWith("wall:"),
  );
  assert.equal(new Set(meshNodes.map((n) => n.mesh)).size, 1);
  assert.equal(
    j.nodes.some((n) => n.extras?.instanceId === "event"),
    true,
  );
  assert.throws(() => scene.exportSceneGlb(d, new Map()), /wall/);
});

test("scene export includes PNG horizontal decals as embedded standard textured planes", async () => {
  const { exportSceneGlb } = await import("../core/scene-glb.ts");
  const d = createMap();
  d.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  d.decals = [
    {
      id: "mark",
      assetId: "png",
      x: 0.125,
      y: 0.125,
      z: 0.25,
      width: 0.25,
      height: 0.25,
      rotation: 0,
    },
  ];
  const png = new Uint8Array(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  const { json: j } = decode(exportSceneGlb(d, new Map([["png", png]])));
  assert.equal(j.images.length, 1);
  assert.equal(j.images[0].mimeType, "image/png");
  assert.ok(j.nodes.some((n) => n.extras?.instanceId === "mark"));
  assert.deepEqual(
    j.nodes.find((n) => n.extras?.instanceId === "mark").translation,
    [0.125, 0.252, -0.125],
  );
  const mat = j.materials.find((m) => m.pbrMetallicRoughness.baseColorTexture);
  assert.deepEqual(mat.pbrMetallicRoughness.baseColorFactor, [1, 1, 1, 1]);
  assert.equal(mat.alphaMode, "BLEND");
  assert.throws(
    () => exportSceneGlb(d, new Map([["png", new Uint8Array(8)]])),
    /PNG/,
  );
});
test("event preview model retains registry metadata without exporting runtime behavior", async () => {
  const { exportSceneGlb } = await import("../core/scene-glb.ts");
  const a = native.createNativeAsset(fixture(), bounds, { assetId: "wall" });
  const d = createMap();
  d.cells = [{ x: 0, y: 0, z: -1, color: 0 }];
  d.instances = [
    {
      id: "event",
      assetId: "wall",
      kind: "event",
      registryKey: "door",
      x: 0,
      y: 0,
      z: 0,
      rotation: 0,
    },
  ];
  const { json: j } = decode(
    exportSceneGlb(d, new Map([["wall", glb.exportNativeAssetGlb(a)]])),
  );
  assert.equal(
    j.nodes.find((n) => n.extras?.instanceId === "event")?.extras.registryKey,
    "door",
  );
});
test("editing native source may append a new palette color without losing old color identity", () => {
  const a = native.createNativeAsset(fixture(), bounds, { assetId: "wall" });
  const d = native.assetToMap(a);
  d.palette.push("#123456");
  d.cells[0].color = 2;
  const p = palette.paletteFromMap(d);
  assert.equal(p.colors.length, 3);
  assert.deepEqual(p.colors[2].baseColor_sRGB, [18 / 255, 52 / 255, 86 / 255]);
  assert.equal(p.colors[0].colorId, a.materialProfile.colors[0].colorId);
  assert.notEqual(p.colors[2].colorId, p.colors[1].colorId);
});
