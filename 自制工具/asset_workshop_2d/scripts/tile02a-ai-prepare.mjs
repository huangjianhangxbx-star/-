import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {buildLockedSpec,buildStagePackage}=require('../workflow/package-v7.cjs');
const {validateZip}=require('../archive/export-zip.cjs'),{sha}=require('../workflow/store.cjs');
const destination=path.join(root,'validation','2dw-tile02a',`ai-${Date.now()}`);await fs.mkdir(destination,{recursive:true});
const referencePath=path.join(root,'resources','style-references','approved-stone-v1.png'),reference=await fs.readFile(referencePath),records=[];
for(const kind of ['grass','stone'])for(const mode of ['standard','extreme']){
 const spec=buildLockedSpec({protocolVersion:7,templateId:kind==='grass'?'XH-GRASS-8COND-01':'XH-STONE-EDGE-8COND-01',cellPixels:128,ppu:100,seed:17,strategy:'art-directed',stylePressure:mode,description:kind==='grass'?'深浅适度的自然草地与平面土边，适用于俯视2D联通地图。':'低饱和冷灰石质边界，顶部主体和统一朝屏幕下方的暗前立面，适用于2D联通地图。'});
 const pack=buildStagePackage({stage:'sample',sessionId:`real-ai-${kind}-${mode}`,lockedSpec:spec},[{refId:'approved-stone-v1',role:'style',bytes:reference,sourceName:'approved-stone-v1.png',note:'仅成熟手绘大块面质感方向；不继承颜色、裂缝、构图或石材到草地。'}]);validateZip(pack.bytes);
 const zipPath=path.join(destination,`${kind}-${mode}-sample-task.zip`),promptPath=path.join(destination,`${kind}-${mode}-prompt.txt`);await fs.writeFile(zipPath,pack.bytes,{flag:'wx'});
 const prompt='Use case: stylized-concept. Asset: original game environment sample, not a diagram.\n'+pack.files['prompts/task.md'].toString('utf8')+'\n实际调用说明：图1为本工程原创视角说明图，仅锁定2×2四区相机/几何语义；图2为已认可石砖V1，仅作为成熟手绘质感参考。把图1的四个示意区域改绘为正式手绘小样。请删除所有文字、数字、箭头、边框，不抄图2的砖缝、颜色或构图。保持四区域尺度一致、严格2×2语义。输出一个PNG样品sheet，四区之外使用干净中性深灰背景，不加投影展台；不要画47态母版。标准与极端是任务级实验，未获用户美术批准。\n';
 await fs.writeFile(promptPath,prompt,{flag:'wx'});records.push({kind,mode,zipPath,promptPath,zipSha256:sha(pack.bytes),promptSha256:sha(Buffer.from(prompt)),specHash:pack.spec.specHash,viewContractId:spec.viewContract.id,stylePressureId:spec.stylePressure.id,guidePath:path.join(root,'resources','tile-templates',`${kind}-view-guide.png`),guideSha256:sha(pack.files['guides/view-guide.png']),referencePath,referenceSha256:sha(reference)});
}
await fs.writeFile(path.join(destination,'calls-planned.json'),JSON.stringify({version:'2dw-tile02a-real-ai/1',tool:'builtin image_gen imagegen',model:'unknown (not exposed by tool)',artAcceptance:'pending-human-review',unitySorting:'unverified',records},null,2));
console.log(JSON.stringify({destination,records},null,2));
