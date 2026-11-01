import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CanvasView} from '../desktop/canvas-view.ts';
import {ReferenceCollectionView} from '../desktop/reference-view.ts';
import {CanvasSession,CANVAS_TICK} from '../core/workshop-canvases.ts';
import {createAsset,type Vec3} from '../core/workshop-documents.ts';
import {EditOperationSession} from '../core/edit-operation.ts';
import {faceNormals} from '../core/surface.ts';

function fixture(targetStep=.25,sourceStep=.25,targetOrigin:Vec3=[0,0,0],sourceOrigin:Vec3=[0,0,0]){
 const asset=createAsset('brush-surface');asset.schema='xinghai-workshop-asset-2';asset.cells=[];
 asset.canvases=[{canvasId:'target',name:'空画布',visible:true,locked:false,voxelStepM:targetStep,originTicks:targetOrigin,protectedColumns:[],cells:[]},{canvasId:'source',name:'参考物体',visible:true,locked:true,voxelStepM:sourceStep,originTicks:sourceOrigin,protectedColumns:[],cells:[{x:0,y:0,z:0,color:0}]}];
 const session=new CanvasSession(asset),scene=new THREE.Scene(),terrain=new THREE.Group(),ray=new THREE.Raycaster(),candidates:THREE.Object3D[][]=[];scene.add(terrain);
 const view:any={scene,terrain,reference:new ReferenceCollectionView(),editable:true,host:{dataset:{}},camera:new THREE.PerspectiveCamera(),section:null,disposeGeometry:(g:THREE.Group)=>g.clear(),fillTerrain:(g:THREE.Group,a:any)=>{for(const c of a.cells){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.25,.25,.25),new THREE.MeshBasicMaterial());mesh.position.set((c.x+.5)*.25,(c.z+.5)*.25,-(c.y+.5)*.25);g.add(mesh);}},ray:()=>({intersectObjects:(meshes:THREE.Object3D[],recursive:boolean)=>{assert.equal(recursive,false);candidates.push(meshes);return ray.intersectObjects(meshes,false);}})};
 const canvas=new CanvasView(view);canvas.update(session);canvas.objectEntries=()=>{throw Error('surface brush picking may not allocate voxel object boxes');};
 function aim(face:number){const normal=faceNormals[face],sourcePoint=[.5,.5,.5];sourcePoint[Math.floor(face/2)]=face%2?0:1;
  const p=sourcePoint.map((v,a)=>(sourceOrigin[a]*CANVAS_TICK+v*sourceStep-targetOrigin[a]*CANVAS_TICK)/targetStep*.25),n=new THREE.Vector3(normal[0],normal[2],-normal[1]),point=new THREE.Vector3(p[0],p[2],-p[1]);ray.set(point.clone().addScaledVector(n,10),n.negate());
 }
 function hit(){assert.equal(typeof (canvas as any).surfaceBrushHit,'function','cached cross-canvas brush picking is missing');return (canvas as any).surfaceBrushHit({clientX:0,clientY:0} as PointerEvent);}
 return {canvas,session,scene,terrain,ray,candidates,view,aim,hit};
}

