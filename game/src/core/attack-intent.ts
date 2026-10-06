import {abilityArea,ENEMY_ABILITIES,type EnemyAbilityId} from './enemy-abilities';
import {COMBAT_CONFIG} from './combat-config';
import type {GameState,Unit,Weapon} from './types';
import {areaHits,angleDelta,clipCapsule,type AttackArea} from './attack-area';
import {attackCommit} from './exploration';
import {isPartyBody,isStandaloneExploration} from './exploration-party';
import {faceToward,distance,surface} from './spatial';
export const STANDALONE_ATTACKS={melee:{range:1.10,arc:100*Math.PI/180,total:.22,lock:.10},ranged:{range:4,radius:.225,total:.30,lock:.14},heavy:{range:1.35,arc:125*Math.PI/180,total:.36,lock:.18}} as const;
export type AttackIntent={kind?:'basic'|'ability';enemyAbilityId?:EnemyAbilityId;label?:string;sourceId:string;targetId:string;startedAt:number;lockAt:number;resolveAt:number;phase:'tracking'|'locked';area:AttackArea;heading:number;damage:number;postureDamage:number;weapon:Weapon};
function shape(s:GameState,e:Unit,h:number,id?:EnemyAbilityId):AttackArea{if(id)return abilityArea(s,e,id,h);const cfg=STANDALONE_ATTACKS[e.role as keyof typeof STANDALONE_ATTACKS];return 'radius'in cfg?clipCapsule(s,{kind:'capsule',from:{...e.pos},to:{x:e.pos.x+Math.cos(h)*cfg.range,y:e.pos.y+Math.sin(h)*cfg.range},radius:cfg.radius}):{kind:'sector',origin:{...e.pos},heading:h,range:cfg.range,arc:cfg.arc};}
export function canStartIntent(s:GameState,e:Unit,t:Unit){
 const cfg=STANDALONE_ATTACKS[e.role as keyof typeof STANDALONE_ATTACKS];
 return !!cfg&&isPartyBody(s,t)&&t.life==='active'&&distance(e.pos,t.pos)<=cfg.range+1e-7&&
  (e.role==='ranged'||surface(s,e.pos)?.layer===surface(s,t.pos)?.layer)&&
  areaHits(s,shape(s,e,Math.atan2(t.pos.y-e.pos.y,t.pos.x-e.pos.x)),t);
}
export function validIntent(s:GameState,e:Unit){return isStandaloneExploration(s)&&s.phase==='battle'&&e.life==='active'&&e.enemyMotion!=='return'&&!!e.pursuitTargetId&&!e.forcedMotion&&e.stagger<=0&&!e.statuses.some(st=>st.kind==='stun'&&st.remaining>0);}
export function startIntent(s:GameState,e:Unit,t:Unit,id?:EnemyAbilityId){
 if(e.attackIntent||!validIntent(s,e)||!['melee','ranged','heavy'].includes(e.role))return false;
 const cfg=id?ENEMY_ABILITIES[id]:STANDALONE_ATTACKS[e.role as keyof typeof STANDALONE_ATTACKS],w={...e.weapons[e.weaponIndex]},heading=Math.atan2(t.pos.y-e.pos.y,t.pos.x-e.pos.x);
 if(id&&!areaHits(s,shape(s,e,heading,id),t))return false;
 if(e.enemyCombat){e.enemyCombat.approach=undefined;if(!id)e.enemyCombat.attackSerial=(e.enemyCombat.attackSerial??0)+1;}faceToward(e,t.pos);e.path=[];e.destination=null;e.moveFrom=undefined;e.moveProgress=0;e.attackPending=undefined;
 e.attackIntent={kind:id?'ability':'basic',enemyAbilityId:id,label:id?ENEMY_ABILITIES[id].label:undefined,sourceId:e.id,targetId:t.id,startedAt:s.time,lockAt:s.time+cfg.lock,resolveAt:s.time+cfg.total,phase:'tracking',area:shape(s,e,heading,id),heading,damage:(id?ENEMY_ABILITIES[id].hp:1)*w.damage*(e.mental==='inspired'?COMBAT_CONFIG.mental.inspiredDamage:e.mental==='distressed'?COMBAT_CONFIG.mental.distressedDamage:1)*(1+e.statuses.filter(st=>st.kind==='attack').reduce((v,st)=>v+st.power,0)),postureDamage:(w.postureDamage??0)*(id?ENEMY_ABILITIES[id].posture:1),weapon:w};
 e.attackTimer=Math.max(w.attackPeriod??e.attackPeriod,cfg.total+.1);attackCommit(s,e,t);s.stats.telegraphsStarted=(s.stats.telegraphsStarted||0)+1;return true;
}
/** Only pre-lock elapsed time may steer; crossing lock clamps the allowed rotation. */
export function tickIntent(s:GameState,e:Unit,dt:number):AttackIntent|null {
 const a=e.attackIntent;if(!a)return null;
 if(!validIntent(s,e)){e.attackIntent=undefined;s.stats.telegraphsCancelled=(s.stats.telegraphsCancelled||0)+1;return null;}
 e.path=[];e.destination=null;
 if(a.phase==='tracking'){
  const target=s.units.find(u=>u.id===a.targetId&&u.life==='active');const steer=Math.max(0,Math.min(dt,a.lockAt-(s.time-dt)));
  if(target&&steer>0){const desired=Math.atan2(target.pos.y-e.pos.y,target.pos.x-e.pos.x),delta=angleDelta(desired,a.heading),max=Math.PI*steer;a.heading+=Math.max(-max,Math.min(max,delta));a.area=shape(s,e,a.heading,a.enemyAbilityId);e.heading=a.heading;e.facing=Math.abs(Math.cos(a.heading))>=Math.abs(Math.sin(a.heading))?Math.cos(a.heading)<0?'west':'east':Math.sin(a.heading)<0?'north':'south';}
  if(s.time>=a.lockAt-1e-7){a.phase='locked';a.area=structuredClone(a.area);}
 }
 if(s.time<a.resolveAt-1e-7)return null;e.attackIntent=undefined;return a;
}
export function intentTargets(s:GameState,a:AttackIntent){return s.units.filter(u=>isPartyBody(s,u)&&u.life==='active'&&!u.shadowResident&&u.ready<=0&&areaHits(s,a.area,u));}
