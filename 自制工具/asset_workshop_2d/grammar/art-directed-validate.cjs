'use strict';
const {PNG}=require('pngjs');
const {maskAt}=require('./catalog.cjs');
const {decode,empty,blend,sha}=require('./compile.cjs');
const {assertArtGrammar,artAlpha}=require('./art-directed.cjs');
function variantAt(g,x,y){let h=(g.seed^Math.imul(x+1,73856093)^Math.imul(y+1,19349663))>>>0;h=Math.imul(h^(h>>>16),0x45d9f3b)>>>0;return ((h^(h>>>16))>>>0)%g.variantCount;}
function validateArtCompilation(g,result,board,{underlay=true,grid=false,pivot=false,alpha=false,overhang=false,sort='back-to-front',approvedSample=null,stale=false}={}){
 assertArtGrammar(g);
 if(!Array.isArray(board)||!board.length||board.length>32||!Array.isArray(board[0])||!board[0].length||board[0].length>32||board.some(row=>!Array.isArray(row)||row.length!==board[0].length||row.some(v=>v!==0&&v!==1)))throw Error('地图需为最多32×32的矩形0/1网格');
 const c=g.cellPixels,pad=Math.max(g.sprite.overhang.left,g.sprite.overhang.top),w=board[0].length*c+2*pad,h=board.length*c+2*pad;
 if(w*h>16*1024*1024)throw Error('地图超出16MP预览像素预算；请显式减小格边，未缩放产物');
 const issues=[],images=new Map(),defs=new Map(g.tiles.map(t=>[t.mask,t])),sources=result.tileVariants||[],canonical=new Set();
 if(result.grammarSha256!==sha(Buffer.from(JSON.stringify(g))))issues.push({code:'compiled-spec-mismatch',severity:'hard',message:'编译结果不属于当前锁定模板/尺寸/PPU/种子；必须重新编译'});
 let control;try{control=decode(result.controlPng,g.control.width,g.control.height);if(sha(result.controlPng)!==result.controlSha256)throw Error('轮廓原图SHA不符');}catch(e){issues.push({code:'invalid-control',severity:'hard',message:e.message});}
 const issue=(data)=>{if(issues.length<160)issues.push(data);};
 for(const t of result.tiles||[]){if(!defs.has(t.mask)||canonical.has(t.mask)){issue({code:'invalid-mask',severity:'hard',mask:t.mask,message:'47态索引重复或未知'});continue;}canonical.add(t.mask);}
 for(const t of g.tiles)if(!canonical.has(t.mask))issue({code:'missing-state',severity:'hard',mask:t.mask,tileId:t.id,sourceRect:t.sourceRect});
 for(const t of sources){
  const key=`${t.mask}:${t.variant}`;
  if(!defs.has(t.mask)||!Number.isInteger(t.variant)||t.variant<0||t.variant>=g.variantCount||images.has(key)){issue({code:'invalid-variant',severity:'hard',mask:t.mask,variant:t.variant});continue;}
  try{
   const p=decode(t.png,g.sprite.width,g.sprite.height);images.set(key,{p,t});
   if(control){let mismatch=0;for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3]!==artAlpha(g,t.mask,x,y,control,(t.variant+t.mask)%2))mismatch++;
    if(mismatch)issue({code:'alpha-shape',severity:'hard',mask:t.mask,variant:t.variant,sourceRect:t.sourceRect,sourcePatches:t.sourcePatches,message:`透明轮廓偏离艺术控制层 ${mismatch} 像素`});}
  }catch(e){issue({code:'invalid-png',severity:'hard',mask:t.mask,variant:t.variant,sourceRect:t.sourceRect,message:e.message});}
 }
 for(const t of result.tiles||[]){const variant=images.get(`${t.mask}:0`);if(variant&&(!Buffer.isBuffer(t.png)||sha(t.png)!==sha(variant.t.png)))issue({code:'canonical-variant-mismatch',severity:'hard',mask:t.mask,tileId:t.id,sourceRect:t.sourceRect,message:'47态主PNG与真实variant0不一致；拒绝用其他变体掩盖主产物损坏'});}
 for(const t of g.tiles)for(let variant=0;variant<g.variantCount;variant++)if(!images.has(`${t.mask}:${variant}`))issue({code:'missing-variant',severity:'hard',mask:t.mask,variant,tileId:t.id});
 const placements=[];
 for(let y=0;y<board.length;y++)for(let x=0;x<board[0].length;x++)if(board[y][x]){
  const mask=maskAt(board,x,y),variant=variantAt(g,x,y)%g.variantCount,entry=images.get(`${mask}:${variant}`),tile=entry?.t||defs.get(mask);
  const item={cell:{x,y},mask,variant,tileId:tile.id,filename:`variants/${tile.id}-v${variant}.png`,sourceRect:tile.sourceRect,sourcePatches:tile.sourcePatches||[],approvedSample,stale,
   world:{x:x*g.worldCellSize,y:-y*g.worldCellSize},origin:{x:pad+x*c-g.sprite.logicalRect.x,y:pad+y*c-g.sprite.logicalRect.y}};
  placements.push(item);if(!entry)issue({code:'missing-cell-output',severity:'hard',...item,message:'此地图位置缺少真实编译PNG，不替代为邻近图块'});
 }
 const byCell=new Map(placements.map(p=>[`${p.cell.x},${p.cell.y}`,p]));let inspectedEdgePixels=0,cornerPixels=0;
 for(const item of placements)for(const [dx,dy] of [[1,0],[0,1]]){
  const neighbor=byCell.get(`${item.cell.x+dx},${item.cell.y+dy}`);if(!neighbor)continue;
  const a=images.get(`${item.mask}:${item.variant}`)?.p,b=images.get(`${neighbor.mask}:${neighbor.variant}`)?.p;if(!a||!b)continue;
  let gaps=0,deltas=0,worst=0,gapPixel=null,seamPixel=null,cornerDifference=0;
  for(let q=0;q<c;q++){
   // Top-plane logical edge uses source phase, with stone overhang / top
   // extrusion interpreted separately from the unverified renderer ordering.
   const stone=g.template.kind==='stone',ax=dx?(stone?g.sprite.logicalRect.x+c-1:c-1):(stone?g.sprite.logicalRect.x+q:q),ay=dy?c-1:q,bx=dx?(stone?g.sprite.logicalRect.x:0):(stone?g.sprite.logicalRect.x+q:q),by=dy?0:q;
   const ai=(ay*a.width+ax)*4,bi=(by*b.width+bx)*4,aa=a.data[ai+3],ba=b.data[bi+3],corner=q<g.control.maximumInset||q>=c-g.control.maximumInset;
   inspectedEdgePixels++;if(corner)cornerPixels++;
   if(!corner&&(!aa||!ba)){gaps++;gapPixel||={x:ax,y:ay};}
   else if(corner&&aa!==ba)cornerDifference++;
   if(aa&&ba){let delta=0;for(let k=0;k<3;k++)delta+=Math.abs(a.data[ai+k]-b.data[bi+k]);delta/=3;deltas+=delta;if(delta>worst){worst=delta;seamPixel={x:ax,y:ay};}}
  }
  const location={cell:item.cell,neighbor:neighbor.cell,mask:item.mask,variant:item.variant,tileId:item.tileId,filename:item.filename,sourceRect:item.sourceRect,sourcePatches:item.sourcePatches,approvedSample};
  if(gaps)issue({code:'alpha-gap',severity:'hard',...location,pixel:gapPixel,message:`公共边有${gaps}个非角部透明缺口`});
  if(worst>45)issue({code:'material-seam',severity:'warning',...location,pixel:seamPixel,message:`完整公共边最大RGB平均色差${worst.toFixed(1)}，需查看原图；程序未平均修补`});
  if(cornerDifference)issue({code:'corner-transition',severity:'human-check',...location,message:`角部${cornerDifference}像素透明状态不同；结合内外角地图审阅`});
 }
 const out=empty(w,h);
 if(underlay&&result.underlay){try{const base=decode(result.underlay,c,c);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=((((y-pad)%c+c)%c)*c+((x-pad)%c+c)%c)*4;out.data.set(base.data.subarray(i,i+4),(y*w+x)*4);}}catch(e){issue({code:'invalid-underlay',severity:'hard',message:e.message});}}
 const ordered=sort==='front-to-back'?[...placements].reverse():placements;
 for(const item of ordered){const p=images.get(`${item.mask}:${item.variant}`)?.p;if(!p)continue;for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)blend(out,item.origin.x+x,item.origin.y+y,p.data.subarray((y*p.width+x)*4,(y*p.width+x)*4+4));}
 if(grid)for(let y=pad;y<h-pad;y++)for(let x=pad;x<w-pad;x++)if((x-pad)%c===0||(y-pad)%c===0)blend(out,x,y,[160,174,126,150]);
 if(pivot)for(const item of placements)for(let k=-4;k<=4;k++){blend(out,pad+item.cell.x*c+c/2+k,pad+item.cell.y*c+c/2,[255,99,66,255]);blend(out,pad+item.cell.x*c+c/2,pad+item.cell.y*c+c/2+k,[255,99,66,255]);}
 if(overhang)for(const item of placements){const {x,y}=item.origin;for(let q=0;q<g.sprite.width;q++){blend(out,x+q,y,[240,156,108,200]);blend(out,x+q,y+g.sprite.height-1,[240,156,108,200]);}for(let q=0;q<g.sprite.height;q++){blend(out,x,y+q,[240,156,108,200]);blend(out,x+g.sprite.width-1,y+q,[240,156,108,200]);}}
 if(alpha)for(let i=0;i<out.data.length;i+=4)out.data.set([out.data[i+3],out.data[i+3],out.data[i+3],255],i);
 const fullCenters=placements.filter(p=>p.mask===255),counts=new Map();for(const p of fullCenters){const hash=sha(images.get(`${p.mask}:${p.variant}`)?.t.png||Buffer.alloc(0));counts.set(hash,(counts.get(hash)||0)+1);}
 const n=fullCenters.length,maxCount=Math.max(0,...counts.values()),centerPatchIds=new Set(fullCenters.flatMap(p=>p.sourcePatches.filter(r=>r.role.startsWith('surface-')).map(r=>r.id)));
 const repeatDiagnostics={method:'exact compiled center PNG SHA frequency (not perceived quality)',centerCells:n,uniqueCenterOutputs:counts.size,centerPatchCount:centerPatchIds.size,mostFrequentRatio:n?maxCount/n:0,largestRepeatedCount:maxCount};
 if(n>=8&&repeatDiagnostics.mostFrequentRatio>.6)issue({code:'repeated-center',severity:'warning',cell:fullCenters[0].cell,mask:255,sourceRect:fullCenters[0].sourceRect,message:`${maxCount}/${n}个全连接中心重复同一PNG；需人工评价`});
 issue({code:'art-review',severity:'human-check',message:'接缝观感、材质、轮廓与大地图重复仍待人工美术验收'});
 if(g.template.kind==='stone')issue({code:'unity-sorting-unverified',severity:'human-check',message:'石质越格/暗面为候选；Unity排序与遮挡尚未实机验证'});
 return {passed:issues.every(i=>i.severity!=='hard'),coverage:canonical.size,variantCoverage:images.size,issues,placements,preview:PNG.sync.write(out),repeatDiagnostics,edgeDiagnostics:{inspectedEdgePixels,cornerPixels,scope:'full shared edges plus inner/outer corner transitions'},artAcceptance:'pending-human-review',sortingVerified:false,stale};
}
module.exports={validateArtCompilation,variantAt};
