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
const { validateZip } = require('../archive/export-zip.cjs');
const evidenceRoot = path.join(base, 'validation', '2dw05');
await fs.mkdir(evidenceRoot, { recursive: true });
const evidence = await fs.mkdtemp(path.join(evidenceRoot, 'recipe-ui-'));
const fixturePaths = {
  'content-01.png': path.join(base, 'tests', 'fixtures', 'content-01.png'),
  'style-01.png': path.join(base, 'tests', 'fixtures', 'style-01.png'),
};
const original = Object.fromEntries(await Promise.all(Object.entries(fixturePaths)
  .map(async ([name, source]) => [name, await fs.readFile(source)])));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const utf8 = bytes => Buffer.from(bytes).toString('utf8');
let app;
let networkRequests = 0;
const server = http.createServer((_request, response) => { networkRequests++; response.end('unexpected network'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

async function setOpen(paths) {
  await app.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths });
  }, paths);
}
async function setSave(filePath) {
  await app.evaluate(({ dialog }, destination) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination });
  }, filePath);
}
async function addReferences(page, names) {
  await setOpen(names.map(name => fixturePaths[name]));
  await page.locator('#add-reference').click();
  await page.waitForFunction(count => document.querySelectorAll('#reference-list [data-token]').length === count, names.length);
}
async function editReference(page, index, { role, note, priority } = {}) {
  if (role !== undefined) {
    await page.locator('[data-reference-role]').nth(index).selectOption(role);
    await page.waitForFunction(() => !document.getElementById('preview-task')?.disabled);
  }
  if (note !== undefined) {
    await page.locator('[data-reference-note]').nth(index).fill(note);
    await page.locator('[data-reference-note]').nth(index).press('Tab');
    await page.waitForFunction(() => !document.getElementById('preview-task')?.disabled);
  }
  if (priority !== undefined) {
    await page.locator('[data-reference-priority]').nth(index).fill(String(priority));
    await page.locator('[data-reference-priority]').nth(index).press('Tab');
    await page.waitForFunction(() => !document.getElementById('preview-task')?.disabled);
  }
}
async function freshTask(page, previousId) {
  await page.locator('#new-task').click();
  await page.waitForFunction(oldId => document.getElementById('task-id')?.value !== oldId, previousId);
  await page.waitForFunction(() => document.getElementById('field-description')?.value === '');
}
async function preview(page) {
  await page.locator('#preview-task').click();
  await page.waitForSelector('#status[data-state="ready"]');
  const spec = JSON.parse(await page.locator('#spec-preview').textContent());
  const recipe = JSON.parse(await page.locator('#workflow-recipe-preview').textContent());
  const prompt = await page.locator('#prompt-preview').textContent();
  const entries = await page.locator('#entry-preview li').allTextContents();
  assert.equal(spec.taskId, recipe.taskId);
  assert.equal(spec.taskId, await page.locator('#task-id').inputValue());
  assert.equal(recipe.steps.length, 9);
  assert.equal(recipe.steps[7].active, true);
  assert.equal(recipe.steps[8].active, true);
  assert.match(await page.locator('#workflow-status').textContent(), /尚未分析|尚未.*制作/);
  assert.ok(entries.includes('workflow/recipe.json'));
  assert.ok(prompt.includes('workflow/analysis-plan.md'));
  return { spec, recipe, prompt, entries };
}
function audit(bytes, shown, { width, height, ppu, roles, names, notes = [], priorities = [] }) {
  // fflate and direct hashes inspect the actual bytes, independent of the workshop validator.
  const files = unzipSync(bytes);
  const all = Object.keys(files).sort();
  const manifest = JSON.parse(utf8(files['manifest.json']));
  const spec = JSON.parse(utf8(files['spec/asset-spec.json']));
  const recipe = JSON.parse(utf8(files['workflow/recipe.json']));
  assert.deepEqual(spec, shown.spec);
  assert.deepEqual(recipe, shown.recipe);
  assert.equal(utf8(files['prompts/codex.md']), shown.prompt);
  assert.deepEqual(all, [...shown.entries].sort());
  assert.equal(all.length, 14 + names.length);
  assert.ok(all.every(name => !name.startsWith('output/') && !name.startsWith('reports/') && !name.startsWith('/')
    && !name.includes('\\') && !name.split('/').includes('..')));
  assert.equal(manifest.schemaVersion, '2dw-zip/3');
  assert.deepEqual(JSON.parse(utf8(files['style/project-style-contract.json'])), spec.projectStyleContract);
  assert.ok(files['style/project-style-contract.md'] && files['style/task-style-delta.md']);
  assert.equal(manifest.workflowRecipeVersion, '2dw-workflow/1');
  assert.equal(manifest.taskId, spec.taskId);
  assert.equal(manifest.assetSchemaVersion, spec.schemaVersion);
  assert.equal(manifest.expectedOutputPath, spec.output.relativePath);
  assert.deepEqual(manifest.references, spec.references);
  assert.deepEqual(manifest.entries.map(entry => entry.path).sort(), all.filter(name => name !== 'manifest.json'));
  for (const entry of manifest.entries) {
    const content = Buffer.from(files[entry.path]);
    assert.equal(entry.byteLength, content.length, `${entry.path} length`);
    assert.equal(entry.sha256, sha256(content), `${entry.path} SHA256`);
  }
  assert.deepEqual([spec.output.widthPx, spec.output.heightPx, spec.output.ppu], [width, height, ppu]);
  assert.equal(spec.output.worldWidth, width / ppu);
  assert.equal(spec.output.worldHeight, height / ppu);
  assert.deepEqual(spec.references.map(ref => ref.role), roles);
  assert.deepEqual(spec.references.map(ref => ref.sourceName), names);
  for (const [index, reference] of spec.references.entries()) {
    const source = original[reference.sourceName];
    assert.ok(source);
    assert.ok(Buffer.from(files[reference.packagePath]).equals(source));
    assert.equal(reference.sha256, sha256(source));
    assert.equal(reference.byteLength, source.length);
    assert.equal(reference.widthPx, source.readUInt32BE(16));
    assert.equal(reference.heightPx, source.readUInt32BE(20));
    assert.equal(reference.note, notes[index] ?? '');
    if (priorities[index] !== undefined) assert.equal(reference.priority, priorities[index]);
    assert.equal(Object.hasOwn(reference, 'sourcePath'), false);
  }
  const contentRefs = spec.references.filter(ref => ref.role === 'content').map(ref => ref.refId);
  const styleRefs = spec.references.filter(ref => ref.role === 'style').map(ref => ref.refId);
  assert.deepEqual(recipe.steps[1].activation.refIds, contentRefs);
  assert.deepEqual(recipe.steps[2].activation.refIds, styleRefs);
  assert.equal(recipe.steps[1].active, contentRefs.length > 0);
  assert.equal(recipe.steps[2].active, styleRefs.length > 0);
  assert.ok(recipe.steps.filter(step => !step.id.startsWith('analyze-')).every(step => step.active));
  assert.deepEqual(recipe.steps[8].dependsOn, ['verify-inputs']);
  assert.ok(!Object.keys(files).some(name => /(?:^|\/)(?:style-analysis|analysis-report|production-brief)\.md$/u.test(name)));
  validateZip(bytes); // Supplementary CRC/header check; independent comparisons above stand alone.
  return { sha256: sha256(bytes), taskId: spec.taskId, entryCount: all.length,
    references: spec.references.map(ref => ({ refId: ref.refId, role: ref.role,
      sourceName: ref.sourceName, note: ref.note, priority: ref.priority, sha256: ref.sha256 })),
    activeSteps: recipe.steps.filter(step => step.active).map(step => step.id),
    skippedSteps: recipe.steps.filter(step => !step.active).map(step => step.id),
    output: spec.output };
}
async function exportCase(page, label, expected) {
  const shown = await preview(page);
  const outputPath = path.join(evidence, `${label}.zip`);
  await setSave(outputPath);
  await page.locator('#export-task').click();
  await page.waitForFunction(() => ['exported', 'error'].includes(document.getElementById('status')?.dataset.state));
  assert.equal(await page.locator('#status').getAttribute('data-state'), 'exported', await page.locator('#status').textContent());
  const bytes = await fs.readFile(outputPath);
  const audited = audit(bytes, shown, expected);
  assert.ok((await page.locator('#status').textContent()).includes(audited.sha256));
  if (!(await page.locator('#workflow-details').evaluate(element => element.open))) {
    await page.locator('#workflow-details > summary').click();
  }
  const screenshotPath = path.join(evidence, `${label}.png`);
  const image = await page.screenshot({ path: screenshotPath, fullPage: true });
  return { ...audited, zipPath: outputPath, screenshotPath, screenshotSha256: sha256(image) };
}

