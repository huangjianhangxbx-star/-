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
if(process.env.XH_TEST_PROJECT_V2){
 const p2={schema:'xinghai-workshop-project-2',projectId:'p',revision:0,name:'集合测试',assets:[{assetId:'a',kind:'voxel',name:a.name,revision:a.revision,preview:null,source:'assets/a/asset.xhmodule.json'}],scenes:[{sceneId:'s',name:s.name,revision:s.revision,source:'scenes/s/scene.xhscene.json',preview:null}]};
 const {assets,...scene}=s;scene.schema='xinghai-workshop-scene-2';
 await fs.mkdir(path.join(root,'assets/a'),{recursive:true});await fs.writeFile(path.join(root,'assets/a/asset.xhmodule.json'),JSON.stringify(a));
 await fs.writeFile(path.join(root,'project.xhproject.json'),JSON.stringify(p2));await fs.writeFile(path.join(root,'scenes/s/scene.xhscene.json'),JSON.stringify(scene));
}
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
  await page.getByText(process.env.XH_TEST_PROJECT_V2?"项目级资产库已打开":"项目已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  await page.locator("[data-instance]").first().waitFor();
  assert.equal(await page.locator("[data-instance]").count(), 10);
  const sidebar=page.locator('.assembly-inspector');const before=await sidebar.boundingBox();
  await sidebar.hover();await page.mouse.wheel(0,-300);
  await page.waitForFunction(()=>Number(document.querySelector('#assembly-inspector-content').dataset.zoom)>1);
  assert.equal((await sidebar.boundingBox()).width,before.width);
  await page.locator('#assembly-zoom-reset').click();
  assert.equal(await page.locator('#assembly-inspector-content').getAttribute('data-zoom'),'1');
  if(await page.locator('#assembly-model-edges').getAttribute('aria-pressed')!=='true')await page.locator('#assembly-model-edges').click();
  assert.equal(await page.locator('#assembly-model-edges').getAttribute('aria-pressed'),'true');
  await page.locator('[data-instance="i0"]').click();await page.locator('[data-instance="i1"]').click({modifiers:['Shift']});
  await page.locator('#assembly-collection-create').click();await page.locator('#assembly-collection-name').fill('门廊');await page.locator('#assembly-collection-confirm').click();
  await page.locator('[data-collection]').first().waitFor();
  assert.equal(await page.locator('[data-collection]').count(),1);
  await page.keyboard.press('Escape');await page.locator('[data-instance="i0"]').click();
  assert.equal(await page.locator('[data-instance].active').count(),2);
  await page.keyboard.press('Control+d');
  assert.equal(await page.locator('[data-collection]').count(),2);
  assert.equal(await page.locator('[data-instance].active').count(),2);
  await page.locator('#assembly-collection-rename').click();await page.locator('#assembly-collection-name').fill('门廊副本');await page.locator('#assembly-collection-confirm').click();
  await page.getByRole('button',{name:'门廊副本',exact:true}).waitFor();
  await page.keyboard.press('Control+s');await page.getByText(process.env.XH_TEST_PROJECT_V2?'原生资产与试摆草稿已保存':'草稿已保存',{exact:true}).waitFor();
  const saved=JSON.parse(await fs.readFile(path.join(root,'scenes/s/scene.xhscene.json'),'utf8'));
  assert.equal(saved.collections.length,2);assert.equal(saved.collections[1].name,'门廊副本');
  await page.reload();await page.getByRole('button',{name:'打开项目',exact:true}).click();await page.getByText(process.env.XH_TEST_PROJECT_V2?'项目级资产库已打开':'项目已打开',{exact:true}).waitFor();await page.locator('[data-workspace="assembly"]').click();await page.getByRole('button',{name:'门廊副本',exact:true}).waitFor();
  assert.equal(await page.locator('[data-collection]').count(),2);
  await page.getByRole('button',{name:'门廊副本',exact:true}).click();
  assert.equal(await page.locator('[data-instance].active').count(),2);
  await page.keyboard.press('Control+x');assert.equal(await page.locator('[data-collection]').count(),1);
  await page.keyboard.press('Control+v');assert.equal(await page.locator('[data-collection]').count(),2);
  await page.locator('#assembly-collection-dissolve').click();assert.equal(await page.locator('[data-collection]').count(),1);
  const member=await page.locator('[data-instance].active').first().getAttribute('data-instance');await page.locator('[data-instance="'+member+'"]').click();assert.equal(await page.locator('[data-instance].active').count(),1);
  await page.keyboard.press('Control+z');assert.equal(await page.locator('[data-collection]').count(),2);assert.equal(await page.locator('[data-instance].active').count(),2);
  if(process.env.XH_TEST_PROJECT_V2){
    const forward=page.locator('#assembly-current-assets .project-browser-toolbar').getByRole('button',{name:'→',exact:true}).first();
    assert.equal(await forward.isDisabled(),true);await page.locator('[data-instance="i0"]').click();assert.equal(await forward.isDisabled(),true);
  }
  await page.screenshot({path:process.env.XH_TEST_PROJECT_V2?'validation/assembly-organization-v2.png':'validation/assembly-organization.png'});
  assert.deepEqual(errors,[]);console.log('assembly organization UI passed');
}finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();}
