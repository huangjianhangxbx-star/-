import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {transform} from 'esbuild';

let view;
try {
 const code=await fs.readFile(new URL('../desktop/workflow-panel.ts',import.meta.url),'utf8');
 const output=await transform(code,{loader:'ts',format:'esm',target:'es2022'});
 view=(await import('data:text/javascript;base64,'+Buffer.from(output.code).toString('base64'))).workflowView;
} catch {}
const sample={id:'s2',revision:2,accepted:true,sha256:'b'.repeat(64),specHash:'locked'};
const state={stage:'SAMPLE_APPROVED',format:'locked',specHash:'locked',versions:[sample],selectedSampleId:'s2',approval:{sampleId:'s2',sha256:sample.sha256,specHash:'locked',trustedCurrent:true,stale:false},gates:{sampleReady:true,styleReady:true,formalReady:true,compileReady:false}};

test('the formal action and approval caption follow the exact selected revision, not a permissive stale gate',()=>{
 assert.equal(typeof view,'function','new desktop workflow view is missing');
 const current=view(state);assert.equal(current.formalReady,true);assert.equal(current.approved,true);
 assert.equal(current.suggestedStep,4);
 for(const invalid of [
  {...state,approval:{...state.approval,stale:true}},
  {...state,approval:{...state.approval,sha256:'c'.repeat(64)}},
  {...state,approval:{...state.approval,trustedCurrent:false}},
  {...state,selectedSampleId:'s1'},
  {...state,specHash:'changed'},
  {...state,approval:null},
 ]) {assert.equal(view(invalid).formalReady,false);assert.equal(view(invalid).approved,false);}
});

test('failed originals and stale compilation cannot become a deliverable in the desktop view',()=>{
 assert.equal(typeof view,'function','new desktop workflow view is missing');
 const failed=view({...state,versions:[{...sample,accepted:false,error:'wrong dimensions'}]});
 assert.equal(failed.styleReady,false);assert.equal(failed.approveReady,false);assert.equal(failed.formalReady,false);
 const compiled={id:'c1',stale:false,structureStatus:'passed',artAcceptance:'pending-human-review'};
 assert.equal(view({...state,compiled}).exportReady,true);
 assert.equal(view({...state,compiled:{...compiled,stale:true}}).exportReady,false);
 assert.equal(view({...state,compiled:{...compiled,structureStatus:'failed'}}).exportReady,false);
 assert.equal(view({...state,format:'draft',compiled}).exportReady,false);
});
