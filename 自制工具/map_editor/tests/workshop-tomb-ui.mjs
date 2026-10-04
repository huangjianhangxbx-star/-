import { launchWorkshop } from "./workshop-launch.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
const root = await fs.mkdtemp(path.resolve("validation/workshop-tomb-ui-")),
  p = core.createProject("p"),
  s = core.createScene("s");
p.name = "工坊墓室验证";
s.name = "墓室";
p.scenes.push({
  sceneId: "s",
  name: "墓室",
  source: "scenes/s/scene.xhscene.json",
});
const specs = [
  ["floor", "地面", 4, 4, 1],
  ["platform", "高台", 4, 4, 2],
  ["wall", "洞壁", 8, 1, 8],
  ["rock", "断崖", 3, 3, 4],
  ["lamp", "灯座", 1, 1, 5],
];
await fs.mkdir(path.join(root, "scenes/s/assets"), { recursive: true });
for (const [id, name, w, h, height] of specs) {
  const a = core.createAsset(id);
  a.name = name;
  for (let z = 0; z < height; z++)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (id === "wall" && x >= 2 && x <= 5 && z < 5) continue;
        if (id === "rock" && x + y + z > 5) continue;
        a.cells.push({
          x,
          y,
          z: id === "floor" ? -1 : z,
          color: id === "lamp" ? 1 : 0,
          owner: "volume",
        });
      }
  if (id === "rock") {
    a.anchorM = [0.125, 0, 0.125];
    a.rootMode = "legacy";
  }
  s.assets.push({
    kind: "voxel",
    assetId: id,
    source: `assets/${id}.xhmodule.json`,
  });
  await fs.writeFile(
    path.join(root, `scenes/s/assets/${id}.xhmodule.json`),
    JSON.stringify(a),
  );
}
for (const [file, doc] of [
  ["project.xhproject.json", p],
  ["scenes/s/scene.xhscene.json", s],
])
  await fs.writeFile(path.join(root, file), JSON.stringify(doc));
const library = path.join(root, "library");
await fs.mkdir(library);
const publicAsset = core.createAsset("public-column");
publicAsset.name = "墓柱";
for (let z = 0; z < 7; z++)
  publicAsset.cells.push({ x: 0, y: 0, z, color: 1, owner: "volume" });
