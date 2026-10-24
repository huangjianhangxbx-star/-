import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as core from '../dist/workshop.cjs';
const temp=await fs.realpath(os.tmpdir()),root=await fs.mkdtemp(path.join(temp,'xh-pixel-'));
const profile=await fs.mkdtemp(path.join(temp,'xh-pixel-profile-'));
const cases=[
 {name:'diagonal',axis:2,step:.25,path:[[0,0],[1,0],[1,1],[2,1],[2,2]],clean:[[0,0],[1,1],[2,2]]},
 {name:'corner',axis:1,step:.125,path:[[0,0],[1,0],[1,1]],clean:[[0,0],[1,1]]},
 {name:'right-angle',axis:0,step:.0625,path:[[0,0],[1,0],[2,0],[2,1],[2,2]],clean:[[0,0],[1,0],[2,0],[2,1],[2,2]]},
 {name:'old-corner',axis:2,step:.25,old:true,path:[[0,0],[1,0],[1,1]],clean:[[0,0],[1,0],[1,1]]},
];
const project=core.createProject('pixel'),scene=core.createScene('scene');
const sources=new Map(),seeds=new Map();
for(const c of cases)for(const enabled of [false,true]){
 const id=c.name+(enabled?'-on':'-off'),asset=core.createAsset(id),axes=[0,1,2].filter(a=>a!==c.axis);
 const cells=[{x:-6,y:-6,z:-6,color:1},{x:6,y:6,z:6,color:1}];
 if(c.old){const p=[0,0,0];p[axes[0]]=1;cells.push({x:p[0],y:p[1],z:p[2],color:1});}
 asset.schema='xinghai-workshop-asset-2';asset.cells=[];asset.canvases=[{canvasId:'canvas-'+id,name:id,visible:true,locked:false,voxelStepM:c.step,originTicks:[0,0,0],cells,protectedColumns:[]}];
 asset.objects=[{objectId:'object-'+id,name:id,canvasIds:['canvas-'+id],cellKeys:cells.map(p=>[p.x,p.y,p.z].join(',')),originTicks:[0,0,0]}];
 const source='scenes/scene/assets/'+id+'.xhmodule.json';await fs.mkdir(path.dirname(path.join(root,source)),{recursive:true});await fs.writeFile(path.join(root,source),JSON.stringify(asset));sources.set(id,source);seeds.set(id,cells);
 scene.assets.push({kind:'voxel',assetId:id,source:'assets/'+id+'.xhmodule.json'});
}
scene.instances=[{instanceId:'one',assetId:'diagonal-off',positionM:[0,0,0],rotationDeg:0,groupId:'base'}];project.scenes=[{sceneId:'scene',name:'pixel',source:'scenes/scene/scene.xhscene.json'}];
await fs.writeFile(path.join(root,'project.xhproject.json'),JSON.stringify(project));await fs.writeFile(path.join(root,'scenes/scene/scene.xhscene.json'),JSON.stringify(scene));
const launch=()=>electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--test-hidden']:['.','--workspace=workshop','--test-hidden'],env:{...process.env,XINGHAI_TEST_PROFILE:profile},executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe'});
let app=await launch();
try{
 const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1500,height:1050});
 await app.evaluate(({dialog},root)=>dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]}),root);
 await page.getByRole('button',{name:'打开项目',exact:true}).click();await page.getByText('项目已打开',{exact:true}).waitFor();
 await page.locator('[data-workspace="assembly"]').click();await page.locator('[data-instance="one"]').click();await page.locator('#assembly-edit').click();
 const save=async(id)=>{await page.locator('#workshop-message').evaluate(e=>e.textContent='');await page.keyboard.press('Control+s');await page.getByText('草稿已保存',{exact:true}).waitFor();return JSON.parse(await fs.readFile(path.join(root,sources.get(id)),'utf8'));};
 for(const c of cases)for(const enabled of [false,true]){
  const id=c.name+(enabled?'-on':'-off');await page.locator('#module-tabs').selectOption(id);assert.equal(await page.locator('#pixel-perfect').isVisible(),false);
  await page.locator(`[data-model-object="object-${id}"]`).click();await page.keyboard.press('Tab');await page.locator('#pixel-perfect').waitFor();
  const beforePreference=await save(id);
  if((await page.locator('#pixel-perfect').getAttribute('aria-pressed')==='true')!==enabled)await page.locator('#pixel-perfect').click();
  assert.equal((await save(id)).revision,beforePreference.revision,'preference toggle never changes asset revision');
  await page.locator('#viewport-brush-menu > summary').click();await page.locator('[data-tool="brush"]').click();
  await page.locator(`[data-ortho="${['right','front','top'][c.axis]}"]`).click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const b=await page.locator('#editview canvas').boundingBox(),radius=Math.hypot(3.25,3.25,3.25)/2,scale=b.height*(5/(radius*1.15))/10,cell=.25*scale;
  const screen=([u,v])=>({x:b.x+b.width/2+u*cell,y:b.y+b.height/2-v*cell});
  await page.mouse.move(screen(c.path[0]).x,screen(c.path[0]).y);await page.mouse.down();
  for(const p of c.path.slice(1))await page.mouse.move(screen(p).x,screen(p).y);
  if(enabled){assert.ok(Number(await page.locator('#editview').getAttribute('data-pixel-stroke-count'))>0,'live preview while mouse is held');assert.equal(await page.locator('#count').textContent(),'体素 '+seeds.get(id).length,'source geometry stays unchanged during preview');}
  await page.mouse.up();const saved=await save(id),cells=saved.canvases[0].cells;
  const axes=[0,1,2].filter(a=>a!==c.axis),expected=(enabled?c.clean:c.path).map(([u,v])=>{const p=[0,0,0];p[axes[0]]=u;p[axes[1]]=v;return p.join(',');});
  const actual=cells.filter(p=>Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z))<6).map(p=>[p.x,p.y,p.z].join(','));
  assert.deepEqual(actual.sort(),[...new Set(expected)].sort(),id);
  if(c.old)assert.equal(cells.find(p=>p.x===1&&p.y===0&&p.z===0).color,1,'old corner retains color');
  await page.locator('#editview').screenshot({path:'validation/pixel-'+id+'.png'});
  await page.keyboard.press('Control+z');assert.deepEqual((await save(id)).canvases[0].cells,seeds.get(id),'one undo removes the whole stroke');
  await page.keyboard.press('Control+Shift+z');assert.deepEqual((await save(id)).canvases[0].cells,cells,'redo restores stroke');
  if(enabled){const start=screen([-2,2]),end=screen([-1,2]);
   const pending=async()=>{await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y);};
   await pending();await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual((await save(id)).canvases[0].cells,cells,'Esc cancels provisional stroke');
   await pending();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();assert.deepEqual((await save(id)).canvases[0].cells,cells,'blur cancels provisional stroke');
   await pending();const savedDuringStroke=await save(id);await page.mouse.up();assert.deepEqual(savedDuringStroke.canvases[0].cells,cells,'saving cancels provisional stroke safely');
  }
 }
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();app=await launch();
 const reopened=await app.firstWindow();reopened.on('pageerror',e=>errors.push(e.message));
 await app.evaluate(({dialog},root)=>dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]}),root);
 await reopened.getByRole('button',{name:'打开项目',exact:true}).click();await reopened.getByText('项目已打开',{exact:true}).waitFor();
 await reopened.locator('[data-workspace="assembly"]').click();await reopened.locator('[data-instance="one"]').click();await reopened.locator('#assembly-edit').click();
 await reopened.locator('#module-tabs').selectOption('diagonal-on');await reopened.locator('[data-model-object="object-diagonal-on"]').click();await reopened.keyboard.press('Tab');
 assert.equal(await reopened.locator('#count').textContent(),'体素 5','process reopen retains the three-cell diagonal and two seeds');
 assert.equal(await reopened.locator('#pixel-perfect').getAttribute('aria-pressed'),'true','local preference persists after restart');
 assert.deepEqual(errors,[]);console.log('pixel perfect UI: four on/off comparisons, three planes/precisions, preview, undo/redo, cancel, preference and process reopen passed');
}finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await app.close();}
