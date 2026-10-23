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
  const canvas=page.locator('#assembly-viewport canvas');
  const r=await canvas.boundingBox();
  const drag=async(modifier)=>{if(modifier)await page.keyboard.down(modifier);await page.mouse.move(r.x+8,r.y+100);await page.mouse.down();await page.mouse.move(r.x+r.width-8,r.y+r.height-8,{steps:12});await page.mouse.up();if(modifier)await page.keyboard.up(modifier);};
  const before=await canvas.screenshot();
  await drag();
  assert.ok(await page.locator('[data-instance].active').count()>1,'plain left drag box-selects');
  const count=await page.locator('[data-instance].active').count();
  await drag('Control');assert.equal(await page.locator('[data-instance].active').count(),0,'Ctrl subtracts');
  await drag('Shift');assert.equal(await page.locator('[data-instance].active').count(),count,'Shift adds');
  await page.keyboard.press('Escape');
  assert.deepEqual(await canvas.screenshot(),before,'left selection never rotates camera');
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down({button:'right'});await page.mouse.move(r.x+r.width/2+80,r.y+r.height/2+40,{steps:8});await page.mouse.up({button:'right'});
  assert.notDeepEqual(await canvas.screenshot(),before,'right drag rotates');
  assert.deepEqual(errors,[]);console.log('assembly pointer UI passed');
} finally {await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();}
