// Real hierarchy UI handlers and CanvasSession, with only the 3D renderer bridge
// substituted. Runs in a separate headless browser, never a user's Workshop.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const editor=process.cwd(),out=path.resolve('validation/collection-brush-ui');
await fs.mkdir(out,{recursive:true});
const entry=`
import * as core from ${JSON.stringify(path.join(editor,'core/workshop.ts'))};
import {ModelObjectTools} from ${JSON.stringify(path.join(editor,'desktop/model-object-tools.ts'))};
window.bridge={drawingActive:false,config:null,brush:null,stamp:null,context:null,
 cancel(){},clearSelection(){},selectMode(){this.drawingActive=false;},selectionCells(){return[];},
 setObjectMode(on,config){this.config=config;},
 setTemporaryObjectBrush(brush,stamp){this.brush=brush;this.stamp=stamp;this.drawingActive=!!brush;},
 setObjectContextHandler(handler){this.context=handler;}};
function model(id){const a=core.createAsset(id);a.schema='xinghai-workshop-asset-2';a.name='集合试样';a.cells=[];
 a.canvases=[{canvasId:'canvas',name:'画布',visible:true,locked:false,voxelStepM:.25,originTicks:[0,0,0],cells:[{x:0,y:0,z:0,color:0,owner:'volume'},{x:3,y:0,z:0,color:1,owner:'volume'}],protectedColumns:[]}];
 a.objects=[{objectId:'a',name:'地板 A',canvasIds:['canvas'],originTicks:[4,4,4],cellKeys:['0,0,0']},{objectId:'b',name:'地板 B',canvasIds:['canvas'],originTicks:[28,4,4],cellKeys:['3,0,0']}];
 a.objectCollections=[{collectionId:'group',name:'地板集合',memberIds:['a','b']}];return a;}
let current={canvases:new core.CanvasSession(model('fixture-a'))};let tools;
const ctx={session:()=>current,refresh:async()=>{tools.prepare();tools.update();},changed:()=>{},history:redo=>redo?current.canvases.redo():current.canvases.undo(),save:()=>{},message:message=>window.lastMessage=message};
tools=new ModelObjectTools(ctx);tools.mount(document.getElementById('tree'));tools.prepare();tools.update();
window.harness={tools,ctx,get session(){return current.canvases;},reset(id='fixture-a'){current={canvases:new core.CanvasSession(model(id))};tools.prepare();tools.update();},state(){return {selected:current.canvases.selectedObjectIds,objects:current.canvases.model.objects.length,collections:current.canvases.model.objectCollections?.length??0,brushName:window.bridge.brush?.name??null,brushObjectCount:window.bridge.brush?.clipboard?.objects.length??0};}};
`;
const result=await build({stdin:{contents:entry,resolveDir:editor,sourcefile:'collection-brush-harness.ts',loader:'ts'},bundle:true,format:'esm',platform:'browser',write:false,logLevel:'silent',plugins:[{name:'renderer-boundary',setup(b){b.onResolve({filter:/^\.\/renderer\.ts$/},args=>args.importer.endsWith('model-object-tools.ts')?{path:'renderer',namespace:'boundary'}:null);b.onLoad({filter:/.*/,namespace:'boundary'},()=>({contents:'export const moduleEditor=new Proxy({}, {get(_t,key){const v=window.bridge[key];return typeof v==="function"?v.bind(window.bridge):v;}});',loader:'js'}));}}]});
await fs.writeFile(path.join(out,'app.js'),result.outputFiles[0].contents);
const css=await fs.readFile('desktop/style.css','utf8');
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><style>${css}\nbody{margin:0;background:#20272d}#app{display:block}#app>header nav{display:flex;gap:5px;flex-wrap:wrap}#tree{width:230px;margin:20px}#viewport{position:relative}#editview{width:500px;height:350px}</style><main id="app"><header><nav></nav></header><section id="viewport"><div id="editview"></div></section><aside id="tree"></aside></main><script type="module" src="app.js"></script>`);
const server=http.createServer(async(req,res)=>{try{const f=path.join(out,req.url==='/'?'index.html':req.url.slice(1));res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'text/html');res.end(await fs.readFile(f));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.harness);
 const state=()=>page.evaluate(()=>window.harness.state());
 await page.locator('[data-model-object="a"]').click();
 assert.deepEqual((await state()).selected,['a'],'a collection member must remain independently selectable');
 await page.locator('[data-model-object="b"]').click({modifiers:['Shift']});assert.deepEqual(new Set((await state()).selected),new Set(['a','b']));
 await page.locator('[data-model-object="a"]').click({modifiers:['Control']});assert.deepEqual((await state()).selected,['b']);
 await page.locator('[data-model-collection-select="group"]').click();assert.deepEqual(new Set((await state()).selected),new Set(['a','b']));
 assert.equal(await page.locator('#model-collection-dissolve').count(),0,'no standalone dissolve button');
 const group=page.locator('[data-model-collection="group"]');await group.locator('summary').click({button:'right'});
 await page.getByRole('menuitem',{name:'解散集合',exact:true}).click();await page.waitForFunction(()=>window.harness.state().collections===0);assert.equal((await state()).objects,2,'dissolve must preserve objects');
 await page.evaluate(()=>window.harness.reset());
 await page.locator('[data-model-object="a"]').click({button:'right'});await page.getByRole('menuitem',{name:'设为临时画笔',exact:true}).click();
 await page.waitForFunction(()=>window.harness.state().brushName==='地板 A');assert.equal((await state()).brushObjectCount,1,'brush captures one member, not its collection');
 assert.match(await page.locator('#temporary-object-brush-status').innerText(),/地板 A/);
 await page.locator('[data-model-object="b"]').click({button:'right'});await page.getByRole('menuitem',{name:'设为临时画笔',exact:true}).click();await page.waitForFunction(()=>window.harness.state().brushName==='地板 B');
 await page.locator('#temporary-object-brush-reset').click();assert.equal((await state()).brushName,null);assert.match(await page.locator('#temporary-object-brush-status').innerText(),/体素格/);
 await page.locator('[data-model-object="a"]').click({button:'right'});await page.getByRole('menuitem',{name:'设为临时画笔',exact:true}).click();
 await page.evaluate(()=>window.harness.reset('fixture-b'));assert.equal((await state()).brushName,null,'switching assets clears the transient brush');
 // The same callback is called by the actual viewport's right-click routing.
 await page.evaluate(()=>window.bridge.context('b',460,260));await page.getByRole('menuitem',{name:'设为临时画笔',exact:true}).click();assert.equal((await state()).brushName,'地板 B');
 const indent=await page.locator('[data-model-object="a"]').evaluate(e=>({left:e.getBoundingClientRect().left,header:e.closest('details').querySelector('summary').getBoundingClientRect().left}));assert.ok(indent.left-indent.header>=14,'member rows must be visibly indented');
 const order=await page.locator('[data-model-object]').evaluateAll(rows=>rows.map(r=>r.dataset.modelObject));assert.deepEqual(order,['a','b'],'selection must not reorder the tree');
 await page.evaluate(()=>document.dispatchEvent(new Event('temporary-object-brush-cleared')));assert.match(await page.locator('#temporary-object-brush-status').innerText(),/当前画笔：体素格/,'ordinary tools and unbind clear the displayed temporary brush');
 assert.equal(await page.locator('#temporary-object-brush-reset').isDisabled(),true);
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'hierarchy-and-brush.png')});
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify({pass:true,checks:['member selection','Shift/Ctrl membership','explicit collection selection','context-only dissolve','single-object brush','source label','switch/reset brush','asset switch clears','viewport context bridge','indentation','stable row order'],errors},null,2));console.log('collection / temporary brush UI passed');
}finally{await browser.close();await new Promise(r=>server.close(r));}
