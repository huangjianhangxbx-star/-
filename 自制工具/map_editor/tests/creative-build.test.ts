import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorDocument} from '../core/document.ts';
import {EditOperationSession} from '../core/edit-operation.ts';
import {creativeConfig, MiddleGesture, interpolateScreen} from '../core/creative-build.ts';
const faces=[{h:[-1,-3,-4],add:[-1,-3,-4]},{h:[-2,-3,-4],add:[-3,-3,-4]},{h:[-2,-2,-4],add:[-2,-2,-4]},{h:[-2,-3,-4],add:[-2,-4,-4]},{h:[-2,-3,-3],add:[-2,-3,-3]},{h:[-2,-3,-4],add:[-2,-3,-5]}];
for(const [face,{h,add}] of faces.entries())for(const action of ['add','erase'] as const)test(`creative ${action} face ${face} uses exact plan cell`,()=>{
 const e=new EditorDocument();e.begin();e.volume(-2,-3,-4,0);e.commit();const s=new EditOperationSession(e);s.begin(creativeConfig(2,action));const p=s.creative({x:h[0],y:h[1],z:h[2],face});
 assert.deepEqual(p.dirtyKeys,[(action==='add'?add:[-2,-3,-4]).join(',')]);s.apply(p);s.commit();assert.equal(e.cells.size,action==='add'?2:0);if(action==='add')assert.equal(e.cells.get(add.join(','))?.color,2);e.undo();assert.equal(e.cells.size,1);e.redo();assert.equal(e.cells.size,action==='add'?2:0);
});
test('locked plane ignores newly added support and repeats are noops',()=>{
 const e=new EditorDocument();e.begin();e.volume(0,0,0,0);e.commit();const s=new EditOperationSession(e);s.begin(creativeConfig(1,'add'));for(const x of [0,1,2,2,1])s.apply(s.creative({x,y:0,z:1,face:4},true));s.commit();assert.deepEqual([...e.cells.keys()].sort(),['0,0,0','0,0,1','1,0,1','2,0,1']);assert.equal(e.past.length,2);e.undo();assert.equal(e.cells.size,1);
});
test('occupied target does not create history and cancel rolls back whole stroke',()=>{
 const e=new EditorDocument();e.begin();e.volume(0,0,0,0);e.volume(0,0,1,0);e.commit();const s=new EditOperationSession(e);s.begin(creativeConfig(1,'add'));s.apply(s.creative({x:0,y:0,z:1,face:4}));s.commit();assert.equal(e.past.length,1);const before=structuredClone(e.doc);s.begin(creativeConfig(1,'add'));s.apply(s.creative({x:0,y:0,z:2,face:4}));s.cancel();assert.deepEqual(e.doc,before);
});
test('middle click and drag are mutually exclusive even after returning to origin',()=>{
 const g=new MiddleGesture();g.begin(10,10);g.move(12,12);assert.equal(g.end(),'pick');g.begin(10,10);g.move(30,10);g.move(10,10);assert.equal(g.end(),'pan');g.begin(0,0);g.cancel();assert.equal(g.end(),null);
});
test('fast screen interpolation includes endpoint with at most four pixels per sample',()=>{
 const p=interpolateScreen({clientX:-10,clientY:0},{clientX:70,clientY:0});assert.equal(p.length,20);assert.deepEqual(p.at(-1),{clientX:70,clientY:0});assert.deepEqual(p[0],{clientX:-6,clientY:0});
});
test('creative budget rejects the next cell atomically at 250000',()=>{
 const e=new EditorDocument();for(let x=0;x<250000;x++)e.cells.set(`${x},0,0`,{x,y:0,z:0,color:0});
 const s=new EditOperationSession(e);s.begin(creativeConfig(1,'add'));
 assert.throws(()=>s.creative({x:0,y:0,z:1,face:4}),/预算/);assert.equal(e.cells.size,250000);s.cancel();assert.equal(e.past.length,0);
});
