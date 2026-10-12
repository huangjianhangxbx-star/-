import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {PNG}=require('pngjs');
const {createTilePipeline}=require('../desktop/tile-pipeline.cjs');
const checks={assetType:true,fixedView:true,referenceClarity:true,finalIdentity:true};
test('existing content uses unique ID and bytes; duplicate names never choose a different image',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-single-reference-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));let references=[{refId:'one',role:'content',sourceName:'same.png',bytes:original(1)}];const pipeline=await createTilePipeline({directory:dir,referenceSnapshot:async()=>references});await pipeline.action('single-start',{method:'reference',testOnly:true,options:{cellPixels:16}});assert.deepEqual((await pipeline.workflow.getSample()).bytes,references[0].bytes);const before=await pipeline.workflow.exportProject();references.push({refId:'two',role:'content',sourceName:'same.png',bytes:original(2)});await assert.rejects(pipeline.action('single-start',{method:'reference',confirmNew:true}),/唯一|多张/);assert.deepEqual(await pipeline.workflow.exportProject(),before);await pipeline.action('single-start',{method:'reference',refId:'two',confirmNew:true,testOnly:true,options:{cellPixels:16}});assert.deepEqual((await pipeline.workflow.getSample()).bytes,references[1].bytes);
});
function original(seed=1){const p=new PNG({width:96,height:80});for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const brick=(Math.floor(x/24)+Math.floor(y/16)+seed)%4;p.data.set([70+brick*7,80+brick*8,65+brick*4,255],(y*p.width+x)*4);}return PNG.sync.write(p);}
async function setup(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-single-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'original.png');await fs.writeFile(file,original());let selection=file,save=null;const pipeline=await createTilePipeline({directory:path.join(dir,'store'),pickPng:async()=>selection,pickSave:async()=>save});return{dir,file,pipeline,select:v=>selection=v,save:v=>save=v};}
test('one original PNG starts a single reference without parent or four-shape claims',async t=>{
 const {file,pipeline}=await setup(t);await pipeline.action('single-start',{method:'file',testOnly:true,options:{cellPixels:16}});const s=await pipeline.state();
 assert.equal(s.options.protocolVersion,8);assert.equal(s.lockedSpec.schemaVersion,'1.6.0');assert.equal(s.lockedSpec.grammar.template.id,'XH-STONE-FLOOR-8COND-01');
 assert.equal(s.versions.length,1);assert.equal(s.versions[0].kind,'single');assert.equal(s.versions[0].parentId,null);assert.equal(s.versions[0].width,96);assert.equal(s.versions[0].height,80);
 assert.deepEqual((await pipeline.workflow.getSample()).bytes,await fs.readFile(file));assert.deepEqual(Object.keys(s.formReview.checks).sort(),Object.keys(checks).sort());
 assert.equal(s.lockedSpec.viewContract.surfaceMode,'flat-top');assert.equal(s.lockedSpec.grammar.sprite.width,16);assert.equal(s.lockedSpec.grammar.sprite.height,16);assert.equal(s.gates.formalReady,false);
 await assert.rejects(pipeline.action('approve',{explicit:true}),/形式|视角/);
 await assert.rejects(pipeline.action('review-form',{explicit:true,checks:{assetType:true,sharedCamera:true,noForbiddenFaces:true,productionIntent:true}}),/四项|检查/);
 await pipeline.action('review-form',{explicit:true,checks});await pipeline.action('approve',{explicit:true});assert.equal((await pipeline.state()).gates.formalReady,true);
});
test('cancelled single start leaves an existing exact project and approval intact',async t=>{
 const {pipeline,select}=await setup(t);await pipeline.action('single-start',{method:'file',testOnly:true,options:{cellPixels:16}});await pipeline.action('review-form',{explicit:true,checks});await pipeline.action('approve',{explicit:true});const before=await pipeline.workflow.exportProject();select(null);
 assert.equal((await pipeline.action('single-start',{method:'file',confirmNew:true})).cancelled,true);assert.deepEqual(await pipeline.workflow.exportProject(),before);
});
test('v8 formal ZIP includes approved bytes, honest single role and rejects changed mirrors',async t=>{
 const {dir,file,pipeline,save}=await setup(t);await pipeline.action('single-start',{method:'file',testOnly:true,options:{cellPixels:16}});await pipeline.action('review-form',{explicit:true,checks});await pipeline.action('approve',{explicit:true});const target=path.join(dir,'single.zip');save(target);await pipeline.action('request',{stage:'formal'});
 const archive=require('../archive/export-zip.cjs'),{zipSync}=require('fflate');const bytes=await fs.readFile(target);const pack=archive.validateZip(bytes),{files}=archive.readZip(bytes);
 assert.equal(pack.spec.schemaVersion,'1.6.0');assert.equal(pack.manifest.schemaVersion,'2dw-zip/8');assert.deepEqual(files['input/approved-sample.png'],await fs.readFile(file));
 const role=JSON.parse(files['input/sample-role.json']);assert.equal(role.sampleKind,'single-approved-reference');assert.ok(role.notProofOf.includes('all-47-states'));assert.ok(files['prompts/task.md'].toString().includes('数值'));
 files['input/sample-role.json']=Buffer.from('{}');assert.throws(()=>archive.validateZip(Buffer.from(zipSync(files))),/哈希|签名|镜像/);
});
test('single hard format change and foreign project require new explicit checks',async t=>{
 const {dir,pipeline}=await setup(t);await pipeline.action('single-start',{method:'file',testOnly:true,options:{cellPixels:16}});await pipeline.action('review-form',{explicit:true,checks});await pipeline.action('approve',{explicit:true});const exported=await pipeline.workflow.exportProject();
 const foreign=await createTilePipeline({directory:path.join(dir,'foreign')});await foreign.workflow.importProject(exported);assert.equal((await foreign.state()).gates.formalReady,false);
 const s=await pipeline.state();await pipeline.action('configure',{...s.options,ppu:120});await pipeline.action('lock');assert.equal((await pipeline.state()).gates.formalReady,false);assert.equal((await pipeline.state()).gates.canAdopt,true);
 await pipeline.action('review-form',{explicit:true,checks});assert.equal((await pipeline.state()).versions.length,2);assert.equal((await pipeline.state()).gates.formalReady,false);
});
test('returned painting compiles with original conversion provenance; wrong-size originals survive failure',async t=>{
 const {dir,pipeline,select,save}=await setup(t);await pipeline.action('single-start',{method:'file',testOnly:true,options:{cellPixels:16}});await pipeline.action('review-form',{explicit:true,checks});await pipeline.action('approve',{explicit:true});
 const p=new PNG({width:64,height:32});for(let y=0;y<32;y++)for(let x=0;x<64;x++)p.data.set([45+Math.floor(x/16)*22,65+Math.floor(y/16)*18+(y%9),80+x%11,255],(y*64+x)*4);const raw=PNG.sync.write(p),sourceFile=path.join(dir,'art.png');await fs.writeFile(sourceFile,raw);select(sourceFile);
 await pipeline.action('adapt-source',{method:'file',explicit:true});await pipeline.action('compile');save(path.join(dir,'result.zip'));await pipeline.action('exportCompiled');const checked=require('../workflow/output.cjs').validateOutputZip(await fs.readFile(path.join(dir,'result.zip')));assert.equal(checked.tiles,47);assert.equal(checked.variants,188);assert.equal(checked.map.conversion.sourceSha256,require('../workflow/store.cjs').sha(raw));assert.equal(checked.map.approval.testOnly,true);
 const {files}=require('../archive/export-zip.cjs').readZip(await fs.readFile(path.join(dir,'result.zip')),{entries:512,archiveBytes:64*1024*1024});const map=JSON.parse(files['map.json']);delete map.conversion;files['map.json']=Buffer.from(JSON.stringify(map));const manifest=JSON.parse(files['manifest.json']);const entry=manifest.entries.find(e=>e.path==='map.json');entry.sha256=require('../workflow/store.cjs').sha(files['map.json']);entry.byteLength=files['map.json'].length;files['manifest.json']=Buffer.from(JSON.stringify(manifest));assert.throws(()=>require('../workflow/output.cjs').validateOutputZip(Buffer.from(require('fflate').zipSync(files))),/转换|来源/);
 const wrongFile=path.join(dir,'wrong-art.png');await fs.writeFile(wrongFile,original(4));select(wrongFile);await assert.rejects(pipeline.action('adapt-source',{method:'file',explicit:true}),/尺寸|窗口/);const s=await pipeline.state();assert.equal(s.lastError.includes('尺寸'),true);assert.equal(s.gates.compileReady,false);const bad=s.masters.at(-1);assert.equal(bad.sourceArt.sha256,require('../workflow/store.cjs').sha(await fs.readFile(wrongFile)));assert.equal(bad.sourceArt.width,96);assert.equal(bad.accepted,false);
 save(path.join(dir,'retry.zip'));await pipeline.action('request',{stage:'formal',retry:true});const retried=require('../archive/export-zip.cjs').validateZip(await fs.readFile(path.join(dir,'retry.zip')));assert.ok(retried.spec.notes.includes(bad.sourceArt.sha256));assert.ok(retried.spec.notes.includes('尺寸'));assert.equal(retried.spec.approval.sha256,checked.map.approval.sha256);
});
