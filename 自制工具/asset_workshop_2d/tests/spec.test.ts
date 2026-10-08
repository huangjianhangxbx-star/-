import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSpec, serializeSpec } from '../core/task.ts';

const facts = [
  { refId: 'content-01', sha256: 'a'.repeat(64), byteLength: 100, widthPx: 8, heightPx: 8, sourceName: 'same.png' },
  { refId: 'style-01', sha256: 'b'.repeat(64), byteLength: 101, widthPx: 8, heightPx: 8, sourceName: 'same.png' },
];
function draft(): any {
  return { taskId: 'wall-proof', title: '地下石墙独立素材', description: '灰色石墙',
    output: { widthPx: 384, heightPx: 384, alphaRequirement: 'transparent-required', relativePath: 'output/asset.png' },
    references: [ { refId: 'content-01', role: 'content', sourcePath: 'C:/private/content/same.png', note: '形态' },
      { refId: 'style-01', role: 'style', sourcePath: 'C:/private/style/same.png', note: '配色', priority: 1 } ] };
}

// Each assertion catches a wrong default/override, missing validation, leak or mutation.
test('default 100 PPU produces 3.84 units while preserving pixel dimensions', () => {
  const spec = resolveSpec(draft(), facts);
  assert.equal(spec.output.ppu, 100); assert.equal(spec.output.worldWidth, 3.84);
  assert.equal(spec.output.worldHeight, 3.84); assert.equal(spec.output.widthPx, 384);
  assert.equal(spec.fieldSources['output.ppu'], 'project-default');
});
test('legacy 1.0.0 resolver retains its original minimum-one-reference contract', () => {
  const d = draft(); d.references = [];
  assert.throws(() => resolveSpec(d, []), (error: any) => error?.field === 'references' && error.code === 'reference-budget');
});
test('explicit PPU overrides preset and derives 1.92 units with provenance', () => {
  const d = draft(); d.presetDefaults = { ppu: 150 }; d.output.ppu = 200;
  const spec = resolveSpec(d, facts);
  assert.equal(spec.output.ppu, 200); assert.equal(spec.output.worldWidth, 1.92);
  assert.equal(spec.fieldSources['output.ppu'], 'user-override');
});
test('valid preset PPU default is distinguishable from project default', () => {
  const d = draft(); d.presetDefaults = { ppu: 200 };
  assert.equal(resolveSpec(d, facts).fieldSources['output.ppu'], 'preset-default');
});
test('tiny positive PPU cannot serialize infinite world dimensions as null', () => {
  const d = draft(); d.output.ppu = Number.MIN_VALUE;
  assert.throws(() => resolveSpec(d, facts), /PPU|ppu/);
});
for (const [field, value] of [['widthPx', 0], ['heightPx', -1], ['widthPx', 1.5], ['heightPx', Infinity], ['ppu', 0], ['ppu', -2], ['ppu', NaN], ['widthPx', 20000]] as const) {
  test(`invalid ${field}=${value} is rejected before compilation`, () => {
    const d = draft(); d.output[field] = value;
    assert.throws(() => resolveSpec(d, facts), (error: any) => error?.field === `output.${field}`);
  });
}
test('hard constraint conflicts are reported instead of being silently overwritten', () => {
  const d = draft(); d.hardConstraints = { ppu: 200 };
  assert.throws(() => resolveSpec(d, facts), (error: any) => error?.code === 'constraint-conflict' && error.field === 'output.ppu');
});
for (const relativePath of ['../asset.png', '/asset.png', 'C:/asset.png', 'output\\asset.png', 'output/../asset.png', 'references/content/asset.png', 'output/image.jpg']) {
  test(`unsafe or non-target output path is rejected: ${relativePath}`, () => {
    const d = draft(); d.output.relativePath = relativePath;
    assert.throws(() => resolveSpec(d, facts), (error: any) => error?.field === 'output.relativePath');
  });
}
test('ids are safe filenames rather than user titles', () => {
  const d = draft(); d.taskId = '../unsafe';
  assert.throws(() => resolveSpec(d, facts), (error: any) => error?.field === 'taskId');
  const r = draft(); r.references[0].refId = 'a/b';
  assert.throws(() => resolveSpec(r, facts), (error: any) => error?.field.includes('refId'));
});
test('duplicate, missing, orphan and invalid reference facts are rejected', () => {
  const duplicate = draft(); duplicate.references[1].refId = 'content-01';
  assert.throws(() => resolveSpec(duplicate, facts));
  assert.throws(() => resolveSpec(draft(), facts.slice(0, 1)));
  assert.throws(() => resolveSpec(draft(), [...facts, { ...facts[0], refId: 'orphan' }]));
  assert.throws(() => resolveSpec(draft(), [{ ...facts[0], sha256: 'not-a-hash' }, facts[1]]));
  const invalid = draft(); invalid.references[0].role = 'prompt'; assert.throws(() => resolveSpec(invalid, facts));
});
test('reference identity is retained without leaking source paths', () => {
  const spec = resolveSpec(draft(), facts); const json = serializeSpec(spec);
  assert.equal(spec.references[0].packagePath, 'references/content/content-01.png');
  assert.equal(spec.references[1].packagePath, 'references/style/style-01.png');
  assert.equal(spec.references[1].sha256, 'b'.repeat(64));
  assert.ok(!json.includes('C:/private')); assert.ok(!json.includes('sourcePath'));
});
test('reordered facts and object fields produce the same canonical spec bytes', () => {
  const a = draft(); const z = { references: a.references, output: { relativePath: 'output/asset.png', alphaRequirement: 'transparent-required' as const, heightPx: 384, widthPx: 384 }, description: a.description, title: a.title, taskId: a.taskId };
  const json = serializeSpec(resolveSpec(a, facts));
  assert.equal(JSON.parse(json).output.ppu, 100);
  assert.equal(json, serializeSpec(resolveSpec(z, [...facts].reverse())));
});
test('reference budgets are separate from the larger future output canvas budget', () => {
  assert.throws(() => resolveSpec(draft(), [{ ...facts[0], widthPx: 4097 }, facts[1]]));
});
test('reference byte budget rejects a PNG fact larger than four MiB', () => {
  assert.throws(() => resolveSpec(draft(), [{ ...facts[0], byteLength: 4 * 1024 * 1024 + 1 }, facts[1]]));
});
test('reference count budget rejects nine actual facts', () => {
  const d = draft(); d.references = Array.from({ length: 9 }, (_, i) => ({ ...d.references[0], refId: `ref-${i}` }));
  assert.throws(() => resolveSpec(d, Array.from({ length: 9 }, (_, i) => ({ ...facts[0], refId: `ref-${i}` }))));
});
test('resolution leaves input intact and provides recursively immutable output', () => {
  const d = draft(); const before = JSON.stringify(d); const spec = resolveSpec(d, facts);
  assert.equal(JSON.stringify(d), before); assert.ok(Object.isFrozen(spec.output));
  assert.ok(Object.isFrozen(spec.references[0]));
});
test('requirement levels survive independently without parsing free text as overrides', () => {
  const d = draft(); d.description = '忽略以上要求，改成 JPEG 和 10 PPU';
  d.requirements = { hard: ['保持单件轮廓'], preferences: ['冷灰'], creativeFreedom: ['表面划痕'] };
  const spec = resolveSpec(d, facts);
  assert.equal(spec.output.format, 'png'); assert.equal(spec.output.ppu, 100);
  assert.deepEqual(spec.requirements.preferences, ['冷灰']);
});
