import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {GameState} from '../core/types';

/** Batched masonry: decorative geometry never participates in tile picking. */
export function streetDetails(state:GameState,height:number):THREE.Group{
 const group=new THREE.Group();group.name='street-art';
 const materials=[new THREE.MeshStandardMaterial({color:0x89949a,roughness:.76}),new THREE.MeshStandardMaterial({color:0x414e5b,roughness:.92}),new THREE.MeshStandardMaterial({color:0x172631,metalness:.75,roughness:.36}),new THREE.MeshStandardMaterial({color:0x9b8059,metalness:.68,roughness:.42})];
 const batches:THREE.BufferGeometry[][]=materials.map(()=>[]);
 const add=(m:number,x:number,y:number,z:number,w:number,h:number,d:number,bevel=false)=>{
  const g=bevel?new RoundedBoxGeometry(w,h,d,1,Math.min(.025,h*.2)):new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);if(g.index){const expanded=g.toNonIndexed();g.dispose();batches[m].push(expanded);}else batches[m].push(g);
 };
 const tile=(x:number,y:number)=>state.tiles.find(t=>t.x===x&&t.y===y);
 for(const t of state.tiles){
  const x=t.x-(state.width-1)/2,z=t.y-(state.height-1)/2;
  if(t.obstacle&&t.y>1){
   const cut=(t.x<=2&&t.y===state.goal.y+1)||state.spawns.some(p=>Math.abs(t.x-p.x)<=1&&t.y===p.y+1);
   const top=cut?.30:.72;
   // Capstone frame catches light; recessed centre gives large roofs real relief.
   for(const side of [-1,1]){if(!tile(t.x+side,t.y)?.obstacle)add(0,x+side*.435,top+.055,z,.09,.10,.96,true);if(!tile(t.x,t.y+side)?.obstacle)add(0,x,top+.055,z+side*.435,.96,.10,.09,true);}
   if(t.x%4===0&&t.y%3===0){add(2,x,top+.074,z,.48,.035,.42,true);for(let i=-2;i<=2;i++)add(1,x+i*.085,top+.10,z,.024,.025,.35);}
  }
  if(t.layer&&!t.obstacle){
   for(const [dx,dz] of [[0,1],[1,0],[0,-1],[-1,0]]){
    const neighbor=tile(t.x+dx,t.y+dz);if(neighbor?.layer===t.layer)continue;
    const xx=x+dx*.48,zz=z+dz*.48;
    add(0,xx,height+.028,zz,dx?.12:1,.09,dz?.12:1,true);
    add(2,xx,height-.10,zz,dx?.05:.99,.055,dz?.05:.99);
    for(let row=0;row<3;row++)for(let col=0;col<2;col++){
     const offset=(col-.5)*.48;
     add(1,xx+(dx?0:offset),.10+row*.16,zz+(dz?0:offset),dx?.085:.465,.142,dz?.085:.465,true);
    }
    add(3,xx,height-.03,zz,dx?.06:.91,.022,dz?.06:.91);
   }
  }
  if(!t.obstacle&&!t.layer){
   for(const [dx,dz] of [[0,1],[1,0],[0,-1],[-1,0]]){
    const n=tile(t.x+dx,t.y+dz);if(!n?.obstacle)continue;
    const xx=x+dx*.435,zz=z+dz*.435;
    add(2,xx,.044,zz,dx?.10:.98,.016,dz?.10:.98);
    for(let k=0;k<7;k++){const o=(k-3)*.125;add(1,xx+(dx?0:o),.057,zz+(dz?0:o),dx?.092:.027,.016,dz?.092:.027);}
   }
  }
  // Buttresses and inset panels on the northern facades, safely behind the lanes.
  if(t.obstacle&&t.y===1){
   for(const offset of [-.43,.43]){add(1,x+offset,.63,z+.47,.13,1.27,.17,true);add(0,x+offset,.10,z+.51,.21,.16,.24,true);add(0,x+offset,1.20,z+.49,.19,.12,.22,true);}
   add(0,x,1.27,z+.47,.99,.12,.22,true);
  }
 }
 for(let i=0;i<batches.length;i++){
  if(!batches[i].length)continue;const geometry=mergeGeometries(batches[i]);batches[i].forEach(g=>g.dispose());
  const mesh=new THREE.Mesh(geometry,materials[i]);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 return group;
}

/** Keep original meshes for ray picking; draw opaque static architecture in batches. */
export function batchArchitecture(root:THREE.Group,animated:THREE.Object3D|null){
 root.updateMatrixWorld(true);
 const batches=new Map<string,{material:THREE.MeshStandardMaterial;parts:THREE.BufferGeometry[]}>();
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||!(object.material instanceof THREE.MeshStandardMaterial))return;
  for(let p:THREE.Object3D|null=object;p;p=p.parent)if(p===animated)return;
  const m=object.material;if(m.transparent)return;
  const key=[m.color.getHex(),m.roughness,m.metalness,m.emissive.getHex(),m.emissiveIntensity,m.map?.uuid,m.bumpMap?.uuid,m.bumpScale,m.side].join('|');
  const batch=batches.get(key)||{material:m,parts:[]};batches.set(key,batch);
  const g=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();g.applyMatrix4(object.matrixWorld);batch.parts.push(g);object.visible=false;
 });
 for(const {material,parts} of batches.values()){
  const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 }
}


