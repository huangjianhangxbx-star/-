'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
const delivery=read('reports/v02-delivery.json'),closure=read('reports/v02-delivery-public.json');
if(delivery.status!=='PASS'||!delivery.deployed||closure.status!=='PASS'||delivery.sourceHash!==closure.productionSourceHash)throw Error('Verified deployed v2 required');
for(const p of ['v02-real-geometry.json','v02-input-api.json','v02-curve-lifecycle.json','v02-curve-reopen.json','v02-persistence-input-green.json','v02-exact-stair-green.json'])if(read('reports/'+p).status!=='PASS')throw Error('Required v2 evidence '+p);
const files=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(fs.lstatSync(f).isSymbolicLink())throw Error('Link input');if(e.isDirectory()){if(!/^(?:unity-session|Library|Temp|Logs|UserSettings|bin|obj|node_modules|\.git|deploy-v02-backup.*)$/i.test(e.name))walk(f);}else files.push(f);}}
for(const p of ['candidate','guide','kit-spec','kits/B','review','samples','qa'])walk(path.join(root,p));
files.push(path.join(root,'README.md'),path.join(root,'notes/approved-correction-plan-v0.2.md'));
for(const f of fs.readdirSync(path.join(root,'reports')))if(f.endsWith('.json')&&!/baseline|cleanup|package|publication|delivery\.json|^deploy-/i.test(f))files.push(path.join(root,'reports',f));
const selected=[];for(const file of files){const relative=path.relative(root,file).split(path.sep).join('/');
 if(/(^|\/)(ResearchPrivate|参考游戏研究|raw-originals|prepared-mods|controlled-source|controlled-changed-snapshot)(\/|\.)/i.test(relative))throw Error('Private input '+relative);
 if(/\.(?:log|bak|blend1|pyc|pdb|exe|dll|tmp)$/i.test(relative))continue;
 if(relative.startsWith('qa/')&&!/\.(?:cs|csproj|cjs|js|py|ps1|md|png|svg)$/i.test(relative))continue;
 if(relative.startsWith('samples/')&&/invalid|malformed|probe/i.test(relative))continue;
 if(/\.(?:asset|prefab|unity|mat|json)$/i.test(relative)&&!relative.startsWith('qa/')){const text=fs.readFileSync(file,'utf8');if(/research\.tinyglade\.partial|ResearchOnly:\s*1\b|\/ResearchPrivate\//.test(text))throw Error('Private serialized dependency '+relative);}
 selected.push({relativePath:relative,bytes:fs.statSync(file).size,sha256:hash(fs.readFileSync(file))});}
selected.sort((a,b)=>a.relativePath.localeCompare(b.relativePath,'en'));if(new Set(selected.map(f=>f.relativePath)).size!==selected.length)throw Error('Duplicate package file');
for(const record of closure.files.filter(f=>f.relativePath.startsWith('Assets/BridgeReplica/')&&!f.relativePath.includes('/ResearchPrivate/'))){const p='candidate/'+record.relativePath;const f=selected.find(f=>f.relativePath===p);if(!f||f.sha256!==record.sha256)throw Error('Actual dependency closure not reproduced '+p);}
const production=closure.productionSources.map(f=>({relativePath:f.relativePath,sha256:hash(fs.readFileSync(path.join(root,'candidate',f.relativePath)))})).sort((a,b)=>a.relativePath<b.relativePath?-1:1);
if(hash(Buffer.from(production.map(f=>f.relativePath+'|'+f.sha256).join('\n')))!==delivery.sourceHash)throw Error('Source drift after tests');
const {zipSync,unzipSync}=require(require.resolve('fflate',{paths:[path.resolve(root,'../../../game')]}));
const payload=Object.fromEntries(selected.map(f=>[f.relativePath,new Uint8Array(fs.readFileSync(path.join(root,f.relativePath)))]));
const archive='asset-usage-replica-freehand-v02-background-20261104.zip',full=path.join(root,archive);if(fs.existsSync(full))throw Error('Preserve existing archive; version a new delivery');
const bytes=Buffer.from(zipSync(payload,{level:6,mtime:new Date(2026,10,4)}));fs.writeFileSync(full,bytes,{flag:'wx'});const extracted=unzipSync(new Uint8Array(fs.readFileSync(full)));
if(Object.keys(extracted).length!==selected.length)throw Error('ZIP entry mismatch');for(const f of selected)if(hash(extracted[f.relativePath])!==f.sha256||hash(fs.readFileSync(path.join(root,f.relativePath)))!==f.sha256)throw Error('Byte mismatch '+f.relativePath);
const result={status:'PASS',stage:'BACKGROUND_DELIVERED',overall:'PARTIAL',deferred:['T3 real mouse input','T11 original-game usage behavior'],sourceHash:delivery.sourceHash,archive,archiveSha256:hash(bytes),bytes:bytes.length,entries:selected.length,allDecompressedBytesEqual:true,requiresExistingSB03:true,thirdPartyOriginalsIncluded:false,temporaryProjectIncluded:false,actualDependencyClosureChecked:true,knownLimitation:delivery.knownLimitation,files:selected};
fs.writeFileSync(path.join(root,'reports/v02-package-consistency.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,files:undefined},null,2));
