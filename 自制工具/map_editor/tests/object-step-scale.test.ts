import test from 'node:test';
import assert from 'node:assert/strict';
import {createAsset,validateAsset,type AssetDocument} from '../core/workshop-documents.ts';
import {CanvasSession} from '../core/workshop-canvases.ts';
import {composeLayers} from '../core/paint-layers.ts';
import {paletteFromMap} from '../core/palette.ts';

function fixture(step=.25,painted=false):CanvasSession{
 const a=createAsset('scale-object');a.schema='xinghai-workshop-asset-2';a.cells=[];a.palette=['#112233','#ddeeff'];a.materialProfile=paletteFromMap({...a,materialProfile:undefined});
 const cells=[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:0},{x:10,y:0,z:0,color:1}];
 a.canvases=[{canvasId:'c',name:'C',visible:true,locked:false,voxelStepM:step,originTicks:[8,-8,4],protectedColumns:['10,0'],cells},
 {canvasId:'other-canvas',name:'other',visible:true,locked:false,voxelStepM:.25,originTicks:[80,0,0],protectedColumns:[],cells:[{x:0,y:0,z:0,color:1}]}];
 a.objects=[{objectId:'scaled',name:'保持单件',canvasIds:['c'],originTicks:[8,-8,4],cellKeys:['0,0,0','1,0,0']},{objectId:'neighbor',name:'旁物体',canvasIds:['c'],originTicks:[8,-8,4],cellKeys:['10,0,0']},{objectId:'other',name:'other',canvasIds:['other-canvas'],originTicks:[80,0,0],cellKeys:['0,0,0']}];
 a.objectCollections=[{collectionId:'group',name:'Group',memberIds:['scaled','neighbor']}];
 if(painted){const c=a.canvases[0],n=step*64;
  c.baseCells=[{...cells[0],color:1},cells[1],cells[2]];c.voxelCopies=[{copyId:'author-copy',cells:[cells[0]]}];
  c.paintSource=composeLayers([{id:'hand',name:'手绘',visible:true,locked:false,faces:{'0,0,0,4':{'0':'#ff0000',[n-1]:'#0000ff'},'10,0,0,4':{'0':'#ffffff'}}},{id:'hidden',name:'隐藏原稿',visible:false,locked:true,faces:{'1,0,0,4':{'0':'#ffff00'}}}]);
  c.faceTone={schema:'xinghai-face-tone-1',faces:{'0,0,0,4':{gain:.5,affectPaint:true},'10,0,0,4':{gain:.75,affectPaint:false}}};
 }
 return new CanvasSession(a);
}
async function planner(){const api=await import('../core/object-step-scale.ts');return api.planObjectStepScale;}

