'use strict';
const {readZip}=require('../archive/export-zip.cjs');
const {sha,compileMaster}=require('../grammar/compile.cjs');
const {compileArtDirected}=require('../grammar/art-directed.cjs');
const {specHash}=require('./package.cjs');
const assert=(ok,message)=>{if(!ok)throw Error(message);};
/** Checks output pixels against the supplied source, without granting approval or art acceptance. */
function validateOutputZip(bytes){
 const {files,records}=readZip(bytes,{entries:512,archiveBytes:64*1024*1024});
 const manifest=JSON.parse(files['manifest.json']??''),map=JSON.parse(files['map.json']??''),report=JSON.parse(files['validation.json']??'');
 assert(manifest.schemaVersion==='2dw-tile-output/2'&&map.schemaVersion==='2dw-tile-output/2','结果ZIP版本错误');
 assert(Array.isArray(manifest.entries)&&manifest.entries.length===records.length-1,'结果ZIP清单不完整');
 const names=new Set();for(const e of manifest.entries){assert(typeof e.path==='string'&&!names.has(e.path)&&files[e.path]&&sha(files[e.path])===e.sha256&&files[e.path].length===e.byteLength,'结果ZIP条目SHA或长度错误');names.add(e.path);}
 assert(!names.has('manifest.json')&&records.every(r=>r.path==='manifest.json'||names.has(r.path)),'结果ZIP有未登记条目');
 assert(map.specHash===specHash(map.lockedSpec)&&map.approval?.specHash===map.specHash&&sha(files['source/approved-sample.png'])===map.approval.sha256,'结果来源身份不一致');
 if(map.lockedSpec.schemaVersion==='1.5.0'){
  require('./package-v7.cjs').assertLockedSpec(map.lockedSpec);
  require('./form-contract.cjs').validateFormReview(map.formReview,{sample:{id:map.approval.sampleId,revision:map.approval.revision,sha256:map.approval.sha256,testOnly:map.approval.testOnly},spec:map.lockedSpec,specHash:map.specHash,requirePassed:true});
  assert(map.approval.formReviewSha256===sha(Buffer.from(require('./store.cjs').canonical(map.formReview))),'结果形式检查与批准绑定不一致');
 }
 if(map.lockedSpec.schemaVersion==='1.6.0'){
  require('./package-v8.cjs').assertLockedSpec(map.lockedSpec);
  require('./single-contract.cjs').validateSingleReview(map.formReview,{sample:{id:map.approval.sampleId,revision:map.approval.revision,sha256:map.approval.sha256,testOnly:map.approval.testOnly},spec:map.lockedSpec,specHash:map.specHash,requirePassed:true});
  assert(map.approval.formReviewSha256===sha(Buffer.from(require('./store.cjs').canonical(map.formReview))),'单图结果检查与批准不匹配');
  if(map.conversion||files['source/conversion.json']||files['source/art-source.png']){assert(map.conversion&&files['source/art-source.png'],'转换来源三件套不完整');assert(files['source/conversion.json']&&require('node:util').isDeepStrictEqual(JSON.parse(files['source/conversion.json']),map.conversion),'转换镜像不一致');require('../grammar/single-adapter.cjs').validateConversion(map.lockedSpec,files['source/art-source.png'],files['source/materials.png'],files['source/contour.png'],map.conversion);}
 }
 assert(map.artAcceptance==='pending-human-review'&&map.unitySorting==='unverified'&&report.artAcceptance==='pending-human-review'&&report.testOnly===!!map.approval.testOnly,'结果不得冒充人工/引擎验收');
 const g=map.lockedSpec.grammar,compiled=map.lockedSpec.strategy==='art-directed'?compileArtDirected(g,{materials:files['source/materials.png'],contour:files['source/contour.png']}):compileMaster(g,files['source/master.png']);
 assert(Array.isArray(map.tiles)&&map.tiles.length===47&&Array.isArray(map.variants)&&map.variants.length===(compiled.tileVariants?.length??0),'结果状态或变体数量错误');
 for(const [index,t]of compiled.tiles.entries()){const meta=map.tiles[index],file=`tiles/${t.id}.png`;assert(meta.id===t.id&&meta.mask===t.mask&&meta.path===file&&meta.sha256===sha(t.png)&&files[file]?.equals(t.png),'47态像素与母版不一致');}
 for(const [index,t]of (compiled.tileVariants??[]).entries()){const meta=map.variants[index],file=t.outputPath;assert(meta.id===t.id&&meta.variant===t.variant&&meta.path===file&&meta.sha256===sha(t.png)&&files[file]?.equals(t.png),'变体像素或文件路径不一致');}
 assert(files['atlas.png']?.equals(compiled.atlas)&&files['underlay.png']?.equals(compiled.underlay),'atlas/底层与真实编译不一致');
 const scenes=require('../grammar/catalog.cjs').testScenes();assert(Object.keys(report.scenes??{}).length===Object.keys(scenes).length&&Object.keys(scenes).every(name=>report.scenes[name]?.passed===true&&files[`scenes/${name}.png`]),'九地图结构记录缺失或失败');
 const validate=map.lockedSpec.strategy==='art-directed'?require('../grammar/art-directed-validate.cjs').validateArtCompilation:require('../grammar/validate.cjs').validateCompilation;
 for(const [name,board]of Object.entries(scenes)){const actual=validate(g,compiled,board,{approvedSample:map.approval});assert(actual.passed&&files[`scenes/${name}.png`].equals(actual.preview),'地图 PNG 与真实母版回拼不一致：'+name);}
 return {map,report,entries:records,tiles:47,variants:map.variants.length};
}
module.exports={validateOutputZip};
