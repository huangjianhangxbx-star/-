import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const receipt = { checks: [], base };
const check = (name, value) => { assert.ok(value, name); receipt.checks.push(name); };
let app, oldApp, requests = 0;
const server = http.createServer((_req, res) => { requests++; res.end('unexpected network'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  app = await electron.launch({ executablePath: require('electron'), args: [base], cwd: base, timeout: 20000 });
  const page = await app.firstWindow();
  await page.waitForSelector('#mode-select', { timeout: 15000 });
  receipt.identity = await page.evaluate(() => window.assetWorkshop.info());
  check('distinct application identity', receipt.identity.name === '星骸 2D 素材任务工坊');
  check('own profile', receipt.identity.userData === path.join(base, '.cache', 'asset-task-2d-profile'));
  check('renderer has no Node require', await page.evaluate(() => typeof window.require === 'undefined'));
  const proof = await page.evaluate(() => window.assetWorkshop.check());
  check('legacy proof still reads both real reference images', proof.referenceCount === 2);
  const port = server.address().port;
  const blocked = await app.evaluate(async ({ net }, url) => { try { await net.fetch(url); return false; } catch { return true; } }, `http://127.0.0.1:${port}/probe`);
  check('session refuses HTTP before reaching local server', blocked && requests === 0);
  await page.context().setOffline(true);
  const exported = await page.evaluate(() => window.assetWorkshop.exportProof());
  const zipPath = path.join(base, 'validation', 'proof-output', '2dw-proof-codex.zip');
  const before = await fs.readFile(zipPath);
  const { validateZip } = require('../archive/export-zip.cjs');
  receipt.zip = { path: zipPath, entries: validateZip(before).entries.length };
  check('offline compatibility bridge exports real nine-file ZIP', receipt.zip.entries === 9 && exported.path === zipPath);
  await page.screenshot({ path: path.join(base, 'validation', 'electron-export.png'), fullPage: true });
  const duplicateError = await page.evaluate(async () => {
    try { await window.assetWorkshop.exportProof(); return ''; }
    catch (error) { return error.message; }
  });
  check('repeated UI export protects existing ZIP bytes', before.equals(await fs.readFile(zipPath)));
  check('duplicate export explains failure', duplicateError.includes('EEXIST'));
  if (process.env.TWO_DW_OLD_EXE) {
    oldApp = await electron.launch({ executablePath: process.env.TWO_DW_OLD_EXE, args: ['--test-hidden'], timeout: 20000 });
    await oldApp.firstWindow();
    receipt.oldIdentity = await oldApp.evaluate(({ app }) => ({ name: app.getName(), userData: app.getPath('userData'), pid: process.pid }));
    receipt.newPid = await app.evaluate(() => process.pid);
    check('old and new processes coexist independently', receipt.oldIdentity.pid !== receipt.newPid && receipt.oldIdentity.userData !== receipt.identity.userData);
    await oldApp.close(); oldApp = null;
    check('new app remains alive after old test instance closes', await page.evaluate(() => document.title === '星骸 2D 素材任务工坊'));
  }
  await app.close(); app = null;
  receipt.closed = true;
  await fs.writeFile(path.join(base, 'validation', 'electron-smoke.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  if (oldApp) await oldApp.close();
  if (app) await app.close();
  await new Promise(resolve => server.close(resolve));
}
