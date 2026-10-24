import test from 'node:test';
import assert from 'node:assert/strict';
import {createAsset} from '../core/workshop-documents.ts';
import {CanvasSession} from '../core/workshop-canvases.ts';
test('same canvas voxels have independent ownership and join is scoped',()=>{const a=createAsset('ownership');a.cells=[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:0}];const s=new CanvasSession(a);assert.equal(s.model.objects!.length,2);const ids=s.model.objects!.map(o=>o.objectId);s.joinObjects(ids);assert.equal(s.model.objects!.length,1);assert.equal(s.model.objects![0].cellKeys!.length,2);s.add('second',.25);assert.equal(s.model.objects!.length,1);});
test('editing adds to joined owner, blocks sibling, separates without new canvas',()=>{const a=createAsset('editing');a.cells=[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:0},{x:4,y:0,z:0,color:1}];const s=new CanvasSession(a);const ids=s.model.objects!.slice(0,2).map(o=>o.objectId);const joined=s.joinObjects(ids)!;s.setEditObject(joined);s.editor.begin();s.editor.volume(2,0,0,0);s.editor.volume(4,0,0,0);s.editor.commit();s.sync();assert.equal(s.model.objects!.find(o=>o.objectId===joined)!.cellKeys!.length,3);assert.equal(s.active.cells.find(v=>v.x===4)!.color,1);const split=s.separateCells([{x:2,y:0,z:0}]);assert.ok(split);assert.equal(s.model.canvases!.length,1);s.setEditObject(null);s.moveObjects([split!],[8,0,0]);assert.ok(s.active.cells.some(v=>v.x===3));assert.ok(s.active.cells.some(v=>v.x===4));});
test('canvas merge preserves object identity, maps world locations and rejects precision mismatch atomically',()=>{const a=createAsset('merge');a.cells=[{x:0,y:0,z:0,color:0}];const s=new CanvasSession(a),first=s.activeId,id=s.model.objects![0].objectId;s.add('second',.25);s.patch({originTicks:[16,0,0]});s.editor.begin();s.editor.volume(0,0,0,1);s.editor.commit();s.sync();const second=s.activeId,other=s.objectForCanvas()!.objectId;assert.throws(()=>s.joinObjects([id,other]));s.mergeCanvases([first,second],first);assert.equal(s.active.cells.length,2);assert.ok(s.active.cells.some(v=>v.x===2));assert.equal(s.model.objects!.length,2);assert.deepEqual(new Set(s.model.objects!.map(o=>o.objectId)),new Set([id,other]));s.undo();assert.equal(s.model.canvases!.length,2);s.redo();assert.equal(s.model.canvases!.length,1);s.add('fine',.125);const before=JSON.stringify(s.model);assert.throws(()=>s.mergeCanvases([first,s.activeId],first));assert.equal(JSON.stringify(s.model),before);});
test('clipboard duplicates only selected cells, preserves sibling, and records selection through history',()=>{const a=createAsset('copy');a.cells=[{x:0,y:0,z:0,color:0},{x:8,y:0,z:0,color:1}];const s=new CanvasSession(a),[x,y]=s.model.objects!.map(o=>o.objectId);s.setObjectSelection([x,y],x);s.setObjectSelection([x,y],y);s.undo();assert.equal(s.activeObjectId,x);s.redo();assert.equal(s.activeObjectId,y);const pasted=s.duplicateObjects([x]);assert.equal(pasted.length,1);assert.equal(s.model.canvases!.length,1);assert.equal(s.active.cells.length,3);assert.equal(s.model.objects!.find(o=>o.objectId===pasted[0])!.cellKeys!.length,1);s.removeObjects(pasted);assert.equal(s.active.cells.length,2);assert.ok(s.active.cells.some(v=>v.x===8));});
test('more than 32 individual voxel identities are supported',()=>{const a=createAsset('many');a.cells=Array.from({length:1000},(_,x)=>({x,y:0,z:0,color:0}));const s=new CanvasSession(a);assert.equal(s.model.objects!.length,1000);assert.equal(new Set(s.model.objects!.flatMap(o=>o.cellKeys!)).size,1000);});
test('save reload preserves explicit memberships and legacy crosscanvas object splits safely',()=>{const a=createAsset('save');a.cells=[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:1}];const s=new CanvasSession(a);const id=s.joinObjects(s.model.objects!.map(o=>o.objectId))!;const reopened=new CanvasSession(JSON.parse(JSON.stringify(s.model)));assert.equal(reopened.model.objects!.length,1);assert.equal(reopened.model.objects![0].objectId,id);assert.equal(reopened.model.objects![0].cellKeys!.length,2);reopened.duplicate();assert.equal(reopened.model.objects!.length,2);assert.equal(reopened.model.objects![1].cellKeys!.length,2);});

