import test from 'node:test';
import assert from 'node:assert/strict';
import {createAsset,validateAsset,type AssetDocument} from '../core/workshop-documents.ts';
import {CanvasSession} from '../core/workshop-canvases.ts';
import {DEFAULT_ROCK_OPTIONS} from '../core/rock-shaping.ts';
import {planRockAsset,rockAssetStamp} from '../core/rock-shaping-asset.ts';
import {paintPixels} from '../core/surface-paint.ts';

const key=(c:{x:number;y:number;z:number})=>`${c.x},${c.y},${c.z}`;
function fixture(step=.25){
 const a=createAsset('rock-asset');
 for(let x=0;x<16;x++)for(let y=0;y<12;y++)for(let z=0;z<20;z++)a.cells.push({x,y,z,color:0});
 const s=new CanvasSession(a), c=s.active;
 c.voxelStepM=step;
 s.model.objects=[{objectId:'rock',name:'Rock',canvasIds:[c.canvasId],originTicks:[8,0,16],cellKeys:c.cells.map(key)}];
 c.baseCells=structuredClone(c.cells);c.voxelCopies=[{copyId:'overlap',cells:structuredClone(c.cells.slice(0,100))}];
 s.model.objectCollections=[{collectionId:'collection',name:'Set',memberIds:['rock']}];
 s.selectedObjectIds=['rock'];
 return new CanvasSession(validateAsset(s.model));
}
const options={...DEFAULT_ROCK_OPTIONS,maxDepth:3};

test('growth extends a thin selected surface beyond source bounds, owns new cells and commits/undoes all sources atomically',()=>{
 for(const preset of ['columnar-wall','terraced-rim'] as const){
  let s=fixture();s.active.cells=s.active.cells.filter(c=>c.x===15);s.active.baseCells=structuredClone(s.active.cells);s.active.voxelCopies=[];
  s.model.objects![0].cellKeys=s.active.cells.map(key);
  s=new CanvasSession(validateAsset(s.model));
  const before=structuredClone(s.model),selectionKeys=new Set(s.active.cells.filter(c=>c.y>=3&&c.y<9&&c.z>=3&&c.z<18).map(key));
  const p=planRockAsset(s.model,'rock',{...options,preset,operation:'grow',maxOutward:4,minThickness:5,sides:[0]},{selectionKeys});
  assert.equal(p.result.removedCellKeys.length,0,'growth never erodes original cells');
  assert.ok(p.result.addedCells?.length>20,`${preset} must grow without a thick input solid`);
  for(const c of p.result.addedCells){assert(c.x>15&&c.x<=19);assert(selectionKeys.has(`15,${c.y},${c.z}`));assert.equal(c.color,0);}
  const next=p.nextModel.canvases![0];
  for(const c of p.result.addedCells){assert(next.baseCells!.some(b=>key(b)===key(c)));assert(p.nextModel.objects![0].cellKeys!.includes(key(c)));}
  assert(p.surfaces.revealed>0);assert.deepEqual(s.model,before);
  s.selectedObjectIds=['rock'];s.applyRock(p);assert.equal(s.past.length,1);const after=structuredClone(s.model);
  s.sync();assert.deepEqual(s.model.canvases,after.canvases);s.undo();assert.deepEqual(s.model.canvases,before.canvases);s.redo();assert.deepEqual(s.model.canvases,after.canvases);
 }
});

test('bidirectional sculpt has both additions and deletions, repeats deterministically and respects precision',()=>{
 for(const preset of ['columnar-wall','terraced-rim'] as const){
  const s=fixture(),config={...options,preset,operation:'both' as const,maxOutward:4,maxDepth:4,sides:[0]};
  const p=planRockAsset(s.model,'rock',config);
  assert(p.result.addedCells?.length>0);assert(p.result.removedCellKeys.length>0);
  assert.deepEqual(p.result,planRockAsset(s.model,'rock',config).result);
  s.active.voxelStepM=.0625;const fine=planRockAsset(s.model,'rock',config);
  assert.deepEqual(p.result.addedCells,fine.result.addedCells);assert.deepEqual(p.result.removedCellKeys,fine.result.removedCellKeys);
 }
});

