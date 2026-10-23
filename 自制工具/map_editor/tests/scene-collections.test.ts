import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsset, createScene, validateScene, restoreSceneCollections } from '../core/workshop-documents.ts';
import { validateSceneV2 } from '../core/workshop-v2.ts';
import { transformPoint, isVoxelAligned } from '../core/coordinates.ts';
import { SceneSession } from '../core/scene-session.ts';

function fixture() {
  const asset = createAsset('stone'), scene = createScene('scene');
  scene.assets.push({ kind: 'voxel', assetId: 'stone', source: 'assets/stone.xhmodule.json' });
  for (const [index, instanceId] of ['one', 'two', 'three'].entries())
    scene.instances.push({ instanceId, assetId: 'stone', positionM: [index, 0, 0], rotationDeg: 0, groupId: 'base' });
  return new SceneSession(scene, new Map([['stone', { kind: 'voxel', document: asset }]]));
}

test('collections select their entire membership, merge without nesting, and undo grouping', () => {
  const session = fixture();
  assert.equal(typeof session.createCollection, 'function');
  const first = session.createCollection(['one', 'two'], '墙组');
  assert.deepEqual(session.expandSelection(['two']), ['two', 'one']);
  assert.deepEqual(session.expandSelection(['missing', 'one', 'one']), ['one', 'two']);
  session.renameCollection(first, '入口');
  assert.equal(session.snapshot().collections?.[0].name, '入口');
  session.undo();
  assert.equal(session.snapshot().collections?.[0].name, '墙组');
  session.redo();
  session.createCollection(['two', 'three'], '建筑');
  assert.equal(session.snapshot().collections?.length, 1);
  assert.deepEqual(new Set(session.expandSelection(['one'])), new Set(['one', 'two', 'three']));
  session.undo();
  assert.deepEqual(session.snapshot().collections, [{ collectionId: first, name: '入口', memberIds: ['one', 'two'] }]);
  session.dissolveCollections(['two']);
  assert.deepEqual(session.expandSelection(['two']), ['two']);
  session.undo();
  assert.deepEqual(new Set(session.expandSelection(['two'])), new Set(['one', 'two']));
});

test('clipboard collections remain detached and pasted copies get independent membership', () => {
  const session = fixture();
  assert.equal(typeof session.copyCollections, 'function');
  const first = session.createCollection(['one', 'two'], '入口');
  assert.deepEqual(session.copyCollections(['one']), []);
  const copied = session.snapshot().instances.slice(0, 2), collections = session.copyCollections(['one', 'two']);
  session.duplicateMany(['one', 'two'], ['copy-one', 'copy-two']);
  const duplicate = session.snapshot().collections?.[1];
  assert.notEqual(duplicate?.collectionId, first);
  assert.deepEqual(duplicate?.memberIds, ['copy-one', 'copy-two']);
  assert.deepEqual(new Set(session.expandSelection(['copy-two'])), new Set(['copy-one', 'copy-two']));
  session.removeMany(['one', 'two']);
  session.pasteElements(copied, ['paste-one', 'paste-two'], collections);
  assert.deepEqual(session.snapshot().collections?.at(-1)?.memberIds, ['paste-one', 'paste-two']);
  assert.deepEqual(collections[0].memberIds, ['one', 'two']);
  session.undo();
  assert.equal(session.snapshot().instances.some(p => p.instanceId === 'paste-one'), false);
  assert.equal(session.snapshot().collections?.length, 1);
  session.redo();
  const before = session.snapshot();
  assert.throws(() => session.pasteElements(copied, ['bad-one', 'bad-two'], [{ ...collections[0], memberIds: ['missing'] }]));
  assert.deepEqual(session.snapshot(), before);
});

test('deleting members keeps valid surviving membership and restores it with undo', () => {
  const session = fixture();
  assert.equal(typeof session.createCollection, 'function');
  session.createCollection(['one', 'two'], '入口');
  session.remove('one');
  assert.deepEqual(session.snapshot().collections?.[0].memberIds, ['two']);
  session.removeMany(['two']);
  assert.deepEqual(session.snapshot().collections, []);
  session.undo(); session.undo();
  assert.deepEqual(session.snapshot().collections?.[0].memberIds, ['one', 'two']);
});

