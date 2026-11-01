// Actual ModelObjectTools and CanvasSession in a headless DOM; only renderer
// selection IO is substituted, so edit-object ownership is checked end to end.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const editor=process.cwd(),out=path.resolve('validation/edit-separate-ui');await fs.mkdir(out,{recursive:true});
const entry=`
import * as core from ${JSON.stringify(path.join(editor,'core/workshop.ts'))};
import {ModelObjectTools} from ${JSON.stringify(path.join(editor,'desktop/model-object-tools.ts'))};
let selected=[];
const host=document.getElementById('editview');
function selection(cells,busy=false){selected=cells;host.dataset.selectionCount=String(cells.length);host.dataset.selectionBusy=String(busy);}
window.bridge={drawingActive:false,config:null,clearSelection(){selection([]);},selectionCells(){return selected.map(c=>({...c}));},cancel(){},selectMode(){},setObjectMode(on,config){this.config=config;},setTemporaryObjectBrush(){},setObjectContextHandler(){}};
const asset=core.createAsset('edit-separate-fixture');asset.schema='xinghai-workshop-asset-2';asset.name='分离试样';asset.cells=[];
asset.canvases=[{canvasId:'canvas',name:'主画布',visible:true,locked:false,voxelStepM:.25,originTicks:[0,0,0],cells:[0,1,2,8].map(x=>({x,y:0,z:0,color:0,owner:'volume'})),protectedColumns:[]}];
asset.objects=[{objectId:'source',name:'岩块',canvasIds:['canvas'],originTicks:[12,4,4],cellKeys:['0,0,0','1,0,0','2,0,0']},{objectId:'other',name:'外部物体',canvasIds:['canvas'],originTicks:[68,4,4],cellKeys:['8,0,0']}];
const session=new core.CanvasSession(asset);let tools,hold=false,release=null;const messages=[];
const ctx={session:()=>({canvases:session}),refresh:async()=>{if(hold)await new Promise(resolve=>release=resolve);tools.prepare();tools.update();},changed(){},history(redo){redo?session.redo():session.undo();},save(){},message(s,error){messages.push({message:s,error:!!error});}};
tools=new ModelObjectTools(ctx);tools.mount(document.getElementById('tree'));tools.prepare();tools.update();selection([]);
window.harness={select:selection,hold(){hold=true;},release(){hold=false;release?.();},update(){tools.update();},state(){return{objectMode:tools.objectMode,editObjectId:session.editObjectId,selectedObjectIds:session.selectedObjectIds,objects:session.model.objects,editorKeys:session.editor.doc.cells.map(c=>[c.x,c.y,c.z].join(',')),selectionCount:selected.length,messages};}};
`;
const bundled=await build({stdin:{contents:entry,resolveDir:editor,sourcefile:'edit-separate-harness.ts',loader:'ts'},bundle:true,format:'esm',platform:'browser',write:false,logLevel:'silent',plugins:[{name:'renderer-boundary',setup(b){b.onResolve({filter:/^\.\/renderer\.ts$/},args=>args.importer.endsWith('model-object-tools.ts')?{path:'renderer',namespace:'boundary'}:null);b.onLoad({filter:/.*/,namespace:'boundary'},()=>({contents:'export const moduleEditor=new Proxy({}, {get(_t,key){const value=window.bridge[key];return typeof value==="function"?value.bind(window.bridge):value;}});',loader:'js'}));}}]});
await fs.writeFile(path.join(out,'app.js'),bundled.outputFiles[0].contents);
const css=await fs.readFile('desktop/style.css','utf8');
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><style>${css}body{margin:0;background:#20272d}#app{display:block}#app>header nav{display:flex}#viewport{position:relative;height:120px}#editview{width:700px;height:110px}#tree{width:230px;margin:20px}.model-mode-controls{display:flex;gap:8px}</style><main id="app"><header><nav></nav></header><section id="viewport"><div id="editview"></div></section><aside id="tree"></aside></main><script type="module" src="app.js"></script>`);
const server=http.createServer(async(req,res)=>{try{const f=path.join(out,req.url==='/'?'index.html':req.url.slice(1));res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'text/html');res.end(await fs.readFile(f));}catch{res.statusCode=404;res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.harness);
 const button=page.locator('#model-separate-selection'),state=()=>page.evaluate(()=>window.harness.state());
 assert.equal(await button.count(),1,'selection separation has a direct, discoverable mode-bar button');
 assert.equal(await button.isVisible(),false,'object mode hides voxel-only separation');
 await page.locator('[data-model-object="source"]').click();await page.locator('#model-interaction-mode').selectOption('edit');
 await page.waitForFunction(()=>window.harness.state().editObjectId==='source');assert.equal(await button.isVisible(),true);assert.equal(await button.isDisabled(),true,'empty selection cannot be separated');
 await page.evaluate(()=>window.harness.select([{x:1,y:0,z:0}]));await page.waitForFunction(()=>!document.querySelector('#model-separate-selection').disabled);assert.match(await button.innerText(),/1\s*格/,'button shows live voxel selection count');
 await page.evaluate(()=>window.harness.select([{x:1,y:0,z:0}],true));await page.waitForFunction(()=>document.querySelector('#model-separate-selection').disabled);assert.equal(await page.locator('#model-separate').isDisabled(),true,'menu and direct button agree during selection calculation');
 await page.evaluate(()=>{window.harness.select([{x:1,y:0,z:0}]);window.harness.hold();});await page.waitForFunction(()=>!document.querySelector('#model-separate-selection').disabled);
 await button.click();await page.waitForFunction(()=>window.harness.state().objects.length===3);assert.equal(await button.isDisabled(),true,'submit in flight cannot be repeated');assert.equal(await button.getAttribute('aria-busy'),'true');
 await page.evaluate(()=>window.harness.release());await page.waitForFunction(()=>document.querySelector('#model-separate-selection').getAttribute('aria-busy')==='false');
 const after=await state(),source=after.objects.find(o=>o.objectId==='source'),separated=after.objects.find(o=>!['source','other'].includes(o.objectId));
 assert.equal(after.objectMode,false);assert.equal(after.editObjectId,'source','separation keeps editing the original object');assert.deepEqual(after.selectedObjectIds,['source']);assert.deepEqual(source.cellKeys,['0,0,0','2,0,0']);assert.deepEqual(separated.cellKeys,['1,0,0']);assert.deepEqual(after.editorKeys,['0,0,0','2,0,0'],'separated cells leave the current editable scope');assert.equal(after.selectionCount,0);assert.equal(await button.isDisabled(),true);assert.ok(after.messages.some(m=>!m.error&&/分离/.test(m.message)),'success feedback explains completion');
 assert.equal(await page.locator(`[data-model-object="${separated.objectId}"]`).count(),1,'new object appears in the hierarchy');
 await page.screenshot({path:path.join(out,'separated-original-still-editing.png')});
 await page.locator(`[data-model-object="${separated.objectId}"]`).click();assert.equal((await state()).editObjectId,separated.objectId,'the independent result can be chosen from the hierarchy');assert.deepEqual((await state()).editorKeys,['1,0,0']);
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'result.json'),JSON.stringify({pass:true,checks:['visible edit-mode action','object-mode hidden','empty selection disabled','live count','selection busy disabled','submit busy disabled','original edit scope retained','new independent object','voxel selection cleared','hierarchy selection'],errors},null,2));console.log('edit separation UI: direct action, busy guards and original editing scope passed');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
