import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import * as core from "../core/workshop-documents.ts";
const require = createRequire(import.meta.url);
let module: any = {};
try {
  module = require("../desktop/workshop-ipc.cjs");
} catch (e) {
  if (e.code !== "MODULE_NOT_FOUND" || !e.message.includes("workshop-ipc.cjs"))
    throw e;
}
async function fixture(run: (root: string, bridge: any) => Promise<void>) {
  assert.equal(typeof module.createWorkshopBridge, "function");
  const root = await fs.mkdtemp(path.resolve("validation/workshop-ipc-"));
  try {
    await run(root, module.createWorkshopBridge(core));
  } finally {
    assert.ok(
      path
        .relative(path.resolve("validation"), root)
        .startsWith("workshop-ipc-"),
    );
    await fs.rm(root, { recursive: true, force: true });
  }
}
test("bridge creates and reopens schema-validated project, scene and empty draft", () =>
  fixture(async (root, bridge) => {
    const p = core.createProject("p"),
      s = core.createScene("s"),
      a = core.createAsset("a");
    p.scenes.push({
      sceneId: "s",
      name: "",
      source: "scenes/s/scene.xhscene.json",
    });
    s.assets.push({
      kind: "voxel",
      assetId: "a",
      source: "assets/a.xhmodule.json",
    });
    const session = await bridge.create(root, core.createProject("p"));
    const project = await bridge.load(
      session.token,
      "project.xhproject.json",
      "project",
      "p",
    );
    const scene = await bridge.stage(
      session.token,
      "scenes/s/scene.xhscene.json",
      "scene",
      "s",
    );
    const asset = await bridge.stage(
      session.token,
      "scenes/s/assets/a.xhmodule.json",
      "asset",
      "a",
    );
    await bridge.commit(session.token, [
      { leaseId: project.leaseId, document: p },
      { leaseId: scene.leaseId, document: s },
      { leaseId: asset.leaseId, document: a },
    ]);
    const reopened = await bridge.open(root);
    assert.equal(reopened.document.scenes.length, 1);
    assert.deepEqual(
      (
        await bridge.load(
          reopened.token,
          "scenes/s/assets/a.xhmodule.json",
          "asset",
          "a",
        )
      ).document,
      a,
    );
    await assert.rejects(() =>
      bridge.load(session.token, "project.xhproject.json", "project", "p"),
    );
  }));
test("bridge refuses arbitrary paths, schema/identity mismatch and stale lease", () =>
  fixture(async (root, bridge) => {
    const session = await bridge.create(root, core.createProject("p"));
    for (const target of [
      "../outside.json",
      "C:/outside.json",
      "desktop/main.cjs",
      "scenes/s/external/a/source.json",
    ])
      await assert.rejects(() =>
        bridge.stage(session.token, target, "asset", "a"),
      );
    const lease = await bridge.stage(
      session.token,
      "scenes/s/assets/a.xhmodule.json",
      "asset",
      "a",
    );
    await assert.rejects(() =>
      bridge.commit(session.token, [
        { leaseId: lease.leaseId, document: core.createAsset("b") },
      ]),
    );
    await assert.rejects(() =>
      bridge.commit(session.token, [
        { leaseId: lease.leaseId, document: core.createScene("a") },
      ]),
    );
    await assert.rejects(() =>
      bridge.commit(session.token, [
        { leaseId: "guessed", document: core.createAsset("a") },
      ]),
    );
    await assert.rejects(() =>
      bridge.load(
        session.token,
        "scenes/s/assets/a.xhmodule.json",
        "asset",
        "a",
      ),
    );
  }));
test("bridge hashes cannot be overridden by renderer and failed save retains dirty", () =>
  fixture(async (root, bridge) => {
    const session = await bridge.create(root, core.createProject("p"));
    const lease = await bridge.load(
      session.token,
      "project.xhproject.json",
      "project",
      "p",
    );
    bridge.dirty(session.token, true);
    await fs.writeFile(path.join(root, "project.xhproject.json"), "external");
    const changed = core.createProject("p");
    changed.name = "new";
    await assert.rejects(() =>
      bridge.commit(session.token, [
        { leaseId: lease.leaseId, document: changed, expectedHash: null },
      ]),
    );
    assert.equal(bridge.isDirty(), true);
    assert.equal(
      await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
      "external",
    );
  }));
test("bridge rejects project registrations without the scene source", () =>
  fixture(async (root, bridge) => {
    const session = await bridge.create(root, core.createProject("p"));
    const lease = await bridge.load(
      session.token,
      "project.xhproject.json",
      "project",
      "p",
    );
    const p = core.createProject("p");
    p.scenes.push({
      sceneId: "missing",
      name: "",
      source: "scenes/missing/scene.xhscene.json",
    });
    await assert.rejects(() =>
      bridge.commit(session.token, [{ leaseId: lease.leaseId, document: p }]),
    );
    assert.equal(
      JSON.parse(
        await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
      ).scenes.length,
      0,
    );
  }));
