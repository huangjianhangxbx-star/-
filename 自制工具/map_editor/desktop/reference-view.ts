import * as THREE from 'three';
import { type PngReference, referenceLayout,referenceOpacity } from '../core/references.ts';
/** A separate group, never included in terrain or asset picking/export. Owns all resources. */
export class ReferenceView {
  group = new THREE.Group();
  mesh: THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial> | null = null;
  private source: string | null = null;
  private generation = 0;
  private failed = false;
  private modeling = false;
  private loadTexture: (url: string, onLoad: (texture: THREE.Texture)=>void, onError: ()=>void)=>THREE.Texture;
  onError = (message: string) => {};
  constructor(loadTexture = (url: string,onLoad: (texture: THREE.Texture)=>void,onError: ()=>void) => new THREE.TextureLoader().load(url,onLoad,undefined,onError)) {
    this.loadTexture=loadTexture;
    this.group.name='editor-reference';
    this.group.userData.editorOnly=true;
  }
  update(reference: PngReference | null | undefined) {
    if (!reference) { this.release(); return; }
    const modeling=reference.kind==='modeling';
    if (this.source !== reference.dataUrl || this.modeling!==modeling) {
      this.release(); this.failed=false; this.source=reference.dataUrl;
      this.modeling=modeling;
      const generation=++this.generation;
      const texture=this.loadTexture(reference.dataUrl, texture=>{
        if (generation!==this.generation) texture.dispose();
      },()=>{
        if (generation===this.generation) { this.failed=true; this.group.visible=false; this.onError('参考 PNG 无法解码，请重新导入图片'); }
      });
      texture.colorSpace=THREE.SRGBColorSpace;
      const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:modeling?.01:0,depthTest:!modeling,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
      this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
      this.mesh.userData.viewportBackground=modeling;
      this.mesh.renderOrder=modeling?-10000:0;
      this.mesh.raycast=()=>{};
      this.group.add(this.mesh);
    }
    const layout=referenceLayout(reference);
    this.mesh!.material.opacity=referenceOpacity(reference);
    this.mesh!.scale.set(layout.width,layout.height,1);
    this.mesh!.position.set(layout.offsetX,layout.offsetY,0);
    this.group.position.set(reference.x,reference.z,-reference.y);
    this.group.visible=reference.visible && !this.failed;
  }
  faceCamera(camera: THREE.Camera) {
    if(this.modeling){this.group.quaternion.copy(camera.quaternion);return;}
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

/** A world-metre list rendered in the active canvas frame. Each image owns a target. */
export class ReferenceCollectionView {
  readonly group=new THREE.Group();
  private entries=new Map<string,ReferenceView>();
  private activeId='';
  private loadTexture?:ConstructorParameters<typeof ReferenceView>[0];
  onError=(message:string)=>{};
  constructor(loadTexture?:ConstructorParameters<typeof ReferenceView>[0]){this.loadTexture=loadTexture;this.group.name='editor-references';this.group.userData.editorOnly=true;}
  get mesh(){return this.entries.get(this.activeId)?.mesh??null;}
  get activeGroup(){return this.entries.get(this.activeId)?.group??this.group;}
  get scaleFactor(){return this.group.scale.x;}
  setFrame(step=.25,origin:readonly number[]=[0,0,0]){const factor=.25/step;this.group.scale.setScalar(factor);this.group.position.set(-origin[0]*.03125*factor,-origin[2]*.03125*factor,origin[1]*.03125*factor);}
  update(input?:PngReference|readonly PngReference[]|null,activeId?:string){
    const references:readonly PngReference[]=Array.isArray(input)?input:input?[input as PngReference]:[];
    const live=new Set(references.map(r=>r.id));
    for(const [id,entry]of this.entries)if(!live.has(id)){entry.dispose();this.entries.delete(id);}
    for(const reference of references){let entry=this.entries.get(reference.id);if(!entry){entry=new ReferenceView(this.loadTexture);entry.onError=message=>this.onError(message);this.entries.set(reference.id,entry);this.group.add(entry.group);}entry.update(reference);}
    this.activeId=activeId&&live.has(activeId)?activeId:live.has(this.activeId)?this.activeId:references[0]?.id??'';
    this.group.visible=[...this.entries.values()].some(entry=>entry.group.visible);
  }
  faceCamera(camera:THREE.Camera){for(const entry of this.entries.values())entry.faceCamera(camera);}
  dispose(){for(const entry of this.entries.values())entry.dispose();this.entries.clear();this.group.removeFromParent();}
}

