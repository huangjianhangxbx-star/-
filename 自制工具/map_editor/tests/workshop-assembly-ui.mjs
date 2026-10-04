import { launchWorkshop } from "./workshop-launch.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
const root = await fs.mkdtemp(path.resolve("validation/workshop-assembly-"));
const p = core.createProject("p"),
  s = core.createScene("s"),
  a = core.createAsset("a");
a.name = "悬空平台";
a.cells = [
  { x: 0, y: 0, z: 4, color: 0 },
  { x: 1, y: 0, z: 4, color: 1 },
];
s.assets.push({
  kind: "voxel",
  assetId: "a",
  source: "assets/a.xhmodule.json",
});
for (let i = 0; i < 10; i++)
  s.instances.push({
    instanceId: `i${i}`,
    assetId: "a",
    positionM: [i * 0.5, 0, 0],
    rotationDeg: (i % 4) * 90,
    groupId: "base",
  });
p.scenes.push({
  sceneId: "s",
  name: "墓室",
  source: "scenes/s/scene.xhscene.json",
});
await fs.mkdir(path.join(root, "scenes/s/assets"), { recursive: true });
for (const [file, doc] of [
  ["project.xhproject.json", p],
  ["scenes/s/scene.xhscene.json", s],
  ["scenes/s/assets/a.xhmodule.json", a],
])
  await fs.writeFile(path.join(root, file), JSON.stringify(doc));
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
  await page.locator("[data-instance]").first().waitFor();
  assert.equal(await page.locator("[data-instance]").count(), 10);
  await page.locator('[data-instance="i0"]').click();
  await page.locator("#assembly-copy").click();
  assert.equal(await page.locator("[data-instance]").count(), 11);
  await page.locator("#assembly-position").fill("2,1,-0.5");
  await page.locator("#assembly-apply").click();
  await page.locator("#assembly-rotate").click();
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const scenePath = path.join(root, "scenes/s/scene.xhscene.json");
  const saved = JSON.parse(await fs.readFile(scenePath, "utf8")),
    copy = saved.instances.at(-1);
  assert.equal(copy.assetId, "a");
  assert.deepEqual(copy.positionM, [2, 1, -0.5]);
  assert.equal(copy.rotationDeg, 90);
  await page.locator("#assembly-delete").click();
  await page.locator("#assembly-undo").click();
  assert.equal(await page.locator("[data-instance]").count(), 11);
  await page.locator('[data-instance="i0"]').click();
  await page.locator("#assembly-edit").click();
  await page.locator("#module-root").fill(".5,-.25,.75");
  await page.locator("#module-root-apply").click();
  await page.locator('[data-workspace="assembly"]').click();
  const previousSceneBytes = await fs.readFile(scenePath);
  const external = { ...JSON.parse(previousSceneBytes), name: "外部修改" };
  await fs.writeFile(scenePath, JSON.stringify(external));
  await page.locator("#assembly-save").click();
  await page.locator("#workshop-message.error").waitFor();
  assert.equal(
    JSON.parse(await fs.readFile(scenePath, "utf8")).name,
    "外部修改",
  );
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(
        path.join(root, "scenes/s/assets/a.xhmodule.json"),
        "utf8",
      ),
    ).anchorM,
    [0, 0, 0],
  );
  await fs.writeFile(scenePath, previousSceneBytes);
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const moved = JSON.parse(await fs.readFile(scenePath, "utf8"));
  assert.deepEqual(moved.instances[0].positionM, [0.5, -0.25, 0.75]);
  assert.deepEqual(moved.instances[1].positionM, [0.75, 0.5, 0.75]);
  await page.locator("#assembly-undo").click();
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  assert.deepEqual(
    JSON.parse(await fs.readFile(scenePath, "utf8")).instances,
    saved.instances,
  );
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(
        path.join(root, "scenes/s/assets/a.xhmodule.json"),
        "utf8",
      ),
    ).anchorM,
    [0, 0, 0],
  );
  await page.locator('[data-group="base"]').uncheck();
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  await page.locator('[data-workspace="project"]').click();
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  assert.equal(await page.locator("[data-instance]").count(), 11);
  assert.equal(await page.locator('[data-group="base"]').isChecked(), false);
  await page.locator('[data-group="base"]').check();
  await page.screenshot({ path: "validation/workshop-task4/assembly.png" });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "validation/workshop-task4/electron-result.json",
    JSON.stringify(
      {
        passed: true,
        instances: 11,
        checks: [
          "浮空模块十实例",
          "副本身份与数字变换",
          "旋转90度",
          "删除撤销",
          "Root十一实例联合补偿",
          "保存冲突不产生半份Root写入，恢复字节后重试",
          "联合撤销与持久化",
          "分组显示保存重开",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("WORKSHOP_ASSEMBLY_UI_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
  assert.ok(
    path
      .relative(path.resolve("validation"), root)
      .startsWith("workshop-assembly-"),
  );
  await fs.rm(root, { recursive: true, force: true });
}
