import { launchWorkshop } from "./workshop-launch.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
const root = await fs.mkdtemp(path.resolve("validation/workshop-drag-ui-")),
  p = core.createProject("p"),
  s = core.createScene("s"),
  a = core.createAsset("a");
a.cells = [
  { x: 0, y: 0, z: 0, color: 0 },
  { x: 1, y: 0, z: 0, color: 1 },
];
a.anchorM = [0.125, 0.125, 0.125];
a.rootMode = "legacy";
s.assets.push({
  kind: "voxel",
  assetId: "a",
  source: "assets/a.xhmodule.json",
});
s.instances.push({
  instanceId: "i",
  assetId: "a",
  positionM: [0.125, 0.125, 0.125],
  rotationDeg: 0,
  groupId: "base",
});
p.scenes.push({
  sceneId: "s",
  name: "",
  source: "scenes/s/scene.xhscene.json",
});
await fs.mkdir(path.join(root, "scenes/s/assets"), { recursive: true });
for (const [f, d] of [
  ["project.xhproject.json", p],
  ["scenes/s/scene.xhscene.json", s],
  ["scenes/s/assets/a.xhmodule.json", a],
])
  await fs.writeFile(path.join(root, f), JSON.stringify(d));
const app = await launchWorkshop();
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
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
  await page.locator("#assembly-fit").click();
  await page.locator("#assembly-drag").click();
  const canvas = page.locator("#assembly-viewport canvas");
  async function arrow() {
    const shot = await canvas.screenshot(),
      box = await canvas.boundingBox();
    const point = await app.evaluate(({ nativeImage }, data) => {
      const im = nativeImage.createFromBuffer(Buffer.from(data, "base64")),
        pixels = im.toBitmap(),
        { width, height } = im.getSize();
      let x = 0,
        y = 0,
        n = 0;
      for (let j = 0; j < height; j++)
        for (let i = 0; i < width; i++) {
          const k = (j * width + i) * 4;
          if (pixels[k + 2] > 180 && pixels[k + 1] < 80 && pixels[k] < 80) {
            x += i;
            y += j;
            n++;
          }
        }
      return { x: x / n, y: y / n, n, width, height };
    }, shot.toString("base64"));
    assert.ok(point.n > 3, "visible red X-axis handle");
    return {
      x: box.x + (point.x * box.width) / point.width,
      y: box.y + (point.y * box.height) / point.height,
    };
  }
  let point = await arrow();
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 100, point.y + 25, { steps: 15 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const file = path.join(root, "scenes/s/scene.xhscene.json");
  assert.deepEqual(
    JSON.parse(await fs.readFile(file, "utf8")).instances[0].positionM,
    [0.125, 0.125, 0.125],
  );
  point = await arrow();
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 100, point.y + 25, { steps: 15 });
  await page.mouse.up();
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const moved = JSON.parse(await fs.readFile(file, "utf8")).instances[0]
    .positionM;
  assert.notDeepEqual(moved, [0.125, 0.125, 0.125]);
  assert.ok(
    moved.every(
      (v) =>
        Math.abs((v - 0.125) / 0.25 - Math.round((v - 0.125) / 0.25)) < 1e-6,
    ),
  );
  await page.locator("#assembly-undo").click();
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  assert.deepEqual(
    JSON.parse(await fs.readFile(file, "utf8")).instances[0].positionM,
    [0.125, 0.125, 0.125],
  );
  await page.locator('[data-instance="i"]').click();await page.locator('#assembly-copy').click();await page.locator('[data-instance="i"]').click({modifiers:['Control']});await page.getByText('已选 2 个元素',{exact:true}).waitFor();
  point=await arrow();await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+100,point.y+25,{steps:15});await page.mouse.up();await page.locator('#assembly-save').click();await page.getByText('草稿已保存',{exact:true}).waitFor();const multi=JSON.parse(await fs.readFile(file,'utf8')).instances;assert.equal(multi.length,2);assert.deepEqual(multi[0].positionM,multi[1].positionM);assert.notDeepEqual(multi[0].positionM,[.125,.125,.125]);
  await page.locator('#assembly-undo').click();await page.locator('#assembly-save').click();await page.getByText('草稿已保存',{exact:true}).waitFor();assert.ok(JSON.parse(await fs.readFile(file,'utf8')).instances.every(p=>JSON.stringify(p.positionM)==='[0.125,0.125,0.125]'));
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "validation/workshop-task4b/drag-ui-result.json",
    JSON.stringify(
      {
        passed: true,
        moved,
        checks: [
          "真实X轴拖拽",
          "Esc预览取消",
          "半格Root相位吸附",
          "单次拖拽一次撤销",
          "两实例真实轴拖拽整体预览与一次撤销",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("WORKSHOP_DRAG_UI_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
  assert.ok(
    path
      .relative(path.resolve("validation"), root)
      .startsWith("workshop-drag-ui-"),
  );
  await fs.rm(root, { recursive: true, force: true });
}
