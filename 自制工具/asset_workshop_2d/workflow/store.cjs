'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {zipSync,unzipSync}=require('fflate');
const MAX_PACK=64*1024*1024,MAX_BLOB=32*1024*1024;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const json=value=>Buffer.from(JSON.stringify(value,null,2));
const assert=(ok,message)=>{if(!ok)throw Error(message);};
function blobPath(relativePath){assert(typeof relativePath==='string'&&/^blobs\/[a-f0-9]{64}\.(png|bin)$/.test(relativePath),'研究工程文件路径不安全');return relativePath;}
function blobRecord(record){blobPath(record?.relativePath);assert(/^[a-f0-9]{64}$/.test(record.sha256)&&Number.isSafeInteger(record.fileBytes)&&record.fileBytes>=0&&record.fileBytes<=MAX_BLOB,'工程原件记录无效');assert(record.relativePath.split('/')[1].split('.')[0]===record.sha256,'原件路径与 SHA 不一致');}
function readArchive(bytes){
 assert(Buffer.isBuffer(bytes)&&bytes.length<=MAX_PACK&&bytes.length>=22,'工程 ZIP 超过64MB或格式无效');
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
 assert(end>=0,'工程 ZIP 尾目录缺失');assert(bytes.readUInt16LE(end+4)===0&&bytes.readUInt16LE(end+6)===0,'不支持多卷 ZIP');
 const count=bytes.readUInt16LE(end+10),start=bytes.readUInt32LE(end+16),size=bytes.readUInt32LE(end+12);assert(count>0&&count<=512&&bytes.readUInt16LE(end+8)===count&&start+size===end,'工程 ZIP 目录或条目数量无效');
 let offset=start,total=0;const paths=new Set();
 for(let i=0;i<count;i++){
  assert(offset+46<=end&&bytes.readUInt32LE(offset)===0x02014b50,'工程 ZIP 目录无效');
  const flags=bytes.readUInt16LE(offset+8),method=bytes.readUInt16LE(offset+10),packed=bytes.readUInt32LE(offset+20),unpacked=bytes.readUInt32LE(offset+24),nameLength=bytes.readUInt16LE(offset+28),extra=bytes.readUInt16LE(offset+30),comment=bytes.readUInt16LE(offset+32),local=bytes.readUInt32LE(offset+42);
  assert(!(flags&1)&&[0,8].includes(method)&&unpacked<=MAX_PACK&&packed<=MAX_PACK&&offset+46+nameLength+extra+comment<=end,'工程 ZIP 压缩条目无效');
  const name=bytes.subarray(offset+46,offset+46+nameLength).toString('utf8');assert(name==='manifest.json'||/^blobs\/[a-f0-9]{64}\.(png|bin)$/.test(name),'工程 ZIP 路径不安全');assert(!paths.has(name),'工程 ZIP 重复路径');paths.add(name);
  assert(local+30<=start&&bytes.readUInt32LE(local)===0x04034b50,'工程 ZIP 本地条目无效');const localName=bytes.readUInt16LE(local+26),localExtra=bytes.readUInt16LE(local+28);
  assert(bytes.subarray(local+30,local+30+localName).toString('utf8')===name&&local+30+localName+localExtra+packed<=start,'工程 ZIP 本地路径不一致');
  assert(((bytes.readUInt32LE(offset+38)>>>16)&0xf000)!==0xa000,'工程 ZIP 不支持链接');total+=unpacked;assert(total<=MAX_PACK,'工程 ZIP 解压数据超过64MB');offset+=46+nameLength+extra+comment;
 }
 assert(offset===end&&paths.has('manifest.json'),'工程 ZIP 目录不完整');
 try{return Object.fromEntries(Object.entries(unzipSync(bytes)).map(([name,value])=>[name,Buffer.from(value)]));}catch{throw Error('工程 ZIP 无法解压');}
}
async function createProjectStore(directory){
 assert(typeof directory==='string'&&path.isAbsolute(directory),'工作区需要应用提供的本地绝对目录');
 await fs.mkdir(directory,{recursive:true});const stat=await fs.lstat(directory);assert(stat.isDirectory()&&!stat.isSymbolicLink(),'不支持链接工作区');
 const root=await fs.realpath(directory);
 for(const name of ['blobs','snapshots']){const dir=path.join(root,name);await fs.mkdir(dir,{recursive:true});const s=await fs.lstat(dir);assert(s.isDirectory()&&!s.isSymbolicLink(),'不支持链接工程目录');}
 async function safeFile(relativePath){
  assert(typeof relativePath==='string'&&!path.isAbsolute(relativePath)&&!/[\\:\0]/.test(relativePath)&&relativePath.split('/').every(p=>p&&p!=='.'&&p!=='..'),'工程路径不安全');
  const target=path.resolve(root,...relativePath.split('/'));assert(target.startsWith(root+path.sep),'工程路径越界');const parent=await fs.lstat(path.dirname(target));assert(parent.isDirectory()&&!parent.isSymbolicLink(),'不支持链接路径');
  try{const s=await fs.lstat(target);assert(s.isFile()&&!s.isSymbolicLink(),'不支持链接文件');}catch(e){if(e.code!=='ENOENT')throw e;}return target;
 }
 const keyFile=await safeFile('approval-key.bin');let key;
 try{const h=await fs.open(keyFile,'wx',0o600);try{key=crypto.randomBytes(32);await h.writeFile(key);await h.sync();}finally{await h.close();}}catch(e){if(e.code!=='EEXIST')throw e;key=await fs.readFile(keyFile);}
 assert(key.length===32,'批准签名密钥损坏');const keyId=sha(key).slice(0,24);
 const sign=value=>({algorithm:'HMAC-SHA256/local-v1',keyId,value:crypto.createHmac('sha256',key).update(canonical(value)).digest('hex')});
 function verify(value,seal){if(seal?.algorithm!=='HMAC-SHA256/local-v1'||seal.keyId!==keyId||typeof seal.value!=='string'||!/^\w{64}$/.test(seal.value))return false;const expected=sign(value).value;return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(seal.value));}
 async function writeNew(relativePath,bytes){const target=await safeFile(relativePath),h=await fs.open(target,'wx',0o600);try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}assert(sha(await fs.readFile(target))===sha(bytes),'写入后 SHA 校验失败');}
 async function readBlob(record){blobRecord(record);const target=await safeFile(record.relativePath);let bytes;try{const s=await fs.stat(target);assert(s.size===record.fileBytes,'原件字节长度已改变，无法确认 SHA 身份');bytes=await fs.readFile(target);}catch(e){if(e.code==='ENOENT')throw Error('工程原件缺失，请从原项目恢复');throw e;}assert(bytes.length===record.fileBytes&&sha(bytes)===record.sha256,'工程原件 SHA 哈希已改变');return bytes;}
 async function putBlob(bytes,extension='png'){
  assert(Buffer.isBuffer(bytes)&&bytes.length<=MAX_BLOB&&['png','bin'].includes(extension),'原件超过32MB或格式无效');const hash=sha(bytes),record={relativePath:`blobs/${hash}.${extension}`,sha256:hash,fileBytes:bytes.length};
  try{await writeNew(record.relativePath,bytes);}catch(e){if(e.code!=='EEXIST')throw e;assert(sha(await readBlob(record))===hash,'已有内容寻址原件损坏');}return record;
 }
 async function saveSession(session){
  const payload={schemaVersion:'2dw-tile-store/1',session,sessionSha256:sha(Buffer.from(canonical(session))),seal:sign(session)};
  const filename=`snapshots/${Date.now()}-${crypto.randomUUID()}.json`;await writeNew(filename,json(payload));
  const pointer=json({snapshot:filename,sha256:sha(json(payload))}),temp=`CURRENT-${crypto.randomUUID()}.json`;await writeNew(temp,pointer);
  await fs.rename(await safeFile(temp),await safeFile('CURRENT.json'));assert(sha(await fs.readFile(await safeFile('CURRENT.json')))===sha(pointer),'工作区指针写后校验失败');
  return payload;
 }
 async function loadSession(){
  let pointer;try{pointer=JSON.parse((await fs.readFile(await safeFile('CURRENT.json'))).toString('utf8'));}catch(e){if(e.code==='ENOENT')return null;throw Error('工作区恢复指针损坏');}
  assert(pointer&&/^snapshots\/[0-9]+-[a-f0-9-]+\.json$/.test(pointer.snapshot)&&/^[a-f0-9]{64}$/.test(pointer.sha256),'工作区快照路径无效');
  const bytes=await fs.readFile(await safeFile(pointer.snapshot));assert(sha(bytes)===pointer.sha256,'工作区快照 SHA 损坏');const payload=JSON.parse(bytes.toString('utf8'));
  assert(payload.schemaVersion==='2dw-tile-store/1'&&payload.sessionSha256===sha(Buffer.from(canonical(payload.session)))&&verify(payload.session,payload.seal),'工作区快照签名损坏');return payload.session;
 }
 async function exportProject(session,records){
  const files={};for(const record of records){blobRecord(record);if(!files[record.relativePath])files[record.relativePath]=await readBlob(record);}
  const manifest={schemaVersion:'2dw-tile-session/1',session,sessionSha256:sha(Buffer.from(canonical(session))),seal:sign(session),entries:Object.entries(files).map(([name,bytes])=>({path:name,sha256:sha(bytes),fileBytes:bytes.length}))};files['manifest.json']=json(manifest);
  assert(Object.values(files).reduce((n,b)=>n+b.length,0)<=MAX_PACK,'工程原件累计超过64MB，请另建任务分批保存');const bytes=Buffer.from(zipSync(files));assert(bytes.length<=MAX_PACK,'工程 ZIP 超过64MB');return bytes;
 }
 function decodeProject(bytes){
  const files=readArchive(bytes);let manifest;try{manifest=JSON.parse(files['manifest.json'].toString('utf8'));}catch{throw Error('工程 manifest 无效');}
  assert(manifest?.schemaVersion==='2dw-tile-session/1'&&manifest.session&&Array.isArray(manifest.entries)&&manifest.entries.length<=511,'工程 manifest 版本或条目无效');
  const names=new Set();for(const e of manifest.entries){blobPath(e.path);assert(!names.has(e.path),'工程索引重复');names.add(e.path);const bytes=files[e.path];assert(bytes,'工程原件缺失');assert(bytes.length===e.fileBytes&&sha(bytes)===e.sha256,'工程原件 SHA 不一致');}
  assert(Object.keys(files).every(n=>n==='manifest.json'||names.has(n)),'工程 ZIP 存在未登记原件');
  return {session:manifest.session,files,trusted:manifest.sessionSha256===sha(Buffer.from(canonical(manifest.session)))&&verify(manifest.session,manifest.seal)};
 }
 async function importBlobs(files){for(const [name,bytes] of Object.entries(files))if(name!=='manifest.json'){const hash=name.split('/')[1].split('.')[0];assert(hash===sha(bytes),'工程原件路径 SHA 不一致');await putBlob(bytes,name.endsWith('.png')?'png':'bin');}}
 return {root,keyId,putBlob,readBlob,hasBlob:async r=>{try{await readBlob(r);return true;}catch{return false;}},sign,verify,saveSession,loadSession,exportProject,decodeProject,importBlobs};
}
module.exports={createProjectStore,canonical,sha,blobRecord};
