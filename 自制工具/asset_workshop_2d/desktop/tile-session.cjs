'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{zipSync}=require('fflate');const {TEMPLATES,makeGrammar,testScenes}=require('../grammar/catalog.cjs');
const {compileMaster,templateImages,sha}=require('../grammar/compile.cjs');const {validateCompilation}=require('../grammar/validate.cjs');const {buildTaskPackage}=require('../grammar/package.cjs');
const data=bytes=>'data:image/png;base64,'+bytes.toString('base64');
async function readNativePng(file){
 if(typeof file!=='string'||!path.isAbsolute(file)||path.extname(file).toLowerCase()!=='.png')throw Error('请选择本地 PNG');
 const s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.size>32*1024*1024)throw Error('PNG 不是普通文件或超过32MB');const bytes=await fs.readFile(file);if(bytes.length>32*1024*1024)throw Error('PNG 超过32MB');return bytes;
}
async function writeNew(file,bytes){
 if(typeof file!=='string'||!path.isAbsolute(file)||path.extname(file).toLowerCase()!=='.zip')throw Error('请选择本地 ZIP 保存路径');
 const parent=await fs.lstat(path.dirname(file));if(!parent.isDirectory()||parent.isSymbolicLink())throw Error('不支持链接输出目录');
 const handle=await fs.open(file,'wx');try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
 const saved=await fs.readFile(file);if(sha(saved)!==sha(bytes))throw Error('文件写入后校验失败');return {path:file,sha256:sha(saved)};
}
function createTileSession({pickInput,readClipboard,referenceSnapshot,pickSave,projectStyle=()=>undefined}={}){
 let options={},grammar=makeGrammar(),compiled=null,raw=null,phase=null,busy=false;
 const safe=async work=>{if(busy)throw Error('操作正在进行，请等待');busy=true;try{return await work();}finally{busy=false;}};
 const requireOutput=()=>{if(!compiled)throw Error('请先导入并编译真实母版 PNG');};
 function scene(input={}){requireOutput();if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['scene','underlay','grid','pivot','alpha','overhang','sort','mask'].includes(k)))throw Error('未知预览字段');
  let board=testScenes()[input.scene??'hole'];if(input.scene==='neighbor'){
   const mask=input.mask??255;if(!grammar.tiles.some(t=>t.mask===mask))throw Error('非法邻居组合');board=[[!!(mask&1),!!(mask&2),!!(mask&4)],[!!(mask&8),true,!!(mask&16)],[!!(mask&32),!!(mask&64),!!(mask&128)]].map(r=>r.map(Number));
  }if(!board)throw Error('未知测试地图');
  for(const k of ['underlay','grid','pivot','alpha','overhang'])if(input[k]!==undefined&&typeof input[k]!=='boolean')throw Error('预览开关无效');
  if(input.sort!==undefined&&!['back-to-front','front-to-back'].includes(input.sort))throw Error('排序模式无效');
  const report=validateCompilation(grammar,compiled,board,input);return {...report,preview:data(report.preview),inputPhase:phase};
 }
 return {
  catalog:()=>TEMPLATES,
  configure(input={}){if(busy)throw Error('操作正在进行');buildTaskPackage(input);options={...input};grammar=makeGrammar(input);compiled=null;raw=null;phase=null;const images=templateImages(grammar);return {grammar,blank:data(images.blank),guide:data(images.guide),mask:data(images.mask)};},
  async importMaster(method='file',inputPhase='structure'){return safe(async()=>{
   if(!['file','clipboard','fixture'].includes(method)||!['structure','style'].includes(inputPhase))throw Error('未知导入方式或阶段');
   if(inputPhase==='style'&&phase===null)throw Error('先验证结构母版，再导入风格细化图');
   let bytes;
   if(method==='fixture')bytes=templateImages(grammar).blank;
   else if(method==='file'){const file=await pickInput();if(!file)return {cancelled:true};bytes=await readNativePng(file);}
   else{const clip=await readClipboard();if(clip.kind==='image')bytes=clip.bytes;else if(clip.kind==='files'&&clip.filePaths.length===1)bytes=await readNativePng(clip.filePaths[0]);else throw Error('剪贴板需为单张本地 PNG 或图片');}
   compiled=null;raw=null;phase=null;const result=compileMaster(grammar,bytes);compiled=result;raw=Buffer.from(bytes);phase=method==='fixture'?'fixture':inputPhase;
   return {...scene(),atlas:data(result.atlas),master:data(raw),rawSha256:result.rawSha256,rawWidth:result.rawWidth,rawHeight:result.rawHeight,inputPhase:phase};
  });},
  scene,
  async exportTask(){return safe(async()=>{const refs=await referenceSnapshot();const pack=buildTaskPackage({...options,projectStyleContract:projectStyle()},refs);const file=await pickSave(`${grammar.template.id}-task.zip`);if(!file)return {cancelled:true};const out=await writeNew(file,pack.bytes);require('../archive/export-zip.cjs').validateZip(await fs.readFile(file));return {...out,cancelled:false,entries:Object.keys(pack.files).length};});},
  async exportCompiled(){return safe(async()=>{requireOutput();const files={};for(const t of compiled.tiles)files[`tiles/${t.id}.png`]=t.png;
   files['source/master.png']=raw;files['atlas.png']=compiled.atlas;files['underlay.png']=compiled.underlay;files['map.json']=Buffer.from(JSON.stringify({schemaVersion:'2dw-tile-output/1',grammar,tiles:compiled.tiles.map(({png,...t})=>({...t,path:`tiles/${t.id}.png`,sha256:sha(png)})),inputPhase:phase,rawSha256:compiled.rawSha256},null,2));
   const reports={};for(const [name,board] of Object.entries(testScenes())){const {preview,...report}=validateCompilation(grammar,compiled,board);reports[name]=report;}
   files['validation.json']=Buffer.from(JSON.stringify({scenes:reports,artAcceptance:'pending-human-review',fixture:phase==='fixture'},null,2));
   files['manifest.json']=Buffer.from(JSON.stringify({schemaVersion:'2dw-tile-output/1',entries:Object.entries(files).map(([path,b])=>({path,sha256:sha(b),byteLength:b.length}))},null,2));
   const file=await pickSave(`${grammar.template.id}-compiled.zip`);if(!file)return {cancelled:true};return {...await writeNew(file,Buffer.from(zipSync(files))),cancelled:false,tiles:47};
  });},
 };
}
module.exports={createTileSession};
