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
a.schema='xinghai-workshop-asset-2';a.canvases=[{canvasId:'coarse',name:'粗格',visible:true,locked:false,voxelStepM:.25,originTicks:[0,0,0],cells:[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:1}],protectedColumns:[]},{canvasId:'fine',name:'细格',visible:true,locked:false,voxelStepM:.125,originTicks:[16,0,0],cells:[{x:0,y:0,z:0,color:2}],protectedColumns:[]}];a.cells=[];const source=process.env.XH_TEST_PROJECT_V2?'assets/a/asset.xhmodule.json':'scenes/s/assets/a.xhmodule.json';await fs.writeFile(path.join(root,source),JSON.stringify(a));
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
  await page.locator('[data-instance="i0"]').click();await page.locator('#assembly-edit').click();
  assert.equal(await page.locator('#canvas-upgrade').count(),0);
  assert.equal(await page.locator('#model-interaction-mode').inputValue(),'object');
  assert.equal(await page.locator('[data-model-object]').count(),2);
  const rows=page.locator('[data-model-object]');
  await rows.nth(0).click();const first=await rows.nth(0).getAttribute('data-model-object');await rows.nth(1).click();
  await page.keyboard.press('Control+z');await page.waitForFunction(id=>document.querySelector('[data-model-object="'+id+'"]').classList.contains('active'),first);
  await rows.nth(1).click({modifiers:['Shift']});await page.locator('#model-collection-create').click();await page.getByRole('textbox',{name:'集合名称'}).fill('建筑');await page.getByRole('button',{name:'确定',exact:true}).click();await page.locator('[data-model-collection]').waitFor();
  await rows.nth(0).click();await page.keyboard.press('Tab');assert.equal(await page.locator('#editview').getAttribute('data-canvas-id'),'coarse','edit the member clicked, not last collection member');await page.keyboard.press('Tab');
  assert.equal(await page.locator('#model-interaction-mode').isVisible(),true);
  assert.equal(await page.locator('#canvas-align').isVisible(),false);
  await page.keyboard.press('Control+j');await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===1);
  await page.keyboard.press('Tab');assert.equal(await page.locator('#model-interaction-mode').inputValue(),'edit');
  assert.equal(await page.locator('.canvas-layer-row').count(),2);
  await page.locator('.canvas-layer-select').first().click();
  await page.evaluate(()=>document.querySelector('#native-all').click());
  await page.locator('#model-object-actions > summary').click();await page.locator('#model-separate').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===2);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Control+z');await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===1);
  await page.keyboard.press('Control+Shift+z');await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===2);
  await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===3);
  await page.keyboard.press('Control+z');await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===2);
  await page.keyboard.press('Escape');assert.equal(await page.locator('[data-model-object].active').count(),0);
  await page.keyboard.press('Control+z');await page.waitForFunction(()=>document.querySelectorAll('[data-model-object].active').length===1);
  await page.keyboard.press('Control+x');await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===1);
  await page.keyboard.press('Control+v');await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===2);
  await page.keyboard.press('Control+z');await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===1);
  await page.keyboard.press('Control+z');await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===2);
  await page.keyboard.press('Control+s');await page.getByText(process.env.XH_TEST_PROJECT_V2?'原生资产与试摆草稿已保存':'草稿已保存',{exact:true}).waitFor();
  const saved=JSON.parse(await fs.readFile(path.join(root,source),'utf8'));
  assert.equal(saved.assetId,'a');assert.equal(saved.objects.length,2);assert.ok(saved.canvases.some(c=>c.voxelStepM===.125));
  assert.equal(saved.canvases.reduce((n,c)=>n+c.cells.length,0),3);
  await page.locator('[data-workspace="project"]').click();await page.getByRole('button',{name:'打开项目',exact:true}).click();
  await page.getByText(process.env.XH_TEST_PROJECT_V2?'项目级资产库已打开':'项目已打开',{exact:true}).waitFor();
  await page.locator('[data-workspace="assembly"]').click();await page.locator('[data-instance="i0"]').click();await page.locator('#assembly-edit').click();
  assert.equal(await page.locator('[data-model-object]').count(),2);assert.equal(await page.locator('[data-model-collection]').count(),1);
  assert.deepEqual(errors,[]);console.log('model objects UI passed');
}finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();}
