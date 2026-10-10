import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const require = createRequire(import.meta.url);
const { readClipboardReference } = require('../desktop/clipboard-png.cjs');
const { createTaskSession } = require('../desktop/task-session.cjs');
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = name => path.join(base, 'tests', 'fixtures', name);

function item(data) {
  return { types: Object.keys(data), getType: async type => new Blob([data[type]], { type }) };
}

async function scratch(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), '2dw05a-clipboard-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('clipboard PNG bytes take priority over a simultaneous file representation', async () => {
  const png = await fs.readFile(fixture('content-01.png'));
  const files = pathToFileURL(fixture('style-01.png')).href;
  const reader = { read: async () => [item({ 'text/uri-list': files, 'image/png': png })] };
  const result = await readClipboardReference(reader);
  assert.equal(result.kind, 'image');
  assert.deepEqual(result.bytes, png);
});

test('Windows copied-file URI list accepts local PNGs and rejects remote or non-PNG entries', async () => {
  const uris = [fixture('content-01.png'), fixture('style-01.png')].map(file => pathToFileURL(file).href).join('\r\n');
  const result = await readClipboardReference({ read: async () => [item({ 'text/uri-list': uris })] });
  assert.deepEqual(result, { kind: 'files', filePaths: [fixture('content-01.png'), fixture('style-01.png')] });
  await assert.rejects(readClipboardReference({ read: async () => [item({ 'text/uri-list': 'https://example.com/image.png' })] }), /本地|网络|URL/);
  await assert.rejects(readClipboardReference({ read: async () => [item({ 'text/uri-list': pathToFileURL(base).href })] }), /PNG/);
});

test('plain text allows one absolute local PNG path but never a URL or list', async () => {
  const file = fixture('content-01.png');
  assert.deepEqual(await readClipboardReference({ read: async () => [item({ 'text/plain': file })] }),
    { kind: 'files', filePaths: [file] });
  await assert.rejects(readClipboardReference({ read: async () => [item({ 'text/plain': 'https://example.com/image.png' })] }), /本地|网络|URL/);
  await assert.rejects(readClipboardReference({ read: async () => [item({ 'text/plain': `${file}\n${file}` })] }), /单个|路径/);
  await assert.rejects(readClipboardReference({ read: async () => [item({ 'text/plain': 'image.png' })] }), /绝对|本地/);
});

test('empty or unsupported clipboard gives a readable error', async () => {
  await assert.rejects(readClipboardReference({ read: async () => [] }), /没有|为空|PNG/);
  await assert.rejects(readClipboardReference({ read: async () => [item({ 'text/html': '<img>' })] }), /PNG|不支持/);
  await assert.rejects(readClipboardReference({ read: async () => { throw Error('native API failed'); } }), /剪贴板|读取/);
});

test('unreadable clipboard payload reports a clipboard error', async () => {
  const unreadableImage = { types: ['image/png'], getType: async () => ({ size: 10, arrayBuffer: async () => { throw Error('native decode failed'); } }) };
  await assert.rejects(readClipboardReference({ read: async () => [unreadableImage] }), /剪贴板|读取/);
  const unreadableFiles = { types: ['text/uri-list'], getType: async () => ({ text: async () => { throw Error('native text failed'); } }) };
  await assert.rejects(readClipboardReference({ read: async () => [unreadableFiles] }), /剪贴板|读取/);
});

test('oversized clipboard path text is rejected for both file URI lists and plain paths', async () => {
  const oversized = 'x'.repeat(4 * 1024 * 1024 + 1);
  for (const type of ['text/uri-list', 'text/plain']) {
    await assert.rejects(readClipboardReference({ read: async () => [item({ [type]: oversized })] }),
      error => error?.code === 'clipboard-text-too-large');
  }
});

test('pasted bitmap enters the existing hash checked preview and ZIP path, then cleans on removal', async t => {
  const root = await scratch(t), storage = path.join(root, 'cache'), target = path.join(root, 'task.zip');
  const png = await fs.readFile(fixture('content-01.png'));
  const work = createTaskSession({ base, clipboardDirectory: storage,
    readClipboardReference: async () => ({ kind: 'image', bytes: png }),
    pickReferences: async () => ({ canceled: true }),
    pickExportPath: async () => ({ canceled: false, filePath: target }) });
  const pasted = await work.pasteReference();
  assert.equal(pasted.references.length, 1);
  assert.equal(pasted.references[0].refId, 'ref-01');
  assert.ok(pasted.references[0].thumbnailDataUrl.startsWith('data:image/png;base64,'));
  assert.ok(pasted.references[0].widthPx > 0);
  assert.equal(pasted.references[0].byteLength, png.length);
  const selection = work.choices()[0];
  const preview = await work.previewTask({ selection,
    values: { taskId: work.taskInfo().taskId, title: '剪贴板砖块', widthPx: 384, squareLocked: true }, revision: 1 });
  assert.equal(preview.spec.references[0].sourceName, pasted.references[0].sourceName);
  await work.exportTask({ revision: 1 });
  assert.deepEqual(Buffer.from(unzipSync(await fs.readFile(target))['references/content/ref-01.png']), png);
  const dirs = await fs.readdir(storage);
  assert.equal(dirs.length, 1);
  const files = await fs.readdir(path.join(storage, dirs[0]));
  assert.equal(files.length, 1);
  work.removeReference({ token: pasted.references[0].token });
  await assert.rejects(fs.stat(path.join(storage, dirs[0], files[0])), { code: 'ENOENT' });
  await work.dispose();
});

