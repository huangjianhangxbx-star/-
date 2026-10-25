import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
const root = await fs.mkdtemp(path.resolve("validation/n3-contact-ui-")),
  profile = path.join(root, "profile");
await fs.mkdir(profile);
const a = core.createAsset("a");
a.schema = "xinghai-workshop-asset-2";
a.name = "彩绘石块";
a.canvases = [0.25, 0.125, 0.0625].map((step, i) => ({
  canvasId: "c" + i,
  name: "石块" + i,
  visible: true,
  locked: false,
  voxelStepM: step,
  originTicks: [i * 32, i * 32, i * 32],
  cells: [{ x: 0, y: 0, z: 0, color: i }],
  protectedColumns: [],
}));
a.objects = a.canvases.map((c, i) => ({
  objectId: "o" + i,
  name: c.name,
  canvasIds: [c.canvasId],
  originTicks: c.originTicks.map((n) => n + c.voxelStepM / 0.03125 / 2),
  cellKeys: ["0,0,0"],
}));
let originalFileBytes;
if (process.env.XH_N3_CONTACT_ASSET) {
  originalFileBytes = await fs.readFile(process.env.XH_N3_CONTACT_ASSET);
  const supplied = core.validateAsset(JSON.parse(originalFileBytes));
  for (const k of Object.keys(a)) delete a[k];
  Object.assign(a, supplied, { assetId: "a" });
} else {
  a.name = "N3 斜接触体素";
  a.canvases[0].cells = [
    { x: 0, y: 0, z: 0, color: 0 },
    { x: 1, y: 1, z: 0, color: 0 },
  ];
  a.objects[0].cellKeys = ["0,0,0", "1,1,0"];
  a.canvases.splice(1);
  a.objects.splice(1);
}
const s = core.createScene("s");
s.assets = [{ kind: "voxel", assetId: "a", source: "assets/a.xhmodule.json" }];
s.instances = [
  {
    instanceId: "i",
    assetId: "a",
    positionM: [0, 0, 0],
    rotationDeg: 0,
    groupId: "base",
  },
];
const p = core.createProject("p");
p.scenes = [
  { sceneId: "s", name: "材质绘制", source: "scenes/s/scene.xhscene.json" },
];
const v2 = !!process.env.XH_TEST_PROJECT_V2,
  source = v2
    ? "assets/a/asset.xhmodule.json"
    : "scenes/s/assets/a.xhmodule.json";
const p2 = {
  schema: "xinghai-workshop-project-2",
  projectId: "p",
  revision: 0,
  name: "彩绘测试",
  assets: [
    {
      assetId: "a",
      kind: "voxel",
      name: a.name,
      revision: 0,
      preview: null,
      source,
    },
  ],
  scenes: [
    {
      sceneId: "s",
      name: s.name,
      revision: 0,
      source: "scenes/s/scene.xhscene.json",
      preview: null,
    },
  ],
};
const { assets, ...s2 } = s;
for (const [f, d] of [
  ["project.xhproject.json", v2 ? p2 : p],
  [
    "scenes/s/scene.xhscene.json",
    v2 ? { ...s2, schema: "xinghai-workshop-scene-2" } : s,
  ],
  [source, a],
]) {
  await fs.mkdir(path.dirname(path.join(root, f)), { recursive: true });
  await fs.writeFile(path.join(root, f), JSON.stringify(d));
}
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
let app = await launch();
let page;
const errors = [];
const read = async () =>
  JSON.parse(await fs.readFile(path.join(root, source), "utf8"));
