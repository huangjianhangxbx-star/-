'use strict';
const {PNG}=require('pngjs'),{isDeepStrictEqual}=require('node:util');
const {sha,canonical}=require('../workflow/store.cjs');
const {compile,renderBoard,externalAtlas}=require('./compile.cjs');
const {stateTable,unityCell}=require('./mapping.cjs');
const {validateSource}=require('./source.cjs');
const {diagnose}=require('./seam-check.cjs');
const {caseGrid}=require('./fixtures.cjs');
const {buildDualTask}=require('../workflow/package-dualgrid.cjs');
const {signFiles,readSigned,json}=require('./archive.cjs');
const assert=(ok,text)=>{if(!ok)throw Error(text);};
function buildDualResult({guard,spec,sources,grid}={},key){
 for(const r of ['A','B'])validateSource(sources[r].original,sources[r].bytes,sources[r].metadata,spec);
 const compiled=compile(spec,{A:sources.A.bytes,B:sources.B.bytes}),diagnostics=diagnose(compiled,grid);assert(diagnostics.statuses.topology==='passed','当前16态结构未通过');const task=buildDualTask({guard,spec},key).spec,c=spec.cellPixels,K=spec.period;
 const files={'input/approved-reference.png':guard.sample.bytes,'atlas.png':compiled.atlasPng,'preview.png':renderBoard(compiled,grid).png,'diagnostics.json':json(diagnostics),'unity/canonical16-atlas.png':compiled.atlasPng,'unity/skner-atlas.png':externalAtlas(compiled)};
 for(const r of ['A','B']){files[`source/${r}-original.png`]=sources[r].original;files[`source/${r}-input.png`]=sources[r].bytes;files[`source/${r}-processing.json`]=json(sources[r].metadata);}
 for(const t of compiled.canonical)files[t.file]=t.png;for(const a of compiled.phaseAtlases)files[`phase-atlases/${a.phaseX}-${a.phaseY}.png`]=a.png;
 for(const name of ['single','line','cross','L','T','U','hole','island','checker','border'])files[`scenes/${name}.png`]=renderBoard(compiled,caseGrid(name,8)).png;
 for(const n of [3,8,16])files[`scenes/full-${n}.png`]=renderBoard(compiled,caseGrid('full',n)).png;
 const mapping=stateTable().map(row=>({...row,atlasRect:{x:row.atlas.column*c,y:row.atlas.row*c,width:c,height:c},unityCanonicalSlice:{x:row.atlas.column*c,y:(3-row.atlas.row)*c,width:c,height:c},unityExternalSprite:`dual_${row.externalIndex}`}));
 const phaseMapping=compiled.phaseTiles.map(t=>({mask:t.mask,phaseX:t.phaseX,phaseY:t.phaseY,atlasFile:`phase-atlases/${t.phaseX}-${t.phaseY}.png`,atlasRect:{x:t.mask%4*c,y:Math.floor(t.mask/4)*c,width:c,height:c},pngSha256:t.sha256,sourceRect:t.sourceRect}));
 const map={schemaVersion:'xh-dual-output/1',task,specHash:sha(Buffer.from(canonical(spec))),grid,mapping,phaseMapping,coverage:{...compiled.sourceReport,A:{...compiled.sourceReport.A,originalCoverage:sources.A.metadata.coverage,sourceWindow:sources.A.metadata.window},B:{...compiled.sourceReport.B,originalCoverage:sources.B.metadata.coverage,sourceWindow:sources.B.metadata.window}},sourceProcessing:{A:sources.A.metadata,B:sources.B.metadata},statuses:diagnostics.statuses,canonicalLimit:'phase0-only; finite-repetition compatibility downgrade',recommendedRenderer:'world-coordinate phase atlas',artAcceptance:'pending-human',unityStatus:'unverified'};
 files['map.json']=json(map);files['unity/mapping.json']=json({schemaVersion:'xh-dual-unity/1',cellPixels:c,ppu:spec.ppu,pivot:[.5,.5],dataCellIndex:'[x,-y-1]',renderCellIndex:'[x,-y]',renderTilemapLocalOffset:[-c/(2*spec.ppu),-c/(2*spec.ppu)],map:mapping,externalReferences:{jess:'c9f948dfffbfcd9818c765f6653c648684ffaf99',skner:'493500b6ac59f5713b7d9d9bdff6d6a37016da78'},runtime:'unverified'});
 files['unity/README.md']=Buffer.from(`# Unity静态接入资料\n\nSprite Mode Multiple，4×4切割canonical16-atlas.png；Keep Empty Rects，Pivot(.5,.5)，PPU ${spec.ppu}。像素验证用Point；Bilinear需另做atlas padding/extrusion，不修改源图来掩盖接缝。canonical只有phase0，不能还原完整连续母图的大地图；推荐自定义renderer按world坐标mod${K}读取phase-atlases。skner-atlas.png已按固定规则索引重排，Sprite名字必须按mapping.json的dual_N明确对应；不假设编辑器自动编号方向。只验证静态映射，没有Unity实机。Data(x,-y-1)、Render(x,-y)，单位c/PPU，Render偏移(-c/2PPU,-c/2PPU)。\n`);
 return{map,compiled,diagnostics,...signFiles(files,'xh-dual-output/1',key)};
}
function validateDualResult(bytes){
 const {files,manifest}=readSigned(bytes,'xh-dual-output/1');let map;try{map=JSON.parse(files['map.json']);}catch{throw Error('结果map权威缺失');}
 assert(map.schemaVersion==='xh-dual-output/1'&&map.task?.referenceBinding,'结果权威版本错误');const b=map.task.referenceBinding,guard={taskId:map.task.taskId,spec:b.baseSpec,specHash:b.baseSpecHash,sample:{...b.sample,bytes:files['input/approved-reference.png']},approval:b.approval,formReview:b.formReview};
 const sources={};for(const r of ['A','B'])sources[r]={original:files[`source/${r}-original.png`],bytes:files[`source/${r}-input.png`],metadata:map.sourceProcessing[r]};
 const rebuilt=buildDualResult({guard,spec:map.task.dualGrid,sources,grid:map.grid});assert(isDeepStrictEqual(rebuilt.map,map)&&Object.keys(files).length===Object.keys(rebuilt.files).length,'结果权威/映射/覆盖记录不一致');for(const[n,v]of Object.entries(rebuilt.files))if(n!=='manifest.json')assert(files[n]?.equals(v),'结果像素/来源/atlas不一致：'+n);
 return{map,manifest,tiles:16,phases:map.task.dualGrid.period**2,phaseStates:map.phaseMapping.length};
}
module.exports={buildDualResult,validateDualResult};
