import * as THREE from 'three';
import type {GameState,Pos} from '../core/types';
import {targetHeading,DIRECTIONAL_PROFILES} from '../core/directionality';
import {isStandaloneExploration} from '../core/exploration-party';
import {positionVisible} from '../core/visibility';

/** Read-only diagnostic: never participates in picking, attack areas or visibility. */
export class DirectionalLayer {
 readonly group=new THREE.Group();
 private entries=new Map<string,{group:THREE.Group;profile:string}>();
 update(s:GameState,debug:boolean,world:(p:Pos,extra?:number)=>THREE.Vector3){
  const alive=new Set<string>();
  if(debug&&isStandaloneExploration(s)&&s.phase==='battle')for(const u of s.units){
   if(u.team!=='enemy'||u.life!=='active'||!positionVisible(s,u.pos))continue;
   alive.add(u.id);const profile=u.directionalProfileId||'neutral';let entry=this.entries.get(u.id);
   if(entry&&entry.profile!==profile){this.remove(u.id);entry=undefined;}
   if(!entry){const g=new THREE.Group();g.name='direction:'+u.id;
    const sector=(name:string,a:number,b:number,color:number)=>{const points:number[]=[];for(let i=0;i<12;i++){const l=a+(b-a)*i/12,r=a+(b-a)*(i+1)/12;points.push(0,0,0,.72*Math.cos(l),0,.72*Math.sin(l),.72*Math.cos(r),0,.72*Math.sin(r));}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.20,side:THREE.DoubleSide,depthWrite:false}));mesh.name=name;mesh.raycast=()=>{};g.add(mesh);};
    sector('front',-Math.PI/3,Math.PI/3,0x79c4ce);sector('side-left',Math.PI/3,Math.PI*2/3,0x92999b);sector('side-right',-Math.PI*2/3,-Math.PI/3,0x92999b);
    const weak=!!DIRECTIONAL_PROFILES[profile]?.back.weakpointId;sector(weak?'rear-core':'back',Math.PI*2/3,Math.PI*4/3,weak?0xffd774:0x9caac4);
    const arrow=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(.9,0,0),new THREE.Vector3(.9,0,0),new THREE.Vector3(.7,0,.12),new THREE.Vector3(.9,0,0),new THREE.Vector3(.7,0,-.12)]),new THREE.LineBasicMaterial({color:0xffffff,depthWrite:false}));arrow.name='facing';arrow.raycast=()=>{};g.add(arrow);this.group.add(g);entry={group:g,profile};this.entries.set(u.id,entry);
   }
   entry.group.visible=true;entry.group.position.copy(world(u.pos,.09));entry.group.rotation.y=-targetHeading(u);entry.group.userData={targetId:u.id,heading:targetHeading(u),profile};
  }
  for(const id of this.entries.keys())if(!alive.has(id))this.remove(id);
 }
 private remove(id:string){const e=this.entries.get(id)!;e.group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();(o.material as THREE.Material).dispose();}});this.group.remove(e.group);this.entries.delete(id);}
 dispose(){for(const id of this.entries.keys())this.remove(id);}
}
