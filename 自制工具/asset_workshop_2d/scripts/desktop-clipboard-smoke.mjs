import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const png = path.join(root, 'tests', 'fixtures', 'content-01.png');
const imageBase64 = (await fs.readFile(png)).toString('base64');
let desktop;
let saved = false;
try {
  desktop = await electron.launch({ executablePath: require('electron'), args: [root, '--test-hidden'], cwd: root });
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(10_000);
  await page.locator('#quick-square-384').click();
  await desktop.evaluate(async ({ clipboard }) => {
    const previous = await clipboard.read();
    globalThis.__2dwClipboardBackup = [];
    for (const item of previous) {
      const payloads = {};
      for (const type of item.types) payloads[type] = await item.getType(type);
      globalThis.__2dwClipboardBackup.push(payloads);
    }
  });
  saved = true;
  const imageTypes = await desktop.evaluate(async ({ clipboard, ClipboardItem }, encoded) => {
    const bytes = Buffer.from(encoded, 'base64');
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
    return (await clipboard.read()).flatMap(item => item.types);
  }, imageBase64);
  await page.locator('#reference-panel').focus();
  await page.keyboard.press('Control+V');
  await page.waitForFunction(() => document.querySelector('#reference-count')?.textContent === '1 / 8');
  const bitmapTile = await page.locator('.reference-tile').first().innerText();

  const fileTypes = await desktop.evaluate(async ({ clipboard, ClipboardItem }, uri) => {
    await clipboard.write([new ClipboardItem({ 'text/uri-list': uri })]);
    return (await clipboard.read()).flatMap(item => item.types);
  }, pathToFileURL(png).href);
  await page.locator('#reference-panel').focus();
  await page.keyboard.press('Control+V');
  await page.waitForFunction(() => document.querySelector('#reference-count')?.textContent === '2 / 8');
  const fileTile = await page.locator('.reference-tile').nth(1).innerText();
  const thumbnails = await page.locator('.reference-tile img').count();
  if (!imageTypes.includes('image/png') || !fileTypes.includes('text/uri-list') || thumbnails !== 2) throw Error('Native clipboard MIME or preview mismatch');
  console.log(JSON.stringify({ imageTypes, fileTypes, bitmapTile, fileTile, thumbnails }, null, 2));
} finally {
  if (desktop) {
    if (saved) {
      await desktop.evaluate(async ({ clipboard, ClipboardItem }) => {
        const original = globalThis.__2dwClipboardBackup;
        if (Array.isArray(original) && original.length) await clipboard.write(original.map(item => new ClipboardItem(item)));
        else clipboard.clear();
        delete globalThis.__2dwClipboardBackup;
      });
    }
    await desktop.close();
  }
}
