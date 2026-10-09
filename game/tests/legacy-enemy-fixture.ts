import type {GameState,Unit} from '../src/core/types';
import {startIntent} from '../src/core/attack-intent';
/** Explicit synthetic Legacy target for shared control/geometry regression, never a map spawn. */
export function legacyEnemy(s:GameState,role:Unit['role']='heavy'){
 const base=s.units.find(u=>u.team==='enemy')??s.units[0],e=structuredClone(base);
 s.postureRuntime=undefined;e.team='enemy';e.role=role;e.asset='Dustin';e.enemyV2=undefined;e.enemyVisualProfileId=undefined;e.basicProfileId=undefined;e.hunterCombat=undefined;e.alCombat=undefined;
 e.enemySense={home:{...e.pos},patrol:[],cursor:0,pursuitPolicy:'chaser'};e.directionalProfileId=role==='heavy'?'heavy-rear-core':'neutral';e.posture=e.maxPosture=role==='heavy'?150:role==='ranged'?60:90;e.hp=e.maxHp=role==='heavy'?270:170;e.damage=6;e.attackPeriod=1.1;
 for(const w of e.weapons){w.damage=6;w.postureDamage=role==='heavy'?24:role==='ranged'?10:14;w.remote=role==='ranged';w.range=role==='ranged'?5:1;}
 return e;
}
/** Synthetic known circle tests the shared hazard consumer; no retired enemy skill ID/AI. */
export function hazard(s:GameState,e:Unit,target:Unit){
 if(!startIntent(s,e,target))return false;
 Object.assign(e.attackIntent!,{kind:'ability',label:'TEST circle',area:{kind:'circle',center:{...e.pos},radius:1.75},lockAt:s.time+.75,resolveAt:s.time+1.15,damage:e.weapons[0].damage*1.4,postureDamage:(e.weapons[0].postureDamage??0)*2});return true;
}
