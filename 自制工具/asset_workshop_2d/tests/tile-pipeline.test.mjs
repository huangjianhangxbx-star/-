import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createRequire}from'node:module';
const require=createRequire(import.meta.url);
test('old v5 task is explicitly read as classic compatibility, never promoted to approval',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-old-task-'));const old=path.resolve('samples/2dw-tile01/grass-task.zip');
 const pipeline=await require('../desktop/tile-pipeline.cjs').createTilePipeline({directory:dir,pickZip:async()=>old});
 const before=await pipeline.state(),r=await pipeline.action('openProject');assert.equal(r.legacy.schemaVersion,'2dw-zip/5');assert.match(r.message,/没有样品批准/);const after=await pipeline.state();assert.equal(after.taskId,before.taskId);assert.equal(after.approval,null);
});
test('removing every reference clears task ZIP inputs and restored visible references',async()=>{
 const {PNG}=require('pngjs'),{validateZip}=require('../archive/export-zip.cjs');
 const p=new PNG({width:64,height:64});p.data.fill(255);const bytes=PNG.sync.write(p);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-ref-clear-'));let refs=[{refId:'ref-01',role:'style',bytes,sourceName:'own.png'}],replace=true,n=0;
 const pipeline=await require('../desktop/tile-pipeline.cjs').createTilePipeline({directory:dir,referenceSnapshot:async()=>({references:refs,replace}),clearReferenceSelection:async()=>{refs=[];replace=true;},pickSave:async()=>path.join(dir,`task-${++n}.zip`)});
 await pipeline.action('configure',{cellPixels:32});await pipeline.action('lock');const one=await pipeline.action('request',{stage:'sample'});assert.equal(validateZip(await fs.readFile(one.path)).spec.references.length,1);
 refs=[];const two=await pipeline.action('request',{stage:'sample'});assert.equal(validateZip(await fs.readFile(two.path)).spec.references.length,0);assert.equal((await pipeline.state()).references.length,0);
 refs=[{refId:'ref-01',role:'style',bytes,sourceName:'own.png'}];await pipeline.action('request',{stage:'sample'});
 const fresh=await require('../desktop/tile-pipeline.cjs').createTilePipeline({directory:dir});assert.equal((await fresh.state()).references.length,1);
 await pipeline.action('clearReferences');assert.deepEqual(refs,[]);assert.equal((await pipeline.state()).references.length,0);
});
test('native pipeline cancels without losing draft; denies arbitrary methods and keeps offline approval gate',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-pipeline-'));
 const {createTilePipeline}=require('../desktop/tile-pipeline.cjs');
 const pipeline=await createTilePipeline({directory:dir,pickPng:async()=>null,pickZip:async()=>null,pickSave:async()=>null,readClipboard:async()=>({kind:'empty'}),referenceSnapshot:async()=>[]});
 await pipeline.action('configure',{cellPixels:32});await pipeline.action('lock');
 const before=await pipeline.state();const cancel=await pipeline.action('importSample',{method:'file',kind:'sample'});
 assert.equal(cancel.cancelled,true);assert.equal((await pipeline.state()).specHash,before.specHash);
 await assert.rejects(pipeline.action('request',{stage:'formal'}),/批准|样品/);
 await assert.rejects(pipeline.action('importSample',{method:'shell',kind:'sample'}),/方式/);
 await assert.rejects(pipeline.action('configure',{path:'C:/secret'}),/字段/);
 await assert.rejects(pipeline.action('execute',{command:'anything'}),/操作/);
 const fresh=await createTilePipeline({directory:dir});assert.equal((await fresh.state()).specHash,before.specHash);
});
