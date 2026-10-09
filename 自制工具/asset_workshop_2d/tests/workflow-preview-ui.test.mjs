import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('preview shows pending external work and inactive image analysis, then clears with the draft', async t => {
  const desktop = await electron.launch({ executablePath: require('electron'), args: [base, '--test-hidden'], cwd: base });
  t.after(async () => desktop.close());
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(8_000);
  await page.locator('#quick-square-384').click();
  await page.locator('#field-description').fill('一块地底灰石地砖');
  await page.locator('#preview-task').click();
  await page.waitForSelector('#status[data-state="ready"], #status[data-state="error"]');
  assert.equal(await page.locator('#status').getAttribute('data-state'), 'ready', await page.locator('#status').innerText());

  const section = page.locator('#workflow-details');
  assert.match(await section.locator('summary').first().innerText(), /执行流程预览/);
  await section.locator('summary').first().click();
  const steps = section.locator('#workflow-steps > li');
  assert.equal(await steps.count(), 9);
  assert.match(await section.locator('[data-step-id="analyze-content-refs"]').innerText(), /不启用|不适用/);
  assert.match(await section.locator('[data-step-id="analyze-style-refs"]').innerText(), /不启用|不适用/);
  assert.match(await section.locator('[data-step-id="verify-asset"]').innerText(), /待外部 AI 执行/);
  assert.doesNotMatch(await section.innerText(), /已分析完成/);
  assert.ok((await page.locator('#workflow-plan-preview').textContent()).length > 100);
  const recipe = JSON.parse(await page.locator('#workflow-recipe-preview').textContent());
  assert.equal(typeof recipe, 'object');

  await page.locator('#field-description').fill('一块带裂痕的地底灰石地砖');
  assert.equal(await steps.count(), 0);
  assert.match(await page.locator('#workflow-status').innerText(), /重新生成预览/);
});
