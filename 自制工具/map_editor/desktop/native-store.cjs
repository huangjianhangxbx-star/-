const fs=require('node:fs/promises'),path=require('node:path');const {FileStore,digest}=require('./files.cjs');
async function saveNativePair(source,asset,glb,expected){
 source=path.resolve(source);const model=source.replace(/\.xhasset\.json$/i,'')+'.glb';const store=new FileStore(path.dirname(source));
 const previous=await Promise.all([source,model].map(async file=>{try{await store.safe(path.basename(file));return await fs.readFile(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}}));
 if(expected!==undefined&&digest(previous[0]??Buffer.alloc(0))!==expected)throw Error('原生资产已被外部修改，请重新打开');
 const text=JSON.stringify(asset,null,2);let sourceHash;
 try{sourceHash=await store.save(source,text,digest(previous[0]??Buffer.alloc(0)));await store.save(model,Buffer.from(glb),digest(previous[1]??Buffer.alloc(0)));}
 catch(error){if(sourceHash){if(previous[0]!==null)await store.save(source,previous[0],sourceHash);else if(digest(await fs.readFile(source))===sourceHash)await fs.unlink(source);}throw error;}
 return {source,model,hash:sourceHash};
}
module.exports={saveNativePair};