async function open() {
  page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1040 });
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, root);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page
    .getByText(v2 ? "项目级资产库已打开" : "项目已打开", { exact: true })
    .waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  await page.locator('[data-instance="i"]').click();
  await page.locator("#assembly-edit").click();
}
async function openChild(id) {
  await page.locator('[data-model-object="' + id + '"]').click();
  const pending = app.waitForEvent("window");
  await page.locator("#open-paint-window").click();
  const child = await pending;
  child.setDefaultTimeout(10000);
  child.on("pageerror", (e) => errors.push(e.message));
  await child.locator("#paint-view[data-surface-paint-mode=paint]").waitFor();
  return child;
}
async function childSave(child) {
  await child.locator("#paint-save").click();
  await child.waitForFunction(
    () => document.querySelector("#paint-status").textContent === "项目已保存",
  );
  return read();
}
async function waitIdle(child) {
  await child.waitForFunction(() => document.body.dataset.busy === "false");
}
const ready = async (child) => {
  await child.waitForFunction(
    () =>
      document.querySelector("#edge-band-panel").dataset.state !== "computing",
  );
  assert.equal(
    await child.locator("#edge-band-panel").getAttribute("data-state"),
    "ready",
    await child.locator("#edge-band-status").textContent(),
  );
};
try {
  await open();
  const child = await openChild(a.objects[0].objectId);
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().endsWith("/paint-workspace.html"),
    );
    w.setContentSize(1280, 860);
    w.show();
    w.focus();
  });
  const before = await childSave(child),
    canvasId = a.objects[0].canvasIds[0],
    sourceBefore = structuredClone(
      before.canvases.find((c) => c.canvasId === canvasId).paintSource,
    );
  await child.locator("#paint-auto-outline").click();
  await ready(child);
  await child.locator("#edge-band-side-width").fill("5");
  await child.locator("#edge-band-side-width").dispatchEvent("change");
  await ready(child);
  await child.locator("#edge-band-side-hex").fill("#000000");
  await child.locator("#edge-band-side-hex").dispatchEvent("change");
  await ready(child);
  const statuses = [];
  for (const preset of ["side", "top", "both", "convex"]) {
    await child.locator("#edge-band-preset").selectOption(preset);
    await ready(child);
    assert.equal(await child.locator("#edge-band-apply").isDisabled(), false);
    const status = await child.locator("#edge-band-status").textContent();
    assert.match(status, /分别|接触/);
    statuses.push({ preset, status });
  }
  await child.locator("#edge-band-preset").selectOption("side");
  await ready(child);
  await child.screenshot({ path: path.join(root, "contact-preview.png") });
  await child.locator("#edge-band-apply").click();
  await child.waitForFunction(() =>
    document
      .querySelector("#edge-band-status")
      .textContent.startsWith("已应用"),
  );
  await child.locator("#edge-band-close").click();
  const saved = await childSave(child),
    paint = saved.canvases.find((c) => c.canvasId === canvasId).paintSource;
  assert.ok(
    paint.layers.some(
      (l) =>
        l.name.startsWith("结构描边") &&
        Object.values(l.faces).some((f) =>
          Object.values(f).includes("#000000"),
        ),
    ),
  );
  assert.deepEqual(
    saved.canvases.map((c) => ({ cells: c.cells, origin: c.originTicks })),
    before.canvases.map((c) => ({ cells: c.cells, origin: c.originTicks })),
  );
  assert.deepEqual(saved.anchorM, before.anchorM);
  await child.locator("#paint-undo").click();
  await waitIdle(child);
  assert.deepEqual(
    (await childSave(child)).canvases.find((c) => c.canvasId === canvasId)
      .paintSource,
    sourceBefore,
  );
  await child.locator("#paint-redo").click();
  await waitIdle(child);
  assert.deepEqual(
    (await childSave(child)).canvases.find((c) => c.canvasId === canvasId)
      .paintSource,
    paint,
  );
  if (originalFileBytes)
    assert.deepEqual(
      await fs.readFile(process.env.XH_N3_CONTACT_ASSET),
      originalFileBytes,
      "production asset remains byte identical",
    );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      root,
      cells: before.canvases.reduce((n, c) => n + c.cells.length, 0),
      statuses,
      result:
        "diagonal contacts four presets, black band apply, undo/redo, unchanged geometry and production source PASS",
    }),
  );
} catch (e) {
  console.error("CONTACT_UI_FAILURE", e);
  throw e;
} finally {
  await app
    .evaluate(({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows()) {
        w.removeAllListeners("close");
        w.destroy();
      }
    })
    .catch(() => {});
  await app.close();
}
