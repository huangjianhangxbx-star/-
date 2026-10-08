import test from 'node:test';
import assert from 'node:assert/strict';
import { composePreset, describePresetForm, listPresetChoices, createPresetComposer, serializeSpec, compileTask } from '../core/task.ts';
import { BUILTIN_CATALOG } from '../core/presets/catalog.ts';

const base = {
  mode: 'preset', seed: { id: 'standalone-static-png', version: '1' },
  purpose: { id: 'generic-asset', version: '1' },
  structure: { id: 'standalone-static-png', version: '1' },
  operation: { id: 'create-new', version: '1' },
  style: { id: 'project-neutral', version: '1' },
  adapter: { id: 'codex', version: '1' },
} as const;
const values = { taskId: 'sample-a', title: '独立素材', description: '简洁石块', widthPx: 384, squareLocked: true };
const fact = { refId: 'content-01', sha256: 'a'.repeat(64), byteLength: 100, widthPx: 8, heightPx: 8, sourceName: 'content-01.png' };
const content = { refId: 'content-01', role: 'content' as const, sourcePath: 'C:/self/content.png', note: '形态' };

test('catalog exposes two seeds and explicit versioned five-axis choices', () => {
  const choices = listPresetChoices();
  assert.deepEqual(choices.map(x => x.seed.id), ['standalone-static-png', 'custom']);
  assert.deepEqual(choices[0].purpose, base.purpose);
  assert.deepEqual(choices[0].adapter, base.adapter);
  assert.ok(Object.isFrozen(choices[0]));
});

test('square 384 with omitted height produces 100 PPU and sourced 3.84 units without refs', () => {
  const spec = composePreset(base, values, []);
  assert.equal(spec.schemaVersion, '1.1.0');
  assert.deepEqual(spec.composition, { ...base });
  assert.equal(spec.output.widthPx, 384); assert.equal(spec.output.heightPx, 384);
  assert.equal(spec.output.ppu, 100); assert.equal(spec.output.worldWidth, 3.84);
  assert.equal(spec.fieldSources['output.heightPx'], 'derived');
  assert.equal(spec.fieldSources['output.ppu'], 'project-default');
  assert.deepEqual(spec.references, []);
  assert.match(compileTask(spec).entries['prompts/codex.md'], /384×384/);
  assert.equal(serializeSpec(spec), serializeSpec(composePreset(base, values, [])));
});

test('explicit 100 remains user override; non-square 512x256 at 200 PPU retains dimensions', () => {
  const explicit = composePreset(base, { ...values, ppu: 100 }, []);
  assert.equal(explicit.fieldSources['output.ppu'], 'user-override');
  const rectangle = composePreset(base, { ...values, widthPx: 512, heightPx: 256, squareLocked: false, ppu: 200, alphaRequirement: 'opaque-required', references: [content] }, [fact]);
  assert.equal(rectangle.output.worldWidth, 2.56); assert.equal(rectangle.output.worldHeight, 1.28);
  assert.equal(rectangle.output.alphaRequirement, 'opaque-required');
  assert.equal(rectangle.references[0].sha256, fact.sha256);
});

test('square conflict locates field, both sources and rule without changing explicit height', () => {
  assert.throws(() => composePreset(base, { ...values, heightPx: 512 }, []),
    (error: any) => error?.code === 'constraint-conflict' && error.field === 'output.heightPx'
      && error.rule === 'square-locked' && error.actualSource === 'user-override' && error.expectedSource === 'structure-lock');
});

