import assert from 'node:assert/strict';
import test from 'node:test';
import { autoMapSpine, sampleRig } from '../src/transfer/spine-auto-map.ts';
import { buildRigProfile } from '../src/analysis/rig-profile.ts';

const atlas = 'dummy.png\nsize: 1,1\nfilter: Linear,Linear\nrepeat: none\n';
function selection(prefix = '') {
  return { directionId: '正面', directionRoot: `${prefix}方向`, bodyAnchor: `${prefix}身体`, sharedBones: [] as string[] };
}
function rig(offset = 0, prefix = '') {
  return { skeleton: { spine: '4.3.26' }, bones: [
    { name: `${prefix}全局根` },
    { name: `${prefix}方向`, parent: `${prefix}全局根`, x: offset, y: offset / 2 },
    { name: `${prefix}身体`, parent: `${prefix}方向`, x: 20, y: 30, length: 15 },
    { name: `${prefix}手臂`, parent: `${prefix}身体`, x: 10, y: 20, length: 20 },
    { name: `${prefix}手`, parent: `${prefix}手臂`, x: 20, length: 10 },
    { name: `${prefix}背面`, parent: `${prefix}全局根`, x: -4000 },
    { name: `${prefix}背面手`, parent: `${prefix}背面`, length: 999 },
  ], slots: [], skins: [{ name: 'default', attachments: {} }], animations: { wave: { bones: {
    [`${prefix}方向`]: { translate: [{ x: 0 }, { time: 1, x: 40 }] },
    [`${prefix}手臂`]: { rotate: [{ value: 0 }, { time: 1, value: 70 }] },
  } } } };
}
test('selected branch sampling removes layout offset and excludes unrelated directions', () => {
  const origin = sampleRig(rig(), atlas, 'wave', 'default', selection());
  const shifted = sampleRig(rig(3000), atlas, 'wave', 'default', selection());
  assert.ok(!origin.bones.some(b => b.name === '背面' || b.name === '背面手'));
  const body = origin.bones.find(b => b.name === '身体')!;
  assert.equal(body.x, 0);
  assert.equal(body.y, 0);
  for (const bone of origin.bones.filter(b => b.name !== '全局根')) {
    const other = shifted.bones.find(b => b.name === bone.name)!;
    assert.ok(Math.abs(bone.x - other.x) < 1e-8, bone.name);
    assert.ok(Math.abs(bone.y - other.y) < 1e-8, bone.name);
  }
});

test('selected reference auto mapping is unchanged by thousands of layout units', () => {
  const options = { source: selection('s_'), target: selection('t_') };
  const centered = autoMapSpine(rig(0, 's_'), rig(0, 't_'), atlas, atlas, 'wave', 'default', 'default', [], options);
  const shifted = autoMapSpine(rig(500, 's_'), rig(3000, 't_'), atlas, atlas, 'wave', 'default', 'default', [], options);
  assert.deepEqual(shifted.mappings.filter(m => !m.source.endsWith('全局根')), centered.mappings.filter(m => !m.source.endsWith('全局根')));
  assert.ok(centered.mappings.some(m => m.source === 's_手臂' && m.target === 't_手臂'));
  assert.ok(!shifted.mappings.some(m => m.source.includes('背面')));
});

test('fixed setup reference retains genuine animated branch displacement', () => {
  const profile = buildRigProfile(rig(3000), atlas, ['wave'], 'default', selection(), 'target');
  const setup = profile.bones.find(b => b.name === '身体')!;
  assert.deepEqual(setup.setup.local, { x: 0, y: 0 });
  assert.ok(Math.abs(setup.setup.world.x - 3020) < 1e-3);
  assert.ok(Math.abs(setup.setup.world.y - 1530) < 1e-3);
  assert.ok(Math.abs(profile.normalizationScale - 30) < 1e-3);
  assert.equal(profile.samples.length, 25);
  assert.ok(Math.abs(profile.samples.at(-1)!.bones.find(b => b.name === '身体')!.local.x - 40) < 1e-3);
  assert.ok(sampleRig(rig(3000), atlas, 'wave', 'default', selection()).bones.find(b => b.name === '身体')!.motion > 1);
});

test('inverse reference handles rotated mirrored scaled parent matrices without mutating Chinese names', () => {
  const document = rig(1000);
  Object.assign(document.bones[1]!, { rotation: 90, scaleX: -2, scaleY: 3 });
  const before = structuredClone(document);
  const profile = buildRigProfile(document, atlas, [], 'default', { ...selection(), normalizationBones: ['身体', '手臂'] }, 'source');
  const arm = profile.bones.find(b => b.name === '手臂')!;
  assert.ok(Math.abs(arm.setup.local.x - 10) < 1e-8);
  assert.ok(Math.abs(arm.setup.local.y - 20) < 1e-8);
  assert.ok(profile.reference.setupWorld.a * profile.reference.setupWorld.d - profile.reference.setupWorld.b * profile.reference.setupWorld.c < 0);
  assert.ok(Math.abs(profile.normalizationScale - 20) < 1e-8);
  assert.equal(arm.raw.name, '手臂');
  assert.equal(arm.raw.x, 10);
  assert.equal(arm.evidenceId, 'source:bone:%E6%89%8B%E8%87%82');
  assert.deepEqual(document, before);
  assert.deepEqual(JSON.parse(JSON.stringify(profile)), profile);
});