test('closing a session cleans pasted bytes without touching copied local files', async t => {
  const root = await scratch(t), storage = path.join(root, 'cache');
  const original = fixture('content-01.png');
  const work = createTaskSession({ base, clipboardDirectory: storage,
    readClipboardReference: async () => ({ kind: 'image', bytes: await fs.readFile(original) }),
    pickReferences: async () => ({ canceled: false, filePaths: [original] }) });
  await work.pasteReference();
  await work.chooseReferences();
  const [dir] = await fs.readdir(storage);
  await work.dispose();
  await assert.rejects(fs.stat(path.join(storage, dir)), { code: 'ENOENT' });
  assert.ok((await fs.stat(original)).isFile());
});

test('pasted references survive copy, then blank task removes managed bytes', async t => {
  const root = await scratch(t), storage = path.join(root, 'cache');
  const png = await fs.readFile(fixture('content-01.png'));
  const work = createTaskSession({ base, clipboardDirectory: storage,
    readClipboardReference: async () => ({ kind: 'image', bytes: png }),
    pickReferences: async () => ({ canceled: true }) });
  const original = (await work.pasteReference()).references;
  const copied = await work.beginTask({ copy: true });
  assert.deepEqual(copied.references, original);
  const dirs = await fs.readdir(storage);
  assert.equal((await fs.readdir(path.join(storage, dirs[0]))).length, 1);
  assert.deepEqual((await work.beginTask({ copy: false })).references, []);
  await assert.rejects(fs.stat(path.join(storage, dirs[0])), { code: 'ENOENT' });
  await work.dispose();
});

test('pasted local file joins the same editable reference list as the picker', async t => {
  const root = await scratch(t);
  const work = createTaskSession({ base, clipboardDirectory: path.join(root, 'cache'),
    readClipboardReference: async () => ({ kind: 'files', filePaths: [fixture('content-01.png')] }),
    pickReferences: async () => ({ canceled: false, filePaths: [fixture('style-01.png')] }) });
  const first = (await work.pasteReference()).references[0];
  const updated = work.updateReference({ token: first.token, role: 'style', note: '石砖参考' });
  assert.equal(updated.references[0].role, 'style');
  assert.equal(updated.references[0].note, '石砖参考');
  const picked = (await work.chooseReferences()).references;
  assert.deepEqual(picked.map(ref => ref.refId), ['ref-01', 'ref-02']);
  assert.deepEqual(picked.map(ref => ref.sourceName), ['content-01.png', 'style-01.png']);
  await work.dispose();
});

test('bad bitmap and mixed file input leave the session unchanged', async t => {
  const root = await scratch(t), storage = path.join(root, 'cache');
  let incoming = { kind: 'image', bytes: Buffer.from('not a PNG') };
  const work = createTaskSession({ base, clipboardDirectory: storage,
    readClipboardReference: async () => incoming,
    pickReferences: async () => ({ canceled: true }) });
  await assert.rejects(work.pasteReference(), /PNG|无效/);
  assert.deepEqual(work.taskInfo().references, []);
  assert.deepEqual(await fs.readdir(storage), []);
  incoming = { kind: 'files', filePaths: [fixture('content-01.png'), path.join(root, 'missing.png')] };
  await assert.rejects(work.pasteReference(), /PNG|读取|参考图/);
  assert.deepEqual(work.taskInfo().references, []);
  await work.dispose();
});

test('clipboard image staging failure has a clear error and leaves no reference', async t => {
  const root = await scratch(t), blocked = path.join(root, 'blocked');
  await fs.writeFile(blocked, 'file blocks directory creation');
  const work = createTaskSession({ base, clipboardDirectory: blocked,
    readClipboardReference: async () => ({ kind: 'image', bytes: await fs.readFile(fixture('content-01.png')) }),
    pickReferences: async () => ({ canceled: true }) });
  await assert.rejects(work.pasteReference(), /暂存|保存|剪贴板/);
  assert.deepEqual(work.taskInfo().references, []);
  assert.equal(await fs.readFile(blocked, 'utf8'), 'file blocks directory creation');
  await work.dispose();
});
