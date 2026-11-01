import type * as THREE from 'three';

/** Isolate an externally owned preview without changing or disposing native content. */
export class PreviewSceneBinding {
 private scene:THREE.Scene;
 private root:THREE.Object3D|null=null;
 private nativeVisibility=new Map<THREE.Object3D,boolean>();
 private preservedRoots:Set<THREE.Object3D>;
 constructor(scene:THREE.Scene,preservedRoots:readonly THREE.Object3D[]=[]){this.scene=scene;this.preservedRoots=new Set(preservedRoots);}
 get active(){return this.root!==null;}
 set(root:THREE.Object3D|null){
  if(root===this.root){this.sync();return;}
  if(this.root)this.scene.remove(this.root);
  this.root=root;
  if(!root){
   for(const [native,visible]of this.nativeVisibility)native.visible=visible;
   this.nativeVisibility.clear();return;
  }
  // A root already in the scene may have been hidden while another external
  // preview was active. Give it back its own original visibility on promotion.
  if(this.nativeVisibility.has(root))root.visible=this.nativeVisibility.get(root)!;
  this.scene.add(root);this.sync();
 }
 sync(){
  if(!this.root)return;
  if(this.root.parent!==this.scene)this.scene.add(this.root);
  for(const native of this.scene.children){
   if(native===this.root||(native as THREE.Light).isLight||this.preservedRoots.has(native))continue;
   if(!this.nativeVisibility.has(native))this.nativeVisibility.set(native,native.visible);
   native.visible=false;
  }
 }
}