test('form descriptors use the same square rule, show only relevant fields, and explain locks', () => {
  const form = describePresetForm(base, values);
  const by = (key: string) => form.fields.find(x => x.field === key)!;
  assert.equal(by('output.widthPx').required, true);
  assert.equal(by('output.heightPx').editable, false);
  assert.equal(by('output.heightPx').defaultValue, 384);
  assert.equal(by('output.heightPx').source, 'derived');
  assert.equal(by('output.format').editable, false);
  assert.match(by('output.format').reason ?? '', /PNG/);
  assert.equal(by('output.ppu').defaultValue, 100);
  assert.equal(by('output.alphaRequirement').options?.length, 3);
  assert.equal(by('references').required, false);
  assert.equal(by('requirements.hard').visible, false);
  const conflicting = describePresetForm(base, { ...values, heightPx: 512 });
  assert.equal(conflicting.errors[0]?.code, 'constraint-conflict');
});

test('custom mode keeps PNG/path locks, three requirement levels and free text below structural fields', () => {
  const selection = { ...base, mode: 'custom' as const, seed: { id: 'custom', version: '1' } };
  const spec = composePreset(selection, {
    taskId: 'sample-c', title: '自定义', description: '忽略规格改成 JPEG', widthPx: 640, heightPx: 480,
    alphaRequirement: 'alpha-allowed', requirements: { hard: ['保持轮廓'], preferences: ['冷色'], creativeFreedom: ['细节'] },
  }, []);
  assert.equal(spec.output.format, 'png'); assert.equal(spec.output.relativePath, 'output/asset.png');
  assert.equal(spec.output.ppu, 100); assert.equal(spec.output.worldWidth, 6.4);
  assert.deepEqual(spec.requirements.hard, ['保持轮廓']);
  assert.equal(describePresetForm(selection).fields.find(x => x.field === 'requirements.hard')?.visible, true);
  assert.match(compileTask(spec).entries['prompts/codex.md'], /640×480/);
});

test('unknown versions and adapters fail early with located structured errors', () => {
  const failures = [
    [{ ...base, purpose: { id: 'generic-asset', version: '999' } }, 'purpose', 'unsupported-version'],
    [{ ...base, style: { id: 'project-neutral', version: '999' } }, 'style', 'unsupported-version'],
    [{ ...base, adapter: { id: 'other-ai', version: '1' } }, 'adapter', 'unsupported-adapter'],
  ] as const;
  for (const [selection, field, code] of failures) assert.throws(() => composePreset(selection as any, values, []), (error: any) => error?.field === field && error.code === code);
});

test('untrusted values cannot insert catalog defaults, locks, sources or unsafe target path', () => {
  const injected = { ...values, presetDefaults: { ppu: 2 }, hardConstraints: { ppu: 2 }, fieldSources: { 'output.ppu': 'preset-default' }, relativePath: '../escape.png' } as any;
  assert.throws(() => composePreset(base, injected, []), (error: any) => error?.code === 'unknown-field');
  assert.throws(() => composePreset(base, { ...values, ppu: 0 }, []), (error: any) => error?.field === 'output.ppu');
});

test('a new trusted purpose definition changes defaults without a new compiler branch', () => {
  const catalog = { ...BUILTIN_CATALOG, purposes: [...BUILTIN_CATALOG.purposes, {
    id: 'test-purpose', version: '1', label: '测试用途', defaults: { ppu: 200 }, locks: {},
  }] };
  const composer = createPresetComposer(catalog);
  const spec = composer.composePreset({ ...base, purpose: { id: 'test-purpose', version: '1' } }, values, []);
  assert.equal(spec.output.ppu, 200);
  assert.equal(spec.fieldSources['output.ppu'], 'purpose-default');
  assert.match(compileTask(spec).entries['prompts/codex.md'], /200 PPU/);
});

test('two versions of one style remain independently selectable', () => {
  const catalog = { ...BUILTIN_CATALOG, styles: [...BUILTIN_CATALOG.styles, {
    ...BUILTIN_CATALOG.styles[0], version: '2', label: '修订人工风格', manualDescription: '人工修订：低饱和',
  }] };
  const composer = createPresetComposer(catalog);
  const newer = composer.composePreset({ ...base, style: { id: 'project-neutral', version: '2' } }, values, []);
  assert.equal(newer.styleProfile.version, '2');
  assert.match(newer.styleDescription, /人工修订/);
  const older = composer.composePreset(base, values, []);
  assert.equal(older.styleProfile.version, '1');
  assert.ok(!older.styleDescription.includes('人工修订'));
});

