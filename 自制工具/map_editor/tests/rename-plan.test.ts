import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { buildRenamePlan } = require("../desktop/rename-plan.cjs");
const { Catalog } = require("../desktop/catalog.cjs");

test("batch plan previews one logical name across GLB, Blend and FBX", () => {
  const rows = [
    { id: "a", type: "glb", path: "A.glb", name: "A", source: "A.blend", exchange: "A.fbx" },
    { id: "b", type: "glb", path: "B.glb", name: "B", source: "B.blend", exchange: "B.fbx" },
  ];
  const plan = buildRenamePlan(rows, ["a", "b"], { prefix: "SM", kit: "Ruin", category: "Pillar", subject: "Broken", numberStart: 1, numberWidth: 3, separator: "_" }, true);
  assert.deepEqual(plan.items.map((p: any) => p.newName), ["SM_Ruin_Pillar_Broken_001", "SM_Ruin_Pillar_Broken_002"]);
  assert.deepEqual(plan.items[0].moves.map((m: any) => m.to),
    ["SM_Ruin_Pillar_Broken_001.glb", "SM_Ruin_Pillar_Broken_001.blend", "SM_Ruin_Pillar_Broken_001.fbx"]);
});

test("preflight rejects reserved names, duplicate targets and external occupied paths", () => {
  const rows = [{ id: "a", type: "glb", path: "A.glb", name: "A" },
    { id: "b", type: "glb", path: "B.glb", name: "B" },
    { id: "c", type: "glb", path: "C.glb", name: "C" }];
  assert.throws(() => buildRenamePlan(rows, ["a"], { subject: "CON", numberWidth: 0 }, true), /保留|文件名/);
  assert.throws(() => buildRenamePlan(rows, ["a", "b"], { subject: "same", numberWidth: 0 }, true), /重复/);
  assert.throws(() => buildRenamePlan(rows, ["a"], { subject: "con", numberWidth: 0 }, true), /保留|文件名/);
  assert.throws(() => buildRenamePlan(rows, ["a"], { subject: "C", numberWidth: 0 }, true), /已存在|冲突/);
});

test("transaction renames linked files while preserving asset ID and scan identity", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "xh-rename-"));
  try {
    await fs.copyFile(path.resolve("fixtures/direction.glb"), path.join(root, "A.glb"));
    for (const ext of ["blend", "fbx"]) await fs.writeFile(path.join(root, `A.${ext}`), ext);
    await fs.writeFile(path.join(root, ".xinghai-assets.json"), JSON.stringify({ version: 1, assets: [
      { id: "stable", type: "glb", path: "A.glb", name: "A", source: "A.blend", exchange: "A.fbx" },
      { id: "source", type: "blend", path: "A.blend", name: "A" },
      { id: "exchange", type: "fbx", path: "A.fbx", name: "A" },
    ] }));
    const catalog = new Catalog(root);
    await catalog.scan();
    await catalog.renameBatch(["stable"], { prefix: "SM", subject: "柱", numberStart: 7, numberWidth: 3 }, true);
    const rows = await catalog.scan();
    assert.equal(rows.find((r: any) => r.id === "stable").path, "SM_柱_007.glb");
    assert.equal(rows.find((r: any) => r.id === "source").path, "SM_柱_007.blend");
    assert.equal(rows.find((r: any) => r.id === "exchange").path, "SM_柱_007.fbx");
    await assert.rejects(fs.access(path.join(root, "A.glb")));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
