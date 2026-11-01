import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as core from '../dist/workshop.cjs';
const temp=await fs.realpath(os.tmpdir()),projectRoot=await fs.mkdtemp(path.join(temp,'xh-save-missing-project-')),profile=await fs.mkdtemp(path.join(temp,'xh-save-missing-profile-'));
const project=core.createProjectV2('save-missing'),asset=core.createAsset('good');asset.name='可编辑模型';asset.cells=[{x:0,y:0,z:0,color:0}];
project.assets=[{kind:'voxel',assetId:'missing',name:'缺失源的旧资产',revision:0,preview:null,source:'assets/missing/asset.xhmodule.json'},{kind:'voxel',assetId:'good',name:asset.name,revision:0,preview:null,source:'assets/good/asset.xhmodule.json'}];
for(const [relative,doc] of [['project.xhproject.json',project],['assets/good/asset.xhmodule.json',asset]]){const file=path.join(projectRoot,relative);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(doc));}
const app=await electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--test-hidden']:['.','--test-hidden'],env:{...process.env,XINGHAI_TEST_PROFILE:profile},executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe'});
try{
 const page=await app.firstWindow();page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1500,height:1000});
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.isVisible())),false);
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},projectRoot);
 await page.getByRole('button',{name:'打开项目',exact:true}).click();await page.getByText('项目级资产库已打开',{exact:true}).waitFor();
 await page.getByRole('button',{name:'新建资产',exact:true}).click();
 await page.locator('#asset-document-more summary').click();await page.locator('#module-name').fill('仍然可以保存');await page.locator('#module-name').press('Tab');await page.locator('#asset-document-more summary').click();
 await page.locator('#save-draft').click();
 await page.waitForFunction(()=>/已保存|模块会话不存在/.test(document.querySelector('#workshop-message').textContent));
 assert.match(await page.locator('#workshop-message').textContent(),/已保存/,'an unloaded missing asset must not prevent healthy assets saving');
 const manifest=JSON.parse(await fs.readFile(path.join(projectRoot,'project.xhproject.json'),'utf8')),savedRow=manifest.assets.find(a=>a.name==='仍然可以保存');assert.ok(savedRow);const stored=JSON.parse(await fs.readFile(path.join(projectRoot,savedRow.source),'utf8'));assert.equal(stored.name,'仍然可以保存');assert.ok(manifest.assets.some(a=>a.assetId==='missing'),'saving another asset never deletes a missing registry row');
 await page.keyboard.press('Control+s');await page.waitForFunction(()=>document.querySelector('#workshop-message').textContent.includes('已保存'));
 await page.locator('[data-workspace="project"]').click();await page.getByRole('button',{name:'新建搭建场景',exact:true}).click();await page.locator('[data-workspace="assembly"]').click();await page.locator('#assembly-save').click();await page.locator('#assembly-scene-save-state').filter({hasText:/^已保存$/}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS missing source does not block saving healthy edited assets or scenes, registry retained, repeated save recovers');
}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
