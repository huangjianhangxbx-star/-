import * as THREE from 'three';
import type {GameState} from '../core/types';
import {areaFootprint,areaOrigin} from '../core/attack-area';
import {positionVisible} from '../core/visibility';
import {terrainHeight} from '../core/spatial';
import {REACTIONS} from '../core/enemy-combat';
import {isStandaloneExploration} from '../core/exploration-party';
type Entry={group:THREE.Group;fill:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;solid:THREE.Line;tracking:THREE.Line;accent:THREE.Line;key:string;start:number};
/** Mesh buffers are reused through tracking; each enemy owns at most one entry. */
export class TelegraphLayer {
 readonly group=new THREE.Group();private entries=new Map<string,Entry>();readonly reactions=new THREE.Group();private tells=new Map<string,THREE.Line>();
 constructor(){this.reactions.name='enemy-reactions';}
 update(s:GameState,world:(p:{x:number;y:number},extra?:number)=>THREE.Vector3){
  const alive=new Set<string>();
  if(isStandaloneExploration(s)&&s.phase==='battle')for(const u of s.units){const a=u.attackIntent;if(!a||a.kind!=='ability'||u.life!=='active'||!positionVisible(s,u.pos))continue;alive.add(u.id);let e=this.entries.get(u.id);
   if(e&&e.start!==a.startedAt){this.remove(u.id);e=undefined;}
   if(!e){const group=new THREE.Group(),fill=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xd67d55,side:THREE.DoubleSide,transparent:true,opacity:.1,depthWrite:false,depthTest:true})),solid=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffc17f,transparent:true,opacity:.95,depthWrite:false})),tracking=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xe9ad80,transparent:true,opacity:.6,dashSize:.10,gapSize:.07,depthWrite:false}));fill.renderOrder=12;solid.renderOrder=13;tracking.renderOrder=13;const accent=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffd69c,transparent:true,opacity:.8,depthWrite:false}));accent.renderOrder=13;group.add(fill,solid,tracking,accent);group.name='telegraph:'+u.id;this.group.add(group);e={group,fill,solid,tracking,accent,key:'',start:a.startedAt};this.entries.set(u.id,e);}
   const key=JSON.stringify([a.area,s.barricades]);if(key!==e.key){e.key=key;const poly=areaFootprint(s,a.area),o=areaOrigin(a.area),positions:number[]=[],lines:number[]=[];
    const point=(p:{x:number;y:number})=>{const v=world(p,.065);v.y=terrainHeight(s,o)+.065;return [v.x,v.y,v.z];};
    for(let i=0;i<poly.length;i++)positions.push(...point(o),...point(poly[i]),...point(poly[(i+1)%poly.length]));
    for(const p of [...poly,poly[0]].filter(Boolean))lines.push(...point(p));
    this.buffer(e.fill.geometry,positions);this.buffer(e.solid.geometry,lines);this.buffer(e.tracking.geometry,lines);const inner=[...poly,poly[0]].filter(Boolean).flatMap(p=>point({x:o.x+(p.x-o.x)*.97,y:o.y+(p.y-o.y)*.97}));this.buffer(e.accent.geometry,inner);e.tracking.computeLineDistances();
   }
   const progress=Math.max(0,Math.min(1,(s.time-a.startedAt)/Math.max(.001,a.resolveAt-a.startedAt))),area=a.area;
   const advancing=area.kind==='circle'?{...area,radius:area.radius*progress}:area.kind==='sector'?{...area,range:area.range*progress}:{...area,to:{x:area.from.x+(area.to.x-area.from.x)*progress,y:area.from.y+(area.to.y-area.from.y)*progress}};
   const poly=areaFootprint(s,advancing),origin=areaOrigin(advancing),fill:number[]=[];
   const point=(p:{x:number;y:number})=>{const v=world(p,.065);return [v.x,terrainHeight(s,origin)+.065,v.z];};
   for(let i=0;i<poly.length;i++)fill.push(...point(origin),...point(poly[i]),...point(poly[(i+1)%poly.length]));this.buffer(e.fill.geometry,fill);
   e.group.userData={sourceId:u.id,phase:a.phase,area:a.area,startedAt:a.startedAt,kind:a.kind,enemyAbilityId:a.enemyAbilityId,label:a.label,progress};e.fill.material.opacity=.08+.30*progress;e.fill.material.color.setRGB(.72+.28*progress,.38*(1-progress)+.05,.16*(1-progress)+.04);e.solid.visible=a.phase==='locked';e.tracking.visible=a.phase==='tracking';e.accent.visible=true;
  }
  for(const id of this.entries.keys())if(!alive.has(id))this.remove(id);
  this.updateReactions(s,world);
 }
 private updateReactions(s:GameState,world:(p:{x:number;y:number},extra?:number)=>THREE.Vector3){
  const alive=new Set<string>();if(isStandaloneExploration(s)&&s.phase==='battle')for(const u of s.units){const a=u.enemyCombat?.reaction;if(!a||u.life!=='active'||!positionVisible(s,u.pos))continue;alive.add(u.id);let line=this.tells.get(u.id);
   if(!line){line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xa9d7d3,transparent:true,opacity:.95,depthWrite:false}));line.renderOrder=14;this.tells.set(u.id,line);this.reactions.add(line);}
   let points:{x:number;y:number}[];
   if(a.id==='front-brace'){const h=u.heading??0;points=Array.from({length:25},(_,i)=>{const t=h-Math.PI/3+i*Math.PI/36;return {x:u.pos.x+Math.cos(t)*.55,y:u.pos.y+Math.sin(t)*.55};});}
   else{const dx=a.to.x-a.from.x,dy=a.to.y-a.from.y,len=Math.hypot(dx,dy)||1,end=a.to,base={x:end.x-dx/len*.18,y:end.y-dy/len*.18};points=[a.from,end,{x:base.x-dy/len*.12,y:base.y+dx/len*.12},end,{x:base.x+dy/len*.12,y:base.y-dx/len*.12}];}
   this.buffer(line.geometry,points.flatMap(p=>{const v=world(p,.08);return [v.x,v.y,v.z];}));line.userData={sourceId:u.id,reaction:a.id,phase:a.phase,label:REACTIONS[a.id].label};
  }
  if(this.reactions.children.length&&!this.reactions.parent)this.group.add(this.reactions);
  for(const [id,line]of this.tells)if(!alive.has(id)){this.reactions.remove(line);line.geometry.dispose();(line.material as THREE.Material).dispose();this.tells.delete(id);}
  if(!this.reactions.children.length)this.group.remove(this.reactions);
 }
 private buffer(g:THREE.BufferGeometry,values:number[]){let attr=g.getAttribute('position') as THREE.BufferAttribute;if(!attr||attr.array.length<values.length){attr=new THREE.BufferAttribute(new Float32Array(Math.ceil(Math.max(4096,values.length)/3)*3),3);g.setAttribute('position',attr);} (attr.array as Float32Array).set(values);attr.needsUpdate=true;g.setDrawRange(0,values.length/3);g.computeBoundingSphere();}
 private remove(id:string){const e=this.entries.get(id)!;this.group.remove(e.group);for(const o of [e.fill,e.solid,e.tracking,e.accent]){o.geometry.dispose();(o.material as THREE.Material).dispose();}this.entries.delete(id);}
 dispose(){for(const id of this.entries.keys())this.remove(id);for(const line of this.tells.values()){line.geometry.dispose();(line.material as THREE.Material).dispose();}this.tells.clear();this.reactions.clear();}
}
