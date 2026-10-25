import assert from 'node:assert/strict';
import test from 'node:test';
import { autoMapSpine, sampleRig } from '../src/transfer/spine-auto-map.ts';
const atlas = 'dummy.png\nsize: 1,1\nfilter: Linear,Linear\nrepeat: none\n';
function rig(prefix: string) {
  return { skeleton: { spine: '4.3.26' }, bones: [{ name: `${prefix}root` },
    { name: `${prefix}arm`, parent: `${prefix}root`, x: 10, y: 10, length: 20 }], slots: [], skins: [{ name: 'default', attachments: {} }],
    animations: { wave: { bones: { [`${prefix}arm`]: { rotate: [{ value: 0 }, { time: 1, value: 70 }] } } } } };
}
test('samples actual runtime bone motion locally without a canvas or image download', () => {
  const sampled = sampleRig(rig('s_'), atlas, 'wave', 'default');
  assert.equal(sampled.frames, 25);
  assert.ok(sampled.bones.find(b => b.name === 's_arm')!.motion > 0.1);
});
test('renamed unique child chain can match through geometry and parent correspondence', () => {
  const result = autoMapSpine(rig('s_'), rig('t_'), atlas, atlas, 'wave', 'default', 'default');
  assert.ok(result.mappings.some(m => m.source === 's_arm' && m.target === 't_arm'));
});
test('symmetric ambiguous candidates stay for review and do not overwrite manual decisions', () => {
  const target = rig('t_'); target.bones.push({ name: 'duplicate', parent: 't_root', x: 10, y: 10, length: 20 });
  const result = autoMapSpine(rig('s_'), target, atlas, atlas, 'wave', 'default', 'default');
  assert.ok(result.review.some(item => item.source === 's_arm'));
  assert.ok(!result.mappings.some(m => m.source === 's_arm'));
  const manual = [{ kind: 'bone' as const, source: 's_arm', target: 'duplicate', side: 'unknown' as const, drive: 'direct' as const }];
  const preserved = autoMapSpine(rig('s_'), target, atlas, atlas, 'wave', 'default', 'default', manual);
  assert.deepEqual(preserved.mappings.find(m => m.source === 's_arm'), manual[0]);
});

test('geometry on a branching rig stays a suggestion even when one location fits exactly', () => {
  const source = rig('s_'), target = rig('t_');
  source.bones.push({ name: 'decoration', parent: 's_root', x: -10, y: 30, length: 5 });
  target.bones.push({ name: 'controller', parent: 't_root', x: -30, y: 10, length: 5 });
  const result = autoMapSpine(source, target, atlas, atlas, 'wave', 'default', 'default');
  assert.ok(!result.mappings.some(m => m.source === 's_arm'));
  assert.equal(result.review.find(r => r.source === 's_arm')?.candidates[0]?.target, 't_arm');
});

test('reanalysis preserves existing mappings without duplicating source or target bones', () => {
  const source = rig('s_'), target = rig('t_');
  const first = autoMapSpine(source, target, atlas, atlas, 'wave', 'default', 'default');
  const again = autoMapSpine(source, target, atlas, atlas, 'wave', 'default', 'default', first.mappings);
  assert.deepEqual(again.mappings, first.mappings);
  assert.equal(again.added, 0);
});

test('explicit opposite sides are never matched through coincident positions', () => {
  const result = autoMapSpine(rig('left_'), rig('right_'), atlas, atlas, 'wave', 'default', 'default');
  assert.ok(!result.mappings.some(m => m.source === 'left_arm'));
  assert.equal(result.review.find(r => r.source === 'left_arm')?.candidates.length, 0);
});
