'use strict';
const {PNG}=require('pngjs');
const {sha,canonical}=require('../workflow/store.cjs');
const {renderMasks,traceCell,checkGrid}=require('./corner-mask.cjs');
const {stateTable,externalOrder}=require('./mapping.cjs');
const assert=(ok,text)=>{if(!ok)throw Error(text);};
function makeSpec(options={}){
 const allowed=['cellPixels','ppu','period','roundness','inkWidth','inkStrength'];assert(options&&Object.keys(options).every(k=>allowed.includes(k)),'双网格规格含未知字段');
 const {cellPixels=128,ppu=100,period=4,roundness=.8,inkWidth=2,inkStrength=.65}=options;
 assert(Number.isInteger(cellPixels)&&cellPixels>=16&&cellPixels<=256&&cellPixels%2===0&&Number.isFinite(ppu)&&ppu>=1&&ppu<=10000&&[1,2,4,8].includes(period),'格尺寸/PPU/周期不合法');
 assert(Number.isFinite(roundness)&&roundness>=0&&roundness<=1&&Number.isInteger(inkWidth)&&inkWidth>=0&&inkWidth<=8&&Number.isFinite(inkStrength)&&inkStrength>=0&&inkStrength<=1,'边线参数非法');
 assert(16*period*period*cellPixels*cellPixels<=16*1024*1024,'缓存规格过大，请降低周期或格尺寸');
 return{schemaVersion:'xh-dual-grid/1',compilerVersion:'1',cellPixels,ppu,period,roundness,inkWidth,inkStrength,inkColor:[8,11,9],terrainA:'stone-floor',terrainB:'background-test',cornerBits:{TL:1,TR:2,BL:4,BR:8},coordinateSystem:'screen-x-right-y-down',renderTopLeftOffsetInDataCells:[-.5,-.5],diagonalPolicy:'separate-islands',sampling:'world-render-cell-modulo-period',atlas:{columns:4,rows:4,order:'row-major-mask-0-to-15'},pivot:[.5,.5],alpha:'opaque-A-B-composite',artAcceptance:'pending-human',unityIntegrationStatus:'unverified'};
}
function assertSpec(spec){assert(spec&&canonical(spec)===canonical(makeSpec(Object.fromEntries(['cellPixels','ppu','period','roundness','inkWidth','inkStrength'].map(k=>[k,spec[k]])))),'双网格规格权威字段不一致');return spec;}
function geometryAt(mask,u,v,roundness=.8){
 assert(Number.isInteger(mask)&&mask>=0&&mask<16&&[u,v].every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&Number.isFinite(roundness)&&roundness>=0&&roundness<=1,'mask/形状坐标非法');
 if(mask===0)return-1;if(mask===15)return 1;
 if(mask===3)return .5-v;if(mask===12)return v-.5;if(mask===5)return .5-u;if(mask===10)return u-.5;
 const corners=[[1,0,0],[2,1,0],[4,0,1],[8,1,1]],count=corners.filter(([b])=>mask&b).length,p=1+roundness;
 const distance=(x,y)=>(Math.abs(u-x)**p+Math.abs(v-y)**p)**(1/p);
 const stable=d=>Math.abs(d)<1e-12?0:d;
 if(count===3){const[,x,y]=corners.find(([b])=>!(mask&b));return stable(distance(x,y)-.5);}
 return stable(.5-Math.min(...corners.filter(([b])=>mask&b).map(([,x,y])=>distance(x,y))));
}
function readSource(bytes,spec,role){
 assert(Buffer.isBuffer(bytes)&&bytes.length<=32*1024*1024,`${role}需要真实PNG且最多32MB`);let p;try{p=PNG.sync.read(bytes);}catch{throw Error(`${role}不是合法PNG原稿`);}
 const n=spec.cellPixels*spec.period;assert(p.width===n&&p.height===n,`${role}尺寸错误：需要${n}×${n}，实际${p.width}×${p.height}；原件保留，不缩放`);
 for(let i=3;i<p.data.length;i+=4)assert(p.data[i]===255,`${role} Alpha必须全不透明；没有自动抠背景或铺底`);
 return p;
}
function compile(spec,sources){
 assertSpec(spec);const A=readSource(sources?.A,spec,'A连续母图'),B=readSource(sources?.B,spec,'B连续母图'),c=spec.cellPixels,K=spec.period;
 const fields=Array.from({length:16},(_,m)=>{const a=new Uint8Array(c*c),ink=new Uint8Array(c*c);for(let y=0;y<c;y++)for(let x=0;x<c;x++){const d=geometryAt(m,x===0?0:x===c-1?1:(x+.5)/c,y===0?0:y===c-1?1:(y+.5)/c,spec.roundness),i=y*c+x;a[i]=d>0?1:0;ink[i]=m!==15&&d>0&&d*c<=spec.inkWidth?1:0;}return{a,ink};});
 const phaseTiles=[],phaseAtlases=[];
 for(let py=0;py<K;py++)for(let px=0;px<K;px++){
  const atlas=new PNG({width:4*c,height:4*c});
  for(let mask=0;mask<16;mask++){
   const image=new PNG({width:c,height:c}),field=fields[mask];
   for(let y=0;y<c;y++)for(let x=0;x<c;x++){
    const i=y*c+x,p=(y*c+x)*4,source=field.a[i]?A:B,q=((py*c+y)*source.width+px*c+x)*4;
    for(let k=0;k<3;k++)image.data[p+k]=field.ink[i]?Math.round(source.data[q+k]*(1-spec.inkStrength)+spec.inkColor[k]*spec.inkStrength):source.data[q+k];image.data[p+3]=255;
   }
   const png=PNG.sync.write(image),tile={mask,phaseX:px,phaseY:py,png,image,sha256:sha(png),file:`phases/${px}-${py}/mask-${String(mask).padStart(2,'0')}.png`,sourceRect:{x:px*c,y:py*c,width:c,height:c}};phaseTiles.push(tile);PNG.bitblt(image,atlas,0,0,c,c,(mask%4)*c,Math.floor(mask/4)*c);
  }
  phaseAtlases.push({phaseX:px,phaseY:py,png:PNG.sync.write(atlas),image:atlas});
 }
 const canonicalTiles=phaseTiles.filter(t=>t.phaseX===0&&t.phaseY===0).map(t=>({...t,file:`tiles/mask-${String(t.mask).padStart(2,'0')}.png`})),first=phaseAtlases[0];
 const n=c*K,sourceReport={A:{sha256:sha(sources.A),width:n,height:n,usedPixels:n*n,totalPixels:n*n,coverage:1},B:{sha256:sha(sources.B),width:n,height:n,usedPixels:n*n,totalPixels:n*n,coverage:1},canonicalOnlyCoverage:1/(K*K),processing:{resampling:false,rotation:false,mirroring:false,borderAveraging:false,geometry:'deterministic-Lp-corners',ink:'declared-A-side-dark-contact-layer',artistSilhouettePreserved:false}};
 return{spec,canonical:canonicalTiles,phaseTiles,phaseAtlases,atlas:first.image,atlasPng:first.png,sources:{A:sources.A,B:sources.B},sourceImages:{A,B},sourceReport,fields};
}
function renderBoard(compiled,grid){
 checkGrid(grid);const masks=renderMasks(grid),c=compiled.spec.cellPixels,K=compiled.spec.period,width=masks.width*c,height=masks.height*c;
 assert(width*height<=16*1024*1024,'导出地图超过16MP，请使用较小地图或格尺寸');const image=new PNG({width,height}),placements=[];
 for(let y=0;y<masks.height;y++)for(let x=0;x<masks.width;x++){
  const mask=masks.cells[y*masks.width+x],px=x%K,py=y%K,tile=compiled.phaseTiles[(py*K+px)*16+mask];assert(tile&&tile.mask===mask,'显示格图块缺失');PNG.bitblt(tile.image,image,0,0,c,c,x*c,y*c);
  placements.push({x,y,mask,phaseX:px,phaseY:py,file:tile.file,sourceRect:tile.sourceRect,corners:traceCell(grid,x,y).corners});
 }
 return{png:PNG.sync.write(image),image,placements,grid:masks};
}
function externalAtlas(compiled){const c=compiled.spec.cellPixels,p=new PNG({width:4*c,height:4*c});for(const[index,mask]of externalOrder().entries())PNG.bitblt(compiled.canonical[mask].image,p,0,0,c,c,index%4*c,Math.floor(index/4)*c);return PNG.sync.write(p);}
module.exports={makeSpec,assertSpec,geometryAt,readSource,compile,renderBoard,externalAtlas,stateTable};
