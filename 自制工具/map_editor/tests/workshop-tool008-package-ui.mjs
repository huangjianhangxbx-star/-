import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const release = path.resolve('release/星骸地图工坊-Workshop-M2.0');
const profile = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'xh-tool008-pack-profile-'));
assert.deepEqual(await fs.readFile(path.join(release, 'resources/app/desktop/workshop-recents.cjs')),
  await fs.readFile('desktop/workshop-recents.cjs'));
for (const file of ['workshop-v2-store.cjs', 'workshop-v2-export.cjs', 'workshop.js']) {
  assert.deepEqual(await fs.readFile(path.join(release, 'resources/app/desktop', file)),
    await fs.readFile(path.join('desktop', file)));
}
const app = await electron.launch({ executablePath: path.join(release, '星骸地图工坊.exe'), args: ['--test-hidden'], env: { ...process.env, XINGHAI_TEST_PROFILE: profile } });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('heading', { name: '项目与资产' }).waitFor();
  await page.getByText('最近项目 · 0').waitFor();
  const projectRoot = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'xh-tool008-pack-project-'));
  try {
    await app.evaluate(({ dialog }, directory) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
    }, projectRoot);
    await page.getByRole('button', { name: '新建项目', exact: true }).click();
    await page.getByRole('button', { name: '新建资产' }).waitFor();
    const project = JSON.parse(await fs.readFile(path.join(projectRoot, 'project.xhproject.json'), 'utf8'));
    assert.equal(project.schema, 'xinghai-workshop-project-2');
    assert.equal(project.name, path.basename(projectRoot));
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
  assert.deepEqual(errors, []);
  await fs.mkdir('validation/tool008', { recursive: true });
  await page.screenshot({ path: 'validation/tool008/package-home.png' });
  console.log('TOOL-008 packaged EXE launched');
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  await fs.rm(profile, { recursive: true, force: true });
}
