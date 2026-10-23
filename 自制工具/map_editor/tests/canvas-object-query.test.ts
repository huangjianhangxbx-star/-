import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CanvasObjectQuery} from '../desktop/canvas-object-query.ts';
function fixture(){
 const camera=new THREE.OrthographicCamera(-5,5,5,-5,.01,100);camera.position.set(0,10,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const a=new THREE.Group(),b=new THREE.Group();
 a.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial()));
 b.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial()));b.position.x=3;b.scale.setScalar(2);
 return {camera,a,b,query:new CanvasObjectQuery(camera,[{id:'a',root:a},{id:'b',root:b}])};
}
test('object click identifies the transformed canvas without selecting each voxel',()=>{
 const {query}=fixture();assert.equal(query.pick(0,0),'a');assert.equal(query.pick(.6,0),'b');assert.equal(query.pick(-.8,0),null);
});
test('box selection intersects full canvas bounds, supports reverse drag and excludes invisible canvases',()=>{
 const {camera,a,b,query}=fixture();assert.deepEqual(query.box({x0:.44,y0:-.1,x1:.46,y1:.1}),['b']);
 assert.deepEqual(query.box({x0:.9,y0:.9,x1:-.9,y1:-.9}),['a','b']);
 b.visible=false;assert.deepEqual(new CanvasObjectQuery(camera,[{id:'a',root:a},{id:'b',root:b}]).box({x0:-1,y0:-1,x1:1,y1:1}),['a']);
});
test('selected bounds use all chosen canvas sizes in the shared render frame',()=>{
 const {query}=fixture();const box=query.bounds(['a','b']);assert.deepEqual(box.min.toArray(),[-.5,-1,-1]);assert.deepEqual(box.max.toArray(),[4,1,1]);
 assert.equal(query.bounds([]).isEmpty(),true);
});
