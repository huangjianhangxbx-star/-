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
try {
  await open();
  for (let i = 0; i < 3; i++) {
    if (i) await page.locator("#model-interaction-mode").selectOption("object");
    await page.locator(`[data-model-object="o${i}"]`).click();
    await page.keyboard.press("Tab");
    await page.waitForFunction(
      () => document.querySelector("#model-interaction-mode").value === "edit",
    );
    await page.locator("#home").click();
    await page.locator("#surface-paint-mode").selectOption("paint");
    await view("top");
    const at = await center();
    await color("#d93045");
    await page.locator("#surface-paint-tool").selectOption("fill");
    await page.mouse.click(at.x, at.y);
    let saved = await save();
    const n = [16, 8, 4][i];
    assert.equal(
      Object.keys(saved.canvases[i].paintSource.faces["0,0,0,4"]).length,
      n * n,
    );
    assert.deepEqual(
      saved.canvases.map((c) => c.cells),
      a.canvases.map((c) => c.cells),
    );
    assert.deepEqual(saved.palette, a.palette);
    if (i === 0) {
      await page.keyboard.press("Control+z");
      saved = await save();
      assert.equal(
        Object.keys(saved.canvases[0].paintSource?.faces ?? {}).length,
        0,
      );
      await page.keyboard.press("Control+Shift+z");
      saved = await save();
      assert.equal(
        Object.keys(saved.canvases[0].paintSource.faces["0,0,0,4"]).length,
        256,
      );
      await page.locator("#surface-paint-tool").selectOption("erase");
      await page.mouse.click(at.x, at.y);
      saved = await save();
      assert.equal(
        Object.keys(saved.canvases[0].paintSource.faces["0,0,0,4"]).length,
        255,
      );
      await page.keyboard.press("Control+z");
      await save();
      await color("#000000");
      await page.locator("#surface-paint-tool").selectOption("pick");
      await page.mouse.click(at.x, at.y);
      assert.equal(await page.locator("#color").inputValue(), "#d93045");
      await page.locator("#surface-paint-tool").selectOption("brush");
      await color("#35bd74");
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await page.mouse.move(at.x + 8, at.y + 8);
      assert.ok(
        await page
          .locator("#editview")
          .getAttribute("data-paint-preview-pixels"),
      );
      await page.keyboard.press("Escape");
      await page.mouse.up();
      saved = await save();
      assert.ok(
        Object.values(saved.canvases[0].paintSource.faces["0,0,0,4"]).every(
          (c) => c === "#d93045",
        ),
      );
    }
    for (const [axis, face] of [
      ["right", 0],
      ["left", 1],
      ["back", 2],
      ["front", 3],
      ["bottom", 5],
    ]) {
      await view(axis);
      const at = await center();
      await page.locator("#surface-paint-tool").selectOption("brush");
      await color("#35bd74");
      await page.mouse.click(at.x, at.y);
      saved = await save();
      assert.ok(
        Object.values(
          saved.canvases[i].paintSource.faces[`0,0,0,${face}`] ?? {},
        ).includes("#35bd74"),
        `real ${axis} surface painted at precision ${i}`,
      );
    }
  }
  const before = await save();
  await page.screenshot({ path: "validation/surface-paint-edit.png" });
  await page.locator("#model-interaction-mode").selectOption("object");
  await page.locator('[data-model-object="o0"]').click();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  let copied = await save();
  assert.ok(copied.objects.length > 3);
  assert.ok(
    Object.keys(copied.canvases[0].paintSource.faces).length > 6,
    "object copy carries texture",
  );
  await page.keyboard.press("Control+z");
  await save();
  await page.locator('[data-workspace="assembly"]').click();
  await page.screenshot({ path: "validation/surface-paint-scene.png" });
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  app = await launch();
  await open();
  const reopened = await read();
  assert.deepEqual(
    reopened.canvases.map((c) => c.paintSource),
    before.canvases.map((c) => c.paintSource),
  );
  if (v2) {
    const portable = path.join(root, "彩绘.xhasset");
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, portable);
    await page.locator("#canvas-export-source").click();
    await page.getByText(/已导出可编辑源与预览/).waitFor();
    assert.ok((await fs.stat(portable)).size > 1000);
    const other = await fs.mkdtemp(
      path.resolve("validation/surface-paint-import-"),
    );
    await fs.writeFile(
      path.join(other, "project.xhproject.json"),
      JSON.stringify({ ...p2, projectId: "other", assets: [], scenes: [] }),
    );
    await page.locator('[data-workspace="project"]').click();
    await app.evaluate(({ dialog }, dir) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [dir],
      });
    }, other);
    await page.getByRole("button", { name: "打开项目", exact: true }).click();
    await page.getByText("项目级资产库已打开", { exact: true }).waitFor();
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, portable);
    await page
      .getByRole("button", { name: "导入便携源", exact: true })
      .first()
      .click();
    await page.getByText("便携源已导入为新资产", { exact: true }).waitFor();
    const importedProject = JSON.parse(
      await fs.readFile(path.join(other, "project.xhproject.json"), "utf8"),
    );
    const importedPath = path.join(other, importedProject.assets[0].source),
      imported = JSON.parse(await fs.readFile(importedPath, "utf8"));
    assert.notEqual(imported.assetId, "a");
    assert.deepEqual(
      imported.canvases.map((c) => c.paintSource),
      before.canvases.map((c) => c.paintSource),
    );
    await page.locator('[data-model-object="o0"]').click();
    await page.keyboard.press("Tab");
    await page.locator("#home").click();
    await page.locator("#surface-paint-mode").selectOption("paint");
    await view("top");
    await color("#2244ff");
    const at = await center();
    await page.mouse.click(at.x, at.y);
    await page.keyboard.press("Control+s");
    await page.getByText("原生资产与试摆草稿已保存", { exact: true }).waitFor();
    const repainted = JSON.parse(await fs.readFile(importedPath, "utf8"));
    assert.ok(
      Object.values(
        repainted.canvases[0].paintSource.faces["0,0,0,4"],
      ).includes("#2244ff"),
    );
    assert.deepEqual(
      (await read()).canvases.map((c) => c.paintSource),
      before.canvases.map((c) => c.paintSource),
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Surface painting realUI sixfaces/threeprecisions/history/erase/pick/cancel/copy/save/reopen passed",
    v2 ? "V2" : "V1",
    root,
  );
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
}
