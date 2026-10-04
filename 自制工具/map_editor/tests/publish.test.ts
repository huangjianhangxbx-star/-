import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createAsset, createScene } from "../core/workshop-documents.ts";
import { createReference } from "../core/references.ts";
let api: any = {};
try {
  api = await import("../core/publish.ts");
} catch (e) {
  if (e.code !== "ERR_MODULE_NOT_FOUND") throw e;
}
const toolchain = {
    workshopVersion: "workshop-test",
    sourceFingerprint: "a".repeat(64),
  },
  hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
function fixture() {
  const a = createAsset("a");
  a.revision = 3;
  a.cells = [{ x: -1, y: 2, z: 3, color: 0 }];
  a.editor = {
    reference: createReference({
      id: "r",
      name: "reference",
      dataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGN4ppHyH4QZYAwAVugJxfB+DTwAAAAASUVORK5CYII=",
      pixelWidth: 2,
      pixelHeight: 2,
    }),
  };
  return a;
}
test("publish freezes source before first async boundary, strips runtime reference and hashes every output", async () => {
  const a = fixture(),
    promise = api.createPublishPlan(
      { kind: "asset", document: a },
      "publish-a",
      "glb-only",
      toolchain,
    );
  a.revision = 4;
  a.cells[0].x = 99;
  a.palette[0] = "#ffffff";
  const p = await promise;
  assert.equal(p.manifest.sourceRevision, 3);
  assert.equal(p.manifest.dependencies[0].sourceRevision, 3);
  const runtime = p.files.find((f) => f.path === p.manifest.runtimePath),
    source = p.files.find(
      (f) => f.path === p.manifest.dependencies[0].sourcePath,
    );
  assert.equal(
    JSON.parse(new TextDecoder().decode(runtime.bytes)).cells[0].x,
    -1,
  );
  assert.equal(
    JSON.parse(new TextDecoder().decode(runtime.bytes)).editor,
    undefined,
  );
  assert.ok(JSON.parse(new TextDecoder().decode(source.bytes)).editor);
  for (const file of p.files) {
    assert.equal(file.sha256, hash(file.bytes));
    const listed = [...p.manifest.payloadFiles, ...p.manifest.outputFiles].find(
      (f) => f.path === file.path,
    );
    assert.equal(listed.byteLength, file.bytes.length);
    assert.equal(listed.sha256, file.sha256);
  }
  const list = p.manifest.payloadFiles
    .filter((f) => f.path === source.path)
    .sort((a, b) => a.path.localeCompare(b.path));
  assert.equal(
    p.manifest.dependencies[0].contentHash,
    hash(new TextEncoder().encode(JSON.stringify(list))),
  );
  assert.equal(p.manifest.dependencies[0].unity.route, "native-cells");
});
test("scene runtime has frozen revision/hash bindings and no mutable source paths or editor metadata", async () => {
  const a = fixture(),
    s = createScene("s");
  s.assets = [
    { kind: "voxel", assetId: "a", source: "assets/a.xhmodule.json" },
  ];
  s.instances = [
    {
      instanceId: "i",
      assetId: "a",
      positionM: [0, 0, 0],
      rotationDeg: 90,
      groupId: "base",
    },
  ];
  const p = await api.createPublishPlan(
      {
        kind: "scene",
        document: s,
        assets: new Map([["a", { kind: "voxel", document: a }]]),
      },
      "scene-publish",
      "glb-only",
      toolchain,
    ),
    r = JSON.parse(
      new TextDecoder().decode(
        p.files.find((f) => f.path === p.manifest.runtimePath).bytes,
      ),
    );
  assert.equal(r.schema, "xinghai-workshop-runtime-scene-1");
  assert.deepEqual(r.bindings, [
    {
      assetId: "a",
      sourceRevision: 3,
      contentHash: p.manifest.dependencies[0].contentHash,
    },
  ]);
  assert.equal(r.assets, undefined);
  assert.deepEqual(r.instances, s.instances);
  assert.equal(r.editor, undefined);
});
test("empty sources, invalid publish identities and missing scene closure reject publication", async () => {
  await assert.rejects(
    () =>
      api.createPublishPlan(
        { kind: "asset", document: createAsset("empty") },
        "p",
        "glb-only",
        toolchain,
      ),
    /空/,
  );
  await assert.rejects(
    () =>
      api.createPublishPlan(
        { kind: "asset", document: fixture() },
        "../escape",
        "glb-only",
        toolchain,
      ),
    /身份/,
  );
  const s = createScene("s");
  s.assets = [
    {
      kind: "voxel",
      assetId: "missing",
      source: "assets/missing.xhmodule.json",
    },
  ];
  await assert.rejects(
    () =>
      api.createPublishPlan(
        { kind: "scene", document: s, assets: new Map() },
        "p",
        "glb-only",
        toolchain,
      ),
    /缺少/,
  );
});
