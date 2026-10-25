import test from 'node:test';
import assert from 'node:assert/strict';
import { PaintSurfaceDomain, pixelKey } from '../core/paint-surface-domain.ts';
import { composeLayers, layerStack } from '../core/paint-layers.ts';
import { validateSurfacePaint, type SurfacePaint } from '../core/surface-paint.ts';
import { appearanceColor } from '../core/appearance-color.ts';
import { createAsset, type Cell } from '../core/workshop-documents.ts';
import { CanvasSession } from '../core/workshop-canvases.ts';
import { StructureEdgeDomain } from '../core/structure-edge-domain.ts';
import { validateEdgeBandOptions, generateEdgeBands, applyEdgeBands, edgeBandLayerSignature, type EdgeBandOptions, type EdgeBandDomain } from '../core/edge-band-plan.ts';

const options = (change:Partial<EdgeBandOptions>={}):EdgeBandOptions => ({preset:'side',geometry:'asset',scope:'all',sideWidth:2,topWidth:1,sideColor:'#123456',topColor:'#abcdef',colorMode:'color',gain:.5,faces:[0,1,2,3,4,5],placement:'below',...change});
function box(nx=1,ny=1,nz=1,n=16):EdgeBandDomain {
 const cells=Array.from({length:nx*ny*nz},(_,i)=>({x:i%nx,y:Math.floor(i/nx)%ny,z:Math.floor(i/(nx*ny))}));
 const d=new PaintSurfaceDomain(cells,new Set(cells.map(c=>`${c.x},${c.y},${c.z}`)),n/64),size=[nx*n,ny*n,nz*n],edges:any[]=[];
 for(let axis=0;axis<3;axis++){
  const fixed=[0,1,2].filter(a=>a!==axis);
  for(const sa of [0,1])for(const sb of [0,1]){
   const start=[0,0,0],end=[0,0,0];start[fixed[0]]=end[fixed[0]]=sa*size[fixed[0]];start[fixed[1]]=end[fixed[1]]=sb*size[fixed[1]];end[axis]=size[axis];
   edges.push({axis,start,end,faces:[fixed[0]*2+(sa?0:1),fixed[1]*2+(sb?0:1)]});
  }
 }
 const pixel=(face:number,plane:number,u:number,v:number)=>plane%n===0?d.pixel({face,plane:plane/n},u,v):null;
 return {canvasId:'canvas',objectId:'object',revision:7,fingerprint:'box',n,edges,diagnostics:{},pixel,surfaceExists:(...args)=>!!pixel(...args),globalUV:p=>d.uv(p),baseColor:()=> '#808080'};
}
const empty:SurfacePaint={schema:'xinghai-surface-paint-1',density:64,faces:{}};
function native(cells:Cell[],step=.25,origin:[number,number,number]=[0,0,0]){
 const session=new CanvasSession(createAsset('n3-bands')),canvas=session.active;
 canvas.cells=cells;canvas.voxelStepM=step;canvas.originTicks=origin;
 session.model.objects=[{objectId:'target',name:'Target',canvasIds:[canvas.canvasId],originTicks:[0,0,0],cellKeys:cells.map(c=>`${c.x},${c.y},${c.z}`)}];
 return session.model;
}

