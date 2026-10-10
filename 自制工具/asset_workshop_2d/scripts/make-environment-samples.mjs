import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const core=require('../dist/task.cjs'),archive=require('../archive/export-zip.cjs'),{unzipSync}=require('fflate');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
export async function makeEnvironmentSamples(output=path.join(root,'samples','2dw05b')){
 const anchor=path.join(root,'resources','style-references','approved-stone-v1.png');
 if(sha(await fs.readFile(anchor))!=='41c21aa13228c01f15034d213e2e948d2f032fa4ebd0d8f6c87c17185332b559')throw Error('V1 source changed');
 const {label,...selection}=core.listPresetChoices().find(c=>c.seed.id==='standalone-static-png');
 const cases=[
 ['A-stone-floor','可重复石地砖','stone',384,384,100,true,true,'大块厚实石地砖；只设计概括的块体关系','破损稀疏，不照抄 V1 裂缝与布局；不声称已完成无缝拼接。'],
 ['B-stone-wall','石墙立面模块','stone',512,256,200,false,false,'正面石墙模块；主体厚实，不复用地砖平面排布或俯视角','V1 仅为质感方向，不规定颜色、大裂缝、石块大小和地砖构图。'],
 ['C-wood-crate','木箱实验候选','wood',256,256,100,false,false,'试验单个木箱的板块接合结构与概括层次','继承 L0/L1；木材条款只是实验候选，不照搬石材裂缝、粗黑缝或固定冷灰配色。']];
 const results=[];
 for(const [id,title,family,width,height,ppu,repeatable,connected,focus,avoid]of cases){
  const references=family==='stone'?[{refId:'approved-stone-v1',role:'style',sourcePath:anchor,note:'用户认可 V1：仅成熟手绘环境质感方向，不规定目标形态、颜色、裂缝与构图。',priority:90}]:[];
  const {facts,binaries}=await archive.readReferenceFacts(references);
  const spec=core.composePreset(selection,{taskId:'2dw05b-'+id,title,description:focus,widthPx:width,heightPx:height,squareLocked:width===height,ppu,alphaRequirement:'transparent-required',references,
   environmentStyle:{schemaVersion:'2dw-environment-style/1',domain:'environment',materialFamily:family,repeatable,connected},
   taskStyleDelta:{schemaVersion:'2dw-task-style-delta/1',focus,mustPreserve:['已批准场景规则与本任务的物件用途'],mustChange:[focus],localReferenceNote:references.length?'V1 只作为风格方向':'零参考图；不能宣称观察了木材成图',avoid:[avoid]}},facts);
  const result=await archive.exportZip({spec,entries:core.compileWorkflowTask(spec).entries,binaries,outputDirectory:output,fileName:id+'.zip'});
  const bytes=await fs.readFile(result.path),checked=archive.validateZip(bytes),files=unzipSync(bytes);
  for(const e of checked.manifest.entries)if(sha(files[e.path])!==e.sha256||files[e.path].length!==e.byteLength)throw Error('Independent manifest mismatch');
  if(references.length&&!Buffer.from(files[spec.references[0].packagePath]).equals(await fs.readFile(anchor)))throw Error('Reference byte mismatch');
  if(checked.entries.some(e=>/^(output|reports)\//.test(e.path)))throw Error('Fabricated output');
  results.push({file:id+'.zip',sha256:sha(bytes),specSha256:sha(files['spec/asset-spec.json']),schema:checked.spec.schemaVersion,archive:checked.manifest.schemaVersion,entries:checked.entries.length,ppu,world:[spec.output.worldWidth,spec.output.worldHeight],approved:spec.environmentStyle.approvedRules.map(r=>r.id),candidate:spec.environmentStyle.candidateRules.map(r=>r.id),references:checked.spec.references.map(r=>({refId:r.refId,role:r.role,sha256:r.sha256}))});
 }
 await fs.writeFile(path.join(output,'sample-index.json'),JSON.stringify({version:'2dw05b-samples/1',samples:results,artStatus:'任务包可审阅；尚未生成目标素材，美术结果待外部执行与人工验收'},null,2)+'\n',{flag:'wx'});return results;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await makeEnvironmentSamples(process.argv[2]),null,2));
