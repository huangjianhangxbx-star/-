const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),candidate=path.join(root,'candidate'),project=path.resolve(root,'../../procedural-world-editor/LE-01/星骸地编'),previous='9ADDDAC98149C4BBDA2E188551744517E10DFCB68BD86EB5706A87C08D01F5F0';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase(),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
function fingerprint(base){return sha(Buffer.from(walk(path.join(base,'Assets/BridgeReplica')).filter(p=>p.endsWith('.cs')&&!p.split(path.sep).join('/').includes('/Editor/QA/')).sort().map(p=>path.relative(base,p).split(path.sep).join('/')+'|'+sha(fs.readFileSync(p))).join('\n')));}
const sourceHash=fingerprint(candidate),run=read('reports/drawing-usability.json'),reopen=read('reports/drawing-usability-reopen.json');
for(const name of ['continuation-actual-gesture-green.json','continuation-input-green.json'])if(read('reports/'+name).status!=='PASS')throw Error('Relevant input regression not PASS');
if(run.status!=='PASS'||reopen.status!=='PASS'||run.sourceHash!==sourceHash||reopen.sourceHash!==sourceHash)throw Error('Actual final engine source not verified');
if(fingerprint(project)!==previous&&fingerprint(project)!==sourceHash)throw Error('Unexpected existing source preserved');
const relative='Assets/BridgeReplica/Editor/ReplicaWindow.cs',src=path.join(candidate,relative),dst=path.join(project,relative),meta=dst+'.meta',metaHash=sha(fs.readFileSync(meta));
const backup=path.join(root,'reports/grab-fix-baseline-20261104');fs.mkdirSync(backup,{recursive:true});const old=path.join(backup,'ReplicaWindow.cs');if(!fs.existsSync(old))fs.copyFileSync(dst,old);
fs.copyFileSync(src,dst);if(fingerprint(project)!==sourceHash||sha(fs.readFileSync(meta))!==metaHash)throw Error('Source or GUID mismatch');
const report={status:'PASS',scope:'Endpoint drag anchor preservation after positive hit',sourceHash,previousSourceHash:previous,files:[{relativePath:relative,sha256:sha(fs.readFileSync(dst)),metaSha256:metaHash}],scenesModified:false,kitsModified:false,desktopUsed:false,physicalMouseTested:false,gestureCases:read('reports/continuation-actual-gesture-green.json').checks.length,knownSeparateFinding:'A prior real Editor log contains GUILayout errors; two shown-window checks did not reproduce them. This patch does not claim to fix that independent finding.'};
fs.writeFileSync(path.join(root,'reports/grab-fix-delivery.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,sourceHash,files:1,gestureCases:report.gestureCases}));
