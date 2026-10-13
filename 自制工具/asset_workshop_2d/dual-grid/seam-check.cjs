'use strict';
const {PNG}=require('pngjs');
const {sha}=require('../workflow/store.cjs');
const {renderBoard}=require('./compile.cjs');
function wrapMetrics(p){
 let h=0,v=0,darkH=0,darkV=0;const dark=q=>p.data[q]+p.data[q+1]+p.data[q+2]<75;
 for(let y=0;y<p.height;y++){const a=y*p.width*4,b=(y*p.width+p.width-1)*4;for(let k=0;k<3;k++)h+=Math.abs(p.data[a+k]-p.data[b+k]);if(dark(a)!==dark(b))darkH++;}
 for(let x=0;x<p.width;x++){const a=x*4,b=((p.height-1)*p.width+x)*4;for(let k=0;k<3;k++)v+=Math.abs(p.data[a+k]-p.data[b+k]);if(dark(a)!==dark(b))darkV++;}
 return{horizontalMeanAbs:h/(p.height*3),verticalMeanAbs:v/(p.width*3),horizontalDarkMismatch:darkH/p.height,verticalDarkMismatch:darkV/p.width};
}
function diagnose(compiled,grid){
 const issues=[],K=compiled.spec.period,c=compiled.spec.cellPixels,seen=new Set();
 for(const t of compiled.phaseTiles){const id=`${t.phaseX},${t.phaseY},${t.mask}`;if(!Number.isInteger(t.mask)||t.mask<0||t.mask>15||t.phaseX<0||t.phaseX>=K||t.phaseY<0||t.phaseY>=K||seen.has(id))issues.push({severity:'hard',code:'mask-mismatch',file:t.file,message:'图块状态重复或非法'});seen.add(id);if(sha(t.png)!==t.sha256)issues.push({severity:'hard',code:'phase-discontinuity',file:t.file,message:'当前图块像素不再匹配编译来源'});}
 if(seen.size!==16*K*K)issues.push({severity:'hard',code:'empty-neighbor',message:'相位/状态图块缺失'});
 // Compare raster coverage/ink on every compatible shared edge; source RGB is not averaged.
 let edgeMismatch=false;for(let a=0;a<16;a++)for(let b=0;b<16;b++)for(let n=0;n<c;n++)for(const k of ['a','ink']){
  const f=compiled.fields[a][k],g=compiled.fields[b][k];
  if((!!(a&2)===!!(b&1))&&(!!(a&8)===!!(b&4))&&f[n*c+c-1]!==g[n*c])edgeMismatch=true;
  if((!!(a&4)===!!(b&1))&&(!!(a&8)===!!(b&2))&&f[(c-1)*c+n]!==g[n])edgeMismatch=true;
 }if(edgeMismatch)issues.push({severity:'hard',code:'mask-mismatch',message:'兼容邻格的栅格覆盖或暗线不一致'});
 for(const atlas of compiled.phaseAtlases){const decoded=PNG.sync.read(atlas.png);if(!decoded.data.equals(atlas.image.data))issues.push({severity:'hard',code:'atlas-index',message:'图集缓存与PNG字节不一致'});for(let mask=0;mask<16;mask++){const tile=compiled.phaseTiles.find(t=>t.phaseX===atlas.phaseX&&t.phaseY===atlas.phaseY&&t.mask===mask);if(!tile)continue;let mismatch=false;for(let y=0;y<c;y++){const i=((Math.floor(mask/4)*c+y)*decoded.width+mask%4*c)*4;if(!decoded.data.subarray(i,i+c*4).equals(tile.image.data.subarray(y*c*4,(y+1)*c*4)))mismatch=true;}if(mismatch)issues.push({severity:'hard',code:'atlas-index',file:tile.file,message:'图集切片像素与对应mask不一致'});}}
 for(const[role,p]of Object.entries(compiled.sourceImages)){
const wrap=wrapMetrics(p);if(Math.max(wrap.horizontalMeanAbs,wrap.verticalMeanAbs)>8)issues.push({severity:'warning',code:'material-color-seam',role,sourceCoordinate:{x:p.width-1,y:p.height-1},metrics:wrap,message:'连续母图周期边界有色差；未平均修边'});if(Math.max(wrap.horizontalDarkMismatch,wrap.verticalDarkMismatch)>.05)issues.push({severity:'warning',code:'black-line-break',role,metrics:wrap,message:'周期边界黑线落点可能断裂，请看图返工'});}
 let board;try{board=renderBoard(compiled,grid);}catch(e){issues.push({severity:'hard',code:'empty-neighbor',message:e.message});}
 const counts=new Map(),coordinates=new Map();for(const p of board?.placements??[]){const t=compiled.phaseTiles[(p.phaseY*K+p.phaseX)*16+p.mask];counts.set(t.sha256,(counts.get(t.sha256)??0)+1);if(!coordinates.has(t.sha256))coordinates.set(t.sha256,[]);coordinates.get(t.sha256).push({x:p.x,y:p.y});}
 const total=board?.placements.length??0,maxRepeat=Math.max(0,...counts.values()),rate=total?maxRepeat/total:0;
 if(rate>.25&&total>=16)issues.push({severity:'warning',code:'high-repeat-rate',ratio:rate,period:K,coordinates:[...coordinates.entries()].find(([h])=>counts.get(h)===maxRepeat)?.[1]??[],message:'同一像素图块占比高；周期重复指标不代表美术评分'});
 const hard=issues.some(i=>i.severity==='hard'),seamWarnings=issues.some(i=>['material-color-seam','black-line-break'].includes(i.code));
 return{schemaVersion:'xh-dual-diagnostics/1',statuses:{topology:hard?'failed':'passed',pixelSeams:hard?'failed':seamWarnings?'warnings':'passed',art:'pending-human',unity:'unverified'},issues,repeat:{sameTileRatio:rate,uniqueTileHashes:counts.size,period:K},sourceCoverage:compiled.sourceReport,limits:{canonicalOnlyPhase:[0,0],canonicalOnlyCoverage:1/(K*K),artistEdges:'program-candidate',nonPeriodicTexture:false},mapSize:{width:grid.width,height:grid.height},spriteSize:c};
}
module.exports={diagnose,wrapMetrics};
