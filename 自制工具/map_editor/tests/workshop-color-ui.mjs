import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const project=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'xh-color-'));
const profile=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'xh-color-profile-'));
const app=await electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--test-hidden']:['.','--test-hidden'],env:{...process.env,XINGHAI_TEST_PROFILE:profile},executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe'});
try{
 const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:900});
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},project);
 await page.getByRole('button',{name:'新建项目',exact:true}).click();
 await page.getByRole('button',{name:'新建资产',exact:true}).click();
 await page.locator('[data-tool="brush"]').click();
 const box=await page.locator('#editview canvas').boundingBox();
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 await page.getByText('体素 1',{exact:true}).waitFor();
 const slots=await page.locator('#palette button').count();
 await page.locator('#color-wheel').scrollIntoViewIfNeeded();
 const wheel=await page.locator('#color-wheel').boundingBox();
 await page.mouse.click(wheel.x+wheel.width*.72,wheel.y+wheel.height*.32);
 assert.equal(await page.locator('#palette button').count(),slots+1,'wheel choice should create/select the brush color immediately');
 assert.equal(await page.locator('#palette button').last().getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#use-color').count(),0,'no second apply click is required');
 const paintBox=await page.locator('#editview canvas').boundingBox();
 await page.mouse.click(paintBox.x+paintBox.width/2+75,paintBox.y+paintBox.height/2);
 await page.getByText('体素 2',{exact:true}).waitFor();
 await page.locator('#native-all').click();
 await page.locator('#recolor-selected').click();
 await page.getByText('体素 2',{exact:true}).waitFor();
 await page.locator('#palette button').first().click();
 await page.locator('[data-tool="repaint"]').click();
 await page.locator('#height').fill('50');
 await page.mouse.click(paintBox.x+paintBox.width/2,paintBox.y+paintBox.height/2);
 await page.getByRole('button',{name:'保存资产',exact:true}).click();
 await page.getByText('原生资产与试摆草稿已保存').waitFor();
 const index=JSON.parse(await fs.readFile(path.join(project,'project.xhproject.json'),'utf8'));
 const source=JSON.parse(await fs.readFile(path.join(project,index.assets[0].source),'utf8'));
 assert.equal(source.cells.length,2);
 assert.deepEqual(new Set(source.cells.map(cell=>cell.color)),new Set([0,slots]));
 await page.locator('#palette button').last().click();
 await page.locator('#replace-slot').selectOption('0');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#replace-color').click();
 await page.getByRole('button',{name:'保存资产',exact:true}).click();
 let recolored;
 for(let attempt=0;attempt<40;attempt++){
  recolored=JSON.parse(await fs.readFile(path.join(project,index.assets[0].source),'utf8'));
  if(recolored.palette[0]===recolored.palette[slots])break;
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 assert.equal(recolored.palette[0],recolored.palette[slots],'whole-slot recolor updates every voxel referencing the target slot');
 assert.deepEqual(errors,[]);
 console.log('color UI: wheel applies brush color, selected voxels recolor, surface repaint ignores work layer');
}finally{
 await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});
 await fs.rm(project,{recursive:true,force:true});await fs.rm(profile,{recursive:true,force:true});
}
