import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsset, createProject, createScene } from '../core/workshop-documents.ts';
import { planV1Migration } from '../core/workshop-v2-migration.ts';

test('migration maps same-named private sources to different project assets and preserves placements', () => {
  const project = createProject('project');
  project.name = '旧工程';
  const scenes = ['first', 'second'].map((id) => {
    const scene = createScene(id); scene.name = id;
    scene.assets.push({ kind: 'voxel', assetId: 'stone', source: 'assets/stone.xhmodule.json' });
    scene.instances.push({ instanceId: `${id}-one`, assetId: 'stone', positionM: [0, 0, 0], rotationDeg: 0, groupId: 'base' });
    project.scenes.push({ sceneId: id, name: id, source: `scenes/${id}/scene.xhscene.json` });
    return scene;
  });
  const sources = new Map(scenes.map((scene, index) => {
    const asset = createAsset('stone'); asset.name = '同名石柱'; asset.revision = index;
    return [`${scene.sceneId}/stone`, asset];
  }));
  const ids = ['new-first', 'new-second'];
  const result = planV1Migration(project, scenes, sources, () => ids.shift()!);
  assert.deepEqual(result.project.assets.map((row) => row.assetId), ['new-first', 'new-second']);
  assert.equal(result.scenes[0].instances[0].assetId, 'new-first');
  assert.equal(result.scenes[1].instances[0].assetId, 'new-second');
  assert.equal(result.assets[0].document.name, '同名石柱');
  assert.equal(result.report.mappings.length, 2);
  assert.equal(project.schema, 'xinghai-workshop-project-1');
});

test('migration refuses missing or mismatched source instead of dropping an instance', () => {
  const project = createProject('project'); const scene = createScene('scene');
  scene.assets.push({ kind: 'voxel', assetId: 'stone', source: 'assets/stone.xhmodule.json' });
  project.scenes.push({ sceneId: 'scene', name: '', source: 'scenes/scene/scene.xhscene.json' });
  assert.throws(() => planV1Migration(project, [scene], new Map(), () => 'new'), /缺少/);
  assert.throws(() => planV1Migration(project, [scene], new Map([['scene/stone', createAsset('other')]]), () => 'new'), /身份/);
});
