import { launchWorkshop } from "./workshop-launch.mjs";
import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
const v2 = !!process.env.XH_TEST_PROJECT_V2,
  root = await fs.mkdtemp(path.resolve("validation/scene-join-"));
const a = core.createAsset("a");
a.name = "墙体";
a.cells = [
  { x: 0, y: 0, z: 0, color: 0 },
  { x: 1, y: 0, z: 0, color: 1 },
];
const b = core.createAsset("b");
b.name = "细格";
b.schema = "xinghai-workshop-asset-2";
b.cells = [];
b.canvases = [
  {
    canvasId: "fine",
    name: "fine",
    visible: true,
    locked: false,
    voxelStepM: 0.125,
    originTicks: [0, 0, 0],
    cells: [{ x: 0, y: 0, z: 0, color: 2 }],
    protectedColumns: [],
  },
];
b.anchorM = [0.125, 0, 0];
const scene = core.createScene("s");
scene.name = "合并测试";
scene.assets = [a, b].map((a) => ({
  kind: "voxel",
  assetId: a.assetId,
  source: `assets/${a.assetId}.xhmodule.json`,
}));
scene.instances = [
  {
    instanceId: "i0",
    assetId: "a",
    positionM: [0, 0, 0],
    rotationDeg: 0,
    groupId: "base",
  },
  {
    instanceId: "i1",
    assetId: "a",
    positionM: [1, 0, 0],
    rotationDeg: 0,
    groupId: "base",
  },
  {
    instanceId: "i2",
    assetId: "b",
    positionM: [0.5, 0.125, 0],
    rotationDeg: 90,
    groupId: "base",
  },
];
const project = v2
  ? {
      schema: "xinghai-workshop-project-2",
      projectId: "p",
      revision: 0,
      name: "合并测试",
      assets: [a, b].map((a) => ({
        kind: "voxel",
        assetId: a.assetId,
        name: a.name,
        revision: 0,
        preview: null,
        source: `assets/${a.assetId}/asset.xhmodule.json`,
      })),
      scenes: [
        {
          sceneId: "s",
          name: scene.name,
          revision: 0,
          source: "scenes/s/scene.xhscene.json",
          preview: null,
        },
      ],
    }
  : core.createProject("p");
if (!v2)
  project.scenes = [
    { sceneId: "s", name: scene.name, source: "scenes/s/scene.xhscene.json" },
  ];
const source = (id) =>
  v2
    ? `assets/${id}/asset.xhmodule.json`
    : `scenes/s/assets/${id}.xhmodule.json`;
const { assets, ...scene2 } = scene;
for (const [file, doc] of [
  ["project.xhproject.json", project],
  [
    "scenes/s/scene.xhscene.json",
    v2 ? { ...scene2, schema: "xinghai-workshop-scene-2" } : scene,
  ],
  ...[a, b].map((a) => [source(a.assetId), a]),
]) {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), JSON.stringify(doc));
}
const profile = await fs.mkdtemp(
  path.join(await fs.realpath(os.tmpdir()), "xh-join-profile-"),
);
const launch = () =>
  process.env.XH_ELECTRON_EXECUTABLE
    ? electron.launch({
        args: ["--workspace=workshop", "--test-hidden"],
        env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
        executablePath: process.env.XH_ELECTRON_EXECUTABLE,
      })
    : electron.launch({
        args: [".", "--workspace=workshop", "--test-hidden"],
        env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
        executablePath: "node_modules/electron/dist/electron.exe",
      });
