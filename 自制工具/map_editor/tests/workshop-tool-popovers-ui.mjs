import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
import { createHash } from "node:crypto";
import { sampleRoot } from "../scripts/build-display-samples.mjs";
const root = await fs.mkdtemp(path.resolve("validation/viewport-workshop-"));
await fs.cp(sampleRoot, path.join(root, "project"), { recursive: true });
const project = path.join(root, "project"),
  profile = path.join(root, "profile");
await fs.mkdir(profile);
const assetFile = path.join(project, "assets/wall/asset.xhmodule.json");
const hash = (s) => createHash("sha256").update(s).digest("hex");
let app, page;
const errors = [];
const launch = () =>
  electron.launch({
    args: process.env.XH_ELECTRON_EXECUTABLE
      ? ["--workspace=workshop", "--test-hidden"]
      : [".", "--workspace=workshop", "--test-hidden"],
    executablePath:
      process.env.XH_ELECTRON_EXECUTABLE ??
      "node_modules/electron/dist/electron.exe",
    env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
  });
async function open() {
  app = await launch();
  page = await app.firstWindow();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1800, height: 1100 });
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, project);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目级资产库已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  await page.locator('[data-instance="i-wall"]').click();
  await page.locator("#assembly-edit").click();
  await page.locator('[data-model-object="object-body"]').click();
  await page.locator("#home").click();
}
const menu = (id) =>
  page.locator(`.viewport-display-menu[data-viewport="${id}"]`);
async function show(id) {
  const m = menu(id);
  if (!(await m.evaluate((e) => e.open)))
    await m.locator(":scope > summary").click();
  await m.locator(".viewport-display-body").waitFor({ state: "visible" });
  return m;
}
async function set(id, key, value) {
  const m = await show(id),
    field = m.locator(`[data-display-control="${key}"]`);
  if (await field.evaluate((e) => e.tagName === "SELECT"))
    await field.selectOption(value);
  else if ((await field.getAttribute("type")) === "checkbox")
    await field.setChecked(value);
  else
    await field.evaluate((e, value) => {
      e.value = value;
      e.dispatchEvent(new Event("input", { bubbles: true }));
    }, String(value));
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}
const state = (id) =>
  page
    .locator(id === "edit" ? "#editview" : "#preview")
    .getAttribute("data-display-state")
    .then(JSON.parse);
async function save() {
  await page.locator("#workshop-message").evaluate((e) => (e.textContent = ""));
  await page.keyboard.press("Control+s");
  await page.getByText("原生资产与试摆草稿已保存", { exact: true }).waitFor();
  return fs.readFile(assetFile, "utf8");
}
async function finish() {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
}

async function popup(id) {
  const d = page.locator("#" + id);
  if (!(await d.evaluate((e) => e.open)))
    await d.locator(":scope>summary").click();
  await d.locator(".tool-popover-body").waitFor({ state: "visible" });
  return d;
}
async function hits(item) {
  const result = await item.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return [
      [0.5, 0.5],
      [0.08, 0.5],
      [0.92, 0.5],
      [0.5, 0.15],
      [0.5, 0.85],
    ].map(([x, y]) => {
      const at = document.elementFromPoint(
        r.x + r.width * x,
        r.y + r.height * y,
      );
      return {
        ok: e === at || e.contains(at),
        hit: at?.outerHTML?.slice(0, 140),
      };
    });
  });
  assert(
    result.every((v) => v.ok),
    JSON.stringify(result),
  );
}
try {
  await open();
  for (const [w, h] of [
    [1500, 940],
    [1280, 800],
    [1000, 700],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    for (const mode of ["volume", "stack", "creative"]) {
      await popup("viewport-mode-menu");
      const item = page.locator('#modes [data-mode="' + mode + '"]');
      await hits(item);
      await item.click();
      assert(
        !(await page.locator("#viewport-mode-menu").evaluate((e) => e.open)),
      );
    }
    await popup("viewport-mode-menu");
    await page.locator("#modes [data-mode=volume]").click();
    const selected = await page.locator("[data-model-object].active").count();
    await popup("viewport-mode-menu");
    await page.locator("#viewport-brush-menu>summary").click();
    await page
      .locator("#viewport-brush-menu .tool-popover-body")
      .waitFor({ state: "visible" });
    assert(
      !(await page.locator("#viewport-mode-menu").evaluate((e) => e.open)),
    );
    for (const tool of ["brush", "repaint", "erase"]) {
      await popup("viewport-brush-menu");
      const item = page.locator('#tools [data-tool="' + tool + '"]');
      await hits(item);
      await item.click();
    }
    await popup("viewport-mode-menu");
    await page.screenshot({ path: root + "/tool-menu-" + w + ".png" });
    await page.keyboard.press("Escape");
    assert(
      !(await page.locator("#viewport-mode-menu").evaluate((e) => e.open)),
    );
    assert.equal(
      await page.locator("[data-model-object].active").count(),
      selected,
    );
    if (w === 1000) {
      await page.locator("[data-shell-layout=hierarchy]").click();
      await popup("viewport-mode-menu");
      await hits(page.locator("#modes [data-mode=volume]"));
      await page.keyboard.press("Escape");
      await page.locator("[data-shell-layout=hierarchy]").click();
    }
  }
  await page.setViewportSize({ width: 1500, height: 940 });
  await page.locator("#model-interaction-mode").selectOption("edit");
  await popup("viewport-precision");
  await hits(page.locator('#viewport-precision [data-axis="0"]').first());
  await page.keyboard.press("Escape");
  await page.locator("#model-interaction-mode").selectOption("object");
  await popup("viewport-brush-menu");
  await page.locator("#tools [data-tool=brush]").click();
  const before = await save();
  await popup("viewport-mode-menu");
  const box = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.7);
  assert(!(await page.locator("#viewport-mode-menu").evaluate((e) => e.open)));
  assert.equal(
    await save(),
    before,
    "dismiss click must not draw or alter selection",
  );
  await page.keyboard.press("Escape");
  await page.locator('[data-model-object="object-body"]').click();
  await page.getByRole("button", { name: "自动上色", exact: true }).click();
  await page.locator("#appearance-panel").waitFor({ state: "visible" });
  await page.locator("#mode-current").click();
  await page
    .locator("#viewport-mode-menu .tool-popover-body")
    .waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  assert(
    await page.locator("#appearance-panel").isVisible(),
    "Esc closes menu before unrelated draft",
  );
  await page.keyboard.press("Escape");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1.5),
  );
  await popup("viewport-mode-menu");
  await hits(page.locator("#modes [data-mode=volume]"));
  await page.screenshot({ path: root + "/tool-menu-150percent.png" });
  await page.keyboard.press("Escape");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS tool popup hit tests / siblings / Esc / outside / DPI",
    root,
  );
} catch (e) {
  console.log(
    "ERROR",
    await page.locator("#workshop-message").textContent(),
    errors,
  );
  await page.screenshot({ path: root + "/tool-error.png" });
  throw e;
} finally {
  await finish();
}
