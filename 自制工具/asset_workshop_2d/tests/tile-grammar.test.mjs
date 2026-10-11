import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let catalog; try { catalog = require('../grammar/catalog.cjs'); } catch {}
test('diagonals cannot survive without both cardinal neighbors', () => {
  assert.ok(catalog, 'conditional neighbor compiler is not implemented');
  assert.equal(catalog.normalizeMask(1), 0);
  assert.equal(catalog.normalizeMask(11), 11);
  assert.equal(catalog.normalizeMask(255), 255);
  assert.equal(new Set(Array.from({length:256},(_,i)=>catalog.normalizeMask(i))).size,47);
  assert.throws(()=>catalog.normalizeMask(256));
});
test('both candidates cover 47 states with distinct logical and visible geometry',()=>{
  assert.ok(catalog, 'template catalog is not implemented');
  const grass=catalog.makeGrammar({templateId:'XH-GRASS-8COND-01',cellPixels:128,ppu:100});
  const stone=catalog.makeGrammar({templateId:'XH-STONE-EDGE-8COND-01',cellPixels:128,ppu:100});
  assert.equal(grass.worldCellSize,1.28); assert.equal(grass.master.width,1024);
  assert.equal(grass.tiles.length,47); assert.equal(new Set(grass.tiles.map(t=>t.mask)).size,47);
  assert.equal(grass.sprite.height,128); assert.equal(stone.sprite.height,192);
  assert.ok(stone.sprite.width>128); assert.ok(stone.sprite.pivot.y<.5);
  assert.throws(()=>catalog.makeGrammar({cellPixels:0}));
  assert.throws(()=>catalog.makeGrammar({templateId:'unknown'}));
});
test('continuous sampling strategy has actual source windows for every state',()=>{
  assert.ok(catalog, 'continuous master is not implemented');
  const g=catalog.makeGrammar({templateId:'XH-GRASS-8COND-01',cellPixels:32,ppu:200,strategy:'continuous'});
  assert.equal(g.worldCellSize,.16); assert.ok(g.master.width<48*32);
  assert.equal(g.tiles.length,47); assert.ok(g.tiles.every(t=>t.sourceRect.width===32));
  assert.ok(g.tiles.every(t=>catalog.maskAt(g.board,t.sourceCell.x,t.sourceCell.y)===t.mask));
});
test('explicit AI canvas size regenerates panel cuts without changing logical pixels or PPU',()=>{
 const g=catalog.makeGrammar({cellPixels:128,ppu:100,masterPixels:1254});
 assert.equal(g.master.width,1254);assert.equal(g.master.panels[1].x,627);assert.equal(g.worldCellSize,1.28);
 assert.equal(g.tiles[0].sourceRect.x,249);assert.throws(()=>catalog.makeGrammar({masterPixels:127}));
});
