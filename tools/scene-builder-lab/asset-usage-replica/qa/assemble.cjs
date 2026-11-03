const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'qa/unity-session/Assets/BridgeReplica'),candidate=path.join(root,'candidate/Assets/BridgeReplica');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,'')),hash=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
function files(folder){let out=[];for(const d of fs.readdirSync(folder,{withFileTypes:true})){const p=path.join(folder,d.name);if(d.isDirectory())out.push(...files(p));else out.push(p);}return out;}
function production(folder){return hash(Buffer.from(files(folder).filter(p=>p.endsWith('.cs')&&!path.relative(folder,p).split(path.sep).join('/').startsWith('Editor/QA/')).sort().map(p=>fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')).join('\n')));}
const reports=['route-core-tests.json','route-input-synthetic.json','workflow-A.json','workflow-A-reopen.json','workflow-kit-swap.json','workflow-B-reopen.json','representative-performance.json'];
for(const name of reports)if(read('reports/'+name).status!=='PASS')throw Error('Not passed: '+name);
const expected=read('reports/workflow-kit-swap.json');if(expected.frozenBefore!==expected.frozenAfter||expected.familySpecBefore!==expected.familySpecAfter)throw Error('Kit swap baselines differ');
if(production(qa)!==expected.frozenAfter||production(candidate)!==expected.frozenAfter)throw Error('Production source changed after frozen kit swap');
let copied=0;for(const p of files(qa)){
 const r=path.relative(qa,p).split(path.sep).join('/');if(r.startsWith('Editor/QA/')||r==='Editor/QA.meta'||r.startsWith('WorkScenes/')||r==='WorkScenes.meta')continue;
 const dest=path.join(candidate,r);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(p,dest);copied++;
}
fs.copyFileSync(path.join(path.dirname(qa),'BridgeReplica.meta'),path.join(root,'candidate/Assets/BridgeReplica.meta'));
const baseline=read('reports/relevant-baseline.json');for(const p of baseline)if(hash(fs.readFileSync(p.path))!==p.sha256)throw Error('Protected source changed: '+p.path);
const result={status:'PASS',scope:'Background tool subset G2/G3 only; original controlled replacement and physical-input gates remain separate',sourceHash:expected.frozenAfter,files:copied,protectedRelevantFiles:baseline.length,overlayOnly:true,deployed:false,permanentProjectCreated:false};
if(process.argv.includes('--deploy')){
 const project=path.resolve(root,'../../procedural-world-editor/LE-01/project'),assets=path.join(project,'Assets'),target=path.join(assets,'BridgeReplica'),stage=path.join(project,'.bridge-replica-stage');
 const intended=path.resolve('E:/WORLDCREATOR/XingHaiHuiLang/Origin/work/procedural-world-editor/LE-01/project');
 if(project.toLowerCase()!==intended.toLowerCase()||!target.startsWith(project+path.sep)||!stage.startsWith(project+path.sep))throw Error('Unexpected deployment target');
 if(fs.existsSync(target)||fs.existsSync(target+'.meta')||fs.existsSync(stage))throw Error('Existing deployment/staging preserved; inspect before replacing');
 fs.mkdirSync(stage);for(const p of files(candidate)){const r=path.relative(candidate,p),dest=path.join(stage,r);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(p,dest);if(hash(fs.readFileSync(p))!==hash(fs.readFileSync(dest)))throw Error('Copy mismatch '+r);}
 // Both checked absolute targets are inside the explicitly named research
 // project. Moving only the new staged tree makes the import atomic.
 fs.copyFileSync(path.join(root,'candidate/Assets/BridgeReplica.meta'),target+'.meta');fs.renameSync(stage,target);
 for(const p of baseline)if(hash(fs.readFileSync(p.path))!==p.sha256)throw Error('Protected source changed during deployment: '+p.path);
 if(production(target)!==expected.frozenAfter)throw Error('Deployed source fingerprint mismatch');result.deployed=true;result.project=project;
}
fs.writeFileSync(path.join(root,'reports/delivery.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
