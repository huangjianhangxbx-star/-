import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as core from '../dist/workshop.cjs';

const root=await fs.mkdtemp(path.resolve('validation/rock-workshop-'));
const source='assets/rock/asset.xhmodule.json';
const box=(w,d,h)=>Array.from({length:w*d*h},(_,i)=>({x:i%w,y:Math.floor(i/w)%d,z:Math.floor(i/w/d),color:0}));
const asset=core.createAsset('rock');asset.schema='xinghai-workshop-asset-2';asset.name='岩体接入测试';
const wall=box(24,18,30),foreign=[{x:32,y:0,z:0,color:1}];
const rim=box(32,28,20).filter(c=>!(c.x>=18&&c.y>=15));
asset.canvases=[{canvasId:'wall',name:'岩壁',visible:true,locked:false,voxelStepM:.125,originTicks:[16,8,0],cells:[...wall,...foreign],baseCells:[...wall,...foreign],voxelCopies:[{copyId:'old-copy',cells:[wall[0]]}],protectedColumns:[],paintSource:{schema:'xinghai-surface-paint-1',density:64,faces:Object.fromEntries(wall.filter(c=>c.x===0).map(c=>[`${c.x},${c.y},${c.z},1`,{'0':'#f0c030'}]))}},
 {canvasId:'rim',name:'L平台',visible:true,locked:false,voxelStepM:.25,originTicks:[320,0,0],cells:rim,protectedColumns:[]}];
asset.objects=[{objectId:'wall-object',name:'岩壁',canvasIds:['wall'],originTicks:[16,8,0],cellKeys:wall.map(c=>`${c.x},${c.y},${c.z}`)},
 {objectId:'foreign',name:'旁边物体',canvasIds:['wall'],originTicks:[144,8,0],cellKeys:['32,0,0']},
 {objectId:'rim-object',name:'L平台',canvasIds:['rim'],originTicks:[320,0,0],cellKeys:rim.map(c=>`${c.x},${c.y},${c.z}`)}];
