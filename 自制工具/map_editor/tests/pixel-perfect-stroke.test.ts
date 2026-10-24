import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelPerfectStroke} from '../core/pixel-perfect-stroke.ts';
import {EditorDocument} from '../core/document.ts';
import {EditOperationSession} from '../core/edit-operation.ts';
const p=(x:number,y:number,z=0)=>({x,y,z,face:4});
const keys=(s:PixelPerfectStroke)=>s.points.map(v=>[v.x,v.y,v.z].join(','));
test('staircase corners become a one-cell diagonal while endpoints stay',()=>{
 const s=new PixelPerfectStroke();for(const v of [p(0,0),p(1,0),p(1,1),p(2,1),p(2,2)])s.sample(v,2);
 assert.deepEqual(keys(s),['0,0,0','1,1,0','2,2,0']);
});
test('long intentional right angle and single click stay intact',()=>{
 const s=new PixelPerfectStroke();s.sample(p(0,0),2);assert.deepEqual(keys(s),['0,0,0']);
 for(const v of [p(1,0),p(2,0),p(2,1),p(2,2)])s.sample(v,2);
 assert.deepEqual(keys(s),['0,0,0','1,0,0','2,0,0','2,1,0','2,2,0']);
});
test('old corner and crossing are never discarded',()=>{
 const s=new PixelPerfectStroke(new Set(['1,0,0']));for(const v of [p(0,0),p(1,0),p(1,1)])s.sample(v,2);
 assert.deepEqual(keys(s),['0,0,0','1,0,0','1,1,0']);
 const cross=new PixelPerfectStroke();for(const v of [p(-1,0),p(0,0),p(1,0),p(0,0),p(0,1)])cross.sample(v,2);
 assert.ok(keys(cross).includes('0,0,0'));assert.ok(keys(cross).includes('1,0,0'));
});
test('plane changes split cleanup and every grid orientation is supported',()=>{
 for(const axis of [0,1,2]){const s=new PixelPerfectStroke();const axes=[0,1,2].filter(a=>a!==axis);
 for(const [u,v] of [[0,0],[1,0],[1,1]]){const c=[3,3,3];c[axes[0]]=u;c[axes[1]]=v;s.sample({x:c[0],y:c[1],z:c[2],face:axis*2},axis);}
 assert.equal(s.points.length,2);}
 const s=new PixelPerfectStroke();s.sample(p(0,0),2);s.sample(p(1,0),2);s.sample(p(1,1,1),2);
 assert.deepEqual(keys(s),['0,0,0','1,0,0','1,1,1']);
});
test('pixel result commits once, protects existing colors and cancels atomically',()=>{
 const e=new EditorDocument();e.begin();e.volume(1,0,0,1);e.commit();const old=structuredClone(e.doc),past=e.past.length;
 const operation=new EditOperationSession(e),config={mode:'volume',action:'add',shape:'square',size:1,thickness:1,level:0,direction:1,color:0,tag:''};
 const stroke=new PixelPerfectStroke(new Set(e.cells.keys()));for(const v of [p(0,0),p(1,0),p(1,1)])stroke.sample(v,2);
 assert.deepEqual(e.doc,old,'sampling never mutates source');operation.begin(config);operation.apply(operation.pixelStroke(stroke.points));operation.commit();
 assert.equal(e.past.length,past+1);assert.equal(e.cells.get('1,0,0').color,1);e.undo();assert.deepEqual(e.doc.cells,old.cells);e.redo();assert.equal(e.cells.size,3);
 const before=structuredClone(e.doc);operation.begin(config);operation.apply(operation.pixelStroke([p(5,5)]));operation.cancel();assert.deepEqual(e.doc,before);
});
