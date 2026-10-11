import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {PNG}=require('pngjs');
const {createTilePipeline}=require('../desktop/tile-pipeline.cjs');
const {validateZip}=require('../archive/export-zip.cjs');
const checks={assetType:true,sharedCamera:true,noForbiddenFaces:true,productionIntent:true};
async function setup(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-form-pipeline-'));let n=0;
 const p=new PNG({width:96,height:96});p.data.fill(255);const file=path.join(dir,'original-test.png');await fs.writeFile(file,PNG.sync.write(p));
 const pipeline=await createTilePipeline({directory:path.join(dir,'store'),pickPng:async()=>file,pickSave:async()=>path.join(dir,`task-${++n}.zip`)});
 return {dir,pipeline,file};
}
test('new v7 pipeline exports fixed view guide and pressure, requiring reviewed exact sample before style/formal',async()=>{
 const {pipeline}=await setup();await pipeline.action('new',{options:{protocolVersion:7,templateId:'XH-GRASS-8COND-01',cellPixels:32,stylePressure:'standard'}});await pipeline.action('lock');
 let s=await pipeline.state();assert.equal(s.lockedSpec.schemaVersion,'1.5.0');assert.match(s.board.viewGuide,/^data:image\/png;base64,/);
 const task=await pipeline.action('request',{stage:'sample'}),zip=validateZip(await fs.readFile(task.path));assert.equal(zip.manifest.schemaVersion,'2dw-zip/7');assert(zip.entries.includes('guides/view-guide.png'));
 await pipeline.action('importSample',{method:'file',kind:'sample'});await assert.rejects(pipeline.action('request',{stage:'style'}),/形式|form|视角/i);await assert.rejects(pipeline.action('approve',{explicit:true}),/形式|form|视角/i);
 await pipeline.action('review-form',{explicit:true,checks,notes:'Original synthetic diagnostic form check for pipeline integration.'});s=await pipeline.state();assert.equal(s.gates.formReady,true);
 const style=validateZip(await fs.readFile((await pipeline.action('request',{stage:'style'})).path));assert.equal(style.spec.formReview.sampleId,s.selectedSampleId);assert.equal(style.spec.formReview.status,'conforms');
 await pipeline.action('approve',{explicit:true});const formal=validateZip(await fs.readFile((await pipeline.action('request',{stage:'formal'})).path));assert.equal(formal.spec.formReview.sha256,formal.spec.approval.sha256);assert.equal(formal.spec.lockedSpec.schemaVersion,'1.5.0');
});
test('reject-form persists a reason and returns to trial, without changing original PNG bytes',async()=>{
 const {pipeline,file}=await setup();await pipeline.action('new',{options:{protocolVersion:7,cellPixels:32}});await pipeline.action('lock');await pipeline.action('importSample',{method:'file',kind:'sample'});const before=await pipeline.state();
 await pipeline.action('reject-form',{explicit:true,notes:'Incorrect visible grass side face.'});const s=await pipeline.state();assert.equal(s.formReview.status,'rejected');assert.match(s.formReview.notes,/side face/);assert.equal(s.versions[0].sha256,before.versions[0].sha256);assert.equal(s.approval,null);await assert.rejects(pipeline.action('request',{stage:'style'}),/形式|form|视角/i);
 assert.equal(require('../grammar/compile.cjs').sha(await fs.readFile(file)),s.versions[0].sha256);const retry=await fs.readFile((await pipeline.action('request',{stage:'sample'})).path),checked=validateZip(retry);assert.equal(checked.spec.formReview,undefined);assert.match(checked.spec.notes,/Incorrect visible grass side face/);assert.match(require('../archive/export-zip.cjs').readZip(retry).files['prompts/task.md'].toString(),/负向诊断.*Incorrect visible grass side face/);
});
test('v6 project stays legacy until explicit upgrade; reusable old bytes acquire a new revision and require new review',async()=>{
 const {pipeline}=await setup();await pipeline.action('configure',{cellPixels:32});await pipeline.action('lock');await pipeline.action('importSample',{method:'file',kind:'sample'});await pipeline.action('approve',{explicit:true});const old=await pipeline.state();assert.equal(old.lockedSpec.schemaVersion,'1.4.0');
 await pipeline.action('upgrade-contract');let s=await pipeline.state();assert.equal(s.lockedSpec.schemaVersion,'1.5.0');assert.equal(s.approval.trustedCurrent,false);assert.equal(s.gates.formReady,false);
 await pipeline.action('review-form',{explicit:true,checks,notes:'Explicitly recheck the exact legacy bytes under the new contract.'});s=await pipeline.state();assert.equal(s.versions.length,2);assert.equal(s.versions[1].sha256,old.versions[0].sha256);assert.equal(s.versions[1].parentId,old.selectedSampleId);assert.notEqual(s.selectedSampleId,old.selectedSampleId);assert.equal(s.formReview.status,'conforms');assert.equal(s.approval.trustedCurrent,false);assert.equal(s.gates.formalReady,false);
 const style=validateZip(await fs.readFile((await pipeline.action('request',{stage:'style'})).path));assert.equal(style.spec.sample.id,s.selectedSampleId);
});
