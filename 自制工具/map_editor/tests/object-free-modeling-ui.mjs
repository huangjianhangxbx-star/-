import { launchWorkshop } from "./workshop-launch.mjs";
import { _electron as electron } from "playwright";
import os from "node:os";
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
const profile=process.env.XH_ELECTRON_EXECUTABLE?await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'xh-free-modeling-profile-')):null;
const app = process.env.XH_ELECTRON_EXECUTABLE
  ? await electron.launch({args:['--workspace=workshop','--test-hidden'],env:{...process.env,XINGHAI_TEST_PROFILE:profile},executablePath:process.env.XH_ELECTRON_EXECUTABLE})
  : await launchWorkshop();
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

  page.setDefaultTimeout(10000);
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#model-interaction-mode').selectOption('object');
  await page.locator('#top').click();
  const getSaved=async()=>{
    await page.locator('#workshop-message').evaluate(e=>e.textContent='');
    await page.keyboard.press('Control+s');
    await page.getByText(process.env.XH_TEST_PROJECT_V2?'原生资产与试摆草稿已保存':'草稿已保存',{exact:true}).waitFor();
    return JSON.parse(await fs.readFile(path.join(root,source),'utf8'));
  };
  await page.locator('[data-palette-mode="wheel"]').click();
  await page.locator('#color-wheel').scrollIntoViewIfNeeded();
  const wheel=await page.locator('#color-wheel').boundingBox();
  await page.mouse.click(wheel.x+wheel.width*.6,wheel.y+wheel.height*.35);
  const desiredHex=await page.locator('#color').inputValue();
  const before=await getSaved();
  const activeId=await page.locator('#editview').getAttribute('data-canvas-id');
  const oldCells=before.canvases.find(c=>c.canvasId===activeId).cells;
  assert.equal(await page.locator('#brush-current').isVisible(),true,'object mode exposes modeling tools');
  await page.locator('#brush-current').click();
  const box=await page.locator('#editview canvas').boundingBox();
  const point={x:box.x+box.width*.62,y:box.y+box.height*.55};
  await page.mouse.click(point.x,point.y);
  const painted=await getSaved();
  assert.equal(painted.canvases.find(c=>c.canvasId===activeId).cells.length,oldCells.length+1,'object mode must draw into the active canvas');
  assert.equal(await page.locator('#model-interaction-mode').inputValue(),'object');
  for(const c of before.canvases.filter(c=>c.canvasId!==activeId))assert.deepEqual(painted.canvases.find(n=>n.canvasId===c.canvasId),c,'brush leaves other canvases alone');

  await page.keyboard.press('Control+z');
  let changed=await getSaved();
  assert.equal(changed.canvases.find(c=>c.canvasId===activeId).cells.length,oldCells.length,'undo after painting restores voxel edit');
  assert.equal(await page.locator('#brush-current').evaluate(e=>e.classList.contains('active')),true,'undo keeps the current brush active');
  await page.keyboard.press('Control+Shift+z');changed=await getSaved();
  assert.equal(changed.canvases.find(c=>c.canvasId===activeId).cells.length,oldCells.length+1);
  await page.locator('#viewport-brush-menu > summary').click();
  await page.locator('[data-tool="erase"]').click();
  await page.mouse.click(point.x,point.y);changed=await getSaved();
  assert.equal(changed.canvases.find(c=>c.canvasId===activeId).cells.length,oldCells.length,'eraser works directly in object mode');
  assert.equal(changed.objects.length,2,'eraser must not delete the object');
  await page.keyboard.press('Control+z');changed=await getSaved();
  assert.equal(changed.canvases.find(c=>c.canvasId===activeId).cells.length,oldCells.length+1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#brush-current').evaluate(e=>e.classList.contains('active')),false,'Esc exits brush before changing object selection');
  assert.ok(await page.locator('[data-model-object].active').count()>0);
  await page.keyboard.press('Control+a');await page.keyboard.press('Control+j');
  await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===1);
  await page.locator('#viewport-brush-menu > summary').click();
  await page.locator('[data-tool="brush"]').click();
  const another={x:box.x+box.width*.84,y:box.y+box.height*.55};
  await page.mouse.click(another.x,another.y);changed=await getSaved();
  assert.equal(changed.canvases.find(c=>c.canvasId===activeId).cells.length,oldCells.length+2,'joined object still permits free drawing');
  assert.equal(changed.objects.length,1);
  const newest=changed.canvases.find(c=>c.canvasId===activeId).cells.at(-1);
  assert.equal(changed.palette[newest.color].toLowerCase(),desiredHex.toLowerCase(),'undo and canvas rebind keep the chosen brush color');
  assert.equal(await page.locator('#model-interaction-mode').inputValue(),'object');

  await page.locator('.modeling-tools > summary').click();
  await page.locator('#work-plane').selectOption('1');
  await page.locator('#work-plane-number').fill('3');
  await page.locator('#work-plane-number').press('Tab');
  await page.locator('.modeling-tools > summary').click();
  await page.locator('[data-ortho="front"]').click();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.mouse.click(box.x+box.width*.7,box.y+box.height*.4);
  changed=await getSaved();
  assert.ok(changed.canvases.find(c=>c.canvasId===activeId).cells.some(c=>c.y===3),'object mode work-plane controls paint on the chosen plane');
  assert.equal(await page.locator('#model-interaction-mode').inputValue(),'object');
  await page.keyboard.press('i');
  assert.equal(await page.locator('#editview').getAttribute('data-eyedropper'),'true','object mode supports the eyedropper');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#editview').getAttribute('data-eyedropper'),'false');
  assert.ok(await page.locator('[data-model-object].active').count()>0,'canceling eyedropper does not clear object selection');

  const beforeRandom=await getSaved();
  await page.locator('.modeling-tools > summary').click();
  await page.locator('#random-tone').click();
  await page.locator('dialog').filter({has:page.getByText('当前画布全部体素',{exact:true})}).waitFor();
  await page.getByLabel('随机强度').fill('100');
  await page.getByRole('button',{name:'应用',exact:true}).click();
  changed=await getSaved();
  assert.notDeepEqual(changed.canvases.find(c=>c.canvasId===activeId).cells,beforeRandom.canvases.find(c=>c.canvasId===activeId).cells,'object-mode tone randomization changes the active canvas');
  for(const c of beforeRandom.canvases.filter(c=>c.canvasId!==activeId))assert.deepEqual(changed.canvases.find(n=>n.canvasId===c.canvasId),c,'randomization leaves other canvases unchanged');
  const beforeEdge=changed.canvases.find(c=>c.canvasId===activeId).cells.length;
  await page.locator('#random-edge').click();
  await page.getByLabel('随机强度').fill('100');
  await page.getByLabel('边缘方式').selectOption('add');
  await page.getByRole('button',{name:'应用',exact:true}).click();
  changed=await getSaved();
  assert.ok(changed.canvases.find(c=>c.canvasId===activeId).cells.length>beforeEdge,'object-mode edge randomization adds boundary cells');
  assert.equal(await page.locator('#model-interaction-mode').inputValue(),'object');
  assert.deepEqual(errors,[]);console.log('object free modeling UI passed');
}finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();}
