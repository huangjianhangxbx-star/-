import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const project=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'xh-object-viewport-'));
const profile=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'xh-object-viewport-profile-'));
const app=await electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--test-hidden']:['.','--test-hidden'],env:{...process.env,XINGHAI_TEST_PROFILE:profile},executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe'});
try{
 const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},project);
 await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByRole('button',{name:'新建资产',exact:true}).click();
 await page.locator('#viewport-brush-menu summary').click();await page.locator('[data-tool="brush"]').click();await page.locator('#brush-size').fill('3');
 let b=await page.locator('#editview canvas').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.getByText('体素 9',{exact:true}).waitFor();
 assert.equal(await page.locator('#model-interaction-mode').inputValue(),'object','new assets start in object mode while allowing painting');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#editview')?.dataset.objectMode==='true');
 assert.equal(await page.locator('[data-tool="brush"]').getAttribute('aria-pressed'),'false','Esc leaves the brush and restores whole-object controls');
 assert.equal(await page.locator('#selection-gizmo').count(),0,'axis toggle removed');
 await page.keyboard.press('Control+d');await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===2);
 async function save(){await page.locator('#workshop-message').evaluate(e=>e.textContent='');await page.getByRole('button',{name:'保存资产',exact:true}).click();await page.getByText('原生资产与试摆草稿已保存',{exact:true}).waitFor();const manifest=JSON.parse(await fs.readFile(path.join(project,'project.xhproject.json'),'utf8'));return JSON.parse(await fs.readFile(path.join(project,manifest.assets[0].source),'utf8'));}
 const before=await save(),activeId=await page.locator('#editview').getAttribute('data-canvas-id'),active=before.canvases.find(c=>c.canvasId===activeId),object=before.objects.find(o=>o.canvasIds.includes(activeId));
 assert.equal(before.objects.length,2);await page.locator('#home').click();await page.locator('#top').click();
 await page.screenshot({path:'validation/model-object-viewport-before.png'});b=await page.locator('#editview canvas').boundingBox();
 const min=[0,1,2].map(i=>Math.min(...active.cells.map(c=>[c.x,c.y,c.z][i]))*.25),max=[0,1,2].map(i=>Math.max(...active.cells.map(c=>[c.x,c.y,c.z][i]+1))*.25),center=min.map((v,i)=>(v+max[i])/2),radius=Math.max(1,Math.hypot(...max.map((v,i)=>v-min[i]))/2),zoom=5/(radius*1.15),scale=b.height*zoom/10;
 const origin=object.originTicks.map((v,i)=>(v-active.originTicks[i])*.03125*.25/active.voxelStepM);
 const pivot={x:b.x+b.width/2+(origin[0]-center[0])*scale,y:b.y+b.height/2-(origin[1]-center[1])*scale};
 await page.mouse.move(pivot.x+33,pivot.y);await page.mouse.down();await page.mouse.move(pivot.x+123,pivot.y,{steps:12});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#editview')?.dataset.gizmoDelta?.split(',').some(v=>Number(v)!==0));
 const moved=await save(),movedObject=moved.objects.find(o=>o.objectId===object.objectId);assert.ok(movedObject.originTicks[0]>object.originTicks[0],'axis moves the duplicate');
 const original=before.objects.find(o=>o.objectId!==object.objectId);assert.deepEqual(moved.objects.find(o=>o.objectId===original.objectId).originTicks,original.originTicks,'original stays at source');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#editview')?.dataset.objectSelection==='[]');
 // The source remains at the previous fitted center. A plain left click selects it as one object.
 await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.waitForFunction(id=>document.querySelector('#editview')?.dataset.objectSelection===JSON.stringify([id]),original.canvasIds[0]);
 await page.mouse.move(b.x+8,b.y+80);await page.mouse.down();await page.mouse.move(b.x+b.width-8,b.y+b.height-8,{steps:12});await page.mouse.up();await page.waitForFunction(()=>JSON.parse(document.querySelector('#editview').dataset.objectSelection).length===2);
 await page.keyboard.down('Control');await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.keyboard.up('Control');await page.waitForFunction(id=>!JSON.parse(document.querySelector('#editview').dataset.objectSelection).includes(id),original.canvasIds[0]);
 await page.keyboard.down('Shift');await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.keyboard.up('Shift');await page.waitForFunction(()=>JSON.parse(document.querySelector('#editview').dataset.objectSelection).length===2);

 await page.locator(`[data-model-object="${original.objectId}"]`).click();await page.locator('#model-object-actions summary').click();await page.locator('#model-object-rotate').click();
 const rotated=await save(),sourceCanvas=rotated.canvases.find(c=>c.canvasId===original.canvasIds[0]);assert.notDeepEqual(sourceCanvas.cells,before.canvases.find(c=>c.canvasId===original.canvasIds[0]).cells,'object rotate rewrites voxel data around object origin');
 await page.locator('#model-object-actions summary').click();
 await page.locator('#home').click();await page.locator('#top').click();await page.locator('#tool-rotate').click();await page.screenshot({path:'validation/model-object-rotation.png'});
 b=await page.locator('#editview canvas').boundingBox();const rmin=[0,1,2].map(i=>Math.min(...sourceCanvas.cells.map(c=>[c.x,c.y,c.z][i]))*.25),rmax=[0,1,2].map(i=>Math.max(...sourceCanvas.cells.map(c=>[c.x,c.y,c.z][i]+1))*.25),rc=rmin.map((v,i)=>(v+rmax[i])/2),rr=Math.max(1,Math.hypot(...rmax.map((v,i)=>v-rmin[i]))/2),rs=b.height*5/(rr*1.15)/10;
 const ro=rotated.objects.find(o=>o.objectId===original.objectId).originTicks.map((v,i)=>(v-sourceCanvas.originTicks[i])*.03125*.25/sourceCanvas.voxelStepM),rp={x:b.x+b.width/2+(ro[0]-rc[0])*rs,y:b.y+b.height/2-(ro[1]-rc[1])*rs},handle=b.height*.1/Math.sqrt(2);
 await page.mouse.move(rp.x+handle,rp.y-handle);await page.mouse.down();await page.mouse.move(rp.x+handle,rp.y+handle,{steps:12});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#editview')?.dataset.gizmoRotation?.includes('90'));
 const ringRotated=await save();assert.notDeepEqual(ringRotated.canvases.find(c=>c.canvasId===original.canvasIds[0]).cells,sourceCanvas.cells,'rotation ring commits its preview');assert.deepEqual(ringRotated.canvases.find(c=>c.canvasId===original.canvasIds[0]).cells,before.canvases.find(c=>c.canvasId===original.canvasIds[0]).cells,'clockwise ring returns the prior counterclockwise quarter turn');
 await page.keyboard.press('Tab');await page.waitForFunction(()=>document.querySelector('#editview')?.dataset.objectMode==='false');
 assert.deepEqual(errors,[]);await page.screenshot({path:'validation/model-object-viewport-after.png'});console.log('object viewport: Tab, whole-object click/box, duplicate-axis movement, rotation, mode isolation passed');
}finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await app.close();}
