import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { createTaskSession } = require('../desktop/task-session.cjs');
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pickReferences = async () => ({ canceled: true });
const selection = {
  mode: 'preset', seed: { id: 'standalone-static-png', version: '1' },
  purpose: { id: 'generic-asset', version: '1' }, structure: { id: 'standalone-static-png', version: '1' },
  operation: { id: 'create-new', version: '1' }, style: { id: 'project-neutral', version: '1' },
  adapter: { id: 'codex', version: '1' },
};

test('project style default persists separately from task delta and survives reopening', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), '2dw05a-default-'));
  t.after(async () => { await fs.rm(directory, { recursive: true, force: true }); });
  const styleConfigPath = path.join(directory, 'style.json');
  const first = createTaskSession({ base, pickReferences, styleConfigPath });
  const defaultStyle = first.taskInfo().projectStyleDefault;
  assert.equal(defaultStyle.toneBudget.darkMaxTiers, 3);
  const custom = { ...defaultStyle, name: '本地项目风格', positiveRules: ['黑块组织体积'] };
  assert.deepEqual((await first.saveProjectStyleContract(custom)).projectStyleDefault, custom);
  const saved = JSON.parse(await fs.readFile(styleConfigPath, 'utf8'));
  assert.deepEqual(saved, custom);
  first.dispose();
  const second = createTaskSession({ base, pickReferences, styleConfigPath });
  assert.deepEqual(second.taskInfo().projectStyleDefault, custom);
  const result = await second.previewTask({ selection, revision: 1,
    values: { taskId: second.taskInfo().taskId, title: '局部砖块', widthPx: 256, squareLocked: true,
      taskStyleDelta: { schemaVersion: '2dw-task-style-delta/1', focus: '中间砖', mustPreserve: [], mustChange: ['减少细节'], localReferenceNote: '', avoid: [] } } });
  assert.deepEqual(result.spec.projectStyleContract, custom);
  assert.equal(result.spec.taskStyleDelta.focus, '中间砖');
  second.dispose();
});

test('invalid new default does not overwrite the persisted project style', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), '2dw05a-default-'));
  t.after(async () => { await fs.rm(directory, { recursive: true, force: true }); });
  const styleConfigPath = path.join(directory, 'style.json');
  const session = createTaskSession({ base, pickReferences, styleConfigPath });
  const valid = session.taskInfo().projectStyleDefault;
  await session.saveProjectStyleContract(valid);
  const before = await fs.readFile(styleConfigPath);
  await assert.rejects(session.saveProjectStyleContract({ ...valid, toneBudget: { darkMaxTiers: 0, lightMaxTiers: 3 } }),
    error => error?.field === 'projectStyleContract.toneBudget.darkMaxTiers');
  assert.deepEqual(await fs.readFile(styleConfigPath), before);
  session.dispose();
});

test('a damaged persisted default opens with a visible recovery warning and preserves the file', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), '2dw05a-default-'));
  t.after(async () => { await fs.rm(directory, { recursive: true, force: true }); });
  const styleConfigPath = path.join(directory, 'style.json');
  const damaged = Buffer.from('{"schemaVersion":"2dw-project-style/1",');
  await fs.writeFile(styleConfigPath, damaged);
  const session = createTaskSession({ base, pickReferences, styleConfigPath });
  assert.match(session.taskInfo().projectStyleWarning, /无效|无法读取/);
  assert.equal(session.taskInfo().projectStyleDefault.toneBudget.darkMaxTiers, 3);
  assert.deepEqual(await fs.readFile(styleConfigPath), damaged);
  session.dispose();
});

test('startup removes only abandoned clipboard staging directories', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), '2dw05a-clipboard-cache-'));
  t.after(async () => { await fs.rm(directory, { recursive: true, force: true }); });
  const stale = path.join(directory, 'session-2147483000-dead');
  const active = path.join(directory, `session-${process.pid}-active`);
  const unrelated = path.join(directory, 'user-kept');
  for (const item of [stale, active, unrelated]) {
    await fs.mkdir(item); await fs.writeFile(path.join(item, 'image.png'), 'x');
  }
  const session = createTaskSession({ base, pickReferences, clipboardDirectory: directory });
  assert.equal(await fs.stat(stale).then(() => true, () => false), false);
  assert.equal(await fs.stat(active).then(() => true, () => false), true);
  assert.equal(await fs.stat(unrelated).then(() => true, () => false), true);
  session.dispose();
});
