import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

async function harness(userData: string) {
  const main = process.env.SPW_TEST_MAIN_PATH || fileURLToPath(new URL('../desktop/main.cjs', import.meta.url));
  const require = createRequire(main);
  const handlers = new Map<string, Function>();
  let next: string | null = null;
  let lastOptions: any;
  const dialog = {
    async showOpenDialog(_window: unknown, options: any) {
      lastOptions = options;
      return { canceled: next === null, filePaths: next ? [next] : [] };
    },
    async showSaveDialog(_window: unknown, options: any) {
      lastOptions = options;
      return { canceled: next === null, filePath: next };
    },
  };
  runInNewContext(`${await readFile(main, 'utf8')}\nregisterIpc();`, {
    require: (id: string) => id === 'electron' ? {
      app: { getPath: () => userData, whenReady: () => ({ then() {} }), on() {} },
      BrowserWindow: class {}, dialog, ipcMain: { handle: (name: string, fn: Function) => handlers.set(name, fn) },
    } : require(id),
    __dirname: dirname(main), process: { env: {}, platform: 'win32' }, Buffer, console,
  });
  return async (channel: string, path: string | null = null, payload?: unknown) => {
    next = path;
    const value = await handlers.get(channel)!(undefined, payload);
    return { value, options: lastOptions };
  };
}

async function fixture(t: any) {
  const root = await mkdtemp(join(tmpdir(), 'spw-dialog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source'), config = join(root, 'config'), output = join(root, 'output');
  for (const path of [source, config, output]) await mkdir(path);
  await writeFile(join(source, 'motion.glb'), 'fixture');
  await writeFile(join(config, 'mapping.json'), '{}');
  return { root, source, config, output, userData: join(root, 'settings') };
}

test('dialog locations survive a fresh app instance and stay separate across source, config and output', async t => {
  const f = await fixture(t);
  const first = await harness(f.userData);
  await first('source:open', join(f.source, 'motion.glb'));
  await first('config:open', join(f.config, 'mapping.json'));
  await first('output:choose', f.output);
  const restarted = await harness(f.userData);
  assert.equal((await restarted('source:open')).options.defaultPath, f.source);
  assert.equal((await restarted('config:open')).options.defaultPath, f.config);
  assert.equal((await restarted('output:choose')).options.defaultPath, f.output);
  assert.equal((await restarted('config:save', null, '{}')).options.defaultPath, join(f.config, 'calibration.spw.json'));
});

test('cancel does not forget the previous folder and a removed folder falls back to its existing parent', async t => {
  const f = await fixture(t);
  const first = await harness(f.userData);
  await first('output:choose', f.output);
  await first('output:choose');
  const restarted = await harness(f.userData);
  assert.equal((await restarted('output:choose')).options.defaultPath, f.output);
  await rm(f.output, { recursive: true });
  assert.equal((await restarted('output:choose')).options.defaultPath, f.root);
});

test('Spine source and target remember separate asset folders with a useful first-use fallback', async t => {
  const f = await fixture(t);
  const target = join(f.root, 'target'); await mkdir(target);
  for (const folder of [f.source, target]) {
    await writeFile(join(folder, 'rig.json'), '{"skeleton":{"spine":"4.3.26"},"bones":[{"name":"root"}]}');
    await writeFile(join(folder, 'rig.atlas'), 'body.png\nsize: 2,2\n');
    await writeFile(join(folder, 'body.png'), Buffer.from([1, 2, 3]));
  }
  const first = await harness(f.userData);
  await first('spine-source:open', join(f.source, 'rig.json'));
  assert.equal((await first('target:open', join(target, 'rig.json'))).options.defaultPath, f.source);
  const restarted = await harness(f.userData);
  assert.equal((await restarted('spine-source:open')).options.defaultPath, f.source);
  assert.equal((await restarted('target:open')).options.defaultPath, target);
});

test('damaged preferences do not block selection and a new choice repairs the history', async t => {
  const f = await fixture(t);
  await mkdir(f.userData);
  await writeFile(join(f.userData, 'dialog-directories.json'), '{broken');
  const first = await harness(f.userData);
  await first('output:choose', f.output);
  const restarted = await harness(f.userData);
  assert.equal((await restarted('output:choose')).options.defaultPath, f.output);
});
