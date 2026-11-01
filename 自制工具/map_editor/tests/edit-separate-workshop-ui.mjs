// Full separation regression through a hidden, isolated Workshop instance.
// No renderer or production state is injected: selection, edits and transforms
// use normal visible controls and pointer input on the test window only.
import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as core from '../dist/workshop.cjs';
const temp=await fs.realpath(os.tmpdir()),project=await fs.mkdtemp(path.join(temp,'xh-separate-workshop-')),profile=await fs.mkdtemp(path.join(temp,'xh-separate-profile-'));
const output=path.resolve('validation/edit-separate-workshop-ui'),source='assets/a/asset.xhmodule.json';await fs.mkdir(output,{recursive:true});
const asset=core.createAsset('a');asset.schema='xinghai-workshop-asset-2';asset.name='完整岩台';asset.cells=[];
const baseCells=[0,1,2,3].map(x=>({x,y:0,z:0,color:0,owner:'volume'})),voxelCopies=[{copyId:'surface-copy',cells:[{x:0,y:0,z:0,color:1,owner:'volume'},{x:3,y:0,z:0,color:2,owner:'volume'}]}];
const cells=baseCells.map(c=>voxelCopies[0].cells.find(v=>v.x===c.x)??c);
const faces={'0,0,0,4':{'0':'#123456'},'2,0,0,4':{'2':'#334455'}};
asset.canvases=[{canvasId:'canvas',name:'主画布',visible:true,locked:false,voxelStepM:.25,originTicks:[0,0,0],cells,baseCells,voxelCopies,protectedColumns:[],paintSource:{schema:'xinghai-surface-paint-1',density:64,faces,layers:[{id:'paint',name:'手绘',visible:true,locked:false,faces},{id:'hidden',name:'隐藏稿',visible:false,locked:true,faces:{'0,0,0,4':{'3':'#778899'}}}]},faceTone:{schema:'xinghai-face-tone-1',faces:{'0,0,0,4':{gain:.6,affectPaint:true}}}}];
asset.objects=[{objectId:'original',name:'完整岩台',canvasIds:['canvas'],originTicks:[16,4,4],cellKeys:['0,0,0','1,0,0','2,0,0','3,0,0']}];
core.validateAsset(asset);
const scene=core.createScene('s');delete scene.assets;scene.schema='xinghai-workshop-scene-2';scene.instances=[{instanceId:'i',assetId:'a',positionM:[0,0,0],rotationDeg:0,groupId:'base'}];
const manifest={schema:'xinghai-workshop-project-2',projectId:'p',revision:0,name:'选区分离回归',assets:[{assetId:'a',kind:'voxel',name:asset.name,revision:0,preview:null,source}],scenes:[{sceneId:'s',name:scene.name,revision:0,source:'scenes/s/scene.xhscene.json',preview:null}]};
for(const [file,doc]of [['project.xhproject.json',manifest],['scenes/s/scene.xhscene.json',scene],[source,asset]]){await fs.mkdir(path.dirname(path.join(project,file)),{recursive:true});await fs.writeFile(path.join(project,file),JSON.stringify(doc));}
const launch=()=>electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--workspace=workshop','--test-hidden']:['.','--workspace=workshop','--test-hidden'],env:{...process.env,XINGHAI_TEST_PROFILE:profile},executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe'});
let app=await launch(),page;const errors=[];
async function open(){
 page=await app.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize({width:1440,height:1000});
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.isVisible())),false,'test never shows a desktop window');
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});dialog.showMessageBox=async()=>({response:1});},project);
 await page.getByRole('button',{name:'打开项目',exact:true}).click();await page.getByText('项目级资产库已打开',{exact:true}).waitFor();
 await page.locator('[data-workspace="assembly"]').click();await page.locator('[data-instance="i"]').click();await page.locator('#assembly-edit').click();
}
async function save(){await page.locator('#workshop-message').evaluate(e=>e.textContent='');await page.getByRole('button',{name:'保存资产',exact:true}).click();await page.getByText('原生资产与搭建场景已保存',{exact:true}).waitFor();return core.validateAsset(JSON.parse(await fs.readFile(path.join(project,source),'utf8')));}
async function topFit(){await page.locator('#home').click();await page.locator('#top').click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));return page.locator('#editview canvas').boundingBox();}
async function selectTool(kind){await page.locator('#viewport-brush-menu summary').click();await page.locator(`[data-tool="${kind}"]`).click();}
const owner=(doc,id)=>doc.objects.find(o=>o.objectId===id);
const count=()=>page.locator('#editview').getAttribute('data-selection-count');
try{
 await open();await page.locator('[data-model-object="original"]').click();await page.locator('#model-interaction-mode').selectOption('edit');
 const button=page.locator('#model-separate-selection');assert.equal(await button.count(),1,'edit mode needs a directly visible selection separation action');assert.equal(await button.isVisible(),true);assert.equal(await button.isDisabled(),true);
 const before=await save();let box=await topFit();
 // The native 4-cell row occupies x=0..1m and y=0..0.25m. Fit uses a minimum
 // radius of 1m; top view maps X horizontally and native Y upwards on screen.
 const scale=box.height*5/1.15/10;
 const first={x:box.x+box.width/2-.375*scale,y:box.y+box.height/2};
 await page.mouse.click(first.x,first.y);await page.waitForFunction(()=>document.querySelector('#editview').dataset.selectionCount==='1');assert.equal(await button.isEnabled(),true);assert.match(await button.innerText(),/1\s*格/);
 const overlaps=await button.evaluate(action=>{const a=action.getBoundingClientRect();return [...document.querySelectorAll('#editview')][0].parentElement.querySelectorAll('.view-actions button').values().some(b=>{const r=b.getBoundingClientRect();return r.width&&r.height&&Math.min(a.right,r.right)>Math.max(a.left,r.left)&&Math.min(a.bottom,r.bottom)>Math.max(a.top,r.top);});});assert.equal(overlaps,false,'separation does not cover move/rotate/view controls');
 await page.screenshot({path:path.join(output,'direct-action-enabled.png')});
 await button.click();await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===2);await page.getByText('体素 3',{exact:true}).waitFor();
 assert.equal(await page.locator('#model-interaction-mode').inputValue(),'edit');assert.equal(await page.locator('[data-model-object="original"]').getAttribute('class'),'model-object-row active');assert.equal(await count(),'0');
 let separated=await save();const part=separated.objects.find(o=>o.objectId!=='original');assert.deepEqual(owner(separated,'original').cellKeys,['1,0,0','2,0,0','3,0,0']);assert.deepEqual(part.cellKeys,['0,0,0']);assert.deepEqual(separated.canvases,before.canvases,'separation changes ownership while preserving editable paint and copy layers');
 await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===1);assert.deepEqual((await save()).objects,before.objects,'one undo restores joined ownership');
 await page.locator('#redo').click();await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===2);separated=await save();assert.deepEqual(owner(separated,part.objectId).cellKeys,['0,0,0']);assert.equal(await page.locator('#model-interaction-mode').inputValue(),'edit');await page.getByText('体素 3',{exact:true}).waitFor();
 // Brush-select over the separated position cannot bring it into the source's
 // edit scope. Delete and volume erase/paint at that same point are also noops.
 await page.mouse.move(first.x-10,first.y);await page.mouse.down();await page.mouse.move(first.x+10,first.y,{steps:5});await page.mouse.up();assert.equal(await count(),'0');await page.keyboard.press('Delete');assert.deepEqual((await save()).canvases,separated.canvases);
 await page.locator('#mode-current').click();await page.locator('[data-mode="volume"]').click();await selectTool('erase');await page.mouse.click(first.x,first.y);assert.deepEqual((await save()).canvases,separated.canvases,'source edit cannot erase a separated voxel');
 await selectTool('brush');await page.mouse.click(first.x,first.y);assert.deepEqual((await save()).canvases,separated.canvases,'source edit cannot paint over a separated voxel');
 await page.keyboard.press('Escape');await page.locator('#model-interaction-mode').selectOption('object');assert.equal(await button.isVisible(),false);await page.locator(`[data-model-object="${part.objectId}"]`).click();await page.locator('#model-interaction-mode').selectOption('edit');await page.getByText('体素 1',{exact:true}).waitFor();
 await page.locator('#model-interaction-mode').selectOption('object');await page.locator(`[data-model-object="${part.objectId}"]`).click();box=await topFit();await page.locator('#tool-move').click();
 const pivot={x:box.x+box.width/2,y:box.y+box.height/2};await page.mouse.move(pivot.x+33,pivot.y);await page.mouse.down();await page.mouse.move(pivot.x+365,pivot.y,{steps:14});await page.mouse.up();await page.waitForFunction(()=>document.querySelector('#editview').dataset.gizmoDelta?.split(',').some(v=>Number(v)!==0));
 const moved=await save(),movedPart=owner(moved,part.objectId);assert.notDeepEqual(movedPart.cellKeys,['0,0,0']);assert.ok(Number(movedPart.cellKeys[0].split(',')[0])>=4,'move lands away from the untouched source');assert.deepEqual(owner(moved,'original').cellKeys,['1,0,0','2,0,0','3,0,0']);assert.equal(moved.canvases[0].cells.length,4);assert.ok(moved.canvases[0].baseCells);assert.ok(moved.canvases[0].voxelCopies);assert.equal(moved.canvases[0].paintSource.layers[1].visible,false);
 await page.screenshot({path:path.join(output,'separated-object-moved.png')});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();app=await launch();await open();assert.equal(await page.locator('[data-model-object]').count(),2);await page.locator(`[data-model-object="${part.objectId}"]`).click();await page.locator('#model-interaction-mode').selectOption('edit');await page.getByText('体素 1',{exact:true}).waitFor();assert.deepEqual(owner(await save(),part.objectId).cellKeys,movedPart.cellKeys,'serialized independent ownership reopens in the actual Workshop');
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'result.json'),JSON.stringify({pass:true,hidden:true,project,profile,newObjectId:part.objectId,checks:['real edit selection','direct visible enabled action','no toolbar overlap','original edit remains scoped','separated selection blocked','erase/overwrite blocked','single undo redo','independent hierarchy edit','real gizmo move','native paint/copy layers retained','actual native project reopen'],errors},null,2));console.log('hidden Workshop separation: real selection, ownership isolation, undo/redo, move and reopen passed');
}catch(error){if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:error.message,errors,project,profile},null,2));throw error;}
finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await app.close();}
