import assert from 'node:assert/strict';
import test from 'node:test';
import type { MotionSource, TargetSummary } from '../src/core/contracts.ts';

const source: MotionSource = {
  clips: [{ id: 'clip:0', name: 'Walk', durationSeconds: 2 }],
  joints: [{ path: '/Armature/hip', parentPath: null, name: 'hip' }, { path: '/Armature/hip/foot', parentPath: '/Armature/hip', name: 'foot' }],
  poseAt: () => [],
};
const target: TargetSummary = {
  editorVersion: '4.3.26',
  bones: [{ name: 'root', parent: null, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 0 }],
  skins: ['default'], animations: [], constraints: [],
};

test('new draft selects the real clip range but requires explicit bone decisions', async () => {
  const { createDraftConfig, readinessIssues } = await import('../src/ui/workshop-state.ts');
  const config = createDraftConfig(source, target, 'C:/in/CesiumMan.glb', 'C:/in/rozeul.json');
  assert.equal(config.source.clipId, 'clip:0');
  assert.deepEqual(config.source.rangeSeconds, [0, 2]);
  assert.equal(config.target.skin, 'default');
  assert.equal(config.anchors.sourceFootPath, '');
  assert.equal(config.anchors.targetFootBone, '');
  assert.deepEqual(config.mappings, []);
  assert.deepEqual(readinessIssues(config, source, target), ['选择源脚点', '选择目标脚骨', '至少添加一条骨骼映射', '选择输出目录']);
});

test('ready draft accepts a real mapping and rejects stale clip or target references', async () => {
  const { createDraftConfig, readinessIssues } = await import('../src/ui/workshop-state.ts');
  const config = createDraftConfig(source, target, 'C:/in/CesiumMan.glb', 'C:/in/rozeul.json');
  config.anchors.sourceFootPath = '/Armature/hip/foot';
  config.anchors.targetFootBone = 'root';
  config.mappings = [{ sourcePath: '/Armature/hip', target: 'root', mode: 'fk-bone', side: 'center' }];
  config.output.directory = 'C:/out';
  assert.deepEqual(readinessIssues(config, source, target), []);
  config.source.clipId = 'old-id';
  config.mappings[0].target = 'gone';
  assert.deepEqual(readinessIssues(config, source, target), ['重新选择源动作', '映射目标骨不存在：gone']);
});

test('a local correction must point to an active mapped target with finite values', async () => {
  const { createDraftConfig, readinessIssues } = await import('../src/ui/workshop-state.ts');
  const config = createDraftConfig(source, target, 'C:/in/CesiumMan.glb', 'C:/in/rozeul.json');
  config.anchors.sourceFootPath = '/Armature/hip/foot';
  config.anchors.targetFootBone = 'root';
  config.mappings = [{ sourcePath: '/Armature/hip', target: 'root', mode: 'fk-bone', side: 'center' }];
  config.output.directory = 'C:/out';
  config.chainCorrections = [{ target: '' }];
  assert.deepEqual(readinessIssues(config, source, target), ['局部修正需选择已映射目标骨']);
  config.chainCorrections = [{ target: 'root', rotationDegrees: Number.NaN }];
  assert.deepEqual(readinessIssues(config, source, target), ['root 的局部修正必须是有限数字']);
});

test('readiness blocks invalid rates and excessive frame allocation before Generate is enabled', async () => {
  const { createDraftConfig, readinessIssues } = await import('../src/ui/workshop-state.ts');
  const config = createDraftConfig(source, target, 'C:/in/CesiumMan.glb', 'C:/in/rozeul.json');
  config.anchors.sourceFootPath = '/Armature/hip/foot';
  config.anchors.targetFootBone = 'root';
  config.mappings = [{ sourcePath: '/Armature/hip', target: 'root', mode: 'fk-bone', side: 'center' }];
  config.output.directory = 'C:/out';
  config.sampleHz = 0.5;
  assert.match(readinessIssues(config, source, target).join(' '), /1–240 Hz/);
  config.sampleHz = 240;
  config.source.rangeSeconds = [0, 100];
  assert.match(readinessIssues(config, source, target).join(' '), /20,000 帧上限/);
});
