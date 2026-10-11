'use strict';
const crypto=require('node:crypto');
const {PNG}=require('pngjs');
const {canonical,sha,blobRecord}=require('./store.cjs');
const {validateFormReview,FORM_CHECK_NAMES}=require('./form-contract.cjs');
const SCHEMA='2dw-tile-session/1';
const STAGES=['FORMAT_DRAFT','FORMAT_LOCKED','SAMPLE_REQUEST_READY','SAMPLE_RECEIVED','SAMPLE_REJECTED','STYLE_REQUEST_READY','STYLE_RECEIVED','STYLE_REWORK_REQUESTED','SAMPLE_APPROVED','APPROVAL_REVOKED','PRODUCTION_REQUEST_READY','MASTER_RECEIVED','MASTER_REJECTED','COMPILED','STRUCTURE_CHECKED','STRUCTURE_FAILED','EXPORTED'];
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const clone=value=>JSON.parse(JSON.stringify(value));
const identity=prefix=>`${prefix}-${crypto.randomUUID()}`;
const cleanText=(value,max=2000)=>{assert(value===undefined||typeof value==='string','文字字段无效');const text=value??'';assert(text.length<=max&&!text.includes('\0'),'文字字段过长或包含非法字符');return text;};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(value);
const HASH=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function decodeSample(bytes,{sampleStage=true}={}){
 assert(Buffer.isBuffer(bytes)&&bytes.length>=24&&bytes.length<=32*1024*1024&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a','需要真实有效 PNG，且不超过32MB');
 const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);assert(w>0&&h>0&&w<=4096&&h<=4096&&w*h<=16*1024*1024,'PNG 尺寸超过4096边长或16MP安全预算');
 if(sampleStage)assert(w>=64&&h>=64&&w<=2048&&h<=2048&&w*h<=4*1024*1024,'样品 PNG 尺寸需为64–2048边长、最多4MP；正式母版使用其独立锁定规格');
 let p;try{p=PNG.sync.read(bytes);}catch{throw Error('PNG 损坏或无法解码');}
 let transparent=false,visible=false;for(let i=3;i<p.data.length;i+=4){if(p.data[i]!==255)transparent=true;if(p.data[i]>0)visible=true;}
 assert(visible,'PNG 完全透明，没有可审核样品');return {width:w,height:h,alphaClass:transparent?'transparent':'opaque'};
}
function approvalPayload(approval){const {seal,status,stale,trustedCurrent,...payload}=approval;return payload;}
function formPayload(review){const {seal,stale,trustedCurrent,...payload}=review;return payload;}
function allRecords(state){
 const records=[...state.versions,...state.references,...state.masters.flatMap(m=>Object.values(m.files))];
 function walk(value){if(value&&typeof value==='object'){if(value.$blob){records.push(value.$blob);return;}for(const v of Object.values(value))walk(v);}}
 for(const result of state.outputs)walk(result.artifacts);return records;
}
function validateState(s,buildLockedSpec){
 assert(s&&s.schemaVersion===SCHEMA&&id(s.taskId)&&typeof s.title==='string'&&s.title.length<=256,'工程会话身份无效');
 assert(STAGES.includes(s.stage)&&['draft','locked'].includes(s.format)&&s.options&&typeof s.options==='object'&&!Array.isArray(s.options),'工程阶段无效');
 assert(Array.isArray(s.versions)&&s.versions.length<=128&&Array.isArray(s.references)&&s.references.length<=8&&Array.isArray(s.requests)&&s.requests.length<=256&&Array.isArray(s.masters)&&s.masters.length<=128&&Array.isArray(s.outputs)&&s.outputs.length<=128&&Array.isArray(s.approvalHistory)&&s.approvalHistory.length<=256&&Array.isArray(s.history)&&s.history.length<=2048,'工程记录数量超限');
 if(s.lockedSpec){const rebuilt=buildLockedSpec(s.options);assert(canonical(rebuilt)===canonical(s.lockedSpec)&&s.specHash===sha(Buffer.from(canonical(rebuilt))),'工程锁定规格或 SHA 不一致');}
 else assert(s.format==='draft'&&s.specHash===null,'工程缺少锁定规格');
 const seen=new Map();for(const v of s.versions){
  blobRecord(v);assert(id(v.id)&&!seen.has(v.id)&&Number.isSafeInteger(v.revision)&&v.revision===seen.size+1&&['sample','style','manual'].includes(v.kind)&&typeof v.accepted==='boolean'&&typeof v.testOnly==='boolean'&&HASH(v.specHash)&&typeof v.createdAt==='string','样品版本身份无效');
  assert(v.parentId===null||(seen.has(v.parentId)&&seen.get(v.parentId).accepted),'样品父版本缺失或无效');assert(v.kind==='sample'||v.parentId,'修订样品缺少父版本');
  const parent=v.parentId?seen.get(v.parentId):null;assert(!parent?.testOnly||v.testOnly,'样品 test-only 来源不能被修订版本清除');
  if(v.adoptedFromSpecHash)assert(parent&&v.adoptedFromSpecHash===parent.specHash&&parent.specHash!==v.specHash&&parent.sha256===v.sha256&&parent.fileBytes===v.fileBytes&&parent.kind===v.kind,'跨规格重新检查必须保留精确父版本原字节');
  else assert(!parent||parent.specHash===v.specHash,'跨规格父版本需要明确重新检查操作');
  assert(v.styleStep===(v.kind==='style'||parent?.styleStep==='ai-refined'?'ai-refined':v.kind==='manual'?'manual-only':'not-run'),'样品 AI/人工工序来源记录不一致');
  assert(Number.isSafeInteger(v.width)&&Number.isSafeInteger(v.height)&&v.width>=0&&v.height>=0&&v.width<=4096&&v.height<=4096,'样品尺寸记录无效');
  assert(typeof v.source==='string'&&v.source.length<=128&&typeof v.purpose==='string'&&v.purpose.length<=2000,'样品来源记录无效');seen.set(v.id,v);
 }
 assert(s.selectedSampleId===null||(seen.has(s.selectedSampleId)&&seen.get(s.selectedSampleId).accepted),'选中样品身份缺失');
 const refIds=new Set();for(const r of s.references){blobRecord(r);assert(id(r.refId)&&!refIds.has(r.refId)&&['content','style'].includes(r.role)&&r.fileBytes<=4*1024*1024,'参考图身份或角色无效');refIds.add(r.refId);}
 const checkApproval=a=>{assert(a&&id(a.id)&&seen.has(a.sampleId)&&Number.isSafeInteger(a.revision)&&HASH(a.sha256)&&HASH(a.specHash)&&['user-explicit','synthetic/test-only'].includes(a.approvedBy)&&typeof a.testOnly==='boolean'&&['current','stale','untrusted'].includes(a.status),'批准身份无效');const sample=seen.get(a.sampleId);assert(sample.accepted&&sample.revision===a.revision&&sample.sha256===a.sha256&&sample.fileBytes===a.fileBytes&&sample.specHash===a.specHash,'批准对象与实际样品不一致');};
 if(s.approval)checkApproval(s.approval);for(const a of s.approvalHistory)checkApproval(a);
 const formHistory=s.formReviewHistory??[];assert(Array.isArray(formHistory)&&formHistory.length<=256,'形式检查历史数量超限');
 for(const review of [...formHistory,...(s.formReview?[s.formReview]:[])]){
  const sample=seen.get(review.sampleId);assert(sample?.accepted&&sample.revision===review.revision&&sample.sha256===review.sha256&&sample.specHash===review.specHash,'形式检查对象与精确样品版本不一致');
  assert(review.schemaVersion==='2dw-form-review/1'&&HASH(review.specHash)&&typeof review.viewContractId==='string'&&typeof review.stylePressureId==='string'&&['unchecked','conforms','rejected'].includes(review.status)&&typeof review.stale==='boolean','形式检查身份或状态无效');
  assert(review.reviewedBy===(sample.testOnly?'synthetic/test-only':'user-explicit')&&typeof review.notes==='string'&&review.notes.length<=2000&&review.checks&&Object.keys(review.checks).length===4&&FORM_CHECK_NAMES.every(k=>typeof review.checks[k]==='boolean'),'形式检查来源或四项清单无效');
  assert(review.reviewedAt===null||typeof review.reviewedAt==='string'&&review.reviewedAt.length<=80&&!Number.isNaN(Date.parse(review.reviewedAt)),'形式检查时间无效');
  if(review.status==='conforms')assert(review.reviewedAt&&FORM_CHECK_NAMES.every(k=>review.checks[k]),'形式检查合格需要全部四项明确确认');
  if(s.lockedSpec?.schemaVersion==='1.5.0'&&review.specHash===s.specHash)validateFormReview(formPayload(review),{sample,spec:s.lockedSpec,specHash:s.specHash});
 }
 for(const r of s.requests)assert(id(r.id)&&['sample-task','style-refine-task','formal-master-task'].includes(r.stage)&&HASH(r.specHash)&&typeof r.stale==='boolean'&&(r.sampleId===null||seen.has(r.sampleId)),'任务包阶段记录无效');
 const masterIds=new Set();for(const m of s.masters){assert(id(m.id)&&!masterIds.has(m.id)&&HASH(m.specHash)&&id(m.approvalId)&&typeof m.accepted==='boolean'&&typeof m.pending==='boolean'&&typeof m.stale==='boolean'&&m.files&&Object.keys(m.files).length>0&&Object.keys(m.files).every(role=>['master','materials','contour'].includes(role)),'母版版本无效');for(const f of Object.values(m.files))blobRecord(f);masterIds.add(m.id);}
 for(const o of s.outputs){
  assert(id(o.id)&&masterIds.has(o.masterId)&&HASH(o.specHash)&&typeof o.stale==='boolean'&&['pending','passed','failed'].includes(o.structureStatus)&&o.artAcceptance==='pending-human-review'&&o.unitySorting==='unverified','编译产出身份无效');
  if(o.delivery)assert(HASH(o.delivery.sha256)&&Number.isSafeInteger(o.delivery.fileBytes)&&o.delivery.fileBytes>0&&o.delivery.fileBytes<=64*1024*1024&&typeof o.delivery.exportedAt==='string','结果交付 SHA 或字节身份无效');
 }
 assert(s.currentMasterId===null||masterIds.has(s.currentMasterId),'当前母版缺失');assert(s.currentOutputId===null||s.outputs.some(o=>o.id===s.currentOutputId),'当前产出缺失');
 for(const record of allRecords(s))blobRecord(record);return s;
}
async function createWorkflowSession({store,buildLockedSpec,compileMaster,validateMasterLayer,validateCompilation,clock=()=>new Date().toISOString()}={}){
 assert(store&&typeof buildLockedSpec==='function'&&typeof compileMaster==='function','需要本机 store、规格生成器和编译器');
 let state=await store.loadSession(),compiledCache=null,busy=false;
 const now=()=>cleanText(clock(),80);
 function fresh(){return {schemaVersion:SCHEMA,taskId:identity('tile'),title:'联通素材试制',stage:'FORMAT_DRAFT',format:'draft',options:{},lockedSpec:null,specHash:null,versions:[],references:[],selectedSampleId:null,approval:null,approvalHistory:[],formReview:null,formReviewHistory:[],requests:[],masters:[],outputs:[],currentMasterId:null,currentOutputId:null,history:[],lastError:null};}
 if(state)validateState(state,buildLockedSpec);else state=fresh();
 function initFormHistory(){state.formReview??=null;state.formReviewHistory??=[];}
 function usesFormContract(){return state.options.protocolVersion===7&&state.lockedSpec?.schemaVersion==='1.5.0';}
 function sampleById(sampleId){const s=state.versions.find(v=>v.id===sampleId);assert(s,'样品版本缺失');return s;}
 function requireFormat(){assert(state.format==='locked'&&state.lockedSpec,'先锁定本任务格式');}
 function pendingForm(sample){return {schemaVersion:'2dw-form-review/1',sampleId:sample.id,revision:sample.revision,sha256:sample.sha256,specHash:state.specHash,viewContractId:state.lockedSpec.viewContract.id,stylePressureId:state.lockedSpec.stylePressure.id,status:'unchecked',reviewedBy:sample.testOnly?'synthetic/test-only':'user-explicit',reviewedAt:null,notes:'',checks:Object.fromEntries(FORM_CHECK_NAMES.map(k=>[k,false]))};}
 function currentFormReview(sampleId=state.selectedSampleId){
  if(!usesFormContract())return false;const r=state.formReview,s=state.versions.find(v=>v.id===sampleId);
  if(!r||r.stale||r.status!=='conforms'||!s?.accepted||state.selectedSampleId!==sampleId||s.specHash!==state.specHash||!store.verify(formPayload(r),r.seal))return false;
  try{validateFormReview(formPayload(r),{sample:s,spec:state.lockedSpec,specHash:state.specHash,requirePassed:true});return true;}catch{return false;}
 }
 function requireFormReview(sampleId=state.selectedSampleId){if(usesFormContract())assert(currentFormReview(sampleId),'形式 / 视角尚未逐项明确核对，或检查属于旧版本、旧规格或异机未信任；请重新检查当前样品');}
 function archiveFormReview(){initFormHistory();if(state.formReview){state.formReview.stale=true;if(!state.formReviewHistory.some(r=>canonical(r.seal)===canonical(state.formReview.seal)))state.formReviewHistory.push(clone(state.formReview));}}
 async function getFormReview(){requireFormat();if(!usesFormContract())return null;const sample=state.versions.find(v=>v.id===state.selectedSampleId);if(!sample?.accepted||sample.specHash!==state.specHash)return null;return state.formReview?.sampleId===sample.id&&state.formReview.specHash===state.specHash?clone(formPayload(state.formReview)):pendingForm(sample);}
 function currentApproval(){
  if(!state.approval)return false;const a=state.approval,s=state.versions.find(v=>v.id===a.sampleId);
  return state.format==='locked'&&a.status==='current'&&state.selectedSampleId===a.sampleId&&a.specHash===state.specHash&&s?.accepted&&s.specHash===state.specHash&&s.sha256===a.sha256&&s.revision===a.revision&&s.fileBytes===a.fileBytes&&s.testOnly===a.testOnly&&store.verify(approvalPayload(a),a.seal)&&(!usesFormContract()||currentFormReview(a.sampleId)&&a.formReviewSha256===sha(Buffer.from(canonical(formPayload(state.formReview)))));
 }
 function invalidate(reason,approval=true){
  if(approval&&state.approval){if(state.approval.status==='current')state.approval.status='stale';if(!state.approvalHistory.some(a=>a.id===state.approval.id))state.approvalHistory.push(clone(state.approval));}
  if(['format-change','new-sample-revision','form-rejected'].includes(reason))archiveFormReview();
  for(const r of state.requests)if(reason==='format-change'||r.stage==='formal-master-task')r.stale=true;
  for(const m of state.masters)m.stale=true;for(const o of state.outputs)o.stale=true;compiledCache=null;
  state.history.push({event:'invalidate',reason,at:now()});
 }
 function event(eventName,details={}){state.history.push({event:eventName,at:now(),...details});assert(state.history.length<=2048,'本任务历史超过2048条，请保存并另建任务');}
 async function persist(){validateState(state,buildLockedSpec);await store.saveSession(state);}
 async function mutation(work){assert(!busy,'操作正在进行，请等待');busy=true;const before=clone(state),cacheBefore=compiledCache;try{const value=await work();await persist();return value??await getState();}catch(e){state=before;compiledCache=cacheBefore;throw e;}finally{busy=false;}}
 async function getSample(sampleId=state.selectedSampleId){const record=sampleById(sampleId);return {...clone(record),bytes:await store.readBlob(record)};}
 async function productionGuard(){
  requireFormat();requireFormReview();assert(state.approval,'请先明确批准一个本任务样品');assert(currentApproval(),'样品批准已陈旧、规格改变或本机签名未信任，请重新明确批准');
  const sample=await getSample(state.approval.sampleId);assert(sample.sha256===state.approval.sha256,'批准样品 SHA 已改变');return {spec:clone(state.lockedSpec),specHash:state.specHash,approval:{...clone(state.approval),trustedCurrent:true,stale:false},sample,...(usesFormContract()?{formReview:clone(formPayload(state.formReview))}:{})};
 }
 async function getMaster(masterId=state.currentMasterId){const record=state.masters.find(m=>m.id===masterId);assert(record,'母版版本缺失');const files={};for(const [role,meta] of Object.entries(record.files))files[role]=await store.readBlob(meta);return {...clone(record),files};}
 async function getMasterInputs(){if(!state.currentMasterId)return {};return (await getMaster()).files;}
 async function encodeArtifacts(value){
  if(Buffer.isBuffer(value))return {$blob:await store.putBlob(value,value.subarray(0,8).toString('hex')==='89504e470d0a1a0a'?'png':'bin')};
  if(Array.isArray(value))return Promise.all(value.map(encodeArtifacts));
  if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k]=await encodeArtifacts(v);return out;}return value;
 }
 async function decodeArtifacts(value){if(value?.$blob)return store.readBlob(value.$blob);if(Array.isArray(value))return Promise.all(value.map(decodeArtifacts));if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k]=await decodeArtifacts(v);return out;}return value;}
 async function getCompiled(){const out=state.outputs.find(o=>o.id===state.currentOutputId);assert(out&&!out.stale&&currentApproval(),'编译产出缺失或已陈旧；请重新批准并编译');if(!compiledCache)compiledCache=await decodeArtifacts(out.artifacts);return compiledCache;}
 async function getState(){
  const visible=clone(state);for(const version of visible.versions){const bytes=await store.readBlob(version);version.image=version.accepted?'data:image/png;base64,'+bytes.toString('base64'):null;}
  for(const m of visible.masters)for(const f of Object.values(m.files)){const bytes=await store.readBlob(f);f.image=bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'?'data:image/png;base64,'+bytes.toString('base64'):null;}
  for(const r of visible.references){const bytes=await store.readBlob(r);r.image='data:image/png;base64,'+bytes.toString('base64');}
  const trustedCurrent=currentApproval();if(visible.approval){visible.approval.trustedCurrent=trustedCurrent;visible.approval.stale=!trustedCurrent;}
  const output=visible.outputs.find(o=>o.id===visible.currentOutputId);visible.compiled=output?(({artifacts,...summary})=>summary)(output):null;delete visible.outputs;
  const selected=visible.versions.find(v=>v.id===visible.selectedSampleId),master=visible.masters.find(m=>m.id===visible.currentMasterId);
  const selectedCurrent=state.format==='locked'&&!!selected?.accepted&&selected.specHash===state.specHash,formTrusted=currentFormReview(),formRequired=usesFormContract();
  visible.legacyContract=state.options.protocolVersion!==7;visible.formReviewHistory??=[];
  visible.formReview=formRequired&&selectedCurrent?(visible.formReview?.sampleId===selected.id&&visible.formReview.specHash===state.specHash?visible.formReview:pendingForm(selected)):null;
  if(visible.formReview){visible.formReview.trustedCurrent=formTrusted;visible.formReview.stale=!formTrusted;}
  visible.gates={sampleReady:state.format==='locked',formReady:formRequired&&selectedCurrent,canAdopt:state.format==='locked'&&!!selected?.accepted&&selected.specHash!==state.specHash,styleReady:selectedCurrent&&(!formRequired||formTrusted),approveReady:selectedCurrent&&(!formRequired||formTrusted),formalReady:trustedCurrent,compileReady:trustedCurrent&&!!master?.accepted&&!master.stale,reason:formRequired&&!formTrusted?'当前样品形式 / 视角尚未人工逐项确认，或旧检查已陈旧':trustedCurrent?'':!state.approval?'请先明确批准本任务样品':'旧批准已陈旧或本机签名未信任，请重新明确批准'};
  return visible;
 }
 async function configure(options){return mutation(async()=>{assert(options&&typeof options==='object'&&!Array.isArray(options),'格式选项无效');const checked=buildLockedSpec(options);assert(checked&&typeof checked==='object','规格生成失败');invalidate('format-change');state.options=clone(options);state.lockedSpec=null;state.specHash=null;state.format='draft';state.stage='FORMAT_DRAFT';state.title=options.description?.trim()?Array.from(cleanText(options.description,16384).trim()).slice(0,120).join(''):checked.grammar?.template?.kind==='stone'?'石质边界样品生产':'草地样品生产';state.lastError=null;event('configure');});}
 async function lockFormat(){return mutation(async()=>{assert(Object.keys(state.options).length,'请先选择模板和格式');const spec=buildLockedSpec(state.options);state.lockedSpec=clone(spec);state.specHash=sha(Buffer.from(canonical(spec)));state.format='locked';state.stage='FORMAT_LOCKED';state.lastError=null;event('format-locked',{specHash:state.specHash});});}
 async function importSample(bytes,meta={}){
  let failure;const result=await mutation(async()=>{
   requireFormat();assert(['sample','style','manual'].includes(meta.kind??'sample'),'样品工序无效');const kind=meta.kind??'sample',parentId=meta.parentId??(kind==='sample'?null:state.selectedSampleId);assert(!parentId||state.versions.some(v=>v.id===parentId),'样品父版本缺失');const parent=parentId?sampleById(parentId):null;
   assert(kind==='sample'||parent?.accepted,'修订结果需要有效父版本');assert(!parent||parent.specHash===state.specHash,'父版本规格已改变，请作为当前格式的新样品导入');
   if(kind==='style')requireFormReview(parentId);
   assert(Buffer.isBuffer(bytes)&&bytes.length<=32*1024*1024,'PNG 原件超过32MB');assert(state.versions.length<128,'本任务已有128版本，请保存后另建任务');
   const hash=sha(bytes);assert(!state.versions.some(v=>v.sha256===hash&&v.specHash===state.specHash),'重复 PNG 已在当前规格的版本历史中；请选择已有版本');
   let info={width:0,height:0,alphaClass:null};try{info=decodeSample(bytes);if(parent&&kind!=='sample'){assert(info.width===parent.width&&info.height===parent.height,'修订 PNG 尺寸与父版本不一致，未进行缩放');assert(info.alphaClass===parent.alphaClass,'修订 PNG 的透明 Alpha 类别与父版本不一致');}}catch(e){failure=e;}
   const record={id:identity('sample'),revision:state.versions.length+1,kind,parentId,source:cleanText(meta.source??'external',128),purpose:cleanText(meta.purpose),label:cleanText(meta.label,200),createdAt:now(),specHash:state.specHash,testOnly:meta.testOnly===true||parent?.testOnly===true,styleStep:kind==='style'||parent?.styleStep==='ai-refined'?'ai-refined':kind==='manual'?'manual-only':'not-run',accepted:!failure,error:failure?.message??null,...info,...await store.putBlob(bytes,failure?'bin':'png')};
   state.versions.push(record);state.lastError=failure?.message??null;if(failure){state.stage='SAMPLE_REJECTED';event('sample-rejected',{sampleId:record.id,error:failure.message});}
   else {invalidate('new-sample-revision');state.selectedSampleId=record.id;state.stage=kind==='sample'?'SAMPLE_RECEIVED':'STYLE_RECEIVED';event('sample-imported',{sampleId:record.id,parentId,kind,testOnly:record.testOnly});}
  });if(failure)throw failure;return result;
 }
 async function adoptSampleForCurrentSpec(input={}){return mutation(async()=>{
  requireFormat();assert(input.explicit===true,'旧样品重新检查必须由用户明确操作触发');assert(usesFormContract(),'重新检查采用仅用于已锁定的新形式契约');
  const parent=sampleById(state.selectedSampleId);assert(parent.accepted&&parent.specHash!==state.specHash,'请选择属于旧规格的有效样品；当前规格样品可直接重新检查');assert(state.versions.length<128,'本任务已有128版本，请保存后另建任务');
  await store.readBlob(parent);const record={...clone(parent),id:identity('sample'),revision:state.versions.length+1,parentId:parent.id,createdAt:now(),specHash:state.specHash,adoptedFromSpecHash:parent.specHash,source:'existing-version',purpose:'用户明确采用原PNG在当前形式契约下重新检查'};
  invalidate('new-sample-revision');state.versions.push(record);state.selectedSampleId=record.id;state.stage=record.kind==='sample'?'SAMPLE_RECEIVED':'STYLE_RECEIVED';state.lastError=null;event('sample-adopted-for-form-review',{sampleId:record.id,parentId:parent.id,fromSpecHash:parent.specHash,specHash:state.specHash});
 });}
 async function reviewForm(input={}){return mutation(async()=>{
  requireFormat();assert(usesFormContract(),'历史规格没有新形式认证；请先明确升级并锁定格式');assert(input.explicit===true,'形式核对必须由用户明确操作触发');
  const sample=sampleById(state.selectedSampleId);assert(sample.accepted&&sample.specHash===state.specHash,'先采用旧样品为当前规格的新版本，或导入当前规格样品');await store.readBlob(sample);
  assert(input.checks&&Object.keys(input.checks).length===4&&FORM_CHECK_NAMES.every(k=>input.checks[k]===true),'形式核对合格需要全部四项明确确认');
  archiveFormReview();invalidate('form-review-replaced');const review={...pendingForm(sample),status:'conforms',reviewedAt:now(),notes:cleanText(input.notes),checks:clone(input.checks)};
  validateFormReview(review,{sample,spec:state.lockedSpec,specHash:state.specHash,requirePassed:true});state.formReview={...review,seal:store.sign(review),stale:false};state.stage=sample.kind==='sample'?'SAMPLE_RECEIVED':'STYLE_RECEIVED';state.lastError=null;event('form-reviewed',{sampleId:sample.id,revision:sample.revision,sha256:sample.sha256,specHash:state.specHash,reviewedBy:review.reviewedBy});
 });}
 async function rejectForm(input={}){return mutation(async()=>{
  requireFormat();assert(usesFormContract(),'历史规格没有新形式认证；请先明确升级并锁定格式');assert(input.explicit===true,'形式退回必须由用户明确操作触发');
  const sample=sampleById(state.selectedSampleId);assert(sample.accepted&&sample.specHash===state.specHash,'请先选中当前规格的有效样品');await store.readBlob(sample);const notes=cleanText(input.notes);assert(notes.trim(),'请说明形式不合格的原因');
  invalidate('form-rejected');const review={...pendingForm(sample),status:'rejected',reviewedAt:now(),notes};validateFormReview(review,{sample,spec:state.lockedSpec,specHash:state.specHash});state.formReview={...review,seal:store.sign(review),stale:false};state.stage='SAMPLE_REJECTED';state.lastError=notes;event('form-rejected',{sampleId:sample.id,notes});
 });}
 async function selectSample(sampleId){return mutation(async()=>{const sample=sampleById(sampleId);assert(sample.accepted,'请选择有效样品版本');await store.readBlob(sample);state.selectedSampleId=sampleId;state.stage=currentApproval()?'SAMPLE_APPROVED':sample.kind==='sample'?'SAMPLE_RECEIVED':'STYLE_RECEIVED';event('sample-selected',{sampleId});});}
 async function approveSample(input={}){return mutation(async()=>{
  requireFormat();assert(input.explicit===true,'批准必须由用户明确操作触发');assert(input.sampleId??state.selectedSampleId,'需要先导入并选择有效 PNG 样品');const sample=sampleById(input.sampleId??state.selectedSampleId);assert(sample.accepted,'需要有效 PNG 样品');assert(sample.specHash===state.specHash,'样品属于旧规格，请在当前规格下重新导入');await store.readBlob(sample);
  requireFormReview(sample.id);
  invalidate('approval-replaced');const g=state.lockedSpec.grammar,approval={id:identity('approval'),sampleId:sample.id,revision:sample.revision,sha256:sample.sha256,fileBytes:sample.fileBytes,approvedAt:now(),approvedBy:sample.testOnly?'synthetic/test-only':'user-explicit',notes:cleanText(input.notes),templateId:g?.template?.id??state.options.templateId,templateVersion:g?.template?.version??'unknown',profileVersion:state.lockedSpec.profileVersion??state.lockedSpec.projectStyleContract?.version??'1.4.0',specHash:state.specHash,testOnly:sample.testOnly};
  if(usesFormContract())approval.formReviewSha256=sha(Buffer.from(canonical(formPayload(state.formReview))));
  approval.seal=store.sign(approval);approval.status='current';state.approval=approval;state.selectedSampleId=sample.id;state.stage='SAMPLE_APPROVED';state.lastError=null;event('sample-approved',{approvalId:approval.id,sampleId:sample.id,testOnly:sample.testOnly});
 });}
 async function revokeApproval(notes=''){return mutation(async()=>{assert(state.approval,'没有可撤销的样品批准');invalidate('approval-revoked');state.stage='APPROVAL_REVOKED';event('approval-revoked',{approvalId:state.approval.id,notes:cleanText(notes)});});}
 async function recordRequest(stage){return mutation(async()=>{
  requireFormat();assert(['sample-task','style-refine-task','formal-master-task'].includes(stage),'任务阶段无效');let sampleId=null,approvalId=null;
  if(stage==='style-refine-task'){const sample=sampleById(state.selectedSampleId);assert(sample.accepted&&sample.specHash===state.specHash,'先选择当前规格的有效样品');requireFormReview(sample.id);await store.readBlob(sample);sampleId=sample.id;}
  if(stage==='formal-master-task'){const guard=await productionGuard();sampleId=guard.sample.id;approvalId=guard.approval.id;}
  const request={id:identity('request'),stage,createdAt:now(),specHash:state.specHash,sampleId,approvalId,stale:false};state.requests.push(request);state.stage=stage==='sample-task'?'SAMPLE_REQUEST_READY':stage==='style-refine-task'?'STYLE_REQUEST_READY':'PRODUCTION_REQUEST_READY';event('request-exported',{requestId:request.id,stage});return {...clone(request),snapshot:{taskId:state.taskId,specHash:state.specHash,sampleId,approvalId,...(usesFormContract()?{formReview:await getFormReview()}:{})}};
 });}
 function requiredRoles(){return state.options.strategy==='art-directed'||state.lockedSpec.grammar?.strategy==='art-directed'?['materials','contour']:['master'];}
 async function checkLayer(role,bytes){
  const info=decodeSample(bytes,{sampleStage:false});if(validateMasterLayer)return {...info,...await validateMasterLayer(state.lockedSpec,role,bytes)};
  const g=state.lockedSpec.grammar,layout=role==='contour'?g.control:g.master;assert(layout&&info.width===layout.width&&info.height===layout.height,`正式 ${role} 尺寸不符：需要 ${layout?.width}×${layout?.height}，实际 ${info.width}×${info.height}；未进行缩放`);assert(info.alphaClass==='opaque','正式母版输入需完全不透明 Alpha');return info;
 }
 async function importMaster(files,meta={}){
  let failure;const result=await mutation(async()=>{
   const guard=await productionGuard();assert(files&&typeof files==='object'&&!Array.isArray(files)&&Object.keys(files).length>0&&Object.keys(files).every(k=>['master','materials','contour'].includes(k)),'母版输入角色无效');assert(state.masters.length<128,'本任务母版版本已满，请保存后另建任务');
   const roles=requiredRoles(),previous=state.masters.find(m=>m.id===state.currentMasterId),carry=previous?.pending&&!previous.stale&&previous.specHash===state.specHash&&previous.approvalId===guard.approval.id?clone(previous.files):{};
   const record={id:identity('master'),createdAt:now(),source:cleanText(meta.source??'external',128),specHash:state.specHash,approvalId:guard.approval.id,files:carry,accepted:false,pending:false,error:null,stale:false};
   for(const [role,bytes] of Object.entries(files)){assert(Buffer.isBuffer(bytes)&&bytes.length<=32*1024*1024,'母版原件超过32MB');let info={width:0,height:0},layerError=null;try{assert(roles.includes(role),'正式输入角色与锁定模板不符');info=await checkLayer(role,bytes);}catch(e){layerError=e;failure??=e;}record.files[role]={role,source:record.source,createdAt:now(),accepted:!layerError,error:layerError?.message??null,...info,...await store.putBlob(bytes,layerError?'bin':'png')};}
   for(const r of state.requests)if(r.stage==='formal-master-task')r.stale=r.specHash!==state.specHash||r.approvalId!==guard.approval.id;
   for(const m of state.masters)m.stale=true;for(const o of state.outputs)o.stale=true;compiledCache=null;
   record.pending=roles.some(role=>!record.files[role]||record.files[role].accepted===false);
   if(!failure&&!record.pending){try{const bytes={};for(const [role,f] of Object.entries(record.files))bytes[role]=await store.readBlob(f);await compileMaster(state.lockedSpec,bytes);record.accepted=true;}catch(e){failure=e;}}
   record.error=failure?.message??null;state.masters.push(record);state.lastError=record.error;state.currentMasterId=record.id;state.stage=failure?'MASTER_REJECTED':'MASTER_RECEIVED';event(failure?'master-rejected':record.pending?'master-layer-received':'master-received',{masterId:record.id,error:record.error});
  });if(failure)throw failure;return result;
 }
 async function compile(){return mutation(async()=>{
  await productionGuard();const master=await getMaster();assert(master.accepted&&!master.pending&&!master.stale,'正式母版缺层、被拒绝或已陈旧；请先导入完整正确母版');const compiled=await compileMaster(state.lockedSpec,master.files);
  assert(Array.isArray(compiled.tiles)&&compiled.tiles.length===47,'编译器没有返回47种合法状态');const output={id:identity('output'),masterId:master.id,approvalId:master.approvalId,specHash:state.specHash,createdAt:now(),tiles:compiled.tiles.length,stale:false,structureStatus:'pending',artAcceptance:'pending-human-review',unitySorting:'unverified',artifacts:await encodeArtifacts(compiled),validation:null};
  for(const o of state.outputs)o.stale=true;state.outputs.push(output);state.currentOutputId=output.id;compiledCache=compiled;state.stage='COMPILED';state.lastError=null;event('compiled',{outputId:output.id,masterId:master.id,tiles:compiled.tiles.length});
 });}
 async function recordValidation(report){return mutation(async()=>{
  await productionGuard();const o=state.outputs.find(o=>o.id===state.currentOutputId);assert(o&&!o.stale,'请先重新编译当前母版');assert(report&&typeof report.passed==='boolean','结构验证结果无效');const {preview,...withoutPreview}=report;o.validation=clone(withoutPreview);o.structureStatus=report.passed?'passed':'failed';state.stage=report.passed?'STRUCTURE_CHECKED':'STRUCTURE_FAILED';event('structure-checked',{outputId:o.id,passed:report.passed});
 });}
 async function recordExport(delivery){return mutation(async()=>{
  const guard=await productionGuard(),o=state.outputs.find(result=>result.id===state.currentOutputId);
  assert(o&&!o.stale&&o.specHash===state.specHash&&o.approvalId===guard.approval.id&&o.structureStatus==='passed','当前正式产出尚未通过结构验证或已陈旧');
  assert(delivery&&HASH(delivery.sha256)&&Number.isSafeInteger(delivery.fileBytes)&&delivery.fileBytes>0&&delivery.fileBytes<=64*1024*1024,'结果交付 SHA 或字节身份无效');
  o.delivery={sha256:delivery.sha256,fileBytes:delivery.fileBytes,exportedAt:now()};state.stage='EXPORTED';state.lastError=null;
  event('output-exported',{outputId:o.id,...o.delivery});
 });}
 async function setReferences(refs){return mutation(async()=>{
  assert(Array.isArray(refs)&&refs.length<=8,'最多选择8张参考图');const seen=new Set(),records=[];
  for(const r of refs){assert(id(r.refId)&&!seen.has(r.refId),'参考图唯一身份无效');seen.add(r.refId);assert(['content','style'].includes(r.role),'参考图角色仅支持 content/style');assert(Buffer.isBuffer(r.bytes)&&r.bytes.length<=4*1024*1024,'参考图单张不得超过4MB');const info=decodeSample(r.bytes,{sampleStage:false});records.push({refId:r.refId,role:r.role,sourceName:cleanText(r.sourceName,256),note:cleanText(r.note),...info,...await store.putBlob(r.bytes)});}
  state.references=records;event('references-selected',{count:records.length});
 });}
 async function getReferences(){return Promise.all(state.references.map(async r=>({...clone(r),bytes:await store.readBlob(r)})));}
 async function exportProject(){assert(!busy,'操作正在进行，请等待');return store.exportProject(state,allRecords(state));}
 async function importProject(bytes){return mutation(async()=>{
  const decoded=store.decodeProject(bytes),imported=clone(decoded.session);validateState(imported,buildLockedSpec);
  const index=new Map(Object.entries(decoded.files));for(const record of allRecords(imported)){const b=index.get(record.relativePath);assert(b,'工程原件缺失');assert(b.length===record.fileBytes&&sha(b)===record.sha256,'工程原件 SHA 与版本不一致');if(record.accepted&&record.kind){const info=decodeSample(b);assert(info.width===record.width&&info.height===record.height&&info.alphaClass===record.alphaClass,'样品元数据尺寸或 Alpha 与真实 PNG 不一致');}}
  await store.importBlobs(decoded.files);state=imported;compiledCache=null;
  if(!decoded.trusted){if(state.approval)state.approval.status='untrusted';if(state.formReview)archiveFormReview();for(const r of state.requests)if(r.stage==='formal-master-task'||usesFormContract()&&r.stage==='style-refine-task')r.stale=true;for(const m of state.masters)m.stale=true;for(const o of state.outputs)o.stale=true;state.stage=state.approval?'APPROVAL_REVOKED':state.stage;event('foreign-project-imported',{approvalRequiresExplicitReapproval:true,formRequiresExplicitRecheck:usesFormContract()});}
  else event('same-machine-project-imported');
 });}
 async function reset(options){return mutation(async()=>{state=fresh();compiledCache=null;if(options){buildLockedSpec(options);state.options=clone(options);}event('new-task');});}
 return {getState,configure,lockFormat,importSample,adoptSampleForCurrentSpec,reviewForm,rejectForm,getFormReview,selectSample,approveSample,revokeApproval,productionGuard,recordRequest,importMaster,compile,recordValidation,recordExport,getSample,getMaster,getMasterInputs,getCompiled,setReferences,getReferences,exportProject,importProject,reset,validateCompilation};
}
module.exports={createWorkflowSession,decodeSample,validateState};
