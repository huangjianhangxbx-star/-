import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{PNG}=require('pngjs'),{sha,canonical}=require('../workflow/store.cjs'),legacy=require('../workflow/package.cjs');
let v7;try{v7=require('../workflow/package-v7.cjs');}catch{}
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
function inputs(spec){const p=new PNG({width:64,height:64});for(let i=0;i<p.data.length;i+=4)p.data.set([96,120,79,255],i);const bytes=PNG.sync.write(p),sample={id:'sample-original',revision:3,sha256:sha(bytes),bytes,kind:'manual',testOnly:true};
 const hash=v7.specHash(spec),formReview={schemaVersion:'2dw-form-review/1',sampleId:sample.id,revision:3,sha256:sample.sha256,specHash:hash,viewContractId:spec.viewContract.id,stylePressureId:spec.stylePressure.id,status:'conforms',reviewedBy:'synthetic/test-only',reviewedAt:'2026-10-11T00:00:00.000Z',notes:'Original technical fixture only',checks:{assetType:true,sharedCamera:true,noForbiddenFaces:true,productionIntent:true}};
 const approval={id:'approval-test',sampleId:sample.id,revision:3,sha256:sample.sha256,fileBytes:bytes.length,specHash:hash,templateId:spec.grammar.template.id,templateVersion:spec.grammar.template.version,profileVersion:'1',approvedBy:'synthetic/test-only',approvedAt:'2026-10-11T00:00:00.000Z',testOnly:true,formReviewSha256:sha(Buffer.from(canonical(formReview)))};return {sample,formReview,approval};}
function resign(files,key){const changed={...files},old=JSON.parse(changed['manifest.json']),{publicKey,signature,...authority}=old;authority.entries=Object.entries(changed).filter(([p])=>p!=='manifest.json').sort(([a],[b])=>a.localeCompare(b)).map(([path,b])=>({path,sha256:sha(b),byteLength:b.length}));changed['manifest.json']=json({...authority,publicKey,signature:crypto.sign(null,json(authority),key).toString('base64')});return changed;}

test('v7 opt-in fixes form and pressure while old v6 builder retains its original protocol',()=>{
 assert(v7,'missing independent v7 stage adapter');const options={protocolVersion:7,templateId:'XH-GRASS-8COND-01',cellPixels:64};
 const standard=v7.buildLockedSpec(options),extreme=v7.buildLockedSpec({...options,stylePressure:'extreme'}),off=v7.buildLockedSpec({...options,stylePressure:'off'});
 assert.equal(standard.schemaVersion,'1.5.0');assert.equal(standard.protocolVersion,7);assert.equal(standard.stylePressure.mode,'standard');assert.equal(standard.viewContract.frontDirection,null);
 assert.notEqual(v7.specHash(standard),v7.specHash(extreme));assert.notEqual(v7.specHash(standard),v7.specHash(off));assert.deepEqual(off.environmentStyle,standard.environmentStyle);
 assert.throws(()=>v7.buildLockedSpec({...options,frontDirection:'screen-down'}),/字段|视角/);assert.throws(()=>v7.buildLockedSpec({...options,viewContractId:'F-STONE-EDGE-FRONT-v1'}),/模板|视角/);assert.throws(()=>v7.buildLockedSpec({...options,protocolVersion:6}),/协议/);
 assert.equal(legacy.buildLockedSpec({templateId:options.templateId,cellPixels:64}).schemaVersion,'1.4.0');
 assert.throws(()=>v7.assertLockedSpec({...standard,viewContract:{...standard.viewContract,frontDirection:'screen-down'}}),/镜像|视角|契约/);
});

test('all v7 stages derive a consistent 2x2 view and package mirrors without changing the compiler contract',()=>{
 assert(v7,'missing independent v7 stage adapter');const key=crypto.generateKeyPairSync('ed25519').privateKey;
 for(const templateId of ['XH-GRASS-8COND-01','XH-STONE-EDGE-8COND-01']){
  const spec=v7.buildLockedSpec({protocolVersion:7,templateId,cellPixels:64,stylePressure:'extreme'}),chain=inputs(spec);
  for(const stage of ['sample-task','style-refine-task','formal-master-task']){
   const p=v7.buildStagePackage({stage,sessionId:'v7-test-chain',lockedSpec:spec,...chain},[],key),read=v7.validateStageZip(p.bytes);
   assert.equal(read.manifest.schemaVersion,'2dw-zip/7');assert.equal(read.spec.schemaVersion,'1.5.0');assert.deepEqual(read.spec.lockedSpec.viewContract,spec.viewContract);
   const guide=PNG.sync.read(p.files['guides/view-guide.png']);assert.equal(guide.width,640);assert.equal(guide.height,560);assert.equal(sha(p.files['guides/view-guide.png']),sha(v7.viewGuide(spec)));
   const layout=PNG.sync.read(p.files['guides/sample-layout.png']);assert.equal(layout.width,128);assert.equal(layout.height,128);
   assert(p.files['style/style-pressure.md']);assert(p.files['guides/view-checklist.md']);
   if(stage!=='sample-task')assert.deepEqual(read.spec.formReview,chain.formReview);
   if(stage==='formal-master-task'){assert.deepEqual(p.spec.output.files.map(f=>[f.name,f.widthPx,f.heightPx]),[['materials.png',256,128],['contour.png',128,64]]);assert.equal(p.spec.approval.sha256,chain.sample.sha256);}
  }
 }
});

