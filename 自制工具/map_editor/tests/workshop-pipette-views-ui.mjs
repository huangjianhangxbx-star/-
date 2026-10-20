import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const project=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'xh-pipette-'));
const profile=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'xh-pipette-profile-'));
const app=await electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--test-hidden']:['.','--test-hidden'],env:{...process.env,XINGHAI_TEST_PROFILE:profile},executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe'});
try{
 const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:900});
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},project);
 await page.getByRole('button',{name:'新建项目',exact:true}).click();
 await page.getByRole('button',{name:'新建资产',exact:true}).click();
 let canvas=await page.locator('#editview canvas').boundingBox();
 await page.mouse.click(canvas.x+canvas.width/2,canvas.y+canvas.height/2);
 await page.getByText('体素 1',{exact:true}).waitFor();
 await page.locator('#color-wheel').scrollIntoViewIfNeeded();
 const wheel=await page.locator('#color-wheel').boundingBox();
 await page.mouse.click(wheel.x+wheel.width*.72,wheel.y+wheel.height*.32);
 canvas=await page.locator('#editview canvas').boundingBox();
 await page.mouse.click(canvas.x+canvas.width/2+75,canvas.y+canvas.height/2);
 await page.getByText('体素 2',{exact:true}).waitFor();

 assert.equal(await page.locator('#pick-color').count(),1,'the color panel exposes a pipette');
 await page.locator('#pick-color').click();
 assert.equal(await page.locator('#pick-color').getAttribute('aria-pressed'),'true');
 await page.mouse.click(canvas.x+canvas.width/2,canvas.y+canvas.height/2);
 assert.equal(await page.locator('#palette button').first().getAttribute('aria-pressed'),'true','pipette chooses the touched voxel color');
 assert.equal(await page.locator('#color-hex').inputValue(),'#59737a');
 assert.equal(await page.locator('#pick-color').getAttribute('aria-pressed'),'false','pipette returns to the previous editing tool');
 assert.equal(await page.locator('#count').textContent(),'体素 2','sampling must not paint or remove voxels');
 await page.keyboard.press('i');
 assert.equal(await page.locator('#tool-eyedropper').getAttribute('aria-pressed'),'true');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#pick-color').getAttribute('aria-pressed'),'false');
 await page.locator('#selection-brush').click();
 await page.locator('#native-all').click();
 await page.locator('#pick-color').click();
 await page.mouse.click(canvas.x+canvas.width/2+75,canvas.y+canvas.height/2);
 assert.equal(await page.locator('#palette button').last().getAttribute('aria-pressed'),'true','pipette works over a selected model without dragging the gizmo');
 assert.equal(await page.locator('#count').textContent(),'体素 2');

 const axes=['top','bottom','front','back','left','right'];
 const screenshots=new Map();
 for(const axis of axes){
  await page.locator('#home').click();
  await page.mouse.move(canvas.x+canvas.width*.25,canvas.y+canvas.height*.7);
  await page.mouse.down({button:'right'});
  await page.mouse.move(canvas.x+canvas.width*.25+70,canvas.y+canvas.height*.7);
  await page.mouse.up({button:'right'});
  await page.locator(`[data-ortho="${axis}"]`).click();
  assert.equal(await page.locator('#editview').getAttribute('data-view-axis'),axis);
  assert.equal(await page.locator(`[data-ortho="${axis}"]`).getAttribute('aria-pressed'),'true');
  screenshots.set(axis,await page.locator('#editview canvas').screenshot());
  await page.locator(`[data-ortho="${axis}"]`).click();
  const opposite={top:'bottom',bottom:'top',front:'back',back:'front',left:'right',right:'left'}[axis];
  assert.equal(await page.locator('#editview').getAttribute('data-view-axis'),opposite,'clicking the facing axis switches to its opposite');
 }
 assert.notDeepEqual(screenshots.get('top'),screenshots.get('front'),'top and front show different faces');
 assert.notDeepEqual(screenshots.get('top'),screenshots.get('bottom'),'top and bottom show opposite faces');
 assert.notDeepEqual(screenshots.get('front'),screenshots.get('back'),'opposite faces have different orientations');
 await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);
 await page.mouse.down({button:'right'});
 await page.mouse.move(canvas.x+canvas.width/2+70,canvas.y+canvas.height/2+30);
 await page.mouse.up({button:'right'});
 await page.waitForFunction(()=>document.querySelector('#editview')?.getAttribute('data-view-axis')==='free');
 assert.equal(await page.locator('.ortho-nav button[aria-pressed="true"]').count(),0,'manual orbit clears the active face marker');
 if(process.env.XH_UI_SCREENSHOT)await page.screenshot({path:process.env.XH_UI_SCREENSHOT});
 assert.deepEqual(errors,[]);
 console.log('pipette and six orthographic views: sampled voxel color without mutation, switched visible camera faces');
}finally{
 await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});
 await fs.rm(project,{recursive:true,force:true});await fs.rm(profile,{recursive:true,force:true});
}