test('shared external controllers require explicit selection and a constraint connection to this direction', () => {
  const document = { ...rig(), constraints: [{ type: 'ik', name: '手臂IK', target: '共享控制', bones: ['手臂', '手'], mix: 0.75 }] };
  document.bones.push({ name: '共享控制', parent: '全局根', x: 40, y: 55 });
  const isolated = buildRigProfile(document, atlas, [], 'default', selection(), 'source');
  assert.ok(!isolated.includedBones.includes('共享控制'));
  const shared = buildRigProfile(document, atlas, [], 'default', { ...selection(), sharedBones: ['共享控制'] }, 'source');
  assert.equal(shared.bones.find(b => b.name === '共享控制')!.control.ikTarget, true);
  assert.equal(shared.bones.find(b => b.name === '手臂')!.control.ikDriven, true);
  assert.equal(shared.constraints[0]!.mix, 0.75);
  assert.ok(!shared.includedBones.includes('背面'));
  assert.throws(() => buildRigProfile(document, atlas, [], 'default', { ...selection(), sharedBones: ['背面手'] }, 'source'), /不是当前方向/);
});

test('invalid anchors and singular setup reference fail explicitly instead of producing invalid evidence', () => {
  assert.throws(() => buildRigProfile(rig(), atlas, [], 'default', { ...selection(), bodyAnchor: '背面' }, 'source'), /身体参考点/);
  assert.throws(() => buildRigProfile(rig(), atlas, [], 'default', { ...selection(), normalizationBones: ['背面手'] }, 'source'), /身体尺寸/);
  assert.throws(() => buildRigProfile(rig(), atlas, ['不存在'], 'default', selection(), 'source'), /不存在采样动作/);
  const singular = rig(); Object.assign(singular.bones[2]!, { scaleX: 0 });
  assert.throws(() => buildRigProfile(singular, atlas, [], 'default', selection(), 'source'), /不可逆/);
});
test('ground reference excludes layout ancestors unless they are explicitly shared, matching the preview contract', () => {
  assert.throws(() => buildRigProfile(rig(), atlas, [], 'default', { ...selection(), groundAnchor: '全局根' }, 'source'), /脚底参考点/);
  assert.doesNotThrow(() => buildRigProfile(rig(), atlas, [], 'default', { ...selection(), groundAnchor: '手' }, 'source'));
  assert.doesNotThrow(() => buildRigProfile(rig(), atlas, [], 'default', { ...selection(), groundAnchor: '全局根', sharedBones: ['全局根'] }, 'source'));
});

test('Unicode bone identity is exact and does not fold visually similar or decomposed names', () => {
  const document = rig();
  document.bones.push({ name: 'e\u0301', parent: '身体', x: 2 }, { name: 'é', parent: '身体', x: 4 });
  const profile = buildRigProfile(document, atlas, [], 'default', selection(), 'source');
  assert.ok(profile.includedBones.includes('e\u0301'));
  assert.ok(profile.includedBones.includes('é'));
  assert.notEqual(profile.bones.find(b => b.name === 'é')!.evidenceId, profile.bones.find(b => b.name === 'e\u0301')!.evidenceId);
});

test('selected body evidence recognizes exact Chinese and conventional suffix sides', () => {
  const document = rig(); document.bones.push({ name: '侧正面-UpperArmL', parent: '身体', x: 0, length: 0 }, { name: '侧正面-LowerArmR', parent: '身体', x: 0, length: 0 }, { name: '左腿', parent: '身体', x: 0, length: 0 });
  const profile = buildRigProfile(document, atlas, [], 'default', selection(), 'target');
  assert.equal(profile.bones.find(b => b.name === '侧正面-UpperArmL')!.side, 'left');
  assert.equal(profile.bones.find(b => b.name === '侧正面-LowerArmR')!.side, 'right');
  assert.equal(profile.bones.find(b => b.name === '左腿')!.side, 'left');
});

test('outgoing constraints to excluded decoration do not reclassify this direction FK hand as a controller', () => {
  const document = { ...rig(), constraints: [{ type: 'transform', name: '另一方向装饰', source: '手', bones: ['背面手'] }] };
  const profile = buildRigProfile(document, atlas, [], 'default', selection(), 'source');
  assert.equal(profile.constraints.length, 0);
  assert.equal(profile.bones.find(b => b.name === '手')!.control.transformTarget, false);
});

test('candidate evidence states controller mismatch and excluded directions rather than silently accepting geometry', () => {
  const target = { ...rig(), constraints: [{ type: 'ik', name: '控制', target: '手臂', bones: ['手'] }] };
  const result = autoMapSpine(rig(), target, atlas, atlas, 'wave', 'default', 'default', [], { source: selection(), target: selection() });
  const candidate = result.review.find(r => r.source === '手臂')!.candidates.find(c => c.target === '手臂')!;
  assert.ok(candidate.rejectedReasons?.includes('来源与目标的 IK 控制角色不同'));
  assert.ok(result.referenceDiagnostics.target.excludedBones.includes('背面手'));
  assert.ok(!result.mappings.some(m => m.source === '手臂' && m.target === '手臂'));
});
