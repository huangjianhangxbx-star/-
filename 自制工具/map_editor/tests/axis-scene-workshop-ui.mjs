import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
const projectRoot = await fs.mkdtemp(
  path.join(await fs.realpath(os.tmpdir()), "xh-axis-scene-project-"),
);
const profile = await fs.mkdtemp(
  path.join(await fs.realpath(os.tmpdir()), "xh-axis-scene-profile-"),
);
const output = await fs.mkdtemp(
  path.resolve("validation/axis-scene-workshop-"),
);
const project = core.createProjectV2("axis-project"),
  asset = core.createAsset("rock");
asset.name = "预览岩块";
asset.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
project.assets.push({
  kind: "voxel",
  assetId: asset.assetId,
  name: asset.name,
  revision: 0,
  preview: null,
  source: "assets/rock/asset.xhmodule.json",
});
const scenes = [core.createSceneV2("first"), core.createSceneV2("second")];
for (const [i, scene] of scenes.entries()) {
  scene.name = i ? "第二试摆" : "第一试摆";
  for (let n = 0; n <= i; n++)
    scene.instances.push({
      instanceId: "i" + n,
      assetId: asset.assetId,
      positionM: [n * 2, 0, 0],
      rotationDeg: 0,
      groupId: "base",
    });
  project.scenes.push({
    sceneId: scene.sceneId,
    name: scene.name,
    revision: 0,
    preview: null,
    source: `scenes/${scene.sceneId}/scene.xhscene.json`,
  });
}
for (const [file, doc] of [
  ["project.xhproject.json", project],
  ["assets/rock/asset.xhmodule.json", asset],
  ...scenes.map((s) => [`scenes/${s.sceneId}/scene.xhscene.json`, s]),
]) {
  const target = path.join(projectRoot, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(doc));
}
const digest = async (file) =>
  createHash("sha256")
    .update(await fs.readFile(path.join(projectRoot, file)))
    .digest("hex");
const originalScenes = await Promise.all(
    project.scenes.map((s) => digest(s.source)),
  ),
  originalAsset = await digest(project.assets[0].source);
const app = await electron.launch({
  args: process.env.XH_ELECTRON_EXECUTABLE
    ? ["--test-hidden"]
    : [".", "--test-hidden"],
  env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
  executablePath:
    process.env.XH_ELECTRON_EXECUTABLE ??
    "node_modules/electron/dist/electron.exe",
});
try {
  const page = await app.firstWindow(),
    errors = [];
  page.setDefaultTimeout(12000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1720, height: 1050 });
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [folder],
    });
  }, projectRoot);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目级资产库已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  const nav = page.locator("#assembly-viewport .ortho-nav");
  assert.equal(await nav.locator("[data-ortho]").count(), 6);
  await nav.locator('[data-ortho="top"]').click();
  assert.equal(
    await page.locator("#assembly-viewport").getAttribute("data-view-axis"),
    "top",
  );
  await page.locator('[data-instance="i0"]').click();
  await page.locator("#assembly-edit").click();
  if (!(await page.locator(".view.preview").isVisible()))
    await page.locator("#shell-preview-toggle").click();
  const scope = page.getByLabel("预览内容", { exact: true }),
    sceneChoice = page.getByLabel("预览搭建场景", { exact: true });
  assert.equal(
    await scope.count(),
    1,
    "right viewport exposes a visible content choice",
  );
  await scope.selectOption("scene");
  await sceneChoice.selectOption("second");
  await page.waitForFunction(
    () => document.querySelector("#preview").dataset.previewScene === "second",
  );
  assert.equal(
    await page.locator("#preview").getAttribute("data-preview-instances"),
    "2",
  );
  const canvases = await page.locator("canvas").count();
  await page.screenshot({
    path: path.join(output, "scene-preview-before.png"),
  });
  const rendered=await page.locator('#preview canvas').screenshot();
  const lit=await app.evaluate(({nativeImage},encoded)=>{
    const image=nativeImage.createFromBuffer(Buffer.from(encoded,'base64')),pixels=image.toBitmap(),{width,height}=image.getSize(),histogram=new Map();
    const rgb=(x,y)=>{const i=(y*width+x)*4;return [pixels[i+2],pixels[i+1],pixels[i]];};
    for(let y=4;y<height-4;y+=5)for(let x=4;x<width-4;x+=5){const c=rgb(x,y).map(n=>Math.round(n/8)*8).join(',');histogram.set(c,(histogram.get(c)??0)+1);}
    const background=[...histogram].sort((a,b)=>b[1]-a[1])[0][0].split(',').map(Number),brightness=background.reduce((n,v)=>n+v,0)/3;
    let count=0;for(let y=5;y<height-5;y+=3)for(let x=5;x<width-5;x+=3){const c=rgb(x,y);if(c.reduce((n,v)=>n+v,0)/3<brightness+12)continue;if([[3,0],[-3,0],[0,3],[0,-3]].every(([a,b])=>rgb(x+a,y+b).every((v,i)=>Math.abs(v-c[i])<8)))count++;}
    return count;
  },rendered.toString('base64'));
  assert.ok(lit>20,'scene models must contain lit solid surfaces, rather than losing their viewport light rig and rendering black');
  await page.locator("#top").click();
  await page.locator("#brush-current").click();
  const box = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByText("体素 2", { exact: true }).waitFor();
  await page.waitForFunction(
    () => document.querySelector("#preview").dataset.previewVoxels === "4",
  );
  assert.equal(
    await digest(project.assets[0].source),
    originalAsset,
    "right preview uses the unsaved asset session rather than rewriting its source",
  );
  await page.screenshot({
    path: path.join(output, "scene-preview-unsaved-edit.png"),
  });
  await page.keyboard.press("Escape");
  await scope.selectOption("model");
  assert.equal(
    await page.locator("#preview").getAttribute("data-preview-source"),
    "model",
  );
  assert.equal(
    await page.locator("canvas").count(),
    canvases,
    "the preview choices must not allocate another WebGL canvas",
  );
  await page.locator('[data-workspace="assembly"]').click();
  assert.equal(
    await page.locator("[data-instance]").count(),
    1,
    "previewing the second scene does not activate it",
  );
  assert.deepEqual(
    await Promise.all(project.scenes.map((s) => digest(s.source))),
    originalScenes,
    "preview controls and direction navigation leave both scene files byte-identical",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS real hidden workshop axis / selected read-only scene / unsaved edit",
    output,
  );
} catch (error) {
  const page = await app.firstWindow();
  await page
    .screenshot({ path: path.join(output, "failure.png") })
    .catch(() => {});
  console.log("failure artifacts", output);
  console.log(
    await page.evaluate(() => ({
      preview: document.querySelector("#preview")?.dataset,
      message: document.querySelector("#message")?.textContent,
      workshop: document.querySelector("#workshop-message")?.textContent,
    })),
  );
  throw error;
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  await fs.rm(projectRoot, { recursive: true, force: true });
  await fs.rm(profile, { recursive: true, force: true });
}
