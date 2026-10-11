'use strict';
const {PNG}=require('pngjs');const {maskAt}=require('./catalog.cjs');const {assertGrammar,decode,empty,blend,geometryAlpha}=require('./compile.cjs');
function validateCompilation(g,result,board,{underlay=true,grid=false,pivot=false,alpha=false,overhang=false,sort='back-to-front'}={}){
 assertGrammar(g);if(!Array.isArray(board)||!board.length||board.length>32||!Array.isArray(board[0])||board[0].length<1||board[0].length>32||board.some(row=>!Array.isArray(row)||row.length!==board[0].length||row.some(v=>v!==0&&v!==1)))throw Error('地图需为最多 32×32 的矩形 0/1 网格');
 const padding=Math.max(g.sprite.overhang.left,g.sprite.overhang.top);
 if((board[0].length*g.cellPixels+2*padding)*(board.length*g.cellPixels+2*padding)>16*1024*1024)throw Error('地图超出16MP预览像素预算；请选择较小地图或显式减小逻辑格，产物不会自动缩放');
 const issues=[],images=new Map(),c=g.cellPixels;const defs=new Map(g.tiles.map(t=>[t.mask,t]));
 for(const t of result.tiles){if(!defs.has(t.mask)||images.has(t.mask)){issues.push({code:'invalid-mask',mask:t.mask,cell:null,sourceRect:null});continue;}try{const p=decode(t.png,g.sprite.width,g.sprite.height);images.set(t.mask,p);let mismatches=0;for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3]!==geometryAlpha(g,t.mask,x,y))mismatches++;if(mismatches)issues.push({code:'alpha-shape',mask:t.mask,cell:null,sourceRect:defs.get(t.mask).sourceRect,message:`透明轮廓偏离锁定蒙版 ${mismatches} 像素`});}catch(e){issues.push({code:'invalid-png',mask:t.mask,message:e.message,cell:null,sourceRect:defs.get(t.mask)?.sourceRect});}}
 for(const t of g.tiles)if(!images.has(t.mask))issues.push({code:'missing-state',mask:t.mask,tileId:t.id,cell:null,sourceRect:t.sourceRect});
 const pad=Math.max(g.sprite.overhang.left,g.sprite.overhang.top),out=empty(board[0].length*c+2*pad,board.length*c+2*pad),placements=[];
 for(let y=0;y<board.length;y++)for(let x=0;x<board[0].length;x++)if(board[y][x]){
  const mask=maskAt(board,x,y),t=defs.get(mask),p=images.get(mask),cell={x,y},sourceRect=t.sourceRect;
  placements.push({cell,world:{x:x*g.worldCellSize,y:-y*g.worldCellSize},mask,tileId:t.id,sourceRect,origin:{x:pad+x*c-g.sprite.logicalRect.x,y:pad+y*c-g.sprite.logicalRect.y}});
  if(!p)issues.push({code:'missing-cell-output',cell,mask,tileId:t.id,sourceRect,message:'这个地图位置没有可用的真实编译 PNG'});
  if(p&&g.template.kind==='grass')for(const [dx,dy] of [[1,0],[0,1]])if(board[y+dy]?.[x+dx]){
   const neighbor=images.get(maskAt(board,x+dx,y+dy));if(!neighbor)continue;
   let gaps=0,colorDelta=0;
   for(let q=Math.floor(c/3);q<Math.ceil(c*2/3);q++){
    const ai=((dy?c-1:q)*p.width+(dx?c-1:q))*4,bi=((dy?0:q)*neighbor.width+(dx?0:q))*4;
    if(!p.data[ai+3]||!neighbor.data[bi+3])gaps++;
    for(let k=0;k<3;k++)colorDelta+=Math.abs(p.data[ai+k]-neighbor.data[bi+k]);
   }
   if(gaps)issues.push({code:'alpha-gap',cell,mask,tileId:t.id,sourceRect,message:`连接边有 ${gaps} 个透明缺口`});
   if(colorDelta/(Math.ceil(c*2/3)-Math.floor(c/3))/3>45)issues.push({code:'material-seam',severity:'warning',cell,mask,tileId:t.id,sourceRect,message:'材质边界色差明显；结构联通不等于美术无缝'});
  }
 }
 if(underlay&&result.underlay){const base=decode(result.underlay,c,c);for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const i=(((y-pad+c)%c)*c+(x-pad+c)%c)*4;out.data.set(base.data.subarray(i,i+4),(y*out.width+x)*4);}}
 if(sort==='front-to-back')placements.reverse();
 for(const item of placements){const p=images.get(item.mask);if(!p)continue;for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)blend(out,item.origin.x+x,item.origin.y+y,p.data.subarray((y*p.width+x)*4,(y*p.width+x)*4+4));}
 if(grid)for(let y=pad;y<out.height-pad;y++)for(let x=pad;x<out.width-pad;x++)if((x-pad)%c===0||(y-pad)%c===0)blend(out,x,y,[155,169,121,150]);
 if(pivot)for(const item of placements)for(let k=-4;k<=4;k++){blend(out,pad+item.cell.x*c+c/2+k,pad+item.cell.y*c+c/2,[255,99,66,255]);blend(out,pad+item.cell.x*c+c/2,pad+item.cell.y*c+c/2+k,[255,99,66,255]);}
 if(overhang)for(const item of placements){const {x,y}=item.origin,w=g.sprite.width,h=g.sprite.height;for(let k=0;k<w;k++){blend(out,x+k,y,[240,156,108,220]);blend(out,x+k,y+h-1,[240,156,108,220]);}for(let k=0;k<h;k++){blend(out,x,y+k,[240,156,108,220]);blend(out,x+w-1,y+k,[240,156,108,220]);}}
 if(alpha)for(let i=0;i<out.data.length;i+=4){const value=out.data[i+3];out.data.set([value,value,value,255],i);}
 return {passed:issues.every(i=>i.severity==='warning'),coverage:images.size,issues,placements,preview:PNG.sync.write(out),artAcceptance:'pending-human-review',sortingVerified:false};
}
module.exports={validateCompilation};
