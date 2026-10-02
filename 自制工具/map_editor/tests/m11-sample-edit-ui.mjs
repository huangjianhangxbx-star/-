import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const sample = path.resolve("samples/tower-ruins/遗迹双路.xhmap.json");
const before = JSON.parse(await fs.readFile(sample, "utf8"));
const app = await electron.launch({ args: [".", "--test-hidden"],
  executablePath: "node_modules/electron/dist/electron.exe" });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, sample);
  await page.getByRole("button", { name: "打开", exact: true }).click();
  await page.getByText(`体素 ${before.cells.length}`, { exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "俯视", exact: true }).click();
  await page.getByRole("button", { name: "色板 3", exact: true }).click();
  await page.getByRole("button", { name: "地台", exact: true }).click();
  await page.getByRole("button", { name: "笔刷", exact: true }).click();
  const rect = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("已保存 遗迹双路.xhmap.json", { exact: true }).waitFor({ timeout: 30000 });
  const after = JSON.parse(await fs.readFile(sample, "utf8"));
  assert.equal(after.mapId, before.mapId);
  assert.ok(after.revision > before.revision);
  assert.equal(after.instances.length, before.instances.length);
  assert.equal(after.decals.length, before.decals.length);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "validation/m11-sample-edited.png" });
  console.log("M11_SAMPLE_UI_EDIT_PASS", JSON.stringify({ beforeRevision: before.revision,
    afterRevision: after.revision, cells: after.cells.length }));
} finally { await app.evaluate(({ app }) => app.exit(0)); }
