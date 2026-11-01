// Real Workshop, hidden Electron window, isolated profile and scratch projects.
// Checks the user's modeling mode survives changes to interaction/document state.
import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const temp=await fs.realpath(os.tmpdir()),project=await fs.mkdtemp(path.join(temp,'xh-mode-project-')),profile=await fs.mkdtemp(path.join(temp,'xh-mode-profile-'));
const output=path.resolve('validation/modeling-mode-workshop-ui');await fs.mkdir(output,{recursive:true});
const app=await electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--test-hidden']:['.','--test-hidden'],env:{...process.env,XINGHAI_TEST_PROFILE:profile},executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe'});
let page;const errors=[];
try{
 page=await app.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize({width:1440,height:1000});
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.isVisible())),false);
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},project);
 await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByRole('button',{name:'新建资产',exact:true}).click();
 const selected=()=>page.locator('[data-mode][aria-pressed="true"]').getAttribute('data-mode');
 const expectMode=async(mode,reason)=>assert.equal(await selected(),mode,reason);
 const chooseMode=async mode=>{await page.locator('#mode-current').click();await page.locator(`[data-mode="${mode}"]`).click();};
 await expectMode('stack','new Workshop assets default to surface stacking');
 await page.locator('#mode-current').click();
 for(const mode of ['volume','stack','creative']){
  const item=page.locator(`[data-mode="${mode}"]`);assert.equal(await item.locator('svg.tool-icon').count(),1,mode+' menu item has a graphical icon');assert.ok((await item.textContent()).trim().length>0,mode+' retains its name');
 }
 for(const mode of ['property','model','event','decal'])assert.equal(await page.locator(`[data-mode="${mode}"]`).isVisible(),false,'unavailable Workshop mode stays hidden: '+mode);
 assert.equal(await page.locator('#mode-current svg.tool-icon').count(),1,'current-mode trigger has an icon');
 await page.screenshot({path:path.join(output,'default-mode-menu.png')});await page.locator('#mode-current').click();
 await page.locator('#top').click();await page.locator('#brush-current').click();
 const box=await page.locator('#editview canvas').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.getByText('体素 1',{exact:true}).waitFor();await page.keyboard.press('Escape');
 await chooseMode('creative');await expectMode('creative','user explicitly selects creative stacking');
 await page.locator('[data-model-object]').first().click();await expectMode('creative','selecting an object does not change modeling mode');
 await page.keyboard.press('Control+d');await page.waitForFunction(()=>document.querySelectorAll('[data-model-object]').length===2);await expectMode('creative','duplicate and same-asset refresh preserve user choice');
 await page.locator('#model-interaction-mode').selectOption('edit');await expectMode('creative','entering edit mode preserves user choice');
 await page.locator('#model-interaction-mode').selectOption('object');await expectMode('creative','returning to object mode preserves user choice');
 await page.locator('[data-model-object]').first().click({button:'right'});await page.getByRole('menuitem',{name:'设为临时画笔',exact:true}).click();
 await page.locator('#temporary-object-brush-reset').click();await expectMode('creative','restoring voxel brush restores the remembered modeling mode');
 await page.getByText('绘制平面',{exact:true}).click();
 await page.locator('#work-plane-number').fill('2');await page.locator('#work-plane-number').press('Tab');await expectMode('creative','changing work-plane position must not secretly switch to volume');
 await page.locator('#hierarchy-tabs').getByRole('button',{name:'画布',exact:true}).click();await page.locator('#canvas-create-menu summary').click();await page.locator('#canvas-add').click();
 await page.waitForFunction(()=>document.querySelectorAll('.canvas-layer-row').length===2);await expectMode('creative','adding a canvas preserves user choice');
 await page.getByRole('button',{name:'项目与资产',exact:true}).click();await page.getByRole('button',{name:'新建资产',exact:true}).click();await expectMode('creative','different assets use the last user preference');
 const secondProject=await fs.mkdtemp(path.join(temp,'xh-mode-reload-'));
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});dialog.showMessageBox=async()=>({response:1});},secondProject);
 await page.reload();await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByRole('button',{name:'新建资产',exact:true}).click();await expectMode('creative','user preference persists after renderer reload');
 await chooseMode('volume');await expectMode('volume','explicit working-plane modeling remains available');
 await page.screenshot({path:path.join(output,'remembered-modeling-mode.png')});assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify({pass:true,hidden:true,project,profile,checks:['default stack','icon and text menu','graphical current mode','object selection','duplicate refresh','object/edit mode','temporary brush reset','work-plane parameter','new canvas','cross asset preference','persisted reload preference','explicit volume selection'],errors},null,2));console.log('hidden Workshop modeling modes: default, graphics and persistent choice passed');
}catch(error){if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});const modes=page?await page.locator('[data-mode]').evaluateAll(items=>items.map(e=>({mode:e.dataset.mode,display:getComputedStyle(e).display,inline:e.getAttribute('style'),body:document.body.className,rules:[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules].filter(r=>r.selectorText&&e.matches(r.selectorText)&&r.style?.display).map(r=>({selector:r.selectorText,display:r.style.display}));}catch{return[];}})}))).catch(()=>[]):[];await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:error.message,errors,project,profile,modes},null,2));throw error;}
finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await app.close();}
