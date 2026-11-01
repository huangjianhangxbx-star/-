import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const temp=await fs.realpath(os.tmpdir()),project=await fs.mkdtemp(path.join(temp,'xh-tool-keys-project-')),profile=await fs.mkdtemp(path.join(temp,'xh-tool-keys-profile-'));
const app=await electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--test-hidden']:['.','--test-hidden'],env:{...process.env,XINGHAI_TEST_PROFILE:profile},executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe'});
try{
 const page=await app.firstWindow();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.isVisible())),false);
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},project);
 await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByRole('button',{name:'新建资产',exact:true}).click();
 await page.keyboard.press('t');assert.equal(await page.locator('[data-tool="brush"]').getAttribute('aria-pressed'),'true','T enables the brush instead of leaving selection mode');
 assert.equal(await page.locator('[data-tool="brush"]').getAttribute('aria-keyshortcuts'),'T');assert.equal(await page.locator('[data-tool="erase"]').getAttribute('aria-keyshortcuts'),'E');assert.equal(await page.locator('#tool-eyedropper').getAttribute('aria-keyshortcuts'),'Q');
 await page.locator('#top').click();let box=await page.locator('#editview canvas').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
 await page.mouse.click(x,y);await page.getByText('体素 1',{exact:true}).waitFor();const original=await page.locator('#color-hex').inputValue();await page.locator('#home').click();await page.locator('#top').click();
 await page.keyboard.press('e');assert.equal(await page.locator('[data-tool="erase"]').getAttribute('aria-pressed'),'true');await page.mouse.click(x,y);await page.getByText('体素 0',{exact:true}).waitFor();
 await page.keyboard.press('Control+z');await page.getByText('体素 1',{exact:true}).waitFor();
 await page.keyboard.press('t');await page.waitForFunction(()=>document.querySelector('#tool-inspector h2').textContent.includes('笔刷'));await page.locator('#palette button').nth(3).click();assert.notEqual(await page.locator('#color-hex').inputValue(),original);
 await page.keyboard.press('q');assert.equal(await page.locator('#editview').getAttribute('data-eyedropper'),'true');
 await page.mouse.click(x,y);assert.equal(await page.locator('#color-hex').inputValue(),original,'Q really samples the voxel color');assert.equal(await page.locator('#editview').getAttribute('data-eyedropper'),'false');
 await page.keyboard.press('t');await page.keyboard.press('Escape');assert.equal(await page.locator('[data-tool="brush"]').getAttribute('aria-pressed'),'false');
 await page.locator('#module-tabs').focus();await page.keyboard.press('t');assert.equal(await page.locator('[data-tool="brush"]').getAttribute('aria-pressed'),'false','typing in controls never activates a tool');
 await page.locator('#asset-document-more summary').click();await page.locator('#module-name').fill('名称');await page.locator('#module-name').press('End');await page.keyboard.type('teq');assert.equal(await page.locator('#module-name').inputValue(),'名称teq');assert.equal(await page.locator('[data-tool="brush"]').getAttribute('aria-pressed'),'false');await page.locator('#asset-document-more summary').click();await page.keyboard.press('Control+t');assert.equal(await page.locator('[data-tool="brush"]').getAttribute('aria-pressed'),'false','modified shortcuts are not stolen');
 await page.keyboard.press('Shift+t');assert.equal(await page.locator('[data-tool="brush"]').getAttribute('aria-pressed'),'false','Shift remains available for selection/line gestures');
 assert.deepEqual(errors,[]);console.log('PASS T brush / Q sample / E erase, real strokes, input and modifier guards');
}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
