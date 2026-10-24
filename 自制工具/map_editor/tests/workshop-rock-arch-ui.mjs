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
const app=await electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--workspace=workshop','--test-hidden']:['.','--workspace=workshop','--test-hidden'],executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe',env:{...process.env,XINGHAI_TEST_PROFILE:profile}});
try{
 const page=await app.firstWindow();page.setDefaultTimeout(10000);await page.setViewportSize({width:1600,height:900});
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
 assert.deepEqual(errors,[]);
 if(original)assert.deepEqual(await fs.readFile(originalPath),original,'user original must remain byte-identical');
 await fs.writeFile(path.join(root,'result.json'),JSON.stringify({sourceCells:before.canvases[0].cells.length,removed,originalUntouched:!!original,checks:['preview','apply','paint preserved','undo','redo','visible no-op reason']},null,2));
 console.log('PASS arch preview/apply/undo/redo and visible no-effect reason',root);
}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
