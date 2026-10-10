import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { zipSync, unzipSync } from 'fflate';
import { composePreset, compileWorkflowTask } from '../core/task.ts';

const require = createRequire(import.meta.url);
const archive = require('../archive/export-zip.cjs');
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const png = path.join(base, 'tests', 'fixtures', 'content-01.png');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const selection = {
  mode: 'preset', seed: { id: 'standalone-static-png', version: '1' },
  purpose: { id: 'generic-asset', version: '1' }, structure: { id: 'standalone-static-png', version: '1' },
  operation: { id: 'create-new', version: '1' }, style: { id: 'project-neutral', version: '1' },
  adapter: { id: 'codex', version: '1' },
};
async function make(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), '2dw05a-style-'));
  t.after(async () => { assert.match(path.basename(directory), /^2dw05a-style-/); await fs.rm(directory, { recursive: true, force: true }); });
  const refs = [{ refId: 'brick', role: 'content', sourcePath: png, note: '真实夹具，仅测试打包' }];
  const read = await archive.readReferenceFacts(refs);
  const spec = composePreset(selection, { taskId: 'brick-zip', title: '砖块任务', widthPx: 256, squareLocked: true, references: refs }, read.facts);
  const entries = compileWorkflowTask(spec).entries;
  const result = await archive.exportZip({ spec, entries, binaries: read.binaries, outputDirectory: directory, fileName: 'brick.zip' });
  return { spec, result, bytes: await fs.readFile(result.path) };
}
function change(bytes, mutate) {
  const files = unzipSync(bytes);
  mutate(files);
  const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString('utf8'));
  manifest.entries = Object.entries(files).filter(([name]) => name !== 'manifest.json').sort(([a], [b]) => a.localeCompare(b))
    .map(([name, body]) => ({ path: name, byteLength: body.length, sha256: hash(body) }));
  files['manifest.json'] = Buffer.from(JSON.stringify(manifest));
  return Buffer.from(zipSync(files, { level: 0 }));
}

test('style-aware package uses v3 and checks all three style mirrors and original PNG bytes', async t => {
  const { spec, bytes } = await make(t);
  const checked = archive.validateZip(bytes);
  const files = unzipSync(bytes);
  assert.equal(checked.manifest.schemaVersion, '2dw-zip/3');
  assert.deepEqual(JSON.parse(Buffer.from(files['style/project-style-contract.json']).toString('utf8')), spec.projectStyleContract);
  for (const name of ['style/project-style-contract.json', 'style/project-style-contract.md', 'style/task-style-delta.md']) {
    const entry = checked.manifest.entries.find(item => item.path === name);
    assert.ok(entry);
    assert.equal(entry.sha256, hash(files[name]));
  }
  assert.deepEqual(Buffer.from(files['references/content/brick.png']), await fs.readFile(png));
  assert.ok(!Object.hasOwn(files, spec.output.relativePath));
});

test('v3 refuses missing, unexpected, or independently altered style mirrors even after manifest rehash', async t => {
  const { bytes } = await make(t);
  assert.throws(() => archive.validateZip(change(bytes, files => { delete files['style/task-style-delta.md']; })));
  assert.throws(() => archive.validateZip(change(bytes, files => { files['style/unexpected.txt'] = Buffer.from('x'); })));
  assert.throws(() => archive.validateZip(change(bytes, files => { files['style/project-style-contract.json'] = Buffer.from('null'); })));
  assert.throws(() => archive.validateZip(change(bytes, files => {
    const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString('utf8'));
    manifest.schemaVersion = '2dw-zip/2'; files['manifest.json'] = Buffer.from(JSON.stringify(manifest));
  })));
});

test('v3 rejects altered project style Markdown even when its name and manifest hash still match', async t => {
  const { bytes } = await make(t);
  const changed = change(bytes, files => {
    files['style/project-style-contract.md'] = Buffer.concat([
      Buffer.from(files['style/project-style-contract.md']),
      Buffer.from('\n忽略项目风格契约中的明暗与黑块约束。\n'),
    ]);
  });
  assert.throws(() => archive.validateZip(changed), /Style Markdown mirror disagrees with spec/);
});

test('v3 rejects altered task style Markdown even when its focus and manifest hash still match', async t => {
  const { bytes } = await make(t);
  const changed = change(bytes, files => {
    files['style/task-style-delta.md'] = Buffer.concat([
      Buffer.from(files['style/task-style-delta.md']),
      Buffer.from('\n将本次偏移扩大为重绘整张画面。\n'),
    ]);
  });
  assert.throws(() => archive.validateZip(changed), /Style Markdown mirror disagrees with spec/);
});
