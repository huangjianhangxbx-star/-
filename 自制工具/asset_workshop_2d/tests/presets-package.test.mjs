import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const text = bytes => Buffer.from(bytes).toString('utf8');

async function removeScratch(outputDirectory) {
  const temporaryRoot = await fs.realpath(os.tmpdir());
  const target = await fs.realpath(outputDirectory);
  assert.equal(path.dirname(target), temporaryRoot);
  assert.match(path.basename(target), /^2dw02-samples-[ab]-[A-Za-z0-9]+$/);
  await fs.rm(target, { recursive: true, force: true });
}

async function samples(t, outputDirectory) {
  t.after(() => removeScratch(outputDirectory));
  await run(process.execPath, [path.join(root, 'scripts', 'build.mjs')], { cwd: root });
  await run(process.execPath, [path.join(root, 'scripts', 'make-2dw02-samples.mjs'), '--output-dir', outputDirectory], { cwd: root });
  const report = JSON.parse(await fs.readFile(path.join(outputDirectory, 'samples-report.json'), 'utf8'));
  return report;
}

test('three production sample packages preserve dimensions, reference bytes, manifest and reproducible content', async t => {
  const first = await fs.mkdtemp(path.join(os.tmpdir(), '2dw02-samples-a-'));
  const second = await fs.mkdtemp(path.join(os.tmpdir(), '2dw02-samples-b-'));
  const firstReport = await samples(t, first);
  const secondReport = await samples(t, second);
  assert.deepEqual(firstReport.samples.map(x => x.id), ['A', 'B', 'C']);
  assert.deepEqual(secondReport.samples.map(x => x.id), ['A', 'B', 'C']);

  const expected = {
    A: { pixels: [384, 384], ppu: 100, world: [3.84, 3.84], alpha: 'transparent-required', refs: [] },
    B: { pixels: [512, 256], ppu: 200, world: [2.56, 1.28], alpha: 'opaque-required', refs: ['content-01', 'style-01'] },
    C: { pixels: [640, 480], ppu: 100, world: [6.4, 4.8], alpha: 'alpha-allowed', refs: ['content-01'] },
  };
  const expectedFiles = [
    'README_开始阅读.md', 'manifest.json', 'plan/production-steps.md',
    'prompts/codex.md', 'spec/asset-spec.json', 'spec/style-profile.md', 'validation/checklist.md',
  ];
  for (const entry of firstReport.samples) {
    const other = secondReport.samples.find(x => x.id === entry.id);
    const bytes = await fs.readFile(path.join(first, entry.fileName));
    const repeated = await fs.readFile(path.join(second, other.fileName));
    assert.equal(entry.sha256, digest(bytes));
    assert.equal(other.sha256, digest(repeated));
    const files = unzipSync(bytes), repeatedFiles = unzipSync(repeated);
    assert.deepEqual(Object.keys(files).sort(), Object.keys(repeatedFiles).sort());
    for (const name of Object.keys(files)) assert.equal(digest(files[name]), digest(repeatedFiles[name]), `${entry.id}: ${name} changed for same input`);
    const spec = JSON.parse(text(files['spec/asset-spec.json']));
    const manifest = JSON.parse(text(files['manifest.json']));
    const want = expected[entry.id];
    assert.equal(spec.schemaVersion, '1.1.0');
    assert.equal(spec.output.widthPx, want.pixels[0]);
    assert.equal(spec.output.heightPx, want.pixels[1]);
    assert.equal(spec.output.ppu, want.ppu);
    assert.equal(spec.output.worldWidth, want.world[0]);
    assert.equal(spec.output.worldHeight, want.world[1]);
    assert.equal(spec.output.alphaRequirement, want.alpha);
    assert.equal(spec.output.relativePath, 'output/asset.png');
    assert.deepEqual(spec.references.map(x => x.refId), want.refs);
    assert.deepEqual(manifest.entries.map(x => x.path).sort(), Object.keys(files).filter(x => x !== 'manifest.json').sort());
    assert.deepEqual(Object.keys(files).filter(x => !x.startsWith('references/')).sort(), expectedFiles);
    assert.ok(!Object.hasOwn(files, 'output/asset.png'));
    assert.equal(manifest.assetSchemaVersion, '1.1.0');
    assert.equal(manifest.taskId, spec.taskId);
    for (const listed of manifest.entries) {
      assert.equal(listed.byteLength, files[listed.path].length);
      assert.equal(listed.sha256, digest(files[listed.path]));
    }
    for (const ref of spec.references) {
      const source = await fs.readFile(path.join(root, 'tests', 'fixtures', `${ref.refId}.png`));
      assert.deepEqual(Buffer.from(files[ref.packagePath]), source);
      assert.equal(ref.sha256, digest(source));
    }
    assert.match(text(files['prompts/codex.md']), new RegExp(`${want.pixels[0]}×${want.pixels[1]}`));
    assert.match(text(files['prompts/codex.md']), /spec\/asset-spec\.json/);
    if (entry.id === 'A') assert.equal(spec.fieldSources['output.heightPx'], 'derived');
    if (entry.id === 'B') assert.equal(spec.fieldSources['output.ppu'], 'user-override');
    if (entry.id === 'C') {
      assert.equal(spec.composition.mode, 'custom');
      assert.deepEqual(spec.requirements, {
        hard: ['保留可读轮廓。'], preferences: ['使用克制的冷色。'], creativeFreedom: ['细部纹理可以自由设计。'],
      });
    }
  }
  const gold = await fs.readFile(path.join(root, 'samples', '2dw-proof-codex.zip'));
  assert.equal(digest(gold), '1f90a6b529c54cf3bda2fe9f1f90221fb19025b99ad113ca846aa325e663e504');
});
