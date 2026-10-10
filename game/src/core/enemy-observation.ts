import type {GameState} from './types';
import {enemyContactEstimate} from './enemy-pressure';
import type {AttackIntent} from './attack-intent';
import {positionVisible} from './visibility';
import {enemyEntityArea} from './enemy-attack-entity';
/** Read-only main-world danger observation, never an attack executor or AI oracle. */
export type ObservedHazard=AttackIntent&{observationKey?:string};
export function visibleEnemyHazards(s:GameState,target=s.units.find(u=>u.id===s.controlledBodyId)):ObservedHazard[]{
 if(!s.postureRuntime)return [];const generation=s.combatIdentity?.generation,out:ObservedHazard[]=[];
 for(const u of s.units){const st=u.enemyV2,a=st?.action;if(!st||!a||u.life!=='active'||st.generation!==generation||st.profile.kind!=='melee'||!positionVisible(s,u.pos))continue;
  const hit=st.profile.events.find(e=>e.kind==='attack')!,resolveAt=a.context.acceptedAt+hit.at;if(resolveAt<s.time-1e-7)continue;
  const weapon=u.weapons[u.weaponIndex],input=enemyContactEstimate(s,target,st.profile,weapon);
  out.push({sourceId:u.id,targetId:a.targetId,startedAt:a.context.acceptedAt,lockAt:a.context.acceptedAt,resolveAt,phase:'locked',kind:'ability',area:{kind:'sector',origin:{...u.pos},heading:a.facing,range:st.profile.range,arc:st.profile.arc},heading:a.facing,damage:input.power,postureDamage:s.postureRuntime.mode==='xinghai'?input.postureDamage:0,weapon,observationKey:`${generation}/body/${u.id}/${a.context.actionId}`});
 }
 for(const e of s.enemyRuntime?.entities??[]){if(e.generation!==generation||s.time>=e.expireAt)continue;const p=e.kind==='transport'?e.to:e.pos;if(!positionVisible(s,p))continue;
  const input=enemyContactEstimate(s,target,e.profile,e.weapon);
  out.push({sourceId:e.context.actorId,targetId:'',startedAt:e.spawnAt,lockAt:e.spawnAt,resolveAt:e.kind==='transport'?e.expireAt:e.spawnAt,phase:'locked',kind:'ability',area:e.kind==='transport'?{kind:'circle',center:{...e.to},radius:e.profile.radius}:enemyEntityArea(e),heading:e.heading,damage:input.power,postureDamage:s.postureRuntime.mode==='xinghai'?input.postureDamage:0,weapon:e.weapon,observationKey:`${generation}/entity/${e.id}`});
 }
 return out;
}
