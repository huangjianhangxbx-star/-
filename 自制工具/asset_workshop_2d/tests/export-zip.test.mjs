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
async function task() {
  const read = await archive.readReferenceFacts(input);
  const spec = {
    schemaVersion: '1.0.0', taskId: 'fixture-task', title: 'Stone test', description: 'Self-made fixture', styleDescription: 'Muted stone',
    presetId: 'stone', presetVersion: '1', adapterId: 'codex', adapterVersion: '1',
    output: { format: 'png', widthPx: 384, heightPx: 384, ppu: 100, worldWidth: 3.84, worldHeight: 3.84, alphaRequirement: 'transparent', relativePath: 'output/asset.png' },
    requirements: { hard: [], preferences: [], creativeFreedom: [] }, fieldSources: {},
    references: input.map((entry, i) => ({ refId: entry.refId, role: entry.role, note: entry.note, ...read.facts[i], packagePath: `references/${entry.role}/${entry.refId}.png` })),
  };
  return { spec, binaries: read.binaries, entries: { 'README_开始阅读.md': 'Start here', 'spec/asset-spec.json': JSON.stringify(spec), 'spec/style-profile.md': 'Style', 'plan/production-steps.md': 'Steps', 'prompts/codex.md': 'Prompt', 'validation/checklist.md': 'Checklist' } };
}
async function packed(t) { const directory = await scratch(t); const data = await task(); const result = await archive.exportZip({ ...data, outputDirectory: directory, fileName: 'task.zip' }); return { ...data, result, bytes: await fs.readFile(result.path), directory }; }
function repack(files) { return Buffer.from(zipSync(files, { level: 0 })); }

test('reference reader and ZIP exporter are available', () => {
  for (const name of ['readReferenceFacts', 'exportZip', 'validateZip']) assert.equal(typeof archive[name], 'function');
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
