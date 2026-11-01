import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const api:any=await import('../desktop/preview-scene-binding.ts').catch((error:any)=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
function binding(scene:THREE.Scene,preservedRoots:readonly THREE.Object3D[]=[]){assert.equal(typeof api.PreviewSceneBinding,'function','Preview scene binding is missing');return new api.PreviewSceneBinding(scene,preservedRoots);}

test('external preview isolates native roots, preserves lights, and restores originally hidden content',()=>{
 const scene=new THREE.Scene(),shown=new THREE.Group(),hidden=new THREE.Group(),light=new THREE.DirectionalLight(),offLight=new THREE.PointLight(),preview=new THREE.Group();
 hidden.visible=false;offLight.visible=false;scene.add(shown,hidden,light,offLight);
 const b=binding(scene);assert.equal(b.active,false);b.set(preview);
 assert.equal(b.active,true);assert.equal(preview.parent,scene);assert.equal(preview.visible,true);
 assert.equal(shown.visible,false);assert.equal(hidden.visible,false);assert.equal(light.visible,true);assert.equal(offLight.visible,false);
 b.set(null);assert.equal(b.active,false);assert.equal(preview.parent,null);assert.equal(shown.visible,true);assert.equal(hidden.visible,false);assert.equal(light.visible,true);assert.equal(offLight.visible,false);
});

test('explicitly preserved nested light rigs remain visible while ordinary light-bearing model groups stay isolated',()=>{
 const scene=new THREE.Scene(),lightRig=new THREE.Group(),nested=new THREE.Group(),native=new THREE.Group(),preview=new THREE.Group();
 nested.add(new THREE.DirectionalLight());lightRig.add(nested);native.add(new THREE.PointLight(),new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));scene.add(lightRig,native);
 const b=binding(scene,[lightRig]);b.set(preview);b.sync();
 assert.equal(lightRig.visible,true,'Display lights live inside an explicitly preserved Group');assert.equal(nested.visible,true);
 assert.equal(native.visible,false,'Containing a light must not exempt an ordinary model group');
 native.visible=true;b.sync();assert.equal(native.visible,false);assert.equal(lightRig.visible,true);
 b.set(null);assert.equal(native.visible,true);assert.equal(lightRig.visible,true);
});

test('sync isolates newly rebuilt roots and asynchronous visibility changes without replacing original snapshots',()=>{
 const scene=new THREE.Scene(),shown=new THREE.Group(),hidden=new THREE.Group(),preview=new THREE.Group();hidden.visible=false;scene.add(shown,hidden);
 const b=binding(scene);b.set(preview);
 const newShown=new THREE.Group(),newHidden=new THREE.Group(),newLight=new THREE.HemisphereLight();newHidden.visible=false;scene.add(newShown,newHidden,newLight);b.sync();
 assert.equal(newShown.visible,false);assert.equal(newHidden.visible,false);assert.equal(newLight.visible,true);
 for(let i=0;i<3;i++){shown.visible=true;hidden.visible=true;newShown.visible=true;newHidden.visible=true;b.sync();assert.ok([shown,hidden,newShown,newHidden].every(root=>!root.visible));}
 b.set(null);assert.equal(shown.visible,true);assert.equal(hidden.visible,false);assert.equal(newShown.visible,true);assert.equal(newHidden.visible,false);
});

test('replacing a preview root keeps native visibility isolated and only removes the previous external root',()=>{
 const scene=new THREE.Scene(),native=new THREE.Group(),first=new THREE.Group(),second=new THREE.Group();scene.add(native);
 const b=binding(scene);b.set(first);b.set(first);b.set(second);
 assert.equal(first.parent,null);assert.equal(second.parent,scene);assert.equal(second.visible,true);assert.equal(native.visible,false);
 scene.remove(second);native.visible=true;b.sync();assert.equal(second.parent,scene);assert.equal(native.visible,false,'A scene rebuild must not reveal native geometry');
 b.set(null);assert.equal(second.parent,null);assert.equal(native.visible,true);
 b.set(first);assert.equal(native.visible,false);b.set(null);assert.equal(native.visible,true);
});

test('binding never disposes caller-owned geometry or materials and preserves external-root visibility',()=>{
 const scene=new THREE.Scene(),native=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),first=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),second=new THREE.Group();scene.add(native);
 let disposed=0;for(const mesh of [native,first]){mesh.geometry.addEventListener('dispose',()=>disposed++);(mesh.material as THREE.Material).addEventListener('dispose',()=>disposed++);}
 first.visible=false;const b=binding(scene);b.set(first);b.sync();assert.equal(first.visible,false);b.set(second);b.set(null);b.sync();
 assert.equal(disposed,0);assert.equal(native.parent,scene);assert.equal(first.parent,null);assert.equal(second.parent,null);
});
