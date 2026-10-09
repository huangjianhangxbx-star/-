import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const require = createRequire(import.meta.url);
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = path.join(base, 'validation', '2dw04');
await fs.mkdir(evidenceRoot, { recursive: true });
const evidence = await fs.mkdtemp(path.join(evidenceRoot, 'quick-ui-'));
const sources = {
  'content-01.png': await fs.readFile(path.join(base, 'tests', 'fixtures', 'content-01.png')),
  'style-01.png': await fs.readFile(path.join(base, 'tests', 'fixtures', 'style-01.png')),
};
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const utf8 = bytes => Buffer.from(bytes).toString('utf8');
const screenshots = [];
let app;
let requests = 0;
const server = http.createServer((_request, response) => { requests++; response.end('unexpected network'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

async function saveDialog(destination) {
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, destination);
}

async function openDialog(files) {
  await app.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths });
  }, files);
}

async function screenshot(page, name, width, height) {
  await page.setViewportSize({ width, height });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  const destination = path.join(evidence, name);
  const png = await page.screenshot({ path: destination });
  assert.equal(png.readUInt32BE(16), width);
  assert.equal(png.readUInt32BE(20), height);
  screenshots.push({ path: destination, width, height, sha256: hash(png) });
}

async function preview(page) {
  await page.locator('#preview-task').click();
  await page.waitForSelector('#status[data-state="ready"]');
  const spec = JSON.parse(await page.locator('#spec-preview').textContent());
  const prompt = await page.locator('#prompt-preview').textContent();
  const entries = await page.locator('#entry-preview li').allTextContents();
  assert.equal(spec.taskId, await page.locator('#task-id').inputValue());
  assert.equal(spec.title, await page.locator('#effective-title').textContent());
  assert.equal(spec.output.format, 'png');
  assert.equal(spec.output.relativePath, 'output/asset.png');
  assert.ok(prompt.includes('spec/asset-spec.json'));
  assert.ok(entries.includes('manifest.json'));
  return { spec, prompt, entries };
}

function independentlyAuditZip(bytes, shown, expected) {
  // This reads the produced archive with fflate and hashes every entry directly;
  // it deliberately does not call archive/export-zip.cjs validateZip.
  const files = unzipSync(bytes);
  const names = Object.keys(files).sort();
  const manifest = JSON.parse(utf8(files['manifest.json']));
  const spec = JSON.parse(utf8(files['spec/asset-spec.json']));
  assert.deepEqual(spec, shown.spec);
  assert.equal(utf8(files['prompts/codex.md']), shown.prompt);
  assert.deepEqual(names, [...shown.entries].sort());
  assert.equal(names.length, 7 + expected.referenceNames.length);
  assert.ok(names.every(name => !name.startsWith('output/') && !name.startsWith('/')
    && !name.includes('\\') && !name.split('/').includes('..')));
  assert.equal(manifest.schemaVersion, '2dw-zip/1');
  assert.equal(manifest.specPath, 'spec/asset-spec.json');
  assert.equal(manifest.taskId, spec.taskId);
  assert.equal(manifest.assetSchemaVersion, spec.schemaVersion);
  assert.equal(manifest.presetId, spec.presetId);
  assert.equal(manifest.adapterId, spec.adapterId);
  assert.equal(manifest.expectedOutputPath, spec.output.relativePath);
  assert.deepEqual(manifest.references, spec.references);
  assert.equal(new Set(manifest.entries.map(entry => entry.path)).size, manifest.entries.length);
  assert.deepEqual(manifest.entries.map(entry => entry.path).sort(), names.filter(name => name !== 'manifest.json'));
  for (const entry of manifest.entries) {
    const body = Buffer.from(files[entry.path]);
    assert.equal(body.length, entry.byteLength, `${entry.path} byte length`);
    assert.equal(hash(body), entry.sha256, `${entry.path} SHA256`);
  }
  assert.equal(spec.output.widthPx, expected.width);
  assert.equal(spec.output.heightPx, expected.height);
  assert.equal(spec.output.ppu, expected.ppu);
  assert.equal(spec.output.squareLocked, expected.squareLocked);
  assert.equal(spec.output.worldWidth, expected.width / expected.ppu);
  assert.equal(spec.output.worldHeight, expected.height / expected.ppu);
  assert.equal(spec.output.alphaRequirement, expected.alpha);
  assert.equal(spec.references.length, expected.referenceNames.length);
  assert.deepEqual(spec.references.map(reference => reference.role), expected.roles);
  for (const reference of spec.references) {
    const source = sources[reference.sourceName];
    assert.ok(source, `unknown reference source ${reference.sourceName}`);
    assert.ok(expected.referenceNames.includes(reference.sourceName));
    const body = Buffer.from(files[reference.packagePath]);
    assert.ok(body.equals(source), `${reference.refId} original PNG bytes`);
    assert.equal(reference.byteLength, source.length);
    assert.equal(reference.sha256, hash(source));
    assert.equal(reference.widthPx, source.readUInt32BE(16));
    assert.equal(reference.heightPx, source.readUInt32BE(20));
    assert.ok(shown.prompt.includes(reference.packagePath));
    assert.equal(Object.hasOwn(reference, 'sourcePath'), false);
  }
  return { spec, manifest, entryCount: names.length, sha256: hash(bytes) };
}

