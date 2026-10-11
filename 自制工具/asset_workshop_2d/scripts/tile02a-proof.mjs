import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {makeDiagnosticFixture} from './tile02-fixtures.mjs';
const require=createRequire(import.meta.url),{PNG}=require('pngjs');
const {createTilePipeline}=require('../desktop/tile-pipeline.cjs');
const {sha}=require('../workflow/store.cjs');
const {validateZip}=require('../archive/export-zip.cjs');
const {validateOutputZip}=require('../workflow/output.cjs');
const {compileArtDirected}=require('../grammar/art-directed.cjs');
const {validateArtCompilation}=require('../grammar/art-directed-validate.cjs');
const {testScenes}=require('../grammar/catalog.cjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const checks={assetType:true,sharedCamera:true,noForbiddenFaces:true,productionIntent:true};
const provenance={kind:'synthetic/test-only',source:'original procedural diagnostic authored for 2DW-TILE-02A',actualAiGeneration:false,humanArtApproval:false,automaticFormRecognition:false,artAcceptance:'pending-human-review',unitySorting:'unverified'};

function sampleRevision(bytes,revision){
 const p=PNG.sync.read(bytes);for(let i=0;i<p.data.length;i+=4)if(p.data[i+3]){
  if(revision===2){p.data[i]=Math.min(255,p.data[i]+5);p.data[i+1]=Math.min(255,p.data[i+1]+3);}
  if(revision===3){p.data[i+2]=Math.min(255,p.data[i+2]+7);p.data[i]=Math.max(0,p.data[i]-2);}
 }return PNG.sync.write(p);
}
function compactFixture(g){
 const fixture=makeDiagnosticFixture(g),p=PNG.sync.read(fixture.contour);
 // This is a broad original diagnostic control, not scaled-down artist artwork.
 for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)p.data[(y*p.width+x)*4]=90+Math.floor(x/g.cellPixels)*65;
 return {...fixture,contour:PNG.sync.write(p)};
}
async function blocked(work,label){try{await work();}catch(e){return {label,blocked:true,error:e.message};}throw Error(`${label}: expected a gate rejection`);}
function inside(target,base){const rel=path.relative(base,target);return rel!==''&&!rel.startsWith('..')&&!path.isAbsolute(rel);}

