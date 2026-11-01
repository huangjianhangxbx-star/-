import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import type {MapView} from './view.ts';
import type {SymmetryTarget} from './symmetry-controls.ts';

/** Moves the mirror centre only. Geometry and object pivots are never attached. */
export class SymmetryGizmo {
 readonly control:TransformControls;
 readonly target=new THREE.Object3D();
 private frame:SymmetryTarget|null=null;
 private active=false;
 constructor(private view:MapView,private changed:(world:[number,number,number])=>void){
  this.target.name='symmetry-centre';this.target.userData.editorOnly=true;
  this.control=new TransformControls(view.camera,view.renderer.domElement);
  this.control.setMode('translate');this.control.setTranslationSnap(.125);this.control.setSize(.85);
  view.scene.add(this.target,this.control.getHelper());this.control.enabled=false;this.control.getHelper().visible=false;
  this.control.addEventListener('dragging-changed',(event:any)=>{view.controls.enabled=!event.value;});
  this.control.addEventListener('objectChange',()=>{
   if(!this.active||!this.frame||!this.control.dragging)return;
   const p=this.target.position,f=this.frame;
   this.changed([p.x,-p.z,p.y].map((value,axis)=>f.origin[axis]+value*f.step/.25) as [number,number,number]);
  });
 }
 sync(frame:SymmetryTarget|null,center:readonly number[]|undefined,active:boolean){
  this.frame=frame;this.active=active&&!!frame&&!!center;
  if(!this.active){this.control.dragging=false;this.control.enabled=false;this.control.detach();this.control.getHelper().visible=false;this.view.controls.enabled=true;delete this.view.host.dataset.symmetryDragging;return;}
  const local=center!.map((value,axis)=>(value-frame!.origin[axis])*.25/frame!.step);
  this.target.position.set(local[0],local[2],-local[1]);this.target.updateMatrixWorld(true);
  if(this.control.object!==this.target)this.control.attach(this.target);
  this.control.enabled=true;this.control.getHelper().visible=true;this.view.host.dataset.symmetryDragging='true';
  this.view.host.dataset.symmetryCenter=center!.join(',');this.view.requestPaintRender();
 }
 dispose(){this.sync(null,undefined,false);this.control.dispose();this.control.getHelper().removeFromParent();this.target.removeFromParent();}
}
