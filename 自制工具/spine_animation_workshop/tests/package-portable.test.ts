import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
// @ts-expect-error The packaging entry point is plain JavaScript by design.
import { packagePortable } from '../scripts/package-portable.mjs';

async function fixture() {
  const projectDir = await mkdtemp(join(tmpdir(), 'spw-portable-'));
  const electronDir = join(projectDir, 'node_modules', 'electron', 'dist');
  await mkdir(join(electronDir, 'resources'), { recursive: true });
  await mkdir(join(electronDir, 'locales'), { recursive: true });
  await mkdir(join(projectDir, 'desktop'), { recursive: true });
  await mkdir(join(projectDir, 'dist'), { recursive: true });
  await mkdir(join(projectDir, 'node_modules', '@esotericsoftware', 'spine-webgl'), { recursive: true });
  await mkdir(join(projectDir, 'node_modules', '@esotericsoftware', 'spine-core'), { recursive: true });
  await mkdir(join(projectDir, 'node_modules', 'three'), { recursive: true });
  await writeFile(join(projectDir, 'node_modules', '@esotericsoftware', 'spine-webgl', 'LICENSE'), 'webgl-license');
  await writeFile(join(projectDir, 'node_modules', '@esotericsoftware', 'spine-core', 'LICENSE'), 'core-license');
  await writeFile(join(projectDir, 'node_modules', 'three', 'LICENSE'), 'three-license');
  await writeFile(join(projectDir, 'package.json'), JSON.stringify({
    name: 'spw-fixture', productName: '星骸 Spine 动画工坊', version: '0.1.0',
    devDependencies: { electron: '44.5.1' },
  }));
  await writeFile(join(electronDir, 'version'), '44.5.1\n');
  await writeFile(join(electronDir, 'electron.exe'), 'runtime-exe');
  await writeFile(join(electronDir, 'LICENSE'), 'runtime-license');
  await writeFile(join(electronDir, 'resources', 'default_app.asar'), 'default-app');
  await writeFile(join(electronDir, 'locales', 'zh-CN.pak'), 'locale');
  for (const name of ['main.cjs', 'preload.cjs', 'package-store.cjs', 'config-destination.cjs', 'spine-flow-smoke.cjs', 'native-project.cjs']) {
    await writeFile(join(projectDir, 'desktop', name), name);
  }
  for (const name of ['index.html', 'app.js', 'style.css']) {
    await writeFile(join(projectDir, 'dist', name), name);
  }
  await writeFile(join(projectDir, 'secret.glb'), 'must-not-ship');
  await writeFile(join(projectDir, 'dist', 'source-map-with-user-paths.map'), 'must-not-ship');
  await writeFile(join(projectDir, 'README.md'), 'user-guide');
  await writeFile(join(projectDir, 'packaging.md'), 'packaging-guide');
  return { projectDir, electronDir, outputDirectory: join(projectDir, 'release', 'portable') };
}

test('checks built UI before creating any release output', async (t) => {
  const setup = await fixture();
  t.after(() => rm(setup.projectDir, { recursive: true, force: true }));
  await rm(join(setup.projectDir, 'dist', 'app.js'));
  await assert.rejects(packagePortable(setup), /dist[\\/]app\.js|build/i);
  assert.equal(existsSync(join(setup.projectDir, 'release')), false);
});

test('packages runtime, built app, guides, and licenses without user assets', async (t) => {
  const setup = await fixture();
  t.after(() => rm(setup.projectDir, { recursive: true, force: true }));
  const result = await packagePortable(setup);
  assert.equal(result.outputDirectory, setup.outputDirectory);
  assert.equal(await readFile(result.executablePath, 'utf8'), 'runtime-exe');
  assert.equal(await readFile(join(setup.outputDirectory, 'LICENSE'), 'utf8'), 'runtime-license');
  assert.equal(await readFile(join(setup.outputDirectory, 'LICENSES', 'spine-webgl-LICENSE'), 'utf8'), 'webgl-license');
  assert.equal(await readFile(join(setup.outputDirectory, 'LICENSES', 'spine-core-LICENSE'), 'utf8'), 'core-license');
  assert.equal(await readFile(join(setup.outputDirectory, 'LICENSES', 'three-LICENSE'), 'utf8'), 'three-license');
  assert.equal(await readFile(join(setup.outputDirectory, 'README.md'), 'utf8'), 'user-guide');
  assert.equal(await readFile(join(setup.outputDirectory, 'packaging.md'), 'utf8'), 'packaging-guide');
  assert.equal(await readFile(join(setup.outputDirectory, 'locales', 'zh-CN.pak'), 'utf8'), 'locale');
  assert.equal(await readFile(join(setup.outputDirectory, 'resources', 'default_app.asar'), 'utf8'), 'default-app');
  const appDir = join(setup.outputDirectory, 'resources', 'app');
  assert.equal(await readFile(join(appDir, 'desktop', 'main.cjs'), 'utf8'), 'main.cjs');
  assert.equal(await readFile(join(appDir, 'desktop', 'preload.cjs'), 'utf8'), 'preload.cjs');
  assert.equal(await readFile(join(appDir, 'desktop', 'package-store.cjs'), 'utf8'), 'package-store.cjs');
  assert.equal(await readFile(join(appDir, 'desktop', 'config-destination.cjs'), 'utf8'), 'config-destination.cjs');
  assert.equal(await readFile(join(appDir, 'desktop', 'spine-flow-smoke.cjs'), 'utf8'), 'spine-flow-smoke.cjs');
  assert.equal(await readFile(join(appDir, 'dist', 'index.html'), 'utf8'), 'index.html');
  assert.equal(await readFile(join(appDir, 'dist', 'app.js'), 'utf8'), 'app.js');
  assert.equal(await readFile(join(appDir, 'dist', 'style.css'), 'utf8'), 'style.css');
  assert.deepEqual(JSON.parse(await readFile(join(appDir, 'package.json'), 'utf8')), {
    name: 'spw-fixture', version: '0.1.0', main: 'desktop/main.cjs', private: true,
  });
  assert.equal(existsSync(join(appDir, 'secret.glb')), false);
  assert.equal(existsSync(join(appDir, 'dist', 'source-map-with-user-paths.map')), false);
  assert.equal(existsSync(join(appDir, 'node_modules')), false);
});

