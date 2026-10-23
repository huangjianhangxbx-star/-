import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkshopSession } from '../desktop/workshop-session.ts';
import { createAsset, createScene } from '../core/workshop-documents.ts';
import { upgradeCanvases } from '../core/workshop-canvases.ts';

test('repeated scene reads do not revalidate unchanged dense model geometry', () => {
  const manager = new WorkshopSession(), asset = createAsset('dense'), scene = createScene('s');
  for (let x = 0; x < 64; x++) for (let y = 0; y < 32; y++) for (let z = 0; z < 24; z++)
    asset.cells.push({ x, y, z, color: 0 });
  scene.assets.push({ kind: 'voxel', assetId: 'dense', source: 'assets/dense.xhmodule.json' });
  for (let i = 0; i < 130; i++) scene.instances.push({ instanceId: `i${i}`, assetId: 'dense', positionM: [i, 0, 0], rotationDeg: 0, groupId: 'base' });
  manager.openAsset(asset, '0'.repeat(64)); manager.openScene(scene, '0'.repeat(64));
  const start = performance.now();
  for (let i = 0; i < 10; i++) assert.equal(manager.sceneSession('s').snapshot().instances.length, 130);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 500, `ten unchanged scene reads took ${elapsed.toFixed(0)} ms`);
});

test('cached sync follows committed geometry, palette changes, undo and same-revision restore', () => {
  const manager = new WorkshopSession(), session = manager.openAsset(createAsset('a'), null), editor = session.editor;
  manager.sync(session.sessionId);
  editor.begin(); editor.volume(0, 0, 0, 0); editor.commit();
  assert.equal(manager.sync(session.sessionId).cells.length, 1);
  editor.begin(); editor.data.palette[0] = '#123456'; editor.commit();
  assert.equal(manager.sync(session.sessionId).palette[0], '#123456');
  manager.undo(session.sessionId); assert.notEqual(manager.sync(session.sessionId).palette[0], '#123456');
  manager.redo(session.sessionId); assert.equal(manager.sync(session.sessionId).palette[0], '#123456');
  const replacement = structuredClone(editor.doc); replacement.cells[0].color = 1;
  editor.restore(replacement);
  assert.equal(manager.sync(session.sessionId).cells[0].color, 1);
  editor.begin(); editor.volume(1, 0, 0, 0);
  assert.equal(manager.sync(session.sessionId).cells.length, 1);
  editor.cancel(); assert.equal(manager.sync(session.sessionId).cells.length, 1);
});

test('cached sync preserves metadata commands and in-place palette metadata edits', () => {
  const manager = new WorkshopSession(), session = manager.openAsset(createAsset('a'), null);
  manager.sync(session.sessionId); manager.rename(session.sessionId, '门'); manager.reanchor(session.sessionId, [.25, 0, 0]);
  assert.equal(manager.sync(session.sessionId).name, '门');
  assert.deepEqual(manager.sync(session.sessionId).anchorM, [.25, 0, 0]);
  manager.undo(session.sessionId); assert.deepEqual(manager.sync(session.sessionId).anchorM, [0, 0, 0]);
  manager.redo(session.sessionId); assert.deepEqual(manager.sync(session.sessionId).anchorM, [.25, 0, 0]);
  session.editor.data.palette[0] = '#654321';
  assert.equal(manager.sync(session.sessionId).palette[0], '#654321');
  session.asset.name = '原位元数据变更'; session.asset.anchorM[1] = .5;
  assert.equal(manager.sync(session.sessionId).name, '原位元数据变更');
  assert.deepEqual(manager.sync(session.sessionId).anchorM, [.25, .5, 0]);
});

test('cached multi-canvas sync follows switching, changes, undo and active geometry', () => {
  const manager = new WorkshopSession(), session = manager.openAsset(upgradeCanvases(createAsset('a'), 'multi'), null), multi = session.canvases!;
  manager.sync(session.sessionId); const first = multi.activeId;
  multi.editor.begin(); multi.editor.volume(0, 0, 0, 0); multi.editor.commit();
  assert.equal(manager.sync(session.sessionId).canvases![0].cells.length, 1);
  multi.add('二层', .25); multi.editor.begin(); multi.editor.volume(2, 0, 0, 1); multi.editor.commit();
  assert.equal(manager.sync(session.sessionId).canvases![1].cells[0].x, 2);
  multi.patch({ originTicks: [4, 0, 0] });
  assert.deepEqual(manager.sync(session.sessionId).canvases![1].originTicks, [4, 0, 0]);
  manager.undo(session.sessionId); assert.deepEqual(manager.sync(session.sessionId).canvases![1].originTicks, [0, 0, 0]);
  manager.redo(session.sessionId); assert.deepEqual(manager.sync(session.sessionId).canvases![1].originTicks, [4, 0, 0]);
  multi.select(first); multi.editor.begin(); multi.editor.volume(1, 0, 0, 2); multi.editor.commit();
  const result = manager.sync(session.sessionId);
  assert.equal(result.canvases![0].cells.length, 2); assert.equal(result.canvases![1].cells.length, 1);
});

test('cached sync updates an independent voxel copy after movement and undo', () => {
  const manager = new WorkshopSession(), asset = createAsset('a');
  asset.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  const session = manager.openAsset(asset, null), editor = session.editor;
  manager.sync(session.sessionId);
  editor.begin(); editor.addVoxelCopy('copy', [{ x: 0, y: 0, z: 0, color: 1 }]); editor.commit();
  assert.equal(manager.sync(session.sessionId).voxelCopies![0].cells[0].x, 0);
  editor.begin(); editor.moveVoxelCopy('copy', [2, 0, 0]); editor.commit();
  let result = manager.sync(session.sessionId);
  assert.equal(result.voxelCopies![0].cells[0].x, 2); assert.equal(result.baseCells![0].x, 0);
  manager.undo(session.sessionId); result = manager.sync(session.sessionId);
  assert.equal(result.voxelCopies![0].cells[0].x, 0); assert.equal(result.cells.length, 1);
});

test('multi-canvas palette edits with unchanged editor revision are synchronized', () => {
  const manager = new WorkshopSession(), session = manager.openAsset(upgradeCanvases(createAsset('a'), 'multi'), null);
  manager.sync(session.sessionId);
  session.canvases!.editor.data.palette[0] = '#102030';
  assert.equal(manager.sync(session.sessionId).palette[0], '#102030');
  manager.rename(session.sessionId, '多画布新名'); manager.reanchor(session.sessionId, [.5, .25, 0]);
  assert.equal(manager.sync(session.sessionId).name, '多画布新名');
  assert.deepEqual(manager.sync(session.sessionId).anchorM, [.5, .25, 0]);
  manager.undo(session.sessionId); assert.deepEqual(manager.sync(session.sessionId).anchorM, [0, 0, 0]);
});
