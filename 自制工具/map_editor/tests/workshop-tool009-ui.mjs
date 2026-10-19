import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const temp = await fs.realpath(os.tmpdir());
const root = await fs.mkdtemp(path.join(temp, 'xh-tool009-project-'));
const profile = await fs.mkdtemp(path.join(temp, 'xh-tool009-profile-'));
const libraryRoot = await fs.mkdtemp(path.join(temp, 'xh-tool009-library-'));
const output = path.resolve('validation/tool009');
await fs.mkdir(output, { recursive: true });
async function readProjectWhen(predicate) {
  for (let n = 0; n < 100; n++) {
    const value = await fs.readFile(path.join(root, 'project.xhproject.json'), 'utf8').then(JSON.parse, () => null);
    if (value && predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error('项目文档未达到预期状态');
}
const app = await electron.launch({ args: process.env.XH_ELECTRON_EXECUTABLE ? ['--test-hidden'] : ['.', '--test-hidden'],
  env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
  executablePath: process.env.XH_ELECTRON_EXECUTABLE ?? 'node_modules/electron/dist/electron.exe' });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await app.evaluate(({ dialog }, directory) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
  }, root);
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  await page.locator('.project-browser-root').waitFor();
  await fs.mkdir(path.join(root, '手工文件夹'));
  await page.locator('#project-workspace .project-browser-toolbar').getByTitle('刷新目录').click();
  await page.locator('#project-workspace .project-browser-card').filter({ hasText: '手工文件夹' }).waitFor();
  await page.locator('#project-workspace .project-browser-tabs button').first().click({ button: 'right' });
  await page.getByRole('button', { name: '向右分屏' }).click();
  assert.equal(await page.locator('#project-workspace .project-browser-pane').count(), 2);
  await page.locator('#project-workspace .project-browser-pane').first()
    .locator('.project-browser-card[data-path="手工文件夹"]').dblclick();
  assert.match(await page.locator('#project-workspace .project-browser-pane').first()
    .locator('.project-browser-crumbs').innerText(), /项目\s+手工文件夹/);
  assert.equal(await page.locator('#project-workspace .project-browser-pane').nth(1)
    .locator('.project-browser-crumbs').innerText(), '项目');
  await page.screenshot({ path: path.join(output, 'project-1440.png') });
  await page.locator('#project-workspace .project-browser-tab').first().click({ button: 'right' });
  await page.getByRole('button', { name: '关闭画布' }).click();
  assert.equal(await page.locator('#project-workspace .project-browser-pane').count(), 1);
  await page.getByRole('button', { name: '新建资产' }).click();
  await page.locator('#module-name').waitFor();
  const canvas = await page.locator('#editview canvas').boundingBox();
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.locator('#module-root').fill('0.25,0,0');
  await page.getByRole('button', { name: '设置 Root' }).click();
  await page.getByRole('button', { name: '保存资产' }).click();
  await page.getByText('原生资产与试摆草稿已保存').waitFor();
  const project = JSON.parse(await fs.readFile(path.join(root, 'project.xhproject.json'), 'utf8'));
  const id = project.assets[0].assetId;
  const native = JSON.parse(await fs.readFile(path.join(root, project.assets[0].source), 'utf8'));
  assert.deepEqual(native.anchorM, [0.25, 0, 0]);
  await page.locator('#module-project-assets .project-browser-tree-item[data-path="assets"]').first().click();
  await page.locator(`#module-project-assets .project-browser-card[data-path="assets/${id}"]`).waitFor();
  const content = page.locator('#module-project-assets .project-browser-content').first();
  const beforeZoom = await content.evaluate((node) => node.style.getPropertyValue('--browser-card-size'));
  await content.hover();
  await page.keyboard.down('Alt'); await page.mouse.wheel(0, -120); await page.keyboard.up('Alt');
  assert.notEqual(await content.evaluate((node) => node.style.getPropertyValue('--browser-card-size')), beforeZoom);
  await page.screenshot({ path: path.join(output, 'module-1440.png') });
  await page.locator('[data-workspace="project"]').click();
  await page.getByRole('button', { name: '新建试摆场景' }).click();
  await page.getByRole('button', { name: '保存项目' }).click();
  const sceneProject = await readProjectWhen((value) => value.scenes.length === 1);
  await page.locator('.scene-entry').getByRole('button', { name: '试摆', exact: true }).click();
  await page.locator('#assembly-current-assets .project-browser-tree-item[data-path="assets"]').first().click();
  const asset = page.locator(`#assembly-current-assets .project-browser-card[data-path="assets/${id}"]`);
  await asset.waitFor();
  await asset.dragTo(page.locator('.workshop-bar'));
  assert.equal(await page.locator('#assembly-tree button').count(), 0);
  const viewport = await page.locator('#assembly-viewport').boundingBox();
  await asset.dragTo(page.locator('#assembly-viewport'), { targetPosition: { x: viewport.width / 2, y: viewport.height / 2 } });
  await page.locator('#assembly-tree button').waitFor();
  await page.getByRole('button', { name: '保存草稿' }).click();
  let scene;
  for (let n = 0; n < 100; n++) {
    scene = JSON.parse(await fs.readFile(path.join(root, sceneProject.scenes[0].source), 'utf8'));
    if (scene.instances.length === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(scene.instances.length, 1);
  assert.equal(scene.instances[0].assetId, id);
  assert.equal(scene.instances[0].positionM[0] % .25, native.anchorM[0] % .25);
  assert.equal(scene.instances[0].positionM.every((n) => Math.abs(n / .25 - Math.round(n / .25)) < 1e-6), true);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  assert.equal(await page.locator('#assembly-tree button').count(), 0);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  assert.equal(await page.locator('#assembly-tree button').count(), 1);
  await page.screenshot({ path: path.join(output, 'assembly-1440.png') });
  await fs.copyFile(path.join(root, project.assets[0].source), path.join(libraryRoot, `${id}.xhmodule.json`));
  await app.evaluate(({ dialog }, directory) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
  }, libraryRoot);
  await page.getByRole('button', { name: '公共库', exact: true }).click();
  await page.getByRole('button', { name: '选择公共库' }).click();
  const libraryCard = page.locator('#assembly-library .assembly-library-item').first();
  await libraryCard.waitFor();
  await libraryCard.dragTo(page.locator('#assembly-viewport'));
  const withLibrary = await readProjectWhen((value) => value.assets.length === 2);
  assert.equal(withLibrary.assets.filter((row) => row.origin?.libraryId === id).length, 1);
  await page.getByRole('button', { name: '保存草稿' }).click();
  await page.screenshot({ path: path.join(output, 'assembly-public-library.png') });
  await page.getByRole('button', { name: '项目资产库' }).click();
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.screenshot({ path: path.join(output, 'assembly-1000.png') });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ path: path.join(output, 'assembly-1920.png') });
  assert.deepEqual(errors, []);
  console.log('TOOL-009 Electron UI passed');
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(profile, { recursive: true, force: true });
  await fs.rm(libraryRoot, { recursive: true, force: true });
}
