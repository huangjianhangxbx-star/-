import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as core from '../dist/workshop.cjs';
const temp=await fs.realpath(os.tmpdir()),project=await fs.mkdtemp(path.join(temp,'xh-resample-workshop-')),profile=await fs.mkdtemp(path.join(temp,'xh-resample-profile-'));
const source='assets/a/asset.xhmodule.json',asset=core.createAsset('a');asset.schema='xinghai-workshop-asset-2';asset.name='重采样画布';asset.cells=[];
const baseCells=[{x:0,y:0,z:0,color:0,owner:'volume'}],voxelCopies=[{copyId:'overlay',cells:[{x:0,y:0,z:0,color:1,owner:'volume'}]}],faces={'0,0,0,4':{'17':'#d69b44','255':'#113355'}};
asset.canvases=[{canvasId:'canvas',name:'默认画布',visible:true,locked:false,voxelStepM:.25,originTicks:[16,-8,4],cells:voxelCopies[0].cells,baseCells,voxelCopies,protectedColumns:['0,0'],paintSource:{schema:'xinghai-surface-paint-1',density:64,faces,layers:[{id:'paint',name:'手绘',visible:true,locked:false,faces},{id:'hidden',name:'隐藏稿',visible:false,locked:true,faces:{'0,0,0,0':{'17':'#778899'}}}]},faceTone:{schema:'xinghai-face-tone-1',faces:{'0,0,0,4':{gain:.6,affectPaint:true}}}}];
asset.objects=[{objectId:'body',name:'原物体',canvasIds:['canvas'],originTicks:[20,-4,8],cellKeys:['0,0,0']}];core.validateAsset(asset);
const scene=core.createScene('s');delete scene.assets;scene.schema='xinghai-workshop-scene-2';scene.instances=[{instanceId:'i',assetId:'a',positionM:[0,0,0],rotationDeg:0,groupId:'base'}];
const manifest={schema:'xinghai-workshop-project-2',projectId:'p',revision:0,name:'画布单位回归',assets:[{assetId:'a',kind:'voxel',name:asset.name,revision:0,preview:null,source}],scenes:[{sceneId:'s',name:'既有场景',revision:0,source:'scenes/s/scene.xhscene.json',preview:null}]};
for(const [file,doc]of [['project.xhproject.json',manifest],['scenes/s/scene.xhscene.json',scene],[source,asset]]){await fs.mkdir(path.dirname(path.join(project,file)),{recursive:true});await fs.writeFile(path.join(project,file),JSON.stringify(doc));}
const launch=()=>electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--test-hidden']:['.','--test-hidden'],env:{...process.env,XINGHAI_TEST_PROFILE:profile},executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe'});
let app=await launch(),page;const errors=[];
async function open(){
 page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.isVisible())),false);
 await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});dialog.showMessageBox=async()=>({response:1});},project);
 await page.getByRole('button',{name:'打开项目',exact:true}).click();await page.getByText('项目级资产库已打开',{exact:true}).waitFor();await page.locator('[data-workspace="assembly"]').click();await page.locator('[data-instance="i"]').click();await page.locator('#assembly-edit').click();
 await page.locator('#hierarchy-tabs').getByRole('button',{name:'画布',exact:true}).click();await page.locator('.canvas-current-properties').evaluate(e=>e.open=true);
}
async function save(){await page.locator('#workshop-message').evaluate(e=>e.textContent='');await page.getByRole('button',{name:'保存资产',exact:true}).click();await page.getByText(/原生资产与(?:试摆草稿|搭建场景)已保存/).waitFor();return core.validateAsset(JSON.parse(await fs.readFile(path.join(project,source),'utf8')));}
const bounds=c=>({min:[0,1,2].map(a=>Math.min(...c.cells.map(v=>c.originTicks[a]*.03125+[v.x,v.y,v.z][a]*c.voxelStepM))),max:[0,1,2].map(a=>Math.max(...c.cells.map(v=>c.originTicks[a]*.03125+([v.x,v.y,v.z][a]+1)*c.voxelStepM)))});
try{
 await open();assert.equal(await page.locator('.canvas-layer-row').count(),1);assert.equal(await page.locator('#canvas-resample-step').inputValue(),'0.25');
 await page.locator('#canvas-resample-step').selectOption('0.125');await page.locator('#canvas-resample-apply').click();await page.waitForFunction(()=>document.querySelector('#editview').dataset.canvasStep==='0.125');
 const fine=await save(),fc=fine.canvases[0];assert.equal(fc.cells.length,8);assert.equal(fc.baseCells.length,8);assert.equal(fc.voxelCopies[0].cells.length,8);assert.equal(fc.voxelCopies[0].copyId,'overlay');assert.equal(fine.objects[0].objectId,'body');assert.equal(fine.objects[0].cellKeys.length,8);assert.deepEqual(bounds(fc),bounds(asset.canvases[0]));assert.deepEqual(fine.anchorM,asset.anchorM);assert.equal(fc.paintSource.layers.length,2);assert.equal(fc.paintSource.layers[1].visible,false);assert.equal(fc.paintSource.layers[1].locked,true);assert.equal(fc.protectedColumns.length,4);
 await page.keyboard.press('Control+z');const undone=await save();assert.deepEqual(undone.canvases[0],asset.canvases[0],'one undo restores every editable source field');
 await page.keyboard.press('Control+y');const redone=await save();assert.deepEqual(redone.canvases[0],fc);
 await page.locator('#canvas-resample-step').selectOption('0.25');await page.locator('#canvas-resample-apply').click();const back=await save();assert.deepEqual(back.canvases[0],asset.canvases[0],'full paint/tone/copy roundtrip is lossless');
 await page.locator('#canvas-resample-step').selectOption('0.125');await page.locator('#canvas-resample-apply').click();await save();
 await app.evaluate(({app})=>app.exit(0));await app.close().catch(()=>{});app=await launch();await open();assert.equal(await page.locator('#canvas-resample-step').inputValue(),'0.125');assert.equal((await save()).canvases[0].cells.length,8);
 assert.deepEqual(errors,[]);console.log('PASS editable canvas unit preserves world size / paint / copies, undo redo and reopen');
}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