test('style and formal reject missing, rejected or stale reviews instead of preserving an incorrect view',()=>{
 assert(v7,'missing v7 form gate');const spec=v7.buildLockedSpec({protocolVersion:7,templateId:'XH-GRASS-8COND-01',cellPixels:64}),chain=inputs(spec),args={stage:'style-refine-task',sessionId:'v7-gates',lockedSpec:spec,...chain};
 assert.throws(()=>v7.buildStagePackage({...args,formReview:undefined}),/形式|检查/);
 assert.throws(()=>v7.buildStagePackage({...args,formReview:{...chain.formReview,status:'rejected'}}),/形式|检查/);
 assert.throws(()=>v7.buildStagePackage({...args,formReview:{...chain.formReview,revision:2}}),/身份|检查/);
 const changed=v7.buildLockedSpec({protocolVersion:7,templateId:'XH-GRASS-8COND-01',cellPixels:64,stylePressure:'extreme'});assert.throws(()=>v7.buildStagePackage({...args,lockedSpec:changed}),/身份|检查/);
});

test('re-signing a changed guide, view or mode cannot bypass canonical v7 mirrors',()=>{
 assert(v7,'missing v7 mirror verifier');const key=crypto.generateKeyPairSync('ed25519').privateKey,spec=v7.buildLockedSpec({protocolVersion:7,templateId:'XH-STONE-EDGE-8COND-01',cellPixels:64}),pack=v7.buildStagePackage({stage:'sample-task',sessionId:'v7-forgery',lockedSpec:spec},[],key);
 for(const mutate of [f=>{f['guides/view-guide.png']=Buffer.from(f['guides/sample-layout.png']);},f=>{f['style/style-pressure.md']=Buffer.from('cancel approved style');},f=>{const s=JSON.parse(f['spec/asset-spec.json']);s.lockedSpec.stylePressure.mode='extreme';f['spec/asset-spec.json']=json(s);},f=>{const s=JSON.parse(f['spec/asset-spec.json']);s.lockedSpec.viewContract.frontDirection='screen-left';f['spec/asset-spec.json']=json(s);}]){
  const f={...pack.files};mutate(f);assert.throws(()=>v7.validateStageZip(resign(f,key)),/镜像|契约|视角/);
 }
});

test('bundled original guide files match the canonical diagram used by v7 packages',()=>{
 assert(v7,'missing deterministic original guides');for(const kind of ['grass','stone']){const g=v7.buildLockedSpec({protocolVersion:7,templateId:kind==='grass'?'XH-GRASS-8COND-01':'XH-STONE-EDGE-8COND-01'});assert.equal(sha(fs.readFileSync(new URL(`../resources/tile-templates/${kind}-view-guide.png`,import.meta.url))),sha(v7.viewGuide(g)));}
});

test('formal approval seals the precise reviewed checklist rather than accepting edited reviewer notes',()=>{
 assert(v7,'missing exact form-review approval binding');const key=crypto.generateKeyPairSync('ed25519').privateKey,spec=v7.buildLockedSpec({protocolVersion:7,templateId:'XH-GRASS-8COND-01',cellPixels:64}),chain=inputs(spec),args={stage:'formal-master-task',sessionId:'v7-review-seal',lockedSpec:spec,...chain};
 assert.throws(()=>v7.buildStagePackage({...args,formReview:{...chain.formReview,notes:'Changed after approval'}}),/检查|批准|SHA/);
 const pack=v7.buildStagePackage(args,[],key),f={...pack.files},s=JSON.parse(f['spec/asset-spec.json']);s.formReview.notes='Changed after approval';f['spec/asset-spec.json']=json(s);f['input/form-review.json']=json(s.formReview);assert.throws(()=>v7.validateStageZip(resign(f,key)),/检查|批准|SHA/);
});
