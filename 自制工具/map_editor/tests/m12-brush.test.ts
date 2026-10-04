import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EditorDocument} from '../core/document.ts';
import {brushCandidates, applyBrush, strokeLine} from '../core/brush.ts';
const config={mode:'volume',action:'add',shape:'square',size:3,thickness:4,level:-2,direction:1,color:1,tag:'walk'};
test('3x3x4 volume uses actual cells and keeps existing color and ownership',()=>{
 const e=new EditorDocument(); e.begin(); e.height(0,0,0,1,0);e.commit(); e.begin();
 const points=brushCandidates(e,{x:0,y:0,z:-2,face:4},config); assert.equal(points.length,36);
 applyBrush(e,points,config);e.commit();assert.equal(e.cells.size,36);
 assert.equal(e.cells.get('0,0,-1').color,0);assert.equal(e.cells.get('0,0,-1').owner,'height');
 assert.ok(e.cells.has('-1,-1,-2'));assert.ok(e.cells.has('1,1,1'));e.undo();assert.equal(e.cells.size,1);
});
test('circle and downward thickness have deterministic negative-coordinate footprint',()=>{
 const e=new EditorDocument();const p=brushCandidates(e,{x:-2,y:-2,z:0,face:4},{...config,shape:'circle',thickness:2,direction:-1,level:0});
 assert.equal(p.length,18);assert.deepEqual([...new Set(p.map(v=>v.z))].sort(),[-1,0]);
 const line=strokeLine({x:-2,y:0},{x:2,y:0});assert.deepEqual(line.map(p=>p.x),[-2,-1,0,1,2]);
});
test('six face thickness follows outward normal without growing from new geometry',()=>{
 const e=new EditorDocument();e.begin();e.volume(0,0,0,0);e.commit();e.begin();
 const c={...config,mode:'stack',size:1,thickness:3};
 const p=brushCandidates(e,{x:1,y:0,z:0,face:0},c);assert.deepEqual(p.map(p=>[p.x,p.y,p.z]),[[1,0,0],[2,0,0],[3,0,0]]);
 applyBrush(e,p,c);applyBrush(e,p,c);e.commit();assert.equal(e.cells.size,4);
});
test('repaint preserves geometry and erase empty positions does not reserve columns',()=>{
 const e=new EditorDocument();e.begin(); const c={...config,size:1,thickness:1,level:0,action:'erase'};applyBrush(e,brushCandidates(e,{x:0,y:0,z:0,face:4},c),c);e.commit();assert.equal(e.doc.revision,0);
 e.begin();e.height(0,0,1,1,0);e.commit();e.begin();const r={...c,action:'repaint',color:2};applyBrush(e,brushCandidates(e,{x:0,y:0,z:0,face:4},r),r);e.commit();assert.equal(e.cells.get('0,0,0').owner,'height');assert.equal(e.cells.get('0,0,0').color,2);
});
test('property area does not penetrate gaps and preview identifies skipped targets',()=>{
 const e=new EditorDocument();e.begin();e.height(0,0,1,1,0);e.height(1,0,0,1,0);e.commit();e.begin();const c={...config,mode:'property',thickness:9};const p=brushCandidates(e,{x:0,y:0,z:1,face:4},c);applyBrush(e,p,c);e.commit();assert.equal(e.doc.surfaces.length,1);assert.equal(p.filter(p=>p.status==='skipped').length,8);
});
test('invalid brush sizes and over-budget batch fail before mutation',()=>{
 const e=new EditorDocument();assert.throws(()=>brushCandidates(e,{x:0,y:0,z:0,face:4},{...config,size:NaN}));assert.throws(()=>brushCandidates(e,{x:0,y:0,z:0,face:4},{...config,size:33,thickness:256}));assert.equal(e.cells.size,0);
});

test('partly out-of-bounds height column skips atomically instead of rolling back neighbors',()=>{
 const e=new EditorDocument();e.begin();e.height(2,0,0,1,0);const c={...config,mode:'height',size:1,level:-8191,thickness:2};const p=brushCandidates(e,{x:0,y:0,z:0,face:4},c);applyBrush(e,p,c);e.commit();assert.equal(e.cells.size,1);assert.ok(e.skipped.size>0);
});

test('height repaint never manufactures geometry in the preview volume',()=>{
 const e=new EditorDocument();e.begin();e.height(0,0,0,1,0);e.commit();e.begin();const c={...config,mode:'height',action:'repaint',size:3,level:2,thickness:4,color:2};applyBrush(e,brushCandidates(e,{x:0,y:0,z:0,face:4},c),c);e.commit();assert.equal(e.cells.size,1);assert.equal(e.cells.get('0,0,-1').color,2);
});
