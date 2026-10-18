import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProjectV2, createSceneV2, validateProjectV2, validateSceneV2,
  checkProjectSceneReferences,
} from '../core/workshop-v2.ts';

test('v2 registers one project asset shared by two scenes without scene-local sources', () => {
  const project = createProjectV2('project');
  project.assets.push({
    kind: 'voxel', assetId: 'stone', name: '石柱', revision: 1,
    source: 'assets/stone/asset.xhmodule.json', preview: null,
  });
  const first = createSceneV2('first');
  const second = createSceneV2('second');
  for (const scene of [first, second]) {
    scene.instances.push({ instanceId: `${scene.sceneId}-one`, assetId: 'stone', positionM: [0, 0, 0], rotationDeg: 0, groupId: 'base' });
    scene.instances.push({ instanceId: `${scene.sceneId}-two`, assetId: 'stone', positionM: [0.25, 0, 0], rotationDeg: 0, groupId: 'base' });
    project.scenes.push({ sceneId: scene.sceneId, name: scene.name, revision: scene.revision, source: `scenes/${scene.sceneId}/scene.xhscene.json`, preview: null });
  }
  assert.equal(validateProjectV2(project).assets.length, 1);
  assert.deepEqual(checkProjectSceneReferences(project, [first, second]), []);
  assert.equal(validateSceneV2(first).assets, undefined);
});

test('v2 rejects arbitrary paths, duplicate assets, stale previews and missing references', () => {
  const project = createProjectV2('project');
  const row = { kind: 'voxel' as const, assetId: 'stone', name: '石柱', revision: 0, source: 'assets/stone/asset.xhmodule.json', preview: null };
  project.assets.push(row);
  assert.throws(() => validateProjectV2({ ...project, assets: [row, row] }), /重复/);
  assert.throws(() => validateProjectV2({ ...project, assets: [{ ...row, source: '../outside.json' }] }), /路径/);
  assert.throws(() => validateProjectV2({ ...project, assets: [{ ...row, preview: { source: 'assets/stone/preview.png', revision: 1, sourceHash: '0'.repeat(64) } }] }), /预览/);
  const scene = createSceneV2('scene');
  scene.instances.push({ instanceId: 'one', assetId: 'missing', positionM: [0, 0, 0], rotationDeg: 0, groupId: 'base' });
  project.scenes.push({ sceneId: 'scene', name: '', revision: 0, source: 'scenes/scene/scene.xhscene.json', preview: null });
  assert.match(checkProjectSceneReferences(project, [scene])[0], /missing/);
});

test('v1 documents are not accepted as v2 or silently upgraded', () => {
  const project = createProjectV2('project');
  assert.throws(() => validateProjectV2({ ...project, schema: 'xinghai-workshop-project-1' }), /格式/);
  const scene = createSceneV2('scene');
  assert.throws(() => validateSceneV2({ ...scene, assets: [] }), /字段/);
});

test('v2 accepts one controlled project asset category folder and rejects escaping paths', () => {
  const project = createProjectV2('project');
  const row = { kind: 'voxel' as const, assetId: 'stone', name: '石柱', revision: 0,
    source: 'assets/墓穴/stone/asset.xhmodule.json', preview: null };
  project.assets.push(row);
  assert.equal(validateProjectV2(project).assets[0].source, row.source);
  assert.throws(() => validateProjectV2({ ...project, assets: [{ ...row, source: 'assets/../stone/asset.xhmodule.json' }] }), /路径/);
  assert.throws(() => validateProjectV2({ ...project, assets: [{ ...row, source: 'assets/CON/stone/asset.xhmodule.json' }] }), /路径/);
});
