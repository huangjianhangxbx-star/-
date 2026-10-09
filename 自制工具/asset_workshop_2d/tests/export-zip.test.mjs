import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { zipSync, unzipSync } from 'fflate';
import pngjs from 'pngjs';

const require = createRequire(import.meta.url);
let archive = {};
try { archive = require('../archive/export-zip.cjs'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const input = [
  { refId: 'content-1', role: 'content', sourcePath: path.join(fixtureRoot, 'content-01.png'), note: 'Self-made stone lines.' },
  { refId: 'style-1', role: 'style', sourcePath: path.join(fixtureRoot, 'style-01.png'), note: 'Self-made palette.' },
];
async function scratch(t) {
  await fs.mkdir(path.join(fixtureRoot, '.tmp'), { recursive: true });
  const directory = await fs.mkdtemp(path.join(fixtureRoot, '.tmp', 'case-'));
  t.after(async () => { assert.ok(directory.startsWith(path.join(fixtureRoot, '.tmp') + path.sep)); await fs.rm(directory, { recursive: true, force: true }); });
  return directory;
}
async function task({ schemaVersion = '1.0.0', references = input } = {}) {
  const read = await archive.readReferenceFacts(references);
  const spec = {
    schemaVersion, taskId: 'fixture-task', title: 'Stone test', description: 'Self-made fixture', styleDescription: 'Muted stone',
    presetId: 'stone', presetVersion: '1', adapterId: 'codex', adapterVersion: '1',
    output: { format: 'png', widthPx: 384, heightPx: 384, ppu: 100, worldWidth: 3.84, worldHeight: 3.84, alphaRequirement: 'transparent', relativePath: 'output/asset.png', ...(schemaVersion === '1.1.0' ? { squareLocked: false } : {}) },
    requirements: { hard: [], preferences: [], creativeFreedom: [] }, fieldSources: {},
    references: references.map((entry, i) => ({ refId: entry.refId, role: entry.role, note: entry.note, ...read.facts[i], packagePath: `references/${entry.role}/${entry.refId}.png` })),
  };
  if (schemaVersion === '1.1.0') {
    spec.composition = { mode: 'preset', seed: { id: 'stone', version: '1' }, purpose: { id: 'generic-asset', version: '1' },
      structure: { id: 'standalone-static-png', version: '1' }, operation: { id: 'create-new', version: '1' },
      style: { id: 'project-neutral', version: '1' }, adapter: { id: 'codex', version: '1' } };
    spec.styleProfile = { id: 'project-neutral', version: '1', manualDescription: '', constraints: [],
      styleReferenceIds: references.filter(reference => reference.role === 'style').map(reference => reference.refId) };
  }
  return { spec, binaries: read.binaries, entries: { 'README_开始阅读.md': 'Start here', 'spec/asset-spec.json': JSON.stringify(spec), 'spec/style-profile.md': 'Style', 'plan/production-steps.md': 'Steps', 'prompts/codex.md': 'Prompt', 'validation/checklist.md': 'Checklist' } };
}
async function packed(t) { const directory = await scratch(t); const data = await task(); const result = await archive.exportZip({ ...data, outputDirectory: directory, fileName: 'task.zip' }); return { ...data, result, bytes: await fs.readFile(result.path), directory }; }
function repack(files) { return Buffer.from(zipSync(files, { level: 0 })); }
function repackChangedSpec(bytes, mutate) {
  const files = unzipSync(bytes);
  const spec = JSON.parse(Buffer.from(files['spec/asset-spec.json']).toString('utf8'));
  mutate(spec);
  files['spec/asset-spec.json'] = Buffer.from(JSON.stringify(spec));
  const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString('utf8'));
  const record = manifest.entries.find(entry => entry.path === 'spec/asset-spec.json');
  record.byteLength = files['spec/asset-spec.json'].length;
  record.sha256 = digest(files['spec/asset-spec.json']);
  files['manifest.json'] = Buffer.from(JSON.stringify(manifest));
  return repack(files);
}

const workflowIds = [
  'verify-inputs', 'analyze-content-refs', 'analyze-style-refs', 'synthesize-brief',
  'decision-gates', 'make-production-plan', 'produce-asset', 'verify-asset', 'handoff',
];
function workflowData(spec) {
  const contentIds = spec.references.filter(ref => ref.role === 'content').map(ref => ref.refId);
  const styleIds = spec.references.filter(ref => ref.role === 'style').map(ref => ref.refId);
  const active = new Set(workflowIds.filter(id =>
    id === 'analyze-content-refs' ? contentIds.length > 0 : id === 'analyze-style-refs' ? styleIds.length > 0 : true));
  return {
    schemaVersion: '2dw-workflow/1', taskId: spec.taskId, specPath: 'spec/asset-spec.json',
    steps: workflowIds.map((id, index) => {
      const role = id === 'analyze-content-refs' ? 'content' : id === 'analyze-style-refs' ? 'style' : null;
      const refIds = role === 'content' ? contentIds : role === 'style' ? styleIds : [];
      const dependsOn = index === 0 ? [] : id === 'handoff' ? ['verify-inputs'] : id === 'synthesize-brief'
        ? ['verify-inputs', ...workflowIds.slice(1, 3).filter(candidate => active.has(candidate))]
        : id.startsWith('analyze-') ? ['verify-inputs']
          : [workflowIds.slice(0, index).reverse().find(candidate => active.has(candidate))];
      return { id, version: '1', title: id, phase: id, dependsOn,
        activation: role === null ? { kind: 'always', refIds: [] } : { kind: 'reference-role', role, refIds },
        active: active.has(id), reason: role === null ? 'Required production stage' : `Selected ${refIds.length} ${role} references`,
        outputs: [id === 'produce-asset' ? spec.output.relativePath : `reports/${id}.md`], trustedSource: 'builtin' };
    }),
  };
}
async function workflowTask(references = input) {
  const data = await task({ schemaVersion: '1.1.0', references });
  const recipe = workflowData(data.spec);
  data.entries['workflow/recipe.json'] = JSON.stringify(recipe);
  data.entries['workflow/analysis-plan.md'] = '# 待外部执行的参考图分析\n';
  data.entries['workflow/production-plan.md'] = '# 待分析后细化的制作计划\n';
  data.entries['workflow/decision-policy.md'] = '# 待外部执行的冲突闸门\n';
  return { ...data, recipe };
}
function repackChangedWorkflow(bytes, mutate) {
  const files = unzipSync(bytes);
  const recipe = JSON.parse(Buffer.from(files['workflow/recipe.json']).toString('utf8'));
  mutate(recipe, files);
  if (Object.hasOwn(files, 'workflow/recipe.json')) files['workflow/recipe.json'] = Buffer.from(JSON.stringify(recipe));
  const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString('utf8'));
  manifest.entries = Object.entries(files).filter(([name]) => name !== 'manifest.json')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, bytes]) => ({ path: name, byteLength: bytes.length, sha256: digest(bytes) }));
  files['manifest.json'] = Buffer.from(JSON.stringify(manifest));
  return repack(files);
}

