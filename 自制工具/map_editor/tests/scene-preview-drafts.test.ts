import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ScenePreviewLayer,type ScenePreviewData} from '../desktop/scene-preview-layer.ts';
import {createAsset,createScene} from '../core/workshop-documents.ts';

function data(x=0):ScenePreviewData{
 const asset=createAsset('a');asset.cells=[{x,y:0,z:0,color:0}];const scene=createScene('s');scene.assets=[{kind:'voxel',assetId:'a',source:'assets/a.xhmodule.json'}];scene.instances=[{instanceId:'one',assetId:'a',positionM:[0,0,0],rotationDeg:0,groupId:'base'}];
 return{scene,assets:new Map([['a',asset]]),binaries:new Map()};
}
test('same-revision detached native geometry and V1 face tone replace their actual rendered content',async()=>{
 const layer=new ScenePreviewLayer(),original=data();await layer.update(original);assert.equal(layer.bounds().min.x,0);
 const moved=data(4);assert.equal(moved.assets.get('a')!.revision,original.assets.get('a')!.revision);await layer.update(moved);assert.equal(layer.bounds().min.x,1);
 const dark=structuredClone(moved);dark.assets.get('a')!.faceTone={schema:'xinghai-face-tone-1',faces:Object.fromEntries([0,1,2,3,4,5].map(f=>['4,0,0,'+f,{gain:0,affectPaint:false}]))};
 await layer.update(dark);let colored=false;layer.root.traverse((node:any)=>{if(node.userData.viewportRole==='model')colored=Array.from(node.geometry.attributes.color.array as Float32Array).some(v=>v!==0);});assert.equal(colored,false,'legacy root faceTone changes cannot reuse the bright source geometry cache');
 assert.equal(original.assets.get('a')!.cells[0].x,0);assert.equal(original.assets.get('a')!.faceTone,undefined);layer.dispose();
});
test('invalidating an in-flight binary load leaves the already mounted scene unchanged',async()=>{
 const layer=new ScenePreviewLayer();await layer.update(data());const old=layer.bounds().clone();let release!:(value:THREE.Object3D)=>void;
 // The only replaced boundary is asynchronous binary I/O; real generation and geometry code still run.
 (layer as any).binary=()=>new Promise<THREE.Object3D>(resolve=>release=resolve);
 const stale=data(40);stale.binaries.set('delayed',{row:{kind:'external'},data:'deferred-loader'});const pending=layer.update(stale);
 assert.equal(typeof(layer as any).invalidate,'function');(layer as any).invalidate();release(new THREE.Group());assert.equal(await pending,false);assert.ok(layer.bounds().equals(old));layer.dispose();
});
