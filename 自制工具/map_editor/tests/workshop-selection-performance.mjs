import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { launchWorkshop } from "./workshop-launch.mjs";
const out = path.resolve("validation/workshop-selection");
const root = await fs.mkdtemp(path.join(out, "performance-"));
const app = await launchWorkshop();
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /shader|WebGL/i.test(m.text()))
      errors.push(m.text());
  });
  await app.evaluate(({ dialog, BrowserWindow }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
    BrowserWindow.getAllWindows()[0].setContentSize(1440, 900);
  }, root);
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByRole("button", { name: "新建场景", exact: true }).click();
  await page.getByRole("button", { name: "新建空草稿", exact: true }).click();
  await page.locator("#save-draft").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const project = JSON.parse(
      await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
    ),
    scene = JSON.parse(
      await fs.readFile(path.join(root, project.scenes[0].source), "utf8"),
    ),
    source = path.join(
      root,
      path.dirname(project.scenes[0].source),
      scene.assets[0].source,
    ),
    doc = JSON.parse(await fs.readFile(source, "utf8")),
    results = [];
  for (const [sx, sy, sz] of [
    [10, 10, 10],
    [20, 20, 50],
    [80, 60, 50],
  ]) {
    doc.cells = [];
    for (let x = 0; x < sx; x++)
      for (let y = 0; y < sy; y++)
        for (let z = 0; z < sz; z++) doc.cells.push({ x, y, z, color: 0 });
    await fs.writeFile(source, JSON.stringify(doc));
    await page.reload();
    await page.getByRole("button", { name: "打开项目", exact: true }).click();
    await page.getByText("项目已打开", { exact: true }).waitFor();
    const start = Date.now();
    await page.locator("[data-action=edit-asset]").first().click();
    await page.getByText(`体素 ${doc.cells.length}`, { exact: true }).waitFor();
    await page.locator("#home").click();
    const loadMs = Date.now() - start;
    await page.locator("#top").click();
    await page.locator("#native-select").click();
    const b = await page.locator("#editview canvas").boundingBox();
    await page.evaluate(() => {
      window.frameSample = { max: 0, last: performance.now(), active: true };
      function f(t) {
        const m = window.frameSample;
        if (!m.active) return;
        m.max = Math.max(m.max, t - m.last);
        m.last = t;
        requestAnimationFrame(f);
      }
      requestAnimationFrame(f);
    });
    const selectStart = Date.now();
    await page.mouse.move(b.x + 2, b.y + 42);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width - 2, b.y + b.height - 2);
    await page.mouse.up();
    await page.waitForFunction(
      (n) =>
        document.querySelector("#editview").dataset.selectionCount ===
          String(n) &&
        document.querySelector("#editview").dataset.selectionBusy === "false",
      sx * sy,
      { timeout: 120000 },
    );
    const depth1Ms = Date.now() - selectStart;
    const throughStart = Date.now();
    await page.locator("#selection-through").click();
    await page.waitForFunction(
      (n) =>
        document.querySelector("#editview").dataset.selectionCount ===
          String(n) &&
        document.querySelector("#editview").dataset.selectionBusy === "false",
      doc.cells.length,
      { timeout: 120000 },
    );
    const allMs = Date.now() - throughStart,
      frame = await page.evaluate(() => {
        window.frameSample.active = false;
        return window.frameSample.max;
      });
    await page.waitForTimeout(550);
    const resources = await page
      .locator("#quads")
      .getAttribute("data-resources");
    results.push({
      cells: doc.cells.length,
      loadMs,
      depth1Ms,
      allMs,
      maxFrameMs: frame,
      resources,
    });
    console.log(JSON.stringify(results.at(-1)));
    if (doc.cells.length === 240000) {
      await page.screenshot({ path: path.join(out, "selection-240000.png") });
      await page.locator("#selection-visible").click();
      await page.keyboard.press("Escape");
    }
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(out, "performance.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
} finally {
  await app.evaluate(({ app }) => app.exit(0));
}
