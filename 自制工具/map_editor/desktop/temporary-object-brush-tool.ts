import * as THREE from 'three';
import type {TemporaryObjectBrush} from '../core/temporary-object-brush.ts';
import type {Vec3} from '../core/workshop-documents.ts';
import type {MapView} from './view.ts';

const TICK=.03125;
type FaceName='+x'|'-x'|'+y'|'-y'|'+z'|'-z';
const faces:FaceName[]=['+x','-x','+y','-y','+z','-z'];
export type TemporaryObjectBrushHit={pointTicks:Vec3;face?:number|FaceName};
export type TemporaryObjectBrushToolOptions={
 canvas:HTMLCanvasElement;
 view:Pick<MapView,'scene'|'controls'|'requestPaintRender'>;
 frame:()=>{originTicks:Vec3;voxelStepM:number}|null;
 enabled:()=>boolean;
 hit:(event:PointerEvent)=>TemporaryObjectBrushHit|null;
 stamp:(targetTicks:Vec3)=>void|Promise<void>;
 message:(text:string,error?:boolean)=>void;
};

/** One click, one native object; hover only transforms a cached, shape-accurate ghost. */
export class TemporaryObjectBrushTool {
 private brush:TemporaryObjectBrush|null=null;
 private preview:THREE.Group|null=null;
 private mesh:THREE.InstancedMesh|null=null;
 private gesture:{id:number;controlsEnabled:boolean}|null=null;
 private lastHit:TemporaryObjectBrushHit|null=null;
 private busy=false;
 private disposed=false;
 private options:TemporaryObjectBrushToolOptions;
 constructor(options:TemporaryObjectBrushToolOptions){
  this.options=options;
  const canvas=options.canvas;
  canvas.addEventListener('pointerdown',this.down,true);
  canvas.addEventListener('pointermove',this.move,true);
  canvas.addEventListener('pointerup',this.up,true);
  canvas.addEventListener('pointercancel',this.cancel,true);
  canvas.addEventListener('lostpointercapture',this.lost,true);
  canvas.addEventListener('pointerleave',this.leave,true);
 }
 get active(){return !this.disposed&&!!this.brush&&this.options.enabled()&&!!this.options.frame();}
 get hasBrush(){return !this.disposed&&!!this.brush;}
 setBrush(brush:TemporaryObjectBrush|null){
  if(this.disposed)return;
  if(this.brush===brush){this.updatePreview(this.lastHit);return;}
  this.cancelGesture();this.clearPreview();this.brush=brush;
  if(!brush)return;
  const source=brush.clipboard.canvases[0],geometry=new THREE.BoxGeometry(source.voxelStepM,source.voxelStepM,source.voxelStepM);
  const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.38,depthWrite:false});
  const mesh=new THREE.InstancedMesh(geometry,material,source.cells.length),matrix=new THREE.Matrix4(),color=new THREE.Color();
  source.cells.forEach((cell,i)=>{
   const point=[cell.x,cell.y,cell.z].map((v,axis)=>(source.originTicks[axis]+(v+.5)*brush.stepTicks-brush.anchorTicks[axis])*TICK);
   matrix.makeTranslation(point[0],point[2],-point[1]);mesh.setMatrixAt(i,matrix);
   mesh.setColorAt(i,color.set(brush.clipboard.palette[cell.color]));
  });
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingSphere();mesh.raycast=()=>{};mesh.renderOrder=8;
  const group=new THREE.Group();group.name='temporary-object-brush-preview';group.userData.temporaryObjectBrush=true;group.visible=false;group.add(mesh);
  this.mesh=mesh;this.preview=group;this.options.view.scene.add(group);this.redraw();
 }
 private redraw(){this.options.view.requestPaintRender();}
 private hidePreview(){if(this.preview?.visible){this.preview.visible=false;this.redraw();}}
 private clearPreview(){
  this.preview?.removeFromParent();this.mesh?.geometry.dispose();
  if(this.mesh){for(const material of Array.isArray(this.mesh.material)?this.mesh.material:[this.mesh.material])material.dispose();this.mesh.dispose();}
  this.mesh=null;this.preview=null;this.redraw();
 }
 private target(hit:TemporaryObjectBrushHit):Vec3|null {
  const brush=this.brush;if(!brush||hit.pointTicks.length!==3||hit.pointTicks.some(v=>!Number.isFinite(v)))return null;
  const face=typeof hit.face==='number'?faces[hit.face]:hit.face??'+z';
  const index=faces.indexOf(face as FaceName),axis=index<0?2:Math.floor(index/2),sign=index<0?1:index%2===0?1:-1;
  const point=[...hit.pointTicks] as Vec3;
  point[axis]+=sign>0?brush.anchorTicks[axis]-brush.boundsTicks.min[axis]:brush.anchorTicks[axis]-brush.boundsTicks.max[axis];
  return point.map((value,i)=>{
   const delta=(value-brush.anchorTicks[i])/brush.stepTicks;
   // Tangential snapping matches core stamping. Normal snapping stays outside
   // the touched face even when its grid phase differs from the source canvas.
   const snapped=i!==axis?Math.round(delta):sign>0?Math.ceil(delta-1e-9):Math.floor(delta+1e-9);
   return brush.anchorTicks[i]+snapped*brush.stepTicks;
  }) as Vec3;
 }
 private updatePreview(hit:TemporaryObjectBrushHit|null):Vec3|null {
  this.lastHit=hit;
  const frame=this.options.frame(),target=this.active&&hit?this.target(hit):null;
  if(!target||!frame||!this.preview){this.hidePreview();return null;}
  const scale=.25/frame.voxelStepM,point=target.map((v,i)=>(v-frame.originTicks[i])*TICK*scale);
  this.preview.scale.setScalar(scale);this.preview.position.set(point[0],point[2],-point[1]);this.preview.visible=true;this.redraw();return target;
 }
 private consume(event:PointerEvent){event.preventDefault();event.stopImmediatePropagation();}
 private down=(event:PointerEvent)=>{
  if(event.button!==0||event.isPrimary===false||!this.active)return;
  this.consume(event);if(this.gesture)return;
  this.gesture={id:event.pointerId,controlsEnabled:this.options.view.controls.enabled};this.options.view.controls.enabled=false;
  try{this.options.canvas.setPointerCapture(event.pointerId);}catch{}
  this.updatePreview(this.options.hit(event));
 };
 private move=(event:PointerEvent)=>{
  if(this.gesture?.id===event.pointerId)this.consume(event);
  if(!this.active){this.hidePreview();return;}
  this.updatePreview(this.options.hit(event));
 };
 private up=(event:PointerEvent)=>{
  if(event.button!==0||this.gesture?.id!==event.pointerId)return;
  this.consume(event);this.releaseGesture();
  const target=this.active?this.updatePreview(this.options.hit(event)):null;
  if(!target)return;if(this.busy){this.options.message('正在放置临时画笔，请稍候');return;}
  void this.place(target);
 };
 private async place(target:Vec3){
  this.busy=true;
  try{await this.options.stamp(target);}
  catch(error){if(!this.disposed)this.options.message(error instanceof Error?error.message:String(error),true);}
  finally{this.busy=false;}
 }
 private releaseGesture(){
  if(!this.gesture)return;
  const gesture=this.gesture;this.gesture=null;this.options.view.controls.enabled=gesture.controlsEnabled;
  try{if(this.options.canvas.hasPointerCapture(gesture.id))this.options.canvas.releasePointerCapture(gesture.id);}catch{}
 }
 private cancel=(event:PointerEvent)=>{if(this.gesture?.id===event.pointerId){this.consume(event);this.cancelGesture();}};
 private lost=(event:PointerEvent)=>{if(this.gesture?.id===event.pointerId)this.cancelGesture();};
 private leave=()=>this.hidePreview();
 cancelGesture(){this.releaseGesture();this.lastHit=null;this.hidePreview();}
 dispose(){
  if(this.disposed)return;this.cancelGesture();this.clearPreview();this.brush=null;this.disposed=true;
  const canvas=this.options.canvas;
  canvas.removeEventListener('pointerdown',this.down,true);canvas.removeEventListener('pointermove',this.move,true);canvas.removeEventListener('pointerup',this.up,true);
  canvas.removeEventListener('pointercancel',this.cancel,true);canvas.removeEventListener('lostpointercapture',this.lost,true);canvas.removeEventListener('pointerleave',this.leave,true);
 }
}
