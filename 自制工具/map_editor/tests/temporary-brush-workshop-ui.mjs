// Full Workshop regression, with an isolated project/profile and a hidden
// Electron window. All modeling and stamping go through the real UI.
import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const temp=await fs.realpath(os.tmpdir());
const project=await fs.mkdtemp(path.join(temp,'xh-temp-brush-project-'));
const profile=await fs.mkdtemp(path.join(temp,'xh-temp-brush-profile-'));
const output=path.resolve('validation/temporary-brush-workshop-ui');
await fs.mkdir(output,{recursive:true});
const app=await electron.launch({
 args:process.env.XH_ELECTRON_EXECUTABLE?['--test-hidden']:['.','--test-hidden'],
 env:{...process.env,XINGHAI_TEST_PROFILE:profile},
 executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe',
});
let page;
const errors=[];
try{
 page=await app.firstWindow();page.setDefaultTimeout(12000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:1000});
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.isVisible())),false,'test windows must remain hidden');
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},project);
 await page.getByRole('button',{name:'新建项目',exact:true}).click();
 await page.getByRole('button',{name:'新建资产',exact:true}).click();
 await page.locator('#top').click();
 await page.locator('#viewport-brush-menu summary').click();
 await page.locator('[data-tool="brush"]').click();
 await page.locator('#brush-size').fill('1');
 let box=await page.locator('#editview canvas').boundingBox();
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 await page.getByText('体素 1',{exact:true}).waitFor();
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===1);

 async function save(){
  await page.locator('#workshop-message').evaluate(e=>e.textContent='');
  await page.getByRole('button',{name:'保存资产',exact:true}).click();
  await page.getByText('原生资产与搭建场景已保存',{exact:true}).waitFor();
  const manifest=JSON.parse(await fs.readFile(path.join(project,'project.xhproject.json'),'utf8'));
  return JSON.parse(await fs.readFile(path.join(project,manifest.assets[0].source),'utf8'));
 }
 const cells=doc=>(doc.canvases??[{cells:doc.cells}]).reduce((n,c)=>n+c.cells.length,0);
 const before=await save(),source=before.objects[0];
 assert.equal(cells(before),1);assert.equal(before.objects.length,1);
 const row=page.locator(`[data-model-object="${source.objectId}"]`);
 await row.click({button:'right'});
 await page.getByRole('menuitem',{name:'设为临时画笔',exact:true}).click();
 await page.waitForFunction(name=>document.querySelector('#temporary-object-brush-status')?.textContent.includes(name),source.name);
 await page.locator('#home').click();await page.locator('#top').click();
 box=await page.locator('#editview canvas').boundingBox();
 // A quarter of the viewport to the right of the sole voxel is empty XY work
 // plane. A left click must stamp immediately; this test never presses Enter.
 await page.mouse.move(box.x+box.width*.75,box.y+box.height/2);
 await page.mouse.click(box.x+box.width*.75,box.y+box.height/2);
 await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===2);
 const stamped=await save();
 assert.equal(cells(stamped),2,'one click stamps exactly one source voxel');
 assert.equal(stamped.objects.length,2,'stamp is a new independent object');
 assert.deepEqual(stamped.objects.find(o=>o.objectId===source.objectId),source,'source identity and cell membership stay unchanged');
 for(const canvasId of source.canvasIds){
  const prior=before.canvases.find(c=>c.canvasId===canvasId),after=stamped.canvases.find(c=>c.canvasId===canvasId);
  for(const cell of prior.cells)assert.ok(after.cells.some(c=>c.x===cell.x&&c.y===cell.y&&c.z===cell.z&&c.color===cell.color),'source voxel remains present');
 }
 const copy=stamped.objects.find(o=>o.objectId!==source.objectId);
 assert.match(await page.locator('#temporary-object-brush-status').innerText(),new RegExp(source.name),'brush persists across same-asset refresh');

 await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===1);
 const undone=await save();assert.equal(cells(undone),1);assert.deepEqual(undone.objects[0],source);
 await page.locator('#redo').click();await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===2);
 const redone=await save();assert.equal(cells(redone),2);assert.equal(redone.objects.length,2);
 await page.locator('#temporary-object-brush-reset').click();
 assert.match(await page.locator('#temporary-object-brush-status').innerText(),/当前画笔：体素格/);
 assert.equal(await page.locator('#temporary-object-brush-reset').isDisabled(),true);
 // Reset chooses the normal voxel tool. Esc restores object selection before
 // locating the stamped object through the viewport's real hit test.
 await page.keyboard.press('Escape');await page.locator('#home').click();await page.locator('#top').click();
 box=await page.locator('#editview canvas').boundingBox();
 const canvas=redone.canvases.find(c=>c.canvasId===copy.canvasIds[0]);
 const activeId=await page.locator('#editview').getAttribute('data-canvas-id');
 const active=redone.canvases.find(c=>c.canvasId===activeId);
 const activeCells=active.cells;
 const min=[0,1,2].map(i=>Math.min(...activeCells.map(c=>[c.x,c.y,c.z][i]))*.25);
 const max=[0,1,2].map(i=>Math.max(...activeCells.map(c=>[c.x,c.y,c.z][i]+1))*.25);
 const center=min.map((v,i)=>(v+max[i])/2),radius=Math.max(1,Math.hypot(...max.map((v,i)=>v-min[i]))/2);
 const scale=box.height*5/(radius*1.15)/10;
 const key=copy.cellKeys[0].split(',').map(Number);
 const physical=key.map((v,i)=>(canvas.originTicks[i]+(v+.5)*canvas.voxelStepM/.03125-active.originTicks[i])*.03125*.25/active.voxelStepM);
 const point={x:box.x+box.width/2+(physical[0]-center[0])*scale,y:box.y+box.height/2-(physical[1]-center[1])*scale};
 await page.mouse.click(point.x,point.y,{button:'right'});
 await page.getByRole('menuitem',{name:'设为临时画笔',exact:true}).click();
 await page.waitForFunction(id=>document.querySelector('#temporary-object-brush-status')?.dataset.sourceObject===id,copy.objectId);
 assert.match(await page.locator('#temporary-object-brush-status').innerText(),new RegExp(copy.name),'viewport context can replace the brush');
 // Explicitly choosing a normal tool must synchronize the brush status too.
 await page.locator('#viewport-brush-menu summary').click();await page.locator('[data-tool="brush"]').click();
 assert.match(await page.locator('#temporary-object-brush-status').innerText(),/当前画笔：体素格/);
 await page.waitForFunction(()=>{
  const title=document.querySelector('#tool-inspector h2')?.textContent??'';
  return title.includes('建模')&&title.includes('笔刷')&&!title.includes('临时物体画笔');
 },undefined,{timeout:2000});
 assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(output,'temporary-brush.png')});
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify({pass:true,hidden:true,project,profile,sourceObjectId:source.objectId,stampedObjectId:copy.objectId,checks:['tree context brush','immediate viewport stamp','source preserved','independent object','same asset brush persists','undo redo','restore voxel brush','viewport context replace','ordinary tool clears status'],errors},null,2));
 console.log('hidden Workshop temporary brush: stamp, source preservation, undo/redo, reset and viewport context passed');
}catch(error){
 if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
 await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:error.message,errors,project,profile},null,2));
 throw error;
}finally{
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});
 await app.close();
}
