import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorDocument,createMap} from '../core/document.ts';
import {EditOperationSession,buildRectanglePlan} from '../core/edit-operation.ts';
const config={mode:'stack',action:'add',shape:'square',size:1,thickness:2,level:0,direction:1,color:0,tag:''};
for(const mode of ['stack','creative'])for(const [face,sourceX,wantXs] of [[0,1,[2,3]],[1,2,[0,1]]] as const){
  test(`${mode} rectangle stays on signed starting X face outside its supporting cells`,()=>{
    const e=new EditorDocument(createMap());e.begin();e.volume(sourceX,1,1,0);e.commit();
    const before=structuredClone(e.doc),s=new EditOperationSession(e);s.begin({...config,mode});
    const p=s.rectangle({x:2,y:1,z:1,face},{x:99,y:2,z:3,face:5});
    const xs=mode==='creative'?[face===0?2:1]:[...wantXs];
    assert.equal(p.summary.estimatedAdds,mode==='creative'?6:12);
    assert.deepEqual([...new Set(p.candidates.map(c=>c.x))].sort((a,b)=>a-b),xs);
    assert.deepEqual([...new Set(p.candidates.map(c=>c.face))],[face]);
    s.apply(p);s.commit();assert.equal(e.cells.size,1+(mode==='creative'?6:12));
    e.undo();assert.deepEqual(e.doc.cells,before.cells);e.redo();assert.equal(e.cells.size,1+(mode==='creative'?6:12));
  });
}
test('negative Z and Y surface rectangles use their own tangents rather than the XY work plane',()=>{
  for(const [face,start,end,want] of [
    [5,{x:1,y:2,z:3},{x:2,y:3,z:99},['1,2,2','1,3,2','2,2,2','2,3,2']],
    [3,{x:1,y:2,z:3},{x:2,y:99,z:4},['1,1,3','1,1,4','2,1,3','2,1,4']],
    [2,{x:1,y:2,z:3},{x:2,y:99,z:4},['1,2,3','1,2,4','2,2,3','2,2,4']],
    [4,{x:1,y:2,z:3},{x:2,y:3,z:99},['1,2,3','1,3,3','2,2,3','2,3,3']],
  ] as const){
    const p=buildRectanglePlan(new EditorDocument(createMap()),{...start,face},{...end,face:0},{...config,thickness:1});
    assert.deepEqual(p.candidates.map(c=>`${c.x},${c.y},${c.z}`).sort(),want);
  }
});
test('surface rectangle skips foreign owners with symmetry off and rolls back oversized plans',()=>{
  const e=new EditorDocument(createMap()),s=new EditOperationSession(e);s.begin({...config,mode:'creative',blockedKeys:['1,0,0']});
  const p=s.rectangle({x:0,y:0,z:0,face:4},{x:2,y:0,z:0,face:4});
  assert.equal(p.candidates.find(c=>c.x===1)?.reason,'other-object');s.apply(p);s.commit();assert.deepEqual([...e.cells.keys()].sort(),['0,0,0','2,0,0']);
  s.begin(config);const before=structuredClone(e.doc);assert.throws(()=>s.rectangle({x:0,y:0,z:1,face:4},{x:100,y:100,z:500,face:2}),/预算/);assert.deepEqual(e.doc,before);s.cancel();
});
test('surface erase rectangle removes each picked-face source cell once without reusing the original hit cell',()=>{
  const e=new EditorDocument(createMap());e.begin();for(let y=0;y<2;y++)for(let z=0;z<2;z++)e.volume(0,y,z,0);e.commit();
  const s=new EditOperationSession(e);s.begin({...config,mode:'creative',action:'erase'});
  const start={x:1,y:0,z:0,face:0,cell:{x:0,y:0,z:0}},end={x:1,y:1,z:1,face:0,cell:{x:0,y:1,z:1}};
  const p=s.rectangle(start,end);assert.equal(p.summary.estimatedRemoves,4);s.apply(p);s.commit();assert.equal(e.cells.size,0);e.undo();assert.equal(e.cells.size,4);
});
