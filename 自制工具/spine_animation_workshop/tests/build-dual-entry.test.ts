import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
// @ts-expect-error The build entry point is plain JavaScript by design.
import { buildWorkshop } from '../scripts/build.mjs';

test('builds both the legacy GLB page and Spine mode page when the pair exists', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'spw02-build-'));
  await mkdir(join(projectDir, 'src', 'ui'), { recursive: true });
  await writeFile(join(projectDir, 'src', 'ui', 'app.ts'), 'document.title = "Legacy GLB";');
  await writeFile(join(projectDir, 'src', 'ui', 'index.html'), '<main>Legacy GLB</main>');
  await writeFile(join(projectDir, 'src', 'ui', 'spine-app.ts'), 'document.title = "Spine mode";');
  await writeFile(join(projectDir, 'src', 'ui', 'spine.html'), '<main>Spine mode</main>');
  await writeFile(join(projectDir, 'src', 'ui', 'style.css'), 'main { color: red }');
  await buildWorkshop({ projectDir });
  assert.equal(await readFile(join(projectDir, 'dist', 'index.html'), 'utf8'), '<main>Legacy GLB</main>');
  assert.equal(await readFile(join(projectDir, 'dist', 'spine.html'), 'utf8'), '<main>Spine mode</main>');
  assert.match(await readFile(join(projectDir, 'dist', 'app.js'), 'utf8'), /Legacy GLB/);
  assert.match(await readFile(join(projectDir, 'dist', 'spine-app.js'), 'utf8'), /Spine mode/);
});

test('refuses to build a Spine page without its script', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'spw02-build-partial-'));
  await mkdir(join(projectDir, 'src', 'ui'), { recursive: true });
  await writeFile(join(projectDir, 'src', 'ui', 'app.ts'), 'document.title = "Legacy GLB";');
  await writeFile(join(projectDir, 'src', 'ui', 'index.html'), '<main>Legacy GLB</main>');
  await writeFile(join(projectDir, 'src', 'ui', 'spine.html'), '<main>Spine mode</main>');
  await writeFile(join(projectDir, 'src', 'ui', 'style.css'), 'main { color: red }');
  await assert.rejects(buildWorkshop({ projectDir }), /spine-app\.ts|Spine mode/);
});
