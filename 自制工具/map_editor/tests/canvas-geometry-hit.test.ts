import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CanvasView} from '../desktop/canvas-view.ts';
import {ReferenceCollectionView} from '../desktop/reference-view.ts';
import {createAsset} from '../core/workshop-documents.ts';
import {CanvasSession} from '../core/workshop-canvases.ts';

function fixture(edit=false){
 const asset=createAsset('geometry-hit');asset.cells=[{x:0,y:0,z:0,color:0}];const session=new CanvasSession(asset);
 if(edit)session.setEditObject(session.model.objects![0].objectId);
 const scene=new THREE.Scene(),terrain=new THREE.Group();scene.add(terrain);
 const ray=new THREE.Raycaster(new THREE.Vector3(.125,.125,1),new THREE.Vector3(0,0,-1));
 const calls:Array<{meshes:THREE.Object3D[];recursive:boolean}>=[];
 const view:any={scene,terrain,reference:new ReferenceCollectionView(),editable:true,host:{dataset:{}},camera:new THREE.PerspectiveCamera(),disposeGeometry:(group:THREE.Group)=>group.clear(),fillTerrain(){},ray:()=>({intersectObjects:(meshes:THREE.Object3D[],recursive:boolean)=>{calls.push({meshes,recursive});return ray.intersectObjects(meshes,recursive);}})};
 const canvas=new CanvasView(view);canvas.update(session);
 canvas.objectEntries=()=>{throw Error('Geometry pointer queries must not allocate per-voxel object boxes');};
 const add=(parent:THREE.Object3D,z:number)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(.25,.25,.25),new THREE.MeshBasicMaterial());mesh.position.set(.125,.125,z);parent.add(mesh);return mesh;};
 const hit=()=>{assert.equal(typeof (canvas as any).surfaceGeometryHit,'function','Public cached geometry hit is missing');return (canvas as any).surfaceGeometryHit({clientX:0,clientY:0} as PointerEvent) as THREE.Intersection<THREE.Mesh>|undefined;};
 return {canvas,session,terrain,scene,calls,view,add,hit};
}

test('geometry hit works in object mode and reuses a flattened geometry candidate list between pointer events',()=>{
 const f=fixture(),nested=new THREE.Group();f.terrain.add(nested);const mesh=f.add(nested,-.125);
 assert.equal(f.session.editObjectId,null);
 for(let i=0;i<5;i++){const hit=f.hit();assert.equal(hit?.object,mesh);assert.ok(hit?.face);}
 assert.equal(f.calls.length,5);assert.ok(f.calls.every(call=>call.recursive===false));
 assert.ok(f.calls.every(call=>call.meshes===f.calls[0].meshes),'Hover should reuse its geometry candidates instead of rebuilding an object/cell query');
 assert.ok(f.calls[0].meshes.every(mesh=>(mesh as THREE.Mesh).isMesh));
});

test('cached geometry queries track hidden ancestors and meshes becoming visible without allocating voxel boxes',()=>{
 const f=fixture(),nearRoot=new THREE.Group();f.terrain.add(nearRoot);const near=f.add(nearRoot,.375),far=f.add(f.terrain,-.125);
 nearRoot.visible=false;assert.equal(f.hit()?.object,far);
 nearRoot.visible=true;assert.equal(f.hit()?.object,near);
 near.visible=false;assert.equal(f.hit()?.object,far);
 f.terrain.visible=false;assert.equal(f.hit(),undefined);
});

test('canvas update invalidates cached geometry after a terrain rebuild even when the source signature is unchanged',()=>{
 const f=fixture(),old=f.add(f.terrain,-.125);assert.equal(f.hit()?.object,old);
 f.terrain.clear();const next=f.add(f.terrain,-.375);f.canvas.update(f.session);
 assert.equal(f.hit()?.object,next);assert.ok(!f.calls.at(-1)!.meshes.includes(old));
});

test('paint hit uses the public geometry query and records exactly one raycast per surface query',()=>{
 const f=fixture(true);f.add(f.terrain,-.125);const previous=(globalThis as any).__paintPerformance;
 (globalThis as any).__paintPerformance={counts:{},samples:{}};
 try{
  assert.equal(typeof (f.canvas as any).surfaceGeometryHit,'function','Public cached geometry hit is missing');
  const paint=f.canvas.paintHit({clientX:0,clientY:0} as PointerEvent);
  assert.equal(paint?.key,'0,0,0,3');assert.equal((globalThis as any).__paintPerformance.counts.raycast,1);
  assert.ok(f.hit());assert.equal((globalThis as any).__paintPerformance.counts.raycast,2);
 }finally{if(previous===undefined)delete (globalThis as any).__paintPerformance;else (globalThis as any).__paintPerformance=previous;}
});
