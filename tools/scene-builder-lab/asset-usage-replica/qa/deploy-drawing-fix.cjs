'use strict';
// Narrow source patch only. The calling task verifies the research Editor is
// closed first. No scenes, kits, existing GUIDs or foreign modules are written.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),candidate=path.join(root,'candidate'),project=path.resolve(root,'../../procedural-world-editor/LE-01/星骸地编');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase(),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function sourceHash(base){return hash(Buffer.from(walk(path.join(base,'Assets/BridgeReplica')).filter(f=>f.endsWith('.cs')&&!f.split(path.sep).join('/').includes('/Editor/QA/')).sort().map(f=>path.relative(base,f).split(path.sep).join('/')+'|'+hash(fs.readFileSync(f))).join('\n')));}
const now=sourceHash(candidate),run=read('reports/drawing-usability.json'),reopen=read('reports/drawing-usability-reopen.json'),ports=read('reports/continuation-input-green.json'),core=read('reports/freehand-regression-green.json');
if([run,reopen,ports,core].some(r=>r.status!=='PASS')||run.sourceHash!==now||reopen.sourceHash!==now)throw Error('Actual final source/targeted checks not verified');
const existing=sourceHash(project);if(existing!=='1FBBFD8595EF8154E7E641D702B6A692DCDB6D352072D5E631260661D93E3C85'&&existing!==now)throw Error('Unexpected research tool edits preserved before deployment');
const changes=['Editor/ReplicaWindow.cs','Runtime/Core/CurveSketch.cs','Runtime/Core/CurveSolver.cs'];
for(const p of changes){const old=path.join(root,'reports/drawing-fix-baseline-20261104',p.replaceAll('/','__')),dst=path.join(project,'Assets/BridgeReplica',p),src=path.join(candidate,'Assets/BridgeReplica',p);if(hash(fs.readFileSync(dst))!==hash(fs.readFileSync(old))&&hash(fs.readFileSync(dst))!==hash(fs.readFileSync(src)))throw Error('Unexpected user edit preserved '+p);}
const receipt={status:'PASS',stage:'DRAWING_USABILITY_FIX_DEPLOYED',projectName:'星骸地编',sourceHash:now,previousSourceHash:'1FBBFD8595EF8154E7E641D702B6A692DCDB6D352072D5E631260661D93E3C85',files:[],scenesModified:false,kitsModified:false,existingMetaReplaced:false,desktopUsed:false,physicalMouseTested:false,researchMaterialsChanged:false,scope:'Dense ordinary drawing and same-author first/last endpoint continuation; branches and merging two existing authors remain unsupported.'};
for(const p of changes){const src=path.join(candidate,'Assets/BridgeReplica',p),dst=path.join(project,'Assets/BridgeReplica',p);const meta=dst+'.meta',metaBefore=hash(fs.readFileSync(meta));fs.copyFileSync(src,dst);if(hash(fs.readFileSync(dst))!==hash(fs.readFileSync(src))||hash(fs.readFileSync(meta))!==metaBefore)throw Error('Source/GUID copy mismatch '+p);receipt.files.push({relativePath:'Assets/BridgeReplica/'+p,sha256:hash(fs.readFileSync(dst)),metaSha256:metaBefore});}
if(sourceHash(project)!==now)throw Error('Deployed source differs from actual verified source');
fs.writeFileSync(path.join(root,'reports/drawing-fix-delivery.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({status:receipt.status,sourceHash:now,files:receipt.files.length,scenesModified:false,desktopUsed:false},null,2));
