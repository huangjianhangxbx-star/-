import { launchWorkshop } from "./workshop-launch.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
const root = await fs.mkdtemp(path.resolve("validation/workshop-binary-ui-"));
const model = path.join(root, "reference.glb"),
  image = path.join(root, "reference.png");
await fs.copyFile("fixtures/direction.glb", model);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGN4ppHyH4QZYAwAVugJxfB+DTwAAAAASUVORK5CYII=",
  "base64",
);
await fs.writeFile(image, png);
const p = core.createProject("p"),
  s = core.createScene("s");
p.scenes.push({
  sceneId: "s",
  name: "装配验证",
  source: "scenes/s/scene.xhscene.json",
});
await fs.mkdir(path.join(root, "scenes/s"), { recursive: true });
await fs.writeFile(
  path.join(root, "project.xhproject.json"),
  JSON.stringify(p),
);
await fs.writeFile(
  path.join(root, "scenes/s/scene.xhscene.json"),
  JSON.stringify(s),
);
const app = await launchWorkshop();
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function dialog(file) {
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, file);
  }
  await dialog(root);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  await dialog(model);
  await page.locator("#assembly-import").click();
  await page.locator("[data-instance]").first().waitFor();
  await page.locator("#assembly-position").fill("1.123,-.7,.4");
  await page.locator("#assembly-apply").click();
  await page.locator("#assembly-copy").click();
  assert.equal(await page.locator("[data-instance]").count(), 2);
  await dialog(image);
  await page.locator("#assembly-import").click();
  assert.equal(await page.locator("[data-instance]").count(), 3);
  await page.locator("#assembly-size").fill("2,3");
  await page.locator("#assembly-size-apply").click();
  await page.locator("#assembly-copy").click();
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const sceneFile = path.join(root, "scenes/s/scene.xhscene.json"),
    saved = JSON.parse(await fs.readFile(sceneFile, "utf8"));
  assert.equal(saved.instances.length, 2);
  assert.equal(saved.decals.length, 2);
  assert.equal(saved.assets.length, 2);
  assert.equal(saved.decals[0].widthM, 2);
  assert.equal(saved.decals[1].heightM, 3);
  assert.deepEqual(saved.instances[0].positionM, [1.123, -0.7, 0.4]);
  const texture = saved.assets.find((a) => a.kind === "texture"),
    external = saved.assets.find((a) => a.kind === "external");
  assert.deepEqual(
    await fs.readFile(path.join(root, "scenes/s", texture.image)),
    png,
  );
  assert.deepEqual(
    await fs.readFile(path.join(root, "scenes/s", external.model)),
    await fs.readFile(model),
  );
  await fs.rm(model);
  await fs.rm(image);
  await page.locator('[data-workspace="project"]').click();
  await dialog(root);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  assert.equal(await page.locator("[data-instance]").count(), 4);
  await page.locator("#assembly-fit").click();
  await page.getByText("4 个元素 · 2 个私有资产", { exact: true }).waitFor();
  const canvasShot = await page
    .locator("#assembly-viewport canvas")
    .screenshot();
  const painted = await app.evaluate(({ nativeImage }, data) => {
    const pixels = nativeImage
      .createFromBuffer(Buffer.from(data, "base64"))
      .toBitmap();
    let n = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (
        pixels[i + 2] > 180 &&
        pixels[i + 1] < 90 &&
        pixels[i] > 70 &&
        pixels[i] < 150
      )
        n++;
    return n;
  }, canvasShot.toString("base64"));
  assert.ok(
    painted > 1000,
    "horizontal PNG decal actually draws opaque colored pixels",
  );
  await page.screenshot({
    path: "validation/workshop-task4b/binary-assembly.png",
  });
  const library = path.join(root, "library");
  await fs.mkdir(library);
  const publicModel = await fs.readFile(
    path.join(root, "scenes/s", external.model),
  );
  await fs.writeFile(path.join(library, "A_model.glb"), publicModel);
  await fs.writeFile(path.join(library, "B_image.png"), png);
  await page.locator('[data-workspace="project"]').click();
  await dialog(library);
  await page.getByRole("button", { name: "选择公共库", exact: true }).click();
  await page.getByText("A_model · ready", { exact: false }).waitFor();
  const manifest = JSON.parse(
    await fs.readFile(path.join(library, ".xinghai-assets.json"), "utf8"),
  );
  await page
    .getByText("A_model · ready", { exact: false })
    .locator("..")
    .getByRole("button", { name: "取用到当前场景", exact: true })
    .click();
  await page.locator('[data-workspace="project"]').click();
  await page
    .getByText("B_image · ready", { exact: false })
    .locator("..")
    .getByRole("button", { name: "取用到当前场景", exact: true })
    .click();
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const copied = JSON.parse(await fs.readFile(sceneFile, "utf8"));
  assert.equal(copied.assets.length, 4);
  const publicIds = manifest.assets.map((a) => a.id);
  assert.ok(copied.assets.every((a) => !publicIds.includes(a.assetId)));
  assert.deepEqual(
    await fs.readFile(path.join(library, "A_model.glb")),
    publicModel,
  );
  assert.deepEqual(await fs.readFile(path.join(library, "B_image.png")), png);
  const beforeMissing=await fs.readFile(sceneFile),modelBytes=await fs.readFile(path.join(root,'scenes/s',external.model));
  await fs.rm(path.join(root,'scenes/s',external.model));await fs.rm(path.join(root,'scenes/s',texture.image));
  await page.locator('[data-workspace="project"]').click();await dialog(root);await page.getByRole('button',{name:'打开项目',exact:true}).click();await page.getByText('项目已打开',{exact:true}).waitFor();await page.locator('[data-workspace="assembly"]').click();
  await page.locator('#assembly-issues').filter({hasText:'2 项资产缺失'}).waitFor();
  await page.locator('#assembly-save').click();await page.locator('#workshop-message.error').waitFor();assert.deepEqual(await fs.readFile(sceneFile),beforeMissing);
  await fs.writeFile(path.join(root,'scenes/s',external.model),modelBytes);await fs.writeFile(path.join(root,'scenes/s',texture.image),png);
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "validation/workshop-task4b/binary-ui-result.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "真实GLB导入与非网格位置",
          "PNG贴花尺寸与复制",
          "实际视口绘制水平PNG，非空纹理像素验证",
          "两种负载保存字节不变",
          "删除参考原件仍能重开项目",
          "公共GLB/PNG取用为新ID的本地副本，公共字节不变",
          "缺失模型/图片占位与发布前提示，拒绝保存且场景原字节不变",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("WORKSHOP_BINARY_UI_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
  assert.ok(
    path
      .relative(path.resolve("validation"), root)
      .startsWith("workshop-binary-ui-"),
  );
  await fs.rm(root, { recursive: true, force: true });
}
