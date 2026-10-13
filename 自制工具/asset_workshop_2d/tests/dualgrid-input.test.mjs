import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{dataCellAt,renderCellAt,lineCells,rectangleCells}=require('../desktop/dualgrid-input.cjs');
test('pointer targets data cells offset by half the displayed cell, not render cells',()=>{
 assert.equal(dataCellAt(5,20,40,8,8),null);assert.deepEqual(dataCellAt(21,21,40,8,8),{x:0,y:0});assert.deepEqual(dataCellAt(61,21,40,8,8),{x:1,y:0});assert.deepEqual(renderCellAt(61,21,40,9,9),{x:1,y:0});assert.equal(dataCellAt(350,350,40,8,8),null);
});
test('drag interpolation fills skipped data cells along both diagonal directions',()=>{
 assert.deepEqual(lineCells({x:0,y:0},{x:3,y:3},1),[{x:0,y:0,value:1},{x:1,y:1,value:1},{x:2,y:2,value:1},{x:3,y:3,value:1}]);assert.deepEqual(lineCells({x:3,y:1},{x:0,y:1},0),[{x:3,y:1,value:0},{x:2,y:1,value:0},{x:1,y:1,value:0},{x:0,y:1,value:0}]);
});
test('rectangle inclusive corners work in reverse drag and retain explicit eraser value',()=>{
 assert.deepEqual(rectangleCells({x:2,y:1},{x:1,y:0},0),[{x:1,y:0,value:0},{x:2,y:0,value:0},{x:1,y:1,value:0},{x:2,y:1,value:0}]);
});