test('edge options reject unknown fields and unsafe values and normalize author colors and masks',()=>{
 assert.equal(validateEdgeBandOptions(options({sideColor:'#AbCdEf'})).sideColor,'#abcdef');
 assert.deepEqual(validateEdgeBandOptions(options({faces:[5,2,2]})).faces,[2,5]);
 for(const input of [{...options(),unknown:true},options({sideWidth:0}),options({topWidth:1.5}),options({gain:1.01}),options({sideColor:'red'}),options({faces:[6]}),options({selection:['0,0,0,4:0']})])assert.throws(()=>validateEdgeBandOptions(input));
 assert.throws(()=>validateEdgeBandOptions(options({scope:'selection'})));
 assert.throws(()=>validateEdgeBandOptions(options({scope:'selection',selection:['0,0,0,4:256']})));
 assert.deepEqual(validateEdgeBandOptions(options({scope:'selection',selection:['0,0,0,4:1','0,0,0,4:1']})).selection,['0,0,0,4:1']);
});
test('side and top presets generate only physical top edges, with union corners and exact pixel widths',()=>{
 const d=box(2,2,3),side=generateEdgeBands(d,options()),top=generateEdgeBands(d,options({preset:'top'})),both=generateEdgeBands(d,options({preset:'both'}));
 assert.equal(side.edgeCount,4);assert.equal(side.pixelCount,4*32*2);assert.equal(side.faceCount,8);
 assert.ok(Object.keys(side.bands[0].faces).every(k=>Number(k.split(',')[3])<4&&Number(k.split(',')[2])===2));
 assert.equal(top.pixelCount,32*32-30*30);assert.equal(top.faceCount,4);
 assert.equal(both.bands.length,2);assert.equal(both.pixelCount,side.pixelCount+top.pixelCount);
 assert.equal(both.bands[0].kind,'side');assert.equal(both.bands[1].kind,'top');
 assert.ok(Object.values(side.bands[0].faces).every(p=>Object.values(p).every(c=>c==='#123456')));
 for(const n of [4,8,16])assert.equal(generateEdgeBands(box(1,1,1,n),options()).pixelCount,4*n*2);
});
test('wide bands cross coplanar native faces but never jump over a missing surface',()=>{
 const d=box(1,1,3),wide=generateEdgeBands(d,options({sideWidth:20}));
 assert.equal(wide.pixelCount,4*16*20);assert.ok(Object.keys(wide.bands[0].faces).some(k=>k.startsWith('0,0,1,')));
 const disconnected={...d,surfaceExists:(f:number,p:number,u:number,v:number)=>v!==43&&d.surfaceExists(f,p,u,v)};
 assert.equal(generateEdgeBands(disconnected,options({sideWidth:20})).pixelCount,4*16*4);
});
test('selection clips real edge bands instead of creating edges at selection boundaries',()=>{
 const d=box(),interior=d.pixel(4,16,7,7)!,edge=d.pixel(4,16,0,7)!;
 assert.equal(generateEdgeBands(d,options({preset:'top',scope:'selection',selection:[]})).pixelCount,0);
 assert.equal(generateEdgeBands(d,options({preset:'top',scope:'selection',selection:[pixelKey(interior)]})).pixelCount,0);
 const selected=generateEdgeBands(d,options({preset:'top',scope:'selection',selection:[pixelKey(interior),pixelKey(edge)]}));
 assert.equal(selected.pixelCount,1);assert.equal(selected.bands[0].faces[edge.key][edge.index],'#abcdef');
 assert.equal(generateEdgeBands(d,options({preset:'side',faces:[4]})).pixelCount,0);
});
test('darken freezes original base color and overlapping convex bands darken exactly once',()=>{
 const d=box(),paint=composeLayers([{id:'hand',name:'手绘',visible:true,locked:false,faces:{'0,0,0,4':{'0':'#ffffff'}}}]);
 const plan=generateEdgeBands(d,options({preset:'convex',sideWidth:2,colorMode:'darken'}),paint);
 assert.equal(plan.edgeCount,12);assert.equal(plan.pixelCount,6*(16*16-12*12));
 const expected=appearanceColor('#808080',undefined,{gain:.5,affectPaint:false});
 assert.ok(Object.values(plan.bands[0].faces).every(p=>Object.values(p).every(c=>c===expected)));
 assert.equal(plan.coveredPixels,1);assert.deepEqual(paint.layers![0].faces,{'0,0,0,4':{'0':'#ffffff'}});
});
test('layer transaction protects hand originals, positions complete groups and safely replaces without cumulative pixels',()=>{
 const d=box(),hand={...empty,faces:{'0,0,0,4':{'0':'#ff0000'}}},snapshot=JSON.stringify(hand),plan=generateEdgeBands(d,options({preset:'both'}),hand);
 const first=applyEdgeBands(hand,plan,{ids:['edge-side','edge-top']});
 assert.deepEqual(first.layers!.map(l=>l.id),['edge-side','edge-top','base']);assert.equal(first.faces['0,0,0,4']['0'],'#ff0000');assert.equal(JSON.stringify(hand),snapshot);
 validateSurfacePaint(first,.25);const signature=edgeBandLayerSignature(first,['edge-side','edge-top']);
 assert.equal(applyEdgeBands(first,plan,{ids:['edge-side','edge-top'],replace:{ids:['edge-side','edge-top'],signature}}),first);
 const narrow=generateEdgeBands(d,options({preset:'both',sideWidth:1}),hand),replaced=applyEdgeBands(first,narrow,{ids:['edge-side','edge-top'],replace:{ids:['edge-side','edge-top'],signature}});
 assert.equal(Object.values(replaced.layers![0].faces).reduce((n,p)=>n+Object.keys(p).length,0),4*16);
 assert.deepEqual(replaced.layers![2],first.layers![2]);
 const above=applyEdgeBands(hand,plan,{ids:['new-side','new-top'],placement:'above'});assert.equal(above.faces['0,0,0,4']['0'],'#abcdef');
 const reorderedFaces=composeLayers(first.layers!.map(l=>({...l,faces:Object.fromEntries(Object.entries(l.faces).reverse())})));
 const canonicalSignature=edgeBandLayerSignature(reorderedFaces,['edge-side','edge-top']);assert.equal(canonicalSignature,signature);
 assert.equal(applyEdgeBands(reorderedFaces,plan,{ids:['edge-side','edge-top'],replace:{ids:['edge-side','edge-top'],signature:canonicalSignature}}),reorderedFaces,'equivalent serialized object order cannot add history');
 const modified=structuredClone(first);modified.layers![0].faces['0,0,0,0']['0']='#000000';
 assert.throws(()=>applyEdgeBands(composeLayers(modified.layers!),narrow,{ids:['edge-side','edge-top'],replace:{ids:['edge-side','edge-top'],signature}}),/改变|变化|冲突/);
 const reordered=composeLayers([first.layers![1],first.layers![0],first.layers![2]]);
 assert.throws(()=>applyEdgeBands(reordered,narrow,{ids:['edge-side','edge-top'],replace:{ids:['edge-side','edge-top'],signature}}),/改变|变化|冲突/);
});
test('layer slot and hidden original budgets reject whole transactions before touching source',()=>{
 const d=box(),plan=generateEdgeBands(d,options({preset:'both'}));
 const full=composeLayers(Array.from({length:31},(_,i)=>({id:`layer${i}`,name:`层${i}`,visible:true,locked:false,faces:{}})));
 assert.throws(()=>applyEdgeBands(full,plan,{ids:['a','b']}),/图层|预算/);assert.equal(full.layers!.length,31);
 assert.throws(()=>applyEdgeBands(empty,plan,{ids:['a','a']}));assert.throws(()=>applyEdgeBands(empty,plan,{ids:['base','b']}));
 assert.throws(()=>applyEdgeBands(empty,generateEdgeBands(d,options({scope:'selection',selection:[]})),{ids:[]}),/结果|范围|像素/);
 const hidden=composeLayers([{id:'hidden',name:'隐藏',visible:false,locked:false,faces:Object.fromEntries(Array.from({length:16384},(_,i)=>[`${i},0,0,4`,{'0':'#ffffff'}]))}]);
 assert.throws(()=>applyEdgeBands(hidden,plan,{ids:['a','b']}),/预算/);assert.equal(layerStack(hidden).length,1);
 const hiddenPixels=composeLayers([{id:'hidden',name:'隐藏',visible:false,locked:false,faces:Object.fromEntries(Array.from({length:1024},(_,i)=>[`${i},0,0,4`,Object.fromEntries(Array.from({length:256},(_,p)=>[p,'#ffffff']))]))}]);
 assert.throws(()=>applyEdgeBands(hiddenPixels,plan,{ids:['a','b']}),/预算/);assert.deepEqual(hiddenPixels.faces,{});
});
test('native ring and shared-owner geometry generate real inside rims while foreign owners remain untouched',()=>{
 const cells=Array.from({length:9},(_,i)=>({x:i%3,y:Math.floor(i/3),z:0,color:0})).filter(c=>c.x!==1||c.y!==1),model=native(cells),d=new StructureEdgeDomain(model,'target');
 const top=generateEdgeBands(d,options({preset:'top'}));
 assert.equal(top.pixelCount,4*48-4+4*16);assert.ok(!top.bands[0].faces['1,1,0,4']);
 const shared=native([{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:0},{x:2,y:0,z:0,color:0}]);
 shared.objects![0].cellKeys=['1,0,0'];shared.objects!.push({objectId:'foreign',name:'Foreign',canvasIds:[shared.canvases![0].canvasId],originTicks:[0,0,0],cellKeys:['0,0,0','2,0,0']});
 const all=generateEdgeBands(new StructureEdgeDomain(shared,'target'),options({preset:'top',topWidth:20}));
 assert.equal(all.pixelCount,16*16);assert.deepEqual(Object.keys(all.bands[0].faces),['1,0,0,4']);
 const narrow=generateEdgeBands(new StructureEdgeDomain(shared,'target'),options({preset:'top',topWidth:1}));
 assert.equal(narrow.pixelCount,32,'middle owner gains no false x contact seam');
});
test('native negative origins and all three densities keep widths in physical texels and frozen side base colors',()=>{
 for(const n of [4,8,16]){
  const model=native([{x:-2,y:3,z:-1,color:0}],n/64,[3,-5,7]);model.palette=['#808080','#abcdef'];model.sideColor=1;
  const d=new StructureEdgeDomain(model,'target'),plan=generateEdgeBands(d,options({preset:'both',colorMode:'darken'}));
  assert.equal(plan.pixelCount,4*n*2+4*n-4);assert.equal(plan.geometryFingerprint,d.fingerprint);
  assert.ok(Object.values(plan.bands[0].faces).every(p=>Object.values(p).every(c=>c===appearanceColor('#abcdef',undefined,{gain:.5,affectPaint:false}))));
  assert.ok(Object.values(plan.bands[1].faces).every(p=>Object.values(p).every(c=>c===appearanceColor('#808080',undefined,{gain:.5,affectPaint:false}))));
  validateSurfacePaint(applyEdgeBands(undefined,plan,{ids:['side','top']}),n/64);
 }
});
test('diagonal contacts generate each solid sector independently without crossing empty space',()=>{
 for(let axis=0;axis<3;axis++)for(const reversed of [false,true]){
  const transverse=[0,1,2].filter(a=>a!==axis),points=[[0,0,0],[0,0,0]];
  points[reversed?0:1][transverse[0]]=1;points[1][transverse[1]]=1;
  const cells=points.map(([x,y,z])=>({x,y,z,color:0}));
  const domain=new StructureEdgeDomain(native(cells),'target');
  assert.equal(domain.diagnostics.separatedContacts,1);
  for(const preset of ['side','top','both','convex'] as const)for(const width of [2,20]){
   const setting=options({preset,sideWidth:width,topWidth:width}),plan=generateEdgeBands(domain,setting);
   const independent=cells.map(cell=>generateEdgeBands(new StructureEdgeDomain(native([cell]),'target'),setting));
   for(const band of plan.bands){
    const expected=Object.assign({},...independent.flatMap(p=>p.bands.filter(b=>b.kind===band.kind).map(b=>b.faces)));
    assert.deepEqual(band.faces,expected,`${axis}/${reversed}/${preset}/${width} must equal two separate cubes`);
   }
   assert.equal(plan.pixelCount,independent.reduce((n,p)=>n+p.pixelCount,0));
   validateSurfacePaint(applyEdgeBands(undefined,plan,{ids:plan.bands.map((_,i)=>'band'+i)}),.25);
  }
 }
});

