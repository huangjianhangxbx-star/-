'use strict';
const {PNG}=require('pngjs');const {createHash}=require('node:crypto');const {DIRECTIONS,makeGrammar}=require('./catalog.cjs');const {isDeepStrictEqual}=require('node:util');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function assertGrammar(g){if(!g||!isDeepStrictEqual(g,makeGrammar({templateId:g.template?.id,cellPixels:g.cellPixels,ppu:g.ppu,strategy:g.strategy,...(g.strategy==='layered'?{masterPixels:g.master?.width}:{})})))throw Error('母版规则不匹配；请重新生成锁定模板');}
function decode(bytes,width,height){
 if(!Buffer.isBuffer(bytes)||bytes.length<24||bytes.length>32*1024*1024||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('不是受支持的 PNG');
 const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
 if(w!==width||h!==height)throw Error(`尺寸不符：需要 ${width}×${height}，实际 ${w}×${h}；未进行缩放`);
 try{return PNG.sync.read(bytes);}catch{throw Error('PNG 损坏或无法解码');}
}
function empty(w,h){return new PNG({width:w,height:h});}
function color(p,x,y){x=Math.max(0,Math.min(p.width-1,Math.floor(x)));y=Math.max(0,Math.min(p.height-1,Math.floor(y)));const i=(y*p.width+x)*4;return p.data.subarray(i,i+4);}
function put(p,x,y,rgba){if(x>=0&&y>=0&&x<p.width&&y<p.height)p.data.set(rgba,(y*p.width+x)*4);}
function blend(p,x,y,rgba){if(x<0||y<0||x>=p.width||y>=p.height||!rgba[3])return;const i=(y*p.width+x)*4,a=rgba[3]/255,b=p.data[i+3]/255,out=a+b*(1-a);for(let k=0;k<3;k++)p.data[i+k]=Math.round((rgba[k]*a+p.data[i+k]*b*(1-a))/out);p.data[i+3]=Math.round(out*255);}
function boundaryDistance(mask,x,y,c){
 let distance=Infinity;
 for(const [dx,dy,bit] of DIRECTIONS)if(!(mask&bit)){
  const rx=dx*c,ry=dy*c;const xx=Math.max(rx-x,0,x-(rx+c)),yy=Math.max(ry-y,0,y-(ry+c));distance=Math.min(distance,Math.hypot(xx,yy));
 }
 return distance;
}
function shapeAlpha(g,mask,x,y){
 const c=g.cellPixels;if(x<0||y<0||x>=c||y>=c)return 0;
 const d=boundaryDistance(mask,x+.5,y+.5,c),fringe=g.template.kind==='grass'?(Math.sin(x*2*Math.PI/c*7)+Math.sin(y*2*Math.PI/c*5))*c/70:0;
 return d>c/(g.template.kind==='grass'?10:13)+fringe?255:0;
}
function geometryAlpha(g,mask,x,y){
 if(g.template.kind==='grass')return shapeAlpha(g,mask,x,y);
 const sx=x*g.cellPixels/g.sprite.width,c=g.cellPixels;
 return shapeAlpha(g,mask,sx,y)||(!(mask&64)&&y>=c/2?shapeAlpha(g,mask,sx,y-c/2):0);
}
function tilePixels(g,t,source){
 const c=g.cellPixels,out=empty(g.sprite.width,g.sprite.height),ox=g.sprite.logicalRect.x;
 const pixel=(role,x,y)=>{
  if(g.strategy==='continuous')return color(source,t.sourceRect.x+((x%c+c)%c),t.sourceRect.y+((y%c+c)%c));
  const p=g.master.panels.find(p=>p.role===role);return color(source,p.x+t.sourceRect.x+((x%c+c)%c),p.y+t.sourceRect.y+((y%c+c)%c));
 };
 // Stone face is a separate dark/body material extrusion, not a grass alpha mask.
 if(g.template.kind==='stone')for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){
  const xx=x-ox,yy=y-c/2;if(shapeAlpha(g,t.mask,x*c/out.width,yy)&&!(t.mask&64)&&y>=c/2){const p=pixel('underlay',xx,yy);put(out,x,y,[...p.subarray(0,3),255]);}
 }
 for(let y=0;y<c;y++)for(let x=-ox;x<c+ox;x++)if(shapeAlpha(g,t.mask,g.template.kind==='stone'?(x+ox)*c/out.width:x,y)){
  const sx=g.template.kind==='stone'?(x+ox)*c/out.width:x,d=boundaryDistance(t.mask,sx+.5,y+.5,c),role=d<c/4?'edge':'surface';
  const p=pixel(role,x,y);put(out,x+ox,y,[...p.subarray(0,3),255]);
  // Only perimeter accents; no compulsory decorative fill on broad surfaces.
  if(g.strategy==='layered'&&g.template.kind==='grass'&&d<c/8&&((x*13+y*7)%29===0)){
   const accent=pixel('accent',x,y);put(out,x+ox,y,[...accent.subarray(0,3),255]);
  }
 }
 return out;
}
function compileMaster(g,bytes){
 assertGrammar(g);const source=decode(bytes,g.master.width,g.master.height);
 if(source.data.some((v,i)=>i%4===3&&v!==255))throw Error('母版材质区需完全不透明；输出透明轮廓由锁定蒙版生成');
 const tiles=g.tiles.map(t=>({...t,png:PNG.sync.write(tilePixels(g,t,source))}));
 const underlay=empty(g.cellPixels,g.cellPixels),base=g.strategy==='layered'?g.master.panels.find(p=>p.role==='underlay'):null;
 const rect=g.tiles[0].sourceRect;
 for(let y=0;y<underlay.height;y++)for(let x=0;x<underlay.width;x++)put(underlay,x,y,color(source,(base?base.x+rect.x:0)+x,(base?base.y+rect.y:0)+y));
 const atlas=empty(8*g.sprite.width,6*g.sprite.height);
 for(const t of tiles){const p=PNG.sync.read(t.png);PNG.bitblt(p,atlas,0,0,p.width,p.height,(t.index%8)*p.width,Math.floor(t.index/8)*p.height);}
 return {tiles,atlas:PNG.sync.write(atlas),underlay:PNG.sync.write(underlay),rawSha256:sha(bytes),rawWidth:source.width,rawHeight:source.height,artAcceptance:'pending-human-review',compilerVersion:'0.1.0'};
}
function templateImages(g){
 assertGrammar(g);const blank=empty(g.master.width,g.master.height),guide=empty(g.master.width,g.master.height),mask=empty(8*g.sprite.width,6*g.sprite.height);
 for(let y=0;y<blank.height;y++)for(let x=0;x<blank.width;x++){
  let rgba=[226,225,215,255];
  if(g.strategy==='layered'){const panel=g.master.panels.find(p=>x>=p.x&&y>=p.y&&x<p.x+p.width&&y<p.y+p.height);const colors={surface:[191,208,154,255],edge:[151,181,102,255],underlay:[109,99,84,255],accent:[213,209,162,255]};rgba=colors[panel.role];}
  else if(!g.board[Math.floor(y/g.cellPixels)]?.[Math.floor(x/g.cellPixels)])rgba=[46,50,53,255];
  put(blank,x,y,rgba);put(guide,x,y,rgba);
 }
 for(const t of g.tiles){for(let y=0;y<g.sprite.height;y++)for(let x=0;x<g.sprite.width;x++)if(geometryAlpha(g,t.mask,x,y))put(mask,(t.index%8)*g.sprite.width+x,Math.floor(t.index/8)*g.sprite.height+y,[255,255,255,255]);}
 const regions=g.strategy==='layered'?[...g.master.panels,...g.master.panels.map(p=>({...g.tiles[0].sourceRect,x:p.x+g.tiles[0].sourceRect.x,y:p.y+g.tiles[0].sourceRect.y}))]:g.tiles.map(t=>t.sourceRect);
 for(const r of regions){for(let x=r.x;x<r.x+r.width;x++){put(guide,x,r.y,[236,106,63,255]);put(guide,x,r.y+r.height-1,[236,106,63,255]);}for(let y=r.y;y<r.y+r.height;y++){put(guide,r.x,y,[236,106,63,255]);put(guide,r.x+r.width-1,y,[236,106,63,255]);}}
 return {blank:PNG.sync.write(blank),guide:PNG.sync.write(guide),mask:PNG.sync.write(mask)};
}
module.exports={assertGrammar,decode,compileMaster,templateImages,shapeAlpha,geometryAlpha,sha,empty,blend};