async function exported(page, destination, shown, expected, direct) {
  await saveDialog(destination);
  await page.locator(direct ? '#check-export' : '#export-task').click();
  await page.waitForSelector('#status[data-state="exported"]');
  const bytes = await fs.readFile(destination);
  const actual = independentlyAuditZip(bytes, shown ?? {
    spec: JSON.parse(await page.locator('#spec-preview').textContent()),
    prompt: await page.locator('#prompt-preview').textContent(),
    entries: await page.locator('#entry-preview li').allTextContents(),
  }, expected);
  assert.ok((await page.locator('#status').textContent()).includes(actual.sha256));
  return { path: destination, sha256: actual.sha256, entries: actual.entryCount,
    taskId: actual.spec.taskId, title: actual.spec.title, description: actual.spec.description,
    output: actual.spec.output, references: actual.spec.references };
}

try {
  app = await electron.launch({ executablePath: require('electron'), args: [base], cwd: base, timeout: 20_000 });
  const page = await app.firstWindow();
  page.setDefaultTimeout(12_000);
  await page.waitForSelector('#mode-select:not([disabled])');
  await page.setViewportSize({ width: 1080, height: 820 });
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.assetWorkshop.previewTask), 'function');
  const probe = `http://127.0.0.1:${server.address().port}/probe`;
  const blocked = await app.evaluate(async ({ net }, url) => {
    try { await net.fetch(url); return false; } catch { return true; }
  }, probe);
  assert.equal(blocked, true);
  assert.equal(requests, 0);
  await page.context().setOffline(true);

  // A first-time user supplies content and a quick square size, then exports in one action.
  const firstId = await page.locator('#task-id').inputValue();
  assert.match(firstId, /^asset-[a-z0-9-]{8,64}$/);
  assert.equal(await page.locator('#task-id').getAttribute('readonly'), '');
  await page.locator('#quick-square-384').click();
  await page.locator('#field-description').fill('灰色地下石墙单件，保持清晰轮廓');
  const firstZip = await exported(page, path.join(evidence, 'A-zero-square.zip'), null,
    { width: 384, height: 384, ppu: 100, squareLocked: true, alpha: 'transparent-required', referenceNames: [], roles: [] }, true);
  assert.equal(firstZip.taskId, firstId);
  assert.match(firstZip.title, /灰色地下石墙/);
  assert.match(await page.locator('#task-summary').textContent(), /384\s*×\s*384.*100 PPU/s);
  await screenshot(page, 'A-zero-square-1080x820.png', 1080, 820);

  // A new task gets a fresh ID; this rectangle uses two real PNGs with distinct roles.
  await page.locator('#new-task').click();
  await page.waitForFunction(previous => document.getElementById('task-id')?.value !== previous, firstId);
  await page.waitForFunction(() => document.getElementById('field-description')?.value === '');
  const secondId = await page.locator('#task-id').inputValue();
  assert.equal(await page.locator('#field-description').inputValue(), '');
  await page.locator('#field-description').fill('地下石墙横向片段，参考石块形态和冷色明暗');
  await page.locator('#quick-custom').click();
  await page.locator('#field-output-widthPx').fill('512');
  await page.locator('#field-output-heightPx').fill('256');
  await page.locator('#field-output-ppu').fill('200');
  await page.locator('#field-output-alphaRequirement').selectOption('alpha-allowed');
  await openDialog([path.join(base, 'tests', 'fixtures', 'content-01.png'), path.join(base, 'tests', 'fixtures', 'style-01.png')]);
  await page.locator('#add-reference').click();
  await page.waitForFunction(() => document.querySelectorAll('#reference-list [data-token]').length === 2);
  await page.locator('[data-reference-role]').nth(1).selectOption('style');
  await page.waitForFunction(() => document.querySelectorAll('[data-reference-role]')[1]?.value === 'style'
    && !document.getElementById('preview-task')?.disabled);
  const secondShown = await preview(page);
  assert.equal(secondShown.spec.taskId, secondId);
  assert.equal(secondShown.spec.description, '地下石墙横向片段，参考石块形态和冷色明暗');
  const secondZip = await exported(page, path.join(evidence, 'B-two-rectangle.zip'), secondShown,
    { width: 512, height: 256, ppu: 200, squareLocked: false, alpha: 'alpha-allowed',
      referenceNames: ['content-01.png', 'style-01.png'], roles: ['content', 'style'] }, false);
  await screenshot(page, 'B-two-rectangle-1080x820.png', 1080, 820);

  // Copy is a third real export: task identity changes, visible content and both sources persist.
  await page.locator('#copy-task').click();
  await page.waitForFunction(previous => document.getElementById('task-id')?.value !== previous, secondId);
  const copiedId = await page.locator('#task-id').inputValue();
  assert.notEqual(copiedId, firstId);
  assert.equal(await page.locator('#field-description').inputValue(), secondZip.description);
  assert.equal(await page.locator('#reference-list [data-token]').count(), 2);
  const copyShown = await preview(page);
  assert.equal(copyShown.spec.taskId, copiedId);
  assert.deepEqual(copyShown.spec.output, secondZip.output);
  assert.deepEqual(copyShown.spec.references, secondZip.references);
  const copiedZip = await exported(page, path.join(evidence, 'C-copy-new-id.zip'), copyShown,
    { width: 512, height: 256, ppu: 200, squareLocked: false, alpha: 'alpha-allowed',
      referenceNames: ['content-01.png', 'style-01.png'], roles: ['content', 'style'] }, false);
  await screenshot(page, 'C-copy-1080x820.png', 1080, 820);
  await screenshot(page, 'C-copy-760x640.png', 760, 640);
  await page.locator('#check-export').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#check-export').isVisible(), true);
  await screenshot(page, 'C-copy-delivery-760x640.png', 760, 640);

  assert.equal(requests, 0);
  for (const [name, original] of Object.entries(sources)) {
    assert.ok((await fs.readFile(path.join(base, 'tests', 'fixtures', name))).equals(original));
  }
  const receipt = { evidence, node: process.version, offline: true, networkRequests: requests,
    rendererNodeAccess: false, zipAudit: 'independent fflate extraction plus per-entry manifest SHA256 and source byte comparison',
    cases: { zeroSquare: firstZip, twoRectangle: secondZip, copiedNewId: copiedZip }, screenshots };
  const receiptPath = path.join(evidence, 'quick-smoke.json');
  await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({ receipt: receiptPath, cases: Object.fromEntries(Object.entries(receipt.cases).map(([name, value]) => [name,
    { path: value.path, sha256: value.sha256, entries: value.entries, taskId: value.taskId }])), screenshots, networkRequests: requests }, null, 2));
} finally {
  if (app) await app.close();
  await new Promise(resolve => server.close(resolve));
}