test('unresolved contacts and overlapping ownership still reject entire generation',()=>{
 assert.throws(()=>generateEdgeBands({...box(),diagnostics:{nonManifold:1}},options()),/歧义/);
 const ambiguous=native([{x:0,y:0,z:0,color:0}]);
 ambiguous.canvases!.push({...structuredClone(ambiguous.canvases![0]),canvasId:'overlap'});
 assert.throws(()=>generateEdgeBands(new StructureEdgeDomain(ambiguous,'target'),options()),/歧义/);
});

test('overflowing coverage rejects entirely and hidden source references remain stable',()=>{
 const source:SurfacePaint={...empty,faces:{'8,8,8,4':{'0':'#ff0000'}}},plan=generateEdgeBands(box(),options());
 const applied=applyEdgeBands(source,plan,{ids:['edge']});assert.equal(applied.faces['8,8,8,4'],source.faces['8,8,8,4']);
 const frozen=JSON.stringify(source);
 assert.throws(()=>generateEdgeBands(box(100,100,1),options({preset:'convex',sideWidth:64})),/预算/);
 assert.equal(JSON.stringify(source),frozen);
});
test('color, darkening and placement reuse bounded candidates while width and mask changes invalidate them',()=>{
 const original=box(),domain={...original,surfaceExists:(...args:Parameters<EdgeBandDomain['surfaceExists']>)=>{queries++;return original.surfaceExists(...args);},pixel:(...args:Parameters<EdgeBandDomain['pixel']>)=>{pixels++;return original.pixel(...args);}};
 let queries=0,pixels=0;
 const a=generateEdgeBands(domain,options()),firstQueries=queries,firstPixels=pixels;
 assert.ok(firstQueries>0&&firstPixels>0);
 const recolored=generateEdgeBands(domain,options({sideColor:'#ffffff',gain:.2,placement:'above'}));
 assert.equal(queries,firstQueries);assert.equal(pixels,firstPixels);assert.equal(recolored.pixelCount,a.pixelCount);assert.equal(Object.values(recolored.bands[0].faces)[0]['224'],'#ffffff');
 const darkened=generateEdgeBands(domain,options({colorMode:'darken'}));assert.equal(queries,firstQueries);assert.equal(pixels,firstPixels);assert.notDeepEqual(darkened.bands[0].faces,recolored.bands[0].faces);
 generateEdgeBands(domain,options({sideWidth:3}));assert.ok(queries>firstQueries&&pixels>firstPixels);
 const wideQueries=queries;generateEdgeBands(domain,options({sideWidth:3,scope:'selection',selection:['0,0,0,0:240']}));assert.ok(queries>wideQueries);
});
test('returned options and colored faces cannot mutate the retained candidate cache',()=>{
 const domain=box(),first=generateEdgeBands(domain,options());
 first.options.sideWidth=3;first.options.faces.length=0;
 Object.values(first.bands[0].faces)[0]['224']='#ff0000';
 const next=generateEdgeBands(domain,options({sideWidth:3,faces:[]}));
 assert.equal(next.pixelCount,0);assert.deepEqual(next.bands,[]);
 assert.equal(generateEdgeBands(domain,options()).pixelCount,128);
});
test('isolated same-canvas owners may reveal contact edges but never write native internal faces',()=>{
 const model=native([{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:0}]),canvasId=model.canvases![0].canvasId;
 model.objects![0].cellKeys=['0,0,0'];model.objects!.push({objectId:'neighbor',name:'Neighbor',canvasIds:[canvasId],originTicks:[0,0,0],cellKeys:['1,0,0']});
 const complete=new StructureEdgeDomain(model,'target'),isolated=new StructureEdgeDomain(model,'target','target');
 assert.equal(complete.pixel(0,16,2,2),null);
 assert.ok(!complete.edges.some(e=>e.faces.includes(4)&&e.start[0]===16&&e.start[2]===16));
 assert.ok(isolated.edges.some(e=>e.faces.includes(4)&&e.start[0]===16&&e.start[2]===16),'explicit isolation retains contact rim as geometric source');
 assert.equal(isolated.pixel(0,16,2,2),null,'native adjacent cell still forbids author paint on its internal face');
 const plan=generateEdgeBands(isolated,options({geometry:'target',preset:'both'}));
 assert.ok(plan.bands.every(b=>!b.faces['0,0,0,0']));
 assert.equal(plan.bands.find(b=>b.kind==='side')!.faces['0,0,0,1']['224'],'#123456');
 const top=plan.bands.find(b=>b.kind==='top')!;
 assert.equal(top.faces['0,0,0,4']['31'],'#abcdef','contact rim can still receive on exposed native top surface');
 assert.ok(generateEdgeBands(complete,options({preset:'top'})).pixelCount<generateEdgeBands(isolated,options({geometry:'target',preset:'top'})).pixelCount);
});
test('isolated cross-canvas contacts still permit the target native exterior face',()=>{
 const model=native([{x:0,y:0,z:0,color:0}]);
 model.canvases!.push({canvasId:'neighbor',name:'Neighbor',visible:true,locked:false,voxelStepM:.25,originTicks:[8,0,0],cells:[{x:0,y:0,z:0,color:0}],protectedColumns:[]});
 model.objects!.push({objectId:'neighbor',name:'Neighbor',canvasIds:['neighbor'],originTicks:[0,0,0],cellKeys:['0,0,0']});
 const complete=new StructureEdgeDomain(model,'target'),isolated=new StructureEdgeDomain(model,'target','target');
 assert.equal(complete.pixel(0,16,2,2),null);
 assert.ok(isolated.pixel(0,16,2,2),'another canvas is read-only geometry, not a native same-canvas neighbor');
 const plan=generateEdgeBands(isolated,options({geometry:'target'}));
 assert.equal(plan.pixelCount,128);assert.ok(plan.bands[0].faces['0,0,0,0']);
 assert.equal(generateEdgeBands(complete,options()).pixelCount,96);
});
