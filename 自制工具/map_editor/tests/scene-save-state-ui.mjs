import {build} from 'esbuild';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
const output=await fs.mkdtemp(path.resolve('validation/scene-save-state-'));
await fs.writeFile(path.join(output,'entry.js'),`
import {AssemblyWorkspace} from ${JSON.stringify(path.resolve('desktop/workspaces/assembly.ts'))};
import {SceneSession} from ${JSON.stringify(path.resolve('core/scene-session.ts'))};
import {createScene,createAsset} from ${JSON.stringify(path.resolve('core/workshop-documents.ts'))};
const scene=createScene('scene'),asset=createAsset('rock');scene.name='待保存的岩台';asset.cells=[{x:0,y:0,z:0,color:0}];scene.assets=[{kind:'voxel',assetId:'rock',source:'assets/rock.json'}];
const session=new SceneSession(scene,new Map([['rock',{kind:'voxel',document:asset}]]));let empty=false;
const workspace=new AssemblyWorkspace(document.getElementById('assembly-workspace'),{
 scene:()=>empty?null:session.snapshot(),session:()=>session,assets:()=>new Map([['rock',asset]]),binaries:()=>new Map(),key:()=> 'scene-key',library:()=>[],libraryRoot:()=>'',chooseLibrary:async()=>{},reloadLibrary:async()=>{},changed:()=>{},
 save:async()=>{await new Promise((resolve,reject)=>window.finishSave=()=>window.failSave?reject(Error('fixture save failure')):resolve());session.savedRevision=session.snapshot().revision;},
 sceneLocation:()=> 'E:/Fixture/scenes/scene/scene.xhscene.json',createScene(){},history(){},edit:async()=>{},projectAssetsMode:()=>true,independent:async()=>{},join:async()=>'',import:async()=>{},drop:async()=>{},dropProject:async()=>{},mountProjectBrowser:host=>host.textContent='项目资产库',message:text=>window.message=text,run:async fn=>{try{await fn();}catch(error){window.message=error.message;}}
});
window.workspace=workspace;window.changeScene=()=>{session.add({instanceId:crypto.randomUUID(),assetId:'rock',positionM:[1,0,0],rotationDeg:0,groupId:'base'});workspace.render();};window.emptyScene=()=>{empty=true;workspace.render();};workspace.render();window.ready=true;
`);
await build({entryPoints:[path.join(output,'entry.js')],bundle:true,format:'esm',platform:'browser',outfile:path.join(output,'bundle.js')});
const server=http.createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<html><meta charset="utf-8"><link rel="stylesheet" href="/desktop/style.css"><link rel="stylesheet" href="/desktop/workshop-theme.css"><link rel="stylesheet" href="/desktop/workshop.css"><style>#assembly-workspace{height:100vh;width:100vw}</style><body class="workshop"><section id="assembly-workspace"></section><script type="module" src="/bundle.js"></script></body></html>');return;}const file=req.url==='/bundle.js'?path.join(output,'bundle.js'):path.resolve('.'+req.url);res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:940}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready);
 const save=page.getByRole('button',{name:'保存场景',exact:true}),state=page.locator('#assembly-scene-save-state');assert.ok(await save.isVisible());assert.equal(await state.textContent(),'已保存');
 const fixed=await save.boundingBox();await page.locator('#assembly-inspector-content').evaluate(node=>node.style.zoom='.95');assert.deepEqual(await save.boundingBox(),fixed,'save stays in a fixed document header outside sidebar content zoom');
 await page.evaluate(()=>window.changeScene());assert.match(await state.textContent(),/未保存/);await save.click();assert.equal(await state.textContent(),'正在保存…');assert.ok(await save.isDisabled());await page.evaluate(()=>window.finishSave());await state.filter({hasText:/^已保存$/}).waitFor();
 await page.evaluate(()=>{window.changeScene();window.failSave=true;});await save.click();await page.evaluate(()=>window.finishSave());await state.filter({hasText:/未保存/}).waitFor();assert.equal(await save.isDisabled(),false);assert.equal(await page.evaluate(()=>window.message),'fixture save failure');
 await page.screenshot({path:path.join(output,'scene-save-header.png')});await page.evaluate(()=>window.emptyScene());assert.ok(await save.isDisabled());assert.equal(await state.textContent(),'未创建');assert.deepEqual(errors,[]);await page.evaluate(()=>window.workspace.dispose());console.log('PASS scene save fixed header / dirty / saving / success / failure / empty',output);
}finally{await browser.close();await new Promise(r=>server.close(r));}
