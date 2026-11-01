import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {CanvasView} from '../desktop/canvas-view.ts';import {ReferenceCollectionView} from '../desktop/reference-view.ts';import {CanvasSession} from '../core/workshop-canvases.ts';import {createAsset,type Vec3} from '../core/workshop-documents.ts';
function fixture(step:number,origin:Vec3,content:'model'|'scene'){
 const camera=new THREE.OrthographicCamera(-5,5,5,-5,77,78),scene=new THREE.Scene(),terrain=new THREE.Group(),target=new THREE.Vector3();scene.add(terrain);
 const view:any={camera,scene,terrain,reference:new ReferenceCollectionView(),editable:true,host:{dataset:{previewContent:content}},disposeGeometry:(g:THREE.Group)=>g.clear(),fillTerrain(){},controls:{target,update(){camera.lookAt(target);camera.updateMatrixWorld();}}};
 const session=new CanvasSession(createAsset('restore'));session.active.voxelStepM=step;session.active.originTicks=origin;const canvas=new CanvasView(view);canvas.update(session);return{camera,view,canvas};
}
test('restored world cameras keep the focus target inside the real frustum on model and scene grids',()=>{
 for(const content of ['model','scene']as const)for(const[step,origin]of [[.25,[0,0,0]],[.125,[32,-16,8]],[.0625,[-64,16,-8]]]as [number,Vec3][]){
  const f=fixture(step,origin,content),saved={content,position:new THREE.Vector3(2,4,4),target:new THREE.Vector3(2,3,4),up:new THREE.Vector3(0,0,-1),zoom:3.25};
  f.canvas.restoreView(saved);const matrix=new THREE.Matrix4().multiplyMatrices(f.camera.projectionMatrix,f.camera.matrixWorldInverse),frustum=new THREE.Frustum().setFromProjectionMatrix(matrix);
  assert.ok(frustum.containsPoint(f.view.controls.target),'old large-model near plane must not clip a restored close focus');assert.ok(f.camera.near>0&&f.camera.near<f.camera.position.distanceTo(f.view.controls.target));assert.ok(f.camera.far>f.camera.position.distanceTo(f.view.controls.target));
  const roundtrip=f.canvas.captureView();assert.deepEqual(roundtrip.position.toArray(),saved.position.toArray());assert.deepEqual(roundtrip.target.toArray(),saved.target.toArray());assert.deepEqual(roundtrip.up.toArray(),[0,0,-1]);assert.equal(roundtrip.zoom,3.25);
  for(let i=0;i<5;i++)f.view.controls.update();assert.ok(frustum.containsPoint(f.view.controls.target));assert.deepEqual(f.camera.up.toArray(),[0,0,-1]);
 }
});
test('camera restores cannot mix metre-based scene state with a native model frame',()=>{
 const f=fixture(.125,[32,-16,8],'model'),before=f.camera.position.clone();f.canvas.restoreView({content:'scene',position:new THREE.Vector3(100,100,100),target:new THREE.Vector3(5,5,5),up:new THREE.Vector3(0,1,0),zoom:4});assert.ok(f.camera.position.equals(before));
});
