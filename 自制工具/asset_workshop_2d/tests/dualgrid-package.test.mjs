import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import crypto from 'node:crypto';
const require=createRequire(import.meta.url),{PNG}=require('pngjs'),{zipSync}=require('fflate');
const {buildDualTask,validateDualTask}=require('../workflow/package-dualgrid.cjs');
const {makeSpec}=require('../dual-grid/compile.cjs'),{createTilePipeline}=require('../desktop/tile-pipeline.cjs');
async function approved(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dual-package-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const p=new PNG({width:64,height:64});for(let i=0;i<p.data.length;i+=4)p.data.set([66,79,71,255],i);const file=path.join(dir,'original.png');await fs.writeFile(file,PNG.sync.write(p));const pipeline=await createTilePipeline({directory:path.join(dir,'workflow'),pickPng:async()=>file});await pipeline.action('single-start',{method:'file',testOnly:true,options:{cellPixels:16}});await pipeline.action('review-form',{explicit:true,checks:{assetType:true,fixedView:true,referenceClarity:true,finalIdentity:true}});await pipeline.action('approve',{explicit:true});const guard=await pipeline.workflow.productionGuard();guard.taskId=(await pipeline.state()).taskId;return{dir,pipeline,guard};}
test('ZIP9 carries the exact approved v8 bytes and independent continuous-art contract',async t=>{
 const {guard}=await approved(t),pack=buildDualTask({guard,spec:makeSpec({cellPixels:16,period:2}),notes:'边界裂缝需连续'});const result=require('../archive/export-zip.cjs').validateZip(pack.bytes);
 assert.equal(result.manifest.schemaVersion,'2dw-zip/9');assert.equal(result.spec.dualGrid.period,2);assert.equal(result.spec.referenceBinding.approval.sha256,guard.sample.sha256);assert.equal(result.spec.referenceBinding.approval.testOnly,true);
 const {files}=require('../archive/export-zip.cjs').readZip(pack.bytes);assert.deepEqual(files['input/approved-reference.png'],guard.sample.bytes);assert.ok(files['prompts/agent-task.md'].toString().includes('连续'));assert.ok(files['guides/dualgrid-16-map.png']);assert.ok(files['guides/continuous-master.png']);assert.ok(files['style/project-style-contract.json']);
});
test('new production cannot silently change approved PPU or accept stale/high-wall reference',async t=>{
 const {guard}=await approved(t);assert.throws(()=>buildDualTask({guard:{...guard,approval:{...guard.approval,stale:true}},spec:makeSpec({cellPixels:16,period:2})}),/批准|陈旧/);
 assert.throws(()=>buildDualTask({guard,spec:makeSpec({cellPixels:16,ppu:120,period:2})}),/规格|PPU/);
 assert.throws(()=>buildDualTask({guard:{...guard,spec:{...guard.spec,grammar:{...guard.spec.grammar,template:{...guard.spec.grammar.template,id:'XH-STONE-EDGE-8COND-01'}}}},spec:makeSpec({cellPixels:16})}),/平面|规格/);
});
test('changed PNG or a re-signed but illegal authority/mirror is rejected',async t=>{
 const {guard}=await approved(t),key=crypto.generateKeyPairSync('ed25519').privateKey,pack=buildDualTask({guard,spec:makeSpec({cellPixels:16}),notes:'原记录'},key),{files}=require('../archive/export-zip.cjs').readZip(pack.bytes);
 files['drawing-contract.md']=Buffer.from('假说明');assert.throws(()=>validateDualTask(Buffer.from(zipSync(files))),/哈希|签名|镜像/);
 const authority=JSON.parse(pack.files['dual-grid-spec.json']);authority.dualGrid.cornerBits.TL=8;files['dual-grid-spec.json']=Buffer.from(JSON.stringify(authority));const signed=require('../dual-grid/archive.cjs').signFiles(files,'2dw-zip/9',key);assert.throws(()=>validateDualTask(signed.bytes),/规格|镜像|权威/);
});
test('retry task carries separate exact returned source and coordinate diagnostics',async t=>{
 const {guard}=await approved(t),pack=buildDualTask({guard,spec:makeSpec({cellPixels:16,period:2}),notes:'继续返工',diagnosis:{issues:[{code:'material-color-seam',x:2,y:3}]},retrySources:[{role:'A',bytes:guard.sample.bytes,originalSha256:guard.sample.sha256}]});const {files}=require('../archive/export-zip.cjs').readZip(pack.bytes);assert.deepEqual(files['retry/A-original.png'],guard.sample.bytes);assert.deepEqual(files['input/approved-reference.png'],guard.sample.bytes);assert.equal(validateDualTask(pack.bytes).spec.diagnosis.issues[0].y,3);
});
