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
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+v');
  assert.equal(await page.locator('[data-instance]').count(),11);
  assert.equal(await page.locator('[data-instance].active').count(),1);
  assert.notEqual(await page.locator('[data-instance].active').getAttribute('data-instance'),'i0');
  assert.equal(await page.locator('#assembly-drag').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Control+z');
  assert.equal(await page.locator('[data-instance]').count(),10);
  await page.keyboard.press('Control+Shift+z');
  assert.equal(await page.locator('[data-instance]').count(),11);
  await page.locator('[data-instance="i0"]').click();
  await page.keyboard.press('Control+x');
  assert.equal(await page.locator('[data-instance]').count(),10);
  await page.keyboard.press('Control+v');
  assert.equal(await page.locator('[data-instance]').count(),11);
  await page.keyboard.press('Control+d');
  assert.equal(await page.locator('[data-instance]').count(),12);
  await page.locator('#assembly-position').focus();
  await page.keyboard.press('Control+a');await page.keyboard.press('Delete');
  assert.equal(await page.locator('[data-instance]').count(),12);
  await page.locator('[data-instance]').first().click();
  await page.keyboard.press('Control+a');await page.keyboard.press('Delete');
  assert.equal(await page.locator('[data-instance]').count(),0);
  await page.keyboard.press('Control+z');assert.equal(await page.locator('[data-instance]').count(),12);
  await page.locator('[data-instance="i1"]').click();
  await page.locator('[data-instance="i2"]').click({modifiers:['Shift']});
  await page.keyboard.press('Control+c');await page.keyboard.press('Escape');await page.keyboard.press('Control+v');
  assert.equal(await page.locator('[data-instance].active').count(),2);
  assert.equal(await page.locator('[data-instance]').count(),14);
  await page.locator('#assembly-position').fill('3,2,0');
  await page.locator('#assembly-apply').click();
  await page.keyboard.press('Control+s');
  await page.getByText('草稿已保存',{exact:true}).waitFor();
  const saved=JSON.parse(await fs.readFile(path.join(root,'scenes/s/scene.xhscene.json'),'utf8'));
  assert.deepEqual(saved.instances.at(-2).positionM,[3,2,0]);
  assert.deepEqual(saved.instances.at(-1).positionM,[3.5,2,0]);
  assert.deepEqual(saved.instances.find(p=>p.instanceId==='i1').positionM,[.5,0,0]);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'validation/assembly-clipboard.png'});
  console.log('assembly clipboard UI passed');
} finally { await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close(); }
