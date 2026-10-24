import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
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
  const before = await save();
  const openPanel = async () => {
    await page.locator("#appearance-open").click();
    await page.locator("#appearance-panel").waitFor({ state: "visible" });
    await page.waitForFunction(
      () =>
        document.querySelector("#appearance-panel")?.dataset.changed !==
        undefined,
    );
  };
  await openPanel();
  assert(
    await page
      .locator("#appearance-open")
      .evaluate(
        (e) =>
          e.parentElement.parentElement ===
          document.querySelector("#duplicate").parentElement,
      ),
  );
  const field = (k) => page.locator('[data-ap="' + k + '"]');
  await field("ratio").fill("1");
  await field("ratio").dispatchEvent("input");
  await page.waitForTimeout(180);
  const display=await show('edit');await set('edit','preset','albedo');assert(await page.locator('#appearance-panel').isVisible());assert.equal(await field('seed').inputValue(),'17');await display.locator(':scope > summary').click();
  await page.screenshot({ path: root + "/region-preview.png" });
  await page.keyboard.press("Escape");
  assert.equal(await save(), before);
  await openPanel();
  await field("kind").selectOption("tone");
  await page.waitForFunction(
    () =>
      Number(document.querySelector("#appearance-panel")?.dataset.changed) > 0,
  );
  await page.locator("[data-ap-action=apply]").click();
  const toned = JSON.parse(await save()),
    canvas = toned.canvases.find((c) => c.canvasId === "body");
  assert(Object.keys(canvas.faceTone.faces).length > 0);
  assert.equal(
    canvas.paintSource?.faces["0,0,0,0"]?.["0"],
    JSON.parse(before).canvases[0].paintSource?.faces["0,0,0,0"]?.["0"],
  );
  await page.keyboard.press("Control+z");
  assert.equal(JSON.parse(await save()).canvases[0].faceTone, undefined);
  await page.keyboard.press("Control+Shift+z");
  assert(
    Object.keys(JSON.parse(await save()).canvases[0].faceTone.faces).length > 0,
  );
  await openPanel();
  await field("kind").selectOption("clear");
  await page.waitForTimeout(150);
  await page.locator("[data-ap-action=apply]").click();
  assert.equal(JSON.parse(await save()).canvases[0].faceTone, undefined);
  await openPanel();
  await field("kind").selectOption("region");
  await field("ratio").fill("1");
  await field("ratio").dispatchEvent("input");
  await page.waitForTimeout(180);
  await page.locator("[data-ap-action=apply]").click();
  const region = JSON.parse(await save());
  assert(region.palette.length > JSON.parse(before).palette.length);
  assert.deepEqual(
    region.canvases[0].paintSource,
    JSON.parse(before).canvases[0].paintSource,
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPanel();
  const box = await page.locator("#appearance-panel").boundingBox();
  assert(
    box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= 1280 &&
      box.y + box.height <= 800,
  );
  await page.screenshot({ path: root + "/compact-panel.png" });
  await page.keyboard.press("Escape");
  await finish();
  await open();
  const reopened = JSON.parse(await save());
  assert.deepEqual(reopened.palette, region.palette);
  assert.deepEqual(reopened.canvases[0].cells, region.canvases[0].cells);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        root,
        checks:
          "preview cancel / tone clear / undo redo / region save reopen / top toolbar / compact layout",
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.log(
    "UI ERROR",
    await page.locator("#workshop-message").textContent(),
    errors,
  );
  await page.screenshot({ path: root + "/error.png" });
  throw e;
} finally {
  if (app) await finish();
}
