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
  await child.locator(`[data-paint-tool="${tool}"]`).click();
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
try {
  await open();
  const metrics = [];
  for (let i = 0; i < 3; i++) {
    const child = await openChild("o" + i);
    assert.equal(
      await child.evaluate(() => typeof window.workbench),
      "undefined",
    );
    const invalid = await child.evaluate(async () => {
      try {
        await window.paintClient.command({ leaseId: "wrong", kind: "paint" });
        return false;
      } catch {
        return true;
      }
    });
    assert(invalid);
    if (i === 0) {
      await page.locator("[data-workspace=project]").click();
      await page.getByRole("button", { name: "打开项目", exact: true }).click();
      await page.locator(".project-switch-dialog").waitFor();
      await page
        .locator(".project-switch-dialog")
        .getByRole("button", { name: "取消", exact: true })
        .click();
      assert.equal(app.windows().length, 2);
      await page.locator("[data-workspace=module]").evaluate((e) => e.click());
    }
    await stroke(child, "top", "fill", "#ffffff");
    let saved = await childSave(child);
    const face = saved.canvases[i].paintSource.faces["0,0,0,4"];
    assert.equal(Object.keys(face).length, [256, 64, 16][i]);
    await child.locator("#paint-undo").click();
    await done(child);
    saved = await childSave(child);
    assert.equal(
      Object.keys(saved.canvases[i].paintSource?.faces ?? {}).length,
      0,
    );
    await child.locator("#paint-redo").click();
    await done(child);
    await stroke(child, "top", "erase");
    saved = await childSave(child);
    assert.equal(
      Object.keys(saved.canvases[i].paintSource.faces["0,0,0,4"]).length,
      [255, 63, 15][i],
    );
    for (const [axis, face] of [
      ["right", 0],
      ["left", 1],
      ["back", 2],
      ["front", 3],
      ["bottom", 5],
    ]) {
      await stroke(child, axis);
      saved = await childSave(child);
      assert(
        Object.values(
          saved.canvases[i].paintSource.faces["0,0,0," + face],
        ).includes("#35bd74"),
      );
    }
    if (i === 0) {
      await stroke(child, "right", "brush", "#ff6633");
      const dir = path.join(root, path.dirname(source));
      await fs.rename(dir, dir + ".backup");
      await fs.writeFile(dir, "save-failure-fixture");
      try {
        await child.locator("#paint-save").click();
        await done(child);
        assert.notEqual(
          await child.locator("#paint-status").textContent(),
          "项目已保存",
        );
        assert.equal(app.windows().length, 2);
      } finally {
        await fs.unlink(dir);
        await fs.rename(dir + ".backup", dir);
        await child.locator("#paint-discard").click();await done(child);
      }
      await app.evaluate(({ dialog, BrowserWindow }) => {
        globalThis.closePromptCount = 0;
        dialog.showMessageBox = async () => {
          globalThis.closePromptCount++;
          return { response: 0 };
        };
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith("/workshop.html"))
          .close();
      });
      await app.evaluate(async () => {
        for (let n = 0; n < 100 && !globalThis.closePromptCount; n++)
          await new Promise((r) => setTimeout(r, 10));
        if (!globalThis.closePromptCount) throw Error("no close prompt");
      });
      assert.equal(app.windows().length, 2);
      await childSave(child);
    }
    await child.screenshot({ path: root + "/paint-window-" + i + ".png" });
    await closeChild(child);
    metrics.push(
      await app.evaluate(({ app }) =>
        app
          .getAppMetrics()
          .map((m) => ({ type: m.type, memory: m.memory.workingSetSize })),
      ),
    );
  }
  // Repeated opening focuses the same client. Reopening restores authoritative paint.
  for (let i = 0; i < 2; i++) {
    const child = await openChild("o0");
    await page.locator("#open-paint-window").evaluate((e) => e.click());
    assert.equal(app.windows().length, 2);
    await closeChild(child);
    metrics.push(
      await app.evaluate(({ app }) =>
        app
          .getAppMetrics()
          .map((m) => ({ type: m.type, memory: m.memory.workingSetSize })),
      ),
    );
  }
  const crashed = await openChild("o0");
  await stroke(crashed, "top", "brush", "#1177ee");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().endsWith("/paint-workspace.html"))
      .webContents.forcefullyCrashRenderer(),
  );
  await page.waitForFunction(
    () => document.querySelector("#paint-lease-banner").hidden,
  );
  await save();
  assert(
    Object.values(
      (await read()).canvases[0].paintSource.faces["0,0,0,4"],
    ).includes("#1177ee"),
  );
  const recovered = await openChild("o0");
  await closeChild(recovered);
  // Main modeling works again after releasing the writer; its stroke remains reversible.
  await page.locator("#top").click();
  await page.locator("#brush-current").click();
  const box = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(box.x + box.width * 0.88, box.y + box.height * 0.82);
  await save();
  let modeled = await read();
  assert.equal(modeled.canvases[0].cells.length, 2);
  await page.keyboard.press("Control+z");
  await save();
  await save();
  let saved = await read();
  assert.deepEqual(
    saved.canvases.map((c) => c.cells),
    a.canvases.map((c) => c.cells),
  );
  const persisted = structuredClone(saved);
  await app.evaluate(({ app }) => app.exit(0));
  await app.close().catch(() => {});
  app = await launch();
  await open();
  const child = await openChild("o0");
  await childSave(child);
  saved = await read();
  assert.deepEqual(saved.canvases, persisted.canvases);
  assert.equal(saved.assetId, persisted.assetId);
  await closeChild(child);
  assert.deepEqual(errors, []);
  await fs.writeFile(root + "/metrics.json", JSON.stringify(metrics, null, 2));
  console.log(
    "PASS child six faces / three precisions, erase, undo redo, invalid lease, five reopen, actual process restart",
    root,
  );
} catch (e) {
  console.log(
    "ERR",
    errors,
    await page.locator("#workshop-message").textContent(),
  );
  for (const w of app.windows()) {
    console.log(await w.locator("body").innerText());
    console.log(
      await w
        .locator("#paint-view")
        .evaluate((e) => ({ ...e.dataset }))
        .catch(() => null),
    );
    await w.screenshot({
      path: root + "/failure-" + app.windows().indexOf(w) + ".png",
    });
  }
  throw e;
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
}
