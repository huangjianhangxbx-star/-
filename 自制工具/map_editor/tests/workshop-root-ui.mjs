import { launchWorkshop } from "./workshop-launch.mjs";
import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
const root = await fs.mkdtemp(path.resolve("validation/root-placement-"));
const p = core.createProject("p"),
  s = core.createScene("s"),
  a = core.createAsset("a");
a.name = "空心门洞";
a.schema = "xinghai-workshop-asset-2";
a.canvases = [
  {
    canvasId: "fine",
    name: "偏移细格",
    visible: true,
    locked: false,
    voxelStepM: 0.125,
    originTicks: [16, -8, 4],
    cells: [
      { x: 0, y: 0, z: 0, color: 0 },
      { x: 4, y: 0, z: 0, color: 1 },
      { x: 0, y: 4, z: 0, color: 2 },
      { x: 4, y: 4, z: 0, color: 0 },
    ],
    protectedColumns: [],
  },
];
s.assets = [
  { kind: "voxel", assetId: a.assetId, source: "assets/a.xhmodule.json" },
];
s.instances = [
  {
    instanceId: "i",
    assetId: a.assetId,
    positionM: [0, 0, 0],
    rotationDeg: 0,
    groupId: "base",
  },
];
p.scenes = [
  { sceneId: "s", name: "根点测试", source: "scenes/s/scene.xhscene.json" },
];
await fs.mkdir(path.join(root, "scenes/s/assets"), { recursive: true });
for (const [file, doc] of [
  ["project.xhproject.json", p],
  ["scenes/s/scene.xhscene.json", s],
  ["scenes/s/assets/a.xhmodule.json", a],
])
  await fs.writeFile(path.join(root, file), JSON.stringify(doc));
