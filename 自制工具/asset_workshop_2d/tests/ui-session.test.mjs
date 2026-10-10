import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import pngjs from 'pngjs';

const require = createRequire(import.meta.url);
let createTaskSession;
try { ({ createTaskSession } = require('../desktop/task-session.cjs')); } catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = name => path.join(base, 'tests', 'fixtures', name);
const { PNG } = pngjs;

async function scratch(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), '2dw03-ui-'));
  t.after(async () => { assert.match(path.basename(root), /^2dw03-ui-/); await fs.rm(root, { recursive: true, force: true }); });
  return root;
}

function session(paths = []) {
  let calls = 0;
  return createTaskSession({ base, pickReferences: async () => ({ canceled: false, filePaths: paths[calls++] ?? [] }) });
}

test('trusted session owns task identity across preview, new, and copy', async () => {
  const work = session([[fixture('content-01.png')]]);
  const first = work.taskInfo();
  assert.match(first.taskId, /^asset-[a-z0-9-]{8,64}$/);
  const selection = work.choices()[0];
  const values = { taskId: first.taskId, title: '石墙', description: '灰石墙', widthPx: 384, squareLocked: true };
  const original = await work.previewTask({ selection, values, revision: 1 });
  assert.equal(original.spec.taskId, first.taskId);
  await assert.rejects(work.previewTask({ selection, values: { ...values, taskId: 'forged-task' }, revision: 2 }), /任务 ID|身份/);
  const added = (await work.chooseReferences()).references;
  const copied = await work.beginTask({ copy: true });
  assert.notEqual(copied.taskId, first.taskId);
  assert.deepEqual(copied.references.map(ref => ref.token), added.map(ref => ref.token));
  await assert.rejects(work.exportTask({ revision: 1 }), /预览|过期/);
  const blank = await work.beginTask({ copy: false });
  assert.notEqual(blank.taskId, copied.taskId);
  assert.deepEqual(blank.references, []);
});

test('session exposes only trusted preset choices and descriptive form fields', () => {
  assert.equal(typeof createTaskSession, 'function', 'desktop task session is missing');
  const work = session();
  const choices = work.choices();
  assert.deepEqual(choices.map(choice => choice.seed.id), ['standalone-static-png', 'custom']);
  const form = work.describeForm({ selection: choices[0], values: { widthPx: 384, squareLocked: true } });
  assert.equal(form.fields.find(field => field.field === 'output.heightPx').defaultValue, 384);
  assert.equal(form.fields.find(field => field.field === 'output.heightPx').editable, false);
  assert.equal(form.fields.find(field => field.field === 'output.ppu').defaultValue, 100);
});

test('chosen PNGs have opaque tokens and editable roles without disclosing source paths', async () => {
  assert.equal(typeof createTaskSession, 'function', 'desktop task session is missing');
  const work = session([[fixture('content-01.png'), fixture('style-01.png')]]);
  const added = await work.chooseReferences();
  assert.equal(added.references.length, 2);
  assert.deepEqual(added.references.map(ref => ref.refId), ['ref-01', 'ref-02']);
  assert.ok(added.references.every(ref => ref.token && ref.widthPx > 0 && ref.heightPx > 0));
  assert.ok(added.references.every(ref => ref.thumbnailDataUrl.startsWith('data:image/png;base64,')));
  assert.ok(!JSON.stringify(added).includes(base));
  const updated = work.updateReference({ token: added.references[1].token, role: 'style', note: '色调', priority: 3 });
  assert.equal(updated.references[1].role, 'style');
  assert.equal(updated.references[1].note, '色调');
  assert.equal(updated.references[1].priority, 3);
  const cleared = work.updateReference({ token: added.references[1].token, priority: undefined });
  assert.equal(Object.hasOwn(cleared.references[1], 'priority'), false);
  const removed = work.removeReference({ token: added.references[0].token });
  assert.equal(removed.references.length, 1);
  assert.equal(removed.references[0].refId, 'ref-02');
});

