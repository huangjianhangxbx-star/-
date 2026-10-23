import * as THREE from 'three';
export type CanvasObjectEntry={id:string;root:THREE.Object3D};
export type ObjectScreenRect={x0:number;y0:number;x1:number;y1:number};
/** Whole-canvas hit testing in the active canvas render frame. */
export class CanvasObjectQuery {
 private camera:THREE.Camera;
 private entries:CanvasObjectEntry[];
 constructor(camera:THREE.Camera,entries:CanvasObjectEntry[]){
  this.camera=camera;camera.updateMatrixWorld(true);
  this.entries=entries.filter(e=>e.root.visible);
  for(const entry of this.entries)entry.root.updateWorldMatrix(true,true);
 }
 pick(x:number,y:number){
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x,y),this.camera);
  const roots=this.entries.map(e=>e.root),hit=ray.intersectObjects(roots,true)[0];
  if(!hit)return null;
  let root=hit.object;while(root.parent&&!roots.includes(root))root=root.parent;
  return this.entries.find(e=>e.root===root)?.id??null;
 }
 box(rect:ObjectScreenRect){
  const x0=Math.min(rect.x0,rect.x1),x1=Math.max(rect.x0,rect.x1),y0=Math.min(rect.y0,rect.y1),y1=Math.max(rect.y0,rect.y1);
  return this.entries.filter(({root})=>{
   const box=new THREE.Box3().setFromObject(root);if(box.isEmpty())return false;
   const points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(this.camera));
   if(points.every(p=>p.z < -1)||points.every(p=>p.z > 1))return false;
   return Math.min(...points.map(p=>p.x))<=x1&&Math.max(...points.map(p=>p.x))>=x0&&Math.min(...points.map(p=>p.y))<=y1&&Math.max(...points.map(p=>p.y))>=y0;
  }).map(e=>e.id);
 }
 bounds(ids:Iterable<string>){const keys=new Set(ids),box=new THREE.Box3();for(const {id,root} of this.entries)if(keys.has(id))box.union(new THREE.Box3().setFromObject(root));return box;}
}
