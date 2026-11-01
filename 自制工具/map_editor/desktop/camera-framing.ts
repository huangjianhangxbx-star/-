import {Box3,OrthographicCamera,PerspectiveCamera,Quaternion,Vector3} from 'three';
type FramingControls={target:Vector3;update():unknown};
/** Fit real geometry in the current camera frame, respecting the viewport aspect ratio. */
export function fitCameraToBounds(camera:OrthographicCamera|PerspectiveCamera,controls:FramingControls,box:Box3,padding=1.2){
 if(box.isEmpty())return false;
 const center=box.getCenter(new Vector3()),radius=Math.max(1e-5,box.getSize(new Vector3()).length()/2),direction=camera.position.clone().sub(controls.target).normalize();
 if(direction.lengthSq()<.5)direction.set(0,1,1).normalize();
 controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,radius*3);camera.lookAt(center);camera.updateMatrixWorld();
 const inverse=new Quaternion().copy(camera.quaternion).invert(),corners:Vector3[]=[];
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new Vector3(x,y,z).sub(center).applyQuaternion(inverse));
 let distance=radius*3;
 if(camera instanceof OrthographicCamera){
  const x=Math.max(1e-6,...corners.map(p=>Math.abs(p.x))),y=Math.max(1e-6,...corners.map(p=>Math.abs(p.y)));
  camera.zoom=Math.min((camera.right-camera.left)/(2*x*padding),(camera.top-camera.bottom)/(2*y*padding));
 }else{
  const v=Math.tan(camera.fov*Math.PI/360)/camera.zoom,h=v*camera.aspect;
  distance=Math.max(...corners.flatMap(p=>[p.z+Math.abs(p.x)*padding/h,p.z+Math.abs(p.y)*padding/v]),radius*1.1);
  camera.position.copy(center).addScaledVector(direction,distance);
 }
 camera.near=Math.max(.0001,distance-radius*2);camera.far=Math.max(100,distance+radius*4);camera.updateProjectionMatrix();controls.update();return true;
}
