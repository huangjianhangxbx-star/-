import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {_electron as electron} from 'playwright';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {validateZip,readZip}=require('../archive/export-zip.cjs'),{sha}=require('../grammar/compile.cjs');
const proof=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
proof.grass={...proof.reports.find(r=>r.kind==='grass').paths,project:proof.reports.find(r=>r.kind==='grass').approvedProject};
const evidence=await fs.mkdtemp(path.join(root,'validation','2dw-tile02','desktop-'));
let app,page;const pageErrors=[],checks=[];
async function launch(profile){app=await electron.launch({executablePath:require('electron'),args:[root,'--test-hidden',`--test-profile=${profile}`],cwd:root,timeout:25000});page=await app.firstWindow();page.setDefaultTimeout(25000);page.on('pageerror',e=>pageErrors.push(e.message));await page.waitForFunction(()=>!document.querySelector('#mode-select').disabled);await page.waitForFunction(()=>document.querySelector('#wf-status').textContent!=='正在恢复本机工程。');await page.locator('#workflow-flow').click();}
const current=()=>page.evaluate(()=>window.tilePipeline.state());
async function waitIdle(){await page.waitForFunction(()=>!document.querySelector('#wf-lock').disabled);}
async function picker(file,save){await app.evaluate(({dialog},p)=>{dialog.showOpenDialog=async()=>p.file?{canceled:false,filePaths:[p.file]}:{canceled:true,filePaths:[]};dialog.showSaveDialog=async()=>p.save?{canceled:false,filePath:p.save}:{canceled:true};},{file,save});}
async function button(id){await page.locator('#'+id).click();await waitIdle();}
async function nav(step){await page.locator(`[data-wf-step="${step}"]`).click();}
async function capture(name){await page.waitForTimeout(180);const image=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));await fs.writeFile(path.join(evidence,name+'.png'),Buffer.from(image,'base64'));}
async function close(){if(app){await app.evaluate(async({clipboard,ClipboardItem})=>{if(globalThis.__wfClip)await clipboard.write(globalThis.__wfClip.map(v=>new ClipboardItem(v)));}).catch(()=>{});await app.close();app=undefined;}}
try{
 const profile=path.join(evidence,'profile');await launch(profile);
 // AI originals are private and optional on a fresh checkout, never replaced with a fake.
 const aiPath=path.join(root,'validation','2dw-tile02','ai');let actualAI=false;try{await fs.access(path.join(aiPath,'grass-sample-v1.png'));await fs.access(path.join(aiPath,'grass-style-v2.png'));actualAI=true;}catch{}
 if(actualAI){
  await page.locator('#wf-cell').fill('64');await page.locator('#wf-description').fill('桌面真实 AI 返回检查；仅样品，不做美术批准');await button('wf-lock');
  await picker(path.join(aiPath,'grass-sample-v1.png'));await button('wf-import-sample');
  assert.equal((await current()).versions.length,1);assert.equal((await current()).approval,null);checks.push('真实AI小样原字节导入，未自动批准');
  await picker(path.join(aiPath,'grass-style-v2.png'));await button('wf-import-style');const ai=await current();assert.equal(ai.versions.length,2);assert.equal(ai.versions[1].parentId,ai.versions[0].id);assert.equal(ai.approval,null);await capture('ai-version-history');
 }else checks.push('AI real-output not tested: private originals absent; synthetic checks remain separately labelled');
 // Transfer an explicitly synthetic technical fixture, not AI/user art.
 await picker(proof.grass.project);await button('wf-open');let s=await current();assert.equal(s.approval.trustedCurrent,false);assert.equal(s.approval.testOnly,true);checks.push('异机工程保留旧批准记录并要求重新批准');
 await nav(3);await button('wf-approve');assert.match(await page.locator('#wf-confirm-identity').textContent(),/测试夹具/);await button('wf-confirm-approve');s=await current();assert.equal(s.approval.trustedCurrent,true);assert.equal(s.approval.testOnly,true);
 const formal=path.join(evidence,'desktop-formal.zip');await picker(null,formal);await button('wf-request-formal');assert.equal(validateZip(await fs.readFile(formal)).spec.stage,'formal-master-task');
 await picker(proof.grass.materials);await button('wf-import-materials');await picker(proof.grass.contour);await button('wf-import-contour');
 await nav(5);await button('wf-compile');assert.equal((await current()).compiled.structureStatus,'passed');
 for(const scene of ['L','T','U','hole','island','line','random5','random8','random16','neighbor']){await page.locator('#wf-scene').selectOption(scene);await waitIdle();}
 await page.locator('#wf-labels').check();await page.waitForFunction(()=>document.querySelectorAll('.wf-map-label').length>0);await page.locator('.wf-map-label').first().click();assert.match(await page.locator('#wf-source-selection').textContent(),/mask.*样品 v/);await capture('source-inspection');await nav(5);await page.locator('#wf-world').scrollIntoViewIfNeeded();await capture('compiled-inspection');checks.push('47态、9图、3×3、实际来源链界面检查');
 const compiled=path.join(evidence,'desktop-compiled.zip');await picker(null,compiled);await button('wf-export-compiled');const checked=require('../workflow/output.cjs').validateOutputZip(await fs.readFile(compiled));assert.equal(checked.variants,188);assert.equal(checked.tiles,47);assert.equal((await current()).stage,'EXPORTED');checks.push('真实结果ZIP 47+188 PNG、所有条目SHA与源像素独立回读');
 const project=path.join(evidence,'desktop-project.zip');await picker(null,project);await button('wf-save');const selected=(await current()).selectedSampleId;
 await close();await launch(profile);s=await current();assert.equal(s.selectedSampleId,selected);assert.equal(s.approval.trustedCurrent,true);assert.equal(s.compiled.structureStatus,'passed');checks.push('退出后本机恢复原图、准确批准与编译结果');
 // Actual clipboard writes/reads through Electron44; original OS clipboard restored on close.
 await nav(3);await app.evaluate(async({clipboard,ClipboardItem},encoded)=>{globalThis.__wfClip=await Promise.all((await clipboard.read()).map(async i=>Object.fromEntries(await Promise.all(i.types.map(async t=>[t,await i.getType(t)])))));await clipboard.write([new ClipboardItem({'image/png':new Blob([Buffer.from(encoded,'base64')],{type:'image/png'})})]);},(await fs.readFile(proof.grass.manual)).toString('base64'));
 await button('wf-paste-manual');s=await current();assert.equal(s.approval.trustedCurrent,false);assert.equal(s.compiled.stale,true);checks.push('真实PNG剪贴板回传使旧批准/正式产出失效');
 // Use a distinct original technical fixture: an existing history PNG must be rejected as a duplicate.
 const {PNG}=require('pngjs'),fileFixture=PNG.sync.read(await fs.readFile(proof.grass.manual));fileFixture.data[0]^=1;
 const fileBytes=PNG.sync.write(fileFixture),filePath=path.join(evidence,'native-file-copy.png');await fs.writeFile(filePath,fileBytes);
 const prior=s.versions.length;await app.evaluate(async({clipboard,ClipboardItem},file)=>{await clipboard.write([new ClipboardItem({'text/plain':new Blob([file],{type:'text/plain'})})]);},filePath);await button('wf-paste-manual');s=await current();assert.equal(s.versions.length,prior+1);assert.equal(s.versions.at(-1).sha256,sha(fileBytes));checks.push('真实剪贴板本地PNG文件路径读取与字节身份正确');
 await picker(null);const before=(await current()).versions.length;await button('wf-import-manual');assert.equal((await current()).versions.length,before);checks.push('取消原生选择保留版本');
 // Saved references remain explicit and clearing removes native selection too.
 await nav(1);await picker(proof.grass.manual,path.join(evidence,'ref-task.zip'));await button('add-reference');await button('wf-request-sample');assert.match(await page.locator('#wf-saved-reference-count').textContent(),/1 \/ 8/);await button('wf-clear-references');assert.match(await page.locator('#wf-saved-reference-count').textContent(),/0 \/ 8/);await picker(null,path.join(evidence,'no-ref-task.zip'));await button('wf-request-sample');assert.equal(validateZip(await fs.readFile(path.join(evidence,'no-ref-task.zip'))).spec.references.length,0);checks.push('保存参考可见、统一清空且ZIP不再携带');
 await picker(path.join(root,'samples','2dw-tile01','grass-task.zip'));await button('wf-open');assert.match(await page.locator('#wf-status').textContent(),/旧 v5.*没有样品批准/);await page.locator('#ordinary-flow').click();assert.equal(await page.locator('#reference-panel').isVisible(),true);await page.locator('#tile-flow').click();await page.waitForFunction(()=>document.querySelector('#tile-summary').textContent.includes('1254'));assert.equal(await page.locator('#tile-workspace').isVisible(),true);checks.push('普通任务与旧经典母版入口及v5显式兼容读取保留');
 assert.deepEqual(pageErrors,[]);await fs.writeFile(path.join(evidence,'result.json'),JSON.stringify({passed:true,evidence,checks,pageErrors,dialogScope:'原生picker仅注入返回路径，实际读取/写出/校验/clipboard/renderer均真实运行',artAcceptance:'pending-human-review'},null,2));console.log(JSON.stringify({evidence,checks:checks.length}));
}finally{await close();}