const profile = await fs.mkdtemp(
  path.join(await fs.realpath(os.tmpdir()), "xh-root-profile-"),
);
const launch = () =>
  process.env.XH_ELECTRON_EXECUTABLE
    ? electron.launch({
        args: ["--workspace=workshop", "--test-hidden"],
        env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
        executablePath: process.env.XH_ELECTRON_EXECUTABLE,
      })
    : launchWorkshop();
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
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  await page.locator('[data-instance="i"]').click();
  await page.locator("#assembly-edit").click();
  return page;
}
try {
  let page = await open();
  const menu = () => page.locator("#module-root-menu");
  await menu().waitFor();
  async function showMenu() {
    if (!((await menu().getAttribute("open")) !== null))
      await menu().locator("summary").click();
  }
  async function save() {
    await page
      .locator("#workshop-message")
      .evaluate((e) => (e.textContent = ""));
    await page.keyboard.press("Control+s");
    await page.getByText("草稿已保存", { exact: true }).waitFor();
    return JSON.parse(
      await fs.readFile(
        path.join(root, "scenes/s/assets/a.xhmodule.json"),
        "utf8",
      ),
    );
  }
  await showMenu();
  await page.locator("#module-root-bottom").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#module-root").value === "0.8125,0.0625,0.125",
  );
  assert.equal(
    await page.locator("#editview").getAttribute("data-asset-root"),
    "0.625,0.625,0",
  );
  let saved = await save();
  assert.deepEqual(saved.anchorM, [0.8125, 0.0625, 0.125]);
  assert.deepEqual(saved.canvases[0].cells, a.canvases[0].cells);
  const objects = structuredClone(saved.objects);
  await page.keyboard.press("Control+z");
  await page.waitForFunction(
    () => document.querySelector("#module-root").value === "0,0,0",
  );
  await page.keyboard.press("Control+Shift+z");
  await page.waitForFunction(
    () =>
      document.querySelector("#module-root").value === "0.8125,0.0625,0.125",
  );
  await showMenu();
  await page.locator("#module-root-face").selectOption("right");
  await page.locator('[data-root-u="0"][data-root-v="1"]').click();
  await page.waitForFunction(
    () => document.querySelector("#module-root").value === "1.125,-0.25,0.25",
  );
  for (const [face, want] of [
    ["bottom", [0.8125, 0.0625, 0.125]],
    ["top", [0.8125, 0.0625, 0.25]],
    ["front", [0.8125, -0.25, 0.1875]],
    ["back", [0.8125, 0.375, 0.1875]],
    ["left", [0.5, 0.0625, 0.1875]],
    ["right", [1.125, 0.0625, 0.1875]],
  ]) {
    await showMenu();
    await page.locator("#module-root-face").selectOption(face);
    await page.locator('[data-root-u="0.5"][data-root-v="0.5"]').click();
    await page.waitForFunction(
      (w) => document.querySelector("#module-root").value === w,
      want.join(","),
    );
  }
  await showMenu();
  await page.locator("#module-root-snap").selectOption("vertex");
  await page.locator("#module-root-bottom").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#module-root").value === "0.8125,0.0625,0.125",
  );
  await showMenu();
  await page.screenshot({ path: "validation/root-menu.png" });
  await page.locator("#module-root").fill("0.713,0.017,0.125");
  await page.locator("#module-root-apply").click();
  saved = await save();
  assert.equal(saved.rootMode, "free");
  assert.deepEqual(saved.anchorM, [0.713, 0.017, 0.125]);
  assert.deepEqual(saved.objects, objects);
  // Root placement must work in Object mode over the empty face and block normal painting/gizmo selection.
  await page.locator("#top").click();
  await showMenu();
  await page.locator("#module-root-face").selectOption("bottom");
  await page.locator("#module-root-snap").selectOption("free");
  await page.locator("#module-root-pick").click();
  await page.locator('#editview[data-root-plane="bottom"]').waitFor();
  const box = await page.locator("#editview canvas").boundingBox();
  await page.mouse.move(box.x + box.width * 0.51, box.y + box.height * 0.49);
  await page.waitForFunction(
    () =>
      !!document.querySelector("#editview")?.getAttribute("data-root-preview"),
  );
  await page.screenshot({ path: "validation/root-plane.png" });
  const preview = (
    await page.locator("#editview").getAttribute("data-root-preview")
  )
    .split(",")
    .map(Number);
  assert.equal(preview[2], 0.125);
  assert.ok(
    preview[0] >= 0.5 &&
      preview[0] <= 1.125 &&
      preview[1] >= -0.25 &&
      preview[1] <= 0.375,
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#editview").getAttribute("data-root-plane"),
    null,
  );
  assert.equal(
    await page.locator("#module-root").inputValue(),
    "0.713,0.017,0.125",
  );
  await showMenu();
  await page.locator("#module-root-pick").click();
  await page.mouse.move(box.x + box.width * 0.51, box.y + box.height * 0.49);
  await page.mouse.click(box.x + box.width * 0.51, box.y + box.height * 0.49);
  await page.waitForFunction(
    () => !document.querySelector("#editview")?.hasAttribute("data-root-plane"),
  );
  saved = await save();
  saved.anchorM.forEach((n, i) => assert.ok(Math.abs(n - preview[i]) < 1e-7));
  assert.deepEqual(saved.canvases[0].cells, a.canvases[0].cells);
  assert.deepEqual(saved.objects, objects);
  const finalRoot = saved.anchorM;
  for (const snap of ["vertex", "center"]) {
    await showMenu();
    await page.locator("#module-root-snap").selectOption(snap);
    await page.locator("#module-root-pick").click();
    await page.mouse.move(box.x + box.width * 0.51, box.y + box.height * 0.49);
    const point = (
      await page.locator("#editview").getAttribute("data-root-preview")
    )
      .split(",")
      .map(Number);
    assert.equal(point[2], 0.125);
    for (const [axis, origin] of [
      [0, 0.5],
      [1, -0.25],
    ]) {
      const phase =
        (point[axis] - origin) / 0.125 - (snap === "center" ? 0.5 : 0);
      assert.ok(Math.abs(phase - Math.round(phase)) < 1e-7);
    }
    await page.keyboard.press("Escape");
  }
  await showMenu();
  await page.locator("#module-root-pick").click();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
  await save();
  assert.equal(
    await page.locator("#editview").getAttribute("data-root-plane"),
    null,
  );
  await page.screenshot({ path: "validation/root-placement.png" });
  await app.close();
  app = await launch();
  page = await open();
  assert.deepEqual(
    (await page.locator("#module-root").inputValue()).split(",").map(Number),
    finalRoot,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Root presets, hollow face picking, precision, free persistence, cancellation, history, reopen passed",
    root,
  );
} finally {
  await app.close();
}
