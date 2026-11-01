import type * as THREE from 'three';

/** Draw editor backdrops into the current color target, before any foreground. */
export function renderViewportBackground(
 renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,
 backdrops:ReadonlySet<THREE.Object3D>,background:THREE.Scene['background'],
){
 const visibility:{node:THREE.Object3D;visible:boolean}[]=[],auto=renderer.autoClear,previous=scene.background;
 scene.traverse((node:any)=>{if(node.isMesh||node.isLine||node.isPoints){visibility.push({node,visible:node.visible});node.visible=backdrops.has(node);}});
 try{scene.background=background;renderer.autoClear=true;renderer.render(scene,camera);renderer.clearDepth();}
 finally{for(const {node,visible}of visibility)node.visible=visible;scene.background=previous;renderer.autoClear=auto;}
}
