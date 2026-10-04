import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const output=path.resolve('validation/m12/reference'); await fs.mkdir(output,{recursive:true});
const source=path.join(output,'reference-workflow.xhmap.json'), exported=path.join(output,'reference-game-export.json');
const fixture=path.join(output,'transparent-reference.png');
const app=await electron.launch({args:process.env.XH_EDITOR_EXE?['--workspace=legacy','--test-hidden']:['.','--workspace=legacy','--test-hidden'],executablePath:process.env.XH_EDITOR_EXE??'node_modules/electron/dist/electron.exe'});
const checks=[];
try {
  const page=await app.firstWindow(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.locator('#reference-panel summary').waitFor();
  const dataUrl=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=128;c.height=256;const x=c.getContext('2d');x.fillStyle='#ef396a';x.beginPath();x.arc(64,68,20,0,Math.PI*2);x.fill();x.fillRect(48,88,32,70);x.fillRect(40,92,8,64);x.fillRect(80,92,8,64);x.fillRect(48,158,14,50);x.fillRect(66,158,14,50);return c.toDataURL('image/png');});
  await fs.writeFile(fixture,Buffer.from(dataUrl.split(',')[1],'base64'));
  async function openChoice(file){await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);}
  async function saveChoice(file){await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);}
  async function save(){await saveChoice(source); await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('已保存 ')); return JSON.parse(await fs.readFile(source,'utf8'));}
  async function field(id,value){await page.locator(id).fill(value);await page.locator(id).press('Tab');}
  await page.locator('#reference-panel summary').click();await openChoice(fixture);await page.locator('#reference-import').click();
  await page.waitForFunction(()=>document.querySelector('#reference-name').textContent.includes('128×256'));
  let doc=await save();assert.equal(doc.editor.reference.contentTop,48/256);assert.equal(doc.editor.reference.contentBottom,208/256);assert.equal(doc.editor.reference.footY,208/256);assert.equal(doc.editor.reference.dataUrl,dataUrl);checks.push('透明PNG通过真实IPC导入、自动有效边界/脚底及内嵌保存');
  await field('#reference-height','1.8');await field('#reference-position','0.5,-0.5,0.25');await field('#reference-bounds','0.1875,0.8125');await field('#reference-foot','0.5,0.8125');
  doc=await save();assert.equal(doc.editor.reference.height,1.8);assert.deepEqual([doc.editor.reference.x,doc.editor.reference.y,doc.editor.reference.z],[0.5,-0.5,0.25]);const reference=doc.editor.reference;checks.push('手动米坐标、高度、有效范围与脚底保存');
  await page.locator('#top').click();await field('#height','1');await field('#thickness','1');const box=await page.locator('#editview canvas').boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x-60,y);await page.mouse.down();await page.mouse.move(x+60,y,{steps:12});await page.mouse.up();
  doc=await save();assert.ok(doc.cells.length>=3);assert.deepEqual(doc.editor.reference,reference);const cells=doc.cells;checks.push('连续绘制新增地形且参考元数据不变');
  await page.locator('#reference-move').click();await page.mouse.move(x,y);await page.keyboard.press('Escape');doc=await save();assert.deepEqual(doc.editor.reference,reference);assert.deepEqual(doc.cells,cells);checks.push('Esc取消参考移动恢复原位置且保留地形');
  await page.locator('#reference-move').click();await page.mouse.move(x+15,y);await page.locator('#reference-cancel').click();doc=await save();assert.deepEqual(doc.editor.reference,reference);checks.push('取消按钮结束参考移动');
  await page.locator('#reference-move').click();await page.mouse.click(x,y);doc=await save();assert.notDeepEqual(doc.editor.reference,reference);assert.deepEqual(doc.cells,cells);const placed=doc.editor.reference;checks.push('点击真实地表放置参考，未添加体素');
  await page.locator('#reference-visible').uncheck();doc=await save();assert.equal(doc.editor.reference.visible,false);await page.locator('#reference-visible').check();await save();checks.push('隐藏/显示状态保存');
  await page.locator('#home').click();await page.locator('#previewhome').click();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,900);const previewBox=await page.locator('#preview canvas').boundingBox();await page.mouse.move(previewBox.x+previewBox.width/2,previewBox.y+previewBox.height/2);await page.mouse.wheel(0,900);await page.mouse.move(box.x+5,box.y+5);await page.waitForTimeout(150);await page.screenshot({path:path.join(output,'reference-two-viewports.png')});
  await page.locator('#new').click();await page.waitForFunction(()=>document.querySelector('#filename').textContent==='未命名地图');await openChoice(source);await page.locator('#open').click();await page.waitForFunction(()=>document.querySelector('#filename').textContent==='reference-workflow.xhmap.json');
  assert.equal(await page.locator('#reference-position').inputValue(),[placed.x,placed.y,placed.z].join(','));assert.equal(await page.locator('#reference-height').inputValue(),'1.8');checks.push('新建后重开源文件保持参考位置、尺寸与图片');
  await saveChoice(exported);await page.locator('#export').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('源文件已导出'));
  const game=JSON.parse(await fs.readFile(exported,'utf8'));assert.equal('editor' in game,false);assert.deepEqual(game.cells,cells);assert.equal(game.decals.length,0);assert.equal(game.instances.length,0);checks.push('团结源导出剥离编辑参考且保留地形');
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'result.json'),JSON.stringify({status:'passed',checks,errors,source,exported},null,2));console.log(JSON.stringify({status:'passed',checks},null,2));
} catch(error) {await fs.writeFile(path.join(output,'result.json'),JSON.stringify({status:'failed',checks,error:error.stack},null,2));throw error;}
finally{await app.evaluate(({app})=>app.exit(0));}

