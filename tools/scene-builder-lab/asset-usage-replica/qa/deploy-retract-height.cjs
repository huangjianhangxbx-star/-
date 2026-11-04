const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),candidate=path.join(root,'candidate'),project=path.resolve(root,'../../procedural-world-editor/LE-01/星骸地编'),previous='1D90F68BF3D636FA56F106FE053857F28362E44DB79DF4A224FF5463981034B3';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase(),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
function fingerprint(base){return sha(Buffer.from(walk(path.join(base,'Assets/BridgeReplica')).filter(p=>p.endsWith('.cs')&&!p.split(path.sep).join('/').includes('/Editor/QA/')).sort().map(p=>path.relative(base,p).split(path.sep).join('/')+'|'+sha(fs.readFileSync(p))).join('\n')));}
const sourceHash=fingerprint(candidate),checks=['stroke-gesture-core-green.json','stroke-retraction-height-green.json','drawing-recovery-green.json','continuation-actual-gesture-green.json','continuation-input-green.json'];
for(const p of checks)if(read('reports/'+p).status!=='PASS')throw Error('Relevant regression not PASS '+p);
for(const p of ['drawing-usability.json','drawing-usability-reopen.json','stroke-height-geometry-green.json','stroke-height-reopen.json']){const r=read('reports/'+p);if(r.status!=='PASS'||r.sourceHash!==sourceHash)throw Error('Final production source not verified '+p);}
const before=fingerprint(project);if(before!==previous&&before!==sourceHash)throw Error('Unexpected existing source preserved');
const files=[];
// Install the new dependency and its GUID before the window references it.
for(const q of ['Runtime/Core/CurveGesture.cs','Editor/ReplicaWindow.cs'])
{
 const relativePath='Assets/BridgeReplica/'+q,dst=path.join(project,relativePath),src=path.join(candidate,relativePath),existed=fs.existsSync(dst),metaHash=fs.existsSync(dst+'.meta')?sha(fs.readFileSync(dst+'.meta')):null;
 if(!metaHash)fs.copyFileSync(src+'.meta',dst+'.meta');else if(sha(fs.readFileSync(src+'.meta'))!==metaHash)throw Error('Refuse GUID change '+relativePath);
 fs.copyFileSync(src,dst);const metaSha256=sha(fs.readFileSync(dst+'.meta'));if(sha(fs.readFileSync(dst))!==sha(fs.readFileSync(src)))throw Error('Source copy mismatch');
 files.push({relativePath,added:!existed,sha256:sha(fs.readFileSync(dst)),metaSha256});
}
if(fingerprint(project)!==sourceHash)throw Error('Deployment fingerprint differs');
const r={status:'PASS',sourceHash,previousSourceHash:previous,files,scenesModified:false,kitsModified:false,existingGuidsChanged:false,researchEditorClosed:false,desktopUsed:false,physicalMouseTested:false,checks:{core:20,retractAndHeightGestures:14,heightGeometry:3,heightWalkingRays:1152,heightWalkingMisses:0,heightNativeReopen:true,oldRecovery:9,oldGrab:7,oldPorts:10,oldMeshTraces:12,oldMeshChecks:18,oldNativeReopen:true},controls:'Left drag XZ; retrace accepted stroke to shorten; initially inward endpoint drag trims existing bridge; Shift vertical mouse locks XZ and adjusts endpoint height.',mappingReopen:'Native persisted mapping is checked exactly before rebuild; after rebuild transient Unity object IDs are compared semantically with stable source asset identity, while route and geometry remain exact.',knownSeparateFinding:'Intermittent GUILayout log finding remains outside this patch.'};
fs.writeFileSync(path.join(root,'reports/retract-height-delivery.json'),JSON.stringify(r,null,2));console.log(JSON.stringify({status:r.status,sourceHash,files:files.length,researchEditorClosed:false}));
