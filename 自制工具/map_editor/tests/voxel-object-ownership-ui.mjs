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
const launch = () => process.env.XH_ELECTRON_EXECUTABLE
  ? electron.launch({args:['--workspace=workshop','--test-hidden'],env:{...process.env,XINGHAI_TEST_PROFILE:profile},executablePath:process.env.XH_ELECTRON_EXECUTABLE})
  : launchWorkshop();
let app = await launch();
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
    try{await page.getByText(process.env.XH_TEST_PROJECT_V2?'原生资产与试摆草稿已保存':'草稿已保存',{exact:true}).waitFor();}
    catch(error){console.error('ownership save diagnostics',await page.evaluate(()=>({footer:document.querySelector('#message')?.textContent,workshop:document.querySelector('#workshop-message')?.textContent,mode:(document.querySelector('#model-interaction-mode'))?.value,count:document.querySelector('#count')?.textContent})),errors);await page.screenshot({path:'validation/ownership-save-failure.png'});throw error;}
    return JSON.parse(await fs.readFile(path.join(root,source),'utf8'));
  };
  const readCanvas=(asset,id)=>asset.canvases.find(c=>c.canvasId===id);
  const before=await getSaved();
  assert.equal(await page.locator('[data-model-object]').count(),3,'legacy ungrouped cells become separate objects across two canvases');
  const activeId=await page.locator('#editview').getAttribute('data-canvas-id');
  await page.locator('#brush-current').click();
  const box=await page.locator('#editview canvas').boundingBox();
  const point={x:box.x+box.width*.62,y:box.y+box.height*.55};
  await page.mouse.click(point.x,point.y);
  let saved=await getSaved();
  assert.equal(readCanvas(saved,activeId).cells.length,readCanvas(before,activeId).cells.length+1);
  assert.equal(saved.objects.length,4,'object-mode paint creates a separate object');
  await page.keyboard.press('Escape');
  const sameCanvas=saved.objects.filter(o=>o.canvasIds.includes(activeId));
  assert.equal(sameCanvas.length,3);
  await page.locator(`[data-model-object="${sameCanvas[0].objectId}"]`).click();
  await page.locator(`[data-model-object="${sameCanvas[1].objectId}"]`).click({modifiers:['Shift']});
  await page.keyboard.press('Control+j');
  saved=await getSaved();
  assert.equal(saved.objects.length,3,'same-canvas join only combines chosen cells');
  const joined=saved.objects.find(o=>o.cellKeys.length===2);
  assert.ok(joined);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#model-interaction-mode').inputValue(),'edit');
  await page.keyboard.press('Control+z');
  assert.equal((await getSaved()).objects.length,4,'undo in Edit can cross a previous Object join');
  assert.equal(await page.locator('#count').textContent(),'体素 1','Edit history restoration scopes to a selected owner rather than exposing the whole canvas');
  await page.keyboard.press('Control+Shift+z');
  assert.equal((await getSaved()).objects.length,3);
  await page.locator('#viewport-brush-menu > summary').click();
  await page.locator('[data-tool="brush"]').click();
  await page.mouse.click(box.x+box.width*.82,box.y+box.height*.55);
  saved=await getSaved();
  assert.equal(saved.objects.length,3,'edit-mode paint joins the existing edited object');
  assert.equal(saved.objects.find(o=>o.objectId===joined.objectId).cellKeys.length,3);
  await page.keyboard.press('Tab');await page.keyboard.press('Control+z');
  assert.equal(await page.locator('#model-interaction-mode').inputValue(),'object');
  await page.locator('#brush-current').click();
  await page.mouse.click(box.x+box.width*.82,box.y+box.height*.55);
  const paintedAfterUndo=await getSaved();
  assert.equal(paintedAfterUndo.objects.length,4,'Object mode drawing after undoing an Edit stroke creates an independent object');
  assert.equal(paintedAfterUndo.objects.find(o=>o.objectId===joined.objectId).cellKeys.length,2,'undo never leaves invisible internal edit scope in Object mode');
  await page.keyboard.press('Escape');await page.keyboard.press('Control+z');
  await page.locator(`[data-model-object="${joined.objectId}"]`).click();await page.keyboard.press('Tab');
  await page.locator('#brush-current').click();await page.mouse.click(box.x+box.width*.82,box.y+box.height*.55);
  saved=await getSaved();
  assert.equal(saved.objects.find(o=>o.objectId===joined.objectId).cellKeys.length,3,'explicit Edit mode resumes owner scope after history navigation');
  const unrelated=saved.objects.filter(o=>o.objectId!==joined.objectId);
  await page.keyboard.press('Escape');
  await page.locator('#brush-current').click();
  const independentKeys=unrelated.find(o=>o.canvasIds.includes(activeId)).cellKeys;
  const independentCells=readCanvas(saved,activeId).cells.filter(c=>independentKeys.includes([c.x,c.y,c.z].join(',')));
  await page.locator('#native-all').evaluate(e=>e.click());
  await page.keyboard.press('Delete');
  await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='体素 0');
  const erased=await getSaved();
  assert.deepEqual(readCanvas(erased,activeId).cells.filter(c=>independentKeys.includes([c.x,c.y,c.z].join(','))),independentCells,'deleting edited-object internals never erases another object in the same canvas');
  assert.equal(readCanvas(erased,activeId).cells.length,independentCells.length,'all internal cells were removed');
  await page.keyboard.press('Control+z');
  assert.deepEqual(readCanvas(await getSaved(),activeId).cells,readCanvas(saved,activeId).cells,'undo restores internal edit');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#model-interaction-mode').inputValue(),'object');
  assert.deepEqual((await getSaved()).objects.filter(o=>o.objectId!==joined.objectId),unrelated);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+j');
  saved=await getSaved();
  assert.equal(saved.objects.length,3,'cross-canvas join is rejected without combining objects');
  await page.locator('#canvas-step').fill('0');
  await page.locator('#canvas-add').click();
  const addedId=await page.locator('#editview').getAttribute('data-canvas-id');
  assert.notEqual(addedId,activeId);
  await page.mouse.click(box.x+box.width*.72,box.y+box.height*.7);
  saved=await getSaved();
  const addedObject=saved.objects.find(o=>o.canvasIds.includes(addedId));
  assert.ok(addedObject,'new canvas creates an object only after actual painting');
  const identities=saved.objects.map(o=>o.objectId).sort();
  const addedCells=structuredClone(readCanvas(saved,addedId).cells);
  await page.keyboard.press('Escape');
  await page.locator('#canvas-target').selectOption(activeId);
  await page.locator('#canvas-merge-controls > summary').click();
  await page.locator(`#canvas-merge-controls input[value="${addedId}"]`).check();
  await page.locator('#canvas-merge').click();
  saved=await getSaved();
  assert.equal(saved.canvases.length,2,'merge removes only the chosen source canvas');
  assert.deepEqual(saved.objects.map(o=>o.objectId).sort(),identities,'canvas merge preserves independent object identity');
  assert.deepEqual(saved.objects.find(o=>o.objectId===addedObject.objectId).canvasIds,[activeId]);
  for(const cell of addedCells)assert.ok(readCanvas(saved,activeId).cells.some(c=>JSON.stringify(c)===JSON.stringify(cell)),'merge preserves source cells');
  assert.equal(readCanvas(saved,'fine').voxelStepM,.125,'other precision canvas remains unchanged');
  await page.keyboard.press('Control+z');
  assert.equal((await getSaved()).canvases.length,3,'canvas merge can be undone');
  await page.keyboard.press('Control+Shift+z');
  const final=await getSaved();
  assert.equal(final.canvases.length,2);
  assert.deepEqual(errors,[]);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();
  app=await launch();
  const reopened=await app.firstWindow();
  await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},root);
  await reopened.getByRole('button',{name:'打开项目',exact:true}).click();
  await reopened.getByText(process.env.XH_TEST_PROJECT_V2?'项目级资产库已打开':'项目已打开',{exact:true}).waitFor();
  await reopened.locator('[data-workspace="assembly"]').click();
  await reopened.locator('[data-instance="i0"]').click();await reopened.locator('#assembly-edit').click();
  assert.equal(await reopened.locator('[data-model-object]').count(),final.objects.length,'reopen restores separate identities');
  assert.equal(await reopened.locator('#canvas-target option').count(),2,'reopen restores merged canvases');
  await reopened.locator(`[data-model-object="${joined.objectId}"]`).click();await reopened.keyboard.press('Tab');
  assert.equal(await reopened.locator('#model-interaction-mode').inputValue(),'edit','saved joined owner can still enter internal edit');
  console.log('voxel object ownership UI passed');
}finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();}
