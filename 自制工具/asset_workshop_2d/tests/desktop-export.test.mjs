import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const require = createRequire(import.meta.url);
let createTaskSession;
try { ({ createTaskSession } = require('../desktop/task-session.cjs')); } catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}
const { validateZip } = require('../archive/export-zip.cjs');
const archive = require('../archive/export-zip.cjs');
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(base, 'tests', 'fixtures', 'content-01.png');
const values = work => ({ taskId: work.taskInfo().taskId, title: '窗口任务', widthPx: 512, heightPx: 256, squareLocked: false, ppu: 200 });

async function scratch(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), '2dw03-export-'));
  t.after(async () => { assert.match(path.basename(root), /^2dw03-export-/); await fs.rm(root, { recursive: true, force: true }); });
  return root;
}

test('a previewed task exports a verified ZIP with original reference bytes and no target image', async t => {
  assert.equal(typeof createTaskSession, 'function', 'desktop task session is missing');
  const root = await scratch(t), target = path.join(root, 'task.zip');
  const work = createTaskSession({ base,
    pickReferences: async () => ({ canceled: false, filePaths: [fixture] }),
    pickExportPath: async () => ({ canceled: false, filePath: target }) });
  const selected = (await work.chooseReferences()).references[0];
  work.updateReference({ token: selected.token, role: 'style', note: '人工配色说明', priority: 2 });
  const preview = await work.previewTask({ selection: work.choices()[0], values: values(work), revision: 7 });
  assert.equal(preview.spec.references[0].role, 'style');
  const result = await work.exportTask({ revision: 7 });
  assert.equal(result.path, target);
  const bytes = await fs.readFile(target);
  const checked = validateZip(bytes);
  assert.equal(checked.spec.output.worldWidth, 2.56);
  assert.equal(checked.spec.output.worldHeight, 1.28);
  assert.equal(checked.spec.references[0].note, '人工配色说明');
  assert.equal(checked.spec.references[0].priority, 2);
  assert.equal(checked.spec.references[0].sourceName, 'content-01.png');
  assert.ok(!checked.entries.some(entry => entry.path === 'output/asset.png'));
  assert.deepEqual(Buffer.from(unzipSync(bytes)['references/style/ref-01.png']), await fs.readFile(fixture));
  assert.equal(result.sha256.length, 64);
});

test('export rejects an altered source and leaves no ZIP', async t => {
  assert.equal(typeof createTaskSession, 'function', 'desktop task session is missing');
  const root = await scratch(t), source = path.join(root, 'selected.png'), target = path.join(root, 'changed.zip');
  await fs.copyFile(fixture, source);
  const work = createTaskSession({ base,
    pickReferences: async () => ({ canceled: false, filePaths: [source] }),
    pickExportPath: async () => ({ canceled: false, filePath: target }) });
  await work.chooseReferences();
  await work.previewTask({ selection: work.choices()[0], values: values(work), revision: 1 });
  await fs.copyFile(path.join(base, 'tests', 'fixtures', 'style-01.png'), source);
  await assert.rejects(work.exportTask({ revision: 1 }), /参考图|变化/);
  await assert.rejects(fs.stat(target), { code: 'ENOENT' });
  await fs.copyFile(fixture, source);
  await assert.rejects(work.exportTask({ revision: 1 }), /预览|过期/);
  await assert.rejects(fs.stat(target), { code: 'ENOENT' });
});

test('preview refuses a source whose pixels changed after selection', async t => {
  assert.equal(typeof createTaskSession, 'function', 'desktop task session is missing');
  const root = await scratch(t), source = path.join(root, 'selected.png');
  await fs.copyFile(fixture, source);
  const work = createTaskSession({ base,
    pickReferences: async () => ({ canceled: false, filePaths: [source] }) });
  await work.chooseReferences();
  await fs.copyFile(path.join(base, 'tests', 'fixtures', 'style-01.png'), source);
  await assert.rejects(work.previewTask({ selection: work.choices()[0], values: values(work), revision: 1 }), /参考图|变化/);
});

test('deleted selected PNG blocks export without writing a ZIP', async t => {
  const root = await scratch(t), source = path.join(root, 'selected.png'), target = path.join(root, 'missing-source.zip');
  await fs.copyFile(fixture, source);
  const work = createTaskSession({ base,
    pickReferences: async () => ({ canceled: false, filePaths: [source] }),
    pickExportPath: async () => ({ canceled: false, filePath: target }) });
  await work.chooseReferences();
  await work.previewTask({ selection: work.choices()[0], values: values(work), revision: 3 });
  await fs.unlink(source);
  await assert.rejects(work.exportTask({ revision: 3 }), /参考图|变化/);
  await assert.rejects(fs.stat(target), { code: 'ENOENT' });
});

