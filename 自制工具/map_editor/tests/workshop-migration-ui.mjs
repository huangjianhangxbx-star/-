import { launchWorkshop } from "./workshop-launch.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const root = await fs.mkdtemp(
    path.resolve("validation/workshop-migration-ui-"),
  ),
  project = path.join(root, "project"),
  library = path.join(root, "library"),
  source = path.join(root, "source.json"),
  out = path.resolve("validation/workshop-task5");
await fs.mkdir(project);
await fs.cp("samples/m12-workflow", library, { recursive: true });
const samples = [
    "samples/tower-ruins/遗迹双路.xhmap.json",
    "samples/m12-workflow/assembly.xhmap.json",
  ],
  original = await Promise.all(samples.map((f) => fs.readFile(f))),
  hash = (b) => createHash("sha256").update(b).digest("hex"),
  app = await launchWorkshop(),
  errors = [];
try {
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  async function dialog(file, cancel = false) {
    await app.evaluate(
      ({ dialog }, { file, cancel }) => {
        dialog.showOpenDialog = async () => ({
          canceled: cancel,
          filePaths: cancel ? [] : [file],
        });
      },
      { file, cancel },
    );
  }
  await dialog(project);
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await dialog(library);
  await page.getByRole("button", { name: "选择公共库", exact: true }).click();
  await dialog(source, true);
  await page.getByRole("button", { name: "导入旧图副本", exact: true }).click();
  assert.equal(
    JSON.parse(
      await fs.readFile(path.join(project, "project.xhproject.json"), "utf8"),
    ).scenes.length,
    0,
  );
  for (let i = 0; i < samples.length; i++) {
    await fs.writeFile(source, original[i]);
    await dialog(source);
    await page
      .getByRole("button", { name: "导入旧图副本", exact: true })
      .click();
    await page.waitForFunction(
      (n) => document.querySelectorAll(".scene-list button").length === n,
      i + 1,
    );
    await page.getByText(/旧图副本已导入/).waitFor();
    const p = JSON.parse(
        await fs.readFile(path.join(project, "project.xhproject.json"), "utf8"),
      ),
      row = p.scenes.at(-1),
      scene = JSON.parse(
        await fs.readFile(path.join(project, row.source), "utf8"),
      ),
      old = JSON.parse(original[i]);
    assert.equal(scene.instances.length, old.instances.length + 1);
    assert.equal(scene.decals.length, old.decals.length);
    assert.equal(
      await fs.readFile(
        path.join(project, `scenes/${row.sceneId}/legacy/original.xhmap.json`),
        "utf8",
      ),
      original[i].toString(),
    );
    const terrain = JSON.parse(
      await fs.readFile(
        path.join(project, `scenes/${row.sceneId}/${scene.assets[0].source}`),
        "utf8",
      ),
    );
    assert.deepEqual(terrain.cells, old.cells);
    assert.deepEqual(terrain.anchorM, [0, 0, 0]);
    await page.locator('[data-workspace="assembly"]').click();
    assert.equal(
      await page.locator("[data-instance]").count(),
      scene.instances.length + scene.decals.length,
    );
    await page.locator('[data-workspace="project"]').click();
  }
  await page.getByRole("button", { name: "复制场景", exact: true }).click();
  await page
    .getByText("已创建独立场景副本，原场景保持", { exact: true })
    .waitFor();
  const saved = JSON.parse(
    await fs.readFile(path.join(project, "project.xhproject.json"), "utf8"),
  );
  assert.equal(saved.scenes.length, 3);
  const a = JSON.parse(
      await fs.readFile(path.join(project, saved.scenes[1].source), "utf8"),
    ),
    b = JSON.parse(
      await fs.readFile(path.join(project, saved.scenes[2].source), "utf8"),
    );
  assert.deepEqual(
    a.instances.map((p) => p.positionM),
    b.instances.map((p) => p.positionM),
  );
  assert.ok(a.assets.every((row, i) => row.assetId !== b.assets[i].assetId));
  await dialog(project);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  assert.equal(await page.locator(".scene-list button").count(), 3);
  await page.locator(".scene-list button").last().click();
  await page.locator('[data-workspace="assembly"]').click();
  await page.screenshot({ path: path.join(out, "migration.png") });
  for (let i = 0; i < samples.length; i++)
    assert.equal(hash(await fs.readFile(samples[i])), hash(original[i]));
  assert.deepEqual(errors, []);
  await fs.cp(project, path.join(out, "migrated-project"), { recursive: true });
  await fs.writeFile(
    path.join(out, "migration-ui-result.json"),
    JSON.stringify(
      {
        passed: true,
        scenes: 3,
        checks: [
          "取消不写入",
          "旧双路与M1.2样例真实导入",
          "原文/地形帧/视觉实例保持",
          "复制场景独立身份",
          "保存重开",
          "两个原件hash保持",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("WORKSHOP_MIGRATION_UI_PASS");
} finally {
  await app.evaluate(({ BrowserWindow }) => {
    for (const w of BrowserWindow.getAllWindows()) w.destroy();
  });
  await app.close();
  if (
    !path
      .resolve(root)
      .startsWith(path.resolve("validation/workshop-migration-ui-"))
  )
    throw Error("unsafe cleanup");
  await fs.rm(root, { recursive: true, force: true });
}