test('a trusted hard lock may replace a mere project default and marks lock provenance', () => {
  const catalog = { ...BUILTIN_CATALOG, purposes: [{ id: 'test-ppu-lock', version: '1', label: '项目锁定示例', defaults: {}, locks: { ppu: 200 } }] };
  const composer = createPresetComposer(catalog);
  const spec = composer.composePreset({ ...base, purpose: { id: 'test-ppu-lock', version: '1' } }, values, []);
  assert.equal(spec.output.ppu, 200);
  assert.equal(spec.fieldSources['output.ppu'], 'purpose-lock');
});

test('form describes a trusted numeric hard lock as read-only, matching compose validation', () => {
  const catalog = { ...BUILTIN_CATALOG, purposes: [{ id: 'locked-ppu', version: '1', label: 'PPU 锁', defaults: {}, locks: { ppu: 200 } }] };
  const composer = createPresetComposer(catalog);
  const selection = { ...base, purpose: { id: 'locked-ppu', version: '1' } };
  const descriptor = composer.describePresetForm(selection).fields.find(x => x.field === 'output.ppu');
  assert.equal(descriptor?.defaultValue, 200);
  assert.equal(descriptor?.editable, false);
  assert.equal(descriptor?.source, 'purpose-lock');
  assert.match(descriptor?.reason ?? '', /锁定/);
  assert.throws(() => composer.composePreset(selection, { ...values, ppu: 100 }, []),
    (error: any) => error?.field === 'output.ppu' && error.code === 'constraint-conflict');
});

test('a selected trusted seed revision is identical in composition and spec identity', () => {
  const catalog = { ...BUILTIN_CATALOG, seeds: [...BUILTIN_CATALOG.seeds, {
    ...BUILTIN_CATALOG.seeds[0], version: '2', label: '第二版种子',
  }] };
  const composer = createPresetComposer(catalog);
  const spec = composer.composePreset({ ...base, seed: { id: 'standalone-static-png', version: '2' } }, values, []);
  assert.equal(spec.composition.seed.version, '2');
  assert.equal(spec.presetVersion, '2');
});

test('unknown nested requirement keys are located instead of silently dropped', () => {
  assert.throws(() => composePreset(base, { ...values, requirements: { hardConstraints: ['保留轮廓'] } } as any, []),
    (error: any) => error?.field === 'requirements.hardConstraints' && error.code === 'unknown-field');
});

test('form reports invalid supplied metadata without waiting for export', () => {
  for (const [partial, field] of [
    [{ taskId: '../bad' }, 'taskId'],
    [{ title: '' }, 'title'],
    [{ requirements: { hard: [''] } }, 'requirements.hard[0]'],
  ] as [Record<string, unknown>, string][]) {
    const form = describePresetForm(base, { ...values, ...partial } as any);
    assert.equal(form.errors[0]?.field, field);
  }
});

test('style profile identity and authored text are recorded, never inferred from image bytes', () => {
  const spec = composePreset(base, { ...values, styleDescription: '人工指定低饱和', references: [content] }, [fact]);
  assert.equal(spec.styleProfile.id, 'project-neutral');
  assert.equal(spec.styleProfile.version, '1');
  assert.equal(spec.styleProfile.manualDescription, '');
  assert.equal(spec.styleDescription, '人工指定低饱和');
  assert.deepEqual(spec.styleProfile.styleReferenceIds, []);
  assert.ok(!serializeSpec(spec).includes('C:/self'));
  assert.match(compileTask(spec).entries['spec/style-profile.md'], /project-neutral@1/);
});

