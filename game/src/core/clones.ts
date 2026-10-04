import {resetPressure} from './pressure';
import {positionKnown} from './visibility';
import {canPay} from './economy';
import type {CommandResult,GameState,Pos,Unit} from './types';
import {COMBAT_CONFIG} from './combat-config';
import {canDeployAt} from './spatial';
import {resetPersonal,clearMotion,clearPersonalAction} from './personal';
import {initializeSkills,resetNodeSkills} from './progression';
import {interruptSkill,cancelLoadout} from './loadout';
import {cleanEngagements} from './engagement';
import {settleFields} from './skill-execution';

/** A new footprint must never exclude the source's occupied space. */
export function cloneCandidate(u:Unit):Unit{return {...u,id:'',cloneOf:u.id};}
export function queryClone(s:GameState,id:string,to?:Pos):CommandResult{
 const u=s.units.find(a=>a.id===id);
 if(!['battle','briefing'].includes(s.phase)||!u||u.team!=='ally'||u.life!=='active'||u.cloneOf)return {ok:false,reason:'召影需要在场本体'};
 if(!canPay(s,COMBAT_CONFIG.cloneCost))return {ok:false,reason:'召影需要20生命力'};
 if(to&&(!positionKnown(s,to)||!canDeployAt(s,to,cloneCandidate(u))))return {ok:false,reason:'影体完整占地受地形、站位或部署范围阻挡'};
 return {ok:true};
}
export function createClone(u:Unit,id:string,serial:number,to:Pos):Unit{
 const c:Unit={...structuredClone(u),id,name:u.name+'·影 #'+serial,cloneOf:u.id,cloneIdentity:{sourceName:u.name,serial},color:'#344a61',pos:{...to},drawPos:{...to},life:'active',hp:u.maxHp,ready:0,downTimer:0,respawnTimer:0,route:[],routeIndex:0,statuses:[],attackTimer:0,loadout:undefined,hitFlash:0,attackFlash:0,reveal:0,turnCd:0,engagement:undefined,pursuitTargetId:undefined,enemyMotion:undefined,returnPoint:undefined,navWait:undefined,poisonMeter:0};
 clearMotion(c);resetPersonal(c);initializeSkills(c);resetNodeSkills(c);
 return c;
}
export type CloneRemoval='death'|'destroy'|'battle'|'node'|'expedition';
/** Individual removal preserves emitted echoes; scene boundaries clear them separately. */
export function removeClone(s:GameState,id:string,_reason:CloneRemoval):boolean{
 const c=s.units.find(u=>u.id===id&&!!u.cloneOf);if(!c)return false;
 c.life='dead';interruptSkill(c);cancelLoadout(c);clearMotion(c);resetPersonal(c);
 s.units=s.units.filter(u=>u!==c);s.cards=s.cards.filter(card=>card.ownerId!==id);s.economy.pending=s.economy.pending.filter(card=>card.ownerId!==id);
 s.skillEffects=(s.skillEffects||[]).filter(e=>e.sourceId!==id||e.kind!=='seat');
 for(const u of s.units){if(u.attackPending?.targetId===id)u.attackPending=undefined;if(u.rescueTarget===id){u.rescueTarget=null;u.intent=null;u.path=[];u.destination=null;}}
 cleanEngagements(s);settleFields(s);return true;
}
export function clearClones(s:GameState,reason:CloneRemoval):void{for(const u of [...s.units])if(u.cloneOf)removeClone(s,u.id,reason);}
/** Contract for the future exploration exit, not a complete exploration state machine. */
export function leaveExplorationNode(s:GameState):void{
 clearClones(s,'node');s.recoveryBudgets={};s.skillEffects=[];s.effects=[];s.combatEvents=[];s.encounters=[];s.reveals={};
 for(const u of s.units){resetPressure(u);interruptSkill(u);cancelLoadout(u);clearMotion(u);clearPersonalAction(u);u.engagement=undefined;u.pursuitTargetId=undefined;}settleFields(s);
}
