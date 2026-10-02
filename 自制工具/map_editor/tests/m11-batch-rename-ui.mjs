import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const lib = await fs.mkdtemp(path.join(os.tmpdir(), "xh-batch-ui-"));
for (const name of ["A", "B"]) {
  await fs.copyFile(path.resolve("fixtures/direction.glb"), path.join(lib, `${name}.glb`));
  await fs.copyFile(path.resolve("fixtures/direction.fbx"), path.join(lib, `${name}.fbx`));
  await fs.copyFile(path.resolve("fixtures/direction.blend"), path.join(lib, `${name}.blend`));
}
const app = await electron.launch({ args: [".", "--test-hidden"], executablePath: "node_modules/electron/dist/electron.exe" });
try {
  const page = await app.firstWindow();
  await app.evaluate(({ dialog }, lib) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [lib] });
    dialog.showMessageBox = async () => ({ response: 1 });
  }, lib);
  await page.locator("#choose").click();
  const assets = page.locator(".asset");
  await assets.nth(0).click();
  await assets.nth(1).click({ modifiers: ["Control"] });
  await page.locator("#batchrename").click();
  await page.locator("#batch-dialog[open]").waitFor();
  await page.locator("#batch-prefix").fill("SM");
  await page.locator("#batch-kit").fill("");
  await page.locator("#batch-subject").fill("柱");
  await page.locator("#batch-physical").check();
  await page.locator("#batch-preview").click();
  await page.locator("#batch-commit:enabled").waitFor();
  assert.match(await page.locator("#batch-result").textContent(), /SM_柱_001/);
  assert.match(await page.locator("#batch-result").textContent(), /SM_柱_002/);
  await page.locator("#batch-commit").click();
  await page.locator("#batch-dialog[open]").waitFor({ state: "hidden" });
  const manifest = JSON.parse(await fs.readFile(path.join(lib, ".xinghai-assets.json"), "utf8"));
  assert.equal(manifest.assets.filter((a) => a.type === "glb" && a.path.startsWith("SM_柱_")).length, 2);
  assert.equal(manifest.assets.filter((a) => a.type === "fbx" && a.path.startsWith("SM_柱_")).length, 2);
  console.log("M11_BATCH_RENAME_UI_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
  await fs.rm(lib, { recursive: true, force: true });
}
