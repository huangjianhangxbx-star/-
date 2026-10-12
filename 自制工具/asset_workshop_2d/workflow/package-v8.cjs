'use strict';
const crypto=require('node:crypto'),{isDeepStrictEqual}=require('node:util'),{zipSync}=require('fflate'),{PNG}=require('pngjs');
const legacy=require('./package.cjs'),{canonical,sha}=require('./store.cjs');
const {resolveSingleView,roleFor,validateSingleReview,renderSingleChecklist}=require('./single-contract.cjs');
const {resolveStylePressure,renderStylePressure}=require('./style-pressure.cjs');
const {testScenes}=require('../grammar/catalog.cjs'),{artTemplateImages}=require('../grammar/art-directed.cjs');
const json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n'),specHash=legacy.specHash;
function buildLockedSpec(options={}){
 if(options.protocolVersion!==8)throw Error('单图需要显式 protocolVersion:8');
 const {protocolVersion,viewContractId,stylePressure,...baseOptions}=options;
 if(baseOptions.strategy&&baseOptions.strategy!=='art-directed')throw Error('单图正式联通使用独立 art-directed 双层格式，旧经典入口保持');
 const base=legacy.buildLockedSpec({...baseOptions,strategy:'art-directed'});
 return {...base,schemaVersion:'1.6.0',protocolVersion,sampleKind:'single-reference',viewContract:resolveSingleView(base.grammar.template.id,viewContractId),stylePressure:resolveStylePressure(stylePressure),productionMethod:{id:'single-art-adapter/1',contourSource:'explicit-program-template',phasePolicy:'explicit-source-frame-duplication',automaticArtApproval:false,originalPixelsPreserved:true}};
}
function configuration(s){return {protocolVersion:8,templateId:s.grammar?.template?.id,cellPixels:s.grammar?.cellPixels,ppu:s.grammar?.ppu,strategy:s.strategy,seed:s.grammar?.seed,description:s.description,projectStyleContract:s.projectStyleContract,viewContractId:s.viewContract?.id,stylePressure:s.stylePressure?.mode};}
function assertLockedSpec(spec){if(!spec||!isDeepStrictEqual(spec,buildLockedSpec(configuration(spec))))throw Error('v8规格或单图视角镜像不匹配');return spec;}
function sampleGuide(g){const p=new PNG({width:128,height:128}),stone=g.template.material==='stone';for(let y=0;y<128;y++)for(let x=0;x<128;x++)p.data.set(x>12&&x<115&&y>12&&y<115?[...(stone?[114,124,116]:[91,119,77]),255]:[24,29,34,255],(y*128+x)*4);return PNG.sync.write(p);}
function viewGuide(spec){return sampleGuide(spec.grammar);}
function checked(bytes,sampleStage=true){return require('./session.cjs').decodeSample(bytes,{sampleStage});}
function prompt(s){const g=s.lockedSpec.grammar,c=g.cellPixels;return `# 按单张定稿扩展正式联通\n\nspec/asset-spec.json为唯一权威。input/approved-sample.png是真实准确批准的唯一主要视觉基准，是“如何画”的依据，不是已经可切的母版；不要复制它47次再套蒙版。\n\n1. 读取原图：分析黑缝、大中型块面、暗部概括、材质表达与破损密度。最高优先继承画法，不复制同一砖/裂缝；不从单张图猜测未出现的全部转角。\n2. 在模板上扩展连贯绘画：四个不同但同语言的中心区域、两个真实不同的开放边缘、底层和接触暗部，共八个${c}×${c}绘画区；先安排跨格关系，不逐格散画47张。固定视角 ${s.lockedSpec.viewContract.id}，${s.lockedSpec.viewContract.surfaceMode}，不能自由三分之四透视。\n3. 返回 art-source.png 绘画原稿。建议${4*c}×${2*c}，但工具不能精确尺寸时保留真实原件并报告；有文件能力的 Agent 显式选择八个精确取样窗口，不缩放、不镜像、不模糊补缝。\n4. 技术转换：数值 contour 不是黑线插画。明确用版本化模板派生 R0–255/G0–192/B0/A255；材料公共2px边框只按声明的源像素位置重排，原稿不修改，记录所有SHA、取样窗和公共框政策；无法保持画师轮廓时标技术候选，不能称艺术达标。也可直接交付已有合法 materials.png (${4*c}×${2*c}) 与 contour.png (${2*c}×${c})。缺少文件/代码能力的 Chat 如实停在艺术原稿，不宣称已完成编码或47态。\n5. 真正编译47 canonical/188 variants，核对九场景、3×3、8×8、16×16、边角/孔洞/重复特征，必要时携带同一样品与诊断返工。技术通过不等于美术批准，Unity Sorting未验证。\n\n本次诊断：${s.notes||'无'}\n\n${renderSingleChecklist(s.lockedSpec.viewContract)}\n${renderStylePressure(s.lockedSpec.stylePressure)}\n`;
}
function buildStagePackage({stage='formal',sessionId,lockedSpec,sample,approval,formReview,notes=''}={},references=[],privateKey){
 stage=({sample:'sample-task',style:'style-refine-task',formal:'formal-master-task'})[stage]??stage;
 if(!['sample-task','style-refine-task','formal-master-task'].includes(stage))throw Error('v8任务阶段无效');assertLockedSpec(lockedSpec);
 if(typeof sessionId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(sessionId)||typeof notes!=='string'||notes.length>8192)throw Error('v8任务身份或说明无效');
 if(!Array.isArray(references)||references.length>8)throw Error('参考图预算无效');
 const files={},refs=[],seen=new Set();for(const r of references){if(!/^[A-Za-z0-9_-]{1,64}$/.test(r.refId)||seen.has(r.refId.toLowerCase())||!['style','content'].includes(r.role)||!Buffer.isBuffer(r.bytes)||r.bytes.length>4*1024*1024)throw Error('参考身份或预算无效');seen.add(r.refId.toLowerCase());const p=checked(r.bytes,false),name=`refs/${r.role}/${r.refId}.png`;files[name]=r.bytes;refs.push({refId:r.refId,role:r.role,sourceName:String(r.sourceName??'PNG').replace(/[\\/:]/g,'_').slice(0,256),note:String(r.note??'').slice(0,8192),packagePath:name,sha256:sha(r.bytes),byteLength:r.bytes.length,widthPx:p.width,heightPx:p.height,priority:'secondary'});}
 const s={schemaVersion:'1.6.0',protocolVersion:8,taskId:sessionId,stage,lockedSpec,specHash:specHash(lockedSpec),references:refs,notes};
 if(stage!=='sample-task'){
  if(!sample||sha(sample.bytes??Buffer.alloc(0))!==sample.sha256||!Number.isSafeInteger(sample.revision)||sample.revision<1||typeof sample.id!=='string'||!/^[A-Za-z0-9_-]{1,96}$/.test(sample.id))throw Error('v8单图字节或身份不符');const p=checked(sample.bytes);
  s.sample={id:sample.id,revision:sample.revision,sha256:sample.sha256,fileBytes:sample.bytes.length,widthPx:p.width,heightPx:p.height,kind:sample.kind,testOnly:!!sample.testOnly};
  s.formReview=validateSingleReview(formReview,{sample,spec:lockedSpec,specHash:s.specHash,requirePassed:true});s.sampleRole=roleFor(s.sample);
  files['input/form-review.json']=json(s.formReview);files['input/sample-role.json']=json(s.sampleRole);
  if(stage==='formal-master-task'){
   const g=lockedSpec.grammar;if(!approval||approval.sampleId!==sample.id||approval.revision!==sample.revision||approval.sha256!==sample.sha256||approval.fileBytes!==sample.bytes.length||approval.specHash!==s.specHash||approval.templateId!==g.template.id||approval.templateVersion!==g.template.version||approval.profileVersion!=='1'||approval.testOnly!==!!sample.testOnly||approval.approvedBy!==(sample.testOnly?'synthetic/test-only':'user-explicit')||approval.formReviewSha256!==sha(Buffer.from(canonical(s.formReview))))throw Error('v8批准与准确单图/检查不匹配');
   s.approval={...approval};files['input/approval.json']=json(approval);files['input/approved-sample.png']=sample.bytes;
  }else files['input/selected-sample.png']=sample.bytes;
 }
 s.output={artSource:{name:'art-source.png',preferredWidth:lockedSpec.grammar.master.width,preferredHeight:lockedSpec.grammar.master.height,exactDimensions:false},technicalFiles:[{name:'materials.png',width:lockedSpec.grammar.master.width,height:lockedSpec.grammar.master.height},{name:'contour.png',width:lockedSpec.grammar.control.width,height:lockedSpec.grammar.control.height}],artAcceptance:'pending-human-review',unitySorting:'unverified'};
 files['spec/asset-spec.json']=json(s);files['asset-grammar/grammar.json']=json(lockedSpec.grammar);files['asset-grammar/test-scenes.json']=json(testScenes());
 for(const [name,b]of Object.entries(artTemplateImages(lockedSpec.grammar)))files[`guides/${name}.png`]=b;
 files['guides/single-reference.png']=sampleGuide(lockedSpec.grammar);files['guides/view-checklist.md']=Buffer.from(renderSingleChecklist(lockedSpec.viewContract));
 const core=require('../dist/task.cjs');for(const[k,v]of Object.entries(core.renderEnvironmentEntries(lockedSpec.environmentStyle)))files[k]=Buffer.from(v);
 files['style/project-style-contract.json']=json(lockedSpec.projectStyleContract);files['style/task-pressure.md']=Buffer.from(renderStylePressure(lockedSpec.stylePressure));
 files['prompts/task.md']=Buffer.from(prompt(s));files['README_开始阅读.md']=Buffer.from('# 单张定稿→正式联通 ZIP v8\n\nspec/asset-spec.json为唯一规范；input/sample-role.json是派生镜像。单张图锁画法、模板锁拓扑。按prompts/task.md依次分析/连续绘制/显式编排/编译/人工验收。不能靠普通生图保证数值编码。签名证明字节完整性，首次发行指纹仍需核对，不授予异机批准。测试夹具与真实艺术分开。\n');
 const entries=Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([path,b])=>({path,sha256:sha(b),byteLength:b.length}));if(entries.length+1>64||entries.reduce((n,e)=>n+e.byteLength,0)>32*1024*1024)throw Error('v8包预算超限');
 privateKey??=crypto.generateKeyPairSync('ed25519').privateKey;const publicKey=crypto.createPublicKey(privateKey).export({type:'spki',format:'pem'}),authority={schemaVersion:'2dw-zip/8',specPath:'spec/asset-spec.json',taskId:sessionId,stage,entries,issuerFingerprint:sha(Buffer.from(publicKey))};files['manifest.json']=json({...authority,publicKey,signature:crypto.sign(null,json(authority),privateKey).toString('base64')});const bytes=Buffer.from(zipSync(files,{level:6,mtime:new Date('2020-01-01T00:00:00Z')}));if(bytes.length>32*1024*1024)throw Error('v8压缩包预算超限');return{spec:s,files,bytes,sha256:sha(bytes)};
}
function validateStageZip(input,records){let files;if(Buffer.isBuffer(input)||input instanceof Uint8Array){const a=require('../archive/export-zip.cjs').readZip(input);files=a.files;records=a.records;}else files=input;let m,s;try{m=JSON.parse(files['manifest.json']);s=JSON.parse(files['spec/asset-spec.json']);}catch{throw Error('v8权威文件缺失');}const {publicKey,signature,...authority}=m;
 if(m.schemaVersion!=='2dw-zip/8'||m.specPath!=='spec/asset-spec.json'||m.issuerFingerprint!==sha(Buffer.from(publicKey??''))||!crypto.verify(null,json(authority),publicKey,Buffer.from(signature??'','base64')))throw Error('v8 authority签名错误');if(!Array.isArray(m.entries)||m.entries.length!==Object.keys(files).length-1)throw Error('v8清单完整性错误');const seen=new Set();for(const e of m.entries){if(seen.has(e.path)||!files[e.path]||sha(files[e.path])!==e.sha256||files[e.path].length!==e.byteLength)throw Error('v8文件哈希/长度错误');seen.add(e.path);}
 assertLockedSpec(s.lockedSpec);if(s.schemaVersion!=='1.6.0'||s.protocolVersion!==8||s.taskId!==m.taskId||s.stage!==m.stage||s.specHash!==specHash(s.lockedSpec))throw Error('v8规格/身份不匹配');
 const refs=s.references.map(r=>({...r,bytes:Buffer.from(files[r.packagePath]??[])})),sample=s.sample?{...s.sample,bytes:Buffer.from(files[s.stage==='formal-master-task'?'input/approved-sample.png':'input/selected-sample.png']??[])}:undefined;
 const rebuilt=buildStagePackage({stage:s.stage,sessionId:s.taskId,lockedSpec:s.lockedSpec,sample,approval:s.approval,formReview:s.formReview,notes:s.notes},refs);if(!isDeepStrictEqual(rebuilt.spec,s)||Object.keys(rebuilt.files).length!==Object.keys(files).length)throw Error('v8权威规范镜像错误');for(const[name,b]of Object.entries(rebuilt.files))if(name!=='manifest.json'&&!b.equals(Buffer.from(files[name]??[])))throw Error('v8派生镜像错误：'+name);return{manifest:m,spec:s,entries:records?.map(r=>r.path)??Object.keys(files)};
}
module.exports={buildLockedSpec,assertLockedSpec,buildStagePackage,validateStageZip,specHash,sampleGuide,viewGuide};
