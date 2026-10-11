import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {PNG}=require('pngjs'),{zipSync,unzipSync}=require('fflate');
const {createProjectStore}=require('../workflow/store.cjs');
const {createWorkflowSession}=require('../workflow/session.cjs');
const v6=require('../workflow/package.cjs');
const {compileMaster,templateImages}=require('../grammar/compile.cjs');
const checks={assetType:true,sharedCamera:true,noForbiddenFaces:true,productionIntent:true};
const options={protocolVersion:7,templateId:'XH-GRASS-8COND-01',strategy:'layered',cellPixels:16,masterPixels:64,ppu:100,stylePressure:'standard',description:'形式检查自制夹具'};
function png(color=60){const p=new PNG({width:64,height:64});for(let i=0;i<p.data.length;i+=4)p.data.set([color,90,70,255],i);return PNG.sync.write(p);}
async function setup(t,{legacy=false}={}){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-form-session-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const buildLockedSpec=o=>o.protocolVersion===7?require('../workflow/package-v7.cjs').buildLockedSpec(o):v6.buildLockedSpec(o);
 const create=store=>createWorkflowSession({store,buildLockedSpec,compileMaster:(spec,files)=>compileMaster(spec.grammar,files.master)});
 const store=await createProjectStore(dir),s=await create(store);
 const selected=legacy?Object.fromEntries(Object.entries(options).filter(([k])=>!['protocolVersion','stylePressure'].includes(k))):options;
 await s.configure(selected);await s.lockFormat();return {s,store,create,selected};
}
test('v7 unknown forms cannot refine or approve; explicit four checks bind exact selected PNG',async t=>{
 const {s}=await setup(t);await s.importSample(png(),{source:'synthetic',testOnly:true});let st=await s.getState();
 assert.equal(st.legacyContract,false);assert.equal(st.formReview.status,'unchecked');assert.equal(st.gates.styleReady,false);assert.equal(st.gates.approveReady,false);
 await assert.rejects(s.recordRequest('style-refine-task'),/形式|视角/);await assert.rejects(s.approveSample({explicit:true}),/形式|视角/);
 await assert.rejects(s.reviewForm({explicit:false,checks}),/明确/);
 await assert.rejects(s.reviewForm({explicit:true,checks:{...checks,noForbiddenFaces:false}}),/四项|全部|确认/);
 await s.reviewForm({explicit:true,checks,notes:'四项确认仅用于测试夹具'});st=await s.getState();
 const sample=st.versions[0];assert.equal(st.formReview.status,'conforms');assert.equal(st.formReview.trustedCurrent,true);assert.equal(st.formReview.reviewedBy,'synthetic/test-only');
 assert.equal(st.formReview.sampleId,sample.id);assert.equal(st.formReview.revision,sample.revision);assert.equal(st.formReview.sha256,sample.sha256);assert.equal(st.formReview.specHash,st.specHash);
 assert.equal(st.formReview.viewContractId,st.lockedSpec.viewContract.id);assert.equal(st.formReview.stylePressureId,st.lockedSpec.stylePressure.id);
 assert.equal(st.gates.styleReady,true);assert.equal(st.gates.approveReady,true);await s.recordRequest('style-refine-task');await s.approveSample({explicit:true});
 const guard=await s.productionGuard();assert.equal(guard.formReview.status,'conforms');assert.equal(Object.hasOwn(guard.formReview,'seal'),false);assert.equal(st.gates.formalReady,false);
});
test('form rejection keeps the actual PNG and reason, and returns to sample rather than style refinement',async t=>{
 const {s}=await setup(t);const bytes=png();await s.importSample(bytes);await s.reviewForm({explicit:true,checks});await s.approveSample({explicit:true});await s.recordRequest('formal-master-task');
 await s.rejectForm({explicit:true,notes:'草土台露出禁止的立体侧面'});const st=await s.getState();
 assert.equal(st.stage,'SAMPLE_REJECTED');assert.equal(st.formReview.status,'rejected');assert.equal(st.formReview.notes,'草土台露出禁止的立体侧面');assert.equal(st.approval.stale,true);
 assert.equal(st.requests[0].stale,true);assert.deepEqual((await s.getSample()).bytes,bytes);await assert.rejects(s.recordRequest('style-refine-task'),/形式|视角/);
 const request=await s.recordRequest('sample-task');assert.equal(request.snapshot.formReview.status,'rejected');assert.equal(request.snapshot.formReview.notes,st.formReview.notes);
 await assert.rejects(s.productionGuard(),/形式|批准/);await s.importSample(png(80));assert.equal((await s.getState()).formReview.status,'unchecked');
 assert.ok((await s.getState()).formReviewHistory.some(r=>r.status==='rejected'&&r.notes.includes('侧面')));
});
test('new style or manual revisions require their own form review and never inherit approval',async t=>{
 const {s}=await setup(t);await s.importSample(png(),{testOnly:true});const first=(await s.getState()).selectedSampleId;
 await assert.rejects(s.importSample(png(70),{kind:'style',parentId:first}),/形式|视角/);
 await s.reviewForm({explicit:true,checks});await s.approveSample({explicit:true});await s.importSample(png(70),{kind:'style',parentId:first});let st=await s.getState();
 assert.equal(st.formReview.status,'unchecked');assert.equal(st.gates.approveReady,false);assert.equal(st.approval.stale,true);assert.equal(st.versions[1].testOnly,true);
 await s.reviewForm({explicit:true,checks});await s.importSample(png(90),{kind:'manual'});st=await s.getState();
 assert.equal(st.formReview.status,'unchecked');assert.equal(st.versions[2].styleStep,'ai-refined');assert.equal(st.formReviewHistory.filter(r=>r.status==='conforms').length,2);
 await s.selectSample(first);assert.equal((await s.getState()).gates.styleReady,false);await assert.rejects(s.approveSample({explicit:true}),/形式/);
});
test('pressure change and switching back stay stale; explicit adoption preserves bytes and parent history',async t=>{
 const {s}=await setup(t);await s.importSample(png(),{testOnly:true});await s.reviewForm({explicit:true,checks});await s.approveSample({explicit:true});
 await s.recordRequest('sample-task');await s.recordRequest('style-refine-task');await s.recordRequest('formal-master-task');const original=await s.getState();
 await s.configure({...options,stylePressure:'extreme'});await s.lockFormat();let st=await s.getState();assert.notEqual(st.specHash,original.specHash);assert.equal(st.requests.every(r=>r.stale),true);assert.equal(st.gates.canAdopt,true);
 await assert.rejects(s.adoptSampleForCurrentSpec({explicit:false}),/明确/);await s.adoptSampleForCurrentSpec({explicit:true});st=await s.getState();
 assert.equal(st.versions.length,2);assert.equal(st.versions[1].parentId,original.selectedSampleId);assert.equal(st.versions[1].sha256,original.versions[0].sha256);assert.equal(st.versions[1].testOnly,true);assert.equal(st.versions[1].specHash,st.specHash);assert.equal(st.formReview.status,'unchecked');
 assert.deepEqual((await s.getSample()).bytes,png());assert.deepEqual(st.versions[0],original.versions[0]);
 await s.reviewForm({explicit:true,checks});await s.approveSample({explicit:true});await s.configure(options);await s.lockFormat();st=await s.getState();
 assert.equal(st.specHash,original.specHash);assert.equal(st.approval.stale,true);assert.equal(st.gates.formalReady,false);await s.selectSample(original.selectedSampleId);
 assert.equal((await s.getState()).gates.styleReady,false);await s.reviewForm({explicit:true,checks});await s.approveSample({explicit:true});assert.equal((await s.productionGuard()).sample.id,original.selectedSampleId);
});
test('same-machine restart and pack preserve signed review; foreign or rehashed fake review needs explicit recheck',async t=>{
 const {s,store,create}=await setup(t);await s.importSample(png());await s.reviewForm({explicit:true,checks});await s.approveSample({explicit:true});const before=await s.getState(),pack=await s.exportProject();
 const restored=await create(await createProjectStore(store.root));assert.equal((await restored.getState()).gates.formalReady,true);assert.equal((await restored.getState()).formReview.reviewedAt,before.formReview.reviewedAt);await restored.importProject(pack);assert.equal((await restored.getState()).gates.formalReady,true);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-foreign-form-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const foreign=await create(await createProjectStore(dir));await foreign.importProject(pack);
 let st=await foreign.getState();assert.equal(st.formReview.trustedCurrent,false);assert.equal(st.gates.approveReady,false);await assert.rejects(foreign.approveSample({explicit:true}),/形式/);
 const files=unzipSync(pack),manifest=JSON.parse(Buffer.from(files['manifest.json']));manifest.session.formReview.notes='伪造人工核对';files['manifest.json']=Buffer.from(JSON.stringify(manifest));await restored.importProject(Buffer.from(zipSync(files)));st=await restored.getState();
 assert.equal(st.formReview.trustedCurrent,false);await assert.rejects(restored.productionGuard(),/形式|批准/);await restored.reviewForm({explicit:true,checks});await restored.approveSample({explicit:true});assert.equal((await restored.getState()).gates.formalReady,true);
});
test('v6 history remains compatible and is never assigned new certification; upgrade is explicit',async t=>{
 const {s,store,create,selected}=await setup(t,{legacy:true});await s.importSample(png(),{testOnly:true});await s.approveSample({explicit:true});let st=await s.getState();
 assert.equal(st.legacyContract,true);assert.equal(st.formReview,null);assert.equal(st.gates.formalReady,true);const original=st.versions[0],approval=st.approval.id;
 const restored=await create(await createProjectStore(store.root));st=await restored.getState();assert.equal(st.approval.id,approval);assert.equal(st.gates.formalReady,true);assert.equal(st.formReview,null);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-legacy-form-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const foreign=await create(await createProjectStore(dir));await foreign.importProject(await s.exportProject());st=await foreign.getState();
 assert.equal(st.legacyContract,true);assert.equal(st.formReview,null);assert.equal(st.approval.id,approval);assert.equal(st.approval.status,'untrusted');await foreign.approveSample({explicit:true});assert.equal((await foreign.getState()).gates.formalReady,true);
 await restored.configure({...selected,protocolVersion:7,stylePressure:'standard'});await restored.lockFormat();assert.equal((await restored.getState()).gates.formalReady,false);await restored.adoptSampleForCurrentSpec({explicit:true});st=await restored.getState();
 assert.equal(st.versions[0].sha256,original.sha256);assert.equal(st.versions[1].parentId,original.id);assert.equal(st.formReview.status,'unchecked');await restored.reviewForm({explicit:true,checks});await restored.approveSample({explicit:true});assert.equal((await restored.getState()).gates.formalReady,true);
});
test('rejecting form invalidates compiled masters and passed outputs without deleting source artifacts',async t=>{
 const {s}=await setup(t);await s.importSample(png(),{testOnly:true});await s.reviewForm({explicit:true,checks});await s.approveSample({explicit:true});const st=await s.getState(),master=templateImages(st.lockedSpec.grammar).blank;
 await s.importMaster({master});await s.compile();await s.recordValidation({passed:true,issues:[]});await s.rejectForm({explicit:true,notes:'复核发现禁止侧面'});let after=await s.getState();
 assert.equal(after.masters[0].stale,true);assert.equal(after.compiled.stale,true);await assert.rejects(s.getCompiled(),/陈旧/);assert.deepEqual((await s.getMaster(after.masters[0].id)).files.master,master);
 await s.reviewForm({explicit:true,checks});after=await s.getState();assert.equal(after.gates.formalReady,false);assert.equal(after.compiled.stale,true);await s.approveSample({explicit:true});await assert.rejects(s.compile(),/陈旧/);
});
