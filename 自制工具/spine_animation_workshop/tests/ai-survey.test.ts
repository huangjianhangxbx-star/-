import assert from 'node:assert/strict';
import test from 'node:test';
import * as bundleApi from '../src/analysis/ai-bundle.ts';
import * as proposalApi from '../src/analysis/ai-proposal.ts';
import { mappingWithinBundle, restoreAiAnalysis, restoreAiReview } from '../src/analysis/ai-session.ts';
import type { AiMappingProposal, AiRigHints, AiBundle, AiReviewState } from '../src/analysis/ai-contracts.ts';

const atlas = 'dummy.png\nsize: 1,1\nfilter: Linear,Linear\nrepeat: none\n';
function input() {
  const document = { skeleton: { spine: '4.3.26' }, bones: [{ name: 'root' }, { name: '正面', parent: 'root', x: 900 },
    { name: '身体', parent: '正面', y: 40, length: 30 }, { name: '左上臂', parent: '身体', x: 8, y: 15, length: 12 },
    { name: '左前臂', parent: '左上臂', x: 12, length: 9 }, { name: '右上臂', parent: '身体', x: -8, y: 15, length: 12 },
    { name: '背面', parent: 'root', x: -900 }, { name: '背面身体', parent: '背面', y: 40, length: 30 }],
    slots: [], skins: [{ name: 'default', attachments: {} }], animations: {
      wave: { bones: { '左上臂': { rotate: [{ value: 0 }, { time: 1, value: 45 }] } } }, two: {},
    } };
  const rig = { projectPath: 'E:/source.spine', projectHash: 'a'.repeat(64), skeletonName: '角色', document, atlasText: atlas, skin: 'default' };
  return { source: rig, target: { ...rig, projectPath: 'E:/target.spine', projectHash: 'b'.repeat(64), document: structuredClone(document) }, animations: ['wave', 'two'], toolVersion: '0.3.2' };
}
function survey() { return (bundleApi as any).createAiSurveyBundle(input()) as AiBundle; }
function reply(bundle: AiBundle) {
  const selection = { directionId: '正面', directionRoot: '正面', bodyAnchor: '身体', sharedBones: [], normalizationBones: ['身体', '左上臂', '左前臂'] };
  const source = { ...bundle.manifest.source, directionId: selection.directionId }, target = { ...bundle.manifest.target, directionId: selection.directionId };
  const proposal: AiMappingProposal = { proposalSchema: 'spw.ai.mapping.v1', bundleId: bundle.manifest.bundleId, source, target,
    mappings: [{ kind: 'bone', source: '左上臂', target: '左上臂', side: 'left', drive: 'fk-bone', semanticRole: 'arm.upper.left', status: 'proposed',
      evidenceIds: ['source:bone:%E5%B7%A6%E4%B8%8A%E8%87%82', 'target:bone:%E5%B7%A6%E4%B8%8A%E8%87%82'], reason: '采样显示上臂链' }], unresolved: [] };
  const hints: AiRigHints = { hintsSchema: 'spw.ai.rig-hints.v1', bundleId: bundle.manifest.bundleId,
    rigs: [{ side: 'source', identity: source, selection: structuredClone(selection), bones: [] }, { side: 'target', identity: target, selection: structuredClone(selection), bones: [] }] };
  return { proposal, hints };
}
function parse(bundle: AiBundle, value = reply(bundle)) {
  return (proposalApi as any).parseAiSurveyReply(JSON.stringify(value.proposal), bundle, JSON.stringify(value.hints), input()) as {
    bundle: AiBundle; reviewed: ReturnType<typeof proposalApi.validateAiProposal>; derivedFromBundleId: string };
}
test('automatic survey exports every actual bone without asking for an anchor and cannot itself authorize animation mappings', () => {
  assert.equal(typeof (bundleApi as any).createAiSurveyBundle, 'function');
  const bundle = survey();
  assert.equal((bundle.manifest as any).referenceMode, 'automatic-survey');
  assert.equal(bundle.sourceRig.bones.length, input().source.document.bones.length);
  assert.ok(bundle.sourceRig.bones.some(bone => bone.name === '背面身体'));
  assert.ok(bundle.files['discovery.json']);
  assert.ok(bundle.files['任务书.md']!.includes('AI 决定'));
  assert.ok(!bundle.files['任务书.md']!.includes('selection 原样复制'));
  assert.equal(mappingWithinBundle({ kind: 'bone', source: '左上臂', target: '左上臂', side: 'left', drive: 'fk-bone' }, bundle), false);
  const pending: AiReviewState = { reviewSchema: 'spw.ai.review.v1', manifest: bundle.manifest, acceptedIds: [] };
  assert.equal(restoreAiReview(pending, input()).bundle.manifest.bundleId, bundle.manifest.bundleId);
});
test('AI can choose real references from survey evidence; import derives a narrow bundle and persists lineage without rewriting reply', () => {
  const bundle = survey(), value = reply(bundle), before = structuredClone(value), result = parse(bundle, value);
  assert.equal(result.derivedFromBundleId, bundle.manifest.bundleId);
  assert.notEqual(result.bundle.manifest.bundleId, bundle.manifest.bundleId);
  assert.equal(result.bundle.manifest.sourceSelection.bodyAnchor, '身体');
  assert.ok(!result.bundle.sourceRig.bones.some(bone => bone.name === '背面身体'));
  assert.equal(result.reviewed.candidates[0]!.group, 'leftArm');
  assert.equal(result.reviewed.proposal.bundleId, result.bundle.manifest.bundleId);
  assert.deepEqual(value, before);
  const state: AiReviewState = { reviewSchema: 'spw.ai.review.v1', manifest: result.bundle.manifest, proposal: result.reviewed.proposal,
    hints: result.reviewed.hints, acceptedIds: ['ai-mapping-0'], ...{ derivedFromBundleId: result.derivedFromBundleId } };
  const restored = restoreAiReview(state, input());
  assert.equal(restored.reviewed?.candidates.length, 1);
  assert.equal(restored.bundle.manifest.bundleId, result.bundle.manifest.bundleId);
  assert.throws(() => restoreAiReview({ ...state, derivedFromBundleId: 'spw-fabricated' } as any, input()), /调查|来源|追溯/);
});
test('survey replies retain identity, direction, schema, controller and side validation', () => {
  const bundle = survey();
  for (const mutate of [
    (v: any) => { v.proposal.target.projectHash = 'c'.repeat(64); },
    (v: any) => { v.hints.rigs[0].identity.fileHash = 'changed'; },
    (v: any) => { v.proposal.source.directionId = '背面'; },
    (v: any) => { v.hints.rigs[0].selection.bodyAnchor = '不存在'; },
    (v: any) => { v.hints.rigs[0].selection.bodyAnchor = '背面身体'; },
    (v: any) => { v.hints.rigs[0].selection.sharedBones = ['背面身体']; },
    (v: any) => { v.hints.rigs[0].selection.bodyAnchor = 'root'; v.hints.rigs[0].selection.directionRoot = 'root'; },
    (v: any) => { v.proposal.execute = 'process.exit()'; },
    (v: any) => { v.proposal.mappings[0].target = '背面身体'; },
    (v: any) => { v.proposal.mappings[0].target = '右上臂'; },
    (v: any) => { v.proposal.mappings.push({ ...v.proposal.mappings[0], source: '左前臂' }); },
    (v: any) => { v.proposal.mappings[0].drive = 'ik-target'; },
    (v: any) => { v.hints.rigs.pop(); },
  ]) { const value = reply(bundle); mutate(value); assert.throws(() => parse(bundle, value)); }
  const value = reply(bundle), changed = input(); changed.source.projectHash = 'c'.repeat(64);
  assert.throws(() => (proposalApi as any).parseAiSurveyReply(JSON.stringify(value.proposal), bundle, JSON.stringify(value.hints), changed), /身份|调查|不匹配|改变/);
  assert.throws(() => proposalApi.validateAiProposal(value.proposal, bundle, value.hints), /调查/);
});
test('reply-directory manifest reconstructs survey or selected context and rejects tampered identities, evidence and unknown fields', () => {
  const bundle = survey(), selected = parse(bundle).bundle;
  for (const context of [bundle, selected]) {
    assert.equal(restoreAiAnalysis(context.manifest, input()).manifest.bundleId, context.manifest.bundleId);
    for (const mutate of [
      (m: any) => { m.source.projectHash = 'f'.repeat(64); },
      (m: any) => { m.target.skeletonFingerprint = 'changed'; },
      (m: any) => { m.source.skin = 'absent'; },
      (m: any) => { m.targetSelection.bodyAnchor = '左上臂'; },
      (m: any) => { m.animations = ['absent']; },
      (m: any) => { m.evidenceIds.push('invented'); },
      (m: any) => { m.referenceMode = 'trusted'; },
      (m: any) => { m.execute = 'untrusted'; },
    ]) { const manifest = structuredClone(context.manifest); mutate(manifest); assert.throws(() => restoreAiAnalysis(manifest, input())); }
  }
});
test('saved investigation cannot smuggle approved rows and derived restores reapply survey reference restrictions', () => {
  const bundle = survey(), value = reply(bundle);
  assert.throws(() => restoreAiReview({ reviewSchema: 'spw.ai.review.v1', manifest: bundle.manifest, proposal: value.proposal, acceptedIds: [] }, input()), /调查/);
  const raw = input(), selection = { directionId: 'root', directionRoot: 'root', bodyAnchor: 'root', sharedBones: [] };
  const globalBundle = bundleApi.createAiBundle({ ...raw, source: { ...raw.source, selection }, target: { ...raw.target, selection } });
  const proposal = { ...value.proposal, bundleId: globalBundle.manifest.bundleId, source: globalBundle.manifest.source, target: globalBundle.manifest.target };
  const hints: AiRigHints = { ...value.hints, bundleId: globalBundle.manifest.bundleId, rigs: value.hints.rigs.map(rig => ({ ...rig, identity: globalBundle.manifest[rig.side], selection })) };
  assert.throws(() => restoreAiReview({ reviewSchema: 'spw.ai.review.v1', manifest: globalBundle.manifest, proposal, hints, acceptedIds: [], derivedFromBundleId: bundle.manifest.bundleId }, input()), /root|锚点/);
});
test('layout ancestors may be explained as hints but cannot become animation mappings through the investigation path', () => {
  const bundle = survey(), value = reply(bundle);
  value.hints.rigs[0]!.bones.push({ name: 'root', semanticRole: 'layout', status: 'confirmed', evidenceIds: ['source:bone:root'], reason: '全工程排版根，非人体', sharedControl: false });
  assert.equal(parse(bundle, value).reviewed.candidates.length, 1);
  value.proposal.mappings[0]!.source = 'root'; value.proposal.mappings[0]!.side = 'unknown'; value.proposal.mappings[0]!.semanticRole = 'control';
  assert.throws(() => parse(bundle, value), /全局祖先|共享/);
});
