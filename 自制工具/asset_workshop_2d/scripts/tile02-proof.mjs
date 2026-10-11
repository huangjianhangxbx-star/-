import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {makeDiagnosticFixture} from './tile02-fixtures.mjs';

const require=createRequire(import.meta.url),{PNG}=require('pngjs');
const {createProjectStore,sha}=require('../workflow/store.cjs');
const {createWorkflowSession}=require('../workflow/session.cjs');
const {buildLockedSpec,buildStagePackage}=require('../workflow/package.cjs');
const {validateZip}=require('../archive/export-zip.cjs');
const {compileArtDirected,validateArtLayer}=require('../grammar/art-directed.cjs');
const {validateArtCompilation}=require('../grammar/art-directed-validate.cjs');
const {testScenes}=require('../grammar/catalog.cjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const provenance={kind:'synthetic/test-only',source:'original procedural diagnostic authored for 2DW-TILE-02',artAcceptance:'pending-human-review',actualAiGeneration:false};

/** These distinct original test inputs simulate three import steps, never AI or user artwork. */
function sampleRevision(bytes,revision){
 const p=PNG.sync.read(bytes);
 for(let i=0;i<p.data.length;i+=4)if(p.data[i+3]){
  if(revision===2){p.data[i]=Math.min(255,p.data[i]+5);p.data[i+1]=Math.min(255,p.data[i+1]+3);}
  if(revision===3){p.data[i+2]=Math.min(255,p.data[i+2]+7);p.data[i]=Math.max(0,p.data[i]-2);}
 }
 return PNG.sync.write(p);
}
function compactFixture(g){
 const fixture=makeDiagnosticFixture(g),p=PNG.sync.read(fixture.contour);
 // Small test cells use two broad inset values. The 128px diagnostic deliberately
 // has a wavy control; compressing its waves would introduce isolated pixels.
 for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)p.data[(y*p.width+x)*4]=90+Math.floor(x/g.cellPixels)*65;
 return {...fixture,contour:PNG.sync.write(p)};
}
async function engineAt(directory){
 const store=await createProjectStore(directory);
 const engine=await createWorkflowSession({store,buildLockedSpec,
  compileMaster:(spec,files)=>compileArtDirected(spec.grammar,files),
  validateMasterLayer:(spec,role,bytes)=>validateArtLayer(spec.grammar,role,bytes),
  validateCompilation:(spec,result,board,options)=>validateArtCompilation(spec.grammar,result,board,options)});
 return {store,engine};
}
async function expectBlocked(operation,label){
 try{await operation();}catch(e){return {label,blocked:true,error:e.message};}
 throw Error(`${label}: expected a gate rejection`);
}

