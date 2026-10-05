import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launchWorkshop} from './workshop-launch.mjs';
const out=path.resolve('validation/workshop-creative');
const root=await fs.mkdtemp(path.join(out,'performance-'));
const app=await launchWorkshop();
try{
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL/i.test(m.text()))errors.push(m.text());});
 await app.evaluate(({dialog,BrowserWindow},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});BrowserWindow.getAllWindows()[0].setContentSize(1440,900);},root);
 await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByRole('button',{name:'新建场景',exact:true}).click();await page.getByRole('button',{name:'新建空草稿',exact:true}).click();await page.locator('#save-draft').click();await page.getByText('草稿已保存',{exact:true}).waitFor();
 const project=JSON.parse(await fs.readFile(path.join(root,'project.xhproject.json'),'utf8')),scene=JSON.parse(await fs.readFile(path.join(root,project.scenes[0].source),'utf8')),source=path.join(root,path.dirname(project.scenes[0].source),scene.assets[0].source),doc=JSON.parse(await fs.readFile(source,'utf8')),results=[];
 for(const [sx,sy,sz] of [[4,4,4],[16,16,16],[80,60,50]]){
  doc.cells=[];for(let x=0;x<sx;x++)for(let y=0;y<sy;y++)for(let z=0;z<sz;z++)doc.cells.push({x,y,z,color:0});await fs.writeFile(source,JSON.stringify(doc));
  await page.reload();await page.getByRole('button',{name:'打开项目',exact:true}).click();await page.getByText('项目已打开',{exact:true}).waitFor();const start=Date.now();await page.locator('[data-action=edit-asset]').first().click();await page.getByText(`体素 ${doc.cells.length}`,{exact:true}).waitFor();await page.locator('#home').click();
  const loadMs=Date.now()-start,frames=[];
  for(const clarity of [false,true]){
   if(clarity)await page.locator('#voxel-clarity').click();
   const ms=await page.evaluate(()=>new Promise(resolve=>{let count=0,start;function frame(t){if(count++===0)start=t;if(count===61)resolve((t-start)/60);else requestAnimationFrame(frame)}requestAnimationFrame(frame)}));
   frames.push({clarity,meanFrameMs:ms,fps:1000/ms,resources:await page.locator('#quads').getAttribute('data-resources')});
  }
  assert.equal(frames[0].resources,frames[1].resources,'shader toggle keeps mesh/resource count');results.push({cells:doc.cells.length,loadMs,frames});console.log(JSON.stringify(results.at(-1)));
  if(doc.cells.length===240000)await page.screenshot({path:path.join(out,'clarity-240000.png')});
 }
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'performance.json'),JSON.stringify({results,errors},null,2));
}finally{await app.evaluate(({app})=>app.exit(0));}
