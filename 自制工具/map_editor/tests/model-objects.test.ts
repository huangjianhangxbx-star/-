import test from 'node:test';
import assert from 'node:assert/strict';
import {createAsset,validateAsset} from '../core/workshop-documents.ts';
import {CanvasSession,ensureModelObjects} from '../core/workshop-canvases.ts';
import {exportAssetGlb} from '../core/workshop-glb.ts';
import {validatePublishGlb} from '../core/publish-glb-validation.ts';
function fixture(){const a=createAsset('object-test');a.name='旧资产';a.revision=7;a.cells=[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:1}];return a;}
function session(){return new CanvasSession(ensureModelObjects(fixture()));}
function ids(s:CanvasSession){return s.model.objects!.map(o=>o.objectId);}
function paint(s:CanvasSession,x=0){s.editor.begin();s.editor.put(x,0,0,1,'volume');s.editor.commit();s.sync();}
function join(s:CanvasSession){const all=ids(s);return s.joinObjects(all,all[0])!;}

test('migration preserves identity and geometry but gives every legacy voxel independent membership',()=>{
 const old=fixture(),before=structuredClone(old),m=ensureModelObjects(old);assert.deepEqual(old,before);
 assert.equal(m.assetId,old.assetId);assert.equal(m.name,old.name);assert.equal(m.revision,old.revision);
 assert.deepEqual(m.canvases![0].cells,old.cells);assert.equal(m.objects!.length,2);
 assert.deepEqual(m.objects!.map(o=>o.cellKeys),[['0,0,0'],['1,0,0']]);
 assert.deepEqual(ensureModelObjects(m),m);assert.deepEqual(validateAsset(JSON.parse(JSON.stringify(m))),m);
});
test('same canvas join preserves geometry, active identity and independent undo selection',()=>{
 const s=session(),[a,b]=ids(s),geometry=structuredClone(s.model.canvases);s.setObjectSelection([a,b],b);
 assert.equal(s.joinObjects([a,b],b),b);assert.equal(ids(s).length,1);assert.deepEqual(s.model.canvases,geometry);assert.deepEqual(s.selectedObjectIds,[b]);
 s.undo();assert.deepEqual(ids(s),[a,b]);assert.deepEqual(s.selectedObjectIds,[a,b]);s.redo();assert.deepEqual(ids(s),[b]);
});
test('cross canvas join rejects atomically until compatible canvases merge',()=>{
 const s=session(),first=s.activeId,a=ids(s)[0];s.add('second',.25);paint(s);s.patch({originTicks:[16,0,0]});const second=s.activeId,b=s.objectForCanvas()!.objectId;
 const before=structuredClone(s.model),pivot=structuredClone(s.model.objects!.find(o=>o.objectId===b)!.originTicks);assert.throws(()=>s.joinObjects([a,b],a),/合并画布/);assert.deepEqual(s.model,before);
 s.mergeCanvases([first,second],first);assert.equal(s.model.canvases!.length,1);assert.equal(ids(s).length,3);
 assert.deepEqual(s.model.objects!.find(o=>o.objectId===b)!.cellKeys,['2,0,0']);assert.deepEqual(s.model.objects!.find(o=>o.objectId===b)!.originTicks,pivot);
 s.joinObjects([a,b],a);assert.equal(ids(s).length,2);s.undo();assert.equal(ids(s).length,3);s.undo();assert.equal(s.model.canvases!.length,2);
});
test('merge incompatible precision or misaligned origins leaves source data intact',()=>{
 const s=session(),first=s.activeId;s.add('fine',.125);paint(s);const second=s.activeId,before=structuredClone(s.model);
 assert.throws(()=>s.mergeCanvases([first,second],first),/精度/);assert.deepEqual(s.model,before);
 const t=session(),a=t.activeId;t.add('offset',.25);paint(t);t.patch({originTicks:[1,0,0]});const prior=structuredClone(t.model);assert.throws(()=>t.mergeCanvases([a,t.activeId],a),/对齐/);assert.deepEqual(t.model,prior);
});
test('object movement moves owned cells only and overwrites occupied destinations',()=>{
 const s=session(),[a,b]=ids(s);s.moveObjects([a],[8,0,0]);assert.equal(s.active.cells.length,1);assert.deepEqual(ids(s),[a]);assert.deepEqual(s.model.objects![0].cellKeys,['1,0,0']);
 s.undo();assert.deepEqual(ids(s),[a,b]);assert.equal(s.active.cells.length,2);s.redo();assert.equal(s.active.cells.length,1);
});
test('object transforms protect locked canvases and reject unaligned movements atomically',()=>{
 const s=session(),a=ids(s)[0],before=structuredClone(s.model),history=s.past.length;
 assert.throws(()=>s.moveObjects([a],[1,0,0]),/对齐/);assert.deepEqual(s.model,before);assert.equal(s.past.length,history);
 s.patch({locked:true});assert.throws(()=>s.moveObjects([a],[8,0,0]),/锁定/);assert.throws(()=>s.rotateObjects([a]),/锁定/);assert.throws(()=>s.removeObjects([a]),/锁定/);
});
test('four rotations restore occupied volume and membership at each precision',()=>{
 for(const step of [.25,.125,.0625])for(const axis of [0,1,2]){
 const s=session();s.patch({voxelStepM:step});const a=join(s),before=structuredClone(s.active.cells);
 for(let i=0;i<4;i++)s.rotateObjects([a],axis,1);
 const order=(v:any[])=>v.map(c=>JSON.stringify(c)).sort();assert.deepEqual(order(s.active.cells),order(before));assert.equal(s.model.objects![0].cellKeys!.length,2);validatePublishGlb(exportAssetGlb(s.model));}
});
test('clipboard preserves multiobject collection and restores independent identities',()=>{
 const s=session(),[a,b]=ids(s),collection=s.createObjectCollection([a,b],'pair'),clip=s.copyObjects([a,b]);assert.deepEqual(s.expandedObjectIds([a]),[a,b]);s.removeObjects([a,b]);
 const pasted=s.pasteObjects(clip);assert.equal(pasted.length,2);assert.ok(pasted.every(id=>id!==a&&id!==b));assert.deepEqual(s.expandedObjectIds([pasted[0]]),pasted);assert.notEqual(s.model.objectCollections![0].collectionId,collection);
 const after=structuredClone(s.model.canvases);s.undo();s.redo();assert.deepEqual(s.model.canvases,after);
});
test('editing merged object adds membership and separation keeps the same canvas and colors',()=>{
 const s=session(),a=join(s),canvas=s.activeId;s.setEditObject(a);paint(s,2);
 assert.deepEqual(s.model.objects![0].cellKeys,['0,0,0','1,0,0','2,0,0']);const before=structuredClone(s.model);
 const separated=s.separateCells([{x:2,y:0,z:0}])!;assert.ok(separated);assert.equal(s.activeId,canvas);assert.equal(s.model.canvases!.length,1);
 assert.deepEqual(s.model.objects!.find(o=>o.objectId===a)!.cellKeys,['0,0,0','1,0,0']);assert.deepEqual(s.model.objects!.find(o=>o.objectId===separated)!.cellKeys,['2,0,0']);assert.deepEqual(s.active.cells,before.canvases![0].cells);
 s.undo();assert.deepEqual(s.model.objects,before.objects);s.redo();const saved=validateAsset(JSON.parse(JSON.stringify(s.model))),reopened=new CanvasSession(saved);assert.deepEqual(reopened.model.objects,s.model.objects);assert.equal(reopened.model.assetId,'object-test');
});
test('validation rejects duplicate voxel ownership and dangling collections',()=>{
 const m=ensureModelObjects(fixture());assert.throws(()=>validateAsset({...m,objects:[...m.objects!,{...m.objects![0],objectId:'duplicate'}]}),/重复|归属|体素/);
 assert.throws(()=>validateAsset({...m,objectCollections:[{collectionId:'bad',name:'bad',memberIds:['missing']}]}),/不存在/);
 assert.deepEqual(validateAsset({...m,objects:[]}).canvases,m.canvases);
});
test('canvas deletion and duplication maintain independent cell ownership and collections',()=>{
 const s=session(),[a,b]=ids(s);s.createObjectCollection([a,b],'pair');const source=s.activeId;s.duplicate();assert.equal(s.model.objects!.length,4);assert.notEqual(s.activeId,source);s.remove(s.activeId);assert.deepEqual(ids(s),[a,b]);s.undo();assert.equal(ids(s).length,4);validateAsset(s.model);
});
test('copying all populated canvases at the canvas limit preserves data on paste',()=>{
 const s=session();for(let i=1;i<32;i++){s.add('part'+i,.25);paint(s);}
 const all=ids(s),clip=s.copyObjects(all);s.removeObjects(all);assert.equal(ids(s).length,0);
 // Empty canvases are legitimate drawing surfaces; paste should respect total canvas budget.
 for(const c of [...s.model.canvases!].slice(1))s.remove(c.canvasId);
 const pasted=s.pasteObjects(clip);assert.equal(pasted.length,33);assert.equal(s.model.canvases!.length,32);s.undo();assert.equal(s.model.canvases!.length,1);s.redo();assert.equal(s.model.canvases!.length,32);
});
test('paste after deleting an object preserves subsequent free modeling additions',()=>{
 const s=session(),all=ids(s),clip=s.copyObjects(all);s.removeObjects(all);paint(s,8);s.pasteObjects(clip);assert.equal(ids(s).length,3);assert.ok(s.model.canvases!.some(c=>c.cells.some(v=>v.x===8)));
});
test('object selection records independent history without modifying revision',()=>{
 const s=session(),[a,b]=ids(s),revision=s.model.revision;s.setObjectSelection([a],a);s.setObjectSelection([b],b);s.undo();assert.deepEqual(s.selectedObjectIds,[a]);assert.equal(s.model.revision,revision);s.redo();assert.deepEqual(s.selectedObjectIds,[b]);s.setObjectSelection([]);s.undo();assert.deepEqual(s.selectedObjectIds,[b]);
});
test('duplicate restores own selection before and after model undo',()=>{
 const s=session(),a=join(s),copied=s.duplicateObjects([a]);assert.deepEqual(s.selectedObjectIds,copied);s.undo();assert.deepEqual(s.selectedObjectIds,[a]);assert.equal(ids(s).length,1);s.redo();assert.deepEqual(s.selectedObjectIds,copied);assert.equal(ids(s).length,2);
});
