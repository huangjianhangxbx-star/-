'use strict';
const {PNG}=require('pngjs'),{isDeepStrictEqual}=require('node:util'),{sha}=require('../workflow/store.cjs');
const {assertLockedSpec}=require('../workflow/package-v8.cjs'),{validateArtLayer}=require('./art-directed.cjs');
const assert=(ok,message)=>{if(!ok)throw Error(message);};
function defaultParameters(spec){const c=spec.grammar.cellPixels;return{explicit:true,phasePolicy:'source-frame-duplication-v1',contour:{inset:0,darkStrength:0},rects:Array.from({length:8},(_,i)=>({x:(i%4)*c,y:Math.floor(i/4)*c,width:c,height:c}))};}
function adaptArtSource(spec,bytes,parameters){
 assertLockedSpec(spec);assert(Buffer.isBuffer(bytes),'绘画原稿需要实际PNG字节');require('../workflow/session.cjs').decodeSample(bytes,{sampleStage:false});
 assert(parameters?.explicit===true,'技术编排需要明确同意取样与公共边框政策，不自动改图');
 assert(Object.keys(parameters).every(k=>['explicit','phasePolicy','contour','rects'].includes(k))&&parameters.phasePolicy==='source-frame-duplication-v1','未知公共边框编排政策');
 const c=spec.grammar.cellPixels,p=PNG.sync.read(bytes),rects=parameters.rects,n=parameters.contour;
 assert(n&&Object.keys(n).length===2&&Number.isInteger(n.inset)&&n.inset>=0&&n.inset<=255&&Number.isInteger(n.darkStrength)&&n.darkStrength>=0&&n.darkStrength<=192,'数值模板只允许inset0–255/darkStrength0–192');
 assert(Array.isArray(rects)&&rects.length===8,'需要八个真实绘画取样窗口，不复制单张中心图');
 for(let i=0;i<8;i++){const r=rects[i];assert(r&&Object.keys(r).length===4&&['x','y','width','height'].every(k=>Number.isSafeInteger(r[k]))&&r.width===c&&r.height===c,'取样窗必须为一格原像素，不缩放');assert(r.x>=0&&r.y>=0&&r.x+c<=p.width&&r.y+c<=p.height,'取样窗越界，原稿尺寸不符；请让Agent返回准确窗口或精确排布图');for(let j=0;j<i;j++){const q=rects[j];assert(r.x>=q.x+c||q.x>=r.x+c||r.y>=q.y+c||q.y>=r.y+c,'不同材料窗口不得重叠；禁止复制同一中心图代替边角');}}
 const materials=new PNG({width:4*c,height:2*c}),contour=new PNG({width:2*c,height:c});
 const pixel=(x,y)=>p.data.subarray((y*p.width+x)*4,(y*p.width+x)*4+4);
 for(const[i,r]of rects.entries())for(let y=0;y<c;y++)for(let x=0;x<c;x++){const rgba=pixel(r.x+x,r.y+y);assert(rgba[3]===255,'绘画取样含透明像素；不能自动抠图或转为不透明');materials.data.set(rgba,((Math.floor(i/4)*c+y)*materials.width+(i%4)*c+x)*4);}
 const centerHashes=rects.slice(0,4).map(r=>{const q=new PNG({width:c,height:c});PNG.bitblt(p,q,r.x,r.y,c,c,0,0);return sha(PNG.sync.write(q));});
 assert(new Set(centerHashes).size>1,'四个中心材料完全相同；请绘制连续组织与真实变体，不复制同一块');
 const e=rects[4];for(const i of [4,5]){const ox=(i%4)*c,oy=Math.floor(i/4)*c;for(let q=0;q<c;q++)for(let d=0;d<2;d++){
  for(const y of [d,c-1-d])materials.data.set(pixel(e.x+q,e.y+d),((oy+y)*materials.width+ox+q)*4);
  for(const x of [d,c-1-d])materials.data.set(pixel(e.x+d,e.y+q),((oy+q)*materials.width+ox+x)*4);
 }for(const x of [0,1,c-2,c-1])for(const y of [0,1,c-2,c-1])materials.data.set(pixel(e.x,e.y),((oy+y)*materials.width+ox+x)*4);}
 for(let i=0;i<contour.data.length;i+=4)contour.data.set([n.inset,n.darkStrength,0,255],i);
 const materialBytes=PNG.sync.write(materials),contourBytes=PNG.sync.write(contour);validateArtLayer(spec.grammar,'materials',materialBytes);validateArtLayer(spec.grammar,'contour',contourBytes);
 const report={schemaVersion:'single-art-adapter/1',specHash:require('../workflow/package.cjs').specHash(spec),sourceSha256:sha(bytes),sourceWidth:p.width,sourceHeight:p.height,sourceBytes:bytes.length,parameters:JSON.parse(JSON.stringify(parameters)),patches:spec.grammar.master.patches.map((r,i)=>({role:r.role,sourceRect:rects[i],outputRect:r})),centerUniqueCount:new Set(centerHashes).size,centerPatchHashes:centerHashes,phase:{policy:parameters.phasePolicy,sourcePatch:'edge-0',horizontalRows:2,verticalColumns:2,cornerSource:{x:e.x,y:e.y},operations:'literal source-pixel re-location; no scaling/rotation/mirroring/averaging'},contour:{source:'explicit-program-template',preservesArtistSilhouette:false,inset:n.inset,darkStrength:n.darkStrength},outputHashes:{materials:sha(materialBytes),contour:sha(contourBytes)},artAcceptance:'pending-human-review',unitySorting:'unverified'};
 return{materials:materialBytes,contour:contourBytes,report};
}
function validateConversion(spec,source,materials,contour,report){const rebuilt=adaptArtSource(spec,source,report?.parameters);assert(isDeepStrictEqual(rebuilt.report,report)&&rebuilt.materials.equals(materials)&&rebuilt.contour.equals(contour),'来源或转换记录与实际绘画像素不一致');return report;}
module.exports={adaptArtSource,validateConversion,defaultParameters};
