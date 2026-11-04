const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),candidate=path.join(root,'candidate'),project=path.resolve(root,'../../procedural-world-editor/LE-01/星骸地编'),previous='909A925A36D63FA97629F2BEC6745533AFDAAD5F27B21F27B3B4F551E50E23E9';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase(),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
function fingerprint(base){return sha(Buffer.from(walk(path.join(base,'Assets/BridgeReplica')).filter(p=>p.endsWith('.cs')&&!p.split(path.sep).join('/').includes('/Editor/QA/')).sort().map(p=>path.relative(base,p).split(path.sep).join('/')+'|'+sha(fs.readFileSync(p))).join('\n')));}
const sourceHash=fingerprint(candidate),reports=['drawing-recovery-green.json','drawing-curve-tolerance-green.json','rebuild-mapping-green.json','continuation-actual-gesture-green.json','continuation-input-green.json','bend-feasibility-green.json','bend-fixed-baseline-compatibility.json','recovery-curve-core-green.json','recovery-freehand-seeded-green.json'];
for(const p of reports)if(read('reports/'+p).status!=='PASS')throw Error('Relevant regression not PASS '+p);
for(const p of ['drawing-usability.json','drawing-usability-reopen.json']){const r=read('reports/'+p);if(r.status!=='PASS'||r.sourceHash!==sourceHash)throw Error('Final source not verified '+p);}
const before=fingerprint(project);if(before!==previous&&before!==sourceHash)throw Error('Unexpected existing source preserved');
const files=[];
for(const q of ['Editor/ReplicaWindow.cs','Runtime/Core/CurveSolver.cs','Editor/CurveGeometry.cs','Editor/ReplicaSession.cs'])
{
 const relativePath='Assets/BridgeReplica/'+q,dst=path.join(project,relativePath),src=path.join(candidate,relativePath),metaSha256=sha(fs.readFileSync(dst+'.meta'));
 fs.copyFileSync(src,dst);if(sha(fs.readFileSync(dst))!==sha(fs.readFileSync(src))||sha(fs.readFileSync(dst+'.meta'))!==metaSha256)throw Error('Source or GUID mismatch');
 files.push({relativePath,sha256:sha(fs.readFileSync(dst)),metaSha256});
}
if(fingerprint(project)!==sourceHash)throw Error('Deployment hash differs');
const r={status:'PASS',sourceHash,previousSourceHash:previous,files,scenesModified:false,kitsModified:false,desktopUsed:false,physicalMouseTested:false,researchEditorClosed:false,scenePreservation:'Existing Editor left open; ordinary script reload applies the four source updates. No scene file or author data was edited by deployment.',checks:{recovery:9,curveMesh:4,mapping:3,grab:7,ports:10,meshTraces:12,meshChecks:18,independentReopen:true},knownSeparateFinding:'Previous intermittent GUILayout log finding remains outside this patch.'};
fs.writeFileSync(path.join(root,'reports/recovery-fix-delivery.json'),JSON.stringify(r,null,2));console.log(JSON.stringify({status:r.status,sourceHash,files:files.length,researchEditorClosed:false}));
