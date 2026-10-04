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
test("source resolution diagnostics are stored in migration report, not only transient IPC feedback", async () => {
  const { root, bridge, p } = await setup();
  try {
    const sourceIssue = {
      code: "legacy-source-unresolved",
      documentId: "old-model",
      message: "缺少FBX配套GLB",
    };
    const imported = await bridge.importLegacy(
      p.token,
      JSON.stringify(createMap()),
      new Map(),
      [sourceIssue],
    );
    const report = JSON.parse(
      await fs.readFile(
        path.join(
          root,
          `scenes/${imported.migration.sceneId}/legacy/migration-report.json`,
        ),
        "utf8",
      ),
    );
    assert.ok(
      report.issues.some(
        (i) => i.code === sourceIssue.code && i.message === sourceIssue.message,
      ),
    );
  } finally {
    if (
      !path
        .resolve(root)
        .startsWith(path.resolve("validation/workshop-migration-test-"))
    )
      throw Error("unsafe cleanup");
    await fs.rm(root, { recursive: true, force: true });
  }
});
async function setup() {
  const root = await fs.mkdtemp(
      path.resolve("validation/workshop-migration-test-"),
    ),
    bridge = createWorkshopBridge(core),
    p = await bridge.create(root, core.createProject("project"));
  return { root, bridge, p };
}
test("legacy import commits complete new scene, exact attachment and report; copying scene generates independent source identities", async () => {
  const { root, bridge, p } = await setup();
  try {
    const m = createMap();
    m.mapId = "old";
    m.cells = [{ x: -3, y: 2, z: 0, color: 0, owner: "volume" }];
    m.unknown = { event: "keep" };
    const json = JSON.stringify(m, null, 2),
      imported = await bridge.importLegacy(p.token, json, new Map());
    const project = JSON.parse(
      await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
    );
    assert.equal(project.scenes.length, 1);
    const row = project.scenes[0],
      scene = JSON.parse(
        await fs.readFile(path.join(root, row.source), "utf8"),
      );
    assert.equal(
      await fs.readFile(
        path.join(root, `scenes/${row.sceneId}/legacy/original.xhmap.json`),
        "utf8",
      ),
      json,
    );
    assert.equal(scene.instances.length, 1);
    const source = JSON.parse(
      await fs.readFile(
        path.join(root, `scenes/${row.sceneId}/${scene.assets[0].source}`),
        "utf8",
      ),
    );
    assert.equal(source.cells[0].x, -3);
    const copied = await bridge.copyScene(imported.token, row.sceneId);
    const next = JSON.parse(
      await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
    );
    assert.equal(next.scenes.length, 2);
    const copy = JSON.parse(
      await fs.readFile(path.join(root, next.scenes[1].source), "utf8"),
    );
    assert.notEqual(copy.assets[0].assetId, scene.assets[0].assetId);
    assert.deepEqual(copy.instances[0].positionM, scene.instances[0].positionM);
    assert.equal(
      await fs.readFile(
        path.join(root, `scenes/${copy.sceneId}/legacy/original.xhmap.json`),
        "utf8",
      ),
      json,
    );
    assert.ok(copied.token);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("migration rejects dirty session and external project modification without leaving a new scene", async () => {
  const { root, bridge, p } = await setup();
  try {
    const json = JSON.stringify(createMap());
    bridge.dirty(p.token, true);
    await assert.rejects(
      () => bridge.importLegacy(p.token, json, new Map()),
      /保存/,
    );
    bridge.dirty(p.token, false);
    await fs.writeFile(path.join(root, "project.xhproject.json"), "changed");
    await assert.rejects(
      () => bridge.importLegacy(p.token, json, new Map()),
      /修改|JSON|Unexpected/,
    );
    const entries = await fs.readdir(root);
    assert.ok(!entries.includes("scenes"));
    assert.equal(
      await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
      "changed",
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
