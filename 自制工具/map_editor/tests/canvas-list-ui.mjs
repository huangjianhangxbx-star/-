import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
const root = await fs.mkdtemp(path.resolve("validation/surface-paint-ui-")),
  profile = await fs.mkdtemp(
    path.join(await fs.realpath(os.tmpdir()), "xh-paint-profile-"),
  );
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
async function save() {
  await page.locator("#workshop-message").evaluate((e) => (e.textContent = ""));
  await page.keyboard.press("Control+s");
  try {
    await page
      .getByText(v2 ? "原生资产与试摆草稿已保存" : "草稿已保存", {
        exact: true,
      })
      .waitFor();
  } catch (e) {
    console.error(
      "save diagnostics",
      await page.locator("#workshop-message").textContent(),
      errors,
    );
    throw e;
  }
  return read();
}
const color = async (hex) =>
  page.locator("#color").evaluate((e, hex) => {
    e.value = hex;
    e.dispatchEvent(new Event("change", { bubbles: true }));
  }, hex);
const center = async () => {
  const b = await page.locator("#editview canvas").boundingBox();
  return { x: b.x + b.width * 0.5, y: b.y + b.height * 0.5 };
};
async function view(axis) {
  await page.locator(`[data-ortho="${axis}"]`).evaluate((e) => e.click());
  await page.waitForFunction(
    (axis) => document.querySelector("#editview").dataset.viewAxis === axis,
    axis,
  );
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
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
async function done(child) {
  await child.waitForFunction(() => document.body.dataset.busy === "false");
}
async function childSave(child) {
  await child.locator("#paint-save").click();
  await child.waitForFunction(
    () => document.querySelector("#paint-status").textContent === "项目已保存",
  );
  return read();
}
async function stroke(child, axis, tool = "brush", hex = "#35bd74") {
  const current = await child
      .locator("#paint-view")
      .getAttribute("data-view-axis"),
    opposite = {
      top: "bottom",
      bottom: "top",
      right: "left",
      left: "right",
      front: "back",
      back: "front",
    };
  if (current !== axis)
    await child
      .locator(
        "[data-ortho=" + (opposite[current] === axis ? current : axis) + "]",
      )
      .click();
  await child.locator("#paint-hex").fill(hex);
  await child.locator("#paint-hex").dispatchEvent("change");
  await child.locator("#surface-paint-tool").selectOption(tool);
  await child.locator("#paint-status").evaluate((e) => (e.textContent = ""));
  const b = await child.locator("#paint-view canvas").boundingBox();
  await child.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await child.waitForFunction(() =>
    document.querySelector("#paint-status").textContent.includes("已提交"),
  );
  await done(child);
}
async function closeChild(child) {
  await child.locator("#paint-return").click();
  await page.waitForFunction(
    () => document.querySelector("#paint-lease-banner").hidden,
  );
  assert.equal(app.windows().length, 1);
}
// Five visible entries, including hidden and locked canvases, are a management list.
const caseCount = Number(process.env.XH_CANVAS_COUNT ?? 5);
a.canvases = Array.from({ length: caseCount }, (_, i) => i).map((i) => ({
  canvasId: "c" + i,
  name: i === 2 ? "很长的画布名称用于检查截断而不撑破侧栏" : "画布 " + i,
  visible: i !== 3,
  locked: i === 4,
  voxelStepM: i < 3 ? 0.25 : i === 3 ? 0.125 : 0.0625,
  originTicks: [(i === 1 ? 0 : i) * 32, 0, 0],
  cells: [{ x: 0, y: 0, z: 0, color: i % a.palette.length }],
  protectedColumns: [],
}));
if (caseCount === 32) a.canvases[31].cells = [];
a.objects = a.canvases.map((c, i) => ({
  objectId: "o" + i,
  name: c.name,
  canvasIds: [c.canvasId],
  originTicks: [...c.originTicks],
  cellKeys: c.cells.length ? ["0,0,0"] : [],
}));
a.canvases[0].paintSource = {
  schema: "xinghai-surface-paint-1",
  density: 64,
  faces: { "0,0,0,4": { 0: "#abcdef" } },
};
if (a.canvases[1])
  a.canvases[1].faceTone = {
    schema: "xinghai-face-tone-1",
    faces: { "0,0,0,4": { gain: 0.7, affectPaint: false } },
  };
a.objectCollections =
  caseCount >= 3
    ? [{ collectionId: "pair", name: "两件集合", memberIds: ["o0", "o2"] }]
    : [];
await fs.writeFile(path.join(root, source), JSON.stringify(a));

const rows = () => page.locator("#canvas-list .canvas-layer-row"),
  row = (id) => page.locator('#canvas-list [data-canvas-id="' + id + '"]'),
  choose = (id) => row(id).locator(".canvas-layer-select");
async function pick(id, mod) {
  await choose(id).click(mod ? { modifiers: [mod] } : {});
  await page.waitForFunction(
    (id) => document.querySelector("#editview").dataset.canvasId === id,
    id,
  );
}
async function saveData() {
  await page.locator("#workshop-message").evaluate((e) => (e.textContent = ""));
  await page.locator("#save-draft").click();
  await page.getByText("原生资产与试摆草稿已保存", { exact: true }).waitFor();
  return read();
}
if (caseCount !== 5) {
  try {
    await open();
    await page
      .locator("#hierarchy-tabs")
      .getByRole("button", { name: "画布", exact: true })
      .click();
    assert.equal(await rows().count(), caseCount);
    await page
      .locator("#hierarchy-tabs")
      .getByRole("button", { name: "物体与集合", exact: true })
      .click();
    await page.locator('[data-model-object="o0"]').click();
    await page.keyboard.press("Tab");
    await page
      .locator("#hierarchy-tabs")
      .getByRole("button", { name: "画布", exact: true })
      .click();
    assert.equal(await rows().count(), caseCount);
    assert.equal(
      await page.locator("#model-interaction-mode").inputValue(),
      "edit",
    );
    await page.screenshot({ path: root + "/list-" + caseCount + ".png" });
    assert.deepEqual(errors, []);
    console.log("PASS canvas counts in both modes", caseCount, root);
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await app.close().catch(() => {});
  }
  process.exit(0);
}
try {
  await open();
  await page
    .locator("#hierarchy-tabs")
    .getByRole("button", { name: "画布", exact: true })
    .click();
  assert.equal(await rows().count(), 5);
  assert.equal(
    await page.locator("#canvas-target,#canvas-merge-controls").count(),
    0,
  );
  await page.screenshot({ path: root + "/list-five.png" });
  const initial = await saveData();
  await pick("c0");
  await pick("c2", "Control");
  assert.equal(await page.locator(".canvas-layer-row.selected").count(), 2);
  assert(
    (await page.locator("#canvas-selection-summary").textContent()).includes(
      "已选 2",
    ),
  );
  let unchanged = await saveData();
  assert.deepEqual(unchanged, initial, "list selection is not a model edit");
  await page.locator("#canvas-merge").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".canvas-layer-row").length === 4,
  );
  let merged = await saveData();
  assert.equal(
    merged.canvases.find((c) => c.canvasId === "c2").cells.length,
    2,
  );
  assert.deepEqual(merged.anchorM, a.anchorM);
  assert(
    merged.objects.some((o) => o.objectId === "o0") &&
      merged.objects.some((o) => o.objectId === "o2"),
  );
  assert(
    merged.canvases.find((c) => c.canvasId === "c2").paintSource.faces[
      "-8,0,0,4"
    ],
  );
  await page.screenshot({ path: root + "/list-merged.png" });
  await page.keyboard.press("Control+z");
  await page.waitForFunction(
    () => document.querySelectorAll(".canvas-layer-row").length === 5,
  );
  let undone = await saveData();
  assert.deepEqual(undone.canvases, initial.canvases);
  assert.deepEqual(undone.objects, initial.objects);
  await page.screenshot({ path: root + "/list-undo.png" });
  await pick("c2");
  await pick("c0", "Shift");
  assert.equal(await page.locator(".canvas-layer-row.selected").count(), 3);
  await page.screenshot({ path: root + "/list-three-selected.png" });
  await page.locator("#canvas-merge").click();
  await page.locator("dialog[open]").waitFor();
  assert(
    (await page.locator("dialog[open]").textContent()).includes("重叠 1 格"),
  );
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  assert.equal(await rows().count(), 5);
  await page.locator("#canvas-merge").click();
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "合并", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".canvas-layer-row").length === 3,
  );
  merged = await saveData();
  assert.equal(
    merged.canvases
      .find((c) => c.canvasId === "c0")
      .cells.find((v) => v.x === 0).color,
    1,
  );
  assert(
    merged.canvases.find((c) => c.canvasId === "c0").faceTone.faces["0,0,0,4"],
  );
  assert.deepEqual(
    merged.canvases.filter((c) => ["c3", "c4"].includes(c.canvasId)),
    initial.canvases.filter((c) => ["c3", "c4"].includes(c.canvasId)),
  );
  await page.keyboard.press("Control+z");
  await page.waitForFunction(
    () => document.querySelectorAll(".canvas-layer-row").length === 5,
  );
  await page.keyboard.press("Control+Shift+z");
  await page.waitForFunction(
    () => document.querySelectorAll(".canvas-layer-row").length === 3,
  );
  await page.keyboard.press("Control+z");
  await page.waitForFunction(
    () => document.querySelectorAll(".canvas-layer-row").length === 5,
  );
  await pick("c0");
  await pick("c3", "Control");
  const failureBaseline = await saveData();
  await page.locator("#canvas-merge").click();
  await page.waitForFunction(() =>
    document.querySelector("#workshop-message").textContent.includes("精度"),
  );
  assert.deepEqual(await saveData(), failureBaseline);
  await pick("c0");
  await pick("c1", "Control");
  await row("c1").locator("[data-lock]").click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-canvas-id="c1"] [data-lock]')
        .textContent === "🔒",
  );
  assert.equal(await page.locator(".canvas-layer-row.selected").count(), 2);
  await page.locator("#canvas-merge").click();
  await page.waitForFunction(() =>
    document.querySelector("#workshop-message").textContent.includes("锁定"),
  );
  await row("c1").locator("[data-lock]").click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-canvas-id="c1"] [data-lock]')
        .textContent === "◇",
  );
  await page.locator("#canvas-create-menu>summary").click();
  await page.locator("#canvas-step").selectOption("0.125");
  await page.locator("#canvas-add").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".canvas-layer-row").length === 6,
  );
  await page
    .locator(".canvas-list-actions")
    .getByRole("button", { name: "复制", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".canvas-layer-row").length === 7,
  );
  const added = await page.locator("#editview").getAttribute("data-canvas-id");
  await page.locator("#canvas-list").focus();
  await page.keyboard.press("F2");
  await page.locator(".canvas-inline-rename").fill("新命名画布");
  await page.locator(".canvas-inline-rename").press("Control+a");
  await page.locator(".canvas-inline-rename").press("Delete");
  assert.equal(await rows().count(), 7);
  await page.locator(".canvas-inline-rename").fill("新命名画布");
  await page.locator(".canvas-inline-rename").press("Enter");
  await page.waitForFunction(
    (id) =>
      document
        .querySelector('[data-canvas-id="' + id + '"] .canvas-layer-select')
        .textContent.includes("新命名画布"),
    added,
  );
  const from = await choose(added).boundingBox(),
    to = await choose("c0").boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await page.waitForFunction(
    (id) =>
      document.querySelector("#canvas-list").firstElementChild.dataset
        .canvasId === id,
    added,
  );
  assert.equal(
    await page.locator("#editview").getAttribute("data-canvas-id"),
    added,
  );
  await page.locator("#canvas-delete").click();
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "删除", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".canvas-layer-row").length === 6,
  );
  await pick("c2");
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await page.waitForFunction(
    () => document.querySelectorAll(".canvas-layer-row").length === 7,
  );
  await page.locator("#canvas-list").focus();
  await page.keyboard.press("Delete");
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "删除", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".canvas-layer-row").length === 6,
  );
  await pick("c0");
  await pick("c2", "Control");
  await choose("c0").click({ button: "right" });
  await page.locator(".canvas-context-menu").waitFor({ state: "visible" });
  assert.equal(await page.locator(".canvas-layer-row.selected").count(), 2);
  await page.keyboard.press("Escape");
  await choose("c1").click({ button: "right" });
  await page.locator(".canvas-context-menu").waitFor({ state: "visible" });
  assert.equal(await page.locator(".canvas-layer-row.selected").count(), 1);
  assert.equal(
    await page.locator("#editview").getAttribute("data-canvas-id"),
    "c1",
  );
  await page.keyboard.press("Escape");
  await choose("c1").dblclick();
  await page.locator(".canvas-inline-rename").fill("画布一改名");
  await page.locator(".canvas-inline-rename").press("Enter");
  await page.waitForFunction(() =>
    document
      .querySelector('[data-canvas-id="c1"] .canvas-layer-select')
      .textContent.includes("改名"),
  );
  // Internal editing shows all canvases; cross-canvas activation safely returns to object mode.
  await page
    .locator("#hierarchy-tabs")
    .getByRole("button", { name: "物体与集合", exact: true })
    .click();
  await page.locator('[data-model-object="o0"]').click();
  await page.keyboard.press("Tab");
  await page
    .locator("#hierarchy-tabs")
    .getByRole("button", { name: "画布", exact: true })
    .click();
  assert.equal(await rows().count(), 6);
  await pick("c2");
  assert.equal(
    await page.locator("#model-interaction-mode").inputValue(),
    "object",
  );
  await page
    .locator("#hierarchy-tabs")
    .getByRole("button", { name: "物体与集合", exact: true })
    .click();
  await page.locator('[data-model-object="o1"]').click();
  await page
    .locator("#hierarchy-tabs")
    .getByRole("button", { name: "画布", exact: true })
    .click();
  await pick("c1");
  await page.getByRole("button", { name: "自动上色", exact: true }).click();
  await page.locator("#appearance-panel").waitFor({ state: "visible" });
  await choose("c0").click();
  await page
    .locator(".draft-decision")
    .getByRole("button", { name: "返回", exact: true })
    .click();
  assert.equal(
    await page.locator("#editview").getAttribute("data-canvas-id"),
    "c1",
  );
  assert.equal(await page.locator(".canvas-layer-row.selected").count(), 1);
  await page.keyboard.press("Escape");
  const childWait = app.waitForEvent("window");
  await page.locator("#open-paint-window").click();
  const child = await childWait;
  await child.locator("#paint-view[data-surface-paint-mode=paint]").waitFor();
  await choose("c0").click();
  assert.equal(
    await page.locator("#editview").getAttribute("data-canvas-id"),
    "c1",
  );
  await child.locator("#paint-return").click();
  await page.waitForFunction(
    () => document.querySelector("#paint-lease-banner").hidden,
  );
  assert.deepEqual(errors, []);
  const beforeRestart = await saveData();
  await app.evaluate(({ app }) => app.exit(0));
  await app.close().catch(() => {});
  app = await launch();
  await open();
  await page
    .locator("#hierarchy-tabs")
    .getByRole("button", { name: "画布", exact: true })
    .click();
  assert.equal(
    await page.locator("#canvas-list .canvas-layer-row").count(),
    beforeRestart.canvases.length,
  );
  assert.deepEqual(await read(), beforeRestart);
  assert.deepEqual(errors, []);
  console.log(
    "PASS canvas list selection/merge/history/management/draft/lease",
    root,
  );
} catch (e) {
  console.log(
    "ERROR",
    await page.locator("#workshop-message").textContent(),
    errors,
  );
  await page.screenshot({ path: root + "/list-error.png" });
  throw e;
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
}