test('same-named sources keep separate identities, while repeats and a ninth image are rejected', async t => {
  const root = await scratch(t);
  const files = [];
  for (let i = 0; i < 9; i++) {
    const folder = path.join(root, String(i));
    await fs.mkdir(folder);
    const source = path.join(folder, 'same.png');
    await fs.copyFile(fixture(i % 2 ? 'style-01.png' : 'content-01.png'), source);
    files.push(source);
  }
  let pick = 0;
  const batches = [[files[0], files[1]], [files[0]], files.slice(2, 8), [files[8]]];
  const work = createTaskSession({ base,
    pickReferences: async () => ({ canceled: false, filePaths: batches[pick++] }) });
  const first = (await work.chooseReferences()).references;
  assert.equal(first.length, 2);
  assert.deepEqual(first.map(ref => ref.sourceName), ['same.png', 'same.png']);
  assert.deepEqual(first.map(ref => ref.refId), ['ref-01', 'ref-02']);
  assert.notEqual(first[0].token, first[1].token);
  await assert.rejects(work.chooseReferences(), /已添加|重复/);
  assert.equal((await work.chooseReferences()).references.length, 8);
  await assert.rejects(work.chooseReferences(), /最多 8 张/);
});

test('removing and re-adding a reference produces only the final ordered identities', async () => {
  const work = session([[fixture('content-01.png'), fixture('style-01.png')], [fixture('content-01.png')]]);
  let refs = (await work.chooseReferences()).references;
  work.updateReference({ token: refs[1].token, role: 'style', note: '只参考配色' });
  work.removeReference({ token: refs[0].token });
  refs = (await work.chooseReferences()).references;
  assert.deepEqual(refs.map(ref => ref.refId), ['ref-02', 'ref-03']);
  assert.deepEqual(refs.map(ref => ref.role), ['style', 'content']);
  const result = await work.previewTask({ selection: work.choices()[0],
    values: { taskId: work.taskInfo().taskId, title: '重加参考图', widthPx: 384, squareLocked: true }, revision: 2 });
  assert.deepEqual(result.spec.references.map(ref => ref.refId).sort(), ['ref-02', 'ref-03']);
  assert.equal(result.entries.length, 16);
  assert.ok(result.entries.includes('style/project-style-contract.json'));
  assert.ok(result.entries.includes('style/project-style-contract.md'));
  assert.ok(result.entries.includes('style/task-style-delta.md'));
  assert.ok(result.entries.includes('workflow/recipe.json'));
  assert.equal(result.workflow.schemaVersion, '2dw-workflow/1');
  assert.ok(result.entries.includes('manifest.json'));
  assert.ok(result.entries.includes('references/style/ref-02.png'));
  assert.ok(result.entries.includes('references/content/ref-03.png'));
  assert.ok(!result.entries.some(entry => entry.includes('ref-01')));
});

test('a large reference gets a bounded PNG thumbnail while retaining its original dimensions', async t => {
  assert.equal(typeof createTaskSession, 'function', 'desktop task session is missing');
  const root = await scratch(t), source = path.join(root, 'large.png');
  const width = 512, height = 256, pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) { pixels[i] = (i / 4) % 256; pixels[i + 1] = 90; pixels[i + 2] = 180; pixels[i + 3] = 255; }
  await fs.writeFile(source, PNG.sync.write({ width, height, data: pixels }));
  const work = session([[source]]);
  const ref = (await work.chooseReferences()).references[0];
  const previewBytes = Buffer.from(ref.thumbnailDataUrl.slice('data:image/png;base64,'.length), 'base64');
  const thumbnail = PNG.sync.read(previewBytes);
  assert.equal(ref.widthPx, 512);
  assert.equal(ref.heightPx, 256);
  assert.ok(thumbnail.width <= 128 && thumbnail.height <= 128);
  assert.ok(previewBytes.length <= 100 * 1024);
});

test('adding individually valid PNGs rejects their combined pixel budget atomically', async t => {
  assert.equal(typeof createTaskSession, 'function', 'desktop task session is missing');
  const root = await scratch(t), image = PNG.sync.write({ width: 2900, height: 2900, data: Buffer.alloc(2900 * 2900 * 4) });
  const first = path.join(root, 'a.png'), second = path.join(root, 'b.png');
  await Promise.all([fs.writeFile(first, image), fs.writeFile(second, image)]);
  let calls = 0;
  const work = createTaskSession({ base, pickReferences: async () => calls++ === 0
    ? ({ canceled: false, filePaths: [first, second] }) : ({ canceled: true }) });
  await assert.rejects(work.chooseReferences(), /像素|预算|参考图/);
  assert.deepEqual((await work.chooseReferences()).references, []);
});

test('a preset refuses hidden custom requirements in both form and preview inputs', async () => {
  assert.equal(typeof createTaskSession, 'function', 'desktop task session is missing');
  const work = session();
  const selection = work.choices()[0];
  const values = { taskId: 'no-hidden-rules', title: '普通预设', widthPx: 384, squareLocked: true,
    requirements: { hard: ['隐藏硬要求'] } };
  assert.throws(() => work.describeForm({ selection, values }), /自定义|requirements/);
  await assert.rejects(work.previewTask({ selection, values, revision: 1 }), /自定义|requirements/);
});

