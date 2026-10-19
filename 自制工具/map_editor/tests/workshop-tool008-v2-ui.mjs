import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'xh-tool008-v2-'));
const profile = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'xh-tool008-v2-profile-'));
let copyParent = null;
async function waitProject(predicate) {
  const file = path.join(root, 'project.xhproject.json');
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await fs.readFile(file, 'utf8').then(JSON.parse, () => null);
    if (value && predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error('项目文件未达到预期状态');
}
async function waitScene(source, predicate) {
  const file = path.join(root, source);
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await fs.readFile(file, 'utf8').then(JSON.parse, () => null);
    if (value && predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error('场景未达到预期状态');
}
const app = await electron.launch({ args: ['.', '--test-hidden'],
  env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
  executablePath: process.env.XH_ELECTRON_EXECUTABLE ?? 'node_modules/electron/dist/electron.exe' });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await app.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] }); }, root);
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  await page.locator('.project-location').waitFor();
  assert.equal((await page.locator('.project-location').textContent()).includes(root), true);
  assert.equal(await page.locator('.project-location code').isVisible(), true);
  await page.getByRole('button', { name: '新建资产' }).waitFor();
  await page.getByRole('button', { name: '新建资产' }).click();
  await page.locator('#module-name').waitFor();
  assert.match(await page.locator('#module-name').inputValue(), /^新资产/);
  assert.equal(await page.locator('#app #choose').isVisible(), false);
  await page.locator('#module-project-assets .project-asset-root').getByText(root, { exact: true }).waitFor();
  await page.locator('#module-project-assets .project-asset-tile').click({ button: 'right' });
  assert.equal(await page.getByRole('menuitem', { name: '在文件管理器中定位' }).isDisabled(), true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '保存文件夹：默认' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: '项目内分类文件夹' }).fill('墓穴');
  await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
  const view = await page.locator('#editview canvas').boundingBox();
  await page.mouse.click(view.x + view.width / 2, view.y + view.height / 2);
  await page.getByText('体素 1', { exact: true }).waitFor();
  await page.getByRole('button', { name: '保存资产' }).click();
  await page.getByText('原生资产与试摆草稿已保存').waitFor();
  await fs.mkdir(path.join(root, 'assets', 'sss'));
  await fs.writeFile(path.join(root, 'assets', 'sss', 'reference.txt'), 'external note');
  await page.getByRole('button', { name: '刷新资产目录' }).click();
  await page.locator('#module-project-assets').getByRole('button', { name: '文件夹 sss' }).waitFor();
  await page.locator('#module-project-assets').getByRole('button', { name: '文件夹 墓穴' }).click();
  const project = await waitProject((value) => value.assets.length === 1);
  assert.equal(project.schema, 'xinghai-workshop-project-2');
  assert.equal(project.assets.length, 1);
  assert.equal(project.assets[0].source, `assets/墓穴/${project.assets[0].assetId}/asset.xhmodule.json`);
  assert.equal(await fs.stat(path.join(root, project.assets[0].source)).then((s) => s.isFile()), true);
  assert.equal(project.assets[0].preview.revision, project.assets[0].revision);
  assert.equal(await fs.stat(path.join(root, project.assets[0].preview.source)).then((s) => s.isFile()), true);
  await page.locator('#module-project-assets .project-asset-tile img').waitFor();
  assert.match(await page.locator('.module-asset-location').innerText(), /assets[\\/]墓穴[\\/].*asset\.xhmodule\.json/);
  await app.evaluate(({ shell }) => { globalThis.__locatedAsset = null; shell.showItemInFolder = (file) => { globalThis.__locatedAsset = file; }; });
  await page.locator('#module-project-assets .project-asset-tile').click({ button: 'right' });
  await fs.mkdir('validation/tool008', { recursive: true });
  await page.screenshot({ path: 'validation/tool008/asset-context-menu.png' });
  await page.getByRole('menuitem', { name: '在文件管理器中定位' }).click({ timeout: 3000 });
  await page.getByText('已定位原生资产：').waitFor();
  assert.equal(await app.evaluate(() => globalThis.__locatedAsset), path.join(root, project.assets[0].source));
  await assert.rejects(page.evaluate(() => window.workbench.workshop.v2LocateAsset('invalid', '../outside')), /项目会话已失效/);
  await fs.mkdir('validation/tool008', { recursive: true });
  await page.screenshot({ path: 'validation/tool008/module-project-assets.png' });
  await page.getByRole('button', { name: '导出 FBX…' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'FBX 文件名' }).fill('石柱导出');
  await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
  await page.getByText('FBX 已导出').waitFor();
  assert.equal(await fs.stat(path.join(root, '石柱导出', '石柱导出.fbx')).then((s) => s.isFile()), true);
  const firstFbx = await fs.readFile(path.join(root, '石柱导出', '石柱导出.fbx'));
  await page.getByRole('button', { name: '导出 FBX…' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'FBX 文件名' }).fill('石柱导出');
  await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '备份并覆盖' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.locator('#module-export-result').getByText(/旧版备份：/).waitFor();
  const backup = (await fs.readdir(root)).find((entry) => entry.startsWith('石柱导出.backup-'));
  assert.ok(backup);
  assert.deepEqual(await fs.readFile(path.join(root, backup, '石柱导出.fbx')), firstFbx);
  assert.equal(await fs.stat(path.join(root, 'releases')).then(() => true, () => false), false);
  await page.locator('[data-workspace="project"]').click();
  await page.getByRole('button', { name: '返回 assets' }).click();
  await page.getByRole('button', { name: '文件夹 sss' }).waitFor();
  await page.getByRole('button', { name: '文件夹 sss' }).click();
  await page.getByText('▤ reference.txt').waitFor();
  await page.getByRole('button', { name: '返回 assets' }).click();
  await page.getByRole('button', { name: '文件夹 墓穴' }).click();
  await page.locator('.module-card').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: '在文件管理器中定位' }).click();
  await page.getByText('已定位原生资产：').waitFor();
  assert.equal(await app.evaluate(() => globalThis.__locatedAsset), path.join(root, project.assets[0].source));
  await page.getByRole('button', { name: '新建试摆场景' }).click();
  await page.getByRole('button', { name: '保存项目' }).click();
  await page.getByText('原生资产与试摆草稿已保存').waitFor();
  const updated = await waitProject((value) => value.scenes.length === 1);
  assert.equal(updated.scenes.length, 1);
  const scene = JSON.parse(await fs.readFile(path.join(root, updated.scenes[0].source), 'utf8'));
  assert.equal(scene.schema, 'xinghai-workshop-scene-2');
  assert.equal(scene.assets, undefined);
  await page.locator('.scene-entry').getByRole('button', { name: '试摆', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '项目资产库' }).getAttribute('aria-pressed'), 'true');
  await page.locator('#assembly-current-assets .assembly-asset-card img').waitFor();
  await page.screenshot({ path: 'validation/tool008/assembly-project-assets.png' });
  await page.getByRole('button', { name: '放入模块' }).click();
  await page.getByRole('button', { name: '保存草稿' }).click();
  await page.getByText('原生资产与试摆草稿已保存').waitFor();
  const placed = await waitScene(updated.scenes[0].source, (value) => value.instances.length === 1)
    .catch(async (error) => { console.log('PLACE DIAGNOSTIC', await page.locator('#workshop-message').textContent(), errors); throw error; });
  assert.equal(placed.instances.length, 1);
  assert.equal(placed.instances[0].assetId, project.assets[0].assetId);
  await page.getByRole('button', { name: '将实例另存为独立资产' }).click();
  const independentProject = await waitProject((value) => value.assets.length === 2).catch(async (error) => {
    console.log('INDEPENDENT DIAGNOSTIC', await page.locator('#workshop-message').textContent(), errors);
    throw error;
  });
  const independentScene = await waitScene(updated.scenes[0].source,
    (value) => value.instances[0].assetId !== project.assets[0].assetId);
  assert.equal(independentScene.instances[0].instanceId, placed.instances[0].instanceId);
  assert.equal(independentProject.assets.length, 2);
  assert.equal(independentProject.assets.find((row) => row.assetId === independentScene.instances[0].assetId).preview.revision, 0);
  await page.getByText('所选实例已指向新的独立项目资产').waitFor();
  await page.locator('[data-workspace="project"]').click();
  assert.equal(await page.locator('.module-card').first().getByRole('button', { name: '导出 FBX' }).count(), 1);
  await page.locator('.module-card').filter({ hasText: '独立' }).locator('summary').click();
  await page.locator('.module-card').filter({ hasText: '独立' }).getByRole('button', { name: '移入回收区' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认移入回收区' }).click();
  await waitProject((value) => value.assets.length === 1);
  await page.getByText('资产已移入回收区', { exact: true }).waitFor();
  await page.locator('.project-trash summary').click();
  await page.locator('.trash-entry').getByRole('button', { name: '恢复' }).click();
  await waitProject((value) => value.assets.length === 2);
  await page.locator('.module-card').filter({ hasText: '独立' }).waitFor();
  await page.locator('.scene-entry').getByRole('button', { name: '移入回收区' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认移入回收区' }).click();
  await waitProject((value) => value.scenes.length === 0).catch(async (error) => {
    console.log('SCENE TRASH DIAGNOSTIC', await page.locator('#workshop-message').textContent(), errors);
    throw error;
  });
  await page.locator('.scene-entry').waitFor({ state: 'detached' });
  await page.locator('.project-trash summary').click();
  await page.locator('.trash-entry').getByRole('button', { name: '恢复' }).click();
  await waitProject((value) => value.scenes.length === 1);
  await page.locator('.scene-entry').waitFor();
  await page.locator('.scene-entry').getByRole('button', { name: '另存场景' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: '新试摆场景名称' }).fill('第二试摆');
  await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
  const copiedProject = await waitProject((value) => value.scenes.length === 2);
  assert.equal(copiedProject.assets.length, 2);
  await page.locator('.scene-entry').filter({ hasText: '第二试摆' }).waitFor();
  await page.locator('.module-card').filter({ has: page.locator('h3').getByText('新资产 01', { exact: true }) })
    .locator('summary').click();
  await page.locator('.module-card').filter({ has: page.locator('h3').getByText('新资产 01', { exact: true }) })
    .getByRole('button', { name: '另存为新资产' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: '新资产名称' }).fill('石柱备用');
  await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: '项目内分类文件夹' }).fill('sss/装饰');
  await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
  const copiedAssetProject = await waitProject((value) => value.assets.length === 3);
  assert.equal(copiedAssetProject.assets.find((row) => row.name === '石柱备用').source.includes('/sss/装饰/'), true);
  assert.equal(copiedAssetProject.scenes.length, 2);
  await page.getByText('已另存为新的项目资产；原资产未被覆盖').waitFor();
  const libraryRoot = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'xh-tool008-library-'));
  try {
    const libraryAsset = copiedAssetProject.assets.find((row) => row.name === '新资产 01');
    await fs.copyFile(path.join(root, libraryAsset.source),
      path.join(libraryRoot, `${libraryAsset.assetId}.xhmodule.json`));
    await page.locator('[data-workspace="project"]').click();
    await page.locator('.scene-entry').first().getByRole('button', { name: '试摆', exact: true }).click({ timeout: 5000 }).catch(async (error) => {
      console.log('SCENE ENTRY DIAGNOSTIC', await page.locator('#workshop-message').textContent(),
        await page.locator('#project-workspace').innerText(), errors);
      throw error;
    });
    await app.evaluate(({ dialog }, directory) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
    }, libraryRoot);
    await page.getByRole('button', { name: '公共库', exact: true }).click();
    await page.getByText('公共库 · 复制为项目资产').waitFor();
    assert.equal(await page.locator('#assembly-import').isVisible(), false);
    await page.getByRole('button', { name: '选择公共库' }).click();
    const item = page.locator('#assembly-library .assembly-library-item').first();
    await item.waitFor();
    await item.dragTo(page.locator('#assembly-viewport'));
    const afterImport = await waitProject((value) => value.assets.length === 4);
    assert.equal(afterImport.assets.filter((row) => row.origin?.libraryId === libraryAsset.assetId).length, 1);
    await page.waitForFunction(() => document.querySelectorAll('#assembly-tree button').length === 2);
    await page.getByRole('button', { name: '保存草稿' }).click();
    await waitScene(copiedProject.scenes[0].source, (value) => value.instances.length === 2);
    await item.dragTo(page.locator('#assembly-viewport'));
    await page.waitForFunction(() => document.querySelectorAll('#assembly-tree button').length === 3);
    await page.getByRole('button', { name: '保存草稿' }).click();
    const repeated = await waitScene(copiedProject.scenes[0].source, (value) => value.instances.length === 3);
    assert.equal(repeated.instances[1].assetId, repeated.instances[2].assetId);
    assert.equal((await waitProject((value) => value.assets.length === 4)).assets.length, 4);
  } finally {
    await fs.rm(libraryRoot, { recursive: true, force: true });
  }
  await page.locator('[data-workspace="project"]').click();
  assert.equal(await page.locator('.project-location code').textContent(), root);
  await fs.mkdir('validation/tool008', { recursive: true });
  await page.screenshot({ path: 'validation/tool008/project-v2.png' });
  for (const [width, height] of [[1440, 900], [1000, 700], [1920, 1080]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [width, height]);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `validation/tool008/project-v2-${width}.png` });
  }
  await page.reload();
  if (!(await page.locator('.recent-projects').evaluate((element) => element.open)))
    await page.locator('.recent-projects summary').click();
  await page.locator('.recent-project').getByRole('button', { name: '打开', exact: true }).click();
  await page.locator('.module-card').first().waitFor();
  assert.equal(await page.locator('.module-card').count(), 1);
  await page.getByRole('button', { name: '文件夹 墓穴' }).click();
  assert.equal(await page.locator('.module-card').count(), 2);
  await page.getByRole('button', { name: '返回 assets' }).click();
  await page.getByRole('button', { name: '文件夹 sss' }).click();
  await page.getByRole('button', { name: '文件夹 装饰' }).click();
  assert.equal(await page.locator('.module-card').count(), 1);
  copyParent = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'xh-tool008-project-copy-'));
    await app.evaluate(({ dialog }, directory) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
    }, copyParent);
    await page.getByRole('button', { name: '另存项目副本' }).click();
    await page.getByRole('dialog').getByRole('textbox', { name: '副本目录及项目名称' }).fill('墓穴资产副本');
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
    await page.locator('.project-location').filter({ hasText: '墓穴资产副本' }).waitFor();
    const duplicate = JSON.parse(await fs.readFile(path.join(copyParent, '墓穴资产副本', 'project.xhproject.json'), 'utf8'));
    assert.notEqual(duplicate.projectId, copiedAssetProject.projectId);
    assert.equal(duplicate.assets.length, 4);
  assert.deepEqual(errors, []);
  console.log('TOOL-008 v2 Electron flow passed');
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  if (copyParent) await fs.rm(copyParent, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(profile, { recursive: true, force: true });
}
