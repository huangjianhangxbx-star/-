import { test } from "node:test";
import assert from "node:assert/strict";
import { createAsset, createScene } from "../core/workshop-documents.ts";
import { createReference } from "../core/references.ts";
let api: any = {};
try {
  api = await import("../core/workshop-glb.ts");
} catch (e) {
  if (e.code !== "ERR_MODULE_NOT_FOUND") throw e;
}
function decode(raw: Uint8Array) {
  const v = new DataView(raw.buffer, raw.byteOffset, raw.byteLength),
    n = v.getUint32(12, true);
  return {
    json: JSON.parse(new TextDecoder().decode(raw.slice(20, 20 + n))),
    bin: raw.slice(28 + n),
  };
}
function encode(j: any, bin: Uint8Array) {
  const text = new TextEncoder().encode(JSON.stringify(j)),
    n = Math.ceil(text.length / 4) * 4,
    raw = new Uint8Array(28 + n + bin.length),
    v = new DataView(raw.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, raw.length, true);
  v.setUint32(12, n, true);
  v.setUint32(16, 0x4e4f534a, true);
  raw.fill(32, 20, 20 + n);
  raw.set(text, 20);
  v.setUint32(20 + n, bin.length, true);
  v.setUint32(24 + n, 0x004e4942, true);
  raw.set(bin, 28 + n);
  return raw;
}
test("external publish rejects required unsupported extensions, out-of-bounds buffers and cyclic node graphs", () => {
  const { a } = fixture(),
    original = decode(api.exportAssetGlb(a));
  for (const mutate of [
    (j: any) => {
      j.extensionsRequired = ["KHR_draco_mesh_compression"];
    },
    (j: any) => {
      j.bufferViews[0].byteLength = 99999999;
    },
    (j: any) => {
      j.nodes[0].children = [0];
    },
  ]) {
    const j = structuredClone(original.json);
    mutate(j);
    const glb = encode(j, original.bin),
      s = createScene("external");
    s.assets = [
      {
        kind: "external",
        assetId: "e",
        revision: 0,
        model: "external/e/model.glb",
        files: ["external/e/model.glb"],
        anchorM: [0, 0, 0],
        recipe: "glb-rh-y-up",
      },
    ];
    s.instances = [
      {
        instanceId: "i",
        assetId: "e",
        positionM: [0, 0, 0],
        rotationDeg: 0,
        groupId: "base",
      },
    ];
    assert.throws(
      () =>
        api.exportWorkshopSceneGlb(
          s,
          new Map([
            [
              "e",
              {
                kind: "external",
                revision: 0,
                anchorM: [0, 0, 0],
                recipe: "glb-rh-y-up",
                glb,
                files: [
                  {
                    path: "external/e/model.glb",
                    bytes: glb,
                    sha256: "a".repeat(64),
                  },
                ],
              },
            ],
          ]),
        ),
      /GLB|扩展|节点|buffer/i,
    );
  }
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGN4ppHyH4QZYAwAVugJxfB+DTwAAAAASUVORK5CYII=",
  "base64",
);
function fixture() {
  const a = createAsset("a");
  a.cells = [{ x: -2, y: 1, z: 3, color: 0 }];
  a.anchorM = [0.125, -0.125, 0.125];
  a.rootMode = "legacy";
  a.editor = {
    reference: createReference({
      id: "reference",
      name: "ref",
      dataUrl: "data:image/png;base64," + png.toString("base64"),
      pixelWidth: 2,
      pixelHeight: 2,
    }),
  };
  const s = createScene("s");
  s.groups[0].visible = false;
  s.assets = [
    { kind: "voxel", assetId: "a", source: "assets/a.xhmodule.json" },
  ];
  s.instances = [
    {
      instanceId: "one",
      assetId: "a",
      positionM: [0.125, -0.125, 0.125],
      rotationDeg: 0,
      groupId: "base",
    },
    {
      instanceId: "two",
      assetId: "a",
      positionM: [0.125, 0.125, 0.125],
      rotationDeg: 90,
      groupId: "base",
    },
  ];
  return { a, s };
}
test("asset GLB subtracts Root once and excludes editor PNG and reference nodes", () => {
  const { a } = fixture(),
    j = decode(api.exportAssetGlb(a)).json;
  assert.deepEqual(j.accessors[0].min, [-0.625, 0.625, -0.625]);
  assert.equal(j.images, undefined);
  assert.ok(!JSON.stringify(j).includes("data:image"));
  assert.ok(!JSON.stringify(j).includes("reference"));
  assert.throws(() => api.exportAssetGlb(createAsset("empty")), /空|Empty/);
});
test("workshop scene exports hidden groups without support cells, shares native mesh and retains independent transforms", () => {
  const { a, s } = fixture(),
    j = decode(
      api.exportWorkshopSceneGlb(
        s,
        new Map([["a", { kind: "voxel", document: a }]]),
      ),
    ).json;
  assert.equal(j.meshes.length, 1);
  const one = j.nodes.find((n) => n.extras?.instanceId === "one"),
    two = j.nodes.find((n) => n.extras?.instanceId === "two");
  assert.deepEqual(one.translation, [0.125, 0.125, 0.125]);
  assert.deepEqual(two.translation, [0.125, 0.125, -0.125]);
  assert.deepEqual(j.nodes[one.children[0]].translation, [0, 0, 0]);
  assert.equal(one.extras.groupId, "base");
  assert.ok(Math.abs(two.rotation[1] - Math.SQRT1_2) < 1e-12);
  assert.equal(j.images.length, 0);
});
test("horizontal decal PNG is embedded in scene GLB while module reference remains absent", () => {
  const { a, s } = fixture();
  s.assets.push({
    kind: "texture",
    assetId: "png",
    revision: 0,
    image: "textures/png.png",
  });
  s.decals.push({
    decalId: "art",
    assetId: "png",
    positionM: [1, -2, 3],
    rotationDeg: 270,
    widthM: 2,
    heightM: 3,
  });
  const { json: j, bin } = decode(
    api.exportWorkshopSceneGlb(
      s,
      new Map<string, any>([
        ["a", { kind: "voxel", document: a }],
        ["png", { kind: "texture", revision: 0, png }],
      ]),
    ),
  );
  assert.equal(j.images.length, 1);
  const image = j.bufferViews[j.images[0].bufferView];
  assert.deepEqual(
    Buffer.from(
      bin.slice(image.byteOffset, image.byteOffset + image.byteLength),
    ),
    png,
  );
  assert.deepEqual(
    j.nodes.find((n) => n.extras?.instanceId === "art").translation,
    [1, 3.002, 2],
  );
  assert.equal(
    j.nodes.some((n) => n.name === "reference"),
    false,
  );
});
test("missing dependencies and misaligned voxel world phase refuse GLB instead of silently dropping geometry", () => {
  const { a, s } = fixture();
  assert.throws(
    () => api.exportWorkshopSceneGlb(s, new Map()),
    /缺少|missing/i,
  );
  s.instances[0].positionM = [0, 0, 0];
  assert.throws(
    () =>
      api.exportWorkshopSceneGlb(
        s,
        new Map([["a", { kind: "voxel", document: a }]]),
      ),
    /对齐/,
  );
});
