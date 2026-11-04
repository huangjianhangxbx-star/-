const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),candidate=path.join(root,'candidate'),project=path.resolve(root,'../../procedural-world-editor/LE-01/星骸地编');
const previous='739EB9587E8931E7F8D317CD328AD6F6986FA0CEFC5CF7B7F326373E3DE5EA3D';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase(),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
function fingerprint(base){return sha(Buffer.from(walk(path.join(base,'Assets/BridgeReplica')).filter(p=>p.endsWith('.cs')&&!p.split(path.sep).join('/').includes('/Editor/QA/')).sort().map(p=>path.relative(base,p).split(path.sep).join('/')+'|'+sha(fs.readFileSync(p))).join('\n')));}
const sourceHash=fingerprint(candidate),suite=read('reports/height-turn-final-suite.json');
if(suite.status!=='PASS'||suite.sourceHash!==sourceHash||suite.stages.length!==12||suite.stages.some(s=>s.status!=='PASS'||!s.fresh))throw Error('Fresh final suite for this source required');
for(const stage of suite.stages){const r=read('reports/'+stage.report);if(r.status!=='PASS'||(r.sourceHash&&r.sourceHash!==sourceHash))throw Error('Final report drift '+stage.report);if(new Date(fs.statSync(path.join(root,'reports',stage.report)).mtime).getTime()<new Date(stage.startedUtc).getTime())throw Error('Stale report '+stage.report);}
if(read('reports/curve-brush-core-green.json').status!=='PASS')throw Error('Pure core regression required');
const before=fingerprint(project);if(before!==previous&&before!==sourceHash)throw Error('Unexpected project source preserved');
const files=[];
// Install the new dependency and stable GUID before the Window references it.
for(const q of ['Runtime/Core/CurveBrush.cs','Editor/CurveGeometry.cs','Editor/ReplicaWindow.cs']){
 const relativePath='Assets/BridgeReplica/'+q,dst=path.join(project,relativePath),src=path.join(candidate,relativePath),existed=fs.existsSync(dst),metaHash=fs.existsSync(dst+'.meta')?sha(fs.readFileSync(dst+'.meta')):null;
 if(metaHash&&sha(fs.readFileSync(src+'.meta'))!==metaHash)throw Error('Refuse GUID change '+relativePath);
 if(!metaHash)fs.copyFileSync(src+'.meta',dst+'.meta');fs.copyFileSync(src,dst);
 if(sha(fs.readFileSync(dst))!==sha(fs.readFileSync(src)))throw Error('Source copy mismatch');
 files.push({relativePath,added:!existed,sha256:sha(fs.readFileSync(dst)),metaSha256:sha(fs.readFileSync(dst+'.meta'))});
}
if(fingerprint(project)!==sourceHash)throw Error('Deployment differs');
const report={status:'PASS',sourceHash,previousSourceHash:previous,files,scenesModified:false,kitsModified:false,existingGuidsChanged:false,researchEditorClosed:false,desktopUsed:false,physicalMouseTested:false,freshSuite:'height-turn-final-suite.json',controls:'Left drag planar path; Shift vertical drag adjusts reachable height; existing endpoints can be lifted directly. Large corners inside the new stroke become visible design fillets. Retrace the actual visible curve to retract.',limitations:['Actual human mouse session not repeated.','Committed old-joint immediate sharp turn remains constrained; extend along the old direction first.','True fold/self-cross and enabled opening protection remain.','Intermittent old GUILayout log finding is outside this patch.']};
fs.writeFileSync(path.join(root,'reports/height-turn-delivery.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,sourceHash,files:files.length,researchEditorClosed:false}));