test('concurrent reference pickers cannot create duplicate identities', async () => {
  assert.equal(typeof createTaskSession, 'function', 'desktop task session is missing');
  let release, calls = 0;
  const work = createTaskSession({ base,
    pickReferences: () => ++calls === 1
      ? new Promise(resolve => { release = () => resolve({ canceled: false, filePaths: [fixture('content-01.png')] }); })
      : Promise.resolve({ canceled: false, filePaths: [fixture('style-01.png')] }) });
  const first = work.chooseReferences();
  try { await assert.rejects(work.chooseReferences(), /正在|选择/); }
  finally { release(); }
  const result = await first;
  assert.deepEqual(result.references.map(ref => ref.refId), ['ref-01']);
});

test('top-level IPC payloads reject unrecognized paths and options', async () => {
  assert.equal(typeof createTaskSession, 'function', 'desktop task session is missing');
  const work = session([[fixture('content-01.png')]]);
  const selected = work.choices()[0];
  const values = { taskId: 'known-keys', title: '已知字段', widthPx: 384, squareLocked: true };
  assert.throws(() => work.describeForm({ selection: selected, values, sourcePath: fixture('content-01.png') }), /sourcePath|不支持/);
  await assert.rejects(work.previewTask({ selection: selected, values, revision: 1, outputDirectory: base }), /outputDirectory|不支持/);
  await assert.rejects(work.exportTask({ revision: 1, filePath: base }), /filePath|不支持/);
  const token = (await work.chooseReferences()).references[0].token;
  assert.throws(() => work.removeReference({ token, sourcePath: fixture('content-01.png') }), /sourcePath|不支持/);
});

test('reference change invalidates preview, while renderer paths and unknown fields are refused', async () => {
  assert.equal(typeof createTaskSession, 'function', 'desktop task session is missing');
  const work = session([[fixture('content-01.png')]]);
  const selection = work.choices()[0];
  const values = { taskId: work.taskInfo().taskId, title: '窗口任务', widthPx: 384, squareLocked: true };
  const preview = await work.previewTask({ selection, values, revision: 1 });
  assert.equal(preview.spec.output.worldWidth, 3.84);
  assert.equal(preview.spec.references.length, 0);
  assert.equal(preview.revision, 1);
  assert.match(preview.prompt, /384×384/);
  assert.ok(preview.entries.includes('spec/asset-spec.json'));
  await work.chooseReferences();
  await assert.rejects(work.exportTask({ revision: 1 }), /预览|更新|过期/);
  await assert.rejects(work.previewTask({ selection, values: { ...values, sourcePath: fixture('style-01.png') }, revision: 2 }), /sourcePath|不支持/);
  await assert.rejects(work.previewTask({ selection, values: { ...values, references: [] }, revision: 2 }), /references|不支持/);
  await assert.rejects(work.previewTask({ selection, values: { ...values, outputDirectory: base }, revision: 2 }), /outputDirectory|不支持/);
});

test('Electron preload exposes the preset session through guarded IPC', async () => {
  const desktop = await electron.launch({ executablePath: require('electron'), args: [base, '--test-hidden'], cwd: base, timeout: 20000 });
  try {
    const page = await desktop.firstWindow();
    const bridge = await page.evaluate(async () => {
      const choices = await window.assetWorkshop.choices();
      const form = await window.assetWorkshop.describeForm({ selection: choices[0], values: { widthPx: 384, squareLocked: true } });
      return { ids: choices.map(choice => choice.seed.id), height: form.fields.find(field => field.field === 'output.heightPx').defaultValue,
        pasteAvailable: typeof window.assetWorkshop.pasteReference === 'function' };
    });
    assert.deepEqual(bridge, { ids: ['standalone-static-png', 'custom'], height: 384, pasteAvailable: true });
    const denied = await page.evaluate(async () => {
      const selected = (await window.assetWorkshop.choices())[0];
      try {
        await window.assetWorkshop.describeForm({ selection: selected, values: { requirements: { hard: ['隐藏要求'] } } });
        return null;
      } catch (error) { return { code: error.code, field: error.field, message: error.message }; }
    });
    assert.equal(denied.code, 'mode-field');
    assert.equal(denied.field, 'requirements');
    assert.ok(!denied.message.includes(base));
  } finally { await desktop.close(); }
});
