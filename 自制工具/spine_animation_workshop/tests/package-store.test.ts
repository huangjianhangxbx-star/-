import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('generated package keeps source files untouched and creates a new output on each save', async () => {
  const { writeOutputPackage } = await import('../desktop/package-store.cjs');
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
    target: { jsonPath, atlasPath, pages: [{ name: 'character.png', path: pagePath }] },
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
