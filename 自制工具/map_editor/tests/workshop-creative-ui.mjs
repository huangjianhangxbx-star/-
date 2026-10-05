import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launchWorkshop} from './workshop-launch.mjs';
const out=path.resolve('validation/workshop-creative');await fs.mkdir(out,{recursive:true});
const root=await fs.mkdtemp(path.join(out,'project-'));const app=await launchWorkshop();
try{
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await app.evaluate(({dialog,BrowserWindow},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});BrowserWindow.getAllWindows()[0].setContentSize(1440,900);},root);
 await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByRole('button',{name:'新建场景',exact:true}).click();await page.getByRole('button',{name:'新建空草稿',exact:true}).click();
 assert.equal(await page.locator('[data-mode=creative]').count(),1,'creative is a distinct build mode');
 await page.locator('[data-mode=creative]').click();
 const b=await page.locator('#editview canvas').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
 await page.getByText('体素 1',{exact:true}).waitFor();
 const count=async()=>Number((await page.locator('#count').textContent()).match(/\d+/)[0]);
 const save=async()=>{await page.locator('#save-draft').click();await page.getByText('草稿已保存',{exact:true}).waitFor();};
 await save();const project=JSON.parse(await fs.readFile(path.join(root,'project.xhproject.json'),'utf8'));
 const scene=JSON.parse(await fs.readFile(path.join(root,project.scenes[0].source),'utf8'));
 const source=path.join(root,path.dirname(project.scenes[0].source),scene.assets[0].source);
 const read=async()=>JSON.parse(await fs.readFile(source,'utf8'));
 await page.locator('#top').click();
 const ppu=b.height/40,cx=b.x+b.width/2,cy=b.y+b.height/2;
 // Build a slab on a single frozen plane, including negative coordinates.
 await page.mouse.move(cx+ppu*.5,cy-ppu*.5);await page.keyboard.down('Shift');await page.mouse.down();
 assert.equal(await page.locator('#creative-status').getAttribute('data-locked'),'true');
 for(let y=-2;y<=2;y++){await page.mouse.move(cx+(-2+.5)*ppu,cy-(y+.5)*ppu);await page.mouse.move(cx+(2+.5)*ppu,cy-(y+.5)*ppu);}
 await page.screenshot({path:path.join(out,'locked-plane.png')});await page.mouse.up();await page.keyboard.up('Shift');
 await save();const slab=await read();assert.ok(slab.cells.length>=26);assert.ok(slab.cells.every(c=>c.z<=1),'new surfaces must not climb locked plane');
 await page.mouse.move(cx+ppu*.5,cy-ppu*.5);
 for(let i=0;i<4;i++)await page.mouse.click(cx+ppu*.5,cy-ppu*.5);
 await page.keyboard.down('Shift');await page.mouse.down();await page.mouse.move(cx+4.5*ppu,cy-.5*ppu);await page.mouse.up();await page.keyboard.up('Shift');
 await page.locator('#home').click();
 async function findFace(wanted){
   const box=await page.locator('#editview canvas').boundingBox();
   for(let y=.2;y<=.8;y+=.06)for(let x=.2;x<=.8;x+=.06){
    const point={x:box.x+x*box.width,y:box.y+y*box.height};await page.mouse.move(point.x,point.y);
    const raw=await page.locator('#editview').getAttribute('data-creative-hit');
    if(raw){const hit=JSON.parse(raw);if(wanted.includes(hit.face)&&hit.targets.some(p=>p.status==='applied'))return {...point,hit};}
   }return null;
 }
 let side=await findFace([0,1,2,3]);assert.ok(side,'side face is pickable');
 await page.screenshot({path:path.join(out,'ghost-target.png')});await save();const beforeSide=await read();
 await page.mouse.click(side.x,side.y);await save();const afterSide=await read(),oldKeys=new Set(beforeSide.cells.map(c=>`${c.x},${c.y},${c.z}`));
 assert.deepEqual(afterSide.cells.filter(c=>!oldKeys.has(`${c.x},${c.y},${c.z}`)).map(c=>`${c.x},${c.y},${c.z}`),side.hit.targets.filter(c=>c.status==='applied').map(c=>`${c.x},${c.y},${c.z}`));
 // Rotate below the slab using the real camera gesture and add downwards.
 await page.mouse.move(cx,cy);await page.mouse.down({button:'right'});await page.mouse.move(cx,cy+180,{steps:12});await page.mouse.up({button:'right'});
 let bottom=await findFace([5]);
 if(!bottom){await page.mouse.move(cx,cy);await page.mouse.down({button:'right'});await page.mouse.move(cx,cy-360,{steps:18});await page.mouse.up({button:'right'});bottom=await findFace([5]);}
 assert.ok(bottom,'bottom face is pickable');await page.mouse.click(bottom.x,bottom.y);await save();
 const finalBeforeDelete=await read(),n=await count();
 const picked=await findFace([0,1,2,3,4,5]);assert.ok(picked);
 await page.keyboard.down('Control');const deleteGhost=JSON.parse(await page.locator('#editview').getAttribute('data-creative-hit'));assert.notDeepEqual(deleteGhost.targets,picked.hit.targets,'stationary Ctrl refreshes Ghost');await page.mouse.click(picked.x,picked.y);await page.keyboard.up('Control');assert.equal(await count(),n-1);
 await page.keyboard.press('Control+z');assert.equal(await count(),n);await page.keyboard.press('Control+Shift+z');assert.equal(await count(),n-1);await page.keyboard.press('Control+z');
 for(const reason of ['Escape','blur','pointercancel']){
  const h=await findFace([0,1,2,3,4,5]);await page.locator('#editview canvas').evaluate(c=>c.addEventListener('pointerdown',e=>window.pid=e.pointerId,{once:true}));
  await page.mouse.move(h.x,h.y);await page.mouse.down();assert.equal(await count(),n+1);
  if(reason==='Escape')await page.keyboard.press('Escape');else if(reason==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));else await page.locator('#editview canvas').dispatchEvent('pointercancel',{pointerId:await page.evaluate(()=>window.pid),pointerType:'mouse'});
  await page.mouse.up();assert.equal(await count(),n);
 }
 await page.locator('#palette button').nth(2).click();const h=await findFace([0,1,2,3,4,5]);
 await page.mouse.click(h.x,h.y,{button:'middle'});assert.equal(await page.locator('#palette button').first().getAttribute('aria-pressed'),'true');assert.equal(await count(),n);
 await save();assert.deepEqual((await read()).cells,finalBeforeDelete.cells);
 await page.locator('#palette button').nth(2).click();await page.mouse.move(h.x,h.y);await page.mouse.down({button:'middle'});await page.mouse.move(h.x+50,h.y+20,{steps:5});await page.mouse.up({button:'middle'});
 assert.equal(await page.locator('#palette button').nth(2).getAttribute('aria-pressed'),'true','pan must not pick');assert.equal(await count(),n);
 await page.locator('#home').click();await page.mouse.move(1400,850);
 await page.screenshot({path:path.join(out,'clarity-off.png')});
 const pixelsOff=await page.locator('#editview canvas').evaluate(c=>c.toDataURL());
 await page.locator('#voxel-clarity').click();assert.equal(await page.locator('#voxel-clarity').getAttribute('aria-pressed'),'true');await page.mouse.move(1400,850);
 await page.waitForFunction(off=>document.querySelector('#editview canvas').toDataURL()!==off,pixelsOff);
 await page.screenshot({path:path.join(out,'clarity-on.png')});await save();const bytes=await fs.readFile(source,'utf8');
 await page.locator('#voxel-clarity').click();await save();assert.equal(await fs.readFile(source,'utf8'),bytes,'clarity must not alter source/material/palette');
 await page.reload();await page.getByRole('button',{name:'打开项目',exact:true}).click();await page.getByText('项目已打开',{exact:true}).waitFor();await page.locator('[data-action=edit-asset]').first().click();assert.equal(await count(),n);
 await page.locator('#voxel-clarity').click();await page.screenshot({path:path.join(out,'finished-model.png')});
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'ui-result.json'),JSON.stringify({passed:true,cells:n,downFace:bottom.hit.face,sideFace:side.hit.face,sourceUnchangedByClarity:true,errors},null,2));console.log('CREATIVE_UI_PASS');
}finally{await app.evaluate(({app})=>app.exit(0));}