test('workflow ZIP uses an explicit v2 manifest, keeps the 1.1 spec authoritative and has no fake results', async t => {
  const directory = await scratch(t);
  const data = await workflowTask();
  const result = await archive.exportZip({ ...data, outputDirectory: directory, fileName: 'workflow.zip' });
  const bytes = await fs.readFile(result.path);
  const checked = archive.validateZip(bytes);
  const files = unzipSync(bytes);
  assert.equal(checked.manifest.schemaVersion, '2dw-zip/2');
  assert.equal(checked.manifest.workflowRecipeVersion, '2dw-workflow/1');
  assert.equal(checked.spec.schemaVersion, '1.1.0');
  assert.deepEqual(JSON.parse(Buffer.from(files['workflow/recipe.json']).toString('utf8')), data.recipe);
  for (const name of ['workflow/recipe.json', 'workflow/analysis-plan.md', 'workflow/production-plan.md', 'workflow/decision-policy.md']) {
    assert.ok(Object.hasOwn(files, name));
    const record = checked.manifest.entries.find(entry => entry.path === name);
    assert.equal(record.byteLength, files[name].length);
    assert.equal(record.sha256, digest(files[name]));
  }
  assert.deepEqual(Buffer.from(files['references/content/content-1.png']), data.binaries['content-1']);
  assert.deepEqual(Buffer.from(files['references/style/style-1.png']), data.binaries['style-1']);
  assert.ok(!Object.keys(files).some(name => name.startsWith('output/') || name.endsWith('analysis-report.md') || name.endsWith('production-brief.md')));
});

