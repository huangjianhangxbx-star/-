const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createRecentProjects } = require('../desktop/workshop-recents.cjs');

test('recent projects remember successful opens, deduplicate, and bound history', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'xh-recents-'));
  try {
    const history = createRecentProjects(path.join(temp, 'recent.json'));
    for (let i = 0; i < 14; i++) await history.record(path.join(temp, `project-${i}`), `Project ${i}`);
    await history.record(path.join(temp, 'project-5'), 'Renamed');
    const rows = await history.list();
    assert.equal(rows.length, 12);
    assert.equal(rows[0].name, 'Renamed');
    assert.equal(rows[0].root, path.join(temp, 'project-5'));
    assert.equal(rows.filter((row) => row.root === rows[0].root).length, 1);
    assert.equal(await history.resolve(rows[0].id), rows[0].root);
    await assert.rejects(() => history.resolve('unknown'));
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});

test('corrupt history is ignored and renderer cannot choose an arbitrary path', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'xh-recents-'));
  try {
    const file = path.join(temp, 'recent.json');
    await fs.writeFile(file, '{oops');
    const history = createRecentProjects(file);
    assert.deepEqual(await history.list(), []);
    await assert.rejects(() => history.resolve(path.join(temp, 'secret')));
    await history.record(path.join(temp, 'safe'), 'Safe');
    assert.equal((await history.list()).length, 1);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
