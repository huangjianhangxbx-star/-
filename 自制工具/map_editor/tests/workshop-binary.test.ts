import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import * as core from "../core/workshop-documents.ts";
const { createWorkshopBridge } = createRequire(import.meta.url)(
  "../desktop/workshop-ipc.cjs",
);
async function fixture(fn: any) {
  const root = await fs.mkdtemp(path.resolve("validation/workshop-binary-"));
  try {
    const bridge = createWorkshopBridge(core),
      session = await bridge.create(root, core.createProject("p"));
    await fn(root, bridge, session.token);
  } finally {
    assert.ok(
      path
        .relative(path.resolve("validation"), root)
        .startsWith("workshop-binary-"),
    );
    await fs.rm(root, { recursive: true, force: true });
  }
}
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGN4ppHyH4QZYAwAVugJxfB+DTwAAAAASUVORK5CYII=",
  "base64",
);
test("main-owned binary copies save atomically with scene registration and reopen with independent IDs", () =>
  fixture(async (root, b, token) => {
    assert.equal(typeof b.importBinary, "function");
    const one = await b.importBinary(token, "s", { kind: "texture", bytes }),
      two = await b.importBinary(token, "s", { kind: "texture", bytes });
    assert.notEqual(one.assetId, two.assetId);
    const s = core.createScene("s");
    s.assets.push(one, two);
    const p = core.createProject("p");
    p.scenes.push({
      sceneId: "s",
      name: "",
      source: "scenes/s/scene.xhscene.json",
    });
    const pl = await b.load(token, "project.xhproject.json", "project", "p"),
      sl = await b.stage(token, "scenes/s/scene.xhscene.json", "scene", "s");
    await b.commit(token, [
      { leaseId: pl.leaseId, document: p },
      { leaseId: sl.leaseId, document: s },
    ]);
    assert.deepEqual(
      await fs.readFile(path.join(root, "scenes/s", one.image)),
      bytes,
    );
    const reopened = await b.open(root),
      read = await b.readBinary(reopened.token, "s", one.assetId);
    assert.equal(read.data, bytes.toString("base64"));
    assert.equal(read.row.assetId, one.assetId);
    await assert.rejects(b.readBinary(token, "s", one.assetId), /失效/);
    await assert.rejects(b.readBinary(reopened.token, "../s", one.assetId));
    await assert.rejects(b.readBinary(reopened.token, "s", "unknown"));
  }));
test("GLB import captures source bytes and Root independently; missing saved payload blocks read and save", () =>
  fixture(async (root, b, token) => {
    const source = await fs.readFile("fixtures/direction.glb"),
      original = Buffer.from(source);
    const row = await b.importBinary(token, "s", {
      kind: "external",
      bytes: source,
      anchorM: [0.125, -0.25, 0.5],
    });
    source.fill(0);
    assert.equal(
      (await b.readBinary(token, "s", row.assetId)).data,
      original.toString("base64"),
    );
    const s = core.createScene("s");
    s.assets.push(row);
    s.instances.push({
      instanceId: "i",
      assetId: row.assetId,
      positionM: [1.123, 0, 0],
      rotationDeg: 90,
      groupId: "base",
    });
    const p = core.createProject("p");
    p.scenes.push({
      sceneId: "s",
      name: "",
      source: "scenes/s/scene.xhscene.json",
    });
    const pl = await b.load(token, "project.xhproject.json", "project", "p"),
      sl = await b.stage(token, "scenes/s/scene.xhscene.json", "scene", "s");
    const intents = [
      { leaseId: pl.leaseId, document: p },
      { leaseId: sl.leaseId, document: s },
    ];
    await b.commit(token, intents);
    assert.deepEqual(
      await fs.readFile(path.join(root, "scenes/s", row.model)),
      original,
    );
    await fs.rm(path.join(root, "scenes/s", row.model));
    await assert.rejects(b.readBinary(token, "s", row.assetId));
    await assert.rejects(b.commit(token, intents));
  }));
test("invalid and unregistered payloads cannot create files; staged row binding cannot be swapped", () =>
  fixture(async (root, b, token) => {
    assert.equal(typeof b.importBinary, "function");
    const corrupt = Buffer.from(bytes);
    corrupt[corrupt.length - 16] ^= 1;
    await assert.rejects(
      b.importBinary(token, "s", { kind: "texture", bytes: corrupt }),
    );
    await assert.rejects(
      b.importBinary(token, "s", {
        kind: "texture",
        bytes: Buffer.from("bad"),
      }),
    );
    await assert.rejects(
      b.importBinary(token, "s", {
        kind: "external",
        bytes: Buffer.from("bad"),
        anchorM: [0, 0, 0],
      }),
    );
    const row = await b.importBinary(token, "s", { kind: "texture", bytes });
    const s = core.createScene("s");
    s.assets.push({ ...row, image: "textures/other.png" });
    const p = core.createProject("p");
    p.scenes.push({
      sceneId: "s",
      name: "",
      source: "scenes/s/scene.xhscene.json",
    });
    const pl = await b.load(token, "project.xhproject.json", "project", "p"),
      sl = await b.stage(token, "scenes/s/scene.xhscene.json", "scene", "s");
    await assert.rejects(
      b.commit(token, [
        { leaseId: pl.leaseId, document: p },
        { leaseId: sl.leaseId, document: s },
      ]),
    );
    await assert.rejects(fs.access(path.join(root, "scenes/s", row.image)));
    assert.equal(
      JSON.parse(
        await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
      ).scenes.length,
      0,
    );
  }));