export async function writeFormWorkflowProof({output,samples}={}){
 const stamp=`${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
 const evidence=path.resolve(output??path.join(root,'validation','2dw-tile02a',`proof-${stamp}`));
 const sampleDir=path.resolve(samples??path.join(root,'samples','2dw-tile02a',`proof-${stamp}`));
 assert(inside(evidence,path.join(root,'validation','2dw-tile02a')),'Evidence must remain under validation/2dw-tile02a');
 assert(inside(sampleDir,path.join(root,'samples','2dw-tile02a')),'Public fixtures must remain under samples/2dw-tile02a');
 await fs.mkdir(path.dirname(evidence),{recursive:true});await fs.mkdir(evidence);
 await fs.mkdir(path.dirname(sampleDir),{recursive:true});await fs.mkdir(sampleDir);
 const evidenceEntries=[],taskPackages=[],reports=[];
 async function write(relative,bytes){const target=path.join(evidence,relative);assert(inside(target,evidence));await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes,{flag:'wx'});assert.equal(sha(await fs.readFile(target)),sha(bytes));evidenceEntries.push({path:relative.replaceAll('\\','/'),sha256:sha(bytes),fileBytes:bytes.length});return target;}
 async function noteFile(target){assert(inside(target,evidence));const b=await fs.readFile(target);evidenceEntries.push({path:path.relative(evidence,target).replaceAll('\\','/'),sha256:sha(b),fileBytes:b.length});return {path:target,sha256:sha(b),fileBytes:b.length};}
 async function pipelineAt(directory){
  let savePath=null;const pipeline=await createTilePipeline({directory,pickSave:async()=>{assert(savePath,'The proof must choose a concrete saved ZIP path');return savePath;}});
  return {pipeline,saveTo:async(file,action,payload={})=>{savePath=file;try{return await pipeline.action(action,payload);}finally{savePath=null;}}};
 }
 async function saveTask(handle,kind,mode,stage){
  const filename=`${kind}-${mode}-${stage}-task.zip`,target=path.join(sampleDir,filename);
  const result=await handle.saveTo(target,'request',{stage,notes:'Original synthetic/test-only technical workflow proof. No AI generation or user artwork acceptance.'});
  const b=await fs.readFile(target),checked=validateZip(b);assert.equal(result.sha256,sha(b));assert.equal(checked.manifest.schemaVersion,'2dw-zip/7');
  const spec=checked.spec;assert.equal(spec.lockedSpec.stylePressure.mode,mode);
  if(stage!=='sample'){assert.equal(spec.sample.testOnly,true);assert.equal(spec.formReview.reviewedBy,'synthetic/test-only');assert.equal(spec.formReview.status,'conforms');}
  if(stage==='formal')assert.equal(spec.approval.approvedBy,'synthetic/test-only');
  const record={kind,mode,stage:spec.stage,path:target,filename,sha256:sha(b),fileBytes:b.length,taskId:spec.taskId,specHash:spec.specHash,viewContractId:spec.lockedSpec.viewContract.id,stylePressureId:spec.lockedSpec.stylePressure.id,sample:spec.sample??null,formReview:spec.formReview??null,approval:spec.approval??null,verified:true,provenance};
  taskPackages.push(record);return record;
 }
 for(const kind of ['grass','stone']){
  const templateId=kind==='grass'?'XH-GRASS-8COND-01':'XH-STONE-EDGE-8COND-01';
  const options={protocolVersion:7,templateId,cellPixels:64,ppu:100,seed:17,strategy:'art-directed',stylePressure:'standard',description:`Original ${kind} synthetic/test-only fixed-form workflow proof; never AI or user art approval.`};
  const profile=path.join(evidence,kind,'profile'),directory=path.join(profile,'tile-workflow');let handle=await pipelineAt(directory),pipe=handle.pipeline,engine=pipe.workflow;
  await pipe.action('configure',options);await pipe.action('lock');let state=await engine.getState();const spec=state.lockedSpec,g=spec.grammar,fixture=compactFixture(g);
  const firstCompile=compileArtDirected(g,fixture),sample1=validateArtCompilation(g,firstCompile,[[1,1,0,1],[1,0,0,1],[0,0,1,1],[0,1,1,0]]).preview;
  const sample2=sampleRevision(sample1,2),sample3=sampleRevision(sample2,3),paths={
   materials:await write(`${kind}/inputs/materials.png`,fixture.materials),contour:await write(`${kind}/inputs/contour.png`,fixture.contour),
   sample:await write(`${kind}/inputs/sample-v1.png`,sample1),style:await write(`${kind}/inputs/style-v2.png`,sample2),manual:await write(`${kind}/inputs/manual-v3.png`,sample3)};
  await saveTask(handle,kind,'standard','sample');
  await engine.importSample(sample1,{kind:'sample',testOnly:true,source:'original-synthetic',label:'V1 original technical fixture',purpose:'Original diagnostic only; not real AI output.'});
  const unknownStyle=await blocked(()=>engine.recordRequest('style-refine-task'),'unknown form cannot refine');
  const unknownApproval=await blocked(()=>engine.approveSample({explicit:true}),'unknown form cannot approve');
  await engine.reviewForm({explicit:true,checks,notes:'Four checks exercise API using a declared synthetic fixture; no human visual certification.'});
  await saveTask(handle,kind,'standard','style');
  await engine.importSample(sample2,{kind:'style',source:'original-synthetic-step-simulation',label:'V2 simulated style return',purpose:'Tests persisted style revision; no image AI was called.'});
  assert.equal((await engine.getState()).formReview.status,'unchecked');await engine.reviewForm({explicit:true,checks,notes:'Synthetic V2 technical form-check fixture.'});
  await engine.importSample(sample3,{kind:'manual',source:'original-synthetic-step-simulation',label:'V3 simulated manual return',purpose:'Tests manual revision; not approved user artwork.'});
  assert.equal((await engine.getState()).formReview.status,'unchecked');await engine.reviewForm({explicit:true,checks,notes:'Synthetic V3 technical form-check fixture.'});
  await engine.approveSample({explicit:true,notes:'Explicit synthetic/test-only exact-version approval for technical verification only.'});
  const guard=await engine.productionGuard();assert.equal(guard.sample.revision,3);assert.equal(guard.sample.sha256,sha(sample3));assert.equal(guard.approval.approvedBy,'synthetic/test-only');
  await saveTask(handle,kind,'standard','formal');
  await engine.importMaster({materials:fixture.materials},{source:'original-synthetic-materials'});const partial=await engine.getState();assert(partial.masters.at(-1).pending);
  const partialGate=await blocked(()=>engine.compile(),'missing contour cannot compile');
  handle=await pipelineAt(directory);pipe=handle.pipeline;engine=pipe.workflow;state=await engine.getState();assert.equal(state.currentMasterId,partial.currentMasterId);assert.equal(state.masters.at(-1).files.materials.sha256,sha(fixture.materials));
  await engine.importMaster({contour:fixture.contour},{source:'original-synthetic-contour'});await pipe.action('compile');const compiled=await engine.getCompiled();
  assert.equal(compiled.tiles.length,47);assert.equal(compiled.tileVariants.length,188);assert.equal((await engine.getState()).compiled.structureStatus,'passed');
  const scenes={};for(const [name,board]of Object.entries(testScenes())){
   const {preview,...report}=validateArtCompilation(g,compiled,board,{approvedSample:guard.approval});assert.equal(report.passed,true,name);assert.equal(report.sortingVerified,false);assert.equal(report.artAcceptance,'pending-human-review');scenes[name]=report;
   await write(`${kind}/scenes/${name}.png`,preview);
  }
  const compiledPath=path.join(evidence,kind,'compiled.zip');await handle.saveTo(compiledPath,'exportCompiled');const compiledOutput=await noteFile(compiledPath),verifiedOutput=validateOutputZip(await fs.readFile(compiledPath));
  assert.equal(verifiedOutput.map.formReview.sampleId,guard.sample.id);assert.equal(verifiedOutput.map.formReview.status,'conforms');assert.equal(verifiedOutput.map.formReview.reviewedBy,'synthetic/test-only');
  const projectPath=path.join(evidence,kind,'project-compiled.zip');await handle.saveTo(projectPath,'saveProject');const projectOutput=await noteFile(projectPath),projectBytes=await fs.readFile(projectPath);
  handle=await pipelineAt(directory);pipe=handle.pipeline;engine=pipe.workflow;state=await engine.getState();assert.equal(state.stage,'EXPORTED');assert.equal(state.formReview.trustedCurrent,true);assert.equal(state.approval.id,guard.approval.id);assert.equal(state.versions.length,3);
  await engine.importProject(projectBytes);assert.equal((await engine.productionGuard()).approval.id,guard.approval.id);assert.equal((await engine.getCompiled()).tiles.length,47);
  // A separate local copy exercises revisions without disturbing the profile
  // used for desktop smoke. Private signing keys remain in ignored evidence.
  const modeProfile=path.join(evidence,kind,'mode-profile'),modeDirectory=path.join(modeProfile,'tile-workflow');
  await fs.mkdir(modeProfile);await fs.cp(directory,modeDirectory,{recursive:true,errorOnExist:true,force:false});const modeHandle=await pipelineAt(modeDirectory),mode=modeHandle.pipeline.workflow;
  await modeHandle.pipeline.action('configure',{...options,stylePressure:'extreme'});await modeHandle.pipeline.action('lock');let changed=await mode.getState();
  assert.notEqual(changed.specHash,state.specHash);assert.equal(changed.approval.stale,true);assert(changed.requests.every(r=>r.stale));assert(changed.masters.every(m=>m.stale));assert.equal(changed.compiled.stale,true);
  await saveTask(modeHandle,kind,'extreme','sample');await mode.adoptSampleForCurrentSpec({explicit:true});const adopted=await mode.getState();assert.equal(adopted.versions[3].parentId,guard.sample.id);assert.equal(adopted.versions[3].sha256,guard.sample.sha256);assert.equal(adopted.formReview.status,'unchecked');
  await mode.reviewForm({explicit:true,checks,notes:'Synthetic extreme-mode recheck, not user artwork acceptance.'});await mode.approveSample({explicit:true,notes:'Only a synthetic mode-change technical approval.'});
  await modeHandle.pipeline.action('configure',options);await modeHandle.pipeline.action('lock');changed=await mode.getState();assert.equal(changed.specHash,state.specHash);assert.equal(changed.gates.formalReady,false);assert.equal(changed.approval.stale,true);assert.equal(changed.compiled.stale,true);assert(changed.requests.every(r=>r.stale));
  const modeReturnGate=await blocked(()=>mode.productionGuard(),'switching back never revives old form review or approval');
  const modeProjectPath=path.join(evidence,kind,'project-mode-stale.zip');await modeHandle.saveTo(modeProjectPath,'saveProject');await noteFile(modeProjectPath);
  const foreignProfile=path.join(evidence,kind,'foreign-profile'),foreignDirectory=path.join(foreignProfile,'tile-workflow'),foreignHandle=await pipelineAt(foreignDirectory),foreign=foreignHandle.pipeline.workflow;
  await foreign.importProject(projectBytes);const foreignState=await foreign.getState();assert.equal(foreignState.formReview.trustedCurrent,false);assert.equal(foreignState.approval.status,'untrusted');
  const foreignGate=await blocked(()=>foreign.productionGuard(),'foreign project needs explicit form recheck');const foreignApprove=await blocked(()=>foreign.approveSample({explicit:true}),'foreign approval cannot bypass form check');
  await foreign.reviewForm({explicit:true,checks,notes:'Synthetic foreign-machine explicit recheck test.'});await foreign.approveSample({explicit:true,notes:'Synthetic foreign-machine reapproval, not art acceptance.'});assert.equal((await foreign.productionGuard()).approval.approvedBy,'synthetic/test-only');
  const final=await engine.getState();assert.equal(final.stage,'EXPORTED');assert.equal(final.gates.formalReady,true);assert.equal(final.compiled.structureStatus,'passed');assert.equal(final.compiled.artAcceptance,'pending-human-review');
  const report={kind,templateId,taskId:state.taskId,profile,directory,modeProfile,foreignProfile,paths,provenance,approval:guard.approval,formReview:guard.formReview,
   compiledOutput,projectOutput,modeProject:modeProjectPath,
   compiled:{tiles:compiled.tiles.length,variants:compiled.tileVariants.length,inputHashes:compiled.inputHashes,grammarSha256:compiled.grammarSha256,atlasSha256:sha(compiled.atlas),sampling:compiled.sampling,patchSources:compiled.patchSources},
   checks:{threeOriginalRevisions:true,allSynthetic:final.versions.every(v=>v.testOnly),formReviewRequiredPerRevision:true,partialMasterRestored:true,sameMachineProjectTrusted:true,sceneCount:Object.keys(scenes).length,scenesPassed:Object.values(scenes).filter(r=>r.passed).length,resultZipValidated:true,unknownStyle,unknownApproval,partialGate,modeReturnGate,modeAdoptionOriginalSha:adopted.versions[3].sha256,foreignGate,foreignApprove,foreignExplicitRecheckPassed:true},scenes};
  await write(`${kind}/verification.json`,json(report));reports.push(report);
 }
 assert.equal(taskPackages.length,8);assert.equal(new Set(taskPackages.map(p=>p.filename)).size,8);
 const publicManifest={schemaVersion:'2dw-tile02a-public-fixtures/1',provenance,files:taskPackages.map(({filename,sha256,fileBytes,kind,mode,stage,taskId,specHash})=>({path:filename,sha256,fileBytes,kind,mode,stage,taskId,specHash}))};
 const readme=Buffer.from('# 2DW-TILE-02A 原创技术夹具任务包\n\n八个 ZIP：草地、石材各有 standard 的 sample/style/formal 三阶段任务，以及 extreme 的 sample 任务。均使用真实 desktop pipeline、session、v7 package API；全部图像为本工程原创程序诊断夹具。没有原作、用户图片或真实 AI 成图。\n\n形式检查和批准来自明确标记的 synthetic/test-only 夹具，只证明工作流技术门禁；不是用户人工美术认可，也不是程序自动识别了相机/美术。V2、V3 仅模拟风格回传与人工回传，未调用图像 AI。正式候选仍为 artAcceptance: pending-human-review；Unity Sorting: unverified。\n\n固定技术规格：逻辑格64px、PPU100、seed17；materials.png 256×128，contour.png 128×64。47合法态、188真实变体和九地图检查留在本机 validation/2dw-tile02a。sample 2×2是语义契约，软件未作自动语义裁切。\n\nSHA256.json 列出本目录八包的真实 SHA256。包内 spec/asset-spec.json 是唯一硬规格权威，guides/view-guide.png是原创说明图，不是生产美术。发行签名只认证该发行密钥的字节完整性，首次接收仍需核对指纹；不是权利、美术或异机工程审批认证。工程 ZIP、原始诊断PNG、结果包和本机签名私钥仅保存在 ignored validation，未列入此公开目录。\n\n复现：node scripts/tile02a-proof.mjs。每次新增 proof-时间戳目录，拒绝覆盖旧证据与旧任务包。旧v1–v6包、旧程序生成物和2DW-TILE-02样包不修改。\n');
 await fs.writeFile(path.join(sampleDir,'README.md'),readme,{flag:'wx'});await fs.writeFile(path.join(sampleDir,'SHA256.json'),json(publicManifest),{flag:'wx'});
 const summary={schemaVersion:'2dw-tile02a-workflow-proof/1',evidence,samples:sampleDir,provenance,taskPackages,reports:reports.map(({kind,templateId,profile,directory,paths,compiledOutput,projectOutput,checks})=>({kind,templateId,profile,directory,paths,compiledOutput,projectOutput,checks}))};
 const summaryPath=await write('verification.json',json(summary));await write('SHA256.json',json({schemaVersion:'2dw-tile02a-evidence/1',files:evidenceEntries,taskPackages:publicManifest.files}));return {...summary,summaryPath};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const result=await writeFormWorkflowProof();console.log(JSON.stringify({summaryPath:result.summaryPath,evidence:result.evidence,samples:result.samples,reports:result.reports},null,2));}