test('an empty native canvas builds beside another locked canvas without changing that source',()=>{
 for(const [targetStep,sourceStep,face,want] of [[.25,.25,4,[0,0,1]],[.125,.25,4,[1,1,2]],[.25,.125,4,[0,0,1]],[.25,.125,5,[0,0,-1]]] as const){
  const f=fixture(targetStep,sourceStep),source=structuredClone(f.session.model.canvases![1]);f.aim(face);const hit=f.hit();assert.ok(hit);assert.equal(hit.sourceCanvasId,'source');assert.equal('cell' in hit,false,'foreign source ownership is never passed as an editable cell');
  const op=new EditOperationSession(f.session.editor);op.begin({mode:'stack',action:'add',shape:'square',size:1,thickness:1,level:0,direction:1,color:0,tag:''});op.apply(op.brush(hit));op.commit();f.session.sync();
  assert.deepEqual(f.session.active.cells.map(c=>[c.x,c.y,c.z]),[want]);assert.deepEqual(f.session.model.canvases![1],source);f.session.undo();assert.equal(f.session.active.cells.length,0);assert.deepEqual(f.session.model.canvases![1],source);
 }
});
test('signed six-face hits account for both origins and round coarse target placement away from the source',()=>{
 for(const [face,want] of [[0,[2,-2,2]],[1,[1,-2,2]],[2,[1,-1,2]],[3,[1,-2,2]],[4,[1,-2,3]],[5,[1,-2,2]]] as const){
  const f=fixture(.25,.125,[8,-8,0],[16,-24,16]);f.aim(face);const h=f.hit();assert.ok(h);assert.deepEqual([h.x,h.y,h.z],want);assert.equal(h.face,face);
 }
});
test('hidden and zero-opacity source canvases are ignored while cached geometry is reused',()=>{
 const f=fixture();f.aim(4);assert.ok(f.hit());for(let i=0;i<5;i++)assert.ok(f.hit());assert.ok(f.candidates.every(c=>c===f.candidates[0]));
 f.canvas.setOpacity('source',0);assert.equal(f.hit(),null);f.canvas.setOpacity('source',.2);assert.ok(f.hit());
 f.session.model.canvases![1].visible=false;f.canvas.update(f.session);assert.equal(f.hit(),null);
});
test('an obsolete active display mesh cannot hide a valid external support during a rebuild',()=>{
 const f=fixture(),stale=new THREE.Mesh(new THREE.BoxGeometry(.25,.25,.25),new THREE.MeshBasicMaterial());
 stale.position.set(.125,.875,-.125);f.terrain.add(stale);f.aim(4);
 assert.equal(f.canvas.surfaceGeometryHit({clientX:0,clientY:0} as PointerEvent)?.object,stale,'ordinary geometry queries still include the active display');
 assert.equal(f.hit()?.sourceCanvasId,'source','external brush support ignores the active display; live active voxels are picked separately');
});
test('surface face follows transformed mesh normals instead of assuming local normal axes',()=>{
 const f=fixture(),group=(f.canvas as any).group as THREE.Group;group.rotation.z=Math.PI/2;group.scale.set(2,1,3);
 f.ray.set(new THREE.Vector3(-.125,5,-.125),new THREE.Vector3(0,-1,0));const h=f.hit();assert.ok(h);assert.equal(h.face,4,'rotated local +X becomes target +Z');
});
test('negative fine-grid source faces snap outward instead of rounding into their own half-cell',()=>{
 for(const face of [1,3,5]){
  const f=fixture(.25,.125,[0,0,0],[4,4,4]);f.aim(face);const h=f.hit();assert.ok(h);assert.deepEqual([h.x,h.y,h.z],[0,0,0]);
  const op=new EditOperationSession(f.session.editor);op.begin({mode:'stack',action:'add',shape:'square',size:1,thickness:1,level:0,direction:1,color:0,tag:''});const p=op.brush(h);
  const want=face===1?[-1,0,0]:face===3?[0,-1,0]:[0,0,-1];assert.deepEqual(p.candidates.map(c=>[c.x,c.y,c.z]),[want]);op.cancel();
 }
});
test('surface picking ignores the clipped-away nearest face and keeps distance to the next visible face',()=>{
 const f=fixture();f.aim(4);f.view.section=.5;
 const clipped=f.hit();assert.equal(clipped,null,'source top at one target cell lies above section .5');
 f.session.model.canvases!.push({...structuredClone(f.session.model.canvases![1]),canvasId:'far',originTicks:[0,0,-8]});f.canvas.update(f.session);
 const lower=f.hit();assert.ok(lower);assert.equal(lower.sourceCanvasId,'far');assert.equal(lower.z,0);assert.ok(Math.abs(lower.distance-10.25)<1e-7);
 f.view.section=null;f.view.renderer={clippingPlanes:[new THREE.Plane(new THREE.Vector3(0,-1,0),.125)]};
 assert.equal(f.hit()?.sourceCanvasId,'far','the renderer clipping plane must match picking visibility');
 f.view.renderer.clippingPlanes=[];const shown=f.hit();assert.ok(shown);assert.ok(shown.distance>0);assert.ok(Math.abs(shown.distance-10)<1e-7);
});