export async function writeWorkflowProof({output,samples}={}){
 const stamp=Date.now(),evidence=path.resolve(output??path.join(root,'validation','2dw-tile02',`proof-${stamp}`));
 const allowed=path.join(root,'validation','2dw-tile02');
 assert(evidence.startsWith(allowed+path.sep),'Proof must stay in the workshop validation/2dw-tile02 directory');
 const sampleRoot=path.join(root,'samples','2dw-tile02');
 let sampleDir=path.resolve(samples??sampleRoot);
 assert(sampleDir===sampleRoot||sampleDir.startsWith(sampleRoot+path.sep),'Public fixtures must stay in samples/2dw-tile02');
 if(!samples){try{await fs.access(sampleRoot);sampleDir=path.join(sampleRoot,`proof-${stamp}`);}catch(e){if(e.code!=='ENOENT')throw e;}}
 await fs.mkdir(evidence,{recursive:true});await fs.mkdir(sampleDir,{recursive:true});
 const entries=[],taskPackages=[],reports=[];
 const write=async(relative,bytes)=>{const target=path.join(evidence,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes,{flag:'wx'});assert.equal(sha(await fs.readFile(target)),sha(bytes));entries.push({path:relative.replaceAll('\\','/'),sha256:sha(bytes),fileBytes:bytes.length});return target;};
 const writeTask=async(kind,stage,pack)=>{
  const check=validateZip(pack.bytes);assert.equal(check.spec.stage,stage);assert.equal(sha(pack.bytes),pack.sha256);
  const filename=`${kind}-${stage}.zip`,target=path.join(sampleDir,filename);
  await fs.writeFile(target,pack.bytes,{flag:'wx'});assert.equal(sha(await fs.readFile(target)),pack.sha256);
  const result={kind,stage,path:target,filename,sha256:pack.sha256,fileBytes:pack.bytes.length,verified:true,
   sample:pack.spec.sample??null,approval:pack.spec.approval??null,provenance};
  if(stage==='formal-master-task')assert.equal(result.approval.approvedBy,'synthetic/test-only');
  taskPackages.push(result);return result;
 };
 for(const kind of ['grass','stone']){
  const templateId=kind==='grass'?'XH-GRASS-8COND-01':'XH-STONE-EDGE-8COND-01';
  const profile=path.join(evidence,kind,'profile'),directory=path.join(profile,'tile-workflow');
  let {store,engine}=await engineAt(directory);
  await engine.configure({templateId,cellPixels:64,ppu:100,seed:17,strategy:'art-directed',description:`Original ${kind} synthetic test-only workflow fixture; no AI or user art approval.`});
  await engine.lockFormat();let state=await engine.getState();const spec=state.lockedSpec,g=spec.grammar;
  const fixture=compactFixture(g),initial=compileArtDirected(g,fixture),board=[[1,1,0,1,1],[1,0,0,1,0],[0,0,0,0,0],[0,1,1,0,1],[0,1,1,0,0]];
  const sample1=validateArtCompilation(g,initial,board).preview,sample2=sampleRevision(sample1,2),sample3=sampleRevision(sample2,3);
  const paths={materials:await write(`${kind}/inputs/materials.png`,fixture.materials),contour:await write(`${kind}/inputs/contour.png`,fixture.contour),
   sample:await write(`${kind}/inputs/sample-v1.png`,sample1),style:await write(`${kind}/inputs/style-v2.png`,sample2),manual:await write(`${kind}/inputs/manual-v3.png`,sample3)};
  const privateKey=crypto.generateKeyPairSync('ed25519').privateKey;
  await engine.recordRequest('sample-task');await writeTask(kind,'sample-task',buildStagePackage({stage:'sample-task',sessionId:state.taskId,lockedSpec:spec,notes:'Original synthetic diagnostic; test-only.'},[],privateKey));
  await engine.importSample(sample1,{kind:'sample',testOnly:true,source:'original-synthetic',label:'V1 original diagnostic',purpose:'Synthetic sample import, not AI generation or visual approval.'});
  const first=await engine.getSample();await engine.recordRequest('style-refine-task');
  await writeTask(kind,'style-refine-task',buildStagePackage({stage:'style-refine-task',sessionId:state.taskId,lockedSpec:spec,sample:first,notes:'Only an original synthetic style-step input simulation; no AI image generation.'},[],privateKey));
  await engine.importSample(sample2,{kind:'style',testOnly:true,source:'original-synthetic-simulation',label:'V2 style import simulation',purpose:'Tests style-step version persistence; not real AI output.'});
  await engine.importSample(sample3,{kind:'manual',testOnly:true,source:'original-synthetic-simulation',label:'V3 manual import simulation',purpose:'Tests manual revision persistence; original synthetic test-only input.'});
  state=await engine.getState();assert.equal(state.versions.length,3);assert(state.versions.every(v=>v.testOnly&&v.accepted));
  await engine.approveSample({explicit:true,notes:'Approve only the synthetic/test-only workflow fixture; this is not user artwork approval.'});
  const guard=await engine.productionGuard();assert.equal(guard.approval.approvedBy,'synthetic/test-only');assert.equal(guard.approval.testOnly,true);
  assert.equal(guard.approval.sha256,sha(sample3));assert.equal(guard.approval.revision,3);
  await engine.recordRequest('formal-master-task');
  await writeTask(kind,'formal-master-task',buildStagePackage({stage:'formal-master-task',sessionId:state.taskId,lockedSpec:guard.spec,sample:guard.sample,approval:guard.approval,notes:'Explicit synthetic/test-only approval from the workflow productionGuard, never user art acceptance.'},[],privateKey));
  await engine.importMaster({materials:fixture.materials},{source:'original-synthetic-materials'});
  const partial=await engine.getState();assert.equal(partial.gates.compileReady,false);assert.equal(partial.masters.at(-1).pending,true);
  const partialBlocked=await expectBlocked(()=>engine.compile(),'partial master compile');
  ({store,engine}=await engineAt(directory));state=await engine.getState();assert.equal(state.currentMasterId,partial.currentMasterId);assert.equal(state.masters.at(-1).files.materials.sha256,sha(fixture.materials));assert.equal(state.masters.at(-1).pending,true);
  await engine.importMaster({contour:fixture.contour},{source:'original-synthetic-contour'});assert.equal((await engine.getState()).gates.compileReady,true);await engine.compile();
  const compiled=await engine.getCompiled();assert.equal(compiled.tiles.length,47);assert.equal(compiled.tileVariants.length,188);
  const scenes={};for(const [name,map] of Object.entries(testScenes())){
   const {preview,...result}=validateArtCompilation(g,compiled,map,{approvedSample:guard.approval});assert.equal(result.passed,true,name);assert.equal(result.sortingVerified,false);assert.equal(result.artAcceptance,'pending-human-review');
   assert(result.placements.every(p=>p.approvedSample?.id===guard.approval.id));scenes[name]=result;await write(`${kind}/scenes/${name}.png`,preview);
  }
  const validation={passed:Object.values(scenes).every(v=>v.passed),scenes,provenance,artAcceptance:'pending-human-review',unitySorting:'unverified'};
  await engine.recordValidation(validation);const approvedZip=await engine.exportProject();assert.equal(store.decodeProject(approvedZip).trusted,true);const approvedProject=await write(`${kind}/project-compiled.zip`,approvedZip);
  ({store,engine}=await engineAt(directory));await engine.importProject(approvedZip);const reopenedGuard=await engine.productionGuard();assert.equal(reopenedGuard.approval.id,guard.approval.id);assert.equal((await engine.getState()).versions.length,3);assert.equal((await engine.getCompiled()).rawSha256,sha(fixture.materials));
  await engine.revokeApproval('Synthetic fixture revoke test');const revokedState=await engine.getState();assert.equal(revokedState.gates.formalReady,false);assert.equal(revokedState.compiled.stale,true);
  const revokeGuard=await expectBlocked(()=>engine.productionGuard(),'revoked formal production');const revokeCompile=await expectBlocked(()=>engine.getCompiled(),'revoked compiled result');
  const revokedProject=await write(`${kind}/project-revoked.zip`,await engine.exportProject());
  await engine.approveSample({explicit:true,notes:'Reapprove only original synthetic/test-only V3; do not confer user art approval.'});const reapprovedGuard=await engine.productionGuard();assert.notEqual(reapprovedGuard.approval.id,guard.approval.id);assert.equal(reapprovedGuard.approval.testOnly,true);
  const reapprovalNeedsMaster=await expectBlocked(()=>engine.compile(),'reapproval needs current master');
  await engine.importMaster({materials:fixture.materials,contour:fixture.contour},{source:'original-synthetic-reapproval'});await engine.compile();const regenerated=await engine.getCompiled();assert.equal(sha(regenerated.atlas),sha(compiled.atlas));
  const reapprovedScenes={};for(const [name,map] of Object.entries(testScenes())){const {preview,...result}=validateArtCompilation(g,regenerated,map,{approvedSample:reapprovedGuard.approval});assert.equal(result.passed,true);reapprovedScenes[name]=result;}
  await engine.recordValidation({passed:true,scenes:reapprovedScenes,provenance,artAcceptance:'pending-human-review',unitySorting:'unverified'});
  const reapprovedZip=await engine.exportProject(),reapprovedProject=await write(`${kind}/project-reapproved.zip`,reapprovedZip);
  const foreignDirectory=path.join(evidence,kind,'foreign-store'),foreign=await engineAt(foreignDirectory);await foreign.engine.importProject(reapprovedZip);
  const foreignState=await foreign.engine.getState();assert.equal(foreignState.gates.formalReady,false);assert.equal(foreignState.approval.status,'untrusted');const foreignGate=await expectBlocked(()=>foreign.engine.productionGuard(),'foreign-machine project approval');
  const final=await engine.getState();assert.equal(final.compiled.structureStatus,'passed');assert.equal(final.approval.trustedCurrent,true);assert.equal(final.compiled.artAcceptance,'pending-human-review');
  const report={kind,templateId,taskId:state.taskId,profile,directory,paths,provenance,approval:guard.approval,reapprovedApproval:reapprovedGuard.approval,
   approvedProject,revokedProject,reapprovedProject,compiled:{tiles:compiled.tiles.length,variants:compiled.tileVariants.length,inputHashes:compiled.inputHashes,grammarSha256:compiled.grammarSha256,atlasSha256:sha(compiled.atlas),sampling:compiled.sampling,patchSources:compiled.patchSources},
   checks:{versions:3,allSynthetic:true,partialMasterRestored:true,sameMachineProjectTrusted:true,reapprovalPreservesAtlas:true,sceneCount:Object.keys(scenes).length,scenesPassed:Object.values(scenes).filter(s=>s.passed).length,partialBlocked,revokeGuard,revokeCompile,reapprovalNeedsMaster,foreignGate},scenes};
  await write(`${kind}/verification.json`,json(report));reports.push(report);
 }
 const publicManifest={schemaVersion:'2dw-tile02-public-fixtures/1',provenance,files:taskPackages.map(({filename,sha256,fileBytes,kind,stage})=>({path:filename,sha256,fileBytes,kind,stage}))};
 const readme=Buffer.from('# 2DW-TILE-02 原创技术夹具任务包\n\n这六个 ZIP 由真实 workflow/session/store/package API 生成：草地、石材各包括 sample-task、style-refine-task、formal-master-task。所有 PNG 均为本工程原创程序诊断夹具，不含原作、AI 返回图或用户图片。\n\n正式包使用 test-only V3 的真实生产门禁审批，approvedBy 为 synthetic/test-only。V2 仅模拟风格步骤的导入，不宣称实际调用 AI。程序检查通过不等于用户认可的美术；Unity 高度排序仍未验证。\n\n固定测试规格：逻辑格 64px、PPU 100、seed 17；materials.png 精确 256×128、contour.png 精确 128×64；47 状态与每状态 4 个实际变体。包内 spec/asset-spec.json 是硬规格权威，输入图仅允许本包明确列出的来源。\n\n校验：SHA256.json 给出六包 SHA256。使用 node -e "const fs=require(\'fs\');require(\'./archive/export-zip.cjs\').validateZip(fs.readFileSync(process.argv[1]));console.log(\'verified\')" samples/2dw-tile02/grass-sample-task.zip（从工坊目录运行；重复生成时使用本目录实际路径）。签名是技术发行完整性，不是权利或美术认证。\n\n复现：node scripts/tile02-proof.mjs。新证据、可恢复工程与撤销/重新批准记录在 validation/2dw-tile02/proof-时间戳；后续任务 ZIP 写入新的子目录，绝不覆盖已有包。同机审批密钥只留本地 store，不进入这些公开任务包。\n');
 await fs.writeFile(path.join(sampleDir,'README.md'),readme,{flag:'wx'});await fs.writeFile(path.join(sampleDir,'SHA256.json'),json(publicManifest),{flag:'wx'});
 const summary={schemaVersion:'2dw-tile02-workflow-proof/1',evidence,samples:sampleDir,provenance,taskPackages,reports:reports.map(({kind,profile,directory,paths,approvedProject,revokedProject,reapprovedProject,checks})=>({kind,profile,directory,paths,approvedProject,revokedProject,reapprovedProject,checks}))};
 const summaryPath=await write('verification.json',json(summary));await write('SHA256.json',json({schemaVersion:'2dw-tile02-workflow-evidence/1',files:entries,taskPackages:publicManifest.files}));
 return {...summary,summaryPath};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const result=await writeWorkflowProof();console.log(JSON.stringify({summaryPath:result.summaryPath,evidence:result.evidence,samples:result.samples,reports:result.reports},null,2));
}
