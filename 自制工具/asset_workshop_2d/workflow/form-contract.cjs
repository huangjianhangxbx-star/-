'use strict';
const {isDeepStrictEqual}=require('node:util');
const clone=value=>JSON.parse(JSON.stringify(value));
const templates={'XH-GRASS-8COND-01':'F-GROUND-TOPDOWN-v1','XH-STONE-EDGE-8COND-01':'F-STONE-EDGE-FRONT-v1'};
const regions=[{column:0,row:0,role:'center',label:'主体 / 中心面'},{column:1,row:0,role:'edge',label:'接边 / 前沿'},{column:0,row:1,role:'outer-corner',label:'外角'},{column:1,row:1,role:'inner-corner-or-hole',label:'内角 / 孔洞'}];
function resolveFormContract(templateId,viewContractId){
 const expected=templates[templateId];if(!expected||viewContractId!==undefined&&viewContractId!==expected)throw Error('模板与固定视角不匹配；不接受自由相机或未知视角');
 const stone=templateId==='XH-STONE-EDGE-8COND-01';
 return {schemaVersion:'2dw-view-contract/1',id:expected,version:'1.0.0',templateId,status:'candidate',projection:'orthographic',screenX:'right',screenY:'down',
  unityScreenConversion:'image +X maps to Unity XY +X; image +Y maps to Unity XY -Y; not a Unity sorting-axis assertion',cameraFrame:'shared-fixed',
  surfaceMode:stone?'top-with-fixed-front-face':'flat-top',frontDirection:stone?'screen-down':null,
  allowedFaces:stone?['top-plane','fixed-front-face','boundary-contact-dark-block']:['top-plane','edge-alpha','flat-underlay'],forbidFreeCameraRotation:true,
  forbiddenViews:['three-quarter-perspective','vanishing-point-perspective','independent-object-rotation','free-camera-per-sample',...(stone?['front-face-changing-direction','free-standing-rock-display']:['raised-grass-platform','visible-side-face','horizon'])],
  gridIntent:'2d-square-grid-auto-connection',sharedMaterialDirection:true,sharedLightingDirection:true,
  sampleLayout:{columns:2,rows:2,semanticOnly:true,automaticPixelSegmentation:false,regions:clone(regions)},unitySorting:'unverified'};
}
function assertFormContract(contract,templateId=contract?.templateId){if(!isDeepStrictEqual(contract,resolveFormContract(templateId,contract?.id)))throw Error('形式契约不匹配，禁止改变已锁定投影/可见面/方向');return contract;}
const checkNames=['assetType','sharedCamera','noForbiddenFaces','productionIntent'];
function validateFormReview(review,{sample,spec,specHash,requirePassed=false,requireConforms=false}={}){
 if(!review||review.schemaVersion!=='2dw-form-review/1'||!sample||!spec||typeof specHash!=='string')throw Error('缺少可审阅的形式检查快照');
 const fields=['schemaVersion','sampleId','revision','sha256','specHash','viewContractId','stylePressureId','status','reviewedBy','reviewedAt','notes','checks'];
 if(Object.keys(review).some(k=>!fields.includes(k))||fields.some(k=>!Object.hasOwn(review,k)))throw Error('形式检查快照字段非法');
 if(review.sampleId!==sample.id||review.revision!==sample.revision||review.sha256!==sample.sha256||review.specHash!==specHash||review.viewContractId!==spec.viewContract.id||review.stylePressureId!==spec.stylePressure.id)throw Error('形式检查身份或 SHA 与当前样品/规格不一致');
 if(!['unchecked','conforms','rejected'].includes(review.status)||!['user-explicit','synthetic/test-only'].includes(review.reviewedBy))throw Error('形式检查状态或来源非法');
 if((review.reviewedBy==='synthetic/test-only')!==!!sample.testOnly)throw Error('形式检查来源与测试夹具标记不一致');
 if(typeof review.notes!=='string'||review.notes.length>2000||review.notes.includes('\0')||!(review.reviewedAt===null||typeof review.reviewedAt==='string'&&review.reviewedAt.length<=80&&!Number.isNaN(Date.parse(review.reviewedAt))))throw Error('形式检查时间或说明非法');
 if(!review.checks||Object.keys(review.checks).length!==4||checkNames.some(k=>typeof review.checks[k]!=='boolean'))throw Error('形式检查四项清单不完整');
 if(review.status==='conforms'&&(!review.reviewedAt||checkNames.some(k=>!review.checks[k])))throw Error('形式检查通过需要明确时间及全部四项人工确认');
 if((requirePassed||requireConforms)&&review.status!=='conforms')throw Error('形式检查尚未通过；错误视角应返回小样试制，不能进入风格收口或正式制作');
 return clone(review);
}
function renderFormChecklist(contract){assertFormContract(contract);return `# 资产空间形式人工检查\n\n契约 ${contract.id} / ${contract.version}（候选）。Unity Sorting：${contract.unitySorting}。图像语义由用户检查，程序不会自动判定视角合格。\n\n- 正确平面 / 厚度方向：${contract.surfaceMode}；${contract.frontDirection??'无前立面，禁止草土立体台'}。\n- 四形态共享相同正交相机、平面尺度、材质与照明方向。\n- 无自由透视、消失点、任意旋转和各格单独摄影机。\n- 后续用途为2D方格联通，不能把独立3D概念摆拍当可生产样品。\n\n2×2语义：左上中心；右上接边 / 前沿；左下外角；右下内角 / 孔洞。固定的是语义排布，不自动宣称已精确分割返回PNG。\n\n屏幕 +X 向右、+Y 向下；Unity XY 映射为 +X / -Y，不能据此声称 sorting axis 已验证。说明图中的箭头、边框和文字只用于说明，不得画进返回样品。\n\n错误视角：保留原始PNG与原因，返回 sample-task 重试；不得使用 style-refine-task 合法化错误厚度。\n`;}
module.exports={resolveFormContract,assertFormContract,validateFormReview,normalizeFormReview:validateFormReview,renderFormChecklist,FORM_CHECK_NAMES:checkNames};
