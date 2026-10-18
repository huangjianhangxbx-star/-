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
test('trash checks live instance references and restores a saved asset and scene without changing releases', () =>
  fixture(async (root, bridge) => {
    const p = core.createProject('p'), s = core.createScene('s'), a = core.createAsset('a');
    p.scenes.push({ sceneId: 's', name: 'Preview', source: 'scenes/s/scene.xhscene.json' });
    s.name = 'Preview';
    s.assets.push({ kind: 'voxel', assetId: 'a', source: 'assets/a.xhmodule.json' });
    s.instances.push({ instanceId: 'i', assetId: 'a', positionM: [0, 0, 0], rotationDeg: 0, groupId: 'base' });
    const opened = await bridge.create(root, core.createProject('p'));
    const project = await bridge.load(opened.token, 'project.xhproject.json', 'project', 'p');
    const scene = await bridge.stage(opened.token, 'scenes/s/scene.xhscene.json', 'scene', 's');
    const asset = await bridge.stage(opened.token, 'scenes/s/assets/a.xhmodule.json', 'asset', 'a');
    await bridge.commit(opened.token, [
      { leaseId: project.leaseId, document: p },
      { leaseId: scene.leaseId, document: s },
      { leaseId: asset.leaseId, document: a },
    ]);
    await assert.rejects(() => bridge.trashAsset(opened.token, 's', 'a', false), /1.*实例/);
    await fs.mkdir(path.join(root, 'releases'), { recursive: true });
    await fs.writeFile(path.join(root, 'releases', 'historic.txt'), 'unchanged');
    const deleted = await bridge.trashAsset(opened.token, 's', 'a', true);
    assert.equal((await bridge.load(deleted.token, 'scenes/s/scene.xhscene.json', 'scene', 's')).document.assets.length, 0);
    assert.equal((await bridge.listTrash(deleted.token)).length, 1);
    await assert.rejects(() => fs.stat(path.join(root, 'scenes', 's', 'assets', 'a.xhmodule.json')));
    const restored = await bridge.restoreTrash(deleted.token, (await bridge.listTrash(deleted.token))[0].trashId);
    assert.equal((await bridge.load(restored.token, 'scenes/s/scene.xhscene.json', 'scene', 's')).document.instances.length, 1);
    assert.equal((await bridge.load(restored.token, 'scenes/s/assets/a.xhmodule.json', 'asset', 'a')).document.assetId, 'a');
    const removedScene = await bridge.trashScene(restored.token, 's');
    assert.equal(removedScene.document.scenes.length, 0);
    assert.equal(await fs.readFile(path.join(root, 'releases', 'historic.txt'), 'utf8'), 'unchanged');
    const sceneTrash = (await bridge.listTrash(removedScene.token))[0];
    const reopened = await bridge.restoreTrash(removedScene.token, sceneTrash.trashId);
    assert.equal(reopened.document.scenes[0].sceneId, 's');
    assert.equal((await bridge.load(reopened.token, 'scenes/s/scene.xhscene.json', 'scene', 's')).document.instances.length, 1);
    const removedAgain = await bridge.trashScene(reopened.token, 's');
    const finalTrash = (await bridge.listTrash(removedAgain.token))[0];
    await bridge.purgeTrash(removedAgain.token, finalTrash.trashId);
    assert.equal((await bridge.listTrash(removedAgain.token)).length, 0);
    await assert.rejects(() => bridge.restoreTrash(removedAgain.token, finalTrash.trashId));
    assert.equal(await fs.readFile(path.join(root, 'releases', 'historic.txt'), 'utf8'), 'unchanged');
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
