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
try {
  const original = await fs.readFile(assetFile, "utf8"),
    glbBefore = core.exportAssetGlb(JSON.parse(original));
  await open();
  await page.setViewportSize({ width: 1500, height: 940 });
  await page.screenshot({ path: root + "/u14-model.png" });
  await page.getByRole("button", { name: "自动上色", exact: true }).click();
  await page.locator("#appearance-panel[data-changed]").waitFor();
  const changed = await page
    .locator("#appearance-panel")
    .getAttribute("data-changed");
  await page.locator("[data-shell-layout=preview]").click();
  await page.locator("[data-ortho=front]").evaluate((e) => e.click());
  await set("edit", "preset", "albedo");
  assert.equal(
    await page.locator("#appearance-panel").getAttribute("data-changed"),
    changed,
  );
  await page.screenshot({ path: root + "/u14-color.png" });
  await page.locator("#save-draft").click();
  await page.locator(".draft-decision").waitFor();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  assert(await page.locator("#appearance-panel").isVisible());
  await page.keyboard.press("Escape");
  assert(await page.locator("#appearance-panel").isHidden());
  await page.getByRole("button", { name: "自动上色", exact: true }).click();
  await page.locator("#appearance-panel[data-changed]").waitFor();
  await page.locator("#save-draft").click();
  await page.getByRole("button", { name: "放弃后继续", exact: true }).click();
  await page.getByText("原生资产与试摆草稿已保存", { exact: true }).waitFor();
  assert.equal(hash(await fs.readFile(assetFile, "utf8")), hash(original));
  assert.equal(
    hash(core.exportAssetGlb(JSON.parse(await fs.readFile(assetFile, "utf8")))),
    hash(glbBefore),
  );
  await page.getByRole("button", { name: "自动上色", exact: true }).click();
  await page.locator("[data-ap-action=apply]:enabled").waitFor();
  await page.locator("[data-ap-action=apply]").click();
  await save();
  assert.notEqual(
    hash(core.exportAssetGlb(JSON.parse(await fs.readFile(assetFile, "utf8")))),
    hash(glbBefore),
  );
  await page.keyboard.press("Control+z");
  await save();
  const undone = JSON.parse(await fs.readFile(assetFile, "utf8"));
  undone.revision = JSON.parse(original).revision;
  assert.equal(hash(core.exportAssetGlb(undone)), hash(glbBefore));
  await page.getByRole("button", { name: "建模", exact: true }).click();
  await page.locator("#model-commands-more>summary").click();
  await page.locator("#shell-rock").click();
  await page.locator("#rock-shape-panel").waitFor({ state: "visible" });
  await page.locator("#model-commands-more>summary").click();
  await page.locator("[data-shell-layout=inspector]").click();
  await page.locator("[data-shell-layout=inspector]").click();
  assert(await page.locator("#rock-shape-panel").isVisible());
  await page.screenshot({ path: root + "/u14-rock.png" });
  await page.locator("#rock-cancel").click();
  for (const [w, h] of [
    [1280, 800],
    [1000, 700],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.screenshot({ path: root + "/u14-" + w + ".png" });
    assert(await page.locator("#open-paint-window").isVisible());
  }
  await page.setViewportSize({ width: 1500, height: 940 });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1.5),
  );
  await page.screenshot({ path: root + "/u14-150percent.png" });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1),
  );
  const popup = app.waitForEvent("window");
  await page.locator("#open-paint-window").click();
  const child = await popup;
  await child.waitForLoadState("domcontentloaded");
  await child.locator("#paint-view[data-surface-paint-mode=paint]").waitFor();
  assert(await child.locator("#paint-title").textContent());
  await child.screenshot({ path: root + "/u14-paint.png" });
  await child.locator("#paint-return").click();
  await page.waitForFunction(
    () => document.querySelector("#paint-lease-banner").hidden,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS shell, frozen preview, save decision, layouts, real paint child",
    root,
  );
} catch (e) {
  console.log(
    "ERR",
    errors,
    await page.locator("#workshop-message").textContent(),
  );
  await page.screenshot({ path: root + "/u14-error.png" });
  throw e;
} finally {
  await finish();
}
