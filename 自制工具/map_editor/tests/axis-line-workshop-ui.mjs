import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const temp=await fs.realpath(os.tmpdir());
const project=await fs.mkdtemp(path.join(temp,'xh-axis-line-project-')),profile=await fs.mkdtemp(path.join(temp,'xh-axis-line-profile-'));
const app=await electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--test-hidden']:['.','--test-hidden'],env:{...process.env,XINGHAI_TEST_PROFILE:profile},executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe'});
try{
 const page=await app.firstWindow();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.isVisible())),false);
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},project);
 await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByRole('button',{name:'新建资产',exact:true}).click();
 await page.locator('#mode-current').click();await page.locator('[data-mode="volume"]').click();await page.locator('#viewport-brush-menu summary').click();await page.locator('[data-tool="brush"]').click();
 let box=await page.locator('#editview canvas').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.getByText('体素 1',{exact:true}).waitFor();
 const save=async()=>{await page.locator('#workshop-message').evaluate(e=>e.textContent='');await page.getByRole('button',{name:'保存资产',exact:true}).click();await page.getByText('原生资产与试摆草稿已保存',{exact:true}).waitFor();const index=JSON.parse(await fs.readFile(path.join(project,'project.xhproject.json'),'utf8'));const asset=JSON.parse(await fs.readFile(path.join(project,index.assets[0].source),'utf8'));return {...asset,cells:asset.canvases?.flatMap(c=>c.cells)??asset.cells};};
 const before=await save();await page.locator('#mode-current').click();await page.locator('[data-mode="stack"]').click();await page.locator('#home').click();await page.locator('#top').click();
 box=await page.locator('#editview canvas').boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
 await page.mouse.move(x,y);await page.keyboard.down('Shift');await page.mouse.down();await page.mouse.move(x+250,y+50,{steps:20});
 assert.equal(await page.locator('#editview').getAttribute('data-line-axis'),'x','Shift chooses X from screen direction');
 await page.mouse.up();await page.keyboard.up('Shift');const after=await save();
 const old=new Set(before.cells.map(c=>[c.x,c.y,c.z].join(','))),added=after.cells.filter(c=>!old.has([c.x,c.y,c.z].join(',')));
 assert.ok(added.length>=3,'line continues outside the original supporting face '+JSON.stringify({before:before.cells,after:after.cells}));assert.equal(new Set(added.map(c=>c.y)).size,1);assert.equal(new Set(added.map(c=>c.z)).size,1,'surface building does not climb or fall back to ground');
 const xs=[...new Set(added.map(c=>c.x))].sort((a,b)=>a-b);assert.equal(xs.at(-1)-xs[0]+1,xs.length,'line has no gaps');
 await page.keyboard.press('Control+z');const undone=await save();assert.deepEqual(undone.cells,before.cells,'one undo removes the whole line');
 assert.deepEqual(errors,[]);console.log('PASS Shift axis line continues outside support with no stairs, one undo');
}catch(error){const p=await app.firstWindow();console.log(await p.evaluate(()=>({data:{...document.querySelector('#editview').dataset},hint:document.querySelector('#modehint').textContent,coords:document.querySelector('#coords').textContent,message:document.querySelector('#message').textContent})));throw error;}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
