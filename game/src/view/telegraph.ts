import * as THREE from 'three';
import type {GameState} from '../core/types';
import {areaFootprint,areaOrigin} from '../core/attack-area';
import {positionVisible} from '../core/visibility';
import {terrainHeight} from '../core/spatial';
import {isStandaloneExploration} from '../core/exploration-party';
type Entry={group:THREE.Group;fill:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;solid:THREE.Line;tracking:THREE.Line;key:string;start:number};
/** Mesh buffers are reused through tracking; each enemy owns at most one entry. */
export class TelegraphLayer {
 readonly group=new THREE.Group();private entries=new Map<string,Entry>();
 update(s:GameState,world:(p:{x:number;y:number},extra?:number)=>THREE.Vector3){
  const alive=new Set<string>();
  if(isStandaloneExploration(s)&&s.phase==='battle')for(const u of s.units){const a=u.attackIntent;if(!a||u.life!=='active'||!positionVisible(s,u.pos))continue;alive.add(u.id);let e=this.entries.get(u.id);
   if(e&&e.start!==a.startedAt){this.remove(u.id);e=undefined;}
   if(!e){const group=new THREE.Group(),fill=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xd67d55,side:THREE.DoubleSide,transparent:true,opacity:.1,depthWrite:false,depthTest:true})),solid=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffc17f,transparent:true,opacity:.95,depthWrite:false})),tracking=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xe9ad80,transparent:true,opacity:.6,dashSize:.10,gapSize:.07,depthWrite:false}));fill.renderOrder=12;solid.renderOrder=13;tracking.renderOrder=13;group.add(fill,solid,tracking);group.name='telegraph:'+u.id;this.group.add(group);e={group,fill,solid,tracking,key:'',start:a.startedAt};this.entries.set(u.id,e);}
   const key=JSON.stringify([a.area,s.barricades]);if(key!==e.key){e.key=key;const poly=areaFootprint(s,a.area),o=areaOrigin(a.area),positions:number[]=[],lines:number[]=[];
    const point=(p:{x:number;y:number})=>{const v=world(p,.065);v.y=terrainHeight(s,o)+.065;return [v.x,v.y,v.z];};
    for(let i=0;i<poly.length;i++)positions.push(...point(o),...point(poly[i]),...point(poly[(i+1)%poly.length]));
    for(const p of [...poly,poly[0]].filter(Boolean))lines.push(...point(p));
    this.buffer(e.fill.geometry,positions);this.buffer(e.solid.geometry,lines);this.buffer(e.tracking.geometry,lines);e.tracking.computeLineDistances();
   }
   e.group.userData={sourceId:u.id,phase:a.phase,area:a.area,startedAt:a.startedAt};e.fill.material.opacity=a.phase==='locked'?.28:.08;e.solid.visible=a.phase==='locked';e.tracking.visible=a.phase==='tracking';
  }
  for(const id of this.entries.keys())if(!alive.has(id))this.remove(id);
 }
 private buffer(g:THREE.BufferGeometry,values:number[]){let attr=g.getAttribute('position') as THREE.BufferAttribute;if(!attr||attr.array.length<values.length){attr=new THREE.BufferAttribute(new Float32Array(Math.max(4096,values.length)),3);g.setAttribute('position',attr);} (attr.array as Float32Array).set(values);attr.needsUpdate=true;g.setDrawRange(0,values.length/3);g.computeBoundingSphere();}
 private remove(id:string){const e=this.entries.get(id)!;this.group.remove(e.group);for(const o of [e.fill,e.solid,e.tracking]){o.geometry.dispose();(o.material as THREE.Material).dispose();}this.entries.delete(id);}
 dispose(){for(const id of this.entries.keys())this.remove(id);}
}