let app = await launch();
const errors = [];
async function open() {
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
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
  return page;
}
try {
  let page = await open();
  const count = async (n) => {
    await page.waitForFunction(
      (n) => document.querySelectorAll("[data-instance]").length === n,
      n,
    );
  };
  const save = async () => {
    await page
      .locator("#workshop-message")
      .evaluate((e) => (e.textContent = ""));
    await page.keyboard.press("Control+s");
    try {
      await page
        .getByText(v2 ? "原生资产与试摆草稿已保存" : "草稿已保存", {
          exact: true,
        })
        .waitFor();
    } catch (error) {
      console.error(
        "save diagnostics",
        await page.evaluate(() => ({
          message: document.querySelector("#workshop-message")?.textContent,
          footer: document.querySelector("#message")?.textContent,
        })),
        errors,
      );
      throw error;
    }
    return JSON.parse(
      await fs.readFile(path.join(root, "scenes/s/scene.xhscene.json"), "utf8"),
    );
  };
  await count(3);
  await page.locator('[data-instance="i0"]').click();
  await page.locator('[data-instance="i1"]').click({ modifiers: ["Shift"] });
  await page.keyboard.press("Control+j");
  await count(2);
  let saved = await save(),
    joined = saved.instances.find((i) => i.instanceId !== "i2");
  assert.ok(joined);
  let merged = JSON.parse(
    await fs.readFile(path.join(root, source(joined.assetId)), "utf8"),
  );
  assert.equal(merged.canvases.length, 1);
  assert.equal(merged.canvases[0].cells.length, 4);
  assert.equal(merged.objects.length, 1);
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(root, source("a")), "utf8")).cells,
    a.cells,
  );
  await page.keyboard.press("Control+d");
  await count(3);
  await page.keyboard.press("Control+z");
  await count(2);
  await page.keyboard.press("Control+z");
  await count(3);
  assert.equal(await page.locator('[data-instance="i0"]').count(), 1);
  await page.keyboard.press("Control+Shift+z");
  await count(2);
  await page.locator(`[data-instance="${joined.instanceId}"]`).click();
  await page.locator('[data-instance="i2"]').click({ modifiers: ["Shift"] });
  await page.keyboard.press("Control+j");
  await count(1);
  await page.keyboard.press("Control+z");
  await count(2);
  await page.keyboard.press("Control+z");
  await count(3);
  const undone = await save();
  if (!v2)
    assert.equal(
      undone.assets.length,
      4,
      "all generated assets remain registered after repeated undo",
    );
  else
    assert.equal(
      JSON.parse(
        await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
      ).assets.length,
      4,
    );
  await page.keyboard.press("Control+Shift+z");
  await count(2);
  await page.keyboard.press("Control+Shift+z");
  await count(1);
  saved = await save();
  joined = saved.instances[0];
  merged = JSON.parse(
    await fs.readFile(path.join(root, source(joined.assetId)), "utf8"),
  );
  assert.deepEqual(
    merged.canvases.map((c) => c.voxelStepM).sort(),
    [0.125, 0.25],
  );
  assert.equal(
    merged.canvases.reduce((n, c) => n + c.cells.length, 0),
    5,
  );
  await page.locator(`[data-instance="${joined.instanceId}"]`).click();
  await page.locator("#assembly-edit").click();
  await page.locator("[data-model-object]").first().click();
  await page.keyboard.press("Tab");
  await page.waitForFunction(
    () => document.querySelector("#model-interaction-mode").value === "edit",
  );
  await page.locator("#top").click();
  await page.locator("#brush-current").click();
  const box = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForFunction(
    () => document.querySelector("#count")?.textContent === "体素 5",
  );
  await save();
  const edited = JSON.parse(
    await fs.readFile(path.join(root, source(joined.assetId)), "utf8"),
  );
  assert.ok(
    edited.canvases.reduce((n, c) => n + c.cells.length, 0) > 5,
    "joined asset remains editable",
  );
  await page.locator('[data-workspace="assembly"]').click();
  await count(1);
  await page.screenshot({
    path: `validation/scene-join-${v2 ? "v2" : "v1"}.png`,
  });
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  app = await launch();
  page = await open();
  await count(1);
  assert.equal(
    await page.locator(`[data-instance="${joined.instanceId}"]`).count(),
    1,
  );
  assert.deepEqual(errors, []);
  console.log("Scene join UI passed", v2 ? "V2" : "V1", root);
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
}
