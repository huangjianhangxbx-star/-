import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { validateZip } = require('../archive/export-zip.cjs');
const { unzipSync } = require('fflate');
const evidenceRoot = path.join(base, 'validation', '2dw05');
await fs.mkdir(evidenceRoot, { recursive: true });
const evidence = await fs.mkdtemp(path.join(evidenceRoot, 'ui-'));
const content = path.join(base, 'tests', 'fixtures', 'content-01.png');
const style = path.join(base, 'tests', 'fixtures', 'style-01.png');
const sourceBytes = [await fs.readFile(content), await fs.readFile(style)];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
let app;
let requests = 0;
const server = http.createServer((_request, response) => { requests++; response.end('unexpected network'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

async function setDialog(openPaths, savePath) {
  await app.evaluate(({ dialog }, values) => {
    dialog.showOpenDialog = async () => values.openPaths === null
      ? { canceled: true, filePaths: [] } : { canceled: false, filePaths: values.openPaths };
    dialog.showSaveDialog = async () => values.savePath === null
      ? { canceled: true, filePath: undefined } : { canceled: false, filePath: values.savePath };
  }, { openPaths, savePath });
}

async function ready(page) {
  await page.locator('#preview-task').click();
  await page.waitForSelector('#status[data-state="ready"]');
  return JSON.parse(await page.locator('#spec-preview').textContent());
}

async function savedZip(page, destination) {
  await page.locator('#export-task').click();
  await page.waitForSelector('#status[data-state="exported"]');
  const bytes = await fs.readFile(destination);
  const checked = validateZip(bytes);
  const files = unzipSync(bytes);
  assert.equal(checked.spec.schemaVersion, '1.1.0');
  assert.equal(checked.manifest.schemaVersion, '2dw-zip/2');
  assert.equal(checked.manifest.workflowRecipeVersion, '2dw-workflow/1');
  assert.equal(checked.entries.length, 11 + checked.spec.references.length);
  assert.ok(checked.entries.every(entry => !entry.path.startsWith('output/') && !entry.path.startsWith('reports/')));
  assert.deepEqual(checked.manifest.entries.map(entry => entry.path).sort(), Object.keys(files).filter(name => name !== 'manifest.json').sort());
  for (const entry of checked.manifest.entries) {
    assert.equal(entry.byteLength, files[entry.path].length);
    assert.equal(entry.sha256, sha256(files[entry.path]));
  }
  assert.ok(checked.spec.references.every(reference => !Object.hasOwn(reference, 'sourcePath')));
  assert.deepEqual(JSON.parse(Buffer.from(files['spec/asset-spec.json']).toString('utf8')), checked.spec);
  const recipe = JSON.parse(Buffer.from(files['workflow/recipe.json']).toString('utf8'));
  assert.equal(recipe.taskId, checked.spec.taskId);
  assert.equal(recipe.steps[1].active, checked.spec.references.some(reference => reference.role === 'content'));
  assert.equal(recipe.steps[2].active, checked.spec.references.some(reference => reference.role === 'style'));
  assert.deepEqual(recipe, JSON.parse(await page.locator('#workflow-recipe-preview').textContent()));
  assert.equal(Buffer.from(files['prompts/codex.md']).toString('utf8'), await page.locator('#prompt-preview').textContent());
  return { bytes, checked, files, sha256: sha256(bytes) };
}

try {
  app = await electron.launch({ executablePath: require('electron'), args: [base], cwd: base, timeout: 20000 });
  const page = await app.firstWindow();
  await page.waitForSelector('#mode-select', { timeout: 15000 });
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.locator('#mode-select option').count(), 2);
  assert.ok(await page.evaluate(() => typeof window.assetWorkshop.check === 'function' && typeof window.assetWorkshop.exportProof === 'function'));
  const port = server.address().port;
  const blocked = await app.evaluate(async ({ net }, url) => {
    try { await net.fetch(url); return false; } catch { return true; }
  }, `http://127.0.0.1:${port}/probe`);
  assert.equal(blocked && requests === 0, true);
  await page.context().setOffline(true);

  await page.locator('#mode-select').selectOption('preset');
  await page.locator('#field-description').fill('无参考图静态 PNG 任务');
  await page.locator('#field-output-widthPx').fill('384');
  await page.locator('#field-output-squareLocked').check();
  await page.locator('#field-output-alphaRequirement').selectOption('transparent-required');
  const first = await ready(page);
  assert.equal(first.output.widthPx, 384);
  assert.equal(first.output.heightPx, 384);
  assert.equal(first.output.ppu, 100);
  assert.equal(first.output.worldWidth, 3.84);
  assert.equal(first.fieldSources['output.heightPx'], 'derived');
  assert.equal(first.references.length, 0);
  const a = path.join(evidence, 'ui-zero-reference.zip');
  await setDialog([], a);
  const firstZip = await savedZip(page, a);
  assert.equal(firstZip.checked.entries.length, 11);
  assert.deepEqual(firstZip.checked.spec, first);
  await page.screenshot({ path: path.join(evidence, 'ui-zero-reference.png'), fullPage: true });

  await page.locator('#field-description').fill('两张参考图静态 PNG 任务');
  await page.locator('#field-output-squareLocked').uncheck();
  await page.locator('#field-output-widthPx').fill('512');
  await page.locator('#field-output-heightPx').fill('256');
  await page.locator('#field-output-ppu').fill('200');
  await setDialog([content, style], null);
  await page.locator('#add-reference').click();
  await page.locator('#reference-list [data-token]').first().waitFor();
  assert.equal(await page.locator('#reference-list [data-token]').count(), 2);
  await page.locator('[data-reference-role]').nth(1).selectOption('style');
  await page.locator('[data-reference-note]').nth(0).fill('石块形态');
  await page.locator('[data-reference-note]').nth(1).fill('双色明暗');
  const second = await ready(page);
  assert.equal(second.output.widthPx, 512);
  assert.equal(second.output.heightPx, 256);
  assert.equal(second.output.ppu, 200);
  assert.equal(second.output.worldWidth, 2.56);
  assert.equal(second.output.worldHeight, 1.28);
  assert.deepEqual(second.references.map(reference => reference.role), ['content', 'style']);
  const b = path.join(evidence, 'ui-two-references.zip');
  await setDialog([], b);
  const secondZip = await savedZip(page, b);
  assert.equal(secondZip.checked.entries.length, 13);
  assert.deepEqual(secondZip.checked.spec, second);
  for (const [index, reference] of second.references.entries()) {
    assert.ok(Buffer.from(secondZip.files[reference.packagePath]).equals(sourceBytes[index]));
  }
  assert.deepEqual([await fs.readFile(content), await fs.readFile(style)], sourceBytes);
  await page.screenshot({ path: path.join(evidence, 'ui-two-references.png'), fullPage: true });

  // A square lock must expose a deliberate, conflicting height rather than silently repair it.
  await page.locator('#field-output-widthPx').fill('384');
  await page.locator('#field-output-heightPx').fill('512');
  await page.locator('#field-output-squareLocked').check();
  await page.waitForFunction(() => document.getElementById('field-errors')?.textContent?.includes('square-locked'));
  assert.equal(await page.locator('#field-output-heightPx').inputValue(), '512');
  assert.equal(await page.locator('#export-task').isDisabled(), true);
  await page.locator('#field-output-squareLocked').uncheck();
  await page.locator('#field-output-widthPx').fill('512');
  await page.locator('#field-output-heightPx').fill('256');

  // Three Alpha modes are authoritative in both the spec and compiled prompt.
  for (const value of ['transparent-required', 'opaque-required', 'alpha-allowed']) {
    await page.locator('#field-output-alphaRequirement').selectOption(value);
    const spec = await ready(page);
    assert.equal(spec.output.alphaRequirement, value);
    assert.ok((await page.locator('#prompt-preview').textContent()).includes(value));
  }

  // Save cancellation and an already-present target never replace the original ZIP.
  await setDialog([], null);
  await page.locator('#export-task').click();
  await page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('取消'));
  assert.ok((await fs.readFile(b)).equals(secondZip.bytes));
  await setDialog([], b);
  await page.locator('#export-task').click();
  await page.waitForSelector('#status[data-state="error"]');
  assert.ok((await page.locator('#status').innerText()).includes('已存在'));
  assert.ok((await fs.readFile(b)).equals(secondZip.bytes));

  // Custom is a real third UI journey; ordinary mode must not retain its hidden requirements.
  await page.locator('#reference-list [data-reference-remove]').nth(1).click();
  assert.equal(await page.locator('#reference-list [data-token]').count(), 1);
  await page.locator('#mode-select').selectOption('custom');
  await page.waitForSelector('#requirements-panel:not([hidden])');
  await page.locator('#requirements-panel > details > summary').click();
  await page.locator('#field-description').fill('一张参考图的自定义任务');
  for (const [level, value] of [
    ['hard', '内容必须是自制石墙'],
    ['preferences', '尽量保留块面'],
    ['creativeFreedom', '裂纹布局可变化'],
  ]) {
    const group = page.locator(`[data-requirement-level="${level}"]`);
    await group.locator('button').first().click();
    await group.locator('textarea').last().fill(value);
  }
  const custom = await ready(page);
  assert.equal(custom.composition.mode, 'custom');
  assert.equal(custom.references.length, 1);
  assert.deepEqual(custom.requirements.hard, ['内容必须是自制石墙']);
  assert.deepEqual(custom.requirements.preferences, ['尽量保留块面']);
  assert.deepEqual(custom.requirements.creativeFreedom, ['裂纹布局可变化']);
  const c = path.join(evidence, 'ui-custom-reference.zip');
  await setDialog([], c);
  const customZip = await savedZip(page, c);
  assert.equal(customZip.checked.entries.length, 12);
  await page.screenshot({ path: path.join(evidence, 'ui-custom-reference.png'), fullPage: true });
  await page.locator('#mode-select').selectOption('preset');
  assert.equal(await page.locator('#requirements-panel').isHidden(), true);
  const ordinary = await ready(page);
  assert.equal(ordinary.composition.mode, 'preset');
  assert.ok(!JSON.stringify(ordinary).includes('内容必须是自制石墙'));

  await page.setViewportSize({ width: 760, height: 640 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.locator('#mode-select').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'SUMMARY');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'field-description');
  await page.locator('#export-task').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#export-task').isVisible(), true);
  await page.screenshot({ path: path.join(evidence, 'ui-narrow.png'), fullPage: true });
  await app.close(); app = null;
  const receipt = {
    node: process.version, evidence, offline: true, networkRequests: requests,
    zero: { path: a, sha256: firstZip.sha256, entries: firstZip.checked.entries.length, references: firstZip.checked.spec.references.length },
    two: { path: b, sha256: secondZip.sha256, entries: secondZip.checked.entries.length, roles: secondZip.checked.spec.references.map(reference => reference.role) },
    custom: { path: c, sha256: customZip.sha256, entries: customZip.checked.entries.length },
    screenshots: ['ui-zero-reference.png', 'ui-two-references.png', 'ui-custom-reference.png', 'ui-narrow.png'],
  };
  await fs.writeFile(path.join(evidence, 'electron-workflow.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  if (app) await app.close();
  await new Promise(resolve => server.close(resolve));
}
