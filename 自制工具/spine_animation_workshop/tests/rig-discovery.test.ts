import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverRigReferences } from '../src/analysis/rig-discovery.ts';
import { buildRigProfile } from '../src/analysis/rig-profile.ts';

const atlas = 'dummy.png\nsize: 1,1\nfilter: Linear,Linear\nrepeat: none\n';
function fixture(offset = 3000) {
  const bones: Record<string, unknown>[] = [{ name: 'g' }];
  const slots: Record<string, unknown>[] = [{ name: 'unbound-drawing', bone: 'g' }];
  for (const [branch, x] of [['view-a', offset], ['view-b', -offset]] as const) {
    bones.push({ name: branch, parent: 'g', x, length: 8000 },
      { name: `${branch}-hub`, parent: branch, x: 2, y: 50, length: 20 },
      { name: `${branch}-upper`, parent: `${branch}-hub`, y: 20, length: 20 },
      { name: `${branch}-arm`, parent: `${branch}-upper`, x: -15, length: 15 },
      { name: `${branch}-hand`, parent: `${branch}-arm`, x: -15, length: 7 },
      { name: `${branch}-leg`, parent: `${branch}-hub`, y: -25, length: 25 },
      { name: `${branch}-foot`, parent: `${branch}-leg`, y: -25, length: 8 });
    for (const joint of ['hub', 'upper', 'hand', 'foot']) slots.push({ name: `${branch}-${joint}-art`, bone: `${branch}-${joint}` });
  }
  bones.push({ name: 'shared-goal', parent: 'g', x: offset - 20, y: 70 });
  return { skeleton: { spine: '4.3.26' }, bones, slots,
    skins: [{ name: 'default', attachments: {} }],
    constraints: [{ type: 'ik', name: 'arm-goal', target: 'shared-goal', bones: ['view-a-arm', 'view-a-hand'] }],
    animations: { move: { bones: { 'view-a-hub': { rotate: [{ value: 0 }, { time: 1, value: 20 }] }, 'view-a-arm': { rotate: [{ value: 0 }, { time: 1, value: 60 }] } } } } };
}

test('automatic survey keeps every direction and separates root-bound artwork from branch evidence', () => {
  const input = fixture();
  const before = structuredClone(input);
  const result = discoverRigReferences(input, atlas, ['move'], 'default', 'source');
  assert.equal(result.surveyOnly, true);
  assert.equal(result.surveySelection.directionRoot, 'g');
  assert.equal(result.surveySelection.bodyAnchor, 'g');
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.directionCandidates.map(c => c.bone).sort(), ['view-a', 'view-b']);
  assert.deepEqual(result.rootArtworkSlots, ['unbound-drawing']);
  assert.ok(result.warnings.length > 0);
  const surveyed = buildRigProfile(input, atlas, ['move'], 'default', result.surveySelection, 'source');
  assert.equal(surveyed.includedBones.length, 16);
  assert.ok(result.directionCandidates.every(c => c.status === 'ambiguous'));
  assert.ok(result.directionCandidates.every(c => !/front|back|正面|背面/.test(c.selection.directionId)));
  assert.deepEqual(input, before);
});

test('automatic references use local geometry despite large layout offsets and report actual motion', () => {
  const a = discoverRigReferences(fixture(3000), atlas, ['move'], 'default', 'target');
  const b = discoverRigReferences(fixture(9000), atlas, ['move'], 'default', 'target');
  const first = a.directionCandidates.find(c => c.bone === 'view-a')!;
  const second = b.directionCandidates.find(c => c.bone === 'view-a')!;
  assert.equal(first.selection.bodyAnchor, 'view-a-hub');
  assert.deepEqual(first.normalizationBoneCandidates.map(c => c.bone), second.normalizationBoneCandidates.map(c => c.bone));
  assert.ok(!first.selection.normalizationBones!.includes('view-a'));
  assert.ok(first.metrics.movingBoneCount > 0);
  assert.equal(first.metrics.width, second.metrics.width);
  assert.ok(second.metrics.layoutOffset > first.metrics.layoutOffset);
});

test('shared controls require actual constraint connection and all proposed references validate', () => {
  const input = fixture();
  const result = discoverRigReferences(input, atlas, ['move'], 'default', 'source');
  const first = result.directionCandidates.find(c => c.bone === 'view-a')!;
  const other = result.directionCandidates.find(c => c.bone === 'view-b')!;
  assert.deepEqual(first.sharedControlCandidates.map(c => c.bone), ['shared-goal']);
  assert.deepEqual(other.sharedControlCandidates, []);
  assert.equal(first.selection.groundAnchor, undefined, 'low geometry is a candidate, not proof of physical ground');
  assert.ok(first.groundAnchorCandidates.some(c => c.bone === 'view-a-foot'));
  for (const candidate of result.directionCandidates) {
    assert.doesNotThrow(() => buildRigProfile(input, atlas, [], 'default', candidate.selection, 'source'));
    assert.ok(candidate.bodyAnchorCandidates.every(c => c.evidenceIds.length > 0 && c.reasons.length > 0));
  }
});

test('single substantial branch is proposed without requiring conventional bone names', () => {
  const input = fixture();
  input.bones = input.bones.filter(b => !(String(b.name).startsWith('view-b')));
  input.slots = input.slots.filter(s => !(String(s.bone).startsWith('view-b')));
  const result = discoverRigReferences(input, atlas, ['move'], 'default', 'target');
  assert.equal(result.status, 'proposed');
  assert.equal(result.directionCandidates.length, 1);
  assert.equal(result.directionCandidates[0]!.bone, 'view-a');
  assert.equal(result.directionCandidates[0]!.metrics.boneCount, 7);
  assert.equal(result.directionCandidates[0]!.metrics.slotCount, 4);
});

test('multiple independent roots fail explicitly rather than surveying only the first tree', () => {
  const input = fixture();
  input.bones.push({ name: 'detached-root' });
  assert.throws(() => discoverRigReferences(input, atlas, [], 'default', 'source'), /多个|根骨/);
});


test('large single-view rigs expose nested container alternatives instead of trusting the first wrapper', () => {
  const input = fixture();
  input.bones = input.bones.filter(b => !(String(b.name).startsWith('view-b')));
  input.slots = input.slots.filter(s => !(String(s.bone).startsWith('view-b')));
  for (let i = 0; i < 18; i++) input.bones.push({ name: `ornament-${i}`, parent: 'view-a-hub', x: i - 9, y: 60 });
  const result = discoverRigReferences(input, atlas, ['move'], 'default', 'source');
  assert.equal(result.status, 'ambiguous');
  assert.ok(result.directionCandidates.some(c => c.bone === 'view-a'));
  assert.ok(result.directionCandidates.some(c => c.bone === 'view-a-hub'));
  assert.ok(!result.directionCandidates.some(c => c.bone === 'view-a-arm'));
  assert.equal(result.surveySelection.directionRoot, 'g');
});

test('automatic anchor candidates never propose a singular body reference', () => {
  const input = fixture();
  Object.assign(input.bones.find(b => b.name === 'view-a-hub')!, { scaleX: 0 });
  const result = discoverRigReferences(input, atlas, [], 'default', 'source');
  const candidate = result.directionCandidates.find(c => c.bone === 'view-a')!;
  assert.notEqual(candidate.selection.bodyAnchor, 'view-a-hub');
  assert.doesNotThrow(() => buildRigProfile(input, atlas, [], 'default', candidate.selection, 'source'));
});
