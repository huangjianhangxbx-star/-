const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createHash}=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const core=require('../dist/workshop.cjs'),codec=require('../desktop/portable-asset.cjs');
const {exportSavedAssetFbx}=require('../desktop/workshop-v2-export.cjs');
const {createWorkshopV2Repository}=require('../desktop/workshop-v2-store.cjs');
const blender=process.env.XINGHAI_BLENDER??'D:/steam/steamapps/common/Blender/blender.exe';
const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],key=c=>`${c.x},${c.y},${c.z}`;
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
function fixture(){
 const a=core.createAsset('n3-export-original');a.cells=[];
 for(let x=0;x<3;x++)for(let y=0;y<2;y++)for(let z=0;z<3-x;z++)a.cells.push({x,y,z,color:0});
 const model=core.upgradeCanvases(a,'n3-export-stairs'),c=model.canvases[0];
 model.objects=[{objectId:'stairs',name:'Original stairs',canvasIds:[c.canvasId],originTicks:[0,0,0],cellKeys:c.cells.map(key)}];
 const hand={'0,0,2,4':{'17':'#ff5a31'}},hidden={'0,0,2,4':{'18':'#33ff55'}};
 c.paintSource={schema:'xinghai-surface-paint-1',density:64,faces:structuredClone(hand),layers:[{id:'hand',name:'Hand original',visible:true,locked:false,faces:hand},{id:'hidden',name:'Hidden original',visible:false,locked:true,faces:hidden}]};
 const domain=new core.StructureEdgeDomain(model,'stairs');
 const options={preset:'both',geometry:'asset',scope:'all',sideWidth:2,topWidth:1,sideColor:'#203d59',topColor:'#c7b19a',colorMode:'color',gain:.55,faces:[0,1,2,3,4,5],placement:'below'};
 const plan=core.generateEdgeBands(domain,options,c.paintSource),before=structuredClone(c.cells),original=structuredClone(c.paintSource.layers);
 c.paintSource=core.applyEdgeBands(c.paintSource,plan,{ids:['n3-side','n3-top']});
 assert.deepEqual(c.cells,before);assert.deepEqual(c.paintSource.layers.slice(2),original);assert.equal(plan.bands.length,2);
 assert.equal(c.paintSource.layers[0].faces['0,0,2,3']['224'],'#203d59');
 assert.equal(c.paintSource.layers[0].faces['0,0,2,3']['240'],'#203d59');
 assert.equal(c.paintSource.layers[0].faces['0,0,2,3']['208'],undefined,'2 px side strip stops before third row');
 assert.equal(c.paintSource.layers[1].faces['0,0,2,4']['0'],'#c7b19a');
 assert.equal(c.paintSource.layers[1].faces['0,0,2,4']['17'],undefined,'1 px top strip stops before second row');
 return core.validateAsset(model);
}
function expectations(model){
 const c=model.canvases[0],n=16,cells=new Set(c.cells.map(key)),samples=[];let exposed=0;
 for(const cell of c.cells)for(let face=0;face<6;face++){
  const delta=directions[face],neighbor=[cell.x+delta[0],cell.y+delta[1],cell.z+delta[2]].join(',');if(cells.has(neighbor))continue;exposed++;
  const coords=[cell.x,cell.y,cell.z],axis=face>>1,t=[0,1,2].filter(a=>a!==axis),faceKey=key(cell)+','+face;
  for(let v=0;v<n;v++)for(let u=0;u<n;u++){
   const index=v*n+u,p=coords.map(q=>q*.25);p[axis]+=(face%2?0:.25);p[t[0]]+=(u+.5)/64;p[t[1]]+=(v+.5)/64;
   const paint=c.paintSource.faces[faceKey]?.[index],base=model.palette[cell.color],tone=c.faceTone?.faces[faceKey];
   samples.push({point:p,face,rgb:rgb(core.appearanceColor(base,paint,tone)),key:faceKey,index,paint:paint??null});
  }
 }
 return {samples,bbox:[[0,0,0],[.75,.5,.75]],volume:c.cells.length*.25**3,area:exposed*.25**2};
}
test('N3 ordinary layers survive native/portable source and real GLB + FBX PNG UV readback at exact texel positions',async()=>{
 await fs.access(blender);assert.equal(typeof core.generateEdgeBands,'function','build current workshop core before this test');
 const root=await fs.mkdtemp(path.resolve('validation/n3-edge-export-')),model=fixture(),source=JSON.stringify(model),cases=[];
 await fs.writeFile(path.join(root,'native.xhmodule.json'),source);
 const reopened=core.validateAsset(JSON.parse(await fs.readFile(path.join(root,'native.xhmodule.json'),'utf8')));
 assert.deepEqual(reopened.canvases,model.canvases);assert.deepEqual(new core.CanvasSession(reopened).active.paintSource,model.canvases[0].paintSource);
 const {encodeOpaquePng}=await import('../core/painted-glb.ts'),previewPng=Buffer.from(encodeOpaquePng(1,1,new Uint8Array([255,0,0,255]))).toString('base64');
 const portable=codec.encode(model,previewPng,core);await fs.writeFile(path.join(root,'stairs.xhasset'),portable);
 assert.deepEqual(codec.decode(portable,core).document.canvases,model.canvases);
 const project=path.join(root,'project');await fs.mkdir(project);const repository=createWorkshopV2Repository(core),opened=await repository.create(project,core.createProjectV2('n3-export-project'));
 await repository.saveAsset(opened.token,model,previewPng);const freshRepository=createWorkshopV2Repository(core),fresh=await freshRepository.open(project),loaded=await freshRepository.loadAsset(fresh.token,model.assetId);
 assert.deepEqual(loaded.document.canvases,model.canvases);assert.deepEqual(loaded.document.objects,model.objects);
 for(const kind of ['plain','tone']){
  const a=structuredClone(model),c=a.canvases[0];
  if(kind==='tone')c.faceTone={schema:'xinghai-face-tone-1',faces:Object.fromEntries(Object.keys(c.paintSource.faces).map(k=>[k,{gain:.5,affectPaint:true}]))};
  const before=JSON.stringify(a),glb=path.join(root,kind+'.glb');await fs.writeFile(glb,core.exportAssetGlb(a));
  const out=await exportSavedAssetFbx({document:a,hash:createHash('sha256').update(before).digest('hex')},root,kind,blender,core);
  assert.equal(out.blenderVersion,'5.1.2');assert.ok(out.outputs.some(o=>o.path.endsWith('.png')));
  assert.equal(JSON.stringify(a),before,'export never alters native geometry, layers, tone, origin or Root');
  cases.push({name:kind,glb,fbx:out.file,...expectations(a)});
 }
 const expected=path.join(root,'expected.json');await fs.writeFile(expected,JSON.stringify(cases));
 const run=await promisify(execFile)(blender,['--background','--factory-startup','--python-exit-code','1','--python',path.resolve('tests/edge-band-export-readback.py'),'--',expected],{windowsHide:true,maxBuffer:8*1024*1024,timeout:180000});
 await fs.writeFile(path.join(root,'blender.log'),run.stdout+'\n'+run.stderr);
 const marker=run.stdout.split(/\r?\n/).find(l=>l.startsWith('N3_EXPORT '));assert.ok(marker,run.stdout);
 const report=JSON.parse(marker.slice(10));report.nativeRepository=true;report.portable=true;report.sideWidthPx=2;report.topWidthPx=1;
 assert.equal(report.cases.length,4);assert.ok(report.cases.every(c=>c.checkedPixels>0&&c.uvChecks>0));
 await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));assert.equal(JSON.stringify(model),source);
 console.log('N3 export evidence',root,JSON.stringify(report));
});
