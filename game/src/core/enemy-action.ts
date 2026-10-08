import type {GameState,Unit,Pos} from './types';
import {allocateRuntimeAction,allocateRuntimeAttack,recordCombatLifecycle,type ActionContext,type AttackEvent} from './combat-identity';
import {distance,clearShot} from './spatial';
import {angleDelta} from './attack-area';
import {isPartyBody,isStandaloneExploration} from './exploration-party';

export type EnemyEvent='prepare'|'lock'|'attack'|'attack-ready'|'move-ready'|'finish';
export type EnemyV2Profile={id:string;source:'EN01 FIXTURE';kind:'melee'|'transport';range:number;minRange:number;detection:number;angle:number;cooldown:number;power:number;arc:number;radius:number;life:number;travel:number;spawnDelay:number;deathPolicy:'retain'|'clear';cancelPolicy:'retain'|'clear';hurtSeconds:number;events:readonly {kind:EnemyEvent;at:number}[]};
export type EnemyActionInstance={context:ActionContext;targetId:string;point:Pos;origin:Pos;facing:number;cursor:number;attackReady:boolean;moveReady:boolean};
export type EnemyV2Trace={at:number;kind:'accepted'|'rejected'|'event'|'cancelled'|'contact'|'expired'|'blocked'|'spawn'|'land';event?:EnemyEvent;reason?:string;actionId?:number;entityId?:number;targetId?:string;hpLost?:number;defense?:string};
export type EnemyV2State={profile:EnemyV2Profile;action?:EnemyActionInstance;readyAt:number;hurtUntil:number;generation:number;lastReason?:string;trace:EnemyV2Trace[]};
export type EnemyRelease={profile:EnemyV2Profile;context:ActionContext;attack:AttackEvent;origin:Pos;point:Pos;facing:number};
export function enemyNote(s:GameState,u:Unit,row:Omit<EnemyV2Trace,'at'>,at=s.time){if(!u.enemyV2)return;u.enemyV2.trace.push({at,...row});if(u.enemyV2.trace.length>256)u.enemyV2.trace.shift();}
export function isEnemyV2(u:Unit){return u.team==='enemy'&&!!u.enemyV2;}
export function enemyCanMove(u:Unit){return u.life==='active'&&u.stagger<=0&&!u.forcedMotion&&!u.statuses.some(x=>x.kind==='stun'&&x.remaining>0)&&(!u.enemyV2?.action||u.enemyV2.action.moveReady);}
export function requestEnemyAction(s:GameState,u:Unit,p:EnemyV2Profile,t?:Unit):{ok:boolean;reason?:string}{
 const st=u.enemyV2??={profile:p,readyAt:0,hurtUntil:0,generation:s.combatIdentity?.generation??1,trace:[]};
 if(st.generation!==(s.combatIdentity?.generation??1)){cancelEnemyAction(s,u,'generation');st.generation=s.combatIdentity?.generation??1;st.readyAt=0;st.hurtUntil=0;}
 const d=t?distance(u.pos,t.pos):Infinity;
 const reason=!isStandaloneExploration(s)||s.phase!=='battle'?'world':u.life!=='active'?'dead':st.action&&!st.action.attackReady?'busy':s.time<st.hurtUntil||u.stagger>0||u.forcedMotion||u.statuses.some(x=>x.kind==='stun'&&x.remaining>0)?'hurt':s.time<st.readyAt?'cooldown':!t||!isPartyBody(s,t)||t.life!=='active'||t.shadowResident||t.ready>0?'target':d>p.detection||!clearShot(s,u.pos,t.pos)?'unseen':d<p.minRange||d>p.range?'range':Math.abs(angleDelta(Math.atan2(t.pos.y-u.pos.y,t.pos.x-u.pos.x),u.heading??0))>p.angle?'direction':undefined;
 if(reason){if(reason!==st.lastReason)enemyNote(s,u,{kind:'rejected',reason});st.lastReason=reason;return {ok:false,reason};}
 if(st.action)cancelEnemyAction(s,u,'superseded');const context=allocateRuntimeAction(s,u,{executedAbilityId:p.id});st.profile=p;st.generation=context.generation;st.lastReason=undefined;st.readyAt=s.time+p.cooldown;
 st.action={context,targetId:t!.id,point:{...t!.pos},origin:{...u.pos},facing:u.heading??0,cursor:0,attackReady:false,moveReady:false};
 u.path=[];u.destination=null;u.pursuitTargetId=t!.id;u.enemyMotion='engaged';enemyNote(s,u,{kind:'accepted',actionId:context.actionId,targetId:t!.id});return {ok:true};
}
export function cancelEnemyAction(s:GameState,u:Unit,reason:string){const st=u.enemyV2,a=st?.action;if(!st||!a)return;enemyNote(s,u,{kind:'cancelled',reason,actionId:a.context.actionId});recordCombatLifecycle(s,a.context,'action-cancelled',reason);st.action=undefined;}
export function advanceEnemyAction(s:GameState,u:Unit):EnemyRelease[]{
 const st=u.enemyV2,a=st?.action;if(!st||!a)return [];
 if(u.life!=='active'||a.context.generation!==s.combatIdentity?.generation){cancelEnemyAction(s,u,u.life==='active'?'generation':'death');return [];}
 if(u.stagger>0||u.forcedMotion||u.statuses.some(x=>x.kind==='stun'&&x.remaining>0)){cancelEnemyAction(s,u,'control');return [];}
 const releases:EnemyRelease[]=[];
 while(a.cursor<st.profile.events.length){const ev=st.profile.events[a.cursor],at=a.context.acceptedAt+ev.at;if(s.time+1e-9<at)break;a.cursor++;
  enemyNote(s,u,{kind:'event',event:ev.kind,actionId:a.context.actionId},at);
  if(ev.kind==='attack'){u.attackFlash=.25;releases.push({profile:st.profile,context:a.context,attack:allocateRuntimeAttack(s,a.context,at),origin:{...a.origin},point:{...a.point},facing:a.facing});}
  if(ev.kind==='attack-ready')a.attackReady=true;if(ev.kind==='move-ready')a.moveReady=true;
  if(ev.kind==='finish'){recordCombatLifecycle(s,a.context,'action-finished','timeline-finish');st.action=undefined;break;}
 }return releases;
}
/** A stationary technical fixture, not imported original AI. Only LOS facts enter selection. */
export function decideEnemyTarget(s:GameState,u:Unit){const p=u.enemyV2!.profile;return s.units.filter(t=>isPartyBody(s,t)&&t.life==='active'&&!t.shadowResident&&t.ready<=0&&distance(u.pos,t.pos)<=p.detection&&clearShot(s,u.pos,t.pos)).sort((a,b)=>distance(u.pos,a.pos)-distance(u.pos,b.pos)||a.id.localeCompare(b.id))[0];}
