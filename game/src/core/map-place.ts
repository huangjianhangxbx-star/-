import type {GameState,Unit} from './types';
import type {WorldPlace} from './world-session';
import type {MapDefinition} from './map-definitions';
import {makeUnit} from './unit-factory';
import {configureCombat} from './unit-combat';
import {registerEnemy,ZOMBIE,ARCHER} from './enemy-profiles';
export const instanceKey=(s:GameState,id:number)=>`${s.world!.id}:${id}`;
export function makePlace(s:GameState,d:MapDefinition):WorldPlace{
 const ids:Record<string,string>={};
 const enemies=d.enemies.map((e,index)=>{const id=`${s.world!.id}:place:${d.id}:enemy:${e.id}`,u=makeUnit(id,e.enemyProfileId==='ranged'?'骷髅弓':'僵尸',e.role,e.pos,'enemy');configureCombat(u);u.hp=u.maxHp=e.hp;u.damage=e.damage;u.asset=e.asset;u.rewardKey=id;u.encounterId=id;u.encounterRoom=d.id*1000+index;u.mapOriginInstance=u.mapOwnerInstance=instanceKey(s,d.id);u.weapons.forEach(w=>w.damage=e.damage);registerEnemy(s,u,e.enemyProfileId==='ranged'?ARCHER:ZOMBIE);u.maxPosture=u.posture=e.enemyProfileId==='ranged'?60:90;ids[e.id]=id;return u;});
 for(const u of enemies)u.mapClockAt=s.time;
 return {definition:d,inactiveAt:s.time,memory:{seen:[],mechanisms:[],objective:false,cleared:false},checkpoint:{...d.entry},unloadedEnemies:enemies,residents:[],mapRoster:{ready:Object.keys(ids).length===d.enemies.length,ids,dead:[]}};
}
/** Shift each inactive entity from its own freeze point; migrated actors have independent clocks. */
export function resumeEnemy(s:GameState,u:Unit,fallback?:number){
 const at=u.mapClockAt??fallback,gap=at===undefined?0:Math.max(0,s.time-at),st=u.enemyV2;
 if(st){st.readyAt+=gap;st.hurtUntil+=gap;if(st.hurtAt!==undefined)st.hurtAt+=gap;if(st.hurtShownUntil!==undefined)st.hurtShownUntil+=gap;if(st.brain){st.brain.repathAt+=gap;if(st.brain.senseAt!==undefined)st.brain.senseAt+=gap;}}
 u.mapClockAt=undefined;
}
