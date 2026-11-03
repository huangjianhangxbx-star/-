'use strict';
// Package only this tool overlay after qa/assemble.cjs has completed. No Engine,
// deployment, publishing, cleanup or installation is performed by this script.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const archive=path.join(root,'asset-usage-replica-tool-subset-20261104.zip');
const reportPath=path.join(root,'reports/package-consistency.json');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
function requireCondition(value,message){if(!value)throw new Error(message);}
function relative(file){return path.relative(root,file).split(path.sep).join('/');}
function walk(folder){
  if(!fs.existsSync(folder))return [];
  const result=[];
  for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
    const file=path.join(folder,entry.name),stat=fs.lstatSync(file);
    requireCondition(!stat.isSymbolicLink(),'Links/junctions are not package inputs: '+relative(file));
    if(stat.isDirectory()){
      if(/^(?:unity-session|Library|Temp|Logs|UserSettings|bin|obj|__pycache__|node_modules|\.git)$/i.test(entry.name))continue;
      result.push(...walk(file));
    }else if(stat.isFile())result.push(file);
  }
  return result;
}
function productionHash(folder){
  const source=walk(folder).filter(file=>file.endsWith('.cs')&&!relative(file).includes('/Editor/QA/')).sort();
  requireCondition(source.length>0,'Assembled production C# source is missing.');
  return sha(Buffer.from(source.map(file=>fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')).join('\n')));
}
function approvedPath(name){
  requireCondition(!path.posix.isAbsolute(name)&&!name.split('/').some(p=>p==='..'||p==='')&&!name.includes('\\'),'Unsafe archive path: '+name);
  requireCondition(!/(?:^|\/)(?:private|raw-originals|prepared-mods|third-party|third_party|参考游戏研究|tiny glade)(?:\/|$)/i.test(name),'Private or third-party research input rejected: '+name);
  requireCondition(!/(?:^|\/)(?:unity-session|Library|Temp|Logs|UserSettings|bin|obj|__pycache__|node_modules|\.git)(?:\/|$)/i.test(name),'Temporary/history input rejected: '+name);
  requireCondition(!/\.(?:log|bak|blend1|pyc|pdb|exe|dll)$/i.test(name),'Intermediate/binary input rejected: '+name);
  requireCondition(!/(?:^|\/)[^/]*(?:initial-red|regression|behavior-red|load-revision-red|cadence-direction-red|probe)[^/]*(?:\.|$)/i.test(name),'Regression output rejected: '+name);
}
function main(){
  requireCondition(!fs.existsSync(archive),'Archive already exists and will not be overwritten: '+archive);
  requireCondition(!fs.existsSync(reportPath),'Package receipt already exists; inspect it before creating another archive.');
  const requiredReports=['route-core-tests.json','route-input-synthetic.json','workflow-A.json','workflow-A-reopen.json','workflow-kit-swap.json','workflow-B-reopen.json','representative-performance.json','delivery.json'];
  const evidence={};
  for(const name of requiredReports){
    const file=path.join(root,'reports',name);requireCondition(fs.existsSync(file),'Run the related validation/assembly first: reports/'+name);
    evidence[name]=read('reports/'+name);requireCondition(evidence[name].status==='PASS','Evidence is not PASS: '+name);
  }
  const delivery=evidence['delivery.json'],swap=evidence['workflow-kit-swap.json'];
  requireCondition(delivery.overlayOnly===true,'Expected an overlay-only assembled delivery.');
  const sourceHash=productionHash(path.join(root,'candidate/Assets/BridgeReplica'));
  requireCondition(sourceHash===delivery.sourceHash&&sourceHash===swap.sourceHash&&sourceHash===swap.frozenBefore&&sourceHash===swap.frozenAfter,'Candidate production bytes differ from assembled/frozen swap evidence.');
  requireCondition(swap.familySpecBefore===swap.familySpecAfter&&swap.familySpecAfter===sha(fs.readFileSync(path.join(root,'kit-spec/bridge-orthogonal-family-v1.md'))),'Interface spec changed after the independent B swap.');
  for(const name of ['workflow-A.json','workflow-A-reopen.json','workflow-B-reopen.json']){
    requireCondition(evidence[name].sourceHash===sourceHash,'Stale production evidence: '+name);
    requireCondition(evidence[name].cleanSceneHasNoLegacyFixture===true,'Delivery scene still contains validation fixtures: '+name);
  }
  requireCondition(swap.cleanSceneHasNoLegacyFixture===true,'B sample is not clean.');
  for(const result of [evidence['workflow-A.json'],evidence['workflow-A-reopen.json'],swap,evidence['workflow-B-reopen.json']]){
    for(const dependency of result.sampleDependencies||[]){
      if(dependency.startsWith('Assets/BridgeReplica/'))requireCondition(fs.existsSync(path.join(root,'candidate',dependency)),'Assembled scene dependency missing: '+dependency);
      else if(dependency.startsWith('Assets/'))requireCondition(dependency.startsWith('Assets/LE01/Rendering/')||(dependency.startsWith('Assets/SB03/')&&dependency.endsWith('.cs')),'Legacy test asset leaked into sample dependencies: '+dependency);
    }
  }
  const manifest=read('kits/B/kit-manifest.json');
  requireCondition(manifest.id==='workshop.bridge.B'&&manifest.family==='bridge-orthogonal-v1'&&manifest.assets&&manifest.assets.length===9,'Independent B source manifest is incomplete.');
  for(const asset of manifest.assets)for(const key of ['source','fbx','palette','preview']){
    requireCondition(typeof asset[key]==='string'&&!path.isAbsolute(asset[key]),'B source paths must be relative.');
    const name=path.posix.normalize('kits/B/'+asset[key].replace(/\\/g,'/'));approvedPath(name);
    requireCondition(name.startsWith('kits/B/')&&fs.existsSync(path.join(root,name)),'Missing independent B source: '+name);
  }
  let fflate,fflatePath;
  try{fflatePath=require.resolve('fflate',{paths:[path.resolve(root,'../../../game'),__dirname]});fflate=require(fflatePath);}
  catch(error){throw new Error('Existing fflate dependency is required (available in Origin/game/node_modules); this script does not install dependencies. '+error.message);}
  const entries=new Map();
  function add(file){
    const name=relative(file);approvedPath(name);requireCondition(!entries.has(name),'Duplicate archive entry: '+name);
    const bytes=fs.readFileSync(file);requireCondition(bytes.length<64*1024*1024,'Unexpectedly large individual input: '+name);
    entries.set(name,{file,bytes,sha256:sha(bytes)});
  }
  // The candidate itself is only the new namespace. Existing SB03 code and its
  // source library remain an explicit dependency, never copied into this zip.
  for(const file of walk(path.join(root,'candidate'))){
    const name=relative(file);requireCondition(name==='candidate/Assets/BridgeReplica.meta'||name.startsWith('candidate/Assets/BridgeReplica/'),'Candidate contains another project or old SB03 source: '+name);add(file);
  }
  for(const folder of ['guide','kit-spec','kits/B'])for(const file of walk(path.join(root,folder))){
    if(/\.(?:blend1|bak|log|pyc)$/i.test(file))continue;add(file);
  }
  add(path.join(root,'notes/approved-execution-plan-v0.1.md'));
  add(path.join(root,'README.md'));
  requireCondition(fs.readFileSync(path.join(root,'README.md'),'utf8').includes('SB03'),'README must declare the existing SB03 dependency.');
  for(const file of walk(path.join(root,'review')))if(/\.(?:html|css|js|cjs|json|png|svg|webp|jpg|jpeg)$/i.test(file))add(file);
  // Only current workflow shots are needed. Earlier failed-run probes are not
  // selected merely because a PNG happens to be in the screenshots directory.
  const shots=new Set();for(const result of Object.values(evidence))for(const shot of result.shots||[])if(shot.image)shots.add(shot.image);
  for(const name of shots){requireCondition(name.startsWith('samples/screenshots/')&&name.endsWith('.png'),'Unexpected workflow image path: '+name);add(path.join(root,name));}
  for(const file of walk(path.join(root,'samples'))){const name=relative(file);if(!name.startsWith('samples/screenshots/')&&/\.(?:bridge-route\.json|json)$/i.test(name)&&!/(?:invalid|red|regression|probe)/i.test(name))add(file);}
  for(const file of walk(path.join(root,'qa'))){
    const name=relative(file);
    if(/\.(?:cs|csproj|cjs|js|py|ps1|md)$/i.test(name)){if(!/(?:initial-red|regression|probe)/i.test(path.basename(name)))add(file);continue;}
    if(name.endsWith('.json')){
      let data;try{data=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch{continue;}
      if(data.status==='PASS'&&!/(?:red|regression|probe)/i.test(path.basename(name)))add(file);
    }else if(/^qa\/kit-B\//.test(name)&&/\.(?:png|svg)$/i.test(name)&&!/(?:red|regression|probe)/i.test(path.basename(name)))add(file);
  }
  for(const file of walk(path.join(root,'reports'))){
    const name=relative(file),base=path.basename(name);
    if(!base.endsWith('.json')||/^(?:package-consistency|github-publication|relevant-baseline|swap-baseline-before|cleanup)/.test(base)||/(?:red|regression|probe)/i.test(base))continue;
    let data;try{data=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch{continue;}
    const expected=/^route-[AB]-expected\.json$/.test(base)&&data.sourceHash===sourceHash;
    if(data.status==='PASS'||expected){if(data.sourceHash)requireCondition(data.sourceHash===sourceHash,'Stale report would be packaged: '+base);add(file);}
  }
  for(const name of requiredReports)requireCondition(entries.has('reports/'+name),'Required receipt was not selected: '+name);
  requireCondition(entries.has('qa/package.cjs'),'Packaging reproduction script was not selected.');
  const selected=[...entries].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0),payload=Object.create(null);
  for(const [name,value] of selected)payload[name]=new Uint8Array(value.bytes);
  const zipped=Buffer.from(fflate.zipSync(payload,{level:6,mtime:new Date(2026,10,4,0,0,0)}));
  requireCondition(zipped.length<99*1024*1024,'Subset archive exceeded the expected source-package budget.');
  // Exclusive creation preserves any pre-existing archive, including a package
  // another task might create between preflight and this write.
  fs.writeFileSync(archive,zipped,{flag:'wx'});
  const diskBytes=fs.readFileSync(archive),unpacked=fflate.unzipSync(new Uint8Array(diskBytes));
  const actualNames=Object.keys(unpacked).sort(),expectedNames=selected.map(([name])=>name);
  requireCondition(actualNames.length===expectedNames.length&&actualNames.every((name,i)=>name===expectedNames[i]),'ZIP file list differs from the approved subset list.');
  const manifestFiles=[];
  for(const [name,value] of selected){
    approvedPath(name);const output=Buffer.from(unpacked[name]);
    requireCondition(output.length===value.bytes.length&&output.equals(value.bytes)&&sha(output)===value.sha256,'ZIP decompressed bytes differ: '+name);
    requireCondition(sha(fs.readFileSync(value.file))===value.sha256,'Source changed during packaging: '+name);
    manifestFiles.push({relativePath:name,path:name,bytes:value.bytes.length,sha256:value.sha256,zipBytesEqual:true});
  }
  requireCondition(productionHash(path.join(root,'candidate/Assets/BridgeReplica'))===sourceHash,'Production source changed during packaging.');
  const result={status:'PASS',format:'bridge-replica-tool-subset-v1',publicPath:'tools/scene-builder-lab/asset-usage-replica',overallTaskStatus:'PARTIAL',scope:'Overlay tool subset G2/G3; original-game controlled replacement and physical-input gates remain outstanding',gates:{G1:'PENDING_ORIGINAL_CONTROLLED_REPLACEMENT',G2:'PASS',G3:'PASS',G4:'PENDING_PHYSICAL_INPUT'},archive,archiveFileName:path.basename(archive),archiveSha256:sha(diskBytes),sourceHash,bytes:diskBytes.length,entries:manifestFiles.length,uncompressedBytes:manifestFiles.reduce((n,f)=>n+f.bytes,0),allEntriesVerified:true,allDecompressedBytesEqual:true,requiresExistingSB03:true,oldSB03SourceIncluded:false,fullUnityProject:false,temporaryProjectIncluded:false,thirdPartyOriginalsIncluded:false,zipLibrary:'fflate (existing repository dependency)',zipLibraryPath:fflatePath,files:manifestFiles};
  fs.writeFileSync(reportPath,JSON.stringify(result,null,2),{flag:'wx'});
  console.log(JSON.stringify({status:result.status,overallTaskStatus:result.overallTaskStatus,archive,archiveSha256:result.archiveSha256,sourceHash,entries:result.entries,bytes:result.bytes,allDecompressedBytesEqual:true},null,2));
}
try{main();}catch(error){console.error('Package not certified: '+error.message);process.exitCode=1;}
