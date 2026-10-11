import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {transform} from 'esbuild';

const source=await fs.readFile(new URL('../desktop/workflow-panel.ts',import.meta.url),'utf8');
const output=await transform(source,{loader:'ts',format:'esm',target:'es2022'});
const {workflowView,formUiView,isUntouchedWorkflow,formDraftIdentity}=await import('data:text/javascript;base64,'+Buffer.from(output.code).toString('base64'));
const sample={id:'s2',revision:2,accepted:true,sha256:'a'.repeat(64),fileBytes:321,width:256,height:256,specHash:'current'};
const checks={assetType:true,sharedCamera:true,noForbiddenFaces:true,productionIntent:true};
const state={stage:'SAMPLE_APPROVED',format:'locked',options:{protocolVersion:7,templateId:'XH-GRASS-8COND-01',stylePressure:'standard'},specHash:'current',versions:[sample],selectedSampleId:'s2',approval:{sampleId:'s2',sha256:sample.sha256,specHash:'current',trustedCurrent:true,stale:false},gates:{sampleReady:true,styleReady:true,formalReady:true}};
const review={status:'conforms',sampleId:'s2',revision:2,sha256:sample.sha256,specHash:'current',checks,stale:false,trustedCurrent:true};

test('v7 style and formal production require all four human checks bound to the selected original',()=>{
 for(const bad of [undefined,{...review,status:'rejected'},{...review,sha256:'b'.repeat(64)},{...review,specHash:'old'},{...review,sampleId:'s1'},{...review,revision:1},{...review,stale:true},{...review,trustedCurrent:false},...Object.keys(checks).map(k=>({...review,checks:{...checks,[k]:false}}))]){
  const v=workflowView({...state,formReview:bad});
  assert.equal(v.styleReady,false,'unreviewed/wrong form must not become a style parent');
  assert.equal(v.approveReady,false,'unreviewed/wrong form must not be approved');
  assert.equal(v.formalReady,false,'an old permissive gate cannot authorize v7 production');
 }
 const valid=workflowView({...state,formReview:review});
 assert.equal(valid.styleReady,true);assert.equal(valid.approveReady,true);assert.equal(valid.formalReady,true);
});

test('legacy project approvals remain readable without claiming the new form contract is certified',()=>{
 assert.equal(typeof formUiView,'function','form view is not available');
 const legacy={...state,options:{templateId:'XH-STONE-EDGE-8COND-01'}};
 assert.equal(formUiView(legacy).legacy,true);
 assert.equal(formUiView(legacy).checked,false);
 assert.equal(workflowView(legacy).formalReady,true,'v6 semantics must remain compatible');
 const upgraded=formUiView({...state,formReview:review});
 assert.equal(upgraded.legacy,false);assert.equal(upgraded.checked,true);
 assert.equal(upgraded.mode,'standard');
});

test('the chosen template maps to one read-only camera contract and pressure defaults to standard',()=>{
 assert.equal(typeof formUiView,'function','form view is not available');
 const grass=formUiView(state);
 assert.equal(grass.contractId,'F-GROUND-TOPDOWN-v1');assert.match(grass.description,/正交俯视/);
 const stone=formUiView({...state,options:{...state.options,templateId:'XH-STONE-EDGE-8COND-01',stylePressure:'extreme'}});
 assert.equal(stone.contractId,'F-STONE-EDGE-FRONT-v1');assert.match(stone.description,/下方/);assert.equal(stone.mode,'extreme');
 assert.equal(formUiView({...state,options:{...state.options,stylePressure:undefined}}).mode,'standard');
});

test('only an untouched empty native profile initializes v7; no historical project auto-upgrades',()=>{
 assert.equal(typeof isUntouchedWorkflow,'function','fresh-profile classification is missing');
 const untouched={stage:'FORMAT_DRAFT',format:'draft',options:{},versions:[],requests:[],history:[],masters:[],outputs:[],references:[],approvalHistory:[],formReviewHistory:[],lockedSpec:null,specHash:null,approval:null,formReview:null};
 assert.equal(isUntouchedWorkflow(untouched),true);
 for(const historical of [{...untouched,options:{protocolVersion:6}},{...untouched,versions:[sample]},{...untouched,history:[{event:'reset'}]},{...untouched,requests:[{id:'r1'}]},{...untouched,references:[{refId:'r1'}]},{...untouched,stage:'FORMAT_LOCKED'},{...untouched,lockedSpec:{schemaVersion:'1.4.0'}}])assert.equal(isUntouchedWorkflow(historical),false);
});

test('the checkbox draft identity includes exact revision, original SHA and locked specification',()=>{
 assert.equal(typeof formDraftIdentity,'function','precise form draft identity is missing');
 const identity=formDraftIdentity(state);
 for(const changed of [{...state,versions:[{...sample,revision:3}]},{...state,versions:[{...sample,sha256:'c'.repeat(64)}]},{...state,specHash:'new-spec'},{...state,selectedSampleId:null}])assert.notEqual(formDraftIdentity(changed),identity);
 assert.equal(formDraftIdentity({...state,formReview:review}),identity,'the form check is bound to its exact image, not an arbitrary UI caption');
});
