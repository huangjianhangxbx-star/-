'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {zipSync}=require('fflate');
const {createProjectStore}=require('../workflow/store.cjs');
const legacyPackage=require('../workflow/package.cjs'),formPackage=require('../workflow/package-v7.cjs'),singlePackage=require('../workflow/package-v8.cjs');
// An absent protocol marker is historical v6; only an explicit choice enables v7.
const buildLockedSpec=options=>options?.protocolVersion===8?singlePackage.buildLockedSpec(options):options?.protocolVersion===7?formPackage.buildLockedSpec(options):legacyPackage.buildLockedSpec(options);
const packageFor=spec=>spec.schemaVersion==='1.6.0'?singlePackage:spec.schemaVersion==='1.5.0'?formPackage:legacyPackage;
const {sha,compileMaster,templateImages}=require('../grammar/compile.cjs');
const {compileArtDirected,artTemplateImages}=require('../grammar/art-directed.cjs');
const {validateArtCompilation}=require('../grammar/art-directed-validate.cjs');
const {validateCompilation}=require('../grammar/validate.cjs');
const {testScenes}=require('../grammar/catalog.cjs');
const data=bytes=>'data:image/png;base64,'+Buffer.from(bytes).toString('base64');
async function readPng(file){if(typeof file!=='string'||!path.isAbsolute(file)||path.extname(file).toLowerCase()!=='.png')throw Error('请选择单张本地 PNG');const s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.size>32*1024*1024)throw Error('PNG 文件无效或超过32MB');const b=await fs.readFile(file);if(b.length>32*1024*1024)throw Error('PNG 字节预算超限');return b;}
async function writeNew(file,bytes){if(typeof file!=='string'||!path.isAbsolute(file)||path.extname(file).toLowerCase()!=='.zip')throw Error('请选择本地 ZIP');const p=await fs.lstat(path.dirname(file));if(!p.isDirectory()||p.isSymbolicLink())throw Error('输出目录不支持链接');const h=await fs.open(file,'wx');try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}if(sha(await fs.readFile(file))!==sha(bytes))throw Error('保存后 SHA 校验失败');return {path:file,sha256:sha(bytes)};}
async function signingKey(directory){const target=path.join(directory,'issuer-private.pem');try{const s=await fs.lstat(target);if(!s.isFile()||s.isSymbolicLink()||s.size>8192)throw Error('发行密钥无效');return crypto.createPrivateKey(await fs.readFile(target));}catch(e){if(e.code!=='ENOENT')throw e;const k=crypto.generateKeyPairSync('ed25519').privateKey;await fs.writeFile(target,k.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});return k;}}
async function createTilePipeline({directory,pickPng=async()=>null,pickZip=async()=>null,pickSave=async()=>null,readClipboard=async()=>({kind:'empty'}),referenceSnapshot=async()=>[],clearReferenceSelection=async()=>{},projectStyle=()=>undefined}={}){
 const store=await createProjectStore(directory),key=await signingKey(directory);
 const compiler=(spec,files)=>spec.strategy==='art-directed'?compileArtDirected(spec.grammar,files):compileMaster(spec.grammar,files.master);
 const validator=(spec,compiled,board,options={})=>spec.strategy==='art-directed'?validateArtCompilation(spec.grammar,compiled,board,options):validateCompilation(spec.grammar,compiled,board,options);
 const validateMasterLayer=(spec,role,bytes)=>{const g=spec.grammar;if(spec.strategy==='art-directed')return require('../grammar/art-directed.cjs').validateArtLayer(g,role,bytes);const p=require('../grammar/compile.cjs').decode(bytes,g.master.width,g.master.height);if(p.data.some((v,i)=>i%4===3&&v!==255))throw Error('正式图层必须完全不透明');};
 const workflow=await require('../workflow/session.cjs').createWorkflowSession({store,buildLockedSpec,compileMaster:compiler,validateCompilation:validator,validateMasterLayer});let busy=false;
 async function state(){const s=await workflow.getState();if(s.lockedSpec){const images=s.lockedSpec.strategy==='art-directed'?artTemplateImages(s.lockedSpec.grammar):templateImages(s.lockedSpec.grammar);s.board=Object.fromEntries(Object.entries(images).map(([k,b])=>[k,data(b)]));s.board.sampleGuide=data(packageFor(s.lockedSpec).sampleGuide(s.lockedSpec.grammar));if(['1.5.0','1.6.0'].includes(s.lockedSpec.schemaVersion))s.board.viewGuide=data(packageFor(s.lockedSpec).viewGuide(s.lockedSpec));if(s.compiled&&!s.compiled.stale&&s.approval?.trustedCurrent){const compiled=await workflow.getCompiled(),{preview,...report}=validator(s.lockedSpec,compiled,testScenes().hole,{approvedSample:s.approval});s.compiledPreview={preview:data(preview),atlas:data(compiled.atlas),report,...report};}}return s;}
 async function png(method){if(!['file','clipboard'].includes(method))throw Error('未知 PNG 导入方式');if(method==='file'){const chosen=await pickPng();if(!chosen)return null;return readPng(chosen);}const clip=await readClipboard();if(clip.kind==='image')return Buffer.from(clip.bytes);if(clip.kind==='files'&&clip.filePaths.length===1)return readPng(clip.filePaths[0]);throw Error('剪贴板需为一张本地 PNG 文件或图片');}
 async function scene(input={}){
  const allowed=['scene','mask','underlay','grid','pivot','alpha','overhang','sort'];if(!input||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('未知预览字段');for(const k of ['underlay','grid','pivot','alpha','overhang'])if(input[k]!==undefined&&typeof input[k]!=='boolean')throw Error('非法预览开关');if(input.sort!==undefined&&!['back-to-front','front-to-back'].includes(input.sort))throw Error('非法排序');
  const s=await workflow.getState(),compiled=await workflow.getCompiled();if(!compiled||!s.lockedSpec)throw Error('请先编译当前母版');let board=testScenes()[input.scene??'hole'];
  if(['full8','full16'].includes(input.scene)){const n=input.scene==='full8'?8:16;board=Array.from({length:n},()=>Array(n).fill(1));}if(input.scene==='neighbor'){const mask=input.mask??255;if(!s.lockedSpec.grammar.tiles.some(t=>t.mask===mask))throw Error('非法邻居组合');board=[[1,2,4],[8,0,16],[32,64,128]].map(row=>row.map(bit=>bit?Number(!!(mask&bit)):1));}if(!board)throw Error('未知地图');
  const r=validator(s.lockedSpec,compiled,board,{...input,approvedSample:s.approval}),{preview,...report}=r;return {state:await state(),preview:data(preview),atlas:data(compiled.atlas),report,...report};
 }
 async function exportCompiled(){const s=await workflow.getState();await workflow.productionGuard();const compiled=await workflow.getCompiled();if(!compiled||s.compiled?.structureStatus!=='passed')throw Error('请先编译并通过当前正式母版的结构验证');const files={};
  for(const t of compiled.tiles)files[`tiles/${t.id}.png`]=t.png;for(const t of compiled.tileVariants??[])files[t.outputPath??`variants/${t.id}-v${t.variant}.png`]=t.png;
  files['atlas.png']=compiled.atlas;files['underlay.png']=compiled.underlay;const guard=await workflow.productionGuard();files['source/approved-sample.png']=guard.sample.bytes;
  const inputs=await workflow.getMasterInputs();for(const[k,b]of Object.entries(inputs))files[`source/${k}.png`]=b;const sourceMaster=await workflow.getMaster();if(sourceMaster.artSourceBytes){files['source/art-source.png']=sourceMaster.artSourceBytes;files['source/conversion.json']=Buffer.from(JSON.stringify(sourceMaster.conversion,null,2));}
  const scenes={};for(const[name,board]of Object.entries(testScenes())){const{preview,...r}=validator(s.lockedSpec,compiled,board,{approvedSample:guard.approval});files[`scenes/${name}.png`]=preview;scenes[name]=r;}
  files['map.json']=Buffer.from(JSON.stringify({schemaVersion:'2dw-tile-output/2',lockedSpec:s.lockedSpec,approval:guard.approval,...(guard.formReview?{formReview:guard.formReview}:{}),...(sourceMaster.conversion?{conversion:sourceMaster.conversion}:{}),specHash:s.specHash,tiles:compiled.tiles.map(({png,...t})=>({...t,path:`tiles/${t.id}.png`,sha256:sha(png)})),variants:(compiled.tileVariants??[]).map(({png,...t})=>({...t,path:t.outputPath??`variants/${t.id}-v${t.variant}.png`,sha256:sha(png)})),patchSources:compiled.patchSources,inputHashes:compiled.inputHashes,artAcceptance:'pending-human-review',unitySorting:'unverified'},null,2));
  files['validation.json']=Buffer.from(JSON.stringify({scenes,testOnly:!!guard.approval.testOnly,artAcceptance:'pending-human-review'},null,2));files['manifest.json']=Buffer.from(JSON.stringify({schemaVersion:'2dw-tile-output/2',entries:Object.entries(files).map(([path,b])=>({path,sha256:sha(b),byteLength:b.length}))},null,2));
  const bytes=Buffer.from(zipSync(files));require('../workflow/output.cjs').validateOutputZip(bytes);
  const target=await pickSave(`${s.taskId}-compiled.zip`);if(!target)return{cancelled:true,state:await state()};const out=await writeNew(target,bytes);require('../workflow/output.cjs').validateOutputZip(await fs.readFile(target));await workflow.recordExport({sha256:out.sha256,fileBytes:bytes.length});return{...out,state:await state(),tiles:47,variants:compiled.tileVariants?.length??0};
 }
 async function action(name,payload={}){if(busy)throw Error('操作正在进行，请等待');busy=true;try{
  switch(name){
   case 'single-start':{
    const before=await workflow.getState();let bytes;
    if(payload.method==='reference'){const snapshot=await referenceSnapshot(),refs=Array.isArray(snapshot)?snapshot:snapshot.references,content=refs?.filter(r=>r.role==='content')??[],ref=payload.refId?content.find(r=>r.refId===payload.refId):content.length===1?content[0]:null;if(!ref||!Buffer.isBuffer(ref.bytes))throw Error('需选择唯一内容参考；多张参考不按显示名称猜图，可改用选择单张PNG');bytes=Buffer.from(ref.bytes);}else bytes=await png(payload.method??'file');
    if(!bytes)return{cancelled:true,state:await state()};require('../workflow/session.cjs').decodeSample(bytes);
    if(before.versions.length){if(payload.confirmNew!==true)throw Error('已有工程需明确确认另建单图任务，取消保留原工程');const archive=await workflow.exportProject(),backupDir=path.join(directory,'previous-projects');await fs.mkdir(backupDir,{recursive:true});await fs.writeFile(path.join(backupDir,`${before.taskId}-${crypto.randomUUID()}.zip`),archive,{flag:'wx'});}
    const options={templateId:'XH-STONE-FLOOR-8COND-01',cellPixels:128,ppu:100,stylePressure:'standard',...payload.options,protocolVersion:8,strategy:'art-directed',projectStyleContract:projectStyle()};
    buildLockedSpec(options);await workflow.reset();await workflow.configure(options);await workflow.lockFormat();await workflow.importSample(bytes,{kind:'single',testOnly:payload.testOnly===true,source:payload.method==='reference'?'existing-content-reference':payload.method??'file',purpose:'用户提供单张定稿候选；不证明全部联通形态'});break;
   }
   case 'adapt-source':{
    if(payload.explicit!==true)throw Error('请明确确认绘画取样/公共框与程序数值控制政策');const s=await workflow.getState();await workflow.productionGuard();if(s.options.protocolVersion!==8)throw Error('绘画技术转换仅用于单图v8；经典与四形态流程保留');const b=await png(payload.method??'file');if(!b)return{cancelled:true,state:await state()};
    const adapter=require('../grammar/single-adapter.cjs');let converted;
    try{const info=require('../workflow/session.cjs').decodeSample(b,{sampleStage:false});if(!payload.parameters&&(info.width!==s.lockedSpec.grammar.master.width||info.height!==s.lockedSpec.grammar.master.height))throw Error(`绘画原稿尺寸${info.width}×${info.height}与默认八窗口排布${s.lockedSpec.grammar.master.width}×${s.lockedSpec.grammar.master.height}不同；请让Agent提供准确取样窗口，不自动拉伸或猜测`);converted=adapter.adaptArtSource(s.lockedSpec,b,payload.parameters??adapter.defaultParameters(s.lockedSpec));}catch(e){await workflow.importMaster({},{artSource:b,error:e.message,source:'rejected-art-source'});throw e;}
    await workflow.importMaster({materials:converted.materials,contour:converted.contour},{artSource:b,conversion:converted.report,source:'explicit-single-art-adapter/1'});break;
   }
   case 'configure':await workflow.configure({...payload,projectStyleContract:projectStyle()});break;
   case 'quad-start':{const old=await workflow.getState();if(old.versions.length){if(payload.confirmNew!==true)throw Error('另建四形态任务需要明确确认；旧工程保持');const backupDir=path.join(directory,'previous-projects');await fs.mkdir(backupDir,{recursive:true});await fs.writeFile(path.join(backupDir,`${old.taskId}-${crypto.randomUUID()}.zip`),await workflow.exportProject(),{flag:'wx'});}const o={protocolVersion:7,templateId:'XH-GRASS-8COND-01',strategy:'art-directed',cellPixels:128,ppu:100,stylePressure:'standard',projectStyleContract:projectStyle()};await workflow.reset();await workflow.configure(o);break;}
   case 'lock':await workflow.lockFormat();break;
   case 'new':await workflow.reset();if(payload.options)await workflow.configure({...payload.options,projectStyleContract:projectStyle()});break;
   case 'upgrade-contract':{const s=await workflow.getState();if(s.lockedSpec?.schemaVersion==='1.5.0')throw Error('当前任务已经使用 v7 形式契约');await workflow.configure({...s.options,protocolVersion:7,stylePressure:'standard',projectStyleContract:projectStyle()});await workflow.lockFormat();break;}
   case 'review-form':{if(payload.explicit!==true)throw Error('需要明确确认形式检查');const s=await workflow.getState(),sample=await workflow.getSample();if(sample.specHash!==s.specHash)await workflow.adoptSampleForCurrentSpec({explicit:true});await workflow.reviewForm({explicit:true,checks:payload.checks,notes:payload.notes??''});break;}
   case 'reject-form':await workflow.rejectForm({explicit:payload.explicit===true,notes:payload.notes??''});break;
   case 'importSample':{if(!['sample','style','manual','single'].includes(payload.kind))throw Error('未知样品类型');const b=await png(payload.method);if(!b)return{cancelled:true,state:await state()};const s=await workflow.getState();await workflow.importSample(b,{kind:payload.kind,parentId:['sample','single'].includes(payload.kind)?undefined:s.selectedSampleId,source:payload.method,purpose:payload.purpose??'',label:payload.label??''});break;}
   case 'select':await workflow.selectSample(payload.id);break;
   case 'approve':await workflow.approveSample({explicit:payload.explicit===true,notes:payload.notes??''});break;
   case 'revoke':await workflow.revokeApproval();break;
   case 'clearReferences':await clearReferenceSelection();await workflow.setReferences([]);break;
   case 'request':{const stage=payload.stage;if(!['sample','style','formal'].includes(stage))throw Error('未知任务阶段');const s=await workflow.getState();if(!s.lockedSpec)throw Error('请先锁定格式');
    let sample,approval,formReview;if(stage==='formal'){const guard=await workflow.productionGuard();sample=guard.sample;approval=guard.approval;formReview=guard.formReview;}else if(stage==='style'){if(['1.5.0','1.6.0'].includes(s.lockedSpec.schemaVersion)&&!s.gates.styleReady)throw Error('形式 / 视角检查尚未通过或签封已陈旧；请明确重新检查');sample=await workflow.getSample();if(['1.5.0','1.6.0'].includes(s.lockedSpec.schemaVersion))formReview=await workflow.getFormReview();}
    const snapshot=await referenceSnapshot(),chosen=Array.isArray(snapshot)?snapshot:snapshot.references;
    if(!Array.isArray(chosen))throw Error('参考快照无效');
    if((Array.isArray(snapshot)?chosen.length>0:snapshot.replace===true))await workflow.setReferences(chosen);
    const refs=await workflow.getReferences();
    const diagnosis=stage==='sample'&&s.formReview?.status==='rejected'?`当前版本形式退回原因（负向诊断）：${s.formReview.notes}`:'';
    const retry=payload.retry===true&&stage==='formal'?s.masters.at(-1):null;const retryDiagnosis=retry?`沿准确批准样品返工：${s.lastError??retry.error??'检查回拼图和重复特征'}；原稿SHA ${retry.sourceArt?.sha256??'见工程'}；取样记录 ${JSON.stringify(retry.conversion?.sourceRects??retry.conversion?.parameters??{})}`:'';const notes=[diagnosis,retryDiagnosis,payload.notes??payload.purpose??''].filter(Boolean).join('\n');
    const pack=packageFor(s.lockedSpec).buildStagePackage({stage,sessionId:s.taskId,lockedSpec:s.lockedSpec,sample,approval,formReview,notes},refs,key);const target=await pickSave(`${s.taskId}-${stage}-task.zip`);if(!target)return{cancelled:true,state:await state()};require('../archive/export-zip.cjs').validateZip(pack.bytes);const out=await writeNew(target,pack.bytes);await workflow.recordRequest(stage==='sample'?'sample-task':stage==='style'?'style-refine-task':'formal-master-task');return{...out,state:await state(),stage};}
   case 'importMaster':{const b=await png(payload.method);if(!b)return{cancelled:true,state:await state()};const s=await workflow.getState();const roles=s.lockedSpec?.strategy==='art-directed'?['materials','contour']:['master'];if(!roles.includes(payload.role))throw Error('正式层角色不匹配');await workflow.importMaster({[payload.role]:b},{source:payload.method});break;}
   case 'compile':{await workflow.compile();const s=await workflow.getState(),compiled=await workflow.getCompiled();const reports=Object.values(testScenes()).map(b=>validator(s.lockedSpec,compiled,b));await workflow.recordValidation({passed:reports.every(r=>r.passed),issues:reports.flatMap(r=>r.issues),artAcceptance:'pending-human-review'});return scene();}
   case 'scene':return scene(payload);
   case 'exportCompiled':return exportCompiled();
   case 'saveProject':{const b=await workflow.exportProject();const s=await workflow.getState();const target=await pickSave(`${s.taskId}-project.zip`);if(!target)return{cancelled:true,state:await state()};return{...await writeNew(target,b),state:await state()};}
   case 'openProject':{const target=await pickZip();if(!target)return{cancelled:true,state:await state()};const st=await fs.lstat(target);if(!st.isFile()||st.isSymbolicLink()||st.size>64*1024*1024||path.extname(target).toLowerCase()!=='.zip')throw Error('工程 ZIP 无效');const bytes=await fs.readFile(target);let manifest;
    const archive=require('../archive/export-zip.cjs');try{manifest=JSON.parse(archive.readZip(bytes).files['manifest.json']);}catch{/* Larger project packs are checked by their dedicated bounded reader. */}
    if(manifest?.schemaVersion==='2dw-zip/5'){const old=archive.validateZip(bytes);return{state:await state(),legacy:{schemaVersion:'2dw-zip/5',grammar:old.spec.grammar},message:'旧 v5 联通任务包已核验；没有样品批准身份。请使用“经典联通母版”入口。当前工程保留，未自动升级批准。'};}
    await workflow.importProject(bytes);break;}
   default:throw Error('未知工作流操作');
  }return state();
 }finally{busy=false;}}
 return{state,action,workflow};
}
module.exports={createTilePipeline,readPng,writeNew};
