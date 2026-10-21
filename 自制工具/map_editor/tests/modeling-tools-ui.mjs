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

  await page.locator(".modeling-tools summary").click();
  await page.locator("#work-plane").selectOption("1");
  await page.locator("#work-plane-number").fill("3");
  await page.locator("#work-plane-number").press("Tab");
  await page.locator('[data-ortho="front"]').click();
  assert.equal(
    await page.locator("#editview").getAttribute("data-work-plane"),
    "1:3",
  );
  await page.locator(".modeling-tools summary").click();
  const box = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(
    box.x + box.width / 2 + 20,
    box.y + box.height / 2 - 20,
  );
  await page.getByText("体素 1", { exact: true }).waitFor();
  async function saved() {
    await page
      .locator("#workshop-message")
      .evaluate((e) => (e.textContent = ""));
    await page.getByRole("button", { name: "保存资产", exact: true }).click();
    await page.getByText("原生资产与试摆草稿已保存", { exact: true }).waitFor();
    const manifest = JSON.parse(
      await fs.readFile(path.join(project, "project.xhproject.json"), "utf8"),
    );
    return JSON.parse(
      await fs.readFile(path.join(project, manifest.assets[0].source), "utf8"),
    );
  }
  console.log("painted");
  let doc = await saved();
  assert.equal(doc.cells[0].y, 3);
  await page.locator("#native-all").evaluate((e) => e.click());
  await page.locator(".modeling-tools summary").click();
  await page.locator("#random-edge").click();
  await page.getByLabel("随机强度").fill("100");
  await page.getByLabel("最大边缘格数").fill("3");
  await page.getByLabel("边缘方式").selectOption("add");
  await page.getByRole("button", { name: "应用", exact: true }).click();
  console.log("random applied");
  doc = await saved();
  assert.ok(doc.cells.length > 1);
  const count = doc.cells.length;
  await page.locator("#undo").click();
  doc = await saved();
  assert.equal(doc.cells.length, 1);
  await page.locator("#native-all").evaluate((e) => e.click());
  await page.locator("#random-tone").click();
  await page.getByLabel("随机强度").fill("50");
  await page.getByRole("button", { name: "应用", exact: true }).click();
  doc = await saved();
  assert.ok(doc.palette.length > 8);
  await page.locator(".modeling-tools summary").click();
  const png = path.join(project, "reference.png");
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 20;
    c.height = 40;
    const x = c.getContext("2d");
    x.fillStyle = "red";
    x.fillRect(0, 0, 20, 40);
    return c.toDataURL().split(",")[1];
  });
  await fs.writeFile(png, Buffer.from(data, "base64"));
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, png);
  await page.locator("#reference-panel summary").click();
  await page.locator("#reference-import").click();
  await page.locator("#reference-name").filter({ hasText: "20×40" }).waitFor();
  await page.getByLabel("参考图x", { exact: true }).fill("1.5");
  await page.getByLabel("参考图x", { exact: true }).dispatchEvent("change");
  doc = await saved();
  assert.equal(doc.editor.reference.x, 1.5);
  const shot = await page.locator("#editview canvas").screenshot();
  const red = await app.evaluate(
    ({ nativeImage }, bytes) => {
      const im = nativeImage.createFromBuffer(Buffer.from(bytes)),
        { width, height } = im.getSize(),
        pixels = im.toBitmap();
      let xs = [],
        ys = [];
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (pixels[i + 2] > 245 && pixels[i + 1] < 10 && pixels[i] < 10) {
            xs.push(x);
            ys.push(y);
          }
        }
      return {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
        width,
        height,
      };
    },
    [...shot],
  );
  await page.locator("#reference-free-move").click();
  const vb = await page.locator("#editview canvas").boundingBox(),
    px = vb.x + (red.x * vb.width) / red.width - 12,
    py = vb.y + (red.y * vb.height) / red.height;
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px + 35, py - 20, { steps: 5 });
  await page.mouse.up();
  doc = await saved();
  console.log(
    "reference after drag",
    doc.editor.reference.x,
    doc.editor.reference.y,
    doc.editor.reference.z,
  );
  assert.ok(
    Math.abs(doc.editor.reference.x - 1.5) > 0.1,
    "dragging reference image must move it",
  );
  assert.match(
    await page.locator("#reference-free-move").getAttribute("class"),
    /active/,
  );
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "validation/modeling-tools.png" });
  assert.deepEqual(errors, []);
  console.log(
    "modeling UI: front-plane painting, random edge/tone preview/apply/undo, reference slider and move mode passed",
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
  );
  await app.close();
}
