import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const root = path.resolve("validation/workflow"),
  lib = path.join(root, "资产 库"),
  file = path.join(root, "地图 样本.json");
const before = JSON.parse(await fs.readFile(file, "utf8"));
const app = await electron.launch({
  args: [".", "--workspace=legacy", "--test-hidden"],
  executablePath: "node_modules/electron/dist/electron.exe",
});
try {
  const page = await app.firstWindow();
  await app.evaluate(
    ({ dialog }, { file, lib }) => {
      dialog.showOpenDialog = async (_w, o) => ({
        canceled: false,
        filePaths: [o.properties.includes("openDirectory") ? lib : file],
      });
      dialog.showMessageBox = async () => ({ response: 1 });
    },
    { file, lib },
  );
  await page.locator("#choose").click();
  await page.locator("#open").click();
  await page
    .locator("#filename")
    .filter({ hasText: "地图 样本.json" })
    .waitFor();
  await page.locator(".asset").filter({ hasText: "GLB" }).first().click();
  await page.locator("#rename").click();
  await page.locator("#rename-input").fill("方向标 · 人工修改");
  await page.getByRole("button", { name: "确定", exact: true }).click();
  await page.locator("#renamefile").click();
  await page.locator("#rename-input").fill("方向标");
  await page.getByRole("button", { name: "确定", exact: true }).click();
  await page.waitForTimeout(300);
  const manifest = JSON.parse(
      await fs.readFile(path.join(lib, ".xinghai-assets.json"), "utf8"),
    ),
    asset = manifest.assets.find((a) => a.id === before.instances[0].assetId);
  assert.equal(asset.path, "方向标.glb");
  const output = await promisify(execFile)(
    "D:/steam/steamapps/common/Blender/blender.exe",
    [
      "--factory-startup",
      "--background",
      "--python",
      path.resolve("tests/edit_blender_copy.py"),
      "--",
      path.join(lib, asset.source),
      path.join(lib, asset.path),
      path.join(lib, asset.exchange),
    ],
    { timeout: 60000 },
  );
  await fs.writeFile("validation/logs/blender-modify.txt", output.stdout);
  await page.locator("#reload").click();
  await page.getByText("资产已重载；实例位置保持", { exact: true }).waitFor();
  await page.locator("#save").click();
  await page.waitForTimeout(300);
  const after = JSON.parse(await fs.readFile(file, "utf8"));
  assert.deepEqual(after.instances, before.instances);
  const updated = JSON.parse(
    await fs.readFile(path.join(lib, ".xinghai-assets.json"), "utf8"),
  ).assets.find((a) => a.id === asset.id);
  assert.notEqual(updated.hash, asset.hash);
  const good = await fs.readFile(path.join(lib, asset.path));
  await fs.writeFile(path.join(lib, asset.path), "incomplete export");
  await page.locator("#reload").click();
  await page.getByText("GLB损坏", { exact: true }).waitFor();
  await page.screenshot({ path: "validation/reload-preserved.png" });
  await fs.writeFile(path.join(lib, asset.path), good);
  await page.locator("#reload").click();
  await page.getByText("资产已重载；实例位置保持", { exact: true }).waitFor();
  await page.screenshot({ path: "validation/reloaded-model.png" });
  await fs.copyFile(
    path.join(lib, asset.exchange),
    "validation/TuanjieProject/Assets/Fixtures/direction.fbx",
  );
  await fs.writeFile(
    "validation/logs/asset-reload.json",
    JSON.stringify(
      {
        passed: true,
        assetId: asset.id,
        beforeHash: asset.hash,
        afterHash: updated.hash,
        instancesPreserved: true,
        partialExportRejected: true,
        source: "copied .blend edited directly; original fixture unchanged",
      },
      null,
      2,
    ),
  );
  console.log("ASSET_RELOAD_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
}
