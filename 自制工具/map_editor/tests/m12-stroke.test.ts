import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorDocument } from '../core/document.ts';
test('a height stroke crosses protected columns without losing either side and undo preserves bridge', () => {
 const e = new EditorDocument(); e.begin(); e.volume(0,0,4,0); e.commit();
 e.begin(); e.height(-1,0,0,2,1);
 assert.equal(e.height(0,0,0,2,1)?.status, 'skipped');
 e.height(1,0,0,2,1); e.commit();
 assert.equal(e.doc.cells.length,5); assert.equal(e.cells.has('0,0,0'),false);
 e.undo(); assert.deepEqual(e.doc.cells.map(c=>[c.x,c.y,c.z]),[[0,0,4]]);
});
test('protected erase and empty erase create no revision or undo step', () => {
 const e=new EditorDocument(); e.begin(); e.volume(0,0,4,0); e.commit();
 const revision=e.doc.revision; e.begin();
 assert.equal(e.eraseColumn(0,0)?.status,'skipped'); e.eraseColumn(9,9); e.commit();
 assert.equal(e.doc.revision,revision); assert.equal(e.past.length,1);
});
test('standing tags skip sides while obstacle remains legal',()=>{
 const e=new EditorDocument(); e.begin(); e.volume(0,0,0,0);
 assert.equal(e.surface(1,0,0,0,'walk')?.status,'skipped');
 assert.equal(e.surface(0,0,0,5,'highground')?.status,'skipped');
 e.surface(1,0,0,0,'obstacle'); e.surface(0,0,1,4,'walk'); e.commit();
 assert.deepEqual(e.doc.surfaces.map(s=>s.tag),['obstacle','walk']);
});
test('missing support is a skipped operation and legacy tags cannot be newly painted',()=>{
 const e=new EditorDocument(); e.begin();
 assert.equal(e.surface(0,0,0,4,'walk')?.status,'skipped');
 e.height(0,0,0,1,0); assert.throws(()=>e.surface(0,0,0,4,'deploy'));
 e.cancel(); assert.equal(e.doc.cells.length,0);
});

test('batch validates dependency support after final geometry, not intermediate erase',()=>{
 const e=new EditorDocument();e.begin();e.height(0,0,0,1,0);e.surface(0,0,0,4,'walk');e.place({id:'a',assetId:'model',x:.125,y:.125,z:0,rotation:0});e.commit();
 e.begin();e.batch(()=>{e.put(0,0,-1,0,'height',true);e.put(0,0,-1,1,'height');});e.commit();assert.equal(e.doc.surfaces.length,1);assert.equal(e.doc.instances.length,1);assert.equal(e.detached.instances,0);
});
