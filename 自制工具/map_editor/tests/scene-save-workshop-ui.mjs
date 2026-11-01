import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
const temporary = await fs.realpath(os.tmpdir()),
  folder = await fs.mkdtemp(path.join(temporary, "xh-scene-save-project-")),
  profile = await fs.mkdtemp(path.join(temporary, "xh-scene-save-profile-"));
const output = await fs.mkdtemp(
  path.resolve("validation/scene-save-workshop-"),
);
const project = core.createProjectV2("scene-save"),
  asset = core.createAsset("rock"),
  old = core.createSceneV2("old");
asset.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
old.name = "旧场景保留";
project.assets.push({
  kind: "voxel",
  assetId: asset.assetId,
  name: "岩块",
  revision: 0,
  preview: null,
  source: "assets/rock/asset.xhmodule.json",
});
project.scenes.push({
  sceneId: old.sceneId,
  name: old.name,
  revision: 0,
  preview: null,
  source: "scenes/old/scene.xhscene.json",
});
for (const [relative, doc] of [
  ["project.xhproject.json", project],
  ["assets/rock/asset.xhmodule.json", asset],
  ["scenes/old/scene.xhscene.json", old],
]) {
  const file = path.join(folder, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(doc));
}
const hash = async (relative) =>
    createHash("sha256")
      .update(await fs.readFile(path.join(folder, relative)))
      .digest("hex"),
  oldHash = await hash("scenes/old/scene.xhscene.json");
const launch = () =>
  electron.launch({
    args: process.env.XH_ELECTRON_EXECUTABLE
      ? ["--test-hidden"]
      : [".", "--test-hidden"],
    env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
    executablePath:
      process.env.XH_ELECTRON_EXECUTABLE ??
      "node_modules/electron/dist/electron.exe",
  });
let app = await launch();
const errors = [];
async function open() {
  const page = await app.firstWindow();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1720, height: 1050 });
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, folder);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目级资产库已打开", { exact: true }).waitFor();
  return page;
}
try {
  let page = await open();
  await page.locator('[data-workspace="assembly"]').click();
  const save = page.locator("#assembly-save");
  assert.ok(
    await save.isVisible(),
    "Save scene must be visible without opening More",
  );
  assert.equal(await save.textContent(), "保存场景");
  assert.equal(
    await save.evaluate((button) => !!button.closest("details")),
    false,
  );
  assert.equal(
    await page.locator('[data-workspace="assembly"]').textContent(),
    "场景搭建",
  );
  await page.locator('[data-workspace="project"]').click();
  await page.getByRole("button", { name: "新建搭建场景", exact: true }).click();
  await page.locator('[data-workspace="assembly"]').click();
  assert.equal(
    await page.locator("#assembly-scene-name").textContent(),
    "搭建场景 2",
  );
  assert.match(
    await page.locator("#assembly-scene-save-state").textContent(),
    /未保存/,
  );
  const viewport = page.locator("#assembly-viewport"),
    box = await viewport.boundingBox(),
    data = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.setData("application/x-xinghai-project-asset", "rock");
      return transfer;
    });
  await viewport.dispatchEvent("drop", {
    dataTransfer: data,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  });
  await page.locator("[data-instance]").first().waitFor();
  await page.locator("[data-instance]").first().click();
  await page.locator("#assembly-position").fill("1,2,0");
  await page.locator("#assembly-apply").click();
  assert.match(
    await page.locator("#assembly-scene-save-state").textContent(),
    /未保存/,
  );
  await save.click();
  await page
    .locator("#assembly-scene-save-state")
    .filter({ hasText: /^已保存$/ })
    .waitFor();
  let manifest = JSON.parse(
      await fs.readFile(path.join(folder, "project.xhproject.json"), "utf8"),
    ),
    row = manifest.scenes.find((s) => s.sceneId !== "old"),
    saved = JSON.parse(
      await fs.readFile(path.join(folder, row.source), "utf8"),
    );
  assert.equal(row.name, "搭建场景 2");
  assert.equal(saved.instances.length, 1);
  assert.deepEqual(saved.instances[0].positionM, [1, 2, 0]);
  assert.ok(
    (
      await page.locator("#assembly-scene-location").getAttribute("title")
    ).includes(row.source),
  );
  await page.locator("#assembly-position").fill("3,2,0");
  await page.locator("#assembly-apply").click();
  assert.match(
    await page.locator("#assembly-scene-save-state").textContent(),
    /未保存/,
  );
  await save.focus();
  await page.keyboard.press("Control+s");
  await page
    .locator("#assembly-scene-save-state")
    .filter({ hasText: /^已保存$/ })
    .waitFor();
  saved = JSON.parse(await fs.readFile(path.join(folder, row.source), "utf8"));
  assert.deepEqual(saved.instances[0].positionM, [3, 2, 0]);
  await page.locator('[data-workspace="project"]').click();
  const entry = page
    .locator(".scene-entry")
    .filter({
      has: page.getByRole("button", { name: "搭建场景 2", exact: true }),
    });
  await entry.getByRole("button", { name: "改名", exact: true }).click();
  await page.getByLabel("场景名称", { exact: true }).fill("可重开的岩台");
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "确定", exact: true })
    .click();
  await page.locator('[data-workspace="assembly"]').click();
  assert.match(
    await page.locator("#assembly-scene-save-state").textContent(),
    /未保存/,
  );
  await save.click();
  await page
    .locator("#assembly-scene-save-state")
    .filter({ hasText: /^已保存$/ })
    .waitFor();
  await page.screenshot({ path: path.join(output, "saved-scene.png") });
  assert.equal(
    await hash("scenes/old/scene.xhscene.json"),
    oldHash,
    "existing user scene names/documents must remain unchanged",
  );
  await app.evaluate(({ app }) => app.exit(0));
  await app.close().catch(() => {});
  app = await launch();
  page = await open();
  await page.getByRole("button", { name: "可重开的岩台", exact: true }).click();
  await page.locator('[data-workspace="assembly"]').click();
  assert.equal(
    await page.locator("#assembly-scene-name").textContent(),
    "可重开的岩台",
  );
  assert.equal(
    await page.locator("#assembly-scene-save-state").textContent(),
    "已保存",
  );
  assert.equal(await page.locator("[data-instance]").count(), 1);
  await page.locator("[data-instance]").first().click();
  assert.equal(await page.locator("#assembly-position").inputValue(), "3,2,0");
  assert.deepEqual(errors, []);
  console.log(
    "PASS visible scene save / dirty state / Ctrl+S / rename / restart",
    output,
  );
} catch (error) {
  const page = await app.firstWindow();
  await page
    .screenshot({ path: path.join(output, "failure.png") })
    .catch(() => {});
  console.log("scene save failure artifacts", output);
  throw error;
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  for (const target of [folder, profile]) {
    assert.equal(path.dirname(target), temporary);
    await fs.rm(target, { recursive: true, force: true });
  }
}