test('object step scale changes native dimensions while keeping one object, pivot and all other canvases',async()=>{
 const plan=await planner();
 for(const step of [.25,.125,.0625])for(const [axis,want]of [['x',[4,1,1]],['y',[2,3,1]],['z',[2,1,3]],['xy',[4,3,1]],['xyz',[4,3,3]]] as const){
  const s=fixture(step),before=structuredClone(s.model),p=plan(s.model,'scaled',axis,1);
  assert.deepEqual(p.before,[2,1,1]);assert.deepEqual(p.after,want);assert.equal(p.sourceCount,2);assert.equal(p.destinationCount,want[0]*want[1]*want[2]);assert.deepEqual(s.model,before);
  assert.equal(p.model.objects!.length,3);assert.deepEqual(p.model.objects!.find(o=>o.objectId==='scaled')!.originTicks,before.objects![0].originTicks);assert.deepEqual(p.model.objects!.slice(1),before.objects!.slice(1));assert.deepEqual(p.model.canvases![1],before.canvases![1]);assert.deepEqual(p.model.anchorM,before.anchorM);assert.deepEqual(p.model.objectCollections,before.objectCollections);
 }
});
test('paint originals, hidden locked layers, face tone and overlap identities stretch with the same object',async()=>{
 const plan=await planner();
 for(const step of [.25,.125,.0625]){
  const s=fixture(step,true),before=structuredClone(s.model),p=plan(s.model,'scaled','x',1),c=p.model.canvases![0],n=step*64;
  assert.deepEqual(c.paintSource!.layers!.map(({faces,...meta})=>meta),before.canvases![0].paintSource!.layers!.map(({faces,...meta})=>meta));
  assert.equal(c.paintSource!.layers![0].faces['-1,0,0,4']['0'],'#ff0000');assert.equal(c.paintSource!.layers![0].faces['-1,0,0,4']['1'],'#ff0000');
  assert.equal(c.paintSource!.layers![0].faces['0,0,0,4'][n-2],'#0000ff');assert.equal(c.paintSource!.layers![0].faces['0,0,0,4'][n-1],'#0000ff');
  assert.equal(c.paintSource!.layers![1].faces['1,0,0,4']['0'],'#ffff00');assert.equal(c.paintSource!.layers![1].visible,false);assert.equal(c.paintSource!.layers![1].locked,true);
  assert.deepEqual(c.paintSource!.faces['10,0,0,4'],{'0':'#ffffff'});assert.deepEqual(c.faceTone!.faces['-1,0,0,4'],{gain:.5,affectPaint:true});assert.deepEqual(c.faceTone!.faces['0,0,0,4'],{gain:.5,affectPaint:true});assert.deepEqual(c.faceTone!.faces['10,0,0,4'],before.canvases![0].faceTone!.faces['10,0,0,4']);
  assert.equal(c.voxelCopies![0].copyId,'author-copy');assert.deepEqual(c.voxelCopies![0].cells.map(v=>[v.x,v.color]),[[-1,0],[0,0]]);assert.deepEqual(c.baseCells!.filter(v=>v.x<1).map(v=>[v.x,v.color]),[[-1,1],[0,1]]);
  validateAsset(JSON.parse(JSON.stringify(p.model)));assert.deepEqual(s.model,before);
 }
});
test('session commits object scaling once, preserves selection and origin, and restores all authorship on undo redo',()=>{
 const s=fixture(.125,true),before=structuredClone(s.model);assert.equal(typeof(s as any).stepScaleObject,'function');
 const result=(s as any).stepScaleObject('scaled','x',1);assert.equal(result.destinationCount,4);assert.equal(s.past.length,1);assert.deepEqual(s.selectedObjectIds,['scaled']);assert.equal(s.editObjectId,null);assert.equal(s.model.objects!.length,3);
 const after=structuredClone(s.model);s.undo();assert.deepEqual({...s.model,revision:before.revision},before);s.redo();assert.deepEqual({...s.model,revision:after.revision},after);assert.deepEqual(new CanvasSession(JSON.parse(JSON.stringify(s.model))).model,s.model);
 const depth=s.past.length;(s as any).stepScaleObject('scaled','x',0);assert.equal(s.past.length,depth);
});
test('foreign collisions, locked hidden canvas and budget failures reject before model or history changes',async()=>{
 const plan=await planner();
 for(const kind of ['foreign','locked','hidden','budget']){
  const s=fixture();if(kind==='foreign'){s.model.canvases![0].cells[2].x=2;s.model.objects![1].cellKeys=['2,0,0'];}if(kind==='locked')s.active.locked=true;if(kind==='hidden')s.active.visible=false;
  const before=structuredClone(s.model);assert.throws(()=>plan(s.model,'scaled',kind==='budget'?'xyz':'x',kind==='budget'?100000:1),/冲突|其他物体|锁定|隐藏|预算/);assert.deepEqual(s.model,before);assert.equal(s.past.length,0);
 }
});
test('contraction rejects the precise loss of a painted or toned source cell rather than dropping original art',async()=>{
 const plan=await planner(),s=fixture(.25,true);s.active.cells.splice(2,0,{x:2,y:0,z:0,color:0});s.model.objects![0].cellKeys!.push('2,0,0');s.active.baseCells!.splice(2,0,{x:2,y:0,z:0,color:0});
 const before=structuredClone(s.model);assert.throws(()=>plan(s.model,'scaled','x',-1),/缩小.*绘画|缩小.*暗面/);assert.deepEqual(s.model,before);
 const plain=fixture();plain.active.cells.splice(2,0,{x:2,y:0,z:0,color:0});plain.model.objects![0].cellKeys!.push('2,0,0');const shrunk=plan(plain.model,'scaled','x',-1);assert.deepEqual(shrunk.after,[1,1,1]);assert.equal(shrunk.destinationCount,1);
});
test('rejected shrinking preserves hidden locked art and tone without creating a session undo',()=>{
 for(const kind of ['hidden-paint','tone']){
  const initial=fixture(),model=initial.model,c=model.canvases![0];c.cells.splice(2,0,{x:2,y:0,z:0,color:0});model.objects![0].cellKeys!.push('2,0,0');
  if(kind==='hidden-paint')c.paintSource=composeLayers([{id:'hidden',name:'隐藏锁定原稿',visible:false,locked:true,faces:{'0,0,0,4':{'1':'#ff0000'}}}]);
  else c.faceTone={schema:'xinghai-face-tone-1',faces:{'0,0,0,4':{gain:.4,affectPaint:false}}};
  const s=new CanvasSession(model),before=structuredClone(s.model);assert.throws(()=>s.stepScaleObject('scaled','x',-1),/缩小.*绘画|缩小.*暗面/);assert.deepEqual(s.model,before);assert.equal(s.past.length,0);
 }
});
test('painted contraction is supported when every authored cell survives nearest-cell sampling',async()=>{
 const initial=fixture(),model=initial.model,c=model.canvases![0];c.cells.splice(2,0,{x:2,y:0,z:0,color:0});model.objects![0].cellKeys!.push('2,0,0');
 c.paintSource=composeLayers([{id:'kept',name:'保留绘画',visible:true,locked:true,faces:{'1,0,0,4':{'1':'#ff0000'}}}]);c.faceTone={schema:'xinghai-face-tone-1',faces:{'1,0,0,4':{gain:.4,affectPaint:false}}};
 const p=(await planner())(model,'scaled','x',-1);assert.equal(p.destinationCount,1);assert.deepEqual(p.model.canvases![0].paintSource,c.paintSource);assert.deepEqual(p.model.canvases![0].faceTone,c.faceTone);
});
test('layered paint expansion budget and native coordinate limits fail atomically',()=>{
 const initial=fixture(.25,true),model=initial.model,c=model.canvases![0];
 c.cells=c.cells.filter(v=>v.x!==10);c.baseCells=c.baseCells!.filter(v=>v.x!==10);model.objects=model.objects!.filter(o=>o.objectId!=='neighbor');delete c.faceTone;model.objectCollections=[];
 c.paintSource=composeLayers([{id:'all',name:'完整顶面',visible:false,locked:true,faces:{'0,0,0,4':Object.fromEntries(Array.from({length:256},(_,i)=>[i,'#ff0000'])),'1,0,0,4':Object.fromEntries(Array.from({length:256},(_,i)=>[i,'#0000ff']))}}]);
 const s=new CanvasSession(model),before=structuredClone(s.model);assert.throws(()=>s.stepScaleObject('scaled','x',600),/像素预算/);assert.deepEqual(s.model,before);assert.equal(s.past.length,0);
 const edge=fixture().model;edge.canvases![0].cells=[{x:8192,y:0,z:0,color:0}];edge.objects=edge.objects!.filter(o=>o.objectId!=='neighbor');edge.objectCollections=[];edge.objects![0].cellKeys=['8192,0,0'];const bounded=new CanvasSession(edge),old=structuredClone(bounded.model);assert.throws(()=>bounded.stepScaleObject('scaled','x',1),/越界/);assert.deepEqual(bounded.model,old);assert.equal(bounded.past.length,0);
});
test('all six face originals retain their UV directions through nonuniform XYZ object expansion',async()=>{
 const s=fixture(.125),c=s.active;c.paintSource={schema:'xinghai-surface-paint-1',density:64,faces:Object.fromEntries([0,1,2,3,4,5].map(face=>['0,0,0,'+face,{'0':'#ff0000'}]))};c.faceTone={schema:'xinghai-face-tone-1',faces:Object.fromEntries([0,1,2,3,4,5].map(face=>['0,0,0,'+face,{gain:.5,affectPaint:true}]))};
 const p=(await planner())(s.model,'scaled','xyz',1),paint=p.model.canvases![0].paintSource!;
 for(const [face,key,pixels] of [[0,'0,-1,-1,0',['0','1','2','8','9','10','16','17','18']],[1,'-1,-1,-1,1',['0','1','2','8','9','10','16','17','18']],[2,'-1,1,-1,2',['0','1','8','9','16','17']],[3,'-1,-1,-1,3',['0','1','8','9','16','17']],[4,'-1,-1,1,4',['0','1','8','9','16','17']],[5,'-1,-1,-1,5',['0','1','8','9','16','17']]] as const){
  assert.deepEqual(Object.keys(paint.faces[key]).sort((a,b)=>Number(a)-Number(b)),pixels);assert.ok(Object.values(paint.faces[key]).every(v=>v==='#ff0000'));assert.equal(Number(key.split(',')[3]),face);
 }
 assert.equal(Object.keys(p.model.canvases![0].faceTone!.faces).length,42);
});
test('overlap originals and foreign paint remain exact when a scaled destination conflicts with another owner',()=>{
 const model=fixture(.125,true).model,c=model.canvases![0];c.cells=c.cells.map(v=>v.x===10?{...v,x:2}:v);c.baseCells=c.baseCells!.map(v=>v.x===10?{...v,x:2}:v);model.objects![1].cellKeys=['2,0,0'];
 for(const layer of c.paintSource!.layers!){if(layer.faces['10,0,0,4']){layer.faces['2,0,0,4']=layer.faces['10,0,0,4'];delete layer.faces['10,0,0,4'];}}c.paintSource=composeLayers(c.paintSource!.layers!);c.faceTone!.faces['2,0,0,4']=c.faceTone!.faces['10,0,0,4'];delete c.faceTone!.faces['10,0,0,4'];
 const s=new CanvasSession(model),before=structuredClone(s.model);assert.throws(()=>s.stepScaleObject('scaled','x',1),/其他物体冲突/);assert.deepEqual(s.model,before);assert.equal(s.past.length,0);assert.equal(s.future.length,0);
});