try {
  app = await electron.launch({ executablePath: require('electron'), args: [base], cwd: base, timeout: 20_000 });
  const page = await app.firstWindow();
  page.setDefaultTimeout(15_000);
  await page.waitForSelector('#mode-select:not([disabled])');
  await page.setViewportSize({ width: 1080, height: 820 });
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
  const blocked = await app.evaluate(async ({ net }, url) => {
    try { await net.fetch(url); return false; } catch { return true; }
  }, `http://127.0.0.1:${server.address().port}/probe`);
  assert.equal(blocked, true);
  assert.equal(networkRequests, 0);
  await page.context().setOffline(true);

  // A: no image; descriptive intent and the default 100 PPU remain sufficient.
  await page.locator('#quick-square-384').click();
  await page.locator('#field-description').fill('制作一块灰石门牌，文字指定形态与清晰轮廓。');
  const a = await exportCase(page, 'A-no-reference',
    { width: 384, height: 384, ppu: 100, roles: [], names: [] });

  // B: separate content and style evidence, with an explicit 200 PPU override.
  await freshTask(page, a.taskId);
  await page.locator('#field-description').fill('制作横向石门片段，内容看形态，风格看色彩。');
  await page.locator('#quick-custom').click();
  await page.locator('#field-output-widthPx').fill('512');
  await page.locator('#field-output-heightPx').fill('256');
  await page.locator('#field-output-ppu').fill('200');
  await addReferences(page, ['content-01.png', 'style-01.png']);
  await editReference(page, 1, { role: 'style' });
  const b = await exportCase(page, 'B-content-and-style',
    { width: 512, height: 256, ppu: 200, roles: ['content', 'style'], names: ['content-01.png', 'style-01.png'] });

  // C: the style PNG may guide appearance, not invent the requested object.
  await freshTask(page, b.taskId);
  await page.locator('#quick-square-384').click();
  await page.locator('#field-description').fill('制作单件木箱；木箱形态由文字定义，参考图只供色彩与光影。');
  await addReferences(page, ['style-01.png']);
  await editReference(page, 0, { role: 'style' });
  const c = await exportCase(page, 'C-style-only',
    { width: 384, height: 384, ppu: 100, roles: ['style'], names: ['style-01.png'] });
  assert.ok(c.skippedSteps.includes('analyze-content-refs'));

  // D: two distinct self-made PNGs are both style references; contradictory human notes
  // require an external decision record, not an invented compromise in the offline ZIP.
  await freshTask(page, c.taskId);
  await page.locator('#quick-square-384').click();
  await page.locator('#field-description').fill('制作石制祭坛徽章。两个风格参考的人工注记互相矛盾；先记录差异并请求必要裁定。');
  await addReferences(page, ['style-01.png', 'content-01.png']);
  const firstNote = '风格要求偏亮暖橙，边缘柔和；与另一张的冷暗硬边要求冲突。';
  const secondNote = '风格要求偏暗冷蓝，边缘硬朗；与另一张的暖亮柔边要求冲突。';
  await editReference(page, 0, { role: 'style', note: firstNote, priority: 80 });
  await editReference(page, 1, { role: 'style', note: secondNote, priority: 80 });
  const d = await exportCase(page, 'D-conflicting-style-notes',
    { width: 384, height: 384, ppu: 100, roles: ['style', 'style'],
      names: ['style-01.png', 'content-01.png'], notes: [firstNote, secondNote], priorities: [80, 80] });
  assert.ok(d.skippedSteps.includes('analyze-content-refs'));
  assert.ok(d.activeSteps.includes('decision-gates'));
  assert.equal(new Set([a.taskId, b.taskId, c.taskId, d.taskId]).size, 4);
  assert.equal(networkRequests, 0);
  for (const [name, source] of Object.entries(fixturePaths)) assert.ok((await fs.readFile(source)).equals(original[name]));

  const receipt = { evidence, node: process.version, offline: true, networkRequests,
    rendererNodeAccess: false, zipAudit: 'independent fflate extraction, every manifest SHA256, original PNG bytes, plus CRC validation',
    cases: { A: a, B: b, C: c, D: d } };
  const receiptPath = path.join(evidence, 'workflow-recipe-smoke.json');
  await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ receipt: receiptPath, cases: Object.fromEntries(Object.entries(receipt.cases)
    .map(([name, result]) => [name, { zipPath: result.zipPath, sha256: result.sha256,
      entries: result.entryCount, activeSteps: result.activeSteps, skippedSteps: result.skippedSteps }])), networkRequests }, null, 2));
} finally {
  if (app) await app.close();
  await new Promise(resolve => server.close(resolve));
}
