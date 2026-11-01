// Isolated hidden workshop; never attaches to the user's app/profile or project.
import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const project = await fs.mkdtemp(
  path.join(await fs.realpath(os.tmpdir()), "xh-placement-escape-project-"),
);
const profile = await fs.mkdtemp(
  path.join(await fs.realpath(os.tmpdir()), "xh-placement-escape-profile-"),
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
  await page.setViewportSize({ width: 1440, height: 900 });
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
  const canvas = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(
    canvas.x + canvas.width / 2,
    canvas.y + canvas.height / 2,
  );
  await page.getByText("体素 1", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.locator("[data-model-object]").first().click();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.locator("#model-interaction-mode").inputValue(),
    "edit",
  );
  await page.locator("#native-all").evaluate((e) => e.click());
  assert.equal(
    await page.locator("#editview").getAttribute("data-selection-count"),
    "1",
  );
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  assert.equal(
    await page.locator("#editview").getAttribute("data-placement-mode"),
    "paste",
  );
  await page.mouse.move(
    canvas.x + canvas.width * 0.75,
    canvas.y + canvas.height * 0.75,
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#editview").getAttribute("data-placement-mode"),
    null,
    "Esc should finish the paste at the copied source",
  );
  const copyId = await page
    .locator("#editview")
    .getAttribute("data-active-copy");
  assert.ok(
    copyId,
    "new copy should remain selected for immediate gizmo movement",
  );
  assert.equal(
    await page.locator("#editview").getAttribute("data-selection-count"),
    "1",
  );
  await page.getByRole("button", { name: "保存资产", exact: true }).click();
  await page.getByText("原生资产与搭建场景已保存", { exact: true }).waitFor();
  const index = JSON.parse(
    await fs.readFile(path.join(project, "project.xhproject.json"), "utf8"),
  );
  const source = JSON.parse(
    await fs.readFile(path.join(project, index.assets[0].source), "utf8"),
  );
  const active = source.canvases[0];
  assert.equal(active.baseCells.length, 1);
  assert.equal(active.voxelCopies.length, 1);
  assert.equal(active.voxelCopies[0].copyId, copyId);
  assert.deepEqual(
    active.voxelCopies[0].cells.map((c) => [c.x, c.y, c.z]),
    active.baseCells.map((c) => [c.x, c.y, c.z]),
    "Esc ignores the remote preview target",
  );
  await page.locator("#home").click();
  await page.locator("#top").click();
  const viewport = await page.locator("#editview canvas").boundingBox(),
    png = await page.locator("#editview canvas").screenshot();
  const tip = await app.evaluate(({ nativeImage }, data) => {
    const image = nativeImage.createFromBuffer(Buffer.from(data, "base64")),
      pixels = image.toBitmap(),
      { width, height } = image.getSize(),
      points = [];
    for (let y = Math.floor(height * 0.35); y < height * 0.85; y++)
      for (let x = Math.floor(width * 0.2); x < width * 0.75; x++) {
        const i = (y * width + x) * 4;
        if (pixels[i + 2] > 180 && pixels[i + 1] < 80 && pixels[i] < 80)
          points.push({ x, y });
      }
    const max = Math.max(...points.map((p) => p.x)),
      edge = points.filter((p) => p.x > max - 8);
    return {
      count: edge.length,
      x: edge.reduce((n, p) => n + p.x, 0) / edge.length,
      y: edge.reduce((n, p) => n + p.y, 0) / edge.length,
      width,
      height,
    };
  }, png.toString("base64"));
  assert.ok(
    tip.count,
    "a movement-axis handle is available immediately after Esc",
  );
  const handle = {
    x: viewport.x + (tip.x * viewport.width) / tip.width,
    y: viewport.y + (tip.y * viewport.height) / tip.height,
  };
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x + 48, handle.y, { steps: 10 });
  await page.mouse.up();
  assert.match(await page.locator("#message").textContent(), /坐标轴移动/);
  await page.locator("#workshop-message").evaluate((e) => (e.textContent = ""));
  await page.getByRole("button", { name: "保存资产", exact: true }).click();
  await page.getByText("原生资产与搭建场景已保存", { exact: true }).waitFor();
  const moved = JSON.parse(
    await fs.readFile(path.join(project, index.assets[0].source), "utf8"),
  ).canvases[0];
  assert.deepEqual(
    moved.baseCells,
    active.baseCells,
    "axis movement must preserve the copied source",
  );
  assert.equal(moved.cells.length, 2);
  assert.equal(moved.voxelCopies[0].copyId, copyId);
  assert.notDeepEqual(
    moved.voxelCopies[0].cells.map((c) => [c.x, c.y, c.z]),
    moved.baseCells.map((c) => [c.x, c.y, c.z]),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS Edit-mode Ctrl+V/Esc selects an independent source-position copy",
  );
} catch (error) {
  const p = await app.firstWindow();
  console.log(
    await p.evaluate(() => ({
      mode: document.querySelector("#model-interaction-mode")?.value,
      placement: document.querySelector("#editview")?.dataset.placementMode,
      copy: document.querySelector("#editview")?.dataset.activeCopy,
      message: document.querySelector("#message")?.textContent,
      workshop: document.querySelector("#workshop-message")?.textContent,
      active: document.activeElement?.tagName,
    })),
  );
  throw error;
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  await fs.rm(project, { recursive: true, force: true });
  await fs.rm(profile, { recursive: true, force: true });
}
