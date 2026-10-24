import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as core from '../dist/workshop.cjs';

// Optional real asset is read only; the app opens and edits an isolated project copy.
const originalPath=process.env.XH_ROCK_ARCH_SOURCE;
const original=originalPath?await fs.readFile(originalPath):null;
const asset=original?JSON.parse(original.toString()):core.createAsset('arch');
if(!original){
 const cells=[];
 for(let z=0;z<20;z++)for(let y=0;y<12;y++)for(let x=0;x<24;x++)
  if(!(x>=6&&x<18&&z<13))cells.push({x,y,z,color:0});
 for(let z=0;z<10;z++)cells.push({x:5,y:-1,z,color:0});
 asset.schema='xinghai-workshop-asset-2';
 asset.canvases=[{canvasId:'arch',name:'拱门',visible:true,locked:false,voxelStepM:.25,originTicks:[0,0,0],cells,protectedColumns:[]}];
 asset.objects=[{objectId:'arch',name:'拱门',canvasIds:['arch'],originTicks:[0,0,0],cellKeys:cells.map(c=>`${c.x},${c.y},${c.z}`)}];
}
core.validateAsset(asset);
const root=await fs.mkdtemp(path.resolve('validation/rock-arch-'));
const source=`assets/${asset.assetId}/asset.xhmodule.json`,objectId=asset.objects[0].objectId;
const scene={schema:'xinghai-workshop-scene-2',sceneId:'s',name:'拱门回归',revision:0,voxelSize:.25,instances:[{instanceId:'i',assetId:asset.assetId,positionM:[0,0,0],rotationDeg:0,groupId:'base'}],groups:[{groupId:'base',name:'BASE',visible:true}],decals:[]};
const project={schema:'xinghai-workshop-project-2',projectId:'p',revision:0,name:'拱门回归',assets:[{kind:'voxel',assetId:asset.assetId,name:asset.name,revision:0,preview:null,source}],scenes:[{sceneId:'s',name:scene.name,revision:0,preview:null,source:'scenes/s/scene.xhscene.json'}]};
for(const [file,data] of [['project.xhproject.json',project],['scenes/s/scene.xhscene.json',scene],[source,asset]]){
 await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),JSON.stringify(data));
}
const profile=path.join(root,'profile');await fs.mkdir(profile);
const launch=()=>electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--workspace=workshop','--test-hidden']:['.','--workspace=workshop','--test-hidden'],executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe',env:{...process.env,XINGHAI_TEST_PROFILE:profile}});
let app=await launch();
try{
 let page=await app.firstWindow();page.setDefaultTimeout(10000);await page.setViewportSize({width:1600,height:900});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},root);
 await page.getByRole('button',{name:'打开项目',exact:true}).click();await page.getByText('项目级资产库已打开',{exact:true}).waitFor();
 await page.locator('[data-workspace="assembly"]').click();await page.locator('[data-instance="i"]').click();await page.locator('#assembly-edit').click();
 await page.locator('#model-interaction-mode').selectOption('object');await page.locator(`[data-model-object="${objectId}"]`).click();await page.locator('#home').click();
 async function save(){await page.locator('#workshop-message').evaluate(e=>e.textContent='');await page.keyboard.press('Control+s');await page.getByText('原生资产与试摆草稿已保存',{exact:true}).waitFor();return JSON.parse(await fs.readFile(path.join(root,source),'utf8'));}
 async function sculpt(){await page.locator('.modeling-tools summary').click();await page.locator('#rock-shaping').click();await page.locator('#rock-shape-panel').waitFor();}
 async function slider(id,value){await page.locator(`#rock-${id}`).evaluate((e,value)=>{e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));},value);}
 async function updated(){await page.waitForFunction(()=>!document.querySelector('#rock-status').textContent.startsWith('等待'));}
 async function visibleStatus(){assert(await page.locator('#rock-status').evaluate(e=>{const r=e.getBoundingClientRect(),p=e.closest('#rock-shape-panel').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom;}));}
 const before=await save();await sculpt();
 assert.equal(await page.locator('#rock-side-4').count(),1,'top face must have a dedicated toggle');
 assert.equal(await page.locator('#rock-side-5').count(),1,'bottom face must have a dedicated toggle');
 assert.equal(await page.locator('#rock-side-4').isChecked(),false);assert.equal(await page.locator('#rock-side-5').isChecked(),false);
 for(const [id,value] of Object.entries({maxDepth:2,minWidth:4,maxWidth:8,continuity:18,breakStrength:.25,regularity:.55,chips:.08,minThickness:3}))await slider(id,value);
 await updated();await visibleStatus();assert.equal(await page.locator('#rock-apply').isEnabled(),true);
 const removed=Number(await page.locator('#editview').getAttribute('data-rock-preview-removed'));assert(removed>0);
 await page.screenshot({path:path.join(root,'arch-preview.png')});
 await page.locator('#rock-apply').click();const changed=await save();
 assert(changed.canvases[0].cells.length<before.canvases[0].cells.length);
 assert.deepEqual(changed.canvases[0].paintSource,before.canvases[0].paintSource);
 await page.keyboard.press('Control+z');assert.deepEqual((await save()).canvases,before.canvases);
 await page.keyboard.press('Control+Shift+z');assert.deepEqual((await save()).canvases,changed.canvases);
 await sculpt();await slider('maxDepth',0);await updated();await visibleStatus();
 assert.equal(await page.locator('#rock-apply').isDisabled(),true);
 assert.match(await page.locator('#rock-status').textContent(),/没有可应用/);
 await page.screenshot({path:path.join(root,'no-effect-reason.png')});
 await page.keyboard.press('Escape');assert.deepEqual((await save()).canvases,changed.canvases);
 // Return to the untouched arch, then enter local selection through the real tool entry.
 await page.keyboard.press('Control+z');assert.deepEqual((await save()).canvases,before.canvases);
 await sculpt();assert.match(await page.locator('#rock-scope').textContent(),/整个物体/);
 await page.locator('#rock-select-region').click();
 await page.waitForFunction(()=>document.querySelector('#editview').dataset.objectMode==='false');
 await sculpt();assert.match(await page.locator('#rock-status').textContent(),/先选择/);assert(await page.locator('#rock-apply').isDisabled());
 await page.keyboard.press('Escape');
 await page.locator('[data-ortho="right"]').click();
 await page.locator('#native-select').evaluate(e=>e.click());
 const canvas=await page.locator('#editview canvas').boundingBox();
 await page.mouse.move(canvas.x+65,canvas.y+80);await page.mouse.down();
 await page.mouse.move(canvas.x+canvas.width-80,canvas.y+canvas.height-12,{steps:12});await page.mouse.up();
 await page.waitForFunction(()=>Number(document.querySelector('#editview').dataset.selectionCount)>0&&document.querySelector('#editview').dataset.selectionBusy!=='true');
 let selectionCount=Number(await page.locator('#editview').getAttribute('data-selection-count'));
 let selectionBounds=JSON.parse(await page.locator('#editview').getAttribute('data-selection-bounds'));
 assert(selectionCount<before.canvases[0].cells.length,'must select a surface, not the entire owner');
 const localResults={};
 for(const preset of ['columnar-wall','terraced-rim']){
  if(preset==='terraced-rim'){
   await page.locator('#selection-clear').evaluate(e=>e.click());
   await page.locator('#native-select').evaluate(e=>e.click());
   await page.mouse.move(canvas.x+65,canvas.y+80);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width-80,canvas.y+canvas.height-12,{steps:12});await page.mouse.up();
   await page.waitForFunction(()=>Number(document.querySelector('#editview').dataset.selectionCount)>0&&document.querySelector('#editview').dataset.selectionBusy!=='true');
   selectionCount=Number(await page.locator('#editview').getAttribute('data-selection-count'));
   selectionBounds=JSON.parse(await page.locator('#editview').getAttribute('data-selection-bounds'));
  }
  await sculpt();assert.match(await page.locator('#rock-scope').textContent(),new RegExp(`当前选区 · ${selectionCount} 格`));
  assert.equal(await page.locator('#rock-protect-selection').count(),0);
  assert.equal(await page.locator('#rock-protect-columns').isChecked(),false);
  await page.locator('#rock-preset').selectOption(preset);
  if(preset==='columnar-wall')await slider('maxDepth',4);else {await slider('bandWidth',11);await slider('layers',5);}
  await slider('minThickness',3);
  await updated();assert(await page.locator('#rock-apply').isEnabled());
  const localRemoved=Number(await page.locator('#editview').getAttribute('data-rock-preview-removed'));assert(localRemoved>0&&localRemoved<=selectionCount);
  await page.screenshot({path:path.join(root,`local-${preset}.png`)});
  await page.locator('#rock-original').check();assert.equal(await page.locator('#editview').getAttribute('data-rock-preview-removed'),null);
  await page.locator('#rock-original').uncheck();assert.equal(Number(await page.locator('#editview').getAttribute('data-rock-preview-removed')),localRemoved);
  await page.locator('#rock-highlight').uncheck();assert.equal(await page.locator('#editview').getAttribute('data-rock-preview-highlighted'),'false');
  await page.screenshot({path:path.join(root,`local-${preset}-shape.png`)});
  await page.locator('#rock-apply').click();const local=await save(),afterKeys=new Set(local.canvases[0].cells.map(c=>`${c.x},${c.y},${c.z}`));
  const cuts=before.canvases[0].cells.filter(c=>!afterKeys.has(`${c.x},${c.y},${c.z}`));
  assert.equal(cuts.length,localRemoved);
  for(const c of cuts)for(const [axis,name] of ['x','y','z'].entries())assert(c[name]>=selectionBounds.min[axis]&&c[name]<=selectionBounds.max[axis],'local cuts stay inside the actual UI selection bounds');
  assert.deepEqual(local.canvases[0].paintSource,before.canvases[0].paintSource);
  localResults[preset]={removed:localRemoved,selectionCount,selectionBounds};
  await page.keyboard.press('Control+z');assert.deepEqual((await save()).canvases,before.canvases);
 }
 const growthResults={};let lastGrowth;
 const sourceKeys=new Set(before.canvases[0].cells.map(c=>`${c.x},${c.y},${c.z}`));
 const maxX=Math.max(...before.canvases[0].cells.map(c=>c.x));
 for(const preset of ['columnar-wall','terraced-rim'])for(const operation of ['grow','both']){
  await page.locator('#selection-clear').evaluate(e=>e.click());await page.locator('#native-select').evaluate(e=>e.click());
  await page.mouse.move(canvas.x+65,canvas.y+80);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width-80,canvas.y+canvas.height-12,{steps:12});await page.mouse.up();
  await page.waitForFunction(()=>Number(document.querySelector('#editview').dataset.selectionCount)>0&&document.querySelector('#editview').dataset.selectionBusy!=='true');
  await sculpt();await page.locator('#rock-preset').selectOption(preset);await page.locator('#rock-operation').selectOption(operation);await slider('maxOutward',4);
  if(operation==='both')await slider(preset==='columnar-wall'?'maxDepth':'bandWidth',4);
  for(const side of [1,2,3])await page.locator(`#rock-side-${side}`).uncheck();
  await updated();assert(await page.locator('#rock-apply').isEnabled());
  const added=Number(await page.locator('#editview').getAttribute('data-rock-preview-added')),cut=Number(await page.locator('#editview').getAttribute('data-rock-preview-removed'));
  assert(added>0);if(operation==='grow')assert.equal(cut,0);else assert(cut>0);
  assert.equal(Number(await page.locator('#editview').getAttribute('data-rock-preview-count')),before.canvases[0].cells.length+added-cut);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,source),'utf8')).canvases,before.canvases,'growth preview must not save');
  await page.screenshot({path:path.join(root,`${preset}-${operation}.png`)});
  await page.locator('#rock-original').check();assert.equal(await page.locator('#editview').getAttribute('data-rock-preview-added'),null);await page.locator('#rock-original').uncheck();
  await page.locator('#rock-apply').click();lastGrowth=await save();
  const newCells=lastGrowth.canvases[0].cells.filter(c=>!sourceKeys.has(`${c.x},${c.y},${c.z}`));assert.equal(newCells.length,added);
  assert(Math.max(...newCells.map(c=>c.x))>maxX);assert(newCells.every(c=>c.x<=maxX+4));
  const owner=lastGrowth.objects.find(o=>o.objectId===objectId);for(const c of newCells)assert(owner.cellKeys.includes(`${c.x},${c.y},${c.z}`));
  assert.deepEqual(lastGrowth.canvases[0].paintSource,before.canvases[0].paintSource);
  await page.keyboard.press('Control+z');assert.deepEqual((await save()).canvases,before.canvases);
  await page.keyboard.press('Control+Shift+z');assert.deepEqual((await save()).canvases,lastGrowth.canvases);
  await page.keyboard.press('Control+z');assert.deepEqual((await save()).canvases,before.canvases);
  growthResults[`${preset}-${operation}`]={added,removed:cut};
 }
 await page.keyboard.press('Control+Shift+z');assert.deepEqual((await save()).canvases,lastGrowth.canvases);
 await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});app=await launch();page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},root);
 await page.getByRole('button',{name:'打开项目',exact:true}).click();await page.getByText('项目级资产库已打开',{exact:true}).waitFor();
 await page.locator('[data-workspace="assembly"]').click();await page.locator('[data-instance="i"]').click();await page.locator('#assembly-edit').click();
 assert.deepEqual((await save()).canvases,lastGrowth.canvases,'grown cells must survive actual application restart');
 // New window: top/bottom opt-in, axial limits, native ownership/history and combined six-face sculpt.
 await page.setViewportSize({width:1800,height:1100});await page.locator('#model-interaction-mode').selectOption('object');
 await page.locator(`[data-model-object="${objectId}"]`).click();await page.locator('#home').click();
 const zBefore=await save(),zKeys=new Set(zBefore.canvases[0].cells.map(c=>`${c.x},${c.y},${c.z}`));
 const minZ=Math.min(...zBefore.canvases[0].cells.map(c=>c.z)),maxZ=Math.max(...zBefore.canvases[0].cells.map(c=>c.z)),zResults={};
 for(const side of [4,5]){
  await sculpt();if(side===4){assert.equal(await page.locator('#rock-side-4').isChecked(),false);assert.equal(await page.locator('#rock-side-5').isChecked(),false);}
  await page.locator('#rock-operation').selectOption('grow');await slider('maxOutward',4);
  for(let index=0;index<6;index++)await page.locator(`#rock-side-${index}`).setChecked(index===side);
  await updated();assert(await page.locator('#rock-apply').isEnabled());
  const added=Number(await page.locator('#editview').getAttribute('data-rock-preview-added'));assert(added>0);
  assert.equal(Number(await page.locator('#editview').getAttribute('data-rock-preview-removed')),0);
  const zView=await page.locator('#editview canvas').boundingBox();await page.mouse.move(zView.x+zView.width*.2,zView.y+zView.height*.5);await page.mouse.down({button:'right'});
  await page.mouse.move(zView.x+zView.width*.35,zView.y+zView.height*.62,{steps:8});await page.mouse.up({button:'right'});
  await page.screenshot({path:path.join(root,`z-${side}-preview.png`)});await page.locator('#rock-apply').click();
  const zChanged=await save(),newCells=zChanged.canvases[0].cells.filter(c=>!zKeys.has(`${c.x},${c.y},${c.z}`));assert.equal(newCells.length,added);
  assert(side===4?Math.max(...newCells.map(c=>c.z))>maxZ:Math.min(...newCells.map(c=>c.z))<minZ);
  assert(newCells.every(c=>c.z>=minZ-4&&c.z<=maxZ+4));
  for(const c of newCells)assert(zChanged.objects.find(o=>o.objectId===objectId).cellKeys.includes(`${c.x},${c.y},${c.z}`));
  assert.deepEqual(zChanged.anchorM,zBefore.anchorM);assert.deepEqual(zChanged.canvases[0].paintSource,zBefore.canvases[0].paintSource);
  await page.keyboard.press('Control+z');assert.deepEqual((await save()).canvases,zBefore.canvases);
  await page.keyboard.press('Control+Shift+z');assert.deepEqual((await save()).canvases,zChanged.canvases);
  await page.keyboard.press('Control+z');assert.deepEqual((await save()).canvases,zBefore.canvases);zResults[side]=added;
 }
 await sculpt();await page.locator('#rock-preset').selectOption('terraced-rim');await page.locator('#rock-operation').selectOption('both');await slider('maxOutward',3);await slider('bandWidth',4);
 for(let index=0;index<6;index++)await page.locator(`#rock-side-${index}`).check();await updated();
 assert(await page.locator('#rock-apply').isEnabled());
 assert(Number(await page.locator('#editview').getAttribute('data-rock-preview-added'))>0);assert(Number(await page.locator('#editview').getAttribute('data-rock-preview-removed'))>0);
 await page.screenshot({path:path.join(root,'six-face-both.png')});await page.locator('#rock-apply').click();const six=await save();
 assert.equal(new Set(six.canvases[0].cells.map(c=>`${c.x},${c.y},${c.z}`)).size,six.canvases[0].cells.length);
 await page.keyboard.press('Control+z');assert.deepEqual((await save()).canvases,zBefore.canvases);
 await page.keyboard.press('Control+Shift+z');assert.deepEqual((await save()).canvases,six.canvases);
 await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});app=await launch();page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},root);
 await page.getByRole('button',{name:'打开项目',exact:true}).click();await page.getByText('项目级资产库已打开',{exact:true}).waitFor();
 await page.locator('[data-workspace="assembly"]').click();await page.locator('[data-instance="i"]').click();await page.locator('#assembly-edit').click();
 assert.deepEqual((await save()).canvases,six.canvases,'six-face sculpt survives actual restart');
 if(original){
  const cells=asset.canvases[0].cells,maxX=Math.max(...cells.map(c=>c.x));
  const selectionKeys=new Set(cells.filter(c=>c.x===maxX).map(c=>`${c.x},${c.y},${c.z}`));
  for(const preset of ['columnar-wall','terraced-rim']){
   const p=core.planRockAsset(asset,objectId,{...core.DEFAULT_ROCK_OPTIONS,preset,maxDepth:8,minThickness:5,bandWidth:11,layers:5},{selectionKeys});
   assert(p.result.removedCellKeys.length>0);assert(p.result.removedCellKeys.every(k=>selectionKeys.has(k)));
   localResults[`exact-${preset}`]={selected:selectionKeys.size,removed:p.result.removedCellKeys.length};
  }
 }
 assert.deepEqual(errors,[]);
 if(original)assert.deepEqual(await fs.readFile(originalPath),original,'user original must remain byte-identical');
 await fs.writeFile(path.join(root,'result.json'),JSON.stringify({sourceCells:before.canvases[0].cells.length,removed,selectionCount,selectionBounds,localResults,growthResults,zResults,originalUntouched:!!original,checks:['preview','apply','paint preserved','undo','redo','visible no-op reason','mode entry','empty edit blocked','both presets on actual screen-selected surface','growth and bidirectional both presets','outward bounds','new cell ownership','actual restart','Z defaults off','top growth','bottom growth','six-face both and restart']},null,2));
 console.log('PASS arch preview/apply/undo/redo and visible no-effect reason',root);
}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
