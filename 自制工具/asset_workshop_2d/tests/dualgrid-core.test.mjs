import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {cornerMask,renderMasks,affectedRender,renderCellGeometry,traceCell}=require('../dual-grid/corner-mask.cjs');
const {createDataGrid}=require('../dual-grid/data-grid.cjs');
const {unityCell,externalIndex,externalOrder}=require('../dual-grid/mapping.cjs');
test('16 independent corner tuples use screen TL1 TR2 BL4 BR8',()=>{
 const tuples=[[0,0,0,0],[1,0,0,0],[0,1,0,0],[1,1,0,0],[0,0,1,0],[1,0,1,0],[0,1,1,0],[1,1,1,0],[0,0,0,1],[1,0,0,1],[0,1,0,1],[1,1,0,1],[0,0,1,1],[1,0,1,1],[0,1,1,1],[1,1,1,1]];
 for(const [want,t]of tuples.entries())assert.equal(cornerMask({TL:t[0],TR:t[1],BL:t[2],BR:t[3]}),want);
 assert.throws(()=>cornerMask({TL:2,TR:0,BL:0,BR:0}));
});
test('sentinel background gives four render cells for one data cell',()=>{
 assert.deepEqual(renderMasks({width:1,height:1,cells:[1]}),{width:2,height:2,cells:[8,4,2,1]});
 assert.deepEqual(renderMasks({width:1,height:1,cells:[0]}).cells,[0,0,0,0]);
 assert.deepEqual(renderMasks({width:2,height:2,cells:[1,0,0,1]}).cells,[8,4,0,2,9,4,0,2,1]);
});
test('one edit changes exactly the four surrounding render cells',()=>{
 const model=createDataGrid({width:3,height:3,cells:Array(9).fill(0)});
 assert.deepEqual(model.paint([{x:1,y:1,value:1}]),[{x:1,y:1,mask:8},{x:2,y:1,mask:4},{x:1,y:2,mask:2},{x:2,y:2,mask:1}]);
 assert.deepEqual(affectedRender(1,1),[{x:1,y:1},{x:2,y:1},{x:1,y:2},{x:2,y:2}]);
 assert.deepEqual(model.paint([{x:1,y:1,value:1}]),[]);
 assert.equal(model.render().cells.filter(Boolean).length,4);
});
test('batch paint is atomic and undo redo restores boundary erasure',()=>{
 const model=createDataGrid({width:2,height:2,cells:[0,0,0,0]});
 assert.throws(()=>model.paint([{x:0,y:0,value:1},{x:2,y:0,value:1}]));assert.deepEqual(model.snapshot().cells,[0,0,0,0]);
 model.paint([{x:0,y:0,value:1},{x:1,y:1,value:1}]);assert.deepEqual(model.snapshot().cells,[1,0,0,1]);model.undo();assert.deepEqual(model.snapshot().cells,[0,0,0,0]);model.redo();assert.deepEqual(model.snapshot().cells,[1,0,0,1]);
 model.paint([{x:1,y:1,value:0}]);assert.deepEqual(model.render().cells,[8,4,0,2,1,0,0,0,0]);
});
test('render geometry has real half-cell offset at actual c over PPU',()=>{
 assert.deepEqual(renderCellGeometry(0,0,128,100),{centerPixels:[0,0],topLeftPixels:[-64,-64],worldCenter:[0,0],worldSize:1.28,worldTopLeft:[-.64,.64]});
 assert.deepEqual(renderCellGeometry(2,3,128,100).worldCenter,[2.56,-3.84]);
 assert.deepEqual(unityCell('data',2,3),[2,-4]);assert.deepEqual(unityCell('render',2,3),[2,-3]);
});
test('trace uses the four true data neighbors and exposes sentinel B',()=>{
 const t=traceCell({width:2,height:2,cells:[1,0,0,1]},1,1);assert.equal(t.mask,9);assert.deepEqual(t.corners,{TL:1,TR:0,BL:0,BR:1});
 const edge=traceCell({width:1,height:1,cells:[1]},0,0);assert.equal(edge.neighbors.TL.outside,true);assert.equal(edge.neighbors.BR.outside,false);assert.equal(edge.mask,8);
});
test('external numeric suffix order is adapted, not assumed to equal mask',()=>{
 assert.deepEqual(Array.from({length:16},(_,m)=>externalIndex(m)),[12,15,8,9,0,11,14,7,13,4,1,10,3,2,5,6]);
 assert.deepEqual(externalOrder(),[4,10,13,12,9,14,15,7,2,3,11,5,0,8,6,1]);
});
test('malformed grid and coordinates cannot partially enter authority',()=>{
 for(const s of [{width:0,height:2,cells:[]},{width:1,height:1,cells:[2]},{width:2,height:1,cells:[0]}])assert.throws(()=>createDataGrid(s));
 assert.throws(()=>renderCellGeometry(0,0,128,0));assert.throws(()=>externalIndex(16));
});
