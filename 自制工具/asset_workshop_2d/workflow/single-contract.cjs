'use strict';
const {isDeepStrictEqual}=require('node:util');
const {resolveFormContract}=require('./form-contract.cjs');
const SINGLE_CHECK_NAMES=['assetType','fixedView','referenceClarity','finalIdentity'];
const clone=v=>JSON.parse(JSON.stringify(v));
function resolveSingleView(templateId,viewId){
 const floor=templateId==='XH-STONE-FLOOR-8COND-01';
 const base=resolveFormContract(floor?'XH-GRASS-8COND-01':templateId);
 const id=floor?'F-STONE-FLOOR-TOPDOWN-v1':base.id;
 if(viewId!==undefined&&viewId!==id)throw Error('单图用途与固定视角不匹配');
 return {...base,schemaVersion:'2dw-single-view/1',id,templateId,cameraFrame:'single-reference-fixed',sampleLayout:{columns:1,rows:1,semanticOnly:true,automaticPixelSegmentation:false,regions:[{column:0,row:0,role:'visual-reference',label:'单张画法基准，不证明全部联通形态'}]}};
}
function roleFor(sample){return {schemaVersion:'2dw-single-role/1',sampleKind:'single-approved-reference',sourceKind:sample.testOnly?'synthetic-single-fixture':'user-manual-final',sampleId:sample.id,revision:sample.revision,sha256:sample.sha256,priority:'highest-for-art-style-and-material-language',uses:['visual-structure-hierarchy','linework','color-blocks','surface-damage-density'],notProofOf:['all-47-states','seamless-all-edges','inner-corner-geometry'],artApprovalStatus:sample.testOnly?'synthetic/test-only':'user-approved-as-reference-for-current-task'};}
function validateSingleReview(review,{sample,spec,specHash,requirePassed=false,requireConforms=false}={}){
 const fields=['schemaVersion','sampleId','revision','sha256','specHash','viewContractId','stylePressureId','status','reviewedBy','reviewedAt','notes','checks'];
 if(!review||review.schemaVersion!=='2dw-form-review/2'||!sample||!spec||spec.schemaVersion!=='1.6.0'||Object.keys(review).some(k=>!fields.includes(k))||fields.some(k=>!Object.hasOwn(review,k)))throw Error('单图检查快照字段非法');
 if(review.sampleId!==sample.id||review.revision!==sample.revision||review.sha256!==sample.sha256||review.specHash!==specHash||review.viewContractId!==spec.viewContract.id||review.stylePressureId!==spec.stylePressure.id)throw Error('单图检查与准确样品/规格/SHA不一致');
 if(!['unchecked','conforms','rejected'].includes(review.status)||review.reviewedBy!==(sample.testOnly?'synthetic/test-only':'user-explicit'))throw Error('单图检查来源或状态非法');
 if(!review.checks||Object.keys(review.checks).length!==4||SINGLE_CHECK_NAMES.some(k=>typeof review.checks[k]!=='boolean'))throw Error('单图四项检查不完整，不接受四形态共用相机检查');
 if(typeof review.notes!=='string'||review.notes.length>2000||review.notes.includes('\0')||!(review.reviewedAt===null||typeof review.reviewedAt==='string'&&review.reviewedAt.length<=80&&!Number.isNaN(Date.parse(review.reviewedAt))))throw Error('单图检查时间或说明非法');
 if(review.status==='conforms'&&(!review.reviewedAt||SINGLE_CHECK_NAMES.some(k=>!review.checks[k])))throw Error('单图检查通过需要四项明确确认');
 if((requirePassed||requireConforms)&&review.status!=='conforms')throw Error('单图用途/视角尚未明确确认');
 return clone(review);
}
function renderSingleChecklist(view){if(!isDeepStrictEqual(view,resolveSingleView(view?.templateId,view?.id)))throw Error('单图视角不匹配');return `# 单张视觉基准检查\n\n仅检查这一张原图：目标用途、固定视角、画法参考清晰度、准确定稿身份。\n\n${view.id} / ${view.surfaceMode} / 前面方向 ${view.frontDirection??'无侧面'}。不检查四图共用相机；不证明47态、内外角或接缝已完成。批准的是本任务唯一主要美术基准，不是整套美术验收。Unity Sorting 未验证。\n`;}
module.exports={resolveSingleView,roleFor,validateSingleReview,renderSingleChecklist,SINGLE_CHECK_NAMES};
