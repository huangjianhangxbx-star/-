import * as THREE from 'three';
import type {GameState,Pos} from '../core/types';
import {positionVisible} from '../core/visibility';
import {isStandaloneExploration} from '../core/exploration-party';
type Entry={sprite:THREE.Sprite;canvas:HTMLCanvasElement;texture:THREE.CanvasTexture;amount:number};
/** One cached text texture per live aggregate; all GPU resources released on expiry. */
export class DamageFloatLayer {
 readonly group=new THREE.Group();private entries=new Map<number,Entry>();
 constructor(){this.group.name='damage-floats';}
 update(s:GameState,world:(p:Pos,extra?:number)=>THREE.Vector3,reduced=false){
  const live=new Set<number>();if(isStandaloneExploration(s)&&s.phase==='battle')for(const f of s.damageFloats||[]){
   const age=s.time-f.lastAt;if(age>=.65||!positionVisible(s,f.pos))continue;live.add(f.id);let e=this.entries.get(f.id);
   if(!e){const canvas=document.createElement('canvas');canvas.width=192;canvas.height=96;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));sprite.scale.set(1.2,.6,1);sprite.renderOrder=20;this.group.add(sprite);e={sprite,canvas,texture,amount:-1};this.entries.set(f.id,e);}
   if(e.amount!==f.amount){const ctx=e.canvas.getContext('2d')!;ctx.clearRect(0,0,192,96);ctx.font='bold 46px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=5;ctx.strokeStyle='#091619';ctx.fillStyle=s.units.find(u=>u.id===f.targetId)?.team==='ally'?'#ffb5a1':'#f8e4bc';const text=Number(f.amount.toFixed(1)).toString();ctx.strokeText(text,96,48);ctx.fillText(text,96,48);e.texture.needsUpdate=true;e.amount=f.amount;}
   e.sprite.position.copy(world(f.pos,2.35+(reduced?0:.35*(1-(1-Math.min(1,(s.time-f.startedAt)/.65))**3))));e.sprite.material.opacity=Math.min(1,(.65-age)/.25);e.sprite.userData={targetId:f.targetId,amount:f.amount,castId:f.castId};
  }
  for(const [id,e]of this.entries)if(!live.has(id)){this.group.remove(e.sprite);e.texture.dispose();e.sprite.material.dispose();this.entries.delete(id);}
 }
 dispose(){for(const e of this.entries.values()){e.texture.dispose();e.sprite.material.dispose();}this.entries.clear();this.group.clear();}
}
