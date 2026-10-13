'use strict';
const {PNG}=require('pngjs'),{sha}=require('../workflow/store.cjs');
const {readSource,assertSpec}=require('./compile.cjs');
const assert=(ok,text)=>{if(!ok)throw Error(text);};
function sourceInfo(bytes){
 assert(Buffer.isBuffer(bytes)&&bytes.length>=33&&bytes.length<=32*1024*1024&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a','需要最多32MB的实际PNG');
 const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);assert(w>=1&&h>=1&&w<=4096&&h<=4096&&w*h<=16*1024*1024,'原稿尺寸/解码预算过大');let image;try{image=PNG.sync.read(bytes);}catch{throw Error('绘画原稿PNG格式或CRC错误');}
 let opaque=true;for(let i=3;i<image.data.length;i+=4)if(image.data[i]!==255){opaque=false;break;}return{width:image.width,height:image.height,alphaClass:opaque?'opaque':'transparent',byteLength:bytes.length,sha256:sha(bytes)};
}
function extractContinuous(bytes,spec,options={}){
 assertSpec(spec);const info=sourceInfo(bytes),n=spec.cellPixels*spec.period;assert(options&&Object.keys(options).every(k=>['explicit','window'].includes(k)),'图源处理字段非法');let window=options.window,result=bytes;
 if(window){assert(options.explicit===true,'裁剪需要明确同意准确窗口，不自动选区');assert(Object.keys(window).length===4&&['x','y','width','height'].every(k=>Number.isSafeInteger(window[k]))&&window.x>=0&&window.y>=0&&window.width===n&&window.height===n&&window.x+n<=info.width&&window.y+n<=info.height,'窗口位置或尺寸非法');assert(n*n/(info.width*info.height)>=.25,'有效像素覆盖不足25%，停止在绘画素材不足；不以低覆盖编译冒充画法继承');
  if(window.x!==0||window.y!==0||info.width!==n||info.height!==n){const input=PNG.sync.read(bytes),p=new PNG({width:n,height:n});PNG.bitblt(input,p,window.x,window.y,n,n,0,0);result=PNG.sync.write(p);}
 }else{assert(info.width===n&&info.height===n,`连续母图尺寸错误：需要${n}×${n}，实际${info.width}×${info.height}；原件保留，未缩放`);window={x:0,y:0,width:n,height:n};}
 readSource(result,spec,'连续材料');return{bytes:result,metadata:{schemaVersion:'xh-dual-source/1',originalSha256:sha(bytes),processedSha256:sha(result),originalWidth:info.width,originalHeight:info.height,inputWidth:n,inputHeight:n,window,coverage:n*n/(info.width*info.height),explicitCrop:options.explicit===true,resampling:false,rotation:false,mirroring:false,edgeAveraging:false}};
}
function validateSource(original,processed,metadata,spec){const rebuilt=extractContinuous(original,spec,metadata?.explicitCrop?{explicit:true,window:metadata.window}:{});if(!rebuilt.bytes.equals(processed)||require('../workflow/store.cjs').canonical(rebuilt.metadata)!==require('../workflow/store.cjs').canonical(metadata))throw Error('图源处理记录或原像素不一致');return metadata;}
module.exports={sourceInfo,extractContinuous,validateSource};
