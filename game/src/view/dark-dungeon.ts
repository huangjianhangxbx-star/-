import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import map from '../core/dark-dungeon-map.json';
type Instance={asset:string;matrix:number[]};
function textures(root:THREE.Object3D){const found=new Set<THREE.Texture>();root.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])for(const value of Object.values(m))if(value instanceof THREE.Texture)found.add(value);});return found;}
export function releaseDarkDungeon(parent:THREE.Group){for(const t of parent.userData.dungeonTextures??[])t.dispose();parent.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});}

/** Original GLB geometry and saved Unity transforms, batched by asset mesh. */
export async function loadDarkDungeon(parent:THREE.Group,current:()=>boolean){
 const base=new URL('assets/dark-dungeon/',document.baseURI).href;
 const response=await fetch(base+'geometry.json');if(!response.ok)throw Error('暗牢实例数据加载失败');
 const data=await response.json() as {instances:Instance[]};
 const groups=new Map<string,Instance[]>();for(const item of data.instances){const list=groups.get(item.asset)||[];list.push(item);groups.set(item.asset,list);}
 const loader=new GLTFLoader(),mirror=new THREE.Matrix4().makeScale(-1,1,1);
 const offset=new THREE.Matrix4().makeTranslation(-map.origin[0]-(map.width-1)/2,0,-map.origin[1]-(map.height-1)/2);
 let total=0;
 for(const [asset,instances]of groups){
  const gltf=await loader.loadAsync(base+asset+'.glb');gltf.scene.updateMatrixWorld(true);
  if(!current()){for(const t of textures(gltf.scene))t.dispose();gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});return;}
  const owned: Set<THREE.Texture>=parent.userData.dungeonTextures??=new Set<THREE.Texture>();for(const t of textures(gltf.scene))owned.add(t);
  gltf.scene.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return;
   // Instancing cannot use negative determinants: bake the reflection into mesh space.
   const geometry=o.geometry.clone();geometry.applyMatrix4(o.matrixWorld);geometry.applyMatrix4(mirror);
   if(geometry.index){const index=geometry.index;for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}index.needsUpdate=true;}
   else {const count=geometry.getAttribute('position').count;const indices=Array.from({length:count},(_,i)=>i);for(let i=0;i<count;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];geometry.setIndex(indices);}
   const material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
   for(const m of Array.isArray(material)?material:[material])if(m instanceof THREE.MeshStandardMaterial){m.roughness=Math.max(.7,m.roughness);if(asset.startsWith('OVERLAY')){m.transparent=true;m.depthWrite=false;m.polygonOffset=true;m.polygonOffsetFactor=-2;}}
   const mesh=new THREE.InstancedMesh(geometry,material,instances.length);mesh.name=asset;mesh.receiveShadow=true;mesh.castShadow=false;
   for(const [i,item]of instances.entries())mesh.setMatrixAt(i,offset.clone().multiply(new THREE.Matrix4().fromArray(item.matrix)).multiply(mirror));
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();parent.add(mesh);total+=instances.length;
   o.geometry.dispose();
  });
 }
 parent.userData.importedInstances=data.instances.length;parent.userData.loaded=true;return total;
}

export function campfireMesh():THREE.Group{
 const root=new THREE.Group();const stone=new THREE.MeshStandardMaterial({color:0x454b4c,roughness:1});
 for(let i=0;i<7;i++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.12,0),stone);const angle=i*Math.PI*2/7;rock.position.set(Math.cos(angle)*.35,.08,Math.sin(angle)*.35);root.add(rock);}
 const wood=new THREE.MeshStandardMaterial({color:0x3a2720,roughness:1});for(const a of [-.7,.7]){const log=new THREE.Mesh(new THREE.BoxGeometry(.65,.12,.13),wood);log.rotation.y=a;log.position.y=.1;root.add(log);}
 const flame=new THREE.Mesh(new THREE.ConeGeometry(.18,.48,5),new THREE.MeshBasicMaterial({color:0xffbb59}));flame.position.y=.35;root.add(flame);const light=new THREE.PointLight(0xffba70,7,5,2);light.position.y=.8;root.add(light);return root;
}
