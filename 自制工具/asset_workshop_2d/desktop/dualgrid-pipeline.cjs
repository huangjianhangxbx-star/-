'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {createProjectStore,sha,canonical,blobRecord}=require('../workflow/store.cjs');
const {createDataGrid}=require('../dual-grid/data-grid.cjs');
const {makeSpec,assertSpec,compile,renderBoard}=require('../dual-grid/compile.cjs');
const {extractContinuous,sourceInfo}=require('../dual-grid/source.cjs');
const {solid,caseGrid}=require('../dual-grid/fixtures.cjs');
const {diagnose}=require('../dual-grid/seam-check.cjs');
const {buildDualTask}=require('../workflow/package-dualgrid.cjs');
const {buildDualResult,validateDualResult}=require('../dual-grid/output.cjs');
const data=b=>'data:image/png;base64,'+b.toString('base64'),assert=(ok,text)=>{if(!ok)throw Error(text);};
const identity=g=>({taskId:g.taskId,approvalId:g.approval.id,sampleId:g.sample.id,sampleSha256:g.sample.sha256,baseSpecHash:g.specHash});
const hash=v=>sha(Buffer.from(canonical(v)));
async function createDualGridPipeline({directory,workflow,pickPng=async()=>null,pickZip=async()=>null,pickSave=async()=>null,readClipboard=async()=>null}={}){
 const store=await createProjectStore(directory),keyFile=path.join(directory,'dual-issuer-private.pem');let key;
 try{const s=await fs.lstat(keyFile);assert(s.isFile()&&!s.isSymbolicLink()&&s.size<=8192,'双网格发行密钥无效');key=crypto.createPrivateKey(await fs.readFile(keyFile));}catch(e){if(e.code!=='ENOENT')throw e;key=crypto.generateKeyPairSync('ed25519').privateKey;await fs.writeFile(keyFile,key.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});}
 let s=await store.loadSession()??{schemaVersion:'xh-dual-production/1',binding:null,spec:makeSpec({cellPixels:32,period:1}),sources:[],active:{},grid:caseGrid('empty',8),compiled:null,lastError:null,baseProject:null};
 function records(v=s){const out=[];for(const r of v.sources)for(const k of ['original','input'])if(r[k])out.push(r[k]);if(v.baseProject)out.push(v.baseProject);return out;}
 function check(v){assert(v?.schemaVersion==='xh-dual-production/1'&&Array.isArray(v.sources)&&v.sources.length<=64&&v.active&&typeof v.active==='object','生产工程版本或来源记录非法');assertSpec(v.spec);createDataGrid(v.grid);const ids=new Set();for(const r of v.sources){assert(typeof r.id==='string'&&!ids.has(r.id)&&['A','B'].includes(r.role)&&typeof r.accepted==='boolean','生产原件身份非法');ids.add(r.id);}for(const r of records(v))blobRecord(r);return v;}
 check(s);let model=createDataGrid(s.grid),cache=null,demo=null,busy=false;
 async function persist(){s.grid=model.snapshot();await store.saveSession(s);}
 async function rawGuard(){const g=await workflow.productionGuard();g.taskId=(await workflow.getState()).taskId;assert(g.spec.schemaVersion==='1.6.0'&&g.spec.grammar.template.id==='XH-STONE-FLOOR-8COND-01','首轮双网格只支持当前批准的平面石砖');return g;}
 async function boundGuard(){const g=await rawGuard();assert(s.binding&&canonical(identity(g))===canonical(s.binding),'当前批准或规格改变，请沿用当前已批准图重新绑定');assert(s.spec.cellPixels===g.spec.grammar.cellPixels&&s.spec.ppu===g.spec.grammar.ppu,'生产规格与已批准格式不一致');return g;}
 function source(role){return s.sources.find(r=>r.id===s.active[role]);}
 function sourceReady(role){const r=source(role),n=s.spec.cellPixels*s.spec.period;return!!r?.accepted&&r.bindingHash===hash(s.binding)&&r.metadata?.inputWidth===n&&r.metadata?.inputHeight===n;}
 async function inputs(){const out={};for(const r of ['A','B']){const item=source(r);assert(sourceReady(r),`${r}绘画素材缺失/尺寸不符或来自旧批准；请导入完整当前原稿`);out[r]={original:await store.readBlob(item.original),bytes:await store.readBlob(item.input),metadata:item.metadata};}return out;}
 async function getCache(){if(!cache&&s.compiled){const input=await inputs();cache=compile(s.spec,{A:input.A.bytes,B:input.B.bytes});}return cache;}
 function geometric(){if(!demo){const c=s.spec.cellPixels,config=makeSpec({cellPixels:c,ppu:s.spec.ppu,period:1,roundness:s.spec.roundness,inkWidth:0,inkStrength:0});demo=compile(config,{A:solid(c,[108,127,111]),B:solid(c,[22,29,34])});}return demo;}
 async function state(){let available=false,canBind=false,reason='先在单图流程明确检查并批准平面石砖';try{const g=await rawGuard();canBind=true;available=!!s.binding&&canonical(identity(g))===canonical(s.binding)&&s.spec.cellPixels===g.spec.grammar.cellPixels&&s.spec.ppu===g.spec.grammar.ppu;reason=available?'':'请沿用当前已批准图，绑定这条生产线';}catch(e){reason=e.message;}
  const result=JSON.parse(JSON.stringify(s));result.grid=model.snapshot();result.render=model.render();result.canBind=canBind;result.productionAvailable=available;result.gateReason=reason;result.compileReady=available&&sourceReady('A')&&sourceReady('B');if(result.compiled&&!available)result.compiled.stale=true;return result;
 }
 async function addSource(role,bytes,options={},origin='user-selected'){
  assert(s.sources.length<64,'本工程已满64份原件，请另存后新建生产工程');let info={},converted,error;
  try{info=sourceInfo(bytes);converted=extractContinuous(bytes,s.spec,options);}catch(e){error=e;}
  const r={id:crypto.randomUUID(),role,createdAt:new Date().toISOString(),origin,bindingHash:hash(s.binding),rawInfo:info,original:await store.putBlob(bytes,error?'bin':'png'),accepted:!error,error:error?.message??null};
  if(converted){r.input=await store.putBlob(converted.bytes,'png');r.metadata=converted.metadata;}s.sources.push(r);s.active[role]=r.id;s.compiled=null;s.lastError=r.error;cache=null;await persist();if(error)throw error;return r;
 }
 async function defaultB(){const n=s.spec.cellPixels*s.spec.period;await addSource('B',solid(n),{},'original-background-test');}
 async function saveNew(defaultName,bytes,guarded=false){const target=await pickSave(defaultName);if(!target)return{cancelled:true,state:await state()};if(guarded)await boundGuard();await fs.writeFile(target,bytes,{flag:'wx'});assert(sha(await fs.readFile(target))===sha(bytes),'保存后SHA不一致');return{path:target,sha256:sha(bytes),state:await state()};}
 const fields={bind:[],configure:['period','roundness','inkWidth','inkStrength'],assets:[],scene:['name','size'],paint:['edits'],undo:[],redo:[],trace:['x','y'],diagnostics:[], 'import-source':['role','method','explicit','window'],compile:[],request:['retry','notes'], 'export-result':[], 'export-preview':[],save:[],open:[]};
 async function action(name,payload={}){
  assert(!busy,'正在操作，请稍候');assert(Object.hasOwn(fields,name),'未知双网格操作');assert(payload&&typeof payload==='object'&&!Array.isArray(payload)&&Object.keys(payload).every(k=>fields[name].includes(k)),'操作字段或路径不允许');busy=true;
  try{
   switch(name){
    case'bind':{const g=await rawGuard();s.binding=identity(g);s.spec=makeSpec({cellPixels:g.spec.grammar.cellPixels,ppu:g.spec.grammar.ppu,period:4});s.active={};s.compiled=null;s.lastError=null;cache=null;demo=null;await defaultB();break;}
    case'configure':{await boundGuard();s.spec=makeSpec({...Object.fromEntries(['cellPixels','ppu','period','roundness','inkWidth','inkStrength'].map(k=>[k,s.spec[k]])),...payload});s.compiled=null;cache=null;demo=null;s.lastError=null;if(source('B')?.origin==='original-background-test'&&!sourceReady('B'))await defaultB();await persist();break;}
    case'assets':{const art=await getCache(),c=art??geometric();let reference;try{reference=data((await rawGuard()).sample.bytes);}catch{}return{state:await state(),kind:art?'compiled-art-candidate':'geometry-demo',atlas:data(c.atlasPng),phases:c.phaseAtlases.map(p=>({phaseX:p.phaseX,phaseY:p.phaseY,image:data(p.png)})),period:c.spec.period,reference};}
    case'scene':{model=createDataGrid(caseGrid(payload.name??'empty',payload.size??8));await persist();return{state:await state(),changed:null};}
    case'paint':{const changed=model.paint(payload.edits);if(changed.length)await persist();return{state:await state(),changed};}
    case'undo':case'redo':{const changed=model[name]();await persist();return{state:await state(),changed};}
    case'trace':{const c=(await getCache())??geometric(),trace=model.trace(payload.x,payload.y),px=trace.x%c.spec.period,py=trace.y%c.spec.period;return{trace:{...trace,file:`phases/${px}-${py}/mask-${String(trace.mask).padStart(2,'0')}.png`,phaseX:px,phaseY:py,sourceRect:{x:px*c.spec.cellPixels,y:py*c.spec.cellPixels,width:c.spec.cellPixels,height:c.spec.cellPixels},approvedSampleSha:s.binding?.sampleSha256??null,sourceSha256:source('A')?.input?.sha256??null,previewKind:s.compiled?'compiled-art-candidate':'geometry-demo'},state:await state()};}
    case'diagnostics':{const c=(await getCache())??geometric();return{diagnostics:diagnose(c,model.snapshot()),state:await state()};}
    case'import-source':{await boundGuard();assert(['A','B'].includes(payload.role)&&['file','clipboard'].includes(payload.method),'图源角色/方法错误');let bytes;if(payload.method==='file'){const file=await pickPng();if(!file)return{cancelled:true,state:await state()};bytes=await fs.readFile(file);}else{const value=await readClipboard();bytes=Buffer.isBuffer(value)?value:value?.bytes;assert(bytes,'剪贴板没有PNG位图，原工程保留');}await boundGuard();await addSource(payload.role,bytes,{...(payload.window?{window:payload.window,explicit:payload.explicit}: {})},payload.method);break;}
    case'compile':{await boundGuard();const input=await inputs();cache=compile(s.spec,{A:input.A.bytes,B:input.B.bytes});const diagnostics=diagnose(cache,model.snapshot());assert(diagnostics.statuses.topology==='passed','16态拓扑检查失败');s.compiled={id:crypto.randomUUID(),specHash:hash(s.spec),sourceA:source('A').input.sha256,sourceB:source('B').input.sha256,statuses:diagnostics.statuses,createdAt:new Date().toISOString()};s.lastError=null;await persist();return{state:await state(),diagnostics};}
    case'request':{const g=await boundGuard(),c=await getCache(),diagnosis=c?diagnose(c,model.snapshot()):{issues:s.lastError?[{code:'source-dimension',severity:'hard',message:s.lastError}]:[]},retrySources=[];if(payload.retry===true)for(const role of ['A','B']){const r=source(role);if(r)retrySources.push({role,bytes:await store.readBlob(r.original),originalSha256:r.original.sha256});}const pack=buildDualTask({guard:g,spec:s.spec,notes:payload.notes??'',diagnosis,retrySources},key);require('../archive/export-zip.cjs').validateZip(pack.bytes);return await saveNew(`${g.taskId}-dual-grid-art-task.zip`,pack.bytes,true);}
    case'export-result':{const g=await boundGuard();assert(s.compiled,'先编译当前真实母图');const pack=buildDualResult({guard:g,spec:s.spec,sources:await inputs(),grid:model.snapshot()},key);validateDualResult(pack.bytes);return await saveNew(`${g.taskId}-dual-grid-result.zip`,pack.bytes,true);}
    case'export-preview':{const c=(await getCache())??geometric();return await saveNew(`dual-grid-${s.compiled?'candidate':'geometry'}-preview.png`,renderBoard(c,model.snapshot()).png);}
    case'save':{s.baseProject=await store.putBlob(await workflow.exportProject(),'bin');await persist();return await saveNew(`dual-grid-project-${crypto.randomUUID()}.zip`,await store.exportProject(s,records()));}
    case'open':{const file=await pickZip();if(!file)return{cancelled:true,state:await state()};const imported=store.decodeProject(await fs.readFile(file));check(imported.session);assert(imported.session.baseProject,'生产工程缺少原上游样品档案');await store.importBlobs(imported.files);const next=JSON.parse(JSON.stringify(imported.session));await workflow.importProject(await store.readBlob(next.baseProject));s=next;model=createDataGrid(s.grid);cache=null;demo=null;if(s.compiled){const c=await getCache();s.compiled.statuses=diagnose(c,model.snapshot()).statuses;}await persist();break;}
   }
   return{state:await state()};
  }finally{busy=false;}
 }
 return{state,action};
}
module.exports={createDualGridPipeline};
