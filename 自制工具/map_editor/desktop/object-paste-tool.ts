import * as THREE from 'three';
import {ProjectedAxisDrag,type ScreenPoint} from '../core/axis-line-stroke.ts';
import type {ModelObjectClipboard} from '../core/model-objects.ts';
import type {Vec3} from '../core/workshop-documents.ts';
import type {MapView} from './view.ts';

type Options={canvas:HTMLCanvasElement;view:Pick<MapView,'scene'|'camera'|'controls'|'host'|'requestPaintRender'>;frame:()=>{originTicks:Vec3;voxelStepM:number}|null;enabled:()=>boolean;pointer:()=>ScreenPoint|null;message:(text:string,error?:boolean)=>void;changed?:()=>void};
/** Non-destructive object paste ghost. Only the confirmation callback changes source data. */
export class ObjectPasteTool {
 private options:Options;
 private root:THREE.Group|null=null;
 private hint:HTMLElement|null=null;
 private drag=new ProjectedAxisDrag();
 private delta:Vec3=[0,0,0];
 private pivot:Vec3=[0,0,0];
 private stride=8;
 private commit:((delta:Vec3)=>void|Promise<void>)|null=null;
 private press:{id:number;controls:boolean}|null=null;
 private busy=false;
 private generation=0;
 private disposed=false;
 constructor(options:Options){
  this.options=options;const c=options.canvas;c.addEventListener('pointermove',this.move,true);c.addEventListener('pointerdown',this.down,true);c.addEventListener('pointerup',this.up,true);c.addEventListener('pointercancel',this.abort,true);c.ownerDocument.addEventListener('keydown',this.key,true);
 }
 get active(){return !this.disposed&&this.root!==null;}
 begin(clipboard:ModelObjectClipboard,commit:(delta:Vec3)=>void|Promise<void>){
  if(this.disposed)return;if(!clipboard.objects.length||!clipboard.canvases.some(c=>c.cells.length))throw Error('请先复制包含体素的物体');
  this.cancel();this.commit=commit;this.delta=[0,0,0];this.pivot=[...clipboard.objects[0].originTicks];this.stride=Math.max(...clipboard.canvases.map(c=>c.voxelStepM/.03125));
  const root=new THREE.Group();root.name='object-paste-preview';root.userData.objectPaste=true;
  for(const canvas of clipboard.canvases){if(!canvas.cells.length)continue;
   const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(canvas.voxelStepM,canvas.voxelStepM,canvas.voxelStepM),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.45,depthWrite:false}),canvas.cells.length),matrix=new THREE.Matrix4(),color=new THREE.Color();
   canvas.cells.forEach((cell,index)=>{const p=[cell.x,cell.y,cell.z].map((v,i)=>canvas.originTicks[i]*.03125+(v+.5)*canvas.voxelStepM);matrix.makeTranslation(p[0],p[2],-p[1]);mesh.setMatrixAt(index,matrix);mesh.setColorAt(index,color.set(clipboard.palette[cell.color]));});
   mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.renderOrder=9;mesh.raycast=()=>{};root.add(mesh);
  }
  this.root=root;this.options.view.scene.add(root);
  if(typeof this.options.canvas.ownerDocument.createElement==='function'){this.hint=this.options.canvas.ownerDocument.createElement('div');this.hint.className='object-paste-hint';Object.assign(this.hint.style,{position:'absolute',left:'14px',bottom:'14px',padding:'7px 10px',background:'#20292ee8',color:'#f0d194',border:'1px solid #b68c4a',pointerEvents:'none',zIndex:'20',fontSize:'12px'});this.options.view.host.append(this.hint);}
  this.startAxis(this.options.pointer()??this.project(this.pivot.map(v=>v/this.stride) as Vec3)!);this.show();this.options.changed?.();this.options.message('物体粘贴预览：鼠标沿最近 X / Y / Z 轴移动 · 左键放置 · Esc 在复制源位置落地');
 }
 private project=(point:Vec3):ScreenPoint|null=>{
  const frame=this.options.frame();if(!frame)return null;const scale=.25/frame.voxelStepM,p=point.map((v,i)=>(v*this.stride-frame.originTicks[i])*.03125*scale),screen=new THREE.Vector3(p[0],p[2],-p[1]).project(this.options.view.camera),r=this.options.canvas.getBoundingClientRect();
  return {clientX:r.left+(screen.x+1)*r.width/2,clientY:r.top+(1-screen.y)*r.height/2};
 };
 private startAxis(pointer:ScreenPoint){this.drag.begin(this.pivot.map((v,i)=>(v+this.delta[i])/this.stride) as Vec3,pointer,this.project);}
 private show(){
  const frame=this.options.frame();if(!frame||!this.root)return;const scale=.25/frame.voxelStepM,p=this.delta.map((v,i)=>(v-frame.originTicks[i])*.03125*scale);this.root.scale.setScalar(scale);this.root.position.set(p[0],p[2],-p[1]);
  const data=this.options.view.host.dataset;data.objectPaste='preview';data.objectPasteDelta=JSON.stringify(this.delta);data.objectPasteAxis=this.drag.axis===null?'pending':['X','Y','Z'][this.drag.axis];
  if(this.hint)this.hint.textContent=`物体粘贴 · ${this.drag.axis===null?'移动鼠标选择轴':data.objectPasteAxis+' 轴 '+this.delta[this.drag.axis]/this.stride+' 格'} · 左键放置 · Esc 原位落地`;
  this.options.view.requestPaintRender();
 }
 private consume(e:Event){e.preventDefault();e.stopImmediatePropagation();}
 private move=(e:PointerEvent)=>{
  if(!this.active||!this.options.enabled()||this.busy)return;
  if(e.buttons&6){this.drag.cancel();this.show();return;}
  if(this.press)this.consume(e);
  try{if(!this.drag.active)this.startAxis(e);const next=this.drag.sample(e)!;this.delta=next.end.map((v,i)=>Math.round(v*this.stride-this.pivot[i])) as Vec3;this.show();}catch(error){this.options.message(error instanceof Error?error.message:String(error),true);}
 };
 private down=(e:PointerEvent)=>{if(!this.active||!this.options.enabled()||e.button!==0)return;this.consume(e);if(this.busy)return;this.press={id:e.pointerId,controls:this.options.view.controls.enabled};this.options.view.controls.enabled=false;try{this.options.canvas.setPointerCapture(e.pointerId);}catch{}};
 private up=(e:PointerEvent)=>{if(!this.active||e.button!==0||this.press?.id!==e.pointerId)return;this.consume(e);this.release();void this.finish([...this.delta]);};
 private key=(e:KeyboardEvent)=>{if(!this.active||!this.options.enabled()||!['Escape','Enter'].includes(e.key))return;this.consume(e);this.release();void this.finish(e.key==='Escape'?[0,0,0]:[...this.delta]);};
 private async finish(delta:Vec3){if(this.busy||!this.commit)return;this.busy=true;const callback=this.commit,token=this.generation;try{await callback(delta);if(token===this.generation)this.cancel();}catch(error){this.options.message(error instanceof Error?error.message:String(error),true);}finally{this.busy=false;}}
 private release(){if(!this.press)return;const press=this.press;this.press=null;this.options.view.controls.enabled=press.controls;try{if(this.options.canvas.hasPointerCapture(press.id))this.options.canvas.releasePointerCapture(press.id);}catch{}}
 private abort=()=>this.cancel();
 cancel(){
  const hadPreview=this.root!==null;this.generation++;this.release();this.drag.cancel();this.commit=null;
  if(this.root){this.root.removeFromParent();for(const object of this.root.children){const mesh=object as THREE.InstancedMesh;mesh.geometry.dispose();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();mesh.dispose();}this.root=null;}
  this.hint?.remove();this.hint=null;const data=this.options.view.host.dataset;delete data.objectPaste;delete data.objectPasteDelta;delete data.objectPasteAxis;this.options.view.requestPaintRender();if(hadPreview)this.options.changed?.();
 }
 dispose(){if(this.disposed)return;this.cancel();this.disposed=true;const c=this.options.canvas;c.removeEventListener('pointermove',this.move,true);c.removeEventListener('pointerdown',this.down,true);c.removeEventListener('pointerup',this.up,true);c.removeEventListener('pointercancel',this.abort,true);c.ownerDocument.removeEventListener('keydown',this.key,true);}
}