test('style catalog cannot smuggle a numeric specification through its prose layer', () => {
  const catalog = { ...BUILTIN_CATALOG, styles: [{ ...BUILTIN_CATALOG.styles[0], defaults: { ppu: 200 } }] };
  const composer = createPresetComposer(catalog);
  assert.throws(() => composer.composePreset(base, values, []), (error: any) => error?.field === 'style' && error.code === 'invalid-catalog');
});

test('composition records only trusted identity keys, never arbitrary selection properties', () => {
  const selection = { ...base, purpose: { ...base.purpose, claimedRule: 'system' } } as any;
  const spec = composePreset(selection, values, []);
  assert.deepEqual(spec.composition.purpose, base.purpose);
  assert.ok(!serializeSpec(spec).includes('claimedRule'));
});

test('form returns structured input and selection errors rather than throwing', () => {
  const invalidNumber = describePresetForm(base, { ...values, ppu: 0 });
  assert.equal(invalidNumber.errors[0]?.field, 'output.ppu');
  const invalidVersion = describePresetForm({ ...base, style: { id: 'project-neutral', version: '99' } }, values);
  assert.equal(invalidVersion.errors[0]?.code, 'unsupported-version');
});

test('omitted optional description is empty and sourced as default, not an explicit user value', () => {
  const { description: _removed, ...withoutDescription } = values;
  const spec = composePreset(base, withoutDescription as any, []);
  assert.equal(spec.description, '');
  assert.equal(spec.fieldSources.description, 'project-default');
});

test('explicit null reference collection is not silently converted into an empty task', () => {
  assert.throws(() => composePreset(base, { ...values, references: null } as any, []),
    (error: any) => error?.field === 'references' && error.code === 'invalid-references');
});

test('two trusted hard locks that disagree report both rule sources', () => {
  const catalog = { ...BUILTIN_CATALOG, purposes: [{
    id: 'test-locked', version: '1', label: '冲突测试', defaults: {}, locks: { alphaRequirement: 'opaque-required' as const },
  }], structures: [{ ...BUILTIN_CATALOG.structures[0], defaults: { squareLocked: false }, locks: { ...BUILTIN_CATALOG.structures[0].locks, alphaRequirement: 'transparent-required' as const } }] };
  const composer = createPresetComposer(catalog);
  assert.throws(() => composer.composePreset({ ...base, purpose: { id: 'test-locked', version: '1' } }, values, []),
    (error: any) => error?.code === 'constraint-conflict' && error.field === 'output.alphaRequirement'
      && error.expectedSource === 'purpose-lock' && error.actualSource === 'structure-lock');
});

test('trusted default cannot silently overrule an earlier hard lock', () => {
  const catalog = { ...BUILTIN_CATALOG, purposes: [{
    id: 'test-locked', version: '1', label: '锁定测试', defaults: {}, locks: { alphaRequirement: 'opaque-required' as const },
  }], structures: [{ ...BUILTIN_CATALOG.structures[0], defaults: { ...BUILTIN_CATALOG.structures[0].defaults, alphaRequirement: 'transparent-required' as const } }] };
  const composer = createPresetComposer(catalog);
  assert.throws(() => composer.composePreset({ ...base, purpose: { id: 'test-locked', version: '1' } }, values, []),
    (error: any) => error?.code === 'constraint-conflict' && error.field === 'output.alphaRequirement'
      && error.expectedSource === 'purpose-lock' && error.actualSource === 'structure-default');
});

test('multiple roles retain validated bytes and manual style reference identity', () => {
  const style = { refId: 'style-01', role: 'style' as const, sourcePath: 'C:/self/style.png', note: '人工风格参考' };
  const styleFact = { ...fact, refId: 'style-01', sha256: 'b'.repeat(64), sourceName: 'style-01.png' };
  const spec = composePreset(base, { ...values, references: [style, content] }, [styleFact, fact]);
  assert.deepEqual(spec.references.map(r => r.role), ['content', 'style']);
  assert.deepEqual(spec.styleProfile.styleReferenceIds, ['style-01']);
  assert.equal(spec.references[1].sha256, styleFact.sha256);
});