test('save cancellation and existing ZIP preserve both preview and existing bytes', async t => {
  assert.equal(typeof createTaskSession, 'function', 'desktop task session is missing');
  const root = await scratch(t), target = path.join(root, 'existing.zip');
  await fs.writeFile(target, 'previous bytes');
  let canceled = true;
  const work = createTaskSession({ base, pickReferences: async () => ({ canceled: true }),
    pickExportPath: async () => canceled ? ({ canceled: true }) : ({ canceled: false, filePath: target }) });
  await work.previewTask({ selection: work.choices()[0], values: values(work), revision: 'preview-a' });
  assert.equal((await work.exportTask({ revision: 'preview-a' })).cancelled, true);
  canceled = false;
  await assert.rejects(work.exportTask({ revision: 'preview-a' }), /已存在|覆盖/);
  assert.equal(await fs.readFile(target, 'utf8'), 'previous bytes');
});

test('copy revalidates source PNG bytes before issuing a new task identity', async t => {
  const root = await scratch(t), source = path.join(root, 'selected.png');
  await fs.copyFile(fixture, source);
  const work = createTaskSession({ base,
    pickReferences: async () => ({ canceled: false, filePaths: [source] }) });
  const chosen = (await work.chooseReferences()).references[0];
  work.updateReference({ token: chosen.token, role: 'style', note: '复制保留的配色说明', priority: 2 });
  const before = work.taskInfo();
  await fs.copyFile(path.join(base, 'tests', 'fixtures', 'style-01.png'), source);
  await assert.rejects(work.beginTask({ copy: true }), /参考图|变化/);
  assert.equal(work.taskInfo().taskId, before.taskId);
  assert.deepEqual(work.taskInfo().references, before.references);
  await fs.copyFile(fixture, source);
  const copied = await work.beginTask({ copy: true });
  assert.notEqual(copied.taskId, before.taskId);
  assert.deepEqual(copied.references, before.references);
  await fs.copyFile(path.join(base, 'tests', 'fixtures', 'style-01.png'), source);
  await assert.rejects(work.previewTask({ selection: work.choices()[0],
    values: { ...values(work), taskId: copied.taskId }, revision: 1 }), /参考图|变化/);
});

test('suggested save name is Windows-safe for reserved, punctuated, and long titles', async () => {
  const names = [];
  const work = createTaskSession({ base, pickReferences: async () => ({ canceled: true }),
    pickExportPath: async ({ defaultFileName }) => {
      names.push(defaultFileName);
      return { canceled: true };
    } });
  for (const title of ['CON', '中文石墙:/\\?*"<>|', '很长的素材'.repeat(12)]) {
    const taskId = work.taskInfo().taskId;
    await work.previewTask({ selection: work.choices()[0],
      values: { taskId, title, description: '自制静态素材', widthPx: 384, squareLocked: true }, revision: 1 });
    assert.equal((await work.exportTask({ revision: 1 })).cancelled, true);
    await work.beginTask({ copy: false });
  }
  assert.equal(names.length, 3);
  for (const name of names) {
    assert.match(name, /_384x384_asset-[a-z0-9-]+\.zip$/);
    assert.doesNotMatch(name, /[<>:"/\\|?*\x00-\x1f\x7f]/);
    assert.ok(Array.from(name).length <= 100);
  }
  assert.match(names[0], /^任务-CON_/);
});

test('an older overlapping preview cannot replace a newer one during the save dialog', async t => {
  const root = await scratch(t), target = path.join(root, 'latest.zip');
  const originalRead = archive.readReferenceFacts;
  let firstRead = true, releaseRead, releaseSave;
  archive.readReferenceFacts = async inputs => {
    if (firstRead) {
      firstRead = false;
      await new Promise(resolve => { releaseRead = resolve; });
    }
    return originalRead(inputs);
  };
  try {
    const work = createTaskSession({ base, pickReferences: async () => ({ canceled: true }),
      pickExportPath: () => new Promise(resolve => { releaseSave = () => resolve({ canceled: false, filePath: target }); }) });
    const selection = work.choices()[0], taskId = work.taskInfo().taskId;
    const fields = { taskId, title: '并发预览', widthPx: 384, squareLocked: true };
    const older = work.previewTask({ selection, values: { ...fields, description: '旧内容' }, revision: 7 });
    const newer = await work.previewTask({ selection, values: { ...fields, description: '新内容' }, revision: 7 });
    assert.equal(newer.spec.description, '新内容');
    const exporting = work.exportTask({ revision: 7 });
    releaseRead();
    await assert.rejects(older, /过期|重新预览/);
    releaseSave();
    const result = await exporting;
    assert.equal(validateZip(await fs.readFile(result.path)).spec.description, '新内容');
  } finally { archive.readReferenceFacts = originalRead; }
});