test('collection rotation preserves relative geometry around its first member', () => {
  const session = fixture();
  assert.equal(typeof session.createCollection, 'function');
  session.createCollection(['one', 'two'], '入口');
  session.rotateMany(['two', 'one']);
  assert.deepEqual(session.snapshot().instances.map(p => p.positionM), [[0, 0, 0], [0, 1, 0], [2, 0, 0]]);
  assert.deepEqual(session.snapshot().instances.map(p => p.rotationDeg), [90, 90, 0]);
  session.undo();
  assert.deepEqual(session.snapshot().instances[1].positionM, [1, 0, 0]);
});

test('legacy and V2 scenes accept optional collections while rejecting nested, duplicate and missing members', () => {
  const legacy = fixture().snapshot();
  const { assets: _assets, ...rest } = legacy;
  const modern = { ...rest, schema: 'xinghai-workshop-scene-2' };
  for (const [scene, validate] of [[legacy, validateScene], [modern, validateSceneV2]] as const) {
    assert.doesNotThrow(() => validate(scene));
    const collections = [{ collectionId: 'entry', name: '入口', memberIds: ['one', 'two'] }];
    assert.deepEqual(validate({ ...scene, collections }).collections, collections);
    for (const invalid of [
      [{ ...collections[0], memberIds: [] }],
      [{ ...collections[0], memberIds: ['missing'] }],
      [{ ...collections[0], memberIds: ['one', 'one'] }],
      [collections[0], { collectionId: 'other', name: '其他', memberIds: ['two'] }],
      [collections[0], { collectionId: 'other', name: '嵌套', memberIds: ['entry'] }],
      [{ ...collections[0], unexpected: true }],
    ]) assert.throws(() => validate({ ...scene, collections: invalid }));
  }
});


test('collection rotation with different legacy Roots keeps world geometry rigid and sources unchanged', () => {
  const first = createAsset('first'), second = createAsset('second'), scene = createScene('scene');
  first.anchorM = [.125, 0, .125]; first.rootMode = 'legacy';
  second.anchorM = [0, .125, 0]; second.rootMode = 'legacy';
  scene.assets.push(
    { kind: 'voxel', assetId: 'first', source: 'assets/first.xhmodule.json' },
    { kind: 'voxel', assetId: 'second', source: 'assets/second.xhmodule.json' },
  );
  scene.instances.push(
    { instanceId: 'one', assetId: 'first', positionM: [.125, 0, .125], rotationDeg: 0, groupId: 'base' },
    { instanceId: 'two', assetId: 'second', positionM: [1, .125, 0], rotationDeg: 0, groupId: 'base' },
  );
  const session = new SceneSession(scene, new Map([['first', { kind: 'voxel', document: first }], ['second', { kind: 'voxel', document: second }]]));
  const sourceBefore = structuredClone([first, second]);
  session.createCollection(['one', 'two'], '入口');
  session.rotateMany(['two', 'one']);
  const [one, two] = session.snapshot().instances;
  const origin1 = transformPoint([0, 0, 0], first.anchorM, one.positionM, one.rotationDeg);
  const origin2 = transformPoint([0, 0, 0], second.anchorM, two.positionM, two.rotationDeg);
  assert.deepEqual(origin2.map((n, i) => n - origin1[i]), [0, 1, 0]);
  assert.equal(isVoxelAligned(first.anchorM, one.positionM, one.rotationDeg), true);
  assert.equal(isVoxelAligned(second.anchorM, two.positionM, two.rotationDeg), true);
  assert.deepEqual([first, second], sourceBefore);
});

test('restoring archived membership preserves a newer user collection and its name', () => {
  const scene = fixture().snapshot();
  scene.collections = [{ collectionId: 'new', name: '新墙组', memberIds: ['two', 'three'] }];
  restoreSceneCollections(scene, [{ collectionId: 'old', name: '旧入口', memberIds: ['one', 'two'] }]);
  assert.deepEqual(scene.collections, [
    { collectionId: 'new', name: '新墙组', memberIds: ['two', 'three'] },
    { collectionId: 'old', name: '旧入口', memberIds: ['one'] },
  ]);
  assert.doesNotThrow(() => validateScene(scene));
});
