import type {GameState,Unit,Pos,Weapon} from './types';
import {allocateRuntimeAction,allocateRuntimeAttack,type ActionContext,type AttackEvent} from './combat-identity';
import {intersectsArea,areaHits,clipCapsule,type AttackArea} from './attack-area';
import {distance} from './spatial';
import {isPartyBody} from './exploration-party';
import {cancelEnemyAction,enemyNote,type EnemyRelease,type EnemyV2Profile} from './enemy-action';

export type EnemyAttackEntity={id:number;generation:number;kind:'hazard'|'transport';context:ActionContext;attack:AttackEvent;profile:EnemyV2Profile;weapon:Weapon;from:Pos;to:Pos;pos:Pos;heading:number;spawnAt:number;expireAt:number;contacts:string[]};
export type EnemyRuntimeWorld={generation:number;nextEntityId:number;entities:EnemyAttackEntity[]};
export type EnemyContactResult={accepted:boolean;hpLost:number;defense?:string};
export function enemyWorld(s:GameState):EnemyRuntimeWorld{
 const generation=s.combatIdentity?.generation??1;
 if(!s.enemyRuntime||s.enemyRuntime.generation!==generation)s.enemyRuntime={generation,nextEntityId:1,entities:[]};return s.enemyRuntime;
}
export function commitEnemyRelease(s:GameState,r:EnemyRelease){
 const world=enemyWorld(s),owner=s.units.find(u=>u.id===r.context.actorId);if(!owner||r.context.generation!==world.generation)return;
 const transport=r.profile.kind==='transport',context=transport?allocateRuntimeAction(s,owner,{executedAbilityId:r.profile.id+'-transport'},r.context,r.attack.releasedAt):r.context;
 const spawnAt=r.attack.releasedAt+(transport?r.profile.spawnDelay:0),id=world.nextEntityId++;
 const attack=transport?allocateRuntimeAttack(s,context,spawnAt,{entityId:id}):{...r.attack,entityId:id};
 world.entities.push({id,generation:world.generation,kind:transport?'transport':'hazard',context,attack,profile:r.profile,weapon:{...owner.weapons[owner.weaponIndex],remote:false,damage:r.profile.power,postureDamage:0},from:{...r.origin},to:{...r.point},pos:{...r.origin},heading:r.facing,spawnAt,expireAt:spawnAt+(transport?r.profile.travel:r.profile.life),contacts:[]});
 enemyNote(s,owner,{kind:'spawn',entityId:id,actionId:context.actionId},spawnAt);
}
export function enemyEntityArea(e:EnemyAttackEntity):AttackArea{return e.profile.kind==='melee'?{kind:'sector',origin:e.pos,heading:e.heading,range:e.profile.range,arc:e.profile.arc}:{kind:'circle',center:e.pos,radius:e.profile.radius};}
export function interruptEnemyV2(s:GameState,u:Unit,reason='hurt'){
 const st=u.enemyV2;if(!st)return;cancelEnemyAction(s,u,reason);if(reason==='hurt')st.hurtUntil=s.time+st.profile.hurtSeconds;
 const policy=reason==='death'?st.profile.deathPolicy:st.profile.cancelPolicy;
 if(policy==='clear')enemyWorld(s).entities=enemyWorld(s).entities.filter(e=>e.context.actorId!==u.id);
}
/** The caller owns HP/defense. Per-entity contact bookkeeping is not a damage centre. */
export function advanceEnemyEntities(s:GameState,hit:(e:EnemyAttackEntity,t:Unit,owner:Unit)=>EnemyContactResult){
 const world=enemyWorld(s),next:EnemyAttackEntity[]=[];
 for(const e of world.entities){
  const owner=s.units.find(u=>u.id===e.context.actorId);
  if(!owner||e.generation!==world.generation||owner.life!=='active'&&e.profile.deathPolicy==='clear')continue;
  if(s.time+1e-9<e.spawnAt){next.push(e);continue;}
  if(e.kind==='transport'){
   const f=Math.max(0,Math.min(1,(s.time-e.spawnAt)/e.profile.travel)),to={x:e.from.x+(e.to.x-e.from.x)*f,y:e.from.y+(e.to.y-e.from.y)*f};
   const clipped=clipCapsule(s,{kind:'capsule',from:e.pos,to,radius:0}).to;
   if(distance(clipped,to)>1e-6){enemyNote(s,owner,{kind:'blocked',reason:'wall',entityId:e.id});continue;}e.pos=to;
   if(s.time+1e-9<e.expireAt){next.push(e);continue;}
   const id=world.nextEntityId++,context=allocateRuntimeAction(s,owner,{executedAbilityId:e.profile.id+'-landing'},e.context,e.expireAt),attack=allocateRuntimeAttack(s,context,e.expireAt,{entityId:id,waveId:e.id});
   const landing:EnemyAttackEntity={...e,id,kind:'hazard',context,attack,pos:{...e.to},spawnAt:e.expireAt,expireAt:e.expireAt+e.profile.life,contacts:[]};
   enemyNote(s,owner,{kind:'land',entityId:id,actionId:context.actionId},e.expireAt);
   contact(landing,owner);if(s.time<landing.expireAt-1e-9)next.push(landing);
  }else if(s.time<e.expireAt-1e-9){contact(e,owner);next.push(e);}else enemyNote(s,owner,{kind:'expired',entityId:e.id});
 }
 world.entities=next;
 function contact(e:EnemyAttackEntity,owner:Unit){
  if(s.time>=e.expireAt-1e-9)return;const area=enemyEntityArea(e);
  for(const t of s.units){
   if(!isPartyBody(s,t)||t.life!=='active'||t.shadowResident||t.ready>0||e.contacts.includes(t.id)||!intersectsArea(area,t.pos,t.bodyRadius??.18))continue;
   if(!areaHits(s,area,t)){enemyNote(s,owner,{kind:'blocked',reason:'wall',entityId:e.id,targetId:t.id});continue;}
   e.contacts.push(t.id);const outcome=hit(e,t,owner);enemyNote(s,owner,{kind:'contact',entityId:e.id,targetId:t.id,hpLost:outcome.hpLost,defense:outcome.defense??(outcome.accepted?'contact':'rejected')});
  }
 }
}
