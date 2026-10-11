import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let form,pressure;
try{form=require('../workflow/form-contract.cjs');pressure=require('../workflow/style-pressure.cjs');}catch{}

test('ground and stone resolve mutually exclusive fixed views instead of accepting arbitrary camera declarations',()=>{
 assert(form,'missing fixed form contract module');
 const ground=form.resolveFormContract('XH-GRASS-8COND-01'),stone=form.resolveFormContract('XH-STONE-EDGE-8COND-01');
 assert.equal(ground.projection,'orthographic');assert.equal(ground.surfaceMode,'flat-top');assert.equal(ground.frontDirection,null);assert(!ground.allowedFaces.includes('front-face'));
 assert.equal(stone.frontDirection,'screen-down');assert.equal(stone.cameraFrame,'shared-fixed');assert(stone.allowedFaces.includes('fixed-front-face'));
 assert.deepEqual(ground.sampleLayout.regions.map(r=>[r.column,r.row,r.role]),[[0,0,'center'],[1,0,'edge'],[0,1,'outer-corner'],[1,1,'inner-corner-or-hole']]);
 assert.throws(()=>form.resolveFormContract('XH-GRASS-8COND-01','F-STONE-EDGE-FRONT-v1'),/模板|视角/);
 assert.throws(()=>form.resolveFormContract('XH-STONE-EDGE-8COND-01','free-camera'),/模板|视角/);
 assert.throws(()=>form.resolveFormContract('unknown'),/模板|视角/);
 const forged={...ground,frontDirection:'screen-down',allowedFaces:['front-face']};assert.throws(()=>form.assertFormContract(forged,'XH-GRASS-8COND-01'),/形式|契约/);
});

test('pressure defaults to standard, off retains inherited style and extreme cannot become image quantization',()=>{
 assert(pressure,'missing task style-pressure module');
 assert.equal(pressure.resolveStylePressure().mode,'standard');assert.equal(pressure.resolveStylePressure('off').additionalRules.length,0);
 for(const mode of ['off','standard','extreme']){const p=pressure.resolveStylePressure(mode);assert.equal(p.scope,'current-task');assert.equal(p.catalogStatus,'candidate');assert.equal(p.inheritsApprovedStyle,true);assert.equal(p.applyToNumericContour,false);assert.equal(p.pixelQuantization,false);}
 const extreme=pressure.resolveStylePressure('extreme');assert.equal(extreme.majorMaterialGroups,2);assert.equal(extreme.highlightEdgePolicy,'forbidden');
 assert.throws(()=>pressure.resolveStylePressure('stronger'),/档位/);
 assert.throws(()=>pressure.assertStylePressure({...extreme,applyToNumericContour:true}),/压制|契约/);
});

test('a form review binds the actual sample and locked view before permitting style or production',()=>{
 assert(form,'missing form review contract');
 const spec={viewContract:form.resolveFormContract('XH-GRASS-8COND-01'),stylePressure:pressure.resolveStylePressure('standard')};
 const sample={id:'sample-1',revision:2,sha256:'a'.repeat(64),testOnly:false},specHash='b'.repeat(64);
 const review={schemaVersion:'2dw-form-review/1',sampleId:sample.id,revision:2,sha256:sample.sha256,specHash,viewContractId:spec.viewContract.id,stylePressureId:spec.stylePressure.id,status:'conforms',reviewedBy:'user-explicit',reviewedAt:'2026-10-11T00:00:00.000Z',notes:'Checked the exact PNG',checks:{assetType:true,sharedCamera:true,noForbiddenFaces:true,productionIntent:true}};
 assert.deepEqual(form.validateFormReview(review,{sample,spec,specHash,requirePassed:true}),review);
 assert.throws(()=>form.validateFormReview({...review,sha256:'c'.repeat(64)},{sample,spec,specHash,requirePassed:true}),/身份|SHA/);
 assert.throws(()=>form.validateFormReview({...review,checks:{...review.checks,assetType:false}},{sample,spec,specHash,requirePassed:true}),/形式|检查/);
 assert.throws(()=>form.validateFormReview({...review,reviewedBy:'synthetic/test-only'},{sample,spec,specHash,requirePassed:true}),/来源|夹具/);
 assert.throws(()=>form.validateFormReview({...review,status:'unchecked'},{sample,spec,specHash,requirePassed:true}),/形式|检查/);
 assert.throws(()=>form.validateFormReview({...review,status:'rejected'},{sample,spec,specHash,requireConforms:true}),/形式|检查/);
});
