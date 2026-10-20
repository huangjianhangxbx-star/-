import {build} from 'esbuild';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const outfile='validation/canvas-camera-test.mjs';
await build({entryPoints:['desktop/canvas-view.ts'],outfile,bundle:true,platform:'node',format:'esm',packages:'external'});
try {
 const {CanvasView}=await import('../'+outfile+'?t='+Date.now());
 const camera=new THREE.OrthographicCamera(-5,5,4,-4,.01,500);
 camera.position.set(3,9,8);camera.zoom=2;camera.updateProjectionMatrix();
 const view={camera,scene:new THREE.Scene(),controls:{target:new THREE.Vector3(1,0,0),update(){camera.lookAt(this.target);camera.updateMatrixWorld();}}};
 view.controls.update();const cv=new CanvasView(view);
 const before=new THREE.Vector3(.5,.25,-.75).project(camera);
 const saved=cv.captureView();
 cv.frame={step:.0625,origin:[8,-16,4]};
 cv.restoreView(saved);
 const after=new THREE.Vector3((.5-.25)*4,(.25-.125)*4,(-.75-.5)*4).project(camera);
 assert.ok(Math.abs(before.x-after.x)<1e-10&&Math.abs(before.y-after.y)<1e-10,'world point retains screen position across resolution/origin change');
 assert.equal(camera.zoom,.5);
 cv.frame={step:.25,origin:[0,0,0]};cv.restoreView(saved);
 assert.ok(camera.position.distanceTo(new THREE.Vector3(3,9,8))<1e-10);
 console.log('canvas camera: world framing, orbit and zoom retained');
} finally {await fs.unlink(outfile);}
