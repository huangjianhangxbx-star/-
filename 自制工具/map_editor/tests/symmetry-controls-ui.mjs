import { build } from 'esbuild';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'xh-symmetry-controls-'));
const entry = `import {SymmetryControls} from ${JSON.stringify(path.resolve('desktop/symmetry-controls.ts'))};
import {EditorDocument,createMap} from ${JSON.stringify(path.resolve('core/document.ts'))};
import {EditOperationSession} from ${JSON.stringify(path.resolve('core/edit-operation.ts'))};
window.target={key:'controls-test',origin:[-1,2,-.5],step:.125,cells:[{x:-2,y:1,z:0},{x:3,y:4,z:5}]};window.selection=[{x:3,y:4,z:5}];window.messages=[];window.drag=[];
window.controls=new SymmetryControls(document.querySelector('main'),()=>window.target,()=>{},s=>window.messages.push(s),{getSelection:()=>window.selection,onDragChange:a=>window.drag.push(a)});window.controls.sync();window.controls.element.open=true;
window.draw=()=>{const e=new EditorDocument(createMap()),op=new EditOperationSession(e);op.begin({mode:'volume',action:'add',shape:'square',size:1,thickness:1,level:0,direction:1,color:0,tag:'',symmetry:window.controls.value(),symmetryOrigin:window.target.origin,symmetryStep:window.target.step});op.apply(op.brush({x:0,y:0,z:0}));op.commit();const result=[...e.cells.keys()].sort();e.undo();return{result,undo:e.cells.size};};window.ready=true;`;
const bundle = await build({ stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: 'symmetry-controls-harness.ts', loader: 'ts' }, bundle: true, write: false, platform: 'browser', format: 'esm', logLevel: 'silent' });
await fs.writeFile(path.join(folder, 'app.js'), bundle.outputFiles[0].contents);
const server = http.createServer(async (req, res) => {
  if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(await fs.readFile(path.join(folder, 'app.js'))); }
  else res.end('<!doctype html><main></main><script type="module" src="/app.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage(), errors = []; page.setDefaultTimeout(2500); page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + server.address().port); await page.waitForFunction(() => window.ready);
  const axis = n => page.locator(`[data-symmetry-center-axis="${n}"]`);
  await axis(0).fill('-0.75');
  assert.equal((await page.evaluate(() => window.controls.value())).center[0], -.75, 'valid independent numeric input applies immediately');
  await page.locator('[data-axis="0"]').check();
  assert.deepEqual(await page.evaluate(() => window.draw()), { result: ['0,0,0', '3,0,0'], undo: 0 });
  await page.locator('[data-symmetry-step]').selectOption('0.5'); await page.locator('[data-symmetry-offset-axis="0"][data-direction="-1"]').click();
  assert.deepEqual(await page.evaluate(() => window.draw()), { result: ['0,0,0', '2,0,0'], undo: 0 });
  await page.locator('[data-symmetry-step]').selectOption('1'); await page.locator('[data-symmetry-offset-axis="0"][data-direction="-1"]').click();
  assert.deepEqual(await page.evaluate(() => window.draw()), { result: ['0,0,0'], undo: 0 }, 'whole-cell nudge can put the source on the mirror plane without duplicate cells');
  await page.locator('[data-symmetry="selection"]').click();
  assert.deepEqual((await page.evaluate(() => window.controls.value())).center, [-.5625, 2.5625, .1875]);
  await page.locator('[data-symmetry="reset"]').click();
  assert.deepEqual((await page.evaluate(() => window.controls.value())).center, [-.875, 2.375, -.125]);
  assert.equal((await page.evaluate(() => window.controls.value())).axes[0], true, 'center reset keeps enabled mirror axes');
  await axis(0).fill('-0.88'); await axis(0).dispatchEvent('change');
  assert.equal((await page.evaluate(() => window.controls.value())).center[0], -.875, 'off-half-grid input never corrupts persisted mirror coordinates');
  await page.locator('[data-symmetry="drag"]').click();
  assert.equal(await page.evaluate(() => window.controls.dragging), true);
  await page.evaluate(() => window.controls.setDragPoint([-.81, 2.4, -.1]));
  assert.deepEqual((await page.evaluate(() => window.controls.value())).center, [-.8125, 2.375, -.125]);
  await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => window.controls.dragging), false);
  assert.deepEqual(await page.evaluate(() => window.drag), [true, false]);
  const before = await page.evaluate(() => window.controls.value()); await page.reload(); await page.waitForFunction(() => window.ready);
  assert.deepEqual(await page.evaluate(() => window.controls.value()), before, 'existing per-target storage survives reopening');
  await page.evaluate(() => { window.selection = []; window.controls.sync(); });
  assert.equal(await page.locator('[data-symmetry="selection"]').isDisabled(), true);
  await page.locator('.symmetry-coordinates-legacy').evaluate(node => node.open = true);
  await page.locator('.symmetry-center').fill('-0.75,2.375,-0.125'); await page.locator('[data-symmetry="apply"]').click();
  assert.equal((await page.evaluate(() => window.controls.value())).center[0], -.75, 'legacy CSV apply remains compatible');
  assert.deepEqual(errors, []); console.log('PASS symmetry center independent coordinates, native nudges, selection reset, drag lifecycle, real mirrored brush and persistence');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
