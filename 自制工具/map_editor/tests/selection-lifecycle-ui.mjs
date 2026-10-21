import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const project = await fs.mkdtemp(
  path.join(await fs.realpath(os.tmpdir()), "xh-canvases-"),
);
const profile = await fs.mkdtemp(
  path.join(await fs.realpath(os.tmpdir()), "xh-canvas-profile-"),
);
const app = await electron.launch({
  args: process.env.XH_ELECTRON_EXECUTABLE
    ? ["--test-hidden"]
    : [".", "--test-hidden"],
  env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
  executablePath:
    process.env.XH_ELECTRON_EXECUTABLE ??
    "node_modules/electron/dist/electron.exe",
});
try {
  const page = await app.firstWindow(),
    errors = [];
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, project);
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByRole("button", { name: "新建资产", exact: true }).click();

  await page.locator("#viewport-brush-menu summary").click();
  await page.locator('[data-tool="brush"]').click();
  const box = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByText("体素 1", { exact: true }).waitFor();
  await page.locator("#native-all").evaluate((e) => e.click());
  assert.equal(
    await page.locator("#editview").getAttribute("data-selection-count"),
    "1",
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#editview").getAttribute("data-selection-count"),
    "0",
    "Esc clears an idle selection without leaving the active brush",
  );
  await page.locator("#native-all").evaluate((e) => e.click());
  await page.locator("#viewport-precision summary").click();
  await page.locator('[data-axis="0"][data-step="1"]').click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#editview").getAttribute("data-selection-count"),
    "0",
  );
  await page.keyboard.press("Control+z");
  assert.equal(
    await page.locator("#editview").getAttribute("data-selection-count"),
    "0",
    "undo does not resurrect selection",
  );
  await page.locator("#native-all").evaluate((e) => e.click());
  await page.locator("#delete-selection").click();
  await page.getByText("体素 0", { exact: true }).waitFor();
  assert.equal(
    await page.locator("#editview").getAttribute("data-selection-count"),
    "0",
    "deleted voxels lose selection overlay",
  );
  await page.keyboard.press("Control+z");
  await page.getByText("体素 1", { exact: true }).waitFor();
  assert.equal(
    await page.locator("#editview").getAttribute("data-selection-count"),
    "0",
  );
  await page.locator("#top").click();
  await page.getByLabel("笔刷范围 / 格", { exact: true }).fill("3");
  await page.getByLabel("厚度", { exact: true }).fill("3");
  if (!(await page.locator('[data-tool="brush"]').isVisible()))
    await page.locator("#viewport-brush-menu summary").click();
  await page.locator('[data-tool="brush"]').click();
  await page.mouse.click(box.x + box.width / 2 + 100, box.y + box.height / 2);
  await page.getByText("体素 28", { exact: true }).waitFor();
  await page.locator("#native-all").evaluate((e) => e.click());
  await page.locator("#tool-xray").click();
  await page.getByLabel("笔刷范围 / 格", { exact: true }).fill("5");
  if (!(await page.locator('[data-tool="erase"]').isVisible()))
    await page.locator("#viewport-brush-menu summary").click();
  await page.locator('[data-tool="erase"]').click();
  await page.locator("#viewport-brush-menu summary").click();
  await page.locator('[data-tool="erase"]').click();
  assert.equal(
    await page.locator('[data-tool="erase"]').getAttribute("aria-pressed"),
    "true",
    "choosing eraser again must not reenter selection mode",
  );
  await page.mouse.click(box.x + box.width / 2 + 100, box.y + box.height / 2);
  await page.getByText("体素 1", { exact: true }).waitFor();
  assert.equal(
    await page.locator("#editview").getAttribute("data-selection-count"),
    "1",
  );
  assert.deepEqual(errors, []);
  console.log("selection lifecycle UI passed");
} finally {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
  );
  await app.close();
}
