import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAsset,type Vec3} from '../core/workshop-documents.ts';
import {CanvasSession} from '../core/workshop-canvases.ts';
import {captureTemporaryObjectBrush} from '../core/temporary-object-brush.ts';

const api:any=await import('../desktop/temporary-object-brush-tool.ts').catch((error:any)=>{
 if(error.code==='ERR_MODULE_NOT_FOUND')return {};
 throw error;
});
class Canvas extends EventTarget {
 captured=new Set<number>();
 setPointerCapture(id:number){this.captured.add(id);}
 hasPointerCapture(id:number){return this.captured.has(id);}
 releasePointerCapture(id:number){this.captured.delete(id);}
}
function pointer(canvas:Canvas,type:string,values:Record<string,unknown>={}){
 const event=new Event(type,{cancelable:true});Object.assign(event,{button:0,buttons:type==='pointerdown'?1:0,pointerId:1,clientX:0,clientY:0,isPrimary:true,...values});
 canvas.dispatchEvent(event);return event;
}
function brush(){
 const asset=createAsset('tool-brush');asset.cells=[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:1},{x:0,y:0,z:1,color:1}];
 const session=new CanvasSession(asset);session.patch({voxelStepM:.125});
 const id=session.joinObjects(session.model.objects!.map(o=>o.objectId),session.model.objects![0].objectId)!;
 return captureTemporaryObjectBrush(session.model,id);
}
function setup(){
 assert.equal(typeof api.TemporaryObjectBrushTool,'function','Temporary object brush pointer tool is missing');
 const canvas=new Canvas(),scene=new THREE.Scene(),controls={enabled:true},stamps:Vec3[]=[],messages:string[]=[];
 let allowed=true,frame={originTicks:[0,0,0] as Vec3,voxelStepM:.25},hit:{pointTicks:Vec3;face?:number|string}|null={pointTicks:[40,40,8],face:4},draws=0;
 const tool=new api.TemporaryObjectBrushTool({canvas,view:{scene,controls,requestPaintRender(){draws++;}},frame:()=>frame,enabled:()=>allowed,hit:()=>hit,stamp:(point:Vec3)=>{stamps.push(point);},message:(message:string)=>messages.push(message)});
 const preview=()=>scene.children.find(o=>o.userData.temporaryObjectBrush) as THREE.Group;
 return {canvas,scene,controls,stamps,messages,tool,preview,setAllowed:(v:boolean)=>allowed=v,setHit:(v:typeof hit)=>hit=v,setFrame:(v:typeof frame)=>frame=v,draws:()=>draws};
}

test('preview follows the actual voxel shape and reuses its GPU geometry while the pointer moves',()=>{
 const s=setup();s.tool.setBrush(brush());assert.equal(s.tool.active,true);
 const group=s.preview(),mesh=group.children[0] as THREE.InstancedMesh;
 assert.equal(mesh.isInstancedMesh,true);assert.equal(mesh.count,3,'An L-shaped brush must not become its filled bounding box');
 assert.equal((mesh.material as THREE.Material).transparent,true);assert.ok((mesh.material as THREE.Material).opacity<1);
 pointer(s.canvas,'pointermove');assert.equal(group.visible,true);assert.deepEqual(group.position.toArray(),[1.25,.25,-1.3125]);
 const geometry=mesh.geometry,material=mesh.material,matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
 assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(new THREE.Vector3(-.0625,.0625,0))<1e-9);
 s.setHit({pointTicks:[56,40,8],face:4});pointer(s.canvas,'pointermove');
 assert.equal(s.preview(),group);assert.equal(group.children[0],mesh);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);
 assert.deepEqual(group.position.toArray(),[1.75,.25,-1.3125]);assert.ok(s.draws()>0);
 s.tool.dispose();
});

test('active-canvas frame changes only transform the cached preview and preserve the physical voxel size',()=>{
 const s=setup();s.tool.setBrush(brush());pointer(s.canvas,'pointermove');const group=s.preview(),mesh=group.children[0];
 s.setFrame({originTicks:[8,-4,0],voxelStepM:.0625});pointer(s.canvas,'pointermove');
 assert.equal(group.children[0],mesh);assert.deepEqual(group.scale.toArray(),[4,4,4]);
 assert.deepEqual(group.position.toArray(),[4,1,-5.75]);s.tool.dispose();
});

test('left-button release stamps once immediately and allows repeated clicks without Enter',async()=>{
 const s=setup();s.tool.setBrush(brush());
 const down=pointer(s.canvas,'pointerdown');assert.equal(down.defaultPrevented,true);assert.equal(s.controls.enabled,false);assert.equal(s.stamps.length,0);
 const up=pointer(s.canvas,'pointerup');assert.equal(up.defaultPrevented,true);assert.equal(s.controls.enabled,true);
 assert.deepEqual(s.stamps,[[40,42,8]]);await Promise.resolve();
 s.setHit({pointTicks:[56,40,8],face:4});pointer(s.canvas,'pointerdown');pointer(s.canvas,'pointerup');
 assert.deepEqual(s.stamps,[[40,42,8],[56,42,8]]);s.tool.dispose();
});