test('growth stops at occupied foreign cells, preserves exposed paint by default and zero outward range is a no-op',()=>{
 const s=fixture(),foreign={x:18,y:5,z:8,color:1};s.active.cells.push(foreign);s.active.baseCells!.push(foreign);
 s.model.objects!.push({objectId:'foreign',name:'Foreign',canvasIds:[s.activeId],originTicks:[0,0,0],cellKeys:[key(foreign)]});
 const selectionKeys=new Set(['15,5,8','15,6,8']);
 const config={...options,operation:'grow' as const,maxOutward:6,sides:[0]};
 const p=planRockAsset(s.model,'rock',config,{selectionKeys});
 assert(p.result.addedCells?.length>0);assert(p.result.addedCells.filter(c=>c.y===5).every(c=>c.x<18));
 assert(p.result.addedCells.some(c=>c.x===16&&c.y===5),'an obstacle beyond an air gap must allow growth up to the obstacle');
 assert.deepEqual(p.nextModel.objects![1],s.model.objects![1]);
 s.active.paintSource=paintPixels(undefined,[{key:'15,6,8,0',index:0},{key:'18,5,8,1',index:0}],'#ff0000',.25);
 const protectedPlan=planRockAsset(s.model,'rock',config,{selectionKeys});
 assert(!protectedPlan.result.addedCells.some(c=>c.y===6));assert.deepEqual(protectedPlan.nextModel.canvases![0].paintSource,s.active.paintSource);
 assert(!protectedPlan.result.addedCells.some(c=>c.x===17&&c.y===5),'new cells must not hide a painted foreign face');
 const unprotected=planRockAsset(s.model,'rock',config,{selectionKeys,protectPaint:false});
 assert(unprotected.result.addedCells.some(c=>c.y===6));assert(unprotected.surfaces.paintedAffected>0);
 const zero=planRockAsset(s.model,'rock',{...config,maxOutward:0});assert.deepEqual(zero.nextModel,s.model);
});

test('edit selection is the strict sculpt mask, including a single surface layer backed by unselected owner cells',()=>{
 for(const preset of ['columnar-wall','terraced-rim'] as const){
  const s=fixture(),before=structuredClone(s.model);
  const selectionKeys=new Set(s.active.cells.filter(c=>c.x===15&&c.y>=3&&c.y<9&&c.z>=3&&c.z<18).map(key));
  const p=planRockAsset(s.model,'rock',{...options,preset,minThickness:5,sides:[0]},{selectionKeys});
  assert.ok(p.result.removedCellKeys.length>0,`${preset} must act on a backed surface selection`);
  assert.ok(p.result.removedCellKeys.every(k=>selectionKeys.has(k)),'no implicit selection expansion');
  assert.deepEqual(p.nextModel.canvases![0].cells.filter(c=>!selectionKeys.has(key(c))),s.active.cells.filter(c=>!selectionKeys.has(key(c))));
  assert.deepEqual(p.scope,{kind:'selection',cellCount:selectionKeys.size});
  s.selectedObjectIds=['rock'];s.applyRock(p);s.undo();assert.deepEqual(s.model.canvases,before.canvases);
 }
 assert.throws(()=>planRockAsset(fixture().model,'rock',options,{selectionKeys:new Set()}),/先选择/);
});

