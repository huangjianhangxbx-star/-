import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const project=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'xh-overlap-project-'));
const profile=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'xh-overlap-profile-'));
const app=await electron.launch({args:process.env.XH_ELECTRON_EXECUTABLE?['--test-hidden']:['.','--test-hidden'],env:{...process.env,XINGHAI_TEST_PROFILE:profile},executablePath:process.env.XH_ELECTRON_EXECUTABLE??'node_modules/electron/dist/electron.exe'});
try{
 const page=await app.firstWindow();
 await page.setViewportSize({width:1440,height:900});
 await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},project);
 await page.getByRole('button',{name:'新建项目',exact:true}).click();
 await page.getByRole('button',{name:'新建资产',exact:true}).click();
 const canvas=await page.locator('#editview canvas').boundingBox();
 await page.mouse.click(canvas.x+canvas.width/2,canvas.y+canvas.height/2);
 await page.getByText('体素 1',{exact:true}).waitFor();
 await page.locator('#native-all').click();
 await page.keyboard.press('Control+c');
 await page.keyboard.press('Control+v');
 await page.mouse.move(canvas.x+canvas.width*.75,canvas.y+canvas.height*.75);
 await page.keyboard.press('Escape');
 await page.getByText('体素 1',{exact:true}).waitFor();
 assert.equal(await page.locator('#editview').getAttribute('data-placement-mode'),null);
 const copyId=await page.locator('#editview').getAttribute('data-active-copy');
 assert.ok(copyId,'the completed copy stays selected for axis movement');
 if(process.env.XH_CAPTURE_GIZMO)await page.screenshot({path:process.env.XH_CAPTURE_GIZMO});
 if(process.env.XH_DRAG_GIZMO){
  const box=await page.locator('#editview canvas').boundingBox();
  await page.mouse.move(box.x+box.width/2+33,box.y+box.height/2);
  if(process.env.XH_CAPTURE_GIZMO)await page.screenshot({path:process.env.XH_CAPTURE_GIZMO});
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+75,box.y+box.height/2,{steps:10});
  await page.mouse.up();
  assert.ok(Number((await page.locator('#editview').getAttribute('data-gizmo-delta'))?.split(',')[0])>0);
  assert.match(await page.locator('#message').textContent(),/坐标轴移动/);
  await page.keyboard.press('Control+z');
  await page.getByText('体素 1',{exact:true}).waitFor();
  await page.keyboard.press('Control+y');
  await page.getByText('体素 2',{exact:true}).waitFor();
 }
 await page.getByRole('button',{name:'保存资产',exact:true}).click();
 await page.getByText('原生资产与试摆草稿已保存').waitFor();
 const index=JSON.parse(await fs.readFile(path.join(project,'project.xhproject.json'),'utf8'));
 const source=JSON.parse(await fs.readFile(path.join(project,index.assets[0].source),'utf8'));
 assert.equal(source.cells.length,process.env.XH_DRAG_GIZMO?2:1);
 assert.equal(source.baseCells.length,1);
 assert.equal(source.voxelCopies.length,1);
 assert.equal(source.voxelCopies[0].copyId,copyId);
 assert.equal(source.voxelCopies[0].cells[0].x,process.env.XH_DRAG_GIZMO?Number((await page.locator('#editview').getAttribute('data-gizmo-delta')).split(',')[0]):0);
 assert.equal(source.voxelCopies[0].cells[0].y,0);
 assert.equal(source.voxelCopies[0].cells[0].z,-1);
 console.log('overlap paste Escape persists an independent source copy');
}finally{
 await app.evaluate(({app})=>app.exit(0)).catch(()=>{});
 await app.close().catch(()=>{});
 await fs.rm(project,{recursive:true,force:true});
 await fs.rm(profile,{recursive:true,force:true});
}