test('each face offsets the complete shape outward while keeping the source grid phase',async()=>{
 const s=setup(),b=brush();s.tool.setBrush(b);
 const cases:Array<[number|string,Vec3]>=[[0,[44,42,8]],[1,[36,42,8]],[2,[40,42,8]],[3,[40,38,8]],[4,[40,42,8]],[5,[40,42,0]],['+x',[44,42,8]],['-z',[40,42,0]]];
 for(const [face,expected]of cases){s.setHit({pointTicks:[40,40,8],face});pointer(s.canvas,'pointerdown');pointer(s.canvas,'pointerup');assert.deepEqual(s.stamps.at(-1),expected);await Promise.resolve();}
 // A surface between grid planes must not make a snapped preview penetrate it.
 for(const [face,expected]of [[0,[16,42,8]],[1,[4,42,8]]] as Array<[number,Vec3]>){s.setHit({pointTicks:[9,40,8],face});pointer(s.canvas,'pointerdown');pointer(s.canvas,'pointerup');assert.deepEqual(s.stamps.at(-1),expected);await Promise.resolve();}
 s.tool.dispose();
});

test('right and middle buttons remain available for camera navigation, and inactive tools do not consume input',()=>{
 const s=setup();s.tool.setBrush(brush());
 for(const button of [1,2])for(const type of ['pointerdown','pointerup'])assert.equal(pointer(s.canvas,type,{button}).defaultPrevented,false);
 assert.equal(s.stamps.length,0);assert.equal(s.controls.enabled,true);
 s.setAllowed(false);assert.equal(s.tool.active,false);assert.equal(s.tool.hasBrush,true,'An inactive brush still owns its snapshot');assert.equal(pointer(s.canvas,'pointerdown').defaultPrevented,false);pointer(s.canvas,'pointermove');assert.equal(s.preview().visible,false);s.tool.dispose();
});

test('misses and cancelled gestures do not stamp and restore pointer capture plus camera controls',()=>{
 const s=setup();s.tool.setBrush(brush());s.setHit(null);
 pointer(s.canvas,'pointerdown');pointer(s.canvas,'pointerup');assert.equal(s.stamps.length,0);assert.equal(s.preview().visible,false);
 s.setHit({pointTicks:[40,40,8],face:4});pointer(s.canvas,'pointerdown');assert.equal(s.canvas.captured.has(1),true);
 s.tool.cancelGesture();assert.equal(s.canvas.captured.size,0);assert.equal(s.controls.enabled,true);pointer(s.canvas,'pointerup');assert.equal(s.stamps.length,0);
 pointer(s.canvas,'pointerdown');pointer(s.canvas,'pointercancel');assert.equal(s.canvas.captured.size,0);assert.equal(s.controls.enabled,true);assert.equal(s.stamps.length,0);s.tool.dispose();
});

test('failed asynchronous stamps report the reason and a busy stamp cannot enqueue duplicates',async()=>{
 assert.equal(typeof api.TemporaryObjectBrushTool,'function','Temporary object brush pointer tool is missing');
 const canvas=new Canvas(),messages:string[]=[],scene=new THREE.Scene();let calls=0,reject:(reason:Error)=>void=()=>{};
 const tool=new api.TemporaryObjectBrushTool({canvas,view:{scene,controls:{enabled:true},requestPaintRender(){}},frame:()=>({originTicks:[0,0,0],voxelStepM:.25}),enabled:()=>true,hit:()=>({pointTicks:[40,40,8],face:4}),stamp:()=>{calls++;return new Promise<void>((_,no)=>reject=no);},message:(m:string)=>messages.push(m)});
 tool.setBrush(brush());pointer(canvas,'pointerdown');pointer(canvas,'pointerup');pointer(canvas,'pointerdown');pointer(canvas,'pointerup');assert.equal(calls,1);
 reject(Error('位置已占用'));await new Promise(resolve=>setImmediate(resolve));assert.ok(messages.some(m=>m.includes('位置已占用')));
 pointer(canvas,'pointerdown');pointer(canvas,'pointerup');assert.equal(calls,2);tool.dispose();reject(Error('closed'));await new Promise(resolve=>setImmediate(resolve));
});

test('restoring the voxel brush and disposal release preview resources and event listeners',()=>{
 const s=setup();s.tool.setBrush(brush());const old=s.preview(),mesh=old.children[0] as THREE.InstancedMesh;let geometryDisposed=false,materialDisposed=false;
 mesh.geometry.addEventListener('dispose',()=>geometryDisposed=true);(mesh.material as THREE.Material).addEventListener('dispose',()=>materialDisposed=true);
 s.tool.setBrush(null);assert.equal(s.tool.active,false);assert.equal(s.tool.hasBrush,false);assert.equal(old.parent,null);assert.equal(geometryDisposed,true);assert.equal(materialDisposed,true);
 s.tool.setBrush(brush());s.tool.dispose();assert.equal(s.scene.children.length,0);assert.equal(pointer(s.canvas,'pointerdown').defaultPrevented,false);assert.equal(s.stamps.length,0);
});
