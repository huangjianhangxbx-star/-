import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('generated package keeps source files untouched and creates a new output on each save', async () => {
  const { loadSpineResource, writeOutputPackage } = await import('../desktop/package-store.cjs');
  const root = await mkdtemp(join(tmpdir(), 'spw-package-'));
  const input = join(root, 'input');
  const output = join(root, 'output');
  await mkdir(input);
  await mkdir(output);
  const jsonPath = join(input, 'character.json');
  const atlasPath = join(input, 'character.atlas');
  const pagePath = join(input, 'character.png');
  await writeFile(jsonPath, '{"old":true}');
  await writeFile(atlasPath, 'character.png\nsize: 2,2\n');
  await writeFile(pagePath, Buffer.from([1, 2, 3]));

  const payload = {
    outputDirectory: output,
    animationName: 'workshop/walk',
    jsonText: '{"new":true}',
    configText: '{"schemaVersion":1}',
    target: await loadSpineResource(jsonPath),
  };
  const first = await writeOutputPackage(payload);
  const second = await writeOutputPackage(payload);
  assert.notEqual(first.directory, second.directory);
  assert.equal(await readFile(first.jsonPath, 'utf8'), payload.jsonText);
  assert.equal(await readFile(join(first.directory, 'character.atlas'), 'utf8'), 'character.png\nsize: 2,2\n');
  assert.deepEqual(await readFile(join(first.directory, 'character.png')), Buffer.from([1, 2, 3]));
  assert.equal(await readFile(join(first.directory, 'calibration.spw.json'), 'utf8'), payload.configText);
  assert.equal(await readFile(jsonPath, 'utf8'), '{"old":true}');
});

test('Spine migration package has a distinct prefix and preserves the report beside the complete target copy', async () => {
  const { loadSpineResource, writeOutputPackage } = await import('../desktop/package-store.cjs');
  const root = await mkdtemp(join(tmpdir(), 'spw02-package-'));
  const input = join(root, 'input');
  const output = join(root, 'output');
  await mkdir(input);
  await mkdir(output);
  const jsonPath = join(input, 'target.json');
  const atlasPath = join(input, 'target.atlas');
  const pagePath = join(input, 'target.png');
  await writeFile(jsonPath, '{"animations":{"old":{}}}');
  await writeFile(atlasPath, 'target.png\nsize: 1,1\n');
  await writeFile(pagePath, Buffer.from([7, 8]));
  const payload = {
    outputDirectory: output,
    sourceKind: 'spine' as const,
    animationName: 'source/run',
    jsonText: '{"animations":{"old":{},"new":{}}}',
    reportText: '骨骼：保留 2；阻塞 0',
    target: await loadSpineResource(jsonPath),
  };
  const first = await writeOutputPackage(payload);
  const second = await writeOutputPackage(payload);
  assert.match(first.directory, /SPW-02_source-run_/);
  assert.notEqual(first.directory, second.directory);
  assert.equal(await readFile(first.jsonPath, 'utf8'), payload.jsonText);
  assert.equal(await readFile(join(first.directory, 'migration-report.txt'), 'utf8'), payload.reportText);
  assert.deepEqual(await readFile(join(first.directory, 'target.png')), Buffer.from([7, 8]));
  assert.equal(await readFile(jsonPath, 'utf8'), '{"animations":{"old":{}}}');
});

test('invalid migration report is rejected before any output folder is created', async () => {
  const { loadSpineResource, writeOutputPackage } = await import('../desktop/package-store.cjs');
  const root = await mkdtemp(join(tmpdir(), 'spw02-bad-report-'));
  const input = join(root, 'input');
  const output = join(root, 'output');
  await mkdir(input);
  await mkdir(output);
  const jsonPath = join(input, 'target.json');
  const atlasPath = join(input, 'target.atlas');
  const pagePath = join(input, 'target.png');
  await writeFile(jsonPath, '{}');
  await writeFile(atlasPath, 'target.png\nsize: 1,1\n');
  await writeFile(pagePath, Buffer.from([7]));
  await assert.rejects(writeOutputPackage({
    outputDirectory: output, sourceKind: 'spine', animationName: 'run', jsonText: '{}', reportText: { unsafe: true } as unknown as string,
    target: await loadSpineResource(jsonPath),
  }), /报告|report/i);
  assert.deepEqual(await (await import('node:fs/promises')).readdir(output), []);
});

test('saved package uses the atlas and page bytes that were loaded for preview even if source files change', async () => {
  const { loadSpineResource, writeOutputPackage } = await import('../desktop/package-store.cjs');
  const root = await mkdtemp(join(tmpdir(), 'spw02-snapshot-'));
  const input = join(root, 'input');
  const output = join(root, 'output');
  await mkdir(input);
  await mkdir(output);
  const jsonPath = join(input, 'target.json');
  const atlasPath = join(input, 'target.atlas');
  const pagePath = join(input, 'target.png');
  const originalAtlas = 'target.png\nsize: 1,1\nfilter: Linear,Linear\n';
  const originalPage = Buffer.from([1, 2, 3, 4]);
  await writeFile(jsonPath, '{"skeleton":{"spine":"4.3.26"},"bones":[{"name":"root"}]}');
  await writeFile(atlasPath, originalAtlas);
  await writeFile(pagePath, originalPage);
  const target = await loadSpineResource(jsonPath);

  await writeFile(atlasPath, 'target.png\nsize: 2,2\nfilter: Nearest,Nearest\n');
  await writeFile(pagePath, Buffer.from([9, 8, 7, 6]));
  const saved = await writeOutputPackage({
    outputDirectory: output,
    sourceKind: 'spine',
    animationName: 'run',
    jsonText: target.jsonText,
    target,
  });

  assert.equal(await readFile(join(saved.directory, 'target.atlas'), 'utf8'), originalAtlas);
  assert.deepEqual(await readFile(join(saved.directory, 'target.png')), originalPage);
});