test('requires both Spine runtime notices before creating release output', async (t) => {
  const setup = await fixture();
  t.after(() => rm(setup.projectDir, { recursive: true, force: true }));
  await rm(join(setup.projectDir, 'node_modules', '@esotericsoftware', 'spine-core', 'LICENSE'));
  await assert.rejects(packagePortable(setup), /spine-core.*LICENSE|license/i);
  assert.equal(existsSync(join(setup.projectDir, 'release')), false);
});

test('refuses to overwrite a package or write into unrelated project folders', async (t) => {
  const setup = await fixture();
  t.after(() => rm(setup.projectDir, { recursive: true, force: true }));
  await mkdir(setup.outputDirectory, { recursive: true });
  await writeFile(join(setup.outputDirectory, 'keep.txt'), 'untouched');
  await assert.rejects(packagePortable(setup), /exists|already|存在/i);
  assert.equal(await readFile(join(setup.outputDirectory, 'keep.txt'), 'utf8'), 'untouched');
  await assert.rejects(packagePortable({ ...setup, outputDirectory: join(setup.projectDir, 'elsewhere') }), /release/i);
  await assert.rejects(packagePortable({ ...setup, outputDirectory: 'relative-output' }), /absolute/i);
});

test('permits an explicit absolute package path outside the project when the default drive is full', async (t) => {
  const setup = await fixture();
  const externalRoot = await mkdtemp(join(tmpdir(), 'spw-external-release-'));
  t.after(() => rm(setup.projectDir, { recursive: true, force: true }));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  const outputDirectory = join(externalRoot, 'portable');
  const result = await packagePortable({ ...setup, outputDirectory });
  assert.equal(result.outputDirectory, outputDirectory);
  assert.equal(await readFile(result.executablePath, 'utf8'), 'runtime-exe');
  assert.equal(existsSync(join(setup.projectDir, 'release')), false);
});

test('rejects an Electron runtime version that differs from the locked project version', async (t) => {
  const setup = await fixture();
  t.after(() => rm(setup.projectDir, { recursive: true, force: true }));
  await writeFile(join(setup.electronDir, 'version'), '43.0.0\n');
  await assert.rejects(packagePortable(setup), /44\.5\.1|version/i);
  assert.equal(existsSync(join(setup.projectDir, 'release')), false);
});

test('packages both built entry pages when Spine mode is present', async (t) => {
  const setup = await fixture();
  t.after(() => rm(setup.projectDir, { recursive: true, force: true }));
  await mkdir(join(setup.projectDir, 'src', 'ui'), { recursive: true });
  await writeFile(join(setup.projectDir, 'src', 'ui', 'spine.html'), '<main>Spine mode</main>');
  await writeFile(join(setup.projectDir, 'src', 'ui', 'spine-app.ts'), 'document.title = "Spine mode";');
  await writeFile(join(setup.projectDir, 'dist', 'spine.html'), '<main>Spine mode</main>');
  await writeFile(join(setup.projectDir, 'dist', 'spine-app.js'), 'document.title = "Spine mode";');
  const result = await packagePortable(setup);
  const appDir = join(result.outputDirectory, 'resources', 'app');
  assert.equal(await readFile(join(appDir, 'dist', 'spine.html'), 'utf8'), '<main>Spine mode</main>');
  assert.equal(await readFile(join(appDir, 'dist', 'spine-app.js'), 'utf8'), 'document.title = "Spine mode";');
});

test('refuses a partial Spine package before creating release folder', async (t) => {
  const setup = await fixture();
  t.after(() => rm(setup.projectDir, { recursive: true, force: true }));
  await mkdir(join(setup.projectDir, 'src', 'ui'), { recursive: true });
  await writeFile(join(setup.projectDir, 'src', 'ui', 'spine.html'), '<main>Spine mode</main>');
  await writeFile(join(setup.projectDir, 'src', 'ui', 'spine-app.ts'), 'document.title = "Spine mode";');
  await writeFile(join(setup.projectDir, 'dist', 'spine.html'), '<main>Spine mode</main>');
  await assert.rejects(packagePortable(setup), /spine-app\.js|build/i);
  assert.equal(existsSync(join(setup.projectDir, 'release')), false);
});
