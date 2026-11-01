const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
/** Reference-only dialog preferences live in userData, separate from projects. */
function createReferenceImporter({dialog,nativeImage,window,userData,referenceApi}) {
  const settings=path.join(userData,'reference-import-preferences.json');
  return async function importReferences(kind='scale',multiple=true) {
    if(!['scale','modeling'].includes(kind))throw Error('参考图片用途无效');
    let defaultPath;
    try{const saved=JSON.parse(await fs.readFile(settings,'utf8'));if(typeof saved.pngDirectory==='string')defaultPath=saved.pngDirectory;}catch{}
    const result=await dialog.showOpenDialog(window(),{properties:multiple?['openFile','multiSelections']:['openFile'],filters:[{name:kind==='scale'?'PNG 比例参考':'PNG 建模参考',extensions:['png']}],...(defaultPath?{defaultPath}:{})});
    if(result.canceled||!result.filePaths.length)return [];
    if(result.filePaths.length>32)throw Error('一次最多导入32张参考图片');
    const {createReference,pngDimensions}=referenceApi(),references=[];
    for(const file of result.filePaths){
      if((await fs.stat(file)).size>32*1024*1024)throw Error('PNG超过32MiB');
      const bytes=await fs.readFile(file),dataUrl='data:image/png;base64,'+bytes.toString('base64'),size=pngDimensions(dataUrl),image=nativeImage.createFromBuffer(bytes);
      if(image.isEmpty())throw Error('PNG无法解码：'+path.basename(file));
      const reference=createReference({id:randomUUID(),name:path.basename(file),dataUrl,pixelWidth:size.width,pixelHeight:size.height});
      reference.kind=kind;
      if(kind==='modeling')Object.assign(reference,{height:4,footX:.5,footY:.5});
      else{
        const bitmap=image.toBitmap();let x0=size.width,y0=size.height,x1=-1,y1=-1;
        for(let y=0;y<size.height;y++)for(let x=0;x<size.width;x++)if(bitmap[(y*size.width+x)*4+3]>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
        if(y1>=y0)Object.assign(reference,{contentTop:y0/size.height,contentBottom:(y1+1)/size.height,footX:(x0+x1+1)/2/size.width,footY:(y1+1)/size.height});
      }
      references.push(reference);
    }
    await fs.mkdir(userData,{recursive:true});
    await fs.writeFile(settings,JSON.stringify({pngDirectory:path.dirname(result.filePaths[0])},null,2));
    return references;
  };
}
module.exports={createReferenceImporter};
