import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('structured style editors expose an empty baseline and warn when a task loosens tone limits', async t => {
  const desktop = await electron.launch({ executablePath: require('electron'), args: [base, '--test-hidden'], cwd: base });
  t.after(async () => desktop.close());
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(8_000);
  await page.locator('#project-style-section > summary').click();
  await page.locator('#task-style-section > summary').click();
  const projectName = page.locator('#project-style-name');
  assert.ok((await projectName.inputValue()).length > 0);
  await page.locator('#task-style-focus').fill('只重绘中间砖');
  await page.locator('#task-style-dark-tiers').fill('4');
  assert.match(await page.locator('#style-warning').innerText(), /暗部.*4.*3|暗部.*3.*4/);
  await page.locator('#task-style-change').fill('改成写实抛光质感。');
  assert.match(await page.locator('#style-warning').innerText(), /写实抛光/);
  await page.locator('#task-style-change').fill('避免过度精致和写实抛光感。');
  assert.doesNotMatch(await page.locator('#style-warning').innerText(), /写实抛光/);

  await page.locator('#project-style-baseline').selectOption('empty');
  assert.equal(await projectName.isDisabled(), true);
  assert.match(await page.locator('#style-warning').innerText(), /无项目基线/);
  await page.locator('#copy-task').click();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('已复制'));
  assert.equal(await page.locator('#project-style-baseline').inputValue(), 'empty');
  assert.equal(await page.locator('#task-style-focus').inputValue(), '只重绘中间砖');
  await page.locator('#new-task').click();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('已新建'));
  assert.equal(await page.locator('#project-style-baseline').inputValue(), 'default');
  assert.equal(await page.locator('#task-style-focus').inputValue(), '');
});

test('Ctrl+V imports a local PNG path only while the reference area has focus', async t => {
  const desktop = await electron.launch({ executablePath: require('electron'), args: [base, '--test-hidden'], cwd: base });
  t.after(async () => {
    try {
      await desktop.evaluate(({ clipboard }) => {
        clipboard.read = globalThis.__styleUiClipboardRead;
        delete globalThis.__styleUiClipboardRead;
      });
    }
    finally { await desktop.close(); }
  });
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(8_000);
  await page.locator('#quick-square-384').click();
  await desktop.evaluate(({ clipboard }, filePath) => {
    globalThis.__styleUiClipboardRead = clipboard.read;
    clipboard.read = async () => [{ types: ['text/plain'], getType: async () => new Blob([filePath], { type: 'text/plain' }) }];
  }, path.join(base, 'tests', 'fixtures', 'content-01.png'));
  await page.locator('h1').evaluate(element => { element.tabIndex = 0; element.focus(); });
  await page.keyboard.press('Control+V');
  assert.equal(await page.locator('#reference-count').innerText(), '0 / 8');
  await page.locator('#reference-panel').focus();
  await page.keyboard.press('Control+V');
  await page.waitForFunction(() => document.querySelector('#reference-count')?.textContent === '1 / 8');
  assert.equal(await page.locator('.reference-tile img').count(), 1);
  assert.match(await page.locator('.reference-tile').innerText(), /px/);
  await page.locator('.reference-tile textarea').focus();
  await page.keyboard.press('Control+V');
  assert.equal(await page.locator('#reference-count').innerText(), '1 / 8');
});
