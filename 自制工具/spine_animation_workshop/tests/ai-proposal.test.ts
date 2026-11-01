import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiBundle } from '../src/analysis/ai-bundle.ts';
import { parseAiProposal, validateAiProposal, validateRigHints, mergeAcceptedAiMappings } from '../src/analysis/ai-proposal.ts';
import { createAnalysisDiagnostics } from '../src/analysis/analysis-diagnostics.ts';
import type { AiMappingProposal } from '../src/analysis/ai-contracts.ts';

const atlas = 'dummy.png\nsize: 1,1\nfilter: Linear,Linear\nrepeat: none\n';
function context(outgoingTransform = false) {
  const document = { skeleton: { spine: '4.3.26' }, bones: [{ name: 'root' }, { name: '正面', parent: 'root' },
    { name: '髋', parent: '正面' }, { name: '左上臂', parent: '髋', y: 20, length: 12 },
    { name: '左前臂', parent: '左上臂', x: 12, length: 10 }, { name: '右上臂', parent: '髋', y: -20, length: 12 },
    { name: '背面', parent: 'root', x: 1000 }, { name: '背面左手', parent: '背面', y: 10 },
    { name: '手IK', parent: '正面', x: 20, y: 20 }], slots: [], skins: [{ name: 'default', attachments: {} }],
    animations: { wave: { bones: { '左上臂': { rotate: [{ value: 0 }, { time: 1, value: 45 }] } } } } };
  const sourceDocument = outgoingTransform ? { ...document, constraints: [{ type: 'transform', name: '跟随左臂', bones: ['手IK'], source: '左上臂', mixRotate: 1 }] } : document;
  const rig = { projectPath: 'E:/test.spine', projectHash: 'a'.repeat(64), skeletonName: '角色', document: sourceDocument, atlasText: atlas,
    skin: 'default', selection: { directionId: '正面', directionRoot: '正面', bodyAnchor: '髋', sharedBones: [] } };
  return createAiBundle({ source: rig, target: { ...rig, document, projectPath: 'E:/target.spine', projectHash: 'b'.repeat(64) }, animations: ['wave'], toolVersion: '0.3.0' });
}
function proposal(bundle = context()): AiMappingProposal {
  return { proposalSchema: 'spw.ai.mapping.v1', bundleId: bundle.manifest.bundleId, source: bundle.manifest.source,
    target: bundle.manifest.target, mappings: [{ kind: 'bone', source: '左上臂', target: '左上臂', side: 'left', drive: 'fk-bone',
      semanticRole: 'arm.upper.left', status: 'proposed', evidenceIds: ['source:bone:%E5%B7%A6%E4%B8%8A%E8%87%82', 'target:bone:%E5%B7%A6%E4%B8%8A%E8%87%82'],
      reason: '同侧主臂链', reviewNotes: [] }], unresolved: [{ source: '左前臂', reason: '需检查轴向' }] };
}
test('valid proposal stays a reviewed candidate and selected chain merge preserves human decisions', () => {
  const bundle = context(), result = validateAiProposal(proposal(bundle), bundle);
  assert.equal(result.candidates[0]!.group, 'leftArm');
  const accepted = mergeAcceptedAiMappings([], result, [result.candidates[0]!.id]);
  assert.equal(accepted.mappings[0]!.source, '左上臂');
  const existing = [{ kind: 'bone' as const, source: '左上臂', target: '左前臂', side: 'left' as const, drive: 'fk-bone' as const }];
  const preserved = mergeAcceptedAiMappings(existing, result, [result.candidates[0]!.id]);
  assert.deepEqual(preserved.mappings, existing);
  assert.equal(preserved.conflicts.length, 1);
  assert.equal(preserved.acceptedIds.length, 0);
});
test('explicitly accepting reviewed AI can replace only local automatic rows and records provenance and differences', () => {
  const bundle = context(), result = validateAiProposal(proposal(bundle), bundle), id = result.candidates[0]!.id;
  const local = [{ kind: 'bone' as const, source: '左上臂', target: '左前臂', side: 'left' as const, drive: 'fk-bone' as const,
    provenance: { origin: 'local-auto' as const } }];
  const accepted = mergeAcceptedAiMappings(local, result, [id]);
  assert.equal(accepted.mappings[0]!.target, '左上臂');
  assert.equal(accepted.replaced[0]!.existing.target, '左前臂');
  assert.equal((accepted.mappings[0] as typeof local[number]).provenance.origin, 'reviewed-ai');
  assert.deepEqual(accepted.acceptedIds, [id]);
  const reviewed = [{ ...local[0]!, provenance: { origin: 'reviewed-ai' as const } }];
  assert.deepEqual(mergeAcceptedAiMappings(reviewed, result, [id]).mappings, reviewed);
  assert.throws(() => mergeAcceptedAiMappings([], result, ['does-not-exist']), /不存在/);
});
test('proposal must cite the exact paired objects, and unresolved candidates cannot be silently applied', () => {
  const bundle = context(), invalid = proposal(bundle);
  invalid.mappings[0]!.evidenceIds[1] = 'target:bone:%E5%B7%A6%E5%89%8D%E8%87%82';
  assert.throws(() => validateAiProposal(invalid, bundle), /缺少.*证据/);
  const p = proposal(bundle); p.mappings[0]!.status = 'unresolved';
  const reviewed = validateAiProposal(p, bundle), merged = mergeAcceptedAiMappings([], reviewed, [reviewed.candidates[0]!.id]);
  assert.equal(merged.mappings.length, 0);
  assert.equal(merged.conflicts.length, 1);
});
test('physical FK bones that also drive a transform follower remain mappable with an explicit calibration warning', () => {
  const bundle = context(true), p = proposal(bundle);
  assert.equal(bundle.sourceRig.bones.find(bone => bone.name === '左上臂')!.control.transformTarget, true);
  const reviewed = validateAiProposal(p, bundle);
  assert.equal(reviewed.candidates.length, 1);
  assert.ok(reviewed.candidates[0]!.warnings.some(warning => /变换/.test(warning)));
});
test('equivalent Windows path separators preserve identity, while regenerated anchor selection invalidates old proposals', () => {
  const bundle = context(), p = proposal(bundle);
  p.source.projectPath = p.source.projectPath.replace(/\//g, '\\');
  assert.equal(validateAiProposal(p, bundle).candidates.length, 1);
  const changed = context(); changed.targetRig.selection.bodyAnchor = '左上臂';
  assert.throws(() => validateRigHints({ hintsSchema: 'spw.ai.rig-hints.v1', bundleId: bundle.manifest.bundleId,
    rigs: [{ side: 'target', identity: bundle.manifest.target, selection: bundle.targetRig.selection, bones: [] }] }, changed), /锚|selection/);
});
test('rejects stale hashes, changed direction and anchors, executable fields, fabricated names and evidence', () => {
  const bundle = context();
  for (const mutate of [
    (p: any) => { p.bundleId = 'stale'; }, (p: any) => { p.target.projectHash = 'f'.repeat(64); },
    (p: any) => { p.target.directionId = '背面'; }, (p: any) => { p.execute = 'process.exit()'; },
    (p: any) => { p.mappings[0].target = '不存在'; }, (p: any) => { p.mappings[0].evidenceIds[0] = 'fake'; },
    (p: any) => { p.mappings[0].source = '背面左手'; }, (p: any) => { p.mappings[0].drive = 'ik-target'; },
    (p: any) => { p.mappings[0].channels = []; },
  ]) { const p = structuredClone(proposal(bundle)); mutate(p); assert.throws(() => validateAiProposal(p, bundle)); }
  assert.throws(() => parseAiProposal('```json\n{}\n```', bundle), /JSON/);
});
test('rejects inherited prototype names as extra fields rather than treating them as schema properties', () => {
  const bundle = context();
  for (const key of ['__proto__', 'constructor', 'toString']) {
    const text = JSON.stringify(proposal(bundle)).replace('"proposalSchema":', `${JSON.stringify(key)}:{"execute":"untrusted"},"proposalSchema":`);
    assert.throws(() => parseAiProposal(text, bundle), /额外字段/);
  }
});
test('rejects duplicate targets, wrong kind, cross-side semantic mapping and ancestor reversal', () => {
  const bundle = context();
  const duplicate = proposal(bundle); duplicate.mappings.push({ ...duplicate.mappings[0]!, source: '左前臂' });
  assert.throws(() => validateAiProposal(duplicate, bundle), /重复|占用/);
  const opposite = proposal(bundle); opposite.mappings[0]!.target = '右上臂';
  assert.throws(() => validateAiProposal(opposite, bundle), /左右|侧别/);
  const centered = proposal(bundle); centered.mappings[0]!.side = 'center';
  assert.throws(() => validateAiProposal(centered, bundle), /侧别/);
  const wrongkind = proposal(bundle); wrongkind.mappings[0]!.kind = 'slot';
  assert.throws(() => validateAiProposal(wrongkind, bundle), /对象|slot|不存在/);
  const reversed = proposal(bundle);
  reversed.mappings[0]!.target = '左前臂'; reversed.mappings[0]!.evidenceIds[1] = 'target:bone:%E5%B7%A6%E5%89%8D%E8%87%82';
  reversed.mappings.push({ ...reversed.mappings[0]!, source: '左前臂', target: '左上臂', semanticRole: 'arm.lower.left',
    evidenceIds: ['source:bone:%E5%B7%A6%E5%89%8D%E8%87%82', 'target:bone:%E5%B7%A6%E4%B8%8A%E8%87%82'] });
  assert.throws(() => validateAiProposal(reversed, bundle), /父链|逆/);
});
test('rig hints pin exact selection and cannot authorize a different direction themselves', () => {
  const bundle = context();
  const hints: any = { hintsSchema: 'spw.ai.rig-hints.v1', bundleId: bundle.manifest.bundleId, rigs: [{ side: 'target',
    identity: bundle.manifest.target, selection: bundle.targetRig.selection, bones: [{ name: '左上臂', semanticRole: 'arm.upper.left', status: 'proposed',
      evidenceIds: ['target:bone:%E5%B7%A6%E4%B8%8A%E8%87%82'], reason: '主臂链', sharedControl: false }] }] };
  assert.equal(validateRigHints(hints, bundle).rigs.length, 1);
  const stale = structuredClone(hints); stale.rigs[0].selection.bodyAnchor = '左上臂';
  assert.throws(() => validateRigHints(stale, bundle), /锚|selection|标定/);
  const crossed = structuredClone(hints); crossed.rigs[0].bones[0].name = '背面左手'; crossed.rigs[0].bones[0].sharedControl = true;
  assert.throws(() => validateRigHints(crossed, bundle), /方向|共享/);
});
test('diagnostics distinguish zero copied channels from deliverable output and produce actionable repair requests', () => {
  const bundle = context(), reviewed = validateAiProposal(proposal(bundle), bundle);
  const report = { sourceAnimation: 'wave', channels: [{ category: 'bones', kind: 'bone' as const, source: '左上臂', channel: 'rotate', keyCount: 2,
    status: 'unmapped' as const, reason: 'No typed object mapping' }], blocked: true, totals: { direct: 0, corrected: 0, needsCalibration: 0, explicitSkip: 0, unmapped: 1, unsupported: 0, conflict: 0 }, warnings: [] };
  const output = createAnalysisDiagnostics({ bundle, report, reviewed, acceptedIds: [] });
  assert.equal(output.diagnostics.actualCopiedChannels, 0);
  assert.equal(output.diagnostics.deliveryReady, false);
  assert.ok(output.files['repair-request.md']!.includes('左上臂'));
  assert.equal(JSON.parse(output.files['diagnostics.json']!).actualCopiedChannels, 0);
});
