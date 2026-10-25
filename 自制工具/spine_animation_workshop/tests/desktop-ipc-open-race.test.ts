import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test, { after } from 'node:test';

type Resource = {
  path: string;
  name: string;
  jsonPath: string;
  atlasPath: string;
  atlasBytes: Buffer;
  jsonText: string;
  atlasText: string;
  pages: [];
  protectedPaths: string[];
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function resource(path: string): Resource {
  return {
    path, name: path, jsonPath: path, atlasPath: `${path}.atlas`, atlasBytes: Buffer.from('atlas'),
    jsonText: '{}', atlasText: 'page.png\nsize: 1,1\n', pages: [], protectedPaths: [path],
  };
}

async function ipcHarness(filePicks: string[]) {
  const userData = await mkdtemp(join(tmpdir(), 'spw-ipc-'));
  after(() => rm(userData, { recursive: true, force: true }));
  const mainPath = fileURLToPath(new URL('../desktop/main.cjs', import.meta.url));
  const nativeRequire = createRequire(mainPath);
  const packageStore = nativeRequire('./package-store.cjs');
  const handlers = new Map<string, (_event?: unknown, payload?: any) => Promise<any>>();
  const pending = new Map(filePicks.map((path) => [path, deferred<Resource>()]));
  const loadStarted = new Map(filePicks.map((path) => [path, deferred<void>()]));
  const picks = [...filePicks];
  const dialog = {
    async showOpenDialog(_window: unknown, options: { properties: string[] }) {
      if (options.properties.includes('openDirectory')) return { canceled: false, filePaths: ['/output'] };
      const path = picks.shift();
      if (!path) throw new Error('Unexpected file picker request');
      return { canceled: false, filePaths: [path] };
    },
  };
  const requireFromMain = (id: string) => id === 'electron'
    ? { app: { getPath: () => userData, whenReady: () => ({ then() {} }), on() {} }, BrowserWindow: class {}, dialog,
      ipcMain: { handle(channel: string, handler: (_event?: unknown, payload?: any) => Promise<any>) { handlers.set(channel, handler); } } }
    : id === './package-store.cjs'
      ? { ...packageStore,
        loadSpineResource: (path: string) => {
          loadStarted.get(path)?.resolve();
          return pending.get(path)?.promise ?? Promise.reject(new Error(`Unexpected path: ${path}`));
        },
        writeOutputPackage: async ({ target }: { target: Resource }) => ({ jsonPath: target.jsonPath }),
      }
      : nativeRequire(id);
  const source = await readFile(mainPath, 'utf8');
  runInNewContext(`${source}\nregisterIpc();`, {
    require: requireFromMain, process: { env: {}, platform: 'win32' }, __dirname: dirname(mainPath),
    Buffer, console,
  });
  function open(channel: string) {
    const handler = handlers.get(channel);
    assert.ok(handler, `${channel} handler is registered`);
    return handler();
  }
  function complete(path: string) {
    const request = pending.get(path);
    assert.ok(request, `${path} was selected`);
    request.resolve(resource(path));
  }
  function waitUntilLoad(path: string) {
    const started = loadStarted.get(path);
    assert.ok(started);
    return started.promise;
  }
  function fail(path: string) {
    const request = pending.get(path);
    assert.ok(request, `${path} was selected`);
    request.reject(new Error('旧资源读取失败'));
  }
  async function save(payload: { sourceKind?: 'spine'; sourceResourceId?: string; targetResourceId: string }) {
    const handler = handlers.get('output:save');
    assert.ok(handler);
    return handler(undefined, { ...payload, outputDirectory: '/output', jsonText: '{}', animationName: 'run' });
  }
  return { open, waitUntilLoad, complete, fail, save };
}

test('a slower earlier Spine source open cannot invalidate the newer source that the renderer selected', async () => {
  const ipc = await ipcHarness(['target', 'source-old', 'source-new']);
  const targetOpen = ipc.open('target:open');
  ipc.complete('target');
  const target = await targetOpen;
  await ipc.open('output:choose');

  const oldOpen = ipc.open('spine-source:open');
  await ipc.waitUntilLoad('source-old');
  const newOpen = ipc.open('spine-source:open');
  ipc.complete('source-new');
  const newest = await newOpen;
  ipc.complete('source-old');
  await oldOpen;

  assert.deepEqual(await ipc.save({
    sourceKind: 'spine', sourceResourceId: newest.resourceId, targetResourceId: target.resourceId,
  }), { jsonPath: 'target' });
});

test('a slower earlier target open cannot invalidate the newer target and its save snapshot', async () => {
  const ipc = await ipcHarness(['target-old', 'target-new']);
  await ipc.open('output:choose');
  const oldOpen = ipc.open('target:open');
  await ipc.waitUntilLoad('target-old');
  const newOpen = ipc.open('target:open');
  ipc.complete('target-new');
  const newest = await newOpen;
  ipc.complete('target-old');
  await oldOpen;

  assert.deepEqual(await ipc.save({ targetResourceId: newest.resourceId }), { jsonPath: 'target-new' });
});

test('a stale Spine source read failure is ignored after a newer source succeeds', async () => {
  const ipc = await ipcHarness(['target', 'source-old', 'source-new']);
  const targetOpen = ipc.open('target:open');
  ipc.complete('target');
  const target = await targetOpen;
  await ipc.open('output:choose');

  const oldOpen = ipc.open('spine-source:open');
  await ipc.waitUntilLoad('source-old');
  const newOpen = ipc.open('spine-source:open');
  ipc.complete('source-new');
  const newest = await newOpen;
  ipc.fail('source-old');
  assert.equal(await oldOpen, null);
  assert.deepEqual(await ipc.save({
    sourceKind: 'spine', sourceResourceId: newest.resourceId, targetResourceId: target.resourceId,
  }), { jsonPath: 'target' });
});

test('a stale target read failure is ignored after a newer target succeeds', async () => {
  const ipc = await ipcHarness(['target-old', 'target-new']);
  await ipc.open('output:choose');
  const oldOpen = ipc.open('target:open');
  await ipc.waitUntilLoad('target-old');
  const newOpen = ipc.open('target:open');
  ipc.complete('target-new');
  const newest = await newOpen;
  ipc.fail('target-old');
  assert.equal(await oldOpen, null);
  assert.deepEqual(await ipc.save({ targetResourceId: newest.resourceId }), { jsonPath: 'target-new' });
});