test('local terraces accept an arch and unequal column bottoms; legacy protection is explicit rather than silently global',()=>{
 const s=fixture();
 s.active.cells=s.active.cells.filter(c=>!(c.x>=5&&c.x<11&&c.z<12));
 s.active.baseCells=structuredClone(s.active.cells);s.active.voxelCopies=[];
 s.model.objects![0].cellKeys=s.active.cells.map(key);
 s.active.protectedColumns=[...new Set(s.active.cells.map(c=>`${c.x},${c.y}`))];
 const p=planRockAsset(s.model,'rock',{...options,preset:'terraced-rim'});
 assert.deepEqual(p.result.diagnostics.blockingReasons,[]);
 assert.ok(p.result.removedCellKeys.length>100,'whole arch should have visible local terraces');
 assert.deepEqual(p.scope,{kind:'object',cellCount:s.active.cells.length});
 const protectedPlan=planRockAsset(s.model,'rock',{...options,preset:'terraced-rim'},{protectColumns:true});
 assert.equal(protectedPlan.result.removedCellKeys.length,0);
});
test('rock plan isolates an owner, preserves metadata and removes every overlapping source without mutating input',()=>{
 const s=fixture(), c=s.active;
 c.cells.push({x:30,y:0,z:0,color:1});c.baseCells!.push({x:30,y:0,z:0,color:1});
 s.model.objects!.push({objectId:'foreign',name:'Foreign',canvasIds:[c.canvasId],originTicks:[0,0,0],cellKeys:['30,0,0']});
 const before=structuredClone(s.model), p=planRockAsset(s.model,'rock',options);
 assert.ok(p.result.removedCellKeys.length>0);assert.deepEqual(s.model,before);
 assert.equal(p.canvasId,c.canvasId);assert.equal(p.sourceStamp,rockAssetStamp(before));
 const next=p.nextModel.canvases![0],removed=new Set(p.result.removedCellKeys);
 for(const cells of [next.cells,next.baseCells!,...next.voxelCopies!.map(c=>c.cells)])assert.ok(cells.every(c=>!removed.has(key(c))));
 assert.deepEqual(p.nextModel.objects![1],before.objects![1]);assert.deepEqual(p.nextModel.objectCollections,before.objectCollections);
 assert.deepEqual(p.nextModel.anchorM,before.anchorM);assert.deepEqual(p.nextModel.objects![0].originTicks,before.objects![0].originTicks);
 assert.deepEqual(p.nextModel.palette,before.palette);assert.deepEqual(p.nextModel.materialProfile,before.materialProfile);
 assert.ok(p.surfaces.removed>0&&p.surfaces.revealed>0);validateAsset(p.nextModel);
});
test('rock commit is one history step and restores exact source paint and ownership on undo/redo at three precisions',()=>{
 for(const step of [.25,.125,.0625]){
  const s=fixture(step),before=structuredClone(s.model),p=planRockAsset(s.model,'rock',options);
  assert.equal((p.result.recipe as any).options.cellSize,step);
  s.applyRock(p);assert.equal(s.past.length,1);assert.deepEqual(s.model.canvases,p.nextModel.canvases);
  const changed=structuredClone(s.model);s.undo();assert.deepEqual(s.model.canvases,before.canvases);assert.deepEqual(s.model.objects,before.objects);
  s.redo();assert.deepEqual(s.model.canvases,changed.canvases);validateAsset(JSON.parse(JSON.stringify(s.model)));
 }
});
test('paint protection preserves painted owners and exposure, explicit off prunes affected records atomically',()=>{
 const s=fixture(),raw=planRockAsset(s.model,'rock',options),removed=raw.result.removedCellKeys[0];
 s.active.paintSource=paintPixels(undefined,[{key:removed+',0',index:0},{key:'7,6,10,0',index:0}],'#abcdef',.25);
 const before=structuredClone(s.model),protectedPlan=planRockAsset(s.model,'rock',options);
 assert.deepEqual(protectedPlan.nextModel.canvases![0].paintSource,before.canvases![0].paintSource);
 assert.ok(!protectedPlan.result.removedCellKeys.includes(removed));assert.equal(protectedPlan.surfaces.paintedAffected,0);
 const p=planRockAsset(s.model,'rock',options,{protectPaint:false});assert.ok(p.surfaces.paintedAffected>0);
 assert.equal(p.nextModel.canvases![0].paintSource!.faces[removed+',0'],undefined);
 assert.deepEqual(p.nextModel.canvases![0].paintSource!.faces['7,6,10,0'],{'0':'#abcdef'});
 s.applyRock(p);s.undo();assert.deepEqual(s.active.paintSource,before.canvases![0].paintSource);s.redo();assert.deepEqual(s.active.paintSource,p.nextModel.canvases![0].paintSource);
});
test('invalid target, hidden, locked, stale geometry or paint and wrong selection cannot commit; no-op adds no history',()=>{
 const s=fixture(),p=planRockAsset(s.model,'rock',options);
 for(const flag of ['visible','locked'] as const){const a=structuredClone(s.model);a.canvases![0][flag]=flag==='locked';assert.throws(()=>planRockAsset(a,'rock',options));}
 assert.throws(()=>planRockAsset(s.model,'missing',options));
 const one=structuredClone(s.model);one.objects![0].cellKeys=[one.objects![0].cellKeys![0]];assert.throws(()=>planRockAsset(one,'rock',options));
 s.selectedObjectIds=[];assert.throws(()=>s.applyRock(p));assert.equal(s.past.length,0);s.selectedObjectIds=['rock'];
 s.active.paintSource=paintPixels(undefined,[{key:'0,0,0,0',index:0}],'#123456',.25);
 assert.throws(()=>s.applyRock(p));assert.equal(s.past.length,0);
 const zero=planRockAsset(s.model,'rock',{...options,maxDepth:0});s.applyRock(zero);assert.equal(s.past.length,0);
 const forged={...zero,nextModel:createAsset('wrong')};assert.throws(()=>s.applyRock(forged));
});
test('hidden painted face exposure is protected by default and cleared only when explicitly allowing surface changes',()=>{
 const s=fixture(),raw=planRockAsset(s.model,'rock',options),removed=new Set(raw.result.removedCellKeys),live=new Set(s.active.cells.map(key));
 const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 let face:string|undefined,blocker:string|undefined;
 for(const c of s.active.cells){
  if(removed.has(key(c)))continue;
  for(let f=0;f<6;f++){const d=directions[f],n=`${c.x+d[0]},${c.y+d[1]},${c.z+d[2]}`;
   if(live.has(n)&&removed.has(n)){face=key(c)+','+f;blocker=n;break;}}
  if(face)break;
 }
 assert.ok(face&&blocker);
 s.active.paintSource=paintPixels(undefined,[{key:face,index:0}],'#abcdef',.25);
 const protectedPlan=planRockAsset(s.model,'rock',options);
 assert.ok(!protectedPlan.result.removedCellKeys.includes(blocker));assert.deepEqual(protectedPlan.nextModel.canvases![0].paintSource,s.active.paintSource);
 const p=planRockAsset(s.model,'rock',options,{protectPaint:false});assert.equal(p.surfaces.paintedAffected,1);
 assert.equal(p.nextModel.canvases![0].paintSource!.faces[face],undefined);
});
test('explicit protected voxel mask and protected columns remain occupied while unrelated canvases are byte-identical',()=>{
 const s=fixture(),raw=planRockAsset(s.model,'rock',options),keys=raw.result.removedCellKeys.slice(0,20),other=structuredClone(s.active);
 other.canvasId='other';other.name='Unrelated';other.originTicks=[64,0,0];other.visible=false;
 s.model.canvases!.push(other);
 s.model.objects!.push({objectId:'other-object',name:'Other',canvasIds:['other'],originTicks:[64,0,0],cellKeys:other.cells.map(key)});
 const [x,y]=keys[0].split(',');s.active.protectedColumns=[`${x},${y}`];
 const p=planRockAsset(s.model,'rock',options,{protectedKeys:new Set(keys),protectColumns:true}),removed=new Set(p.result.removedCellKeys);
 assert.ok(keys.every(k=>!removed.has(k)));assert.deepEqual(p.nextModel.canvases![1],other);
 assert.ok(p.nextModel.canvases![0].cells.filter(c=>c.x===+x&&c.y===+y).length===20);
 assert.deepEqual(p.nextModel.objects![1],s.model.objects![1]);
});
test('invalid geometry, changed source metadata and unsynced edit cannot add history; tampered public plan cannot inject geometry',()=>{
 const s=fixture(),p=planRockAsset(s.model,'rock',options);
 p.nextModel.anchorM=[1,1,1];p.nextModel.canvases![0].cells=[];
 s.applyRock(p);assert.deepEqual(s.model.anchorM,[0,0,0]);assert.ok(s.active.cells.length>0);
 const stale=planRockAsset(s.model,'rock',options);s.model.objects![0].name='Changed';
 const history=s.past.length;assert.throws(()=>s.applyRock(stale));assert.equal(s.past.length,history);
 const fresh=planRockAsset(s.model,'rock',options);s.editor.cells.delete(s.active.cells[0]&&key(s.active.cells[0]));
 assert.throws(()=>s.applyRock(fresh));assert.equal(s.past.length,history);
 const t=fixture(),bad=planRockAsset(t.model,'rock',{...options,continuity:1});
 assert.ok(bad.result.diagnostics.blockingReasons.length);assert.throws(()=>t.applyRock(bad));assert.equal(t.past.length,0);
});
test('foreign owner blocks the whole first-interval ray and is never carved through to the rock behind it',()=>{
 const s=fixture(),barrier=[];
 for(let y=0;y<12;y++)for(let z=0;z<20;z++)barrier.push({x:17,y,z,color:1});
 s.active.cells.push(...barrier);s.active.baseCells!.push(...barrier);
 s.model.objects!.push({objectId:'barrier',name:'Barrier',canvasIds:[s.activeId],originTicks:[0,0,0],cellKeys:barrier.map(key)});
 const p=planRockAsset(s.model,'rock',{...options,sides:[0]});
 assert.deepEqual(p.result.removedCellKeys,[]);assert.deepEqual(p.nextModel,s.model);
});
test('readonly edit-object sync preserves layered sources before and after rock apply, save, undo and redo',()=>{
 const original=fixture(),foreign={x:30,y:0,z:0,color:1};
 original.active.cells.push(foreign);original.active.baseCells!.push({...foreign,color:0});
 original.active.voxelCopies!.push({copyId:'foreign-overlay',cells:[foreign]});
 original.model.objects!.push({objectId:'foreign',name:'Foreign',canvasIds:[original.activeId],originTicks:[0,0,0],cellKeys:[key(foreign)]});
 const s=new CanvasSession(validateAsset(original.model));s.selectedObjectIds=['rock'];s.setEditObject('rock');
 const before=structuredClone(s.model),past=s.past.length;
 s.sync();assert.ok(s.active.baseCells,'readonly edit sync must retain baseCells');assert.deepEqual(s.model,before);assert.equal(s.past.length,past);
 const p=planRockAsset(s.model,'rock',options);s.applyRock(p);const changed=structuredClone(s.model);
 s.sync();assert.deepEqual(s.model,changed);assert.equal(s.past.length,past+1);
 const reopened=new CanvasSession(validateAsset(JSON.parse(JSON.stringify(s.sync()))));
 assert.deepEqual(reopened.active.baseCells,changed.canvases![0].baseCells);
 assert.deepEqual(reopened.active.voxelCopies,changed.canvases![0].voxelCopies);
 s.undo();assert.deepEqual(s.model.canvases,before.canvases);assert.deepEqual(s.model.objects,before.objects);
 s.sync();assert.deepEqual(s.model.canvases,before.canvases);
 s.redo();s.sync();assert.deepEqual(s.model.canvases,changed.canvases);assert.deepEqual(s.model.objects,changed.objects);
});
