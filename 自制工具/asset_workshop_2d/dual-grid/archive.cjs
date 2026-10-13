'use strict';
const crypto=require('node:crypto'),{zipSync}=require('fflate');
const {sha,canonical}=require('../workflow/store.cjs');
const assert=(ok,text)=>{if(!ok)throw Error(text);};
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
function signFiles(input,schemaVersion,privateKey){
 assert(['2dw-zip/9','xh-dual-output/1'].includes(schemaVersion),'双网格签封版本错误');const files=Object.fromEntries(Object.entries(input).filter(([p])=>p!=='manifest.json'));
 const task=schemaVersion==='2dw-zip/9',budget=task?32*1024*1024:64*1024*1024;
 assert(Object.keys(files).length<(task?64:512)&&Object.values(files).every(Buffer.isBuffer)&&Object.values(files).reduce((n,b)=>n+b.length,0)<=budget,'双网格ZIP预算超限');
 privateKey??=crypto.generateKeyPairSync('ed25519').privateKey;const publicKey=crypto.createPublicKey(privateKey).export({type:'spki',format:'pem'});
 const entries=Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([path,b])=>({path,sha256:sha(b),byteLength:b.length}));
 const authority={schemaVersion,specPath:task?'dual-grid-spec.json':'map.json',issuerFingerprint:sha(Buffer.from(publicKey)),entries};
 files['manifest.json']=json({...authority,publicKey,signature:crypto.sign(null,Buffer.from(canonical(authority)),privateKey).toString('base64')});
 const bytes=Buffer.from(zipSync(files,{level:6,mtime:new Date('2020-01-01T00:00:00Z')}));assert(bytes.length<=budget,'双网格压缩包超限');return{files,bytes,sha256:sha(bytes)};
}
function readSigned(bytes,schemaVersion){
 const {files,records}=require('../archive/export-zip.cjs').readZip(bytes,{entries:512,archiveBytes:64*1024*1024});let manifest;try{manifest=JSON.parse(files['manifest.json']);}catch{throw Error('双网格清单缺失');}
 const {publicKey,signature,...authority}=manifest;
 assert(manifest.schemaVersion===schemaVersion&&manifest.specPath===(schemaVersion==='2dw-zip/9'?'dual-grid-spec.json':'map.json')&&manifest.issuerFingerprint===sha(Buffer.from(publicKey??'')),'双网格清单权威不一致');
 let valid=false;try{valid=crypto.verify(null,Buffer.from(canonical(authority)),publicKey,Buffer.from(signature??'','base64'));}catch{}assert(valid,'双网格发行签名错误');
 assert(Array.isArray(manifest.entries)&&manifest.entries.length===records.length-1,'双网格清单缺条目');const seen=new Set();let total=0;
 for(const e of manifest.entries){assert(typeof e.path==='string'&&e.path!=='manifest.json'&&!seen.has(e.path)&&files[e.path]&&sha(files[e.path])===e.sha256&&files[e.path].length===e.byteLength,'双网格条目哈希/长度错误');seen.add(e.path);total+=e.byteLength;}
 assert(records.every(r=>r.path==='manifest.json'||seen.has(r.path)),'双网格存在未登记条目');assert(records.length<=(schemaVersion==='2dw-zip/9'?64:512)&&total<=(schemaVersion==='2dw-zip/9'?32:64)*1024*1024,'双网格解压预算超限');return{files,records,manifest};
}
module.exports={signFiles,readSigned,json};
