import * as THREE from 'three';
export type CanvasObjectEntry={id:string;root:THREE.Object3D;boxes?:THREE.Box3[]};
export type ObjectScreenRect={x0:number;y0:number;x1:number;y1:number};
/** Object member hit testing in the active canvas render frame. */
export class CanvasObjectQuery {
 private camera:THREE.Camera;
 private entries:CanvasObjectEntry[];
 constructor(camera:THREE.Camera,entries:CanvasObjectEntry[]){
  this.camera=camera;camera.updateMatrixWorld(true);
  this.entries=entries.filter(e=>e.root.visible);
  for(const root of new Set(this.entries.filter(e=>!e.boxes).map(e=>e.root)))root.updateWorldMatrix(true,true);
 }
 pick(x:number,y:number){
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x,y),this.camera);
  let nearest=Infinity,result:string|null=null;
  for(const entry of this.entries){
   if(entry.boxes){for(const box of entry.boxes){const hit=ray.ray.intersectBox(box,new THREE.Vector3());if(hit){const d=hit.distanceToSquared(ray.ray.origin);if(d<nearest){nearest=d;result=entry.id;}}}}
   else {const hit=ray.intersectObject(entry.root,true)[0];if(hit&&hit.distance*hit.distance<nearest){nearest=hit.distance*hit.distance;result=entry.id;}}
  }
  return result;
 }
 box(rect:ObjectScreenRect){
  const x0=Math.min(rect.x0,rect.x1),x1=Math.max(rect.x0,rect.x1),y0=Math.min(rect.y0,rect.y1),y1=Math.max(rect.y0,rect.y1);
  return this.entries.filter(({root,boxes})=>(boxes??[new THREE.Box3().setFromObject(root)]).some(box=>{
   if(box.isEmpty())return false;
   const points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(this.camera));
   if(points.every(p=>p.z < -1)||points.every(p=>p.z > 1))return false;
   return Math.min(...points.map(p=>p.x))<=x1&&Math.max(...points.map(p=>p.x))>=x0&&Math.min(...points.map(p=>p.y))<=y1&&Math.max(...points.map(p=>p.y))>=y0;
  })).map(e=>e.id);
 }
 bounds(ids:Iterable<string>){const keys=new Set(ids),box=new THREE.Box3();for(const {id,root,boxes} of this.entries)if(keys.has(id))for(const member of boxes??[new THREE.Box3().setFromObject(root)])box.union(member);return box;}
}
