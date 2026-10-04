import * as THREE from 'three';
import { type PngReference, referenceLayout } from '../core/references.ts';
/** A separate group, never included in terrain or asset picking/export. Owns all resources. */
export class ReferenceView {
  group = new THREE.Group();
  mesh: THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial> | null = null;
  private source: string | null = null;
  private generation = 0;
  private failed = false;
  private loadTexture: (url: string, onLoad: (texture: THREE.Texture)=>void, onError: ()=>void)=>THREE.Texture;
  onError = (message: string) => {};
  constructor(loadTexture = (url: string,onLoad: (texture: THREE.Texture)=>void,onError: ()=>void) => new THREE.TextureLoader().load(url,onLoad,undefined,onError)) {
    this.loadTexture=loadTexture;
    this.group.name='editor-reference';
    this.group.userData.editorOnly=true;
  }
  update(reference: PngReference | null | undefined) {
    if (!reference) { this.release(); return; }
    if (this.source !== reference.dataUrl) {
      this.release(); this.failed=false; this.source=reference.dataUrl;
      const generation=++this.generation;
      const texture=this.loadTexture(reference.dataUrl, texture=>{
        if (generation!==this.generation) texture.dispose();
      },()=>{
        if (generation===this.generation) { this.failed=true; this.group.visible=false; this.onError('参考 PNG 无法解码，请重新导入图片'); }
      });
      texture.colorSpace=THREE.SRGBColorSpace;
      const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
      this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
      this.mesh.raycast=()=>{};
      this.group.add(this.mesh);
    }
    const layout=referenceLayout(reference);
    this.mesh!.scale.set(layout.width,layout.height,1);
    this.mesh!.position.set(layout.offsetX,layout.offsetY,0);
    this.group.position.set(reference.x,reference.z,-reference.y);
    this.group.visible=reference.visible && !this.failed;
  }
  faceCamera(camera: THREE.Camera) {
    // Orthographic rays are parallel: use camera direction, not camera-to-object vector.
    const direction=camera.getWorldDirection(new THREE.Vector3());
    if (direction.x*direction.x+direction.z*direction.z>1e-12)
      this.group.rotation.set(0,Math.atan2(-direction.x,-direction.z),0);
  }
  private release() {
    ++this.generation;
    if (this.mesh) {
      this.mesh.geometry.dispose(); this.mesh.material.map?.dispose(); this.mesh.material.dispose();
      this.group.remove(this.mesh); this.mesh=null;
    }
    this.source=null; this.group.visible=false;
  }
  dispose() { this.release(); this.group.removeFromParent(); }
}

