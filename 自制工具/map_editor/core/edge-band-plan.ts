import { appearanceColor } from './appearance-color.ts';
import { layerStack, paintSize, type PaintLayer } from './paint-layers.ts';
import { pixelKey, type SurfacePixel } from './paint-surface-domain.ts';
import { MAX_PAINT_FACES, MAX_PAINT_PIXELS, parsePaintFaceKey, validateSurfacePaint, type SurfacePaint } from './surface-paint.ts';

export type EdgeBandOptions = {
 preset:'side'|'top'|'both'|'convex';
 geometry:'asset'|'target';
 scope:'all'|'selection';
 selection?:string[];
 sideWidth:number;
 topWidth:number;
 sideColor:string;
 topColor:string;
 colorMode:'color'|'darken';
 gain:number;
 faces:number[];
 placement:'below'|'above';
};
export type EdgeBandDomain = {
 readonly canvasId:string;
 readonly objectId:string;
 readonly revision:number;
 readonly fingerprint:string;
 readonly n:number;
 readonly geometry?:'asset'|'target';
 readonly edges:readonly {axis:number;start:readonly number[];end:readonly number[];faces:readonly number[]}[];
 readonly diagnostics:Record<string,number>;
 surfaceExists(face:number,plane:number,U:number,V:number):boolean;
 pixel(face:number,plane:number,U:number,V:number):SurfacePixel|null;
 globalUV(pixel:SurfacePixel):[number,number];
 baseColor(pixel:SurfacePixel):string;
};
export type EdgeBand = {kind:'side'|'top'|'convex';name:string;faces:SurfacePaint['faces']};
export type EdgeBandPlan = {
 canvasId:string;
 objectId:string;
 revision:number;
 geometryFingerprint:string;
 resolution:number;
 options:EdgeBandOptions;
 bands:EdgeBand[];
 edgeCount:number;
 pixelCount:number;
 faceCount:number;
 coveredPixels:number;
 diagnostics:Record<string,number>;
};
export type EdgeBandGroup = {ids:string[];replace?:{ids:string[];signature:string};placement?:'below'|'above'};
type Coverage={options:EdgeBandOptions;bands:{kind:EdgeBand['kind'];pixels:SurfacePixel[]}[];edgeCount:number;pixelCount:number;faceCount:number};
// One bounded candidate set per domain; closing its worker releases both geometry and cache.
const coverageCache=new WeakMap<EdgeBandDomain,Coverage>();
const optionKeys=['preset','geometry','scope','selection','sideWidth','topWidth','sideColor','topColor','colorMode','gain','faces','placement'];
const axes=(normal:number)=>[0,1,2].filter(a=>a!==normal);
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id);
function record(value:unknown):asserts value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('结构描边参数必须是普通对象');
}
/** The same strict contract is used by worker previews and the authoritative writer. */
export function validateEdgeBandOptions(value:unknown):EdgeBandOptions {
 record(value);
 if(Object.keys(value).some(k=>!optionKeys.includes(k))||!['side','top','both','convex'].includes(value.preset as string)||!['asset','target'].includes(value.geometry as string)||!['all','selection'].includes(value.scope as string)||!['color','darken'].includes(value.colorMode as string)||!['below','above'].includes(value.placement as string))throw Error('结构描边选项无效');
 for(const k of ['sideWidth','topWidth'])if(!Number.isSafeInteger(value[k])||(value[k] as number)<1||(value[k] as number)>64)throw Error('结构描边宽度须为 1–64 个整数像素');
 for(const k of ['sideColor','topColor'])if(typeof value[k]!=='string'||!/^#[0-9a-fA-F]{6}$/.test(value[k] as string))throw Error('结构描边颜色须为 #RRGGBB');
 if(typeof value.gain!=='number'||!Number.isFinite(value.gain)||value.gain<0||value.gain>1)throw Error('结构描边压暗增益须为 0–1');
 if(!Array.isArray(value.faces)||value.faces.length>6||value.faces.some(f=>!Number.isSafeInteger(f)||f<0||f>5))throw Error('结构描边接收面方向无效');
 if(value.selection!==undefined&&(!Array.isArray(value.selection)||value.selection.length>MAX_PAINT_PIXELS))throw Error('结构描边选区预算或格式无效');
 if(value.scope==='selection'&&!Array.isArray(value.selection))throw Error('结构描边选区范围缺少冻结掩码');
 if(value.scope==='all'&&Array.isArray(value.selection)&&value.selection.length)throw Error('全部表面范围不能附带选区掩码');
 const selection:string[]=[];
 for(const item of (value.selection??[]) as unknown[]){
  if(typeof item!=='string')throw Error('结构描边选区像素无效');
  const split=item.lastIndexOf(':'),key=item.slice(0,split),index=item.slice(split+1);
  parsePaintFaceKey(key);
  if(split<0||!/^(0|[1-9]\d*)$/.test(index)||!Number.isSafeInteger(Number(index))||Number(index)>=256)throw Error('结构描边选区像素无效');
  selection.push(item);
 }
 const out={...value,sideColor:(value.sideColor as string).toLowerCase(),topColor:(value.topColor as string).toLowerCase(),faces:[...new Set(value.faces as number[])].sort((a,b)=>a-b)} as EdgeBandOptions;
 if(value.selection!==undefined)out.selection=[...new Set(selection)].sort();
 return out;
}

function sameCoverage(a:EdgeBandOptions,b:EdgeBandOptions):boolean {
 return a.preset===b.preset&&a.geometry===b.geometry&&a.scope===b.scope&&a.sideWidth===b.sideWidth&&a.topWidth===b.topWidth&&a.faces.length===b.faces.length&&a.faces.every((v,i)=>v===b.faces[i])&&(a.selection?.length??0)===(b.selection?.length??0)&&(a.selection??[]).every((v,i)=>v===b.selection?.[i]);
}
/** Enumerate only strips next to true convex edges. A mask never supplies an edge. */
function buildCoverage(domain:EdgeBandDomain,options:EdgeBandOptions):Coverage {
 const kinds:EdgeBand['kind'][]=options.preset==='both'?['side','top']:[options.preset];
 const bands=kinds.map(kind=>({kind,pixels:[] as SurfacePixel[]}));
 const acceptFaces=new Set(options.faces),mask=options.scope==='selection'?new Set(options.selection):null,faceKeys=new Set<string>();
 let edgeCount=0,pixelCount=0,work=0;
 const checked=new Set<string>();
 for(const edge of domain.edges){
  if(edge.start.length!==3||edge.end.length!==3||edge.faces.length!==2||![edge.axis,...edge.start,...edge.end,...edge.faces].every(Number.isSafeInteger)||edge.axis<0||edge.axis>2||edge.faces.some(f=>f<0||f>5)||Math.floor(edge.faces[0]/2)===Math.floor(edge.faces[1]/2)||edge.faces.some(f=>Math.floor(f/2)===edge.axis)||edge.end[edge.axis]<=edge.start[edge.axis]||edge.start.some((v,a)=>a!==edge.axis&&edge.end[a]!==v))throw Error('结构描边边段无效');
  const topEdge=edge.faces.includes(4)&&edge.faces.some(f=>f<4);
  let relevant=false;
  for(const band of bands){
   const receivers=band.kind==='convex'?edge.faces:topEdge?edge.faces.filter(f=>band.kind==='top'?f===4:f<4):[];
   for(const face of receivers){
    if(!acceptFaces.has(face))continue;
    relevant=true;
    const normal=Math.floor(face/2),other=edge.faces.find(f=>f!==face)!,inwardAxis=Math.floor(other/2),sign=other%2?1:-1,tangent=axes(normal),plane=edge.start[normal];
    const width=band.kind==='top'?options.topWidth:options.sideWidth;
    for(let along=edge.start[edge.axis];along<edge.end[edge.axis];along++){
     for(let depth=0;depth<width;depth++){
      if(++work>MAX_PAINT_PIXELS*32)throw Error('结构描边覆盖超过局部分析预算');
      const point=[...edge.start];point[edge.axis]=along;point[inwardAxis]+=sign>0?depth:-1-depth;
      const U=point[tangent[0]],V=point[tangent[1]];
      // Foreign owners may carry a continuous strip, while holes/turns terminate it.
      if(!domain.surfaceExists(face,plane,U,V))break;
      const pixel=domain.pixel(face,plane,U,V);if(!pixel)continue;
      const id=pixelKey(pixel);if(mask&&!mask.has(id))continue;
      const unique=band.kind+':'+id;if(checked.has(unique))continue;checked.add(unique);
      if(++pixelCount>MAX_PAINT_PIXELS)throw Error('结构描边像素预算超限');
      faceKeys.add(pixel.key);if(faceKeys.size>MAX_PAINT_FACES)throw Error('结构描边面预算超限');
      band.pixels.push(pixel);
     }
    }
   }
  }
  if(relevant)edgeCount++;
 }
 return {options:{...options,faces:[...options.faces],...(options.selection?{selection:[...options.selection]}:{})},bands:bands.filter(b=>b.pixels.length),edgeCount,pixelCount,faceCount:faceKeys.size};
}
/** Recoloring frozen candidates does not repeat geometry or surface queries. */
export function generateEdgeBands(domain:EdgeBandDomain,input:EdgeBandOptions,source?:SurfacePaint):EdgeBandPlan {
 const options=validateEdgeBandOptions(input),diagnostics={...domain.diagnostics};
 if(![4,8,16].includes(domain.n))throw Error('结构描边原生精度无效');
 if(domain.geometry&&domain.geometry!==options.geometry)throw Error('结构描边几何判断上下文已变化');
 if(diagnostics.ambiguous||diagnostics.nonManifold||diagnostics.overlapping)throw Error('结构描边存在归属重叠或非流形接触歧义，请调整几何后重试');
 let coverage=coverageCache.get(domain);
 if(!coverage||!sameCoverage(coverage.options,options)){coverage=buildCoverage(domain,options);coverageCache.set(domain,coverage);}
 const colors=new Map<string,string>();let coveredPixels=0;
 const bands:EdgeBand[]=coverage.bands.map(band=>{
  const faces:SurfacePaint['faces']={};
  for(const pixel of band.pixels){
   let color=band.kind==='top'?options.topColor:options.sideColor;
   if(options.colorMode==='darken'){
    const base=domain.baseColor(pixel);
    if(!/^#[0-9a-fA-F]{6}$/.test(base))throw Error('结构描边底色无效');
    color=colors.get(base)??appearanceColor(base,undefined,{gain:options.gain,affectPaint:false});colors.set(base,color);
   }
   (faces[pixel.key]??={})[pixel.index]=color;
   if(options.placement==='below'&&source?.faces[pixel.key]?.[pixel.index]!==undefined)coveredPixels++;
  }
  return {kind:band.kind,name:'结构描边 · '+({side:'侧边',top:'顶面',convex:'凸棱'}[band.kind]),faces};
 });
 return {canvasId:domain.canvasId,objectId:domain.objectId,revision:domain.revision,geometryFingerprint:domain.fingerprint,resolution:domain.n,options,bands,edgeCount:coverage.edgeCount,pixelCount:coverage.pixelCount,faceCount:coverage.faceCount,coveredPixels,diagnostics};
}

/** Exact canonical raw-layer comparison; hidden paint and stack positions are included. */
export function edgeBandLayerSignature(source:SurfacePaint|undefined,ids:string[]):string {
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>!validId(id))||new Set(ids).size!==ids.length)throw Error('结构描边生成层标识无效');
 const layers=layerStack(source);
 return JSON.stringify(ids.map(id=>{
  const index=layers.findIndex(l=>l.id===id),layer=layers[index];if(!layer)throw Error('结构描边生成层已删除或改变');
  return [index,layer.id,layer.name,layer.visible,layer.locked,Object.keys(layer.faces).sort().map(key=>[key,Object.keys(layer.faces[key]).sort((a,b)=>Number(a)-Number(b)).map(i=>[i,layer.faces[key][i]])])];
 }));
}
function equalPixels(a:Record<string,string>|undefined,b:Record<string,string>):boolean {
 return !!a&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(i=>a[i]===b[i]);
}
function equalFaces(a:SurfacePaint['faces'],b:SurfacePaint['faces']):boolean {
 return a===b||Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(key=>equalPixels(a[key],b[key]));
}
/** One complete ordinary-layer transaction. Callers own object-scope and revision checks. */
export function applyEdgeBands(source:SurfacePaint|undefined,plan:EdgeBandPlan,group:EdgeBandGroup):SurfacePaint {
 record(group);
 if(Object.keys(group).some(k=>!['ids','replace','placement'].includes(k))||!Array.isArray(group.ids)||group.ids.some(id=>!validId(id))||new Set(group.ids).size!==group.ids.length||group.ids.length!==plan.bands.length)throw Error('结构描边生成层标识无效');
 if(!plan.pixelCount||!plan.bands.length)throw Error('结构描边没有可写像素结果');
 if(![4,8,16].includes(plan.resolution))throw Error('结构描边原生精度无效');
 const placement=group.placement??plan.options.placement;if(placement!=='above'&&placement!=='below')throw Error('结构描边图层位置无效');
 if(source)validateSurfacePaint(source,plan.resolution/64);
 const original=layerStack(source),replacement=new Set<string>();
 if(group.replace!==undefined){
  record(group.replace);
  if(Object.keys(group.replace).some(k=>!['ids','signature'].includes(k))||typeof group.replace.signature!=='string')throw Error('结构描边替换条件无效');
  if(edgeBandLayerSignature(source,group.replace.ids)!==group.replace.signature)throw Error('结构描边生成层已改变，不能覆盖手修内容');
  for(const id of group.replace.ids){const layer=original.find(l=>l.id===id)!;if(layer.locked||!layer.visible)throw Error('结构描边生成层已锁定或隐藏，不能替换');replacement.add(id);}
 }
 if(group.ids.some(id=>original.some(l=>l.id===id)&&!replacement.has(id)))throw Error('结构描边生成层标识已存在');
 const kept=original.filter(l=>!replacement.has(l.id));
 const generated:PaintLayer[]=plan.bands.map((band,i)=>({id:group.ids[i],name:band.name,visible:true,locked:false,faces:band.faces}));
 if(kept.length+generated.length>32)throw Error('结构描边需要的图层位置超过 32 层预算');
 const layers=placement==='below'?[...generated,...kept]:[...kept,...generated];
 const size=paintSize({schema:'xinghai-surface-paint-1',density:64,faces:{},layers});
 if(size.pixels>MAX_PAINT_PIXELS||size.faces>MAX_PAINT_FACES)throw Error('结构描边与隐藏图层原稿总预算超限');
 // Canonical equality ignores harmless serialized property order.
 if(source?.layers&&layers.length===source.layers.length&&layers.every((l,i)=>{const old=source.layers![i];return l.id===old.id&&l.name===old.name&&l.visible===old.visible&&l.locked===old.locked&&equalFaces(l.faces,old.faces);}))return source;
 // Recompose touched faces only. Untouched GPU textures retain their source references.
 const faces={...source?.faces},dirty=new Set(plan.bands.flatMap(b=>Object.keys(b.faces)));
 for(const layer of original)if(replacement.has(layer.id))for(const key of Object.keys(layer.faces))dirty.add(key);
 for(const key of dirty){
  const pixels:Record<string,string>={};for(const layer of layers)if(layer.visible)Object.assign(pixels,layer.faces[key]);
  if(equalPixels(source?.faces[key],pixels))continue;
  if(Object.keys(pixels).length)faces[key]=pixels;else delete faces[key];
 }
 const result:SurfacePaint={schema:'xinghai-surface-paint-1',density:64,faces,layers};
 validateSurfacePaint(result,plan.resolution/64);
 return result;
}
