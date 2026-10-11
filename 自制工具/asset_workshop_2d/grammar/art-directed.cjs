'use strict';
// Separate candidate compiler. The classic /1 grammar and cutter remain immutable.
const {PNG}=require('pngjs');
const {isDeepStrictEqual}=require('node:util');
const {makeGrammar,DIRECTIONS}=require('./catalog.cjs');
const {decode,empty,sha}=require('./compile.cjs');
function makeArtGrammar({templateId='XH-GRASS-8COND-01',cellPixels=128,ppu=100,seed=17}={}){
 const base=makeGrammar({templateId,cellPixels,ppu});
 if(cellPixels>256)throw Error('art-directed 188变体超出内存预算；请显式选择不超过256px的格边，未自动缩放');
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('变化种子需为 0–4294967295 整数');
 const c=cellPixels,roles=['surface-0','surface-1','surface-2','surface-3','edge-0','edge-1','underlay','dark'];
 const patches=roles.map((role,i)=>({id:role,role,x:(i%4)*c,y:Math.floor(i/4)*c,width:c,height:c}));
 return {...base,schemaVersion:'2dw-art-grammar/1',strategy:'art-directed',seed,variantCount:4,
  master:{width:4*c,height:2*c,filename:'materials.png',alpha:'opaque-required',patches,panels:patches,maxAiRegionEdge:4096},
  control:{width:2*c,height:c,filename:'contour.png',alpha:'opaque-required',patches:[0,1].map(i=>({id:`contour-${i}`,role:'contour',x:i*c,y:0,width:c,height:c})),
   channels:{R:'0–255 maps to bounded open-edge inset',G:'0–192 blends the real dark patch',B:'0 required',A:'255 required'},minimumInset:Math.max(1,Math.floor(c/32)),maximumInset:Math.max(2,Math.floor(c/8))},
  phase:{sharedBorderPixels:2,edgePatch:'edge-0',rule:'Opposite sides and both edge patches share an identical 2-pixel frame; no rotation, scaling or averaging'},
  tiles:base.tiles.map(t=>({...t,sourceRect:{x:0,y:0,width:c,height:c}})),
  locked:['dimensions','patch-coordinates','neighbor-bits','pivot','overhang','shared-edge-phase','control-channels'],
  drawable:['four-center-variants','two-open-edge-variants','bounded-open-edge-contour','painted-dark-blocks'],sorting:{...base.sorting,unityStatus:'unverified'},artAcceptance:'pending-human-review'};
}
function assertArtGrammar(g){
 if(!g||!isDeepStrictEqual(g,makeArtGrammar({templateId:g.template?.id,cellPixels:g.cellPixels,ppu:g.ppu,seed:g.seed})))throw Error('艺术母版规格不匹配；请重新锁定格式');
}
const pixel=(p,x,y)=>p.data.subarray((y*p.width+x)*4,(y*p.width+x)*4+4);
function patchAt(p,rect,x,y){const xx=((Math.floor(x)%rect.width)+rect.width)%rect.width,yy=((Math.floor(y)%rect.height)+rect.height)%rect.height;return pixel(p,rect.x+xx,rect.y+yy);}
function patchBytes(p,r){const out=empty(r.width,r.height);PNG.bitblt(p,out,r.x,r.y,r.width,r.height,0,0);return PNG.sync.write(out);}
function boundaryDistance(mask,x,y,c){
 let d=Infinity;for(const [dx,dy,bit] of DIRECTIONS)if(!(mask&bit)){const rx=dx*c,ry=dy*c;d=Math.min(d,Math.hypot(Math.max(rx-x,0,x-(rx+c)),Math.max(ry-y,0,y-(ry+c))));}return d;
}
function capAlpha(g,mask,x,y,control,variant=0){
 if(x<0||y<0||x>=g.cellPixels||y>=g.cellPixels)return 0;
 const r=patchAt(control,g.control.patches[variant%2],x,y)[0],inset=g.control.minimumInset+Math.round(r*(g.control.maximumInset-g.control.minimumInset)/255);
 return boundaryDistance(mask,x+.5,y+.5,g.cellPixels)>inset?255:0;
}
function artAlpha(g,mask,x,y,control,variant=0){
 const c=g.cellPixels,sx=g.template.kind==='stone'?Math.floor(x*c/g.sprite.width):x;
 return capAlpha(g,mask,sx,y,control,variant)||(g.template.kind==='stone'&&!(mask&64)&&y>=c/2?capAlpha(g,mask,sx,y-c/2,control,variant):0);
}
function readArtLayer(g,role,bytes){
 if(!['materials','contour'].includes(role))throw Error('未知正式层角色；仅允许materials或contour');
 const rect=role==='materials'?g.master:g.control,p=decode(bytes,rect.width,rect.height);
 if(p.data.some((v,i)=>i%4===3&&v!==255))throw Error('正式材质与轮廓控制层必须完全不透明');
 if(role==='contour'){
  for(let i=0;i<p.data.length;i+=4)if(p.data[i+1]>192||p.data[i+2]!==0)throw Error('轮廓通道非法：G≤192、B=0；不要将彩色素材或角色层误当控制层');
  verifyContourTopology(g,p);return p;
 }
 const materials=p;
 const c=g.cellPixels,edges=g.master.patches.filter(p=>p.role.startsWith('edge-'));
 // A literal common border prevents random whole-patch choices breaking joins.
 for(const r of edges)for(let q=0;q<c;q++)for(let depth=0;depth<2;depth++){
  for(const [ax,ay,bx,by] of [[depth,q,c-1-depth,q],[q,depth,q,c-1-depth]]){
   const a=patchAt(materials,r,ax,ay),b=patchAt(materials,r,bx,by),shared=patchAt(materials,edges[0],ax,ay);
   if(!a.equals(b)||!a.equals(shared))throw Error(`共享边缘相位不一致：${r.id} (${ax},${ay})；请修正原图，未模糊或平均颜色`);
  }
 }
 return p;
}
function validateArtLayer(g,role,bytes){
 assertArtGrammar(g);const p=readArtLayer(g,role,bytes);return {width:p.width,height:p.height,sha256:sha(bytes),fileBytes:bytes.length,role};
}
function verifyInputs(g,inputs){
 if(!inputs||!inputs.contour)throw Error('缺少 contour.png 轮廓控制层；不能代入程序默认轮廓');
 return {materials:readArtLayer(g,'materials',inputs.materials),control:readArtLayer(g,'contour',inputs.contour)};
}
function verifyContourTopology(g,control){
 const c=g.cellPixels;
 for(const tile of g.tiles)for(let variant=0;variant<2;variant++){
  const solid=new Uint8Array(c*c),seen=new Uint8Array(c*c),queue=new Int32Array(c*c);let total=0;
  for(let y=0;y<c;y++)for(let x=0;x<c;x++)if(capAlpha(g,tile.mask,x,y,control,variant)){solid[y*c+x]=1;total++;}
  const start=Math.floor(c/2)*c+Math.floor(c/2);let head=0,tail=1;queue[0]=start;seen[start]=1;
  while(head<tail){const i=queue[head++],x=i%c,y=Math.floor(i/c);for(const n of [x?i-1:-1,x<c-1?i+1:-1,y?i-c:-1,y<c-1?i+c:-1])if(n>=0&&solid[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}
  if(tail!==total)throw Error(`轮廓包含断开/孤立像素：${tile.id} / contour-${variant}；局部艺术变形不能改变连通拓扑`);
 }
}
function makeTile(g,t,materials,control,variant,sampled){
 const c=g.cellPixels,out=empty(g.sprite.width,g.sprite.height),patches=g.master.patches;
 const surface=patches[(variant+(g.seed%4)+(t.mask%4))%4],edge=patches[4+variant%2],bridge=patches[4],dark=patches[7],body=patches[6];
 const controlVariant=(variant+t.mask)%2,controlRect=g.control.patches[controlVariant];
 const material=(r,x,y)=>{const xx=((Math.floor(x)%c)+c)%c,yy=((Math.floor(y)%c)+c)%c;sampled[(r.y+yy)*materials.width+r.x+xx]=1;return patchAt(materials,r,x,y);};
 const painted=(r,x,y)=>{
  const a=material(r,x,y),strength=patchAt(control,controlRect,x,y)[1]/255,b=strength?material(dark,x,y):a;
  return [Math.round(a[0]*(1-strength)+b[0]*strength),Math.round(a[1]*(1-strength)+b[1]*strength),Math.round(a[2]*(1-strength)+b[2]*strength),255];
 };
 if(g.template.kind==='stone'&&!(t.mask&64))for(let y=c/2;y<out.height;y++)for(let x=0;x<out.width;x++){
  const sx=Math.floor(x*c/out.width),yy=y-c/2;
  if(capAlpha(g,t.mask,sx,yy,control,controlVariant))out.data.set(painted(body,x-g.sprite.logicalRect.x,yy),(y*out.width+x)*4);
 }
 for(let y=0;y<c;y++)for(let x=0;x<out.width;x++){
  const sx=g.template.kind==='stone'?Math.floor(x*c/out.width):x;
  if(!capAlpha(g,t.mask,sx,y,control,controlVariant))continue;
  const materialX=x-g.sprite.logicalRect.x,d=boundaryDistance(t.mask,sx+.5,y+.5,c),onFrame=materialX<2||y<2||materialX>=c-2||y>=c-2,r=onFrame?bridge:d<c/4?edge:surface;
  // The 2px bridge is unmodified by G, ensuring both neighboring tiles retain
  // exact artist-authored edge pixels. Dark control is confined inside it.
  out.data.set(onFrame?[...material(r,materialX,y)]:painted(r,materialX,y),(y*out.width+x)*4);
 }
 return {...t,variant,controlVariant,outputPath:`variants/${t.id}-v${variant}.png`,sourceRect:{x:surface.x,y:surface.y,width:c,height:c},sourcePatches:[surface,edge,bridge,body,dark,controlRect].map(r=>({...r,inputPath:r.role==='contour'?'contour.png':'materials.png'})),png:PNG.sync.write(out)};
}
function compileArtDirected(g,inputs){
 assertArtGrammar(g);const {materials,control}=verifyInputs(g,inputs);
 const sampled=new Uint8Array(materials.width*materials.height),tileVariants=g.tiles.flatMap(t=>Array.from({length:g.variantCount},(_,variant)=>makeTile(g,t,materials,control,variant,sampled)));
 const tiles=tileVariants.filter(t=>t.variant===0),atlas=empty(8*g.sprite.width,6*g.sprite.height);
 for(const t of tiles){const p=PNG.sync.read(t.png);PNG.bitblt(p,atlas,0,0,p.width,p.height,(t.index%8)*p.width,Math.floor(t.index/8)*p.height);}
 const underlayRect=g.master.patches[6];for(let y=0;y<underlayRect.height;y++)for(let x=0;x<underlayRect.width;x++)sampled[(underlayRect.y+y)*materials.width+underlayRect.x+x]=1;
 const patchSources=[...g.master.patches.map(r=>{let sampledPixels=0;for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)sampledPixels+=sampled[(r.y+y)*materials.width+r.x+x];return {...r,input:'materials.png',sha256:sha(patchBytes(materials,r)),sampledPixels,sampledFraction:sampledPixels/(r.width*r.height)};}),...g.control.patches.map(r=>({...r,input:'contour.png',sha256:sha(patchBytes(control,r)),sampledPixels:r.width*r.height,sampledFraction:1}))];
 const materialPixels=sampled.reduce((a,b)=>a+b,0),sampling={materialPixels,materialTotalPixels:sampled.length,materialFraction:materialPixels/sampled.length,method:'unique actual source pixels used in 188 sprites plus exported underlay; no interpolated samples'};
 for(const t of tileVariants)t.sourcePatches=t.sourcePatches.map(p=>({...p,sha256:patchSources.find(s=>s.id===p.id&&s.input===p.inputPath).sha256}));
 const underlay=patchBytes(materials,g.master.patches[6]);
 return {tiles,tileVariants,atlas:PNG.sync.write(atlas),underlay,controlPng:Buffer.from(inputs.contour),rawSha256:sha(inputs.materials),controlSha256:sha(inputs.contour),rawWidth:materials.width,rawHeight:materials.height,
  inputHashes:{materials:sha(inputs.materials),contour:sha(inputs.contour)},grammarSha256:sha(Buffer.from(JSON.stringify(g))),patchSources,sampling,compilerVersion:'art-directed/0.1.0',artAcceptance:'pending-human-review',sortingVerified:false};
}
function artTemplateImages(g){
 assertArtGrammar(g);const materials=empty(g.master.width,g.master.height),contour=empty(g.control.width,g.control.height);
 const colors=[[129,157,96],[143,166,103],[115,148,90],[133,154,108],[97,123,77],[97,123,77],[106,84,62],[38,48,36]];
 for(const [i,r] of g.master.patches.entries())for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)materials.data.set([...colors[i],255],((y+r.y)*materials.width+x+r.x)*4);
 for(let i=0;i<contour.data.length;i+=4)contour.data.set([96,0,0,255],i);
 const mark=(p,rect)=>{for(let x=rect.x;x<rect.x+rect.width;x++)for(const y of [rect.y,rect.y+rect.height-1])p.data.set([255,159,75,255],(y*p.width+x)*4);for(let y=rect.y;y<rect.y+rect.height;y++)for(const x of [rect.x,rect.x+rect.width-1])p.data.set([255,159,75,255],(y*p.width+x)*4);};
 const materialsGuide=PNG.sync.read(PNG.sync.write(materials)),contourGuide=PNG.sync.read(PNG.sync.write(contour));
 g.master.patches.forEach(r=>mark(materialsGuide,r));g.control.patches.forEach(r=>mark(contourGuide,r));
 return {materials:PNG.sync.write(materials),contour:PNG.sync.write(contour),materialsGuide:PNG.sync.write(materialsGuide),contourGuide:PNG.sync.write(contourGuide)};
}
module.exports={makeArtGrammar,assertArtGrammar,compileArtDirected,artTemplateImages,validateArtLayer,artAlpha,capAlpha,boundaryDistance};
