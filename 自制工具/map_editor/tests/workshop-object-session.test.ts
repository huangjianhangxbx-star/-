import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkshopSession } from '../desktop/workshop-session.ts';
import { createAsset, createScene } from '../core/workshop-documents.ts';
import { ensureModelObjects } from '../core/workshop-canvases.ts';

test('editing entry upgrades a legacy session in place while assembly browsing keeps its old representation',()=>{
  const m=new WorkshopSession(),asset=createAsset('source');asset.name='原模块';asset.revision=7;
  asset.cells=[{x:0,y:0,z:0,color:2}];
  const s=m.openAsset(asset,'a'.repeat(64)),sessionId=s.sessionId,editor=s.editor;
  assert.equal(s.canvases,undefined);assert.equal(m.resolvedAssets().get('source')!.kind,'voxel');
  assert.equal(s.asset.schema,'xinghai-workshop-asset-1');
  const result=m.ensureObjects('source');
  assert.equal(result,s);assert.equal(s.sessionId,sessionId);assert.notEqual(s.editor,editor);
  assert.equal(s.editor,s.canvases!.editor);assert.equal(s.asset.assetId,'source');
  assert.equal(s.asset.name,'原模块');assert.equal(s.asset.revision,7);
  assert.equal(s.savedRevision,7);assert.equal(s.savedHash,'a'.repeat(64));
  assert.deepEqual(s.canvases!.active.cells,asset.cells);assert.deepEqual(m.dirtyDocuments(),[]);
  assert.equal(m.ensureObjects('source'),s);assert.equal(m.ensureObjects('source').editor,s.editor);
});
test('upgrade syncs committed legacy geometry and preserves old geometry and metadata undo/redo',()=>{
  const m=new WorkshopSession(),s=m.openAsset(createAsset('source'),'a'.repeat(64));
  m.rename(s.sessionId,'门');m.reanchor(s.sessionId,[.25,0,0]);
  s.editor.begin();s.editor.put(2,0,0,3,'volume');s.editor.commit();
  m.ensureObjects('source');const canvas=s.canvases!.activeId,object=s.canvases!.objectForCanvas()!.objectId;
  assert.equal(s.canvases!.active.cells.length,1);assert.deepEqual(m.dirtyDocuments(),['source']);
  m.undo(s.sessionId);assert.equal(s.canvases!.active.cells.length,0);assert.deepEqual(s.asset.anchorM,[.25,0,0]);
  m.undo(s.sessionId);assert.deepEqual(s.asset.anchorM,[0,0,0]);assert.equal(s.asset.name,'门');
  m.undo(s.sessionId);assert.equal(s.asset.name,'');
  for(let i=0;i<3;i++)m.redo(s.sessionId);
  assert.equal(s.asset.name,'门');assert.deepEqual(s.asset.anchorM,[.25,0,0]);assert.equal(s.canvases!.active.cells.length,1);
  assert.equal(s.canvases!.activeId,canvas);assert.equal(s.canvases!.objectForCanvas()!.objectId,object);
});
test('legacy redo history and independent voxel copy layers survive conversion',()=>{
  const m=new WorkshopSession(),s=m.openAsset(createAsset('source'),null);
  s.editor.begin();s.editor.put(0,0,0,0,'volume');s.editor.commit();m.sync(s.sessionId);
  s.editor.begin();s.editor.addVoxelCopy('copy',[{x:0,y:0,z:0,color:3}]);s.editor.commit();m.sync(s.sessionId);
  m.undo(s.sessionId);m.ensureObjects('source');
  assert.equal(s.canvases!.future.length,1);
  m.redo(s.sessionId);assert.equal(s.canvases!.active.voxelCopies![0].copyId,'copy');
  assert.equal(s.canvases!.active.baseCells![0].color,0);assert.equal(s.canvases!.active.cells[0].color,3);
  m.undo(s.sessionId);assert.equal(s.canvases!.active.voxelCopies,undefined);
});
test('joint Root history is transferred to converted snapshots for undo from either document',()=>{
  const m=new WorkshopSession(),s=m.openAsset(createAsset('source'),'a'.repeat(64)),scene=createScene('scene');
  scene.assets.push({kind:'voxel',assetId:'source',source:'assets/source.xhmodule.json'});
  scene.instances.push({instanceId:'one',assetId:'source',positionM:[1,0,0],rotationDeg:0,groupId:'base'});
  m.openScene(scene,'b'.repeat(64));m.reanchor(s.sessionId,[.25,0,0]);
  m.ensureObjects('source');
  m.undo(s.sessionId);assert.deepEqual(s.asset.anchorM,[0,0,0]);assert.equal(m.sceneSession('scene').snapshot().instances[0].positionM[0],1);
  m.redoScene('scene');assert.deepEqual(s.asset.anchorM,[.25,0,0]);assert.equal(m.sceneSession('scene').snapshot().instances[0].positionM[0],1.25);
  assert.throws(()=>m.closeAsset('source',true),/联合/);
});
test('existing canvas sessions are reused and in-progress legacy strokes cannot be discarded by migration',()=>{
  const m=new WorkshopSession(),a=m.openAsset(ensureModelObjects(createAsset('multi')),null),canvas=a.canvases;
  assert.equal(m.ensureObjects('multi').canvases,canvas);
  const b=m.openAsset(createAsset('legacy'),null),editor=b.editor;
  editor.begin();editor.put(0,0,0,1,'volume');
  assert.throws(()=>m.ensureObjects('legacy'),/笔刷|笔画/);
  assert.equal(b.editor,editor);assert.equal(b.canvases,undefined);assert.ok(editor.before);
});
test('undone joint Root commands can be redone after upgrade and remain guarded by later edits',()=>{
  const m=new WorkshopSession(),s=m.openAsset(createAsset('source'),null),scene=createScene('scene');
  scene.assets.push({kind:'voxel',assetId:'source',source:'assets/source.xhmodule.json'});
  scene.instances.push({instanceId:'one',assetId:'source',positionM:[1,0,0],rotationDeg:0,groupId:'base'});
  const assembly=m.openScene(scene,null);
  m.reanchor(s.sessionId,[.25,0,0]);m.undoScene('scene');m.ensureObjects('source');
  m.redo(s.sessionId);assert.deepEqual(s.asset.anchorM,[.25,0,0]);assert.equal(assembly.snapshot().instances[0].positionM[0],1.25);
  s.canvases!.add('细节',.125);m.sync(s.sessionId);
  assert.throws(()=>m.undoScene('scene'),/后续编辑/);
  m.undo(s.sessionId);m.undoScene('scene');
  assert.deepEqual(s.asset.anchorM,[0,0,0]);assert.equal(assembly.snapshot().instances[0].positionM[0],1);
});
test('selection history is session-only and does not turn a saved asset dirty',()=>{
  const m=new WorkshopSession(),s=m.openAsset(ensureModelObjects(createAsset('source')),null),c=s.canvases!,a=c.objectForCanvas()!.objectId;
  c.add('second',.125);const b=c.objectForCanvas()!.objectId;
  m.sync(s.sessionId);m.markSaved(s.sessionId,s.asset.revision,'a'.repeat(64));
  const saved=structuredClone(s.asset);
  c.setObjectSelection([a],a);c.setObjectSelection([b],b);
  assert.deepEqual(m.dirtyDocuments(),[]);
  m.undo(s.sessionId);assert.deepEqual(c.selectedObjectIds,[a]);assert.deepEqual(m.dirtyDocuments(),[]);
  m.redo(s.sessionId);assert.deepEqual(c.selectedObjectIds,[b]);assert.deepEqual(m.dirtyDocuments(),[]);
  assert.deepEqual(m.sync(s.sessionId),saved);
});
