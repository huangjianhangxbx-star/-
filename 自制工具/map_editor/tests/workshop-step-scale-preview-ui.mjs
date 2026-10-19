import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const project = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'xh-scale-preview-project-'));
const profile = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'xh-scale-preview-profile-'));
const app = await electron.launch({
  args: process.env.XH_ELECTRON_EXECUTABLE ? ['--test-hidden'] : ['.', '--test-hidden'],
  env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
  executablePath: process.env.XH_ELECTRON_EXECUTABLE ?? 'node_modules/electron/dist/electron.exe',
});
try {
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1440, height: 900 });
  await app.evaluate(({ dialog }, directory) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
  }, project);
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  await page.getByRole('button', { name: '新建资产', exact: true }).click();
  await page.getByLabel('笔刷范围 / 格', { exact: true }).fill('3');
  const edit = await page.locator('#editview canvas').boundingBox();
  await page.mouse.click(edit.x + edit.width / 2, edit.y + edit.height / 2);
  await page.getByText('体素 9', { exact: true }).waitFor();
  await page.locator('#quads').filter({ hasNotText: '更新中' }).waitFor();
  await page.locator('#home').click();
  await page.locator('#previewhome').click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(100);
  const original = await page.locator('#preview canvas').screenshot();
  if (process.env.XH_PREVIEW_EVIDENCE) await fs.writeFile(path.join(process.env.XH_PREVIEW_EVIDENCE, 'original.png'), original);
  await page.locator('#native-all').click();
  await page.keyboard.press('s');
  await page.locator('#step-scale-x').click();
  await page.locator('#step-scale-less').click();
  await page.locator('#step-scale-status').filter({ hasText: /3×3×1 → 1×3×1/ }).waitFor();
  assert.match(await page.locator('#count').innerText(), /体素 9/, 'preview must not mutate the source');
  await page.waitForTimeout(100);
  const predicted = await page.locator('#preview canvas').screenshot();
  if (process.env.XH_PREVIEW_EVIDENCE) {
    await fs.mkdir(process.env.XH_PREVIEW_EVIDENCE, { recursive: true });
    await page.screenshot({ path: path.join(process.env.XH_PREVIEW_EVIDENCE, 'shrink-before-confirm.png') });
  }
  assert.notEqual(Buffer.compare(predicted, original), 0, 'shrinking must visibly change the preview');
  await page.keyboard.press('Escape');
  await page.mouse.move(0, 0);
  await page.waitForTimeout(100);
  const canceled = await page.locator('#preview canvas').screenshot();
  if (process.env.XH_PREVIEW_EVIDENCE) await fs.writeFile(path.join(process.env.XH_PREVIEW_EVIDENCE, 'canceled.png'), canceled);
  assert.equal(Buffer.compare(canceled, original), 0, 'cancel must restore the original shape');
  await page.keyboard.press('s');
  await page.locator('#step-scale-x').click();
  await page.locator('#step-scale-less').click();
  await page.locator('#step-scale-status').filter({ hasText: /3×3×1 → 1×3×1/ }).waitFor();
  await page.locator('#step-scale-confirm').click();
  await page.getByText('体素 3', { exact: true }).waitFor();
  await page.locator('#quads').filter({ hasNotText: '更新中' }).waitFor();
  await page.waitForTimeout(100);
  const committed = await page.locator('#preview canvas').screenshot();
  assert.equal(Buffer.compare(predicted, committed), 0, 'module preview before confirm must show the final shrunken shape');
  console.log('step-scale shrink preview matches committed geometry');
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  await fs.rm(project, { recursive: true, force: true });
  await fs.rm(profile, { recursive: true, force: true });
}
