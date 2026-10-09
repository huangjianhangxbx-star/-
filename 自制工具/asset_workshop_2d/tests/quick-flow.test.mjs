import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('a first-time task exports from one clear action without entering an ID or title', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), '2dw04-quick-'));
  t.after(async () => fs.rm(dir, { recursive: true, force: true }));
  const desktop = await electron.launch({ executablePath: require('electron'), args: [base, '--test-hidden'], cwd: base });
  t.after(async () => desktop.close());
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(8_000);
  await page.locator('#quick-square-384').click();
  await page.locator('#field-description').fill('灰色地下石墙，有少量裂痕');
  const identity = await page.locator('#task-id').inputValue();
  assert.match(identity, /^asset-[a-z0-9-]{8,64}$/);
  assert.equal(await page.locator('#task-id').getAttribute('readonly'), '');
  assert.match(await page.locator('#effective-title').textContent(), /灰色地下石墙/);
  const target = path.join(dir, 'first.zip');
  await desktop.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, target);
  await page.locator('#check-export').click();
  await page.waitForSelector('#status[data-state="exported"]');
  const bytes = await fs.readFile(target);
  assert.ok(bytes.length > 100);
  assert.match(await page.locator('#task-summary').innerText(), /384.*384/);
  assert.match(await page.locator('#task-summary').innerText(), /100 PPU/);
  assert.equal(await page.locator('#task-id').inputValue(), identity);
});

test('copy starts a distinct task while retaining current visible content', async t => {
  const desktop = await electron.launch({ executablePath: require('electron'), args: [base, '--test-hidden'], cwd: base });
  t.after(async () => desktop.close());
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(8_000);
  await page.locator('#field-description').fill('一盏古旧提灯');
  await page.locator('.advanced-panel details').last().locator('summary').click();
  await page.locator('#manual-title').fill('旧灯任务');
  await page.locator('#field-description').fill('破损的旧灯');
  assert.equal(await page.locator('#effective-title').innerText(), '旧灯任务');
  const before = await page.locator('#task-id').inputValue();
  await page.locator('#copy-task').click();
  const copied = await page.locator('#task-id').inputValue();
  assert.notEqual(copied, before);
  assert.equal(await page.locator('#field-description').inputValue(), '破损的旧灯');
  assert.equal(await page.locator('#effective-title').innerText(), '旧灯任务');
  await page.locator('#new-task').click();
  assert.notEqual(await page.locator('#task-id').inputValue(), copied);
  assert.equal(await page.locator('#field-description').inputValue(), '');
  assert.equal(await page.locator('#title-mode').innerText(), '自动生成');
  assert.equal(await page.locator('#field-output-ppu').inputValue(), '100');
});

test('unchanged auto title keeps the verified preview and square conflict points to a correction', async t => {
  const desktop = await electron.launch({ executablePath: require('electron'), args: [base, '--test-hidden'], cwd: base });
  t.after(async () => desktop.close());
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(8_000);
  await page.locator('#quick-square-384').click();
  await page.locator('#field-description').fill('地底石门');
  await page.locator('#preview-task').click();
  await page.waitForSelector('#status[data-state="ready"]');
  const originalPreview = await page.locator('#spec-preview').textContent();
  await page.locator('.advanced-panel details').last().locator('summary').click();
  await page.locator('#manual-title').fill('   ');
  await page.locator('#restore-auto-title').click();
  assert.equal(await page.locator('#spec-preview').textContent(), originalPreview);
  assert.equal(await page.locator('#export-task').isEnabled(), true);

  await page.locator('#quick-custom').click();
  await page.locator('#field-output-widthPx').fill('384');
  await page.locator('#field-output-heightPx').fill('256');
  await page.locator('#field-output-squareLocked').check();
  const error = page.locator('#field-errors .error-link').first();
  await error.waitFor();
  await error.click();
  assert.equal(await page.locator('#field-output-heightPx').isDisabled(), true);
  assert.equal(await page.locator('#field-output-squareLocked').evaluate(element => element === document.activeElement), true);
});
