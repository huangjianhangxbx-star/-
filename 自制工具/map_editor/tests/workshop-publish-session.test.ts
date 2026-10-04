import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import * as core from "../core/workshop.ts";
import { createMap } from "../core/document.ts";
const { createWorkshopBridge } = createRequire(import.meta.url)(
  "../desktop/workshop-ipc.cjs",
);
test("publishing blocks project mutation before writing another project or scene", async () => {
  const root = await fs.mkdtemp(
    path.resolve("validation/workshop-publish-session-"),
  );
  try {
    const bridge = createWorkshopBridge(core),
      created = await bridge.create(root, core.createProject("project")),
      old = createMap();
    old.cells = [{ x: 0, y: 0, z: 0, color: 0, owner: "volume" }];
    const opened = await bridge.importLegacy(
        created.token,
        JSON.stringify(old),
        new Map(),
      ),
      id = opened.migration.sceneId;
    let entered, release;
    const barrier = new Promise((r) => (entered = r)),
      resume = new Promise((r) => (release = r));
    const publishing = bridge.publish(
      opened.token,
      id,
      null,
      "pending",
      "glb-fbx",
      { workshopVersion: "test", sourceFingerprint: "a".repeat(64) },
      async (stage, m) => {
        entered();
        await resume;
        return m;
      },
    );
    const rejected = assert.rejects(publishing, /取消|abort/i);
    await barrier;
    const before = await fs.readFile(path.join(root, "project.xhproject.json"));
    const other = path.join(root, "other");
    await fs.mkdir(other);
    await assert.rejects(
      () => bridge.create(other, core.createProject("other")),
      /发布/,
    );
    assert.equal(
      await fs
        .stat(path.join(other, "project.xhproject.json"))
        .catch(() => null),
      null,
    );
    await assert.rejects(() => bridge.copyScene(opened.token, id), /发布/);
    await assert.rejects(() => bridge.open(root), /发布/);
    assert.deepEqual(
      await fs.readFile(path.join(root, "project.xhproject.json")),
      before,
    );
    bridge.cancelPublish(opened.token);
    release();
    await rejected;
    assert.equal((await bridge.open(root)).document.scenes.length, 1);
  } finally {
    assert.ok(
      path
        .resolve(root)
        .startsWith(path.resolve("validation/workshop-publish-session-")),
    );
    await fs.rm(root, { recursive: true, force: true });
  }
});
