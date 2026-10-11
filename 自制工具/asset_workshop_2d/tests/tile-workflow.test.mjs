import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {PNG}=require('pngjs'),{zipSync,unzipSync}=require('fflate');
const {makeGrammar}=require('../grammar/catalog.cjs'),{compileMaster,templateImages}=require('../grammar/compile.cjs');
let module;
try{module=require('../workflow/session.cjs');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
let storage;
try{storage=require('../workflow/store.cjs');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const nodeHash=b=>crypto.createHash('sha256').update(b).digest('hex');
function png(color=40,w=64,h=64){const p=new PNG({width:w,height:h});for(let i=0;i<p.data.length;i+=4)p.data.set([color,80,70,255],i);return PNG.sync.write(p);}
async function setup(t){
 assert.equal(typeof module?.createWorkflowSession,'function','persistent workflow is implemented');
 assert.equal(typeof storage?.createProjectStore,'function','atomic project store is implemented');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-workflow-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const store=await storage.createProjectStore(dir);
 const buildLockedSpec=o=>({schemaVersion:'1.4.0',profileVersion:'0.1.0',grammar:makeGrammar({templateId:o.templateId,cellPixels:o.cellPixels??16,ppu:o.ppu??100,strategy:'layered',masterPixels:64}),purpose:o.description??'test'});
 const create=st=>module.createWorkflowSession({store:st,buildLockedSpec,compileMaster:(spec,files)=>compileMaster(spec.grammar,files.master)});
 const s=await create(store);await s.configure({templateId:'XH-GRASS-8COND-01',cellPixels:16,ppu:100,description:'原创测试'});await s.lockFormat();
 return {dir,store,s,create,buildLockedSpec};
}
test('formal production requires an explicit precise-version approval',async t=>{
 const {s}=await setup(t);await assert.rejects(s.productionGuard(),/批准/);
 await s.importSample(png(),{kind:'sample',source:'file'});
 await assert.rejects(s.approveSample({explicit:false}),/明确/);
 await s.approveSample({explicit:true,notes:'UI click'});
 const p=await s.productionGuard(),state=await s.getState();
 assert.equal(p.sample.sha256,nodeHash(png()));assert.deepEqual(p.sample.bytes,png());assert.equal(p.approval.approvedBy,'user-explicit');assert.equal(state.gates.formalReady,true);assert.equal(state.compiled,null);
});
test('new revisions revoke current approval and retain both original files',async t=>{
 const {s,store}=await setup(t);await s.importSample(png(),{kind:'sample',source:'clipboard',testOnly:true});const first=(await s.getState()).selectedSampleId;
 await s.approveSample({explicit:true});await s.recordRequest('formal-master-task');
 await s.importSample(png(60),{kind:'manual',source:'file',parentId:first});const st=await s.getState();
 assert.equal(st.versions.length,2);assert.equal(st.versions[1].parentId,first);assert.equal(st.versions[1].testOnly,true);assert.equal(st.approval.stale,true);assert.equal(st.requests[0].stale,true);assert.equal(st.gates.formalReady,false);
 assert.deepEqual((await s.getSample(first)).bytes,png());assert.equal(await store.hasBlob(st.versions[0]),true);
 await s.selectSample(first);await assert.rejects(s.productionGuard(),/批准|陈旧/);await s.approveSample({explicit:true,testOnly:false});assert.equal((await s.productionGuard()).approval.approvedBy,'synthetic/test-only');
});
test('style and manual versions require a valid parent and support returning to older versions',async t=>{
 const {s}=await setup(t);await assert.rejects(s.importSample(png(),{kind:'style',parentId:'missing'}),/父版本/);
 await s.importSample(png(),{kind:'sample'});const a=(await s.getState()).selectedSampleId;
 await s.importSample(png(70),{kind:'style',parentId:a});const b=(await s.getState()).selectedSampleId;
 await s.importSample(png(100),{kind:'style',parentId:b});await s.selectSample(b);
 assert.equal((await s.getState()).versions.length,3);assert.equal((await s.getState()).selectedSampleId,b);
 await s.importSample(png(120),{kind:'manual',parentId:b});const st=await s.getState();assert.equal(st.versions[3].parentId,b);assert.equal(st.versions[3].styleStep,'ai-refined');
});
test('manual-only provenance is explicit and duplicate PNG is rejected without overwriting',async t=>{
 const {s}=await setup(t);await s.importSample(png(),{kind:'sample'});const id=(await s.getState()).selectedSampleId;
 await s.importSample(png(60),{kind:'manual',parentId:id});assert.equal((await s.getState()).versions[1].styleStep,'manual-only');
 await assert.rejects(s.importSample(png(60),{kind:'manual',parentId:id}),/重复/);assert.equal((await s.getState()).versions.length,2);
});
test('bad sample bytes remain archived with explicit failure and no approval',async t=>{
 const {s}=await setup(t);const broken=Buffer.from('not a PNG');await assert.rejects(s.importSample(broken,{kind:'sample',source:'file'}),/PNG/);
 const st=await s.getState();assert.equal(st.stage,'SAMPLE_REJECTED');assert.equal(st.versions[0].accepted,false);assert.equal(st.versions[0].sha256,nodeHash(broken));assert.deepEqual((await s.getSample(st.versions[0].id)).bytes,broken);await assert.rejects(s.approveSample({explicit:true}),/有效/);
});
test('format change invalidates old approval and production output but retains samples',async t=>{
 const {s}=await setup(t);await s.importSample(png(),{kind:'sample'});await s.approveSample({explicit:true});await s.recordRequest('formal-master-task');
 await s.configure({templateId:'XH-GRASS-8COND-01',cellPixels:16,ppu:80});await s.lockFormat();const st=await s.getState();
 assert.equal(st.versions.length,1);assert.equal(st.approval.stale,true);assert.equal(st.requests[0].stale,true);await assert.rejects(s.approveSample({explicit:true}),/规格/);
});
test('atomic restore recovers original PNG, exact approval, and compiled outputs after restart',async t=>{
 const {s,store,create}=await setup(t);await s.importSample(png(),{kind:'sample',testOnly:true});await s.approveSample({explicit:true});const before=await s.getState();
 const raw=templateImages(before.lockedSpec.grammar).blank;await s.importMaster({master:raw},{source:'file'});await s.compile();await s.recordValidation({passed:true,issues:[]});
 const fresh=await create(await storage.createProjectStore(store.root));const st=await fresh.getState();
 assert.equal(st.stage,'STRUCTURE_CHECKED');assert.equal(st.approval.id,before.approval.id);assert.equal(st.approval.trustedCurrent,true);assert.equal(st.compiled.artAcceptance,'pending-human-review');assert.equal(st.compiled.unitySorting,'unverified');assert.equal((await fresh.getCompiled()).tiles.length,47);assert.deepEqual((await fresh.getSample(st.selectedSampleId)).bytes,png());
});
test('successful result delivery requires passed current output and persists EXPORTED plus exact ZIP identity',async t=>{
 const {s,store,create}=await setup(t);
 assert.equal(typeof s.recordExport,'function','result delivery has an explicit persisted transition');
 await s.importSample(png(),{kind:'sample',source:'synthetic-test',testOnly:true});await s.approveSample({explicit:true});
 const before=await s.getState();await s.importMaster({master:templateImages(before.lockedSpec.grammar).blank});await s.compile();
 const delivery={sha256:nodeHash(Buffer.from('actual saved ZIP identity fixture')),fileBytes:1024};
 await assert.rejects(s.recordExport(delivery),/结构|验证/);
 assert.equal((await s.getState()).stage,'COMPILED');
 await s.recordValidation({passed:true,issues:[]});
 await assert.rejects(s.recordExport({...delivery,sha256:'invalid'}),/SHA|哈希|交付/);
 await s.recordExport(delivery);const delivered=await s.getState();
 assert.equal(delivered.stage,'EXPORTED');assert.equal(delivered.compiled.delivery.sha256,delivery.sha256);assert.equal(delivered.compiled.delivery.fileBytes,delivery.fileBytes);
 assert.equal(delivered.compiled.artAcceptance,'pending-human-review');assert.equal(delivered.approval.testOnly,true);
 const restored=await create(await storage.createProjectStore(store.root)),fresh=await restored.getState();
 assert.equal(fresh.stage,'EXPORTED');assert.deepEqual(fresh.compiled.delivery,delivered.compiled.delivery);
 assert.ok(fresh.history.some(e=>e.event==='output-exported'&&e.outputId===fresh.compiled.id&&e.sha256===delivery.sha256));
 await restored.revokeApproval();await assert.rejects(restored.recordExport(delivery),/批准|陈旧/);
});

test('revoking approval makes historical masters and compiled results stale but keeps PNG',async t=>{
 const {s}=await setup(t);await s.importSample(png(),{kind:'sample'});await s.approveSample({explicit:true});const st=await s.getState();const raw=templateImages(st.lockedSpec.grammar).blank;
 await s.importMaster({master:raw});await s.compile();await s.revokeApproval('回到人工修改');const after=await s.getState();
 assert.equal(after.stage,'APPROVAL_REVOKED');assert.equal(after.masters[0].stale,true);assert.equal(after.compiled.stale,true);await assert.rejects(s.compile(),/批准|陈旧/);assert.deepEqual((await s.getMaster(after.masters[0].id)).files.master,raw);
});
test('wrong formal canvas is rejected with retained raw and makes previous output stale',async t=>{
 const {s}=await setup(t);await s.importSample(png(),{kind:'sample'});await s.approveSample({explicit:true});const st=await s.getState();await s.importMaster({master:templateImages(st.lockedSpec.grammar).blank});await s.compile();
 const raw=png(90,31,31);await assert.rejects(s.importMaster({master:raw}),/尺寸/);const after=await s.getState();assert.equal(after.stage,'MASTER_REJECTED');assert.equal(after.compiled.stale,true);assert.equal(after.masters[1].accepted,false);assert.deepEqual((await s.getMaster(after.masters[1].id)).files.master,raw);
});
test('project ZIP roundtrip on same machine preserves seal; foreign machine requires explicit reapproval',async t=>{
 const {s,create}=await setup(t);await s.importSample(png(),{kind:'sample'});await s.approveSample({explicit:true});const pack=await s.exportProject();
 await s.importProject(pack);assert.equal((await s.getState()).gates.formalReady,true);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-foreign-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const foreign=await create(await storage.createProjectStore(dir));await foreign.importProject(pack);
 const st=await foreign.getState();assert.equal(st.versions.length,1);assert.equal(st.approval.trustedCurrent,false);await assert.rejects(foreign.productionGuard(),/批准|签名/);await foreign.approveSample({explicit:true});assert.equal((await foreign.getState()).gates.formalReady,true);
});
test('rehashing a tampered project manifest cannot promote changed sample bytes or forged approval',async t=>{
 const {s}=await setup(t);await s.importSample(png(),{kind:'sample'});await s.approveSample({explicit:true});const files=unzipSync(await s.exportProject());
 const m=JSON.parse(Buffer.from(files['manifest.json']).toString());m.session.approval.approvedBy='synthetic/test-only';m.session.approval.testOnly=true;m.session.versions[0].testOnly=true;
 m.sessionSha256=nodeHash(Buffer.from(JSON.stringify(m.session)));files['manifest.json']=Buffer.from(JSON.stringify(m));
 await s.importProject(Buffer.from(zipSync(files)));const st=await s.getState();assert.equal(st.gates.formalReady,false);assert.equal(st.approval.trustedCurrent,false);
});
test('unsafe project ZIP paths and missing PNG fail without replacing current project',async t=>{
 const {s}=await setup(t);await s.importSample(png(),{kind:'sample'});const before=await s.getState();const files=unzipSync(await s.exportProject());files['../escape.png']=new Uint8Array(png());
 await assert.rejects(s.importProject(Buffer.from(zipSync(files))),/路径|path/i);assert.equal((await s.getState()).taskId,before.taskId);
 const original=unzipSync(await s.exportProject());delete original[before.versions[0].relativePath];await assert.rejects(s.importProject(Buffer.from(zipSync(original))),/缺失|missing/i);assert.equal((await s.getState()).versions.length,1);
});
test('disk blob hash corruption is detected and store never follows a symlink',async t=>{
 const {s,store}=await setup(t);await s.importSample(png(),{kind:'sample'});const st=await s.getState();await fs.writeFile(path.join(store.root,st.versions[0].relativePath),png(150));await assert.rejects(s.getSample(st.selectedSampleId),/SHA|哈希|hash/i);
 const other=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-link-'));t.after(()=>fs.rm(other,{recursive:true,force:true}));const link=path.join(store.root,'link');try{await fs.symlink(other,link,'junction');await assert.rejects(store.readBlob({relativePath:'link/file.png',sha256:'0'.repeat(64),fileBytes:4}),/路径|链接|path/i);}catch(e){if(e.code!=='EPERM')throw e;}
});
test('style or manual return rejects changed canvas and transparency class but retains raw revision',async t=>{
 const {s}=await setup(t);await s.importSample(png(),{kind:'sample'});const id=(await s.getState()).selectedSampleId;
 await assert.rejects(s.importSample(png(55,65,64),{kind:'style',parentId:id}),/尺寸/);
 const transparent=PNG.sync.read(png(70));transparent.data[3]=0;await assert.rejects(s.importSample(PNG.sync.write(transparent),{kind:'manual',parentId:id}),/透明|Alpha/i);
 const st=await s.getState();assert.equal(st.versions.length,3);assert.equal(st.versions[1].accepted,false);assert.equal(st.versions[2].accepted,false);assert.equal(st.selectedSampleId,id);
});
test('explicit selected references persist with roles and original bytes and no extra images',async t=>{
 const {s,store,create}=await setup(t);await s.setReferences([{refId:'content-01',role:'content',sourceName:'own.png',note:'造型',bytes:png()},{refId:'style-01',role:'style',sourceName:'style.png',note:'笔触',bytes:png(90)}]);
 const fresh=await create(store),refs=await fresh.getReferences();assert.equal(refs.length,2);assert.equal(refs[1].role,'style');assert.deepEqual(refs[0].bytes,png());
 const files=unzipSync(await fresh.exportProject());assert.equal(Object.keys(files).length,3);await assert.rejects(s.setReferences([{refId:'bad',role:'unselected',bytes:png()}]),/角色|role/);
});
test('art-directed material and contour layers persist independently until both exact layers are present',async t=>{
 const {store}=await setup(t);const {makeArtGrammar,compileArtDirected,artTemplateImages,validateArtLayer}=require('../grammar/art-directed.cjs');
 const buildLockedSpec=o=>({schemaVersion:'1.4.0',grammar:makeArtGrammar(o)});
 const create=()=>module.createWorkflowSession({store,buildLockedSpec,compileMaster:(spec,files)=>compileArtDirected(spec.grammar,files),validateMasterLayer:(spec,role,bytes)=>validateArtLayer(spec.grammar,role,bytes)});
 await store.saveSession(null); // Start an independent task in the same private store while retaining existing snapshots.
 const s=await create();await s.configure({strategy:'art-directed',templateId:'XH-GRASS-8COND-01',cellPixels:16,ppu:100});await s.lockFormat();await s.importSample(png(),{kind:'sample',testOnly:true});await s.approveSample({explicit:true});const images=artTemplateImages((await s.getState()).lockedSpec.grammar);
 await s.importMaster({materials:images.materials},{source:'file'});assert.equal((await s.getState()).masters[0].pending,true);await assert.rejects(s.compile(),/缺层/);
 const restored=await create();assert.deepEqual((await restored.getMasterInputs()).materials,images.materials);await restored.importMaster({contour:images.contour},{source:'clipboard'});assert.equal((await restored.getState()).masters[1].accepted,true);await restored.compile();assert.equal((await restored.getCompiled()).tiles.length,47);
});
test('foreign approval remains in history after local explicit reapproval',async t=>{
 const {s,create}=await setup(t);await s.importSample(png(),{kind:'sample'});await s.approveSample({explicit:true});const oldId=(await s.getState()).approval.id;
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'2dw-history-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const foreign=await create(await storage.createProjectStore(dir));await foreign.importProject(await s.exportProject());await foreign.approveSample({explicit:true});
 const st=await foreign.getState();assert.equal(st.approvalHistory.some(a=>a.id===oldId&&a.status==='untrusted'),true);assert.notEqual(st.approval.id,oldId);
});
test('initial sample obeys the sample-stage budget and rejected revisions retain their bytes',async t=>{
 const {s}=await setup(t);for(const [w,h] of [[63,64],[64,63],[2049,64]]){const bytes=png(50,w,h);await assert.rejects(s.importSample(bytes,{kind:'sample'}),/样品.*尺寸|尺寸.*样品/);const st=await s.getState();assert.deepEqual((await s.getSample(st.versions.at(-1).id)).bytes,bytes);}
 await s.importSample(png(70,64,64),{kind:'sample'});assert.equal((await s.getState()).versions.at(-1).accepted,true);
});
test('selecting a non-approved version blocks formal export even when a different approval exists',async t=>{
 const {s}=await setup(t);await s.importSample(png(),{kind:'sample'});const first=(await s.getState()).selectedSampleId;await s.importSample(png(60),{kind:'style',parentId:first});await s.approveSample({explicit:true});
 await s.selectSample(first);assert.equal((await s.getState()).gates.formalReady,false);await assert.rejects(s.productionGuard(),/批准|选中/);
});
test('automatic task title is concise without truncating the actual production description',async t=>{
 const {s}=await setup(t);const description='典型外角、内角、土层与草面需要明确。'.repeat(20);await s.configure({templateId:'XH-GRASS-8COND-01',cellPixels:16,description});await s.lockFormat();const state=await s.getState();assert.equal(state.options.description,description);assert.equal(state.title.length<=120,true);
});
test('failed second art layer can be corrected without discarding the first valid material layer',async t=>{
 const {store}=await setup(t);const {makeArtGrammar,compileArtDirected,artTemplateImages,validateArtLayer}=require('../grammar/art-directed.cjs');await store.saveSession(null);
 const s=await module.createWorkflowSession({store,buildLockedSpec:o=>({schemaVersion:'1.4.0',grammar:makeArtGrammar(o)}),compileMaster:(spec,files)=>compileArtDirected(spec.grammar,files),validateMasterLayer:(spec,role,b)=>validateArtLayer(spec.grammar,role,b)});
 await s.configure({strategy:'art-directed',cellPixels:16});await s.lockFormat();await s.importSample(png(),{kind:'sample'});await s.approveSample({explicit:true});const images=artTemplateImages((await s.getState()).lockedSpec.grammar);
 await s.importMaster({materials:images.materials});await assert.rejects(s.importMaster({contour:png(50,31,16)}),/尺寸/);assert.deepEqual((await s.getMasterInputs()).materials,images.materials);
 await s.importMaster({contour:images.contour});assert.equal((await s.getState()).gates.compileReady,true);await s.compile();assert.equal((await s.getCompiled()).tiles.length,47);
});
test('project import rejects metadata that misstates actual dimensions or drops inherited test-only provenance',async t=>{
 const {s}=await setup(t);await s.importSample(png(),{kind:'sample',testOnly:true});const parentId=(await s.getState()).selectedSampleId;await s.importSample(png(90),{kind:'manual',parentId});
 const original=await s.exportProject();for(const mutate of [m=>{m.session.versions[0].width=90;},m=>{m.session.versions[1].testOnly=false;}]){const files=unzipSync(original),m=JSON.parse(Buffer.from(files['manifest.json']));mutate(m);files['manifest.json']=Buffer.from(JSON.stringify(m));await assert.rejects(s.importProject(Buffer.from(zipSync(files))),/尺寸|来源|provenance|test-only/);}
 assert.equal((await s.getState()).versions[1].testOnly,true);
});
