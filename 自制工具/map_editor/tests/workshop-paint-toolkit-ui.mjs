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
for (const canvas of a.canvases) {
  canvas.cells = [];
  for (let x = -4; x <= 4; x++)
    for (let z = 0; z <= 6; z++) {
      if (!(Math.abs(x) <= 1 && z < 4))
        canvas.cells.push({ x, y: 0, z, color: 0 });
      canvas.cells.push({ x, y: 2, z, color: 0 });
    }
  for (let y = 1; y < 2; y++)
    for (let z = 0; z <= 6; z++) canvas.cells.push({ x: 4, y, z, color: 0 });
}
a.objects = a.canvases.map((c, i) => ({
  objectId: "o" + i,
  name: "门洞 " + i,
  canvasIds: [c.canvasId],
  originTicks: [...c.originTicks],
  cellKeys: c.cells.map((p) => [p.x, p.y, p.z].join(",")),
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

async function tool(child, name) {
  await child.locator(`[data-paint-tool="${name}"]`).click();
}
async function point(child, want) {
  const result = await child.locator("#paint-view > canvas").evaluate(
    (canvas, predicate) => {
      const r = canvas.getBoundingClientRect();
      for (let y = r.y + 30; y < r.bottom - 20; y += 20)
        for (let x = r.x + 25; x < r.right - 20; x += 20) {
          canvas.dispatchEvent(
            new PointerEvent("pointermove", {
              clientX: x,
              clientY: y,
              buttons: 0,
              bubbles: true,
            }),
          );
          const hit = document.querySelector("#paint-view").dataset.paintHit;
          if (hit && hit.startsWith(predicate)) return { x, y, hit };
        }
      return null;
    },
    want.toString().match(/startsWith\(["']([^"']+)["']\)/)[1],
  );
  if (!result) throw Error("requested real surface not found");
  await child.mouse.move(result.x, result.y);
  return result;
}
async function toolkitStroke(child, a, b = a) {
  await child.mouse.move(a.x, a.y);
  await child.mouse.down();
  await child.mouse.move(b.x, b.y, { steps: 8 });
  await child.mouse.up();
}
try {
  await open();
  const child = await openChild("o0");
  await child.setViewportSize({ width: 1500, height: 940 });
  await child.locator("[data-ortho=front]").click();
  const wheelPixel = await child
    .locator("#paint-wheel")
    .evaluate((c) => [...c.getContext("2d").getImageData(169, 92, 1, 1).data]);
  console.log(
    "wheel",
    wheelPixel,
    await child.locator("#paint-wheel").evaluate((c) => [c.width, c.height]),
  );
  assert.ok(wheelPixel[3] > 0, "colour wheel drawn");
  const original = await read();
  await child.locator("#paint-hex").fill("#ab7850");
  await child.locator("#paint-hex").dispatchEvent("change");
  assert.equal(await child.locator("#paint-color").inputValue(), "#ab7850");
  await childSave(child);
  assert.deepEqual(
    (await read()).canvases,
    original.canvases,
    "colour selection is view-only",
  );
  await child.locator("#paint-size-voxel").click();
  assert.equal(await child.locator("#surface-paint-size").inputValue(), "16");
  const left = await point(child, (h) => h.startsWith("-3,0,1,3:")),
    right = await point(child, (h) => h.startsWith("3,0,1,3:"));
  await child.keyboard.down("Alt");
  await child.mouse.click(left.x, left.y);
  await child.keyboard.up("Alt");
  assert.equal(
    await child.locator("#paint-hex").inputValue(),
    original.palette[0],
    "Alt temporarily samples author raw colour",
  );
  assert.equal(
    await child.locator("#surface-paint-tool").inputValue(),
    "brush",
  );
  await child.locator("#paint-hex").fill("#ab7850");
  await child.locator("#paint-hex").dispatchEvent("change");
  await tool(child, "line");
  await toolkitStroke(child, left, right);
  await childSave(child);
  let model = await read();
  assert.ok(
    Object.keys(model.canvases[0].paintSource.faces).some((k) =>
      k.startsWith("-2,0,"),
    ),
  );
  assert.ok(
    Object.keys(model.canvases[0].paintSource.faces).every(
      (k) => k.split(",")[1] === "0",
    ),
    "line never touches rear wall through opening",
  );
  await child.locator("#paint-undo").click();
  await done(child);
  await childSave(child);
  assert.deepEqual(
    (await read()).canvases[0].paintSource,
    original.canvases[0].paintSource,
  );
  await child.locator("#paint-symmetry summary").click();
  await child
    .locator("#paint-symmetry .symmetry-center")
    .fill("0.125,0.125,0.875");
  await child.locator("#paint-symmetry [data-symmetry=apply]").click();
  await child.locator('#paint-symmetry [data-axis="0"]').check();
  await tool(child, "brush");
  await child.locator("#paint-size-number").fill("2");
  await child.locator("#paint-size-number").dispatchEvent("input");
  await toolkitStroke(child, left);
  await childSave(child);
  model = await read();
  const faces = model.canvases[0].paintSource.faces;
  assert.ok(faces["-3,0,1,3"]);
  assert.ok(faces["3,0,1,3"], "author-space mirror writes counterpart");
  const beforeRapid = await childSave(child);
  await app.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith("/workshop.html"),
      ),
      send = main.webContents.send.bind(main.webContents);
    globalThis.tool015Delay = true;
    main.webContents.send = (channel, ...args) => {
      if (
        globalThis.tool015Delay &&
        channel === "paint:authority" &&
        args[0]?.type === "command"
      )
        setTimeout(() => send(channel, ...args), 120);
      else send(channel, ...args);
    };
  });
  const rapidColors = ["#704020", "#306080", "#406030", "#803050"];
  for (let batch = 0; batch < 5; batch++) {
    for (let i = 0; i < 4; i++) {
      await child.locator("#paint-hex").fill(rapidColors[i]);
      await child.locator("#paint-hex").dispatchEvent("change");
      await toolkitStroke(child, left);
    }
    await done(child);
  }
  await app.evaluate(() => (globalThis.tool015Delay = false));
  const afterRapid = await childSave(child);
  assert.equal(
    afterRapid.revision,
    beforeRapid.revision + 20,
    "20 accepted gestures produce 20 ordered revisions",
  );
  assert.equal(
    afterRapid.canvases[0].paintSource.faces[left.hit.split(":")[0]][
      left.hit.split(":")[1]
    ],
    rapidColors[3],
  );
  await tool(child, "select");
  await toolkitStroke(child, left);
  await child.locator("[data-selection=connected]").click();
  await tool(child, "fill");
  await child.locator("#paint-fill-range").selectOption("selection");
  await toolkitStroke(child, left);
  await childSave(child);
  assert.ok(
    Object.keys((await read()).canvases[0].paintSource.faces).every(
      (k) => k.split(",")[1] === "0",
    ),
  );
  await child.screenshot({ path: root + "/toolkit-1500.png" });
  await child.setViewportSize({ width: 1280, height: 800 });
  await child.screenshot({ path: root + "/toolkit-1280.png" });
  await child.locator("[data-selection=clear]").click();
  await child.locator('#paint-symmetry [data-axis="0"]').uncheck();
  await tool(child, "rectangle");
  await child.locator("#paint-shape-filled").check();
  await toolkitStroke(child, left, right);
  await child.keyboard.press("Escape");
  await tool(child, "ellipse");
  const p = await point(child, (h) => h.startsWith("-3,0,1,3:"));
  await toolkitStroke(child, p);
  await childSave(child);
  const beforeCancel = await childSave(child);
  await tool(child, "rectangle");
  const cancelPoint = await point(child, (h) => h.startsWith("-3,0,1,3:"));
  await child.mouse.move(cancelPoint.x, cancelPoint.y);
  await child.mouse.down();
  await child.mouse.move(cancelPoint.x + 40, cancelPoint.y - 40);
  await child.keyboard.press("Escape");
  await child.mouse.up();
  await childSave(child);
  assert.deepEqual(
    (await read()).canvases,
    beforeCancel.canvases,
    "cancelled shape never writes",
  );
  await tool(child, "polyline");
  await child.locator("#paint-hex").fill("#456789");
  await child.locator("#paint-hex").dispatchEvent("change");
  const polyPoint = await point(child, (h) => h.startsWith("-3,0,1,3:"));
  await child.mouse.click(polyPoint.x, polyPoint.y);
  await child.locator("#paint-save").click();
  assert.match(await child.locator("#paint-status").textContent(), /先结束/);
  assert.ok(
    await child
      .locator("#paint-view")
      .getAttribute("data-paint-preview-pixels"),
    "save retains active shape preview",
  );
  await child.mouse.click(polyPoint.x + 25, polyPoint.y - 25);
  await child.keyboard.press("Enter");
  await childSave(child);
  assert.ok(
    Object.values((await read()).canvases[0].paintSource.faces).some((f) =>
      Object.values(f).includes("#456789"),
    ),
    "polyline writes once on Enter",
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().endsWith("/paint-workspace.html"))
      .webContents.setZoomFactor(1.25),
  );
  await child.locator("#paint-wheel").scrollIntoViewIfNeeded();
  await child.screenshot({ path: root + "/toolkit-125percent.png" });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().endsWith("/paint-workspace.html"))
      .webContents.setZoomFactor(1),
  );
  const beforeClose = await childSave(child);
  await tool(child, "brush");
  const closePoint = await point(child, (h) => h.startsWith("-3,0,1,3:"));
  await app.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith("/workshop.html"),
      ),
      send = main.webContents.send.bind(main.webContents);
    main.webContents.send = (channel, ...args) => {
      if (channel === "paint:authority" && args[0]?.type === "command")
        setTimeout(() => send(channel, ...args), 500);
      else send(channel, ...args);
    };
  });
  for (const color of ["#123001", "#123002", "#123003", "#123004"]) {
    await child.locator("#paint-hex").fill(color);
    await child.locator("#paint-hex").dispatchEvent("change");
    await toolkitStroke(child, closePoint);
  }
  await page.evaluate(() => window.workbench.workshop.paintClose());
  assert.equal(
    app.windows().length,
    1,
    "parent close waits until the painting queue drains and child closes",
  );

  await page.waitForFunction(
    () => document.querySelector("#paint-lease-banner").hidden,
  );
  const closedSaved = await save();
  assert.equal(
    closedSaved.revision,
    beforeClose.revision + 4,
    "parent close retains all four queued strokes",
  );
  await page.locator("#model-interaction-mode").selectOption("edit");
  await page.locator("#viewport-mode-menu summary").click();
  await page.locator('[data-mode="stack"]').click();
  await page.locator("#viewport-brush-menu summary").click();
  await page.locator('[data-tool="brush"]').click();
  await page.locator("#brush-size").fill("1");
  await page.locator(".symmetry-controls summary").click();
  assert.equal(
    await page.locator(".symmetry-controls .symmetry-center").inputValue(),
    "0.125,0.125,0.875",
    "validated symmetry centre is shared between windows",
  );
  await page
    .locator(".symmetry-controls .symmetry-center")
    .fill("0.125,0.125,0.875");
  await page.locator(".symmetry-controls [data-symmetry=apply]").click();
  await page.locator('.symmetry-controls [data-axis="0"]').check();

  await page.locator('[data-ortho="front"]').click();
  const beforeModel = await save();
  const canvas = page.locator("#editview > canvas");
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width * 0.33, box.y + box.height * 0.5);
  const afterModel = await save();
  assert.equal(
    afterModel.canvases[0].cells.length - beforeModel.canvases[0].cells.length,
    2,
  );
  const oldKeys = new Set(
      beforeModel.canvases[0].cells.map((c) => [c.x, c.y, c.z].join(",")),
    ),
    added = afterModel.canvases[0].cells.filter(
      (c) => !oldKeys.has([c.x, c.y, c.z].join(",")),
    );
  assert.equal(added[0].x, -added[1].x);
  assert.equal(added[0].y, added[1].y);
  await page.keyboard.press("Control+z");
  const undoModel = await save();
  assert.deepEqual(undoModel.canvases, beforeModel.canvases);
  await page.keyboard.press("Control+Shift+z");
  const redoModel = await save();
  assert.deepEqual(redoModel.canvases, afterModel.canvases);
  assert.deepEqual(errors, []);
  console.log(
    "PASS TOOL015 actual colour/size/cross-hole line/mirror/selection/fill/tools",
    root,
  );
} catch (e) {
  console.error("toolkit failed", errors);
  for (const w of app.windows())
    await w
      .screenshot({
        path: root + "/error-" + app.windows().indexOf(w) + ".png",
      })
      .catch(() => {});
  throw e;
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
}
