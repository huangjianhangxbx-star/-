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
  const dataHash = hash(before);
  assert.equal((await state("edit")).preset, "studio-gray");
  assert.equal((await state("preview")).preset, "studio-color");
  const screenshots = [];
  for (const preset of [
    "studio-gray",
    "albedo",
    "studio-color",
    "raking-gray",
  ]) {
    await set("edit", "preset", preset);
    await page.keyboard.press("Escape");
    const file = preset + ".png";
    await page.screenshot({ path: path.join(root, file) });
    screenshots.push(file);
    assert.equal((await state("preview")).preset, "studio-color");
  }
  await set("edit", "rotation", 250);
  await set("edit", "background", "mid");
  await set("edit", "cavity", "off");
  await set("edit", "cavity", "medium");
  assert.equal(
    hash(await save()),
    dataHash,
    "display must not mutate saved asset, revision or history",
  );
  await set("edit", "preset", "albedo");
  assert(
    await menu("edit")
      .locator('[data-display-control="brightness"]')
      .isDisabled(),
  );
  await menu("edit").locator("[data-display-sync]").check();
  await page.waitForFunction(
    () => document.querySelector("#preview").dataset.displayPreset === "albedo",
  );
  assert.equal((await state("preview")).preset, "albedo");
  await set("edit", "preset", "raking-gray");
  assert.equal((await state("preview")).preset, "raking-gray");
  await menu("edit").locator("[data-display-sync]").uncheck();
  await page.keyboard.press("Escape");
  await page.locator(".modeling-tools summary").click();
  await page.locator("#rock-shaping").click();
  await page.waitForFunction(
    () =>
      Number(document.querySelector("#editview").dataset.rockPreviewCount) > 0,
  );
  const frozen = await page
    .locator("#editview")
    .getAttribute("data-rock-preview-count");
  const seed = await page
    .locator("#rock-seed")
    .inputValue()
    .catch(() => null);
  for (const preset of ["studio-gray", "studio-color", "raking-gray", "albedo"])
    await set("edit", "preset", preset);
  assert.equal(
    await page.locator("#editview").getAttribute("data-rock-preview-count"),
    frozen,
  );
  assert(await page.locator("#rock-shape-panel").isVisible());
  if (seed !== null)
    assert.equal(await page.locator("#rock-seed").inputValue(), seed);
  await page.keyboard.press("Escape");
  assert(
    await page.locator("#rock-shape-panel").isVisible(),
    "first Escape closes display menu",
  );
  await page.keyboard.press("Escape");
  await page.locator("#rock-shape-panel").waitFor({ state: "hidden" });
  assert.equal(hash(await save()), dataHash);
  await set("edit", "preset", "studio-gray");
  await page.keyboard.press("Escape");
  await page.locator("#model-interaction-mode").selectOption("edit");
  await page.locator("#surface-paint-mode").selectOption("paint");
  await page.waitForFunction(
    () =>
      document.querySelector("#editview").dataset.displayPreset === "albedo",
  );
  assert.equal((await state("edit")).preset, "albedo");
  await page.locator("#surface-paint-mode").selectOption("model");
  await page.waitForFunction(
    () =>
      document.querySelector("#editview").dataset.displayPreset ===
      "studio-gray",
  );
  assert.equal((await state("edit")).preset, "studio-gray");
  await page.locator("#surface-paint-mode").selectOption("paint");
  await set("edit", "preset", "studio-color");
  await page.keyboard.press("Escape");
  await page.locator("#surface-paint-mode").selectOption("model");
  assert.equal((await state("edit")).preset, "studio-color");
  await set("edit", "preset", "raking-gray");
  await set("edit", "rotation", 73);
  await page.keyboard.press("Escape");
  const frameIntervalMs = {};
  for (const cavity of ["off", "low", "medium"]) {
    await set("edit", "cavity", cavity);
    await page.keyboard.press("Escape");
    const intervals = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const a = [];
          let last = performance.now();
          function tick(t) {
            a.push(t - last);
            last = t;
            if (a.length < 60) requestAnimationFrame(tick);
            else resolve(a.slice(10));
          }
          requestAnimationFrame(tick);
        }),
    );
    const percent = (p) =>
      [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length * p)];
    frameIntervalMs[cavity] = { median: percent(0.5), p95: percent(0.95) };
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: 1800, height: 1100 });
  assert.equal(hash(await save()), dataHash);
  await finish();
  await open();
  assert.equal((await state("edit")).preset, "raking-gray");
  assert.equal((await state("edit")).rotation, 73);
  await page.locator('[data-workspace="assembly"]').click();
  const assemblyMenu = await show("assembly");
  await assemblyMenu
    .locator('[data-display-control="preset"]')
    .selectOption("studio-gray");
  await page.keyboard.press("Escape");
  await page.locator('[data-instance="i-wall"]').click();
  const instanceCount = await page.locator("[data-instance]").count();
  await page.keyboard.press("Control+d");
  await page.waitForFunction(
    (n) => document.querySelectorAll("[data-instance]").length === n + 1,
    instanceCount,
  );
  await page.screenshot({ path: path.join(root, "assembly.png") });
  assert.equal(
    await menu("assembly")
      .locator('[data-display-control="preset"]')
      .inputValue(),
    "studio-gray",
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  await fs.writeFile(
    path.join(root, "result.json"),
    JSON.stringify(
      { dataHash, screenshots, frameIntervalMs, window: [1800, 1100], errors },
      null,
      2,
    ),
  );
  console.log(
    "PASS viewport display, color paths, sync, frozen rock preview, paint transitions, author invariance, restart, assembly " +
      root,
  );
} finally {
  await finish();
}