test('real workflow compiler exports valid v2 ZIPs for zero, content, style and combined references', async t => {
  const { compileWorkflowTask } = await import('../core/workflow.ts');
  const directory = await scratch(t);
  const variants = [[], [input[0]], [input[1]], input];
  for (const [index, references] of variants.entries()) {
    const data = await task({ schemaVersion: '1.1.0', references });
    const { entries, recipe } = compileWorkflowTask(data.spec);
    const output = await archive.exportZip({ spec: data.spec, entries, binaries: data.binaries,
      outputDirectory: directory, fileName: `workflow-${index}.zip` });
    const checked = archive.validateZip(await fs.readFile(output.path));
    assert.equal(checked.manifest.schemaVersion, '2dw-zip/2');
    assert.equal(recipe.steps[1].active, references.some(ref => ref.role === 'content'));
    assert.equal(recipe.steps[2].active, references.some(ref => ref.role === 'style'));
    assert.equal(checked.manifest.entries.length, Object.keys(entries).length + references.length);
  }
});

test('workflow recipe cannot lie about identity, activated roles, order, dependencies or trusted stages', async t => {
  const directory = await scratch(t);
  const data = await workflowTask();
  const result = await archive.exportZip({ ...data, outputDirectory: directory, fileName: 'workflow.zip' });
  const bytes = await fs.readFile(result.path);
  for (const mutate of [
    recipe => { recipe.taskId = 'other-task'; },
    recipe => { recipe.specPath = 'spec/other.json'; },
    recipe => { recipe.schemaVersion = '2dw-workflow/2'; },
    recipe => { recipe.steps[1].activation.role = 'style'; },
    recipe => { recipe.steps[1].activation.refIds = ['style-1']; },
    recipe => { recipe.steps[1].active = false; },
    recipe => { recipe.steps[1].title = ''; },
    recipe => { recipe.steps[0].outputs = ['../outside.md']; },
    recipe => { recipe.steps[6].outputs = ['output/wrong.png']; },
    recipe => { recipe.steps[3].dependsOn = ['handoff']; },
    recipe => { recipe.steps[3].dependsOn = ['analyze-content-refs', 'analyze-content-refs']; },
    recipe => { recipe.steps[7].active = false; },
    recipe => { recipe.steps[8].trustedSource = 'reference-note'; },
    recipe => { recipe.steps.splice(7, 1); },
    recipe => { [recipe.steps[1], recipe.steps[2]] = [recipe.steps[2], recipe.steps[1]]; },
    recipe => { recipe.output = { ppu: 7 }; },
  ]) assert.throws(() => archive.validateZip(repackChangedWorkflow(bytes, mutate)));
});

