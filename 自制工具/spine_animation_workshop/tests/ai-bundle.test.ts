import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiBundle } from '../src/analysis/ai-bundle.ts';
import { readSpineSource } from '../src/source/spine-source.ts';

const atlas = 'dummy.png\nsize: 1,1\nfilter: Linear,Linear\nrepeat: none\n';
function input() {
  const document = { skeleton: { spine: '4.3.26' }, bones: [{ name: 'root' }, { name: '侧正面', parent: 'root', x: 900 },
    { name: '髋', parent: '侧正面', y: 40 }, { name: '左上臂', parent: '髋', x: 8, y: 15, length: 12 },
    { name: '左前臂', parent: '左上臂', x: 12, length: 9 }, { name: '背面', parent: 'root', x: -900 }],
    slots: [], skins: [{ name: 'default', attachments: {} }], animations: {
      wave: { bones: { '左上臂': { rotate: [{ value: 0 }, { time: 1, value: 45 }] } } }, secret: { bones: { '背面': { rotate: [{ value: 13 }] } } },
    } };
  return { source: { projectPath: 'E:/source.spine', projectHash: 'a'.repeat(64), skeletonName: '角色', document, atlasText: atlas,
    skin: 'default', selection: { directionId: '侧正面', directionRoot: '侧正面', bodyAnchor: '髋', sharedBones: [] } },
  target: { projectPath: 'E:/target.spine', projectHash: 'b'.repeat(64), skeletonName: '角色', document: structuredClone(document), atlasText: atlas,
    skin: 'default', selection: { directionId: '侧正面', directionRoot: '侧正面', bodyAnchor: '髋', sharedBones: [] } }, animations: ['wave'], toolVersion: '0.3.0' };
}
test('bundle contains actual selected samples and input identities without full projects or unrelated animations', () => {
  const bundle = createAiBundle(input());
  assert.equal(bundle.manifest.source.projectHash, 'a'.repeat(64));
  assert.ok(bundle.sourceRig.bones.some(b => b.name === '左上臂'));
  const motion = JSON.parse(bundle.files['motion-samples.json']!);
  assert.ok(motion.source.length > 1);
  assert.ok(motion.source.every((sample: {animation:string}) => sample.animation === 'wave'));
  assert.ok(!Object.keys(bundle.files).some(name => /\.(png|spine|atlas)$/.test(name)));
  assert.ok(!bundle.files['source-rig.json']!.includes('"animations":'));
  assert.ok(bundle.files['任务书.md']!.includes('E:/source.spine'));
  assert.ok(bundle.files['任务书.md']!.includes(bundle.manifest.bundleId));
  assert.ok(bundle.files['schemas/spw-ai-mapping-v1.schema.json']);
  assert.deepEqual(JSON.parse(bundle.files['manifest.json']!), bundle.manifest);
});
test('same input is deterministic, but changed branch or source bytes invalidate the analysis identity', () => {
  const original = input(), first = createAiBundle(original), repeat = createAiBundle(original);
  assert.deepEqual(first.files, repeat.files);
  const anchorChanged = input(); anchorChanged.target.selection.bodyAnchor = '左上臂';
  assert.notEqual(createAiBundle(anchorChanged).manifest.bundleId, first.manifest.bundleId);
  const bytesChanged = input(); bytesChanged.source.projectHash = 'c'.repeat(64);
  assert.notEqual(createAiBundle(bytesChanged).manifest.bundleId, first.manifest.bundleId);
});
test('rejects absent selected action and non SHA-256 project identity before exporting evidence', () => {
  const action = input(); action.animations = ['absent'];
  assert.throws(() => createAiBundle(action), /动作|animation/i);
  const identity = input(); identity.target.projectHash = 'unknown';
  assert.throws(() => createAiBundle(identity), /SHA-256/i);
});
test('identity preserves the exact formatted export hash rather than hashing a compact reserialization', () => {
  const original=input(), jsonText=JSON.stringify(original.source.document,null,2)+'\n';
  const bundle=createAiBundle({...original,source:{...original.source,jsonText}});
  assert.equal(bundle.manifest.source.fileHash,readSpineSource(jsonText).summary.fileHash);
  assert.notEqual(bundle.manifest.source.fileHash,readSpineSource(JSON.stringify(original.source.document)).summary.fileHash);
});
test('rejects a supplied raw export whose parsed document differs from the sampled document', () => {
  const original=input(), jsonText=JSON.stringify(original.source.document,null,2)+'\n';
  const document=structuredClone(original.source.document);document.bones[1]!.x=333;
  assert.throws(()=>createAiBundle({...original,source:{...original.source,jsonText,document}}),/原文|不一致/);
});
