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
  await open();
  for (const [width, height] of [
    [1500, 940],
    [1280, 800],
    [1000, 700],
  ]) {
    await page.setViewportSize({ width, height });
    const button = page.locator("#model-commands-more>summary"),
      body = page.locator(".model-command-body"),
      before = await button.boundingBox();
    await button.click();
    await body.waitFor({ state: "visible" });
    const after = await button.boundingBox(),
      popup = await body.boundingBox();
    assert(
      Math.abs(before.x - after.x) < 2 && Math.abs(before.y - after.y) < 2,
      "trigger must not move",
    );
    assert(
      Math.abs(popup.y - (before.y + before.height)) <= 8,
      "menu opens under trigger",
    );
    assert(
      popup.x >= 0 && popup.x + popup.width <= width,
      "menu stays in window",
    );
    assert(
      Math.abs(popup.x - before.x) <= 8,
      "menu follows its trigger horizontally",
    );
    await page.screenshot({ path: root + "/feedback-menu-" + width + ".png" });
    await button.click();
    assert(
      await page.locator("#canvas-align").isVisible(),
      "alignment is directly visible",
    );
  }
  const selected = await page.locator("[data-model-object].active").count();
  await page.locator("#model-commands-more>summary").click();
  await page.locator(".model-command-body").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#model-commands-more").evaluate((e) => e.open),
    false,
  );
  assert.equal(
    await page.locator("[data-model-object].active").count(),
    selected,
  );
  await page.locator("#canvas-align").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#workshop-message")
      .textContent.includes("点击源点"),
  );
  await page.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  console.log(
    "PASS anchored command menu and directly usable alignment at 1500/1280/1000",
    root,
  );
} finally {
  await finish();
}