test('workflow v2 refuses missing required text, fake analysis, unlisted output and mismatched manifest version', async t => {
  const directory = await scratch(t);
  const data = await workflowTask([]);
  const result = await archive.exportZip({ ...data, outputDirectory: directory, fileName: 'workflow-zero.zip' });
  const bytes = await fs.readFile(result.path);
  const checked = archive.validateZip(bytes);
  assert.equal(checked.manifest.schemaVersion, '2dw-zip/2');
  assert.equal(data.recipe.steps[1].active, false);
  assert.equal(data.recipe.steps[2].active, false);
  for (const name of ['workflow/recipe.json', 'workflow/analysis-plan.md', 'workflow/production-plan.md', 'workflow/decision-policy.md']) {
    assert.throws(() => archive.validateZip(repackChangedWorkflow(bytes, (_recipe, files) => { delete files[name]; })));
  }
  for (const name of ['workflow/analysis-report.md', 'workflow/production-brief.md', 'reports/content-reference-analysis.md', 'style-analysis.md', 'output/asset.png']) {
    assert.throws(() => archive.validateZip(repackChangedWorkflow(bytes, (_recipe, files) => { files[name] = Buffer.from('invented'); })));
  }
  const files = unzipSync(bytes);
  const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString('utf8'));
  manifest.workflowRecipeVersion = '2dw-workflow/2';
  files['manifest.json'] = Buffer.from(JSON.stringify(manifest));
  assert.throws(() => archive.validateZip(repack(files)));
});

