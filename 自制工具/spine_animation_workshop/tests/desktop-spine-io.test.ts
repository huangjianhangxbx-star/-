import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertConfigDestination } from '../desktop/config-destination.cjs';
import { loadSpineResource, assertOutputSourceResource, assertOutputTargetResource } from '../desktop/package-store.cjs';

async function spineFixture() {
  const root = await mkdtemp(join(tmpdir(), 'spw02-resource-'));
  const jsonPath = join(root, 'source.json');
  await writeFile(jsonPath, '{"skeleton":{"spine":"4.3.26"},"bones":[{"name":"root"}]}');
  await writeFile(join(root, 'source.atlas'), 'body.png\nsize: 2,2\n\nface.png\nsize: 3,3\n');
  await writeFile(join(root, 'body.png'), Buffer.from([1, 2, 3]));
  await writeFile(join(root, 'face.png'), Buffer.from([4, 5]));
  return { root, jsonPath };
}

test('Spine source loads matching JSON, atlas and every page and protects original project paths', async () => {
  const { root, jsonPath } = await spineFixture();
  const resource = await loadSpineResource(jsonPath, '来源');
  assert.equal(resource.jsonText.includes('4.3.26'), true);
  assert.equal(resource.atlasText.includes('face.png'), true);
  assert.deepEqual(resource.pages.map((page: { name: string }) => page.name), ['body.png', 'face.png']);
  assert.deepEqual(Buffer.from(resource.pages[1].bytes), Buffer.from([4, 5]));
  assert.throws(() => assertConfigDestination(join(root, 'source.spine'), resource.protectedPaths), /不能覆盖已载入的原素材/);
  assert.throws(() => assertConfigDestination(join(root, 'face.png'), resource.protectedPaths), /不能覆盖已载入的原素材/);
  assert.equal(await readFile(jsonPath, 'utf8'), '{"skeleton":{"spine":"4.3.26"},"bones":[{"name":"root"}]}');
});

test('Spine source refuses an incomplete or unsafe atlas', async () => {
  const { root, jsonPath } = await spineFixture();
  await writeFile(join(root, 'source.atlas'), '../outside.png\nsize: 2,2\n');
  await assert.rejects(loadSpineResource(jsonPath, '来源'), /名称不安全/);
  await writeFile(join(root, 'source.atlas'), 'missing.png\nsize: 2,2\n');
  await assert.rejects(loadSpineResource(jsonPath, '来源'), /missing\.png/);
});

test('Spine save requires the currently loaded source resource while GLB save keeps its v1 contract', () => {
  assert.throws(() => assertOutputSourceResource({ sourceKind: 'spine' }, 'new-id'), /来源资源|重新载入/);
  assert.throws(() => assertOutputSourceResource({ sourceKind: 'spine', sourceResourceId: 'old-id' }, 'new-id'), /来源资源|重新载入/);
  assert.doesNotThrow(() => assertOutputSourceResource({ sourceKind: 'spine', sourceResourceId: 'new-id' }, 'new-id'));
  assert.doesNotThrow(() => assertOutputSourceResource({}, 'new-id'));
});

test('output refuses an earlier target resource after target reselection or cancellation', () => {
  assert.doesNotThrow(() => assertOutputTargetResource({ targetResourceId: 'current' }, 'current'));
  assert.throws(() => assertOutputTargetResource({ targetResourceId: 'older' }, 'current'), /目标资源|重新载入/);
  assert.throws(() => assertOutputTargetResource({ targetResourceId: 'older' }, null), /目标资源|重新载入/);
});