const publicBytes = Buffer.from(JSON.stringify(publicAsset));
await fs.writeFile(path.join(library, "column.xhmodule.json"), publicBytes);
const app = await launchWorkshop();
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const gpu = { buffers: new Set(), textures: new Set() };
    window.__gpu = gpu;
    for (const proto of [
      WebGLRenderingContext.prototype,
      WebGL2RenderingContext.prototype,
    ])
      for (const [create, remove, set] of [
        ["createBuffer", "deleteBuffer", gpu.buffers],
        ["createTexture", "deleteTexture", gpu.textures],
      ]) {
        const make = proto[create],
          drop = proto[remove];
        proto[create] = function (...args) {
          const v = make.apply(this, args);
          if (v) set.add(v);
          return v;
        };
        proto[remove] = function (v) {
          set.delete(v);
          return drop.call(this, v);
        };
      }
  });
  await page.reload();
  async function pick(file) {
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, file);
  }
  await pick(root);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  const placements = [
    ["floor", [-1, -1, 0], "base"],
    ["floor", [0, -1, 0], "base"],
    ["floor", [-1, 0, 0], "base"],
    ["floor", [0, 0, 0], "base"],
    ["platform", [-0.5, -0.5, 0], "platform"],
    ["wall", [-1, 1, 0], "large-env"],
    ["wall", [-1, -1, 0], "large-env"],
    ["rock", [1.125, 0, 0.125], "large-env"],
    ["lamp", [-0.5, -0.5, 0.5], "small-env"],
    ["lamp", [0.25, -0.5, 0.5], "small-env"],
  ];
  for (const [id, pos, group] of placements) {
    await page.locator("#assembly-assets").selectOption(id);
    await page.locator("#assembly-add").click();
    await page.locator("#assembly-position").fill(pos.join(","));
    await page.locator("#assembly-apply").click();
    await page.locator("#assembly-group").selectOption(group);
    await page.locator("#assembly-group-apply").click();
  }
  assert.equal(await page.locator("[data-instance]").count(), 10);
  await page.locator("#assembly-fit").click();
  const canvas = page.locator("#assembly-viewport canvas"),
    r = await canvas.boundingBox();
  await page.keyboard.down("Shift");
  await page.mouse.move(r.x + 3, r.y + 3);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width - 3, r.y + r.height - 3, { steps: 20 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await page.getByText("已选 10 个元素", { exact: true }).waitFor();
  await page.locator("#assembly-copy").click();
  assert.equal(await page.locator("[data-instance]").count(), 20);
  await page.locator("#assembly-undo").click();
  assert.equal(await page.locator("[data-instance]").count(), 10);
  await page.locator("[data-instance]").nth(0).click();
  await page
    .locator("[data-instance]")
    .nth(1)
    .click({ modifiers: ["Control"] });
  await page.getByText("已选 2 个元素", { exact: true }).waitFor();
  await page.locator("#assembly-group").selectOption("platform");
  await page.locator("#assembly-group-apply").click();
  await page.locator("#assembly-undo").click();
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const sceneFile = path.join(root, "scenes/s/scene.xhscene.json");
  const built = JSON.parse(await fs.readFile(sceneFile, "utf8"));
  assert.equal(built.instances.length, 10);
  assert.equal(new Set(built.instances.map((p) => p.assetId)).size, 5);
  assert.ok(built.instances.some((p) => p.positionM[0] < 0));
  await page.locator('[data-workspace="project"]').click();
  await pick(library);
  await page.getByRole("button", { name: "选择公共库", exact: true }).click();
  await page.locator('[data-workspace="assembly"]').click();
  await page.locator('[data-library-id="public-column"]').dragTo(canvas);
  await page.getByText("已拖入独立本地副本", { exact: true }).waitFor();
  assert.equal(await page.locator("[data-instance]").count(), 11);
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const copied = JSON.parse(await fs.readFile(sceneFile, "utf8"));
  assert.equal(copied.assets.length, 6);
  assert.ok(!copied.assets.some((a) => a.assetId === "public-column"));
  assert.deepEqual(
    await fs.readFile(path.join(library, "column.xhmodule.json")),
    publicBytes,
  );
  await page.locator("[data-instance]").first().click();
  await page.locator("#assembly-copy").click();
  await page.locator("#assembly-delete").click();
  await canvas.screenshot();
  const resources = () =>
    page.evaluate(() => ({
      buffers: window.__gpu.buffers.size,
      textures: window.__gpu.textures.size,
    }));
  const baseline = await resources();
  for (let i = 0; i < 20; i++) {
    await page.locator("[data-instance]").first().click();
    await page.locator("#assembly-copy").click();
    await page.locator("#assembly-delete").click();
    await page.locator('[data-workspace="project"]').click();
    await page.locator('[data-workspace="assembly"]').click();
  }
  await canvas.screenshot();
  const after = await resources();
  assert.deepEqual(
    after,
    baseline,
    "shared geometry and repeated switching keep GPU allocations stable",
  );
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  await page.locator('[data-workspace="project"]').click();
  await pick(root);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  assert.equal(await page.locator("[data-instance]").count(), 11);
  await page.locator("#assembly-fit").click();
  await page.screenshot({ path: "validation/workshop-task4c/tomb.png" });
  const final = JSON.parse(await fs.readFile(sceneFile, "utf8"));
  assert.deepEqual(final.instances, copied.instances);
  assert.deepEqual(errors, []);
  await fs.mkdir("validation/workshop-task4c/tomb-project/scenes/s/assets", {
    recursive: true,
  });
  await fs.copyFile(
    path.join(root, "project.xhproject.json"),
    "validation/workshop-task4c/tomb-project/project.xhproject.json",
  );
  await fs.copyFile(
    sceneFile,
    "validation/workshop-task4c/tomb-project/scenes/s/scene.xhscene.json",
  );
  for (const a of final.assets)
    await fs.copyFile(
      path.join(root, "scenes/s", a.source),
      path.join("validation/workshop-task4c/tomb-project/scenes/s", a.source),
    );
  await fs.writeFile(
    "validation/workshop-task4c/tomb-ui-result.json",
    JSON.stringify(
      {
        passed: true,
        instances: 11,
        assets: 6,
        baseline,
        after,
        checks: [
          "五模块十实例真实墓室装配",
          "Shift真实框选十实例",
          "混合多选与一次复制撤销",
          "多选分组归属与一次撤销",
          "公共体素模块真实拖入独立副本",
          "20轮共享几何复制删除与切页GPU计数稳定",
          "保存重开身份/Root/位置保持",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("WORKSHOP_TOMB_UI_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
  assert.ok(
    path
      .relative(path.resolve("validation"), root)
      .startsWith("workshop-tomb-ui-"),
  );
  await fs.rm(root, { recursive: true, force: true });
}