test('reference reader and ZIP exporter are available', () => {
  for (const name of ['readReferenceFacts', 'exportZip', 'validateZip']) assert.equal(typeof archive[name], 'function');
});
test('zero-reference 1.1.0 task exports a complete ZIP with no invented reference or output file', async t => {
  const directory = await scratch(t);
  const data = await task({ schemaVersion: '1.1.0', references: [] });
  assert.deepEqual(data.binaries, Object.create(null));
  const exported = await archive.exportZip({ ...data, outputDirectory: directory, fileName: 'no-references.zip' });
  const bytes = await fs.readFile(exported.path);
  const { spec, manifest } = archive.validateZip(bytes);
  const files = unzipSync(bytes);
  assert.equal(spec.schemaVersion, '1.1.0');
  assert.deepEqual(spec.references, []);
  assert.deepEqual(manifest.references, []);
  assert.equal(manifest.assetSchemaVersion, '1.1.0');
  assert.equal(Object.keys(files).length, 7);
  assert.equal(manifest.entries.length, 6);
  assert.ok(!Object.keys(files).some(name => name.startsWith('references/') || name.startsWith('output/')));
  assert.equal(exported.sha256, digest(bytes));
});
test('legacy 1.0.0 packages remain valid and reject empty reference lists', async t => {
  const published = await fs.readFile(new URL('../samples/2dw-proof-codex.zip', import.meta.url));
  assert.equal(digest(published), '1f90a6b529c54cf3bda2fe9f1f90221fb19025b99ad113ca846aa325e663e504');
  assert.equal(archive.validateZip(published).spec.schemaVersion, '1.0.0');
  const directory = await scratch(t);
  const data = await task({ references: [] });
  await assert.rejects(archive.exportZip({ ...data, outputDirectory: directory, fileName: 'legacy-empty.zip' }));
  assert.deepEqual(await fs.readdir(directory), []);
});
test('new reference-count boundary accepts eight validated images and refuses nine', async t => {
  const references = Array.from({ length: 8 }, (_, i) => ({ ...input[0], refId: `content-${i}` }));
  const directory = await scratch(t);
  const data = await task({ schemaVersion: '1.1.0', references });
  const exported = await archive.exportZip({ ...data, outputDirectory: directory, fileName: 'eight.zip' });
  assert.equal(archive.validateZip(await fs.readFile(exported.path)).spec.references.length, 8);
  await assert.rejects(archive.readReferenceFacts([...references, { ...input[0], refId: 'ninth' }]));
});
test('1.1.0 ZIP rejects a re-manifested false square lock or conflicting dimensions', async t => {
  const directory = await scratch(t);
  const data = await task({ schemaVersion: '1.1.0', references: [] });
  const exported = await archive.exportZip({ ...data, outputDirectory: directory, fileName: 'square.zip' });
  const bytes = await fs.readFile(exported.path);
  for (const mutate of [
    spec => { spec.output.squareLocked = 'true'; },
    spec => { spec.output.squareLocked = true; spec.output.heightPx = 512; },
    spec => { delete spec.output.squareLocked; },
  ]) assert.throws(() => archive.validateZip(repackChangedSpec(bytes, mutate)), /square/i);
});
test('1.1.0 ZIP rejects re-manifested malformed or contradictory composition identities', async t => {
  const directory = await scratch(t);
  const data = await task({ schemaVersion: '1.1.0', references: [] });
  const exported = await archive.exportZip({ ...data, outputDirectory: directory, fileName: 'identity.zip' });
  const bytes = await fs.readFile(exported.path);
  for (const mutate of [
    spec => { delete spec.composition; },
    spec => { spec.composition.mode = 'unsupported'; },
    spec => { spec.composition.mode = 'custom'; },
    spec => { spec.composition.purpose = []; },
    spec => { spec.composition.operation.version = ''; },
    spec => { spec.composition.seed.id = 'different'; },
    spec => { spec.composition.seed.version = '2'; },
    spec => { spec.composition.adapter.id = 'other'; },
    spec => { spec.composition.adapter.version = '2'; },
    spec => { delete spec.styleProfile; },
    spec => { spec.styleProfile.constraints = [{ level: 'unknown', text: 'No glow' }]; },
    spec => { spec.styleProfile.version = '2'; },
  ]) assert.throws(() => archive.validateZip(repackChangedSpec(bytes, mutate)));
});
test('1.1.0 ZIP rejects style-profile references not listed as style PNGs', async t => {
  const directory = await scratch(t);
  const data = await task({ schemaVersion: '1.1.0', references: [input[0]] });
  const exported = await archive.exportZip({ ...data, outputDirectory: directory, fileName: 'style-reference.zip' });
  const bytes = await fs.readFile(exported.path);
  assert.throws(() => archive.validateZip(repackChangedSpec(bytes, spec => { spec.styleProfile.styleReferenceIds = ['content-1']; })));
});
test('PNG facts come from full decoding and preserve original bytes', async () => {
  const original = await Promise.all(input.map(entry => fs.readFile(entry.sourcePath)));
  const result = await archive.readReferenceFacts(input);
  assert.equal(result.facts.length, 2);
  assert.deepEqual(result.facts.map(f => [f.widthPx, f.heightPx]), [[32, 24], [32, 24]]);
  for (let i = 0; i < 2; i++) {
    const bytes = await fs.readFile(input[i].sourcePath);
    assert.deepEqual(bytes, original[i]);
    assert.deepEqual(result.binaries[input[i].refId], bytes);
    assert.equal(result.facts[i].sha256, digest(bytes));
    assert.equal(result.facts[i].byteLength, bytes.length);
  }
});
test('missing, truncated and CRC-damaged PNG inputs are rejected', async t => {
  const directory = await scratch(t);
  await assert.rejects(archive.readReferenceFacts([{ ...input[0], sourcePath: path.join(directory, 'missing.png') }]));
  const bytes = await fs.readFile(input[0].sourcePath);
  await fs.writeFile(path.join(directory, 'short.png'), bytes.subarray(0, 40));
  const damaged = Buffer.from(bytes); damaged[damaged.length - 1] ^= 1;
  await fs.writeFile(path.join(directory, 'broken.png'), damaged);
  for (const file of ['short.png', 'broken.png']) await assert.rejects(archive.readReferenceFacts([{ ...input[0], sourcePath: path.join(directory, file) }]));
});
test('duplicate identities, traversal identities and PNG budgets are rejected', async t => {
  await assert.rejects(archive.readReferenceFacts([input[0], input[0]]));
  await assert.rejects(archive.readReferenceFacts([{ ...input[0], refId: '../escape' }]));
  await assert.rejects(archive.readReferenceFacts(Array.from({ length: 9 }, (_, i) => ({ ...input[0], refId: `image-${i}` }))));
  const directory = await scratch(t);
  const long = new pngjs.PNG({ width: 4097, height: 1 });
  await fs.writeFile(path.join(directory, 'long.png'), pngjs.PNG.sync.write(long));
  await assert.rejects(archive.readReferenceFacts([{ ...input[0], sourcePath: path.join(directory, 'long.png') }]));
  await fs.writeFile(path.join(directory, 'large.png'), Buffer.alloc(4 * 1024 * 1024 + 1));
  await assert.rejects(archive.readReferenceFacts([{ ...input[0], sourcePath: path.join(directory, 'large.png') }]));
});
test('source and output parent junctions are refused', async t => {
  const directory = await scratch(t);
  await fs.mkdir(path.join(directory, 'real'));
  await fs.copyFile(input[0].sourcePath, path.join(directory, 'real', 'reference.png'));
  await fs.symlink(path.join(directory, 'real'), path.join(directory, 'link'), 'junction');
  await assert.rejects(archive.readReferenceFacts([{ ...input[0], sourcePath: path.join(directory, 'link', 'reference.png') }]));
  const data = await task();
  await assert.rejects(archive.exportZip({ ...data, outputDirectory: path.join(directory, 'link'), fileName: 'bad.zip' }));
  assert.deepEqual(await fs.readdir(path.join(directory, 'real')), ['reference.png']);
});
test('dot segments in filesystem inputs cannot bypass the parent link checks', async t => {
  const directory = await scratch(t); await fs.mkdir(path.join(directory, 'child')); await fs.copyFile(input[0].sourcePath, path.join(directory, 'reference.png'));
  const unsafe = directory + path.sep + 'child' + path.sep + '..' + path.sep + 'reference.png';
  await assert.rejects(archive.readReferenceFacts([{ ...input[0], sourcePath: unsafe }]));
  const data = await task();
  await assert.rejects(archive.exportZip({ ...data, outputDirectory: directory + path.sep + 'child' + path.sep + '..', fileName: 'bad.zip' }));
});
test('real ZIP reopens, extracts safely and accounts for every file without inventing the target', async t => {
  const { result, bytes, directory, binaries } = await packed(t);
  assert.equal(result.sha256, digest(bytes));
  const verified = archive.validateZip(bytes);
  const files = unzipSync(bytes);
  assert.equal(Object.keys(files).length, 9);
  assert.ok(!Object.hasOwn(files, 'output/asset.png'));
  assert.deepEqual(Buffer.from(files['references/content/content-1.png']), binaries['content-1']);
  assert.deepEqual(Buffer.from(files['references/style/style-1.png']), binaries['style-1']);
  const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString('utf8'));
  assert.equal(manifest.entries.length, 8);
  for (const entry of manifest.entries) { assert.equal(entry.byteLength, files[entry.path].length); assert.equal(entry.sha256, digest(files[entry.path])); }
  assert.equal(verified.entries.length, 9);
  const extraction = path.join(directory, 'extracted');
  for (const [name, body] of Object.entries(files)) { const destination = path.join(extraction, ...name.split('/')); assert.ok(destination.startsWith(extraction + path.sep)); await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, body, { flag: 'wx' }); }
  assert.equal(pngjs.PNG.sync.read(await fs.readFile(path.join(extraction, 'references/content/content-1.png'))).width, 32);
});
test('same source filename still preserves different image bytes under unique identities', async t => {
  const directory = await scratch(t); await fs.mkdir(path.join(directory, 'a')); await fs.mkdir(path.join(directory, 'b'));
  await fs.copyFile(input[0].sourcePath, path.join(directory, 'a', 'same.png')); await fs.copyFile(input[1].sourcePath, path.join(directory, 'b', 'same.png'));
  const sources = input.map((entry, i) => ({ ...entry, sourcePath: path.join(directory, i ? 'b' : 'a', 'same.png') }));
  const read = await archive.readReferenceFacts(sources);
  assert.notEqual(read.facts[0].sha256, read.facts[1].sha256);
  assert.deepEqual(read.facts.map(f => f.sourceName), ['same.png', 'same.png']);
  const data = await task();
  data.spec.references.forEach((ref, i) => Object.assign(ref, read.facts[i]));
  data.entries['spec/asset-spec.json'] = JSON.stringify(data.spec);
  const result = await archive.exportZip({ ...data, binaries: read.binaries, outputDirectory: directory, fileName: 'same-names.zip' });
  const files = unzipSync(await fs.readFile(result.path));
  assert.deepEqual(Buffer.from(files['references/content/content-1.png']), read.binaries['content-1']);
  assert.deepEqual(Buffer.from(files['references/style/style-1.png']), read.binaries['style-1']);
});
test('CRC damage, manifest mismatch, missing reference and hostile package paths fail independent verification', async t => {
  const { bytes } = await packed(t);
  const files = unzipSync(bytes);
  const stored = repack(files); let offset = 0;
  while (stored.readUInt32LE(offset) === 0x04034b50) { const len = stored.readUInt16LE(offset + 26), extra = stored.readUInt16LE(offset + 28), size = stored.readUInt32LE(offset + 18), name = stored.subarray(offset + 30, offset + 30 + len).toString(); if (name === 'README_开始阅读.md') { stored[offset + 30 + len + extra] ^= 1; break; } offset += 30 + len + extra + size; }
  assert.throws(() => archive.validateZip(stored));
  const changed = { ...files, 'README_开始阅读.md': Buffer.from('Changed content') }; assert.throws(() => archive.validateZip(repack(changed)));
  const missing = { ...files }; delete missing['references/style/style-1.png']; assert.throws(() => archive.validateZip(repack(missing)));
  for (const name of ['../escape.txt', '/absolute.txt', 'C:/drive.txt', 'a\\evil.txt']) assert.throws(() => archive.validateZip(repack({ [name]: Buffer.from('hostile') })));
  const duplicate = repack({ 'good.txt': Buffer.from('1'), 'evil.txt': Buffer.from('2') }); const needle = Buffer.from('evil.txt'); for (let start = duplicate.indexOf(needle); start >= 0; start = duplicate.indexOf(needle, start + 1)) Buffer.from('good.txt').copy(duplicate, start); assert.throws(() => archive.validateZip(duplicate));
});
test('spec reference role, hash and dimensions must match actual reference PNG', async t => {
  const { bytes } = await packed(t);
  for (const mutation of [s => s.references[0].role = 'style', s => s.references[0].sha256 = '0'.repeat(64), s => s.references[0].widthPx = 99]) {
    const files = unzipSync(bytes); const spec = JSON.parse(Buffer.from(files['spec/asset-spec.json']).toString()); mutation(spec); files['spec/asset-spec.json'] = Buffer.from(JSON.stringify(spec));
    const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString()); const record = manifest.entries.find(e => e.path === 'spec/asset-spec.json'); record.byteLength = files['spec/asset-spec.json'].length; record.sha256 = digest(files['spec/asset-spec.json']); files['manifest.json'] = Buffer.from(JSON.stringify(manifest));
    assert.throws(() => archive.validateZip(repack(files)));
  }
});
test('export refuses mismatched PNG binaries, target impostors and unsafe output filenames', async t => {
  const directory = await scratch(t); const data = await task();
  await assert.rejects(archive.exportZip({ ...data, binaries: { ...data.binaries, 'content-1': data.binaries['style-1'] }, outputDirectory: directory, fileName: 'bad.zip' }));
  await assert.rejects(archive.exportZip({ ...data, entries: { ...data.entries, 'output/asset.png': data.binaries['content-1'] }, outputDirectory: directory, fileName: 'bad.zip' }));
  for (const fileName of ['../bad.zip', '/absolute.zip', 'C:\\drive.zip']) await assert.rejects(archive.exportZip({ ...data, outputDirectory: directory, fileName }));
  assert.deepEqual(await fs.readdir(directory), []);
});
test('cancelled and failed exports leave no temporary ZIP or final artifact', async t => {
  const directory = await scratch(t); const data = await task(); const pre = new AbortController(); pre.abort();
  await assert.rejects(archive.exportZip({ ...data, outputDirectory: directory, fileName: 'cancel.zip', signal: pre.signal }));
  const mid = new AbortController(); const pending = archive.exportZip({ ...data, outputDirectory: directory, fileName: 'cancel.zip', signal: mid.signal }); setImmediate(() => mid.abort()); await assert.rejects(pending);
  assert.deepEqual(await fs.readdir(directory), []);
  const file = path.join(directory, 'not-a-directory'); await fs.writeFile(file, 'unchanged');
  await assert.rejects(archive.exportZip({ ...data, outputDirectory: file, fileName: 'fail.zip' }));
  assert.equal(await fs.readFile(file, 'utf8'), 'unchanged'); assert.deepEqual(await fs.readdir(directory), ['not-a-directory']);
});
test('existing and concurrent same-name exports never overwrite a completed package', async t => {
  const { directory, result, bytes } = await packed(t); const data = await task();
  await assert.rejects(archive.exportZip({ ...data, outputDirectory: directory, fileName: 'task.zip' })); assert.deepEqual(await fs.readFile(result.path), bytes);
  const contenders = await Promise.allSettled([archive.exportZip({ ...data, outputDirectory: directory, fileName: 'race.zip' }), archive.exportZip({ ...data, outputDirectory: directory, fileName: 'race.zip' })]);
  assert.equal(contenders.filter(r => r.status === 'fulfilled').length, 1); assert.equal(contenders.filter(r => r.status === 'rejected').length, 1); archive.validateZip(await fs.readFile(path.join(directory, 'race.zip')));
  assert.deepEqual((await fs.readdir(directory)).sort(), ['race.zip', 'task.zip']);
});
test('real core resolve and compile preserve authoritative semantics across stable JSON key ordering', async t => {
  const { resolveSpec, compileTask } = await import('../core/task.ts');
  const directory = await scratch(t); const read = await archive.readReferenceFacts(input);
  const spec = resolveSpec({ schemaVersion: '1.0.0', taskId: 'integration-task', title: 'Real core fixture', description: 'Two self-made references', output: { widthPx: 384, heightPx: 384, alphaRequirement: 'transparent-required' }, references: input }, read.facts);
  const { entries } = compileTask(spec);
  const result = await archive.exportZip({ spec, entries, binaries: read.binaries, outputDirectory: directory, fileName: 'core-integration.zip' });
  const checked = archive.validateZip(await fs.readFile(result.path));
  assert.equal(checked.spec.output.worldWidth, 3.84); assert.equal(checked.spec.output.ppu, 100); assert.equal(checked.entries.length, 9);
  assert.deepEqual(checked.spec, spec);
  const changed = { ...entries, 'spec/asset-spec.json': entries['spec/asset-spec.json'].replace('Real core fixture', 'Unauthorized change') };
  await assert.rejects(archive.exportZip({ spec, entries: changed, binaries: read.binaries, outputDirectory: directory, fileName: 'modified-spec.zip' }));
});
test('manifest identities, versions, output expectation and reference intent must match authoritative spec', async t => {
  const { spec, bytes } = await packed(t); const files = unzipSync(bytes); const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString());
  assert.equal(manifest.taskId, 'fixture-task'); assert.equal(manifest.assetSchemaVersion, '1.0.0');
  assert.equal(manifest.presetId, 'stone'); assert.equal(manifest.presetVersion, '1'); assert.equal(manifest.adapterId, 'codex'); assert.equal(manifest.adapterVersion, '1');
  assert.equal(manifest.expectedOutputPath, 'output/asset.png'); assert.deepEqual(manifest.references, spec.references);
  for (const mutation of [m => m.taskId = 'wrong-task', m => m.assetSchemaVersion = '0', m => m.presetVersion = '9', m => m.adapterVersion = '9', m => m.expectedOutputPath = 'output/wrong.png', m => m.references[0].note = 'changed reference intent', m => m.references[0].priority = 99]) {
    const broken = structuredClone(manifest); mutation(broken); assert.throws(() => archive.validateZip(repack({ ...files, 'manifest.json': Buffer.from(JSON.stringify(broken)) })));
  }
});
