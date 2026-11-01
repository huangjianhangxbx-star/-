import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiBundle } from '../src/analysis/ai-bundle.ts';
import { validateSpineConfig } from '../src/config/spine-config.ts';

function fixture(): Record<string, any> {
  const document = { skeleton: { spine: '4.3.26' }, bones: [{ name: 'root' }, { name: 'body', parent: 'root', y: 10, length: 20 }],
    slots: [], skins: [{ name: 'default', attachments: {} }], animations: { wave: { bones: { body: { rotate: [{ value: 0 }, { time: 1, value: 10 }] } } } } };
  const rig = { projectPath: 'E:/source.spine', projectHash: 'a'.repeat(64), skeletonName: '角色', document,
    atlasText: 'dummy.png\nsize: 1,1\nfilter: Linear,Linear\nrepeat: none\n', skin: 'default',
    selection: { directionId: 'front', directionRoot: 'body', bodyAnchor: 'body', sharedBones: [] } };
  const bundle = createAiBundle({ source: rig, target: { ...rig, projectPath: 'E:/target.spine' }, animations: ['wave'], toolVersion: '0.3.0' });
  return { schemaVersion: 2, sourceKind: 'spine', source: { jsonFile: 'source.json', atlasFile: 'source.atlas', pageFiles: ['source.png'],
    skeletonFingerprint: bundle.manifest.source.skeletonFingerprint, fileHash: bundle.manifest.source.fileHash },
  target: { jsonFile: 'target.json', atlasFile: 'target.atlas', pageFiles: ['target.png'],
    skeletonFingerprint: bundle.manifest.target.skeletonFingerprint, fileHash: bundle.manifest.target.fileHash },
  sourceDirection: '', targetDirection: '', sourceSkin: 'default', targetSkin: 'default',
  objectMappings: [{ kind: 'bone', source: 'body', target: 'body', side: 'center', drive: 'fk-bone', provenance: { origin: 'reviewed-ai',
    bundleId: bundle.manifest.bundleId, semanticRole: 'torso', evidenceIds: ['source:bone:body', 'target:bone:body'] } }],
  calibration: { rootScaleX: 1, rootScaleY: 1, corrections: [] }, animationJobs: [{ sourceAnimation: 'wave', rangeSeconds: [0, 1], outputName: 'new_wave', corrections: [] }],
  channelPolicies: [], aiReview: { reviewSchema: 'spw.ai.review.v1', manifest: bundle.manifest,
    proposal: { proposalSchema: 'spw.ai.mapping.v1', bundleId: bundle.manifest.bundleId, source: bundle.manifest.source, target: bundle.manifest.target,
      mappings: [{ kind: 'bone', source: 'body', target: 'body', side: 'center', drive: 'fk-bone', semanticRole: 'torso', status: 'proposed',
        evidenceIds: ['source:bone:body', 'target:bone:body'], reason: '身体主链' }], unresolved: [] }, acceptedIds: ['ai-mapping-0'] } };
}
test('accepted AI provenance and review payload survive serializing and reopening the v2 config without storing samples', () => {
  const config = fixture(), restored = validateSpineConfig(JSON.parse(JSON.stringify(config)));
  assert.deepEqual(restored, config);
  assert.equal(restored.objectMappings[0]!.provenance?.origin, 'reviewed-ai');
  assert.equal(restored.aiReview?.acceptedIds[0], 'ai-mapping-0');
  const legacy = fixture(); delete legacy.aiReview; delete legacy.objectMappings[0].provenance;
  assert.doesNotThrow(() => validateSpineConfig(legacy));
});
test('saved review rejects executable extras, mixed identities, stale bundles and invented accepted candidates', () => {
  for (const mutate of [
    (c: any) => { c.aiReview.run = 'process.exit()'; },
    (c: any) => { c.aiReview.manifest.execute = 'script'; },
    (c: any) => { c.aiReview.proposal.bundleId = 'stale'; },
    (c: any) => { c.aiReview.proposal.target.projectHash = 'c'.repeat(64); },
    (c: any) => { c.aiReview.manifest.source.skeletonFingerprint = 'other'; },
    (c: any) => { c.aiReview.acceptedIds = ['ai-mapping-999']; },
    (c: any) => { c.aiReview.acceptedIds.push('ai-mapping-0'); },
    (c: any) => { c.aiReview.proposal.mappings[0].status = 'unresolved'; },
  ]) { const config = JSON.parse(JSON.stringify(fixture())); mutate(config); assert.throws(() => validateSpineConfig(config)); }
});
test('saved provenance validates priority origin and requires evidence for reviewed AI', () => {
  for (const mutate of [
    (c: any) => { c.objectMappings[0].provenance.origin = 'self-approved'; },
    (c: any) => { delete c.objectMappings[0].provenance.bundleId; },
    (c: any) => { c.objectMappings[0].provenance.evidenceIds = []; },
    (c: any) => { c.objectMappings[0].provenance.execute = 'command'; },
  ]) { const config = fixture(); mutate(config); assert.throws(() => validateSpineConfig(config)); }
});
test('withdrawn proposal rows persist alongside accepted rows without discarding the proposal or hints', () => {
  const config=fixture();
  config.aiReview.proposal.mappings.push({...config.aiReview.proposal.mappings[0],source:'root',target:'root',drive:'direct',semanticRole:'root',
    evidenceIds:['source:bone:root','target:bone:root']});
  config.aiReview.withdrawnIds=['ai-mapping-1'];
  const restored=validateSpineConfig(JSON.parse(JSON.stringify(config)));
  assert.deepEqual(restored.aiReview?.acceptedIds,['ai-mapping-0']);
  assert.deepEqual((restored.aiReview as any).withdrawnIds,['ai-mapping-1']);
  assert.equal(restored.aiReview?.proposal?.mappings.length,2);
});
test('withdrawn rows reject fabricated candidate IDs, duplicates, accepted overlap and missing proposals', () => {
  for(const mutate of [
    (c:any)=>{c.aiReview.withdrawnIds=['ai-mapping-999'];},
    (c:any)=>{c.aiReview.withdrawnIds=['ai-mapping-0','ai-mapping-0'];},
    (c:any)=>{c.aiReview.withdrawnIds=['ai-mapping-0'];},
    (c:any)=>{delete c.aiReview.proposal;c.aiReview.acceptedIds=[];c.aiReview.withdrawnIds=['ai-mapping-0'];},
  ]){const config=fixture();mutate(config);assert.throws(()=>validateSpineConfig(config));}
});
