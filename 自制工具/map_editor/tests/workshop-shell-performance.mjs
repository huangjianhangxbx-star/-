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
const results = [];
try {
  for (const count of [10000, 40000]) {
    const doc = JSON.parse(await fs.readFile(assetFile, "utf8")),
      cells = [];
    const width = count === 10000 ? 25 : 40,
      height = count === 10000 ? 20 : 25;
    for (let x = 0; x < width; x++)
      for (let y = 0; y < (count === 10000 ? 20 : 40); y++)
        for (let z = 0; z < height; z++)
          cells.push({ x, y, z, color: (x + y + z) % 3 });
    assert.equal(cells.length, count);
    doc.cells = [];
    doc.canvases = doc.canvases.slice(0, 1);
    const c = doc.canvases[0];
    c.cells = cells;
    delete c.paintSource;
    delete c.faceTone;
    doc.objects = [
      {
        objectId: "object-body",
        name: "性能岩块",
        canvasIds: [c.canvasId],
        originTicks: [0, 0, 0],
        cellKeys: cells.map((v) => [v.x, v.y, v.z].join(",")),
      },
    ];
    await fs.writeFile(assetFile, JSON.stringify(doc));
    const start = Date.now();
    await open();
    const openMs = Date.now() - start;
    await page.setViewportSize({ width: 1500, height: 940 });
    const frames = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let last = 0;
          const frames = [];
          function draw(t) {
            if (last) frames.push(t - last);
            last = t;
            if (frames.length === 30)
              resolve({
                mean: frames.reduce((a, b) => a + b, 0) / 30,
                max: Math.max(...frames),
              });
            else requestAnimationFrame(draw);
          }
          requestAnimationFrame(draw);
        }),
    );
    results.push({
      count,
      openMs,
      frames,
      resources: await page.locator("#quads").getAttribute("data-resources"),
    });
    await finish();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    root + "/performance.json",
    JSON.stringify(
      {
        hardware: await import("node:os").then((o) => ({
          cpu: o.cpus()[0].model,
          memoryGiB: o.totalmem() / 2 ** 30,
        })),
        results,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS 10000/40000 cell viewport performance",
    JSON.stringify(results),
    root,
  );
} finally {
  await finish();
}
