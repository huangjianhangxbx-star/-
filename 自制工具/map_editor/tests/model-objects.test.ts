import test from 'node:test';
import assert from 'node:assert/strict';
import { createAsset, validateAsset } from '../core/workshop-documents.ts';
import { CanvasSession, ensureModelObjects } from '../core/workshop-canvases.ts';
import { exportAssetGlb } from '../core/workshop-glb.ts';
import { validatePublishGlb } from '../core/publish-glb-validation.ts';

function fixture() {
  const asset = createAsset('object-test');
  asset.name = '旧资产'; asset.revision = 7;
  asset.cells = [{x:0,y:0,z:0,color:0}, {x:1,y:0,z:0,color:1}];
  return asset;
}
test('model object migration preserves asset identity, geometry and source metadata', () => {
  const old = fixture(), before = structuredClone(old), normalized = ensureModelObjects(old);
  assert.deepEqual(old, before);
  assert.equal(normalized.assetId, old.assetId);
  assert.equal(normalized.name, old.name);
  assert.equal(normalized.revision, old.revision);
  assert.deepEqual(normalized.canvases![0].cells, old.cells);
  assert.equal(normalized.objects!.length, 1);
  assert.deepEqual(normalized.objects![0].canvasIds, [normalized.canvases![0].canvasId]);
  assert.deepEqual(ensureModelObjects(normalized), normalized);
  assert.deepEqual(validateAsset(JSON.parse(JSON.stringify(normalized))), normalized);
});
test('join changes object identity without resampling mixed precision; undo restores both objects', () => {
  const s = new CanvasSession(ensureModelObjects(fixture())), first=s.objectForCanvas()!;
  s.add('细节', .0625); const second=s.objectForCanvas()!;
  s.patch({originTicks:[3,5,8]});
  s.editor.begin(); s.editor.put(2,3,1,1,'volume'); s.editor.commit(); s.sync();
  const geometry=structuredClone(s.model.canvases);
  const joined=s.joinObjects([first.objectId, second.objectId], first.objectId);
  assert.equal(joined, first.objectId);
  assert.equal(s.model.objects!.length, 1);
  assert.deepEqual(s.model.canvases, geometry);
  assert.deepEqual(s.model.objects![0].canvasIds, geometry!.map(c=>c.canvasId));
  s.undo(); assert.equal(s.model.objects!.length, 2);
  s.redo(); assert.equal(s.model.objects!.length, 1);
});
test('object transform keeps constituent canvases and copy sources coherent and undoable', () => {
  const s=new CanvasSession(ensureModelObjects(fixture()));
  s.editor.begin(); s.editor.addVoxelCopy('copy', [{x:2,y:0,z:0,color:1}]); s.editor.commit(); s.sync();
  const id=s.objectForCanvas()!.objectId;
  s.add('精细',.125); const fine=s.objectForCanvas()!.objectId;
  s.patch({originTicks:[8,0,0]}); s.joinObjects([id,fine],id);
  s.moveObjects([id], [4,-3,2]);
  assert.deepEqual(s.model.canvases!.map(c=>c.originTicks), [[4,-3,2],[12,-3,2]]);
  assert.deepEqual(s.model.objects![0].originTicks,[4,-3,2]);
  s.rotateObjects([id], 2, 1);
  assert.deepEqual(s.model.canvases!.map(c=>c.originTicks), [[4,-3,2],[4,5,2]]);
  assert.deepEqual(s.model.canvases![0].cells.map(c=>[c.x,c.y,c.z]),[[-1,0,0],[-1,1,0],[-1,2,0]]);
  assert.deepEqual(s.model.canvases![0].voxelCopies![0].cells.map(c=>[c.x,c.y]),[[-1,2]]);
  s.undo(); assert.equal(s.model.canvases![0].cells[0].x,0);
  s.redo(); assert.equal(s.model.canvases![0].cells[0].x,-1);
  validateAsset(s.model);
});
test('object clipboard clones all member canvases and collections with independent identities', () => {
  const s=new CanvasSession(ensureModelObjects(fixture())), a=s.objectForCanvas()!.objectId;
  s.add('第二件',.125); const b=s.objectForCanvas()!.objectId;
  const collection=s.createObjectCollection([a,b],'成套');
  assert.deepEqual(s.expandedObjectIds([a]),[a,b]);
  const clipboard=s.copyObjects([a,b]);
  s.removeObjects([a,b]);
  const pasted=s.pasteObjects(clipboard);
  assert.equal(pasted.length,2);
  assert.ok(pasted.every(id=>id!==a&&id!==b));
  assert.deepEqual(s.expandedObjectIds([pasted[0]]),pasted);
  assert.equal(s.model.objectCollections!.length,1);
  assert.notEqual(s.model.objectCollections![0].collectionId,collection);
  const pastedCanvases=s.model.objects!.filter(o=>pasted.includes(o.objectId)).flatMap(o=>o.canvasIds);
  assert.ok(pastedCanvases.every(id=>!clipboard.canvases.some(c=>c.canvasId===id)));
  const before=s.model.canvases!.filter(c=>pastedCanvases.includes(c.canvasId));
  s.undo(); s.redo();
  assert.deepEqual(s.model.canvases!.filter(c=>pastedCanvases.includes(c.canvasId)),before);
});
test('separate selected cells preserves overlaid copy data, palette and physical placement', () => {
  const s=new CanvasSession(ensureModelObjects(fixture()));
  s.patch({originTicks:[3,-2,7]});
  s.editor.begin(); s.editor.addVoxelCopy('overlay',[{x:0,y:0,z:0,color:2},{x:3,y:0,z:0,color:3}]); s.editor.commit(); s.sync();
  const before=structuredClone(s.model), source=s.activeId;
  const id=s.separateCells([{x:0,y:0,z:0,color:2}]);
  assert.ok(id); assert.equal(s.model.objects!.length,2);
  assert.deepEqual(s.active.originTicks,[3,-2,7]);
  assert.deepEqual(s.active.cells,[{x:0,y:0,z:0,color:2}]);
  assert.equal(s.active.baseCells!.length,1);
  assert.equal(s.active.voxelCopies![0].cells.length,1);
  const original=s.model.canvases!.find(c=>c.canvasId===source)!;
  assert.deepEqual(original.cells.map(c=>c.x),[1,3]);
  assert.deepEqual(s.model.palette,before.palette);
  s.undo(); assert.deepEqual(s.model.canvases,before.canvases);
  s.redo(); validateAsset(s.model);
});
test('validation rejects overlapping object canvas ownership and dangling collections', () => {
  const m=ensureModelObjects(fixture());
  assert.throws(()=>validateAsset({...m,objects:[m.objects![0],{...m.objects![0],objectId:'duplicate-owner'}]}),/画布|重复/);
  assert.throws(()=>validateAsset({...m,objectCollections:[{collectionId:'bad',name:'无效',memberIds:['missing']}]}),/不存在/);
  assert.throws(()=>validateAsset({...m,objects:[]}),/物体|画布/);
});
test('object transforms reject invalid destinations atomically and locked members remain protected', () => {
  const s=new CanvasSession(ensureModelObjects(fixture())),id=s.objectForCanvas()!.objectId;
  const before=structuredClone(s.model),history=s.past.length;
  assert.throws(()=>s.moveObjects([id],[65537,0,0]),/原点/);
  assert.deepEqual(s.model,before); assert.equal(s.past.length,history);
  s.patch({locked:true});
  assert.throws(()=>s.moveObjects([id],[1,0,0]),/锁定/);
  assert.throws(()=>s.rotateObjects([id]),/锁定/);
  assert.throws(()=>s.removeObjects([id]),/锁定/);
});
test('four quarter turns restore exact occupied volume at every precision without resampling', () => {
  for(const axis of [0,1,2]){
    const s=new CanvasSession(ensureModelObjects(fixture())),a=s.objectForCanvas()!.objectId;
    s.add('fine',.0625);const b=s.objectForCanvas()!.objectId;
    s.patch({originTicks:[3,-7,19]});
    s.editor.begin();s.editor.put(-2,5,3,2,'volume');s.editor.commit();s.sync();
    s.joinObjects([a,b],a);const before=structuredClone(s.model.canvases);
    for(let turn=0;turn<4;turn++)s.rotateObjects([a],axis,1);
    assert.deepEqual(s.model.canvases,before);
    validatePublishGlb(exportAssetGlb(s.model));
  }
});
test('canvas deletion and duplication maintain object ownership and collection membership across undo',()=>{
  const s=new CanvasSession(ensureModelObjects(fixture())),first=s.activeId,a=s.objectForCanvas()!.objectId;
  s.add('second',.125);const second=s.activeId,b=s.objectForCanvas()!.objectId;
  s.createObjectCollection([a,b],'pair');
  s.remove(second);
  assert.deepEqual(s.model.objectCollections![0].memberIds,[a]);
  s.undo();assert.deepEqual(s.model.objectCollections![0].memberIds,[a,b]);
  s.joinObjects([a,b],a);s.remove(second);
  assert.deepEqual(s.model.objects![0].canvasIds,[first]);
  s.duplicate();assert.equal(s.model.objects!.length,2);
  assert.notEqual(s.model.objects![0].canvasIds[0],s.model.objects![1].canvasIds[0]);
  validateAsset(s.model);
});
test('cutting and pasting a model at its canvas limit does not fail on the automatic empty placeholder',()=>{
  const s=new CanvasSession(ensureModelObjects(fixture()));
  for(let i=1;i<32;i++)s.add('物体'+i,.25);
  const ids=s.model.objects!.map(o=>o.objectId),clipboard=s.copyObjects(ids);
  s.removeObjects(ids);const placeholder=s.activeId;
  const pasted=s.pasteObjects(clipboard);
  assert.equal(pasted.length,32);assert.equal(s.model.canvases!.length,32);
  assert.ok(!s.model.canvases!.some(c=>c.canvasId===placeholder));
  s.undo();assert.equal(s.activeId,placeholder);assert.equal(s.model.canvases!.length,1);
  s.redo();assert.equal(s.model.canvases!.length,32);
});
test('pasting after clearing a model preserves edits subsequently made in the replacement canvas',()=>{
  const s=new CanvasSession(ensureModelObjects(fixture())),ids=[s.objectForCanvas()!.objectId],clipboard=s.copyObjects(ids);
  s.removeObjects(ids);const replacement=s.activeId;
  s.editor.begin();s.editor.put(8,0,0,3,'volume');s.editor.commit();s.sync();
  s.pasteObjects(clipboard);
  assert.equal(s.model.objects!.length,2);
  assert.equal(s.model.canvases!.find(c=>c.canvasId===replacement)!.cells[0].x,8);
});
test('object selection is undoable independently and never changes document revision',()=>{
  const s=new CanvasSession(ensureModelObjects(fixture())),a=s.objectForCanvas()!.objectId;
  s.add('B',.125);const b=s.objectForCanvas()!.objectId,revision=s.model.revision;
  s.setObjectSelection([a],a);s.setObjectSelection([b],b);
  assert.deepEqual(s.selectedObjectIds,[b]);
  s.undo();assert.deepEqual(s.selectedObjectIds,[a]);assert.equal(s.objectForCanvas()!.objectId,a);assert.equal(s.model.revision,revision);
  s.redo();assert.deepEqual(s.selectedObjectIds,[b]);assert.equal(s.objectForCanvas()!.objectId,b);assert.equal(s.model.revision,revision);
  s.setObjectSelection([]);s.undo();assert.deepEqual(s.selectedObjectIds,[b]);assert.equal(s.model.revision,revision);
});
test('joining and duplicating restore their own selection before and after model undo',()=>{
  const s=new CanvasSession(ensureModelObjects(fixture())),a=s.objectForCanvas()!.objectId;
  s.add('B',.125);const b=s.objectForCanvas()!.objectId;
  s.setObjectSelection([a,b],b);s.joinObjects([a,b],b);
  assert.deepEqual(s.selectedObjectIds,[b]);
  s.undo();assert.deepEqual(s.selectedObjectIds,[a,b]);assert.equal(s.model.objects!.length,2);
  s.redo();assert.deepEqual(s.selectedObjectIds,[b]);
  const copied=s.duplicateObjects([b]);assert.deepEqual(s.selectedObjectIds,copied);
  s.undo();assert.deepEqual(s.selectedObjectIds,[b]);assert.equal(s.model.objects!.length,1);
  s.redo();assert.deepEqual(s.selectedObjectIds,copied);assert.equal(s.model.objects!.length,2);
});
test('choosing a different active member within the same selection records its origin without changing membership',()=>{
  const s=new CanvasSession(ensureModelObjects(fixture())),a=s.objectForCanvas()!.objectId;
  s.add('B',.125);const b=s.objectForCanvas()!.objectId;
  s.setObjectSelection([a,b],a);s.setObjectSelection([a,b],b);
  s.undo();assert.deepEqual(s.selectedObjectIds,[a,b]);assert.equal(s.objectForCanvas()!.objectId,a);
});