test('edit sync is idempotent after separation and blocked sibling writes leave no editor ghosts',()=>{
 const a=createAsset('isolation');a.cells=[{x:0,y:0,z:0,color:0},{x:2,y:0,z:0,color:1}];const s=new CanvasSession(a),id=s.model.objects![0].objectId;
 s.setEditObject(id);s.editor.begin();s.editor.volume(2,0,0,0);s.editor.volume(1,0,0,0);s.editor.commit();s.sync();
 assert.deepEqual(s.editor.doc.cells.map(v=>v.x).sort(),[0,1]);assert.equal(s.active.cells.find(v=>v.x===2)!.color,1);
 s.separateCells([{x:1,y:0,z:0}]);const revision=s.model.revision,count=s.past.length;s.sync();s.sync();assert.equal(s.model.revision,revision);assert.equal(s.past.length,count);
 s.undo();assert.deepEqual(s.model.objects!.find(o=>o.objectId===id)!.cellKeys,['0,0,0','1,0,0']);
});

test('legacy collection migration expands every replaced voxel owner without losing grouping',()=>{
 const s=new CanvasSession(Object.assign(createAsset('legacy-group'),{cells:[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:1}]}));const old=structuredClone(s.model);old.objects=[{objectId:'old',name:'old',canvasIds:[s.activeId],originTicks:[0,0,0]}];old.objectCollections=[{collectionId:'group',name:'pair',memberIds:['old']}];
 const migrated=new CanvasSession(old);assert.equal(migrated.model.objects!.length,2);assert.deepEqual(new Set(migrated.model.objectCollections![0].memberIds),new Set(migrated.model.objects!.map(o=>o.objectId)));
});

test('moving canvas shifts owned object pivots and duplicate keeps independent memberships',()=>{
 const a=createAsset('pivots');a.cells=[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:1}];const s=new CanvasSession(a),before=s.model.objects!.map(o=>o.originTicks);
 s.patch({originTicks:[16,8,0]});assert.deepEqual(s.model.objects!.map(o=>o.originTicks),before.map(v=>[v[0]+16,v[1]+8,v[2]]));
 s.duplicate();const copied=s.model.objects!.filter(o=>o.canvasIds[0]===s.activeId);assert.equal(copied.length,2);assert.ok(copied.every(o=>o.cellKeys!.length===1));
});

test('erasing all editing owner cells retains edit target and undo redo restores its membership only',()=>{
 const a=createAsset('empty-edit');a.cells=[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:1},{x:4,y:0,z:0,color:1}];const s=new CanvasSession(a),id=s.joinObjects(s.model.objects!.slice(0,2).map(o=>o.objectId))!;
 s.setEditObject(id);s.editor.begin();for(const v of [...s.editor.doc.cells])s.editor.put(v.x,v.y,v.z,0,'volume',true);s.editor.commit();s.sync();
 assert.equal(s.editObjectId,id);assert.deepEqual(s.model.objects!.find(o=>o.objectId===id)!.cellKeys,[]);assert.deepEqual(s.editor.doc.cells,[]);assert.deepEqual(s.active.cells.map(v=>v.x),[4]);
 const count=s.past.length;s.sync();assert.equal(s.past.length,count);s.undo();assert.deepEqual(s.editor.doc.cells.map(v=>v.x),[0,1]);assert.equal(s.editObjectId,id);s.redo();assert.deepEqual(s.editor.doc.cells,[]);assert.equal(s.editObjectId,id);
});

test('clipboard resolves occupied cells after converting source origin into target grid',()=>{
 const a=createAsset('shifted-copy');a.cells=[{x:0,y:0,z:0,color:0},{x:-1,y:0,z:0,color:1}];const s=new CanvasSession(a),id=s.model.objects![0].objectId,clip=s.copyObjects([id]);s.patch({originTicks:[8,0,0]});
 const pasted=s.pasteObjects(clip),owner=s.model.objects!.find(o=>o.objectId===pasted[0])!;
 assert.deepEqual(owner.cellKeys,['1,0,0']);assert.deepEqual(owner.originTicks,[20,4,4]);assert.equal(s.active.cells.length,3);
});

test('large legacy model collection expands beyond scene membership budget',()=>{
 const a=createAsset('large-group');a.cells=Array.from({length:10001},(_,i)=>({x:i%101,y:Math.floor(i/101),z:0,color:0}));const s=new CanvasSession(a),old=structuredClone(s.model);
 old.objects=[{objectId:'old',name:'old',canvasIds:[s.activeId],originTicks:[0,0,0]}];old.objectCollections=[{collectionId:'group',name:'all',memberIds:['old']}];
 const migrated=new CanvasSession(old);assert.equal(migrated.model.objectCollections![0].memberIds.length,10001);const all=migrated.model.objects!.map(o=>o.objectId);assert.deepEqual(new Set(migrated.expandedObjectIds([all[0]])),new Set(all));migrated.setObjectSelection(all);assert.equal(migrated.selectedObjectIds.length,10001);assert.equal(migrated.copyObjects(all).objects.length,10001);
});

test('merged canvas collision ownership follows source order without uniting survivors',()=>{
 const a=createAsset('overlap');a.cells=[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:0}];const s=new CanvasSession(a),first=s.activeId;s.add('second',.25);s.editor.begin();s.editor.volume(0,0,0,1);s.editor.commit();s.sync();const second=s.activeId,winner=s.objectForCanvas()!.objectId;
 s.mergeCanvases([first,second],first);assert.equal(s.active.cells.length,2);assert.equal(s.active.cells.find(v=>v.x===0)!.color,1);assert.equal(s.model.objects!.length,2);assert.deepEqual(s.model.objects!.find(o=>o.objectId===winner)!.cellKeys,['0,0,0']);
});