core.validateAsset(asset);
const scene={schema:'xinghai-workshop-scene-2',sceneId:'s',name:'岩体测试',revision:0,voxelSize:.25,instances:[{instanceId:'i',assetId:'rock',positionM:[0,0,0],rotationDeg:0,groupId:'base'}],groups:[{groupId:'base',name:'BASE',visible:true}],decals:[]};
const project={schema:'xinghai-workshop-project-2',projectId:'p',revision:0,name:'岩体测试',assets:[{kind:'voxel',assetId:'rock',name:asset.name,revision:0,preview:null,source}],scenes:[{sceneId:'s',name:scene.name,revision:0,preview:null,source:'scenes/s/scene.xhscene.json'}]};
for(const [file,data] of [['project.xhproject.json',project],['scenes/s/scene.xhscene.json',scene],[source,asset]]){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),JSON.stringify(data));}
const profile=path.join(root,'test-profile');await fs.mkdir(profile);
const launch=()=>electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--workspace=workshop','--test-hidden']:['.','--workspace=workshop','--test-hidden'],executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe',env:{...process.env,XINGHAI_TEST_PROFILE:profile}});
let app=await launch(),page;const errors=[];
const read=async()=>JSON.parse(await fs.readFile(path.join(root,source),'utf8'));
async function open(){page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1600,height:1040});await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},root);await page.getByRole('button',{name:'打开项目',exact:true}).click();await page.getByText('项目级资产库已打开',{exact:true}).waitFor();await page.locator('[data-workspace="assembly"]').click();await page.locator('[data-instance="i"]').click();await page.locator('#assembly-edit').click();}
async function save(){await page.locator('#workshop-message').evaluate(e=>e.textContent='');await page.keyboard.press('Control+s');await page.getByText('原生资产与试摆草稿已保存',{exact:true}).waitFor();return read();}
async function choose(id){await page.locator('#model-interaction-mode').selectOption('object');await page.locator(`[data-model-object="${id}"]`).click();await page.locator('#home').click();}
async function sculpt(){await page.locator('.modeling-tools summary').click();await page.locator('#rock-shaping').click();await page.locator('#rock-shape-panel').waitFor();await page.locator('#rock-status').waitFor();}
async function finish(){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
try{
 await open();await choose('wall-object');
 await save();
 await sculpt();assert.equal(await page.locator('dialog[open]').count(),0);
 const statusVisible=await page.locator('#rock-status').evaluate(e=>{const r=e.getBoundingClientRect(),p=e.closest('#rock-shape-panel').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom;});
 assert(statusVisible,'preview diagnostics must remain visible beside Apply without scrolling');
 const beforeOrbit=await page.locator('#editview canvas').screenshot();
 const viewport=await page.locator('#editview canvas').boundingBox();
 await page.mouse.move(viewport.x+viewport.width*.25,viewport.y+viewport.height*.45);await page.mouse.down({button:'right'});
 await page.mouse.move(viewport.x+viewport.width*.42,viewport.y+viewport.height*.62,{steps:8});await page.mouse.up({button:'right'});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 assert.notDeepEqual(await page.locator('#editview canvas').screenshot(),beforeOrbit,'camera must remain usable during preview');
 const preview=await page.locator('#editview').getAttribute('data-rock-preview-count');assert.ok(+preview<wall.length+foreign.length);
 const timing=await page.evaluate(()=>({sourceCells:12961,previewCells:Number(document.querySelector('#editview').dataset.rockPreviewCount),computeMs:Number(document.querySelector('#rock-shape-panel').dataset.computeMs),meshMs:Number(document.querySelector('#editview').dataset.rockMeshMs)}));
 await fs.writeFile(path.join(root,'performance.json'),JSON.stringify(timing,null,2));
 assert.deepEqual((await read()).canvases[0].cells,asset.canvases[0].cells,'preview must not save');
 await page.locator('#rock-shape-panel details summary').click();
 await page.locator('#rock-seed-breaks').fill('73');await page.locator('#rock-seed-breaks').press('Tab');
 await page.locator('#rock-shape-panel').waitFor();
 await page.keyboard.press('Escape');await page.locator('#rock-shape-panel').waitFor({state:'hidden'});
 assert.deepEqual((await save()).canvases[0].cells,asset.canvases[0].cells);
 await sculpt();await page.screenshot({path:path.join(root,'wall-preview.png')});await page.locator('#rock-apply').click();
 let changed=await save();assert.ok(changed.canvases[0].cells.length<asset.canvases[0].cells.length);
 assert.deepEqual(changed.canvases[0].paintSource,asset.canvases[0].paintSource);
 assert.deepEqual(changed.canvases[1],asset.canvases[1]);assert.ok(changed.canvases[0].cells.some(c=>c.x===32));
 await page.keyboard.press('Control+z');assert.deepEqual((await save()).canvases[0].cells,asset.canvases[0].cells);
 await page.keyboard.press('Control+Shift+z');assert.deepEqual((await save()).canvases[0].cells,changed.canvases[0].cells);
 await sculpt();await page.locator('#rock-protect-paint').uncheck();await page.locator('#rock-apply').click();
 const stripped=await save();assert.ok(Object.keys(stripped.canvases[0].paintSource.faces).length<Object.keys(changed.canvases[0].paintSource.faces).length);
 await page.keyboard.press('Control+z');assert.deepEqual((await save()).canvases,changed.canvases);
 await choose('rim-object');await sculpt();await page.locator('#rock-preset').selectOption('terraced-rim');
 await page.waitForFunction(()=>!document.querySelector('#rock-status').textContent.startsWith('等待'));
 await page.screenshot({path:path.join(root,'rim-preview.png')});await page.locator('#rock-apply').click();
 changed=await save();assert.ok(changed.canvases[1].cells.length<rim.length);
 const after=structuredClone(changed);
 await sculpt();await save();await page.locator('#rock-shape-panel').waitFor({state:'hidden'});assert.deepEqual((await read()).canvases,after.canvases);
 await finish();app=await launch();await open();assert.deepEqual((await read()).canvases,after.canvases);
 await choose('wall-object');await sculpt();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.locator('#rock-shape-panel').waitFor({state:'hidden'});
 assert.deepEqual((await save()).canvases,after.canvases);
 await page.keyboard.press('Tab');await page.waitForFunction(()=>document.querySelector('#model-interaction-mode').value==='edit');
 const editBefore=await save();assert.deepEqual(editBefore.canvases,after.canvases,'readonly edit sync preserves source layers');
 await sculpt();await page.locator('#rock-apply').click();const editChanged=await save();assert.ok(editChanged.canvases[0].cells.length<editBefore.canvases[0].cells.length);
 assert.ok(editChanged.canvases[0].baseCells);assert.ok(editChanged.canvases[0].voxelCopies);
 await page.keyboard.press('Control+z');assert.deepEqual((await save()).canvases,editBefore.canvases);
 assert.deepEqual(errors,[]);console.log('PASS Workshop rock: preview/cancel, bothpresets, painted protection, target isolation, Undo/Redo, savecancel, blur, actualrestart',root);
}finally{await finish();}
