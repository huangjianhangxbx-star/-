import {alState,alNote} from './al-state';
import type {GameState,Unit,Direction} from './types';
import type {BasicRequest} from './basic-chain';
import type {BasicDefinition,BasicCancelCause} from './basic-definition';
import {hunterState,hunterNote} from './hunter-state';
import {BASIC_DEFINITIONS} from './basic-definition';
import {recordCombatAction,recordCombatLifecycle,type ActionContext} from './combat-identity';

export type BasicActionRuntime={definitionId:string;dashStarted?:boolean;dashLeft?:number;angle?:number;presentationId?:string;stageIndex:number;acceptedAt:number;elapsed:number;remaining:number;targetId:string;acceptedFacing:Direction;releaseAt:number;moveReadyAt:number;attackReadyAt:number;finishAt:number;cancelBeforeReleaseBy:readonly BasicCancelCause[];released:boolean;moveReady:boolean;attackReady:boolean;requestId:number;requestSource:BasicRequest['source'];combatContext?:ActionContext};
const pending=(a:BasicActionRuntime):NonNullable<Unit['attackPending']>=>({targetId:a.targetId,remaining:a.remaining,facing:a.acceptedFacing,basic:true,combatContext:a.combatContext});
/** The only migrated start creates identity once. Definition and period are resolved once by the chain. */
export function startBasicAction(s:GameState,u:Unit,definition:BasicDefinition,stageIndex:number,r:BasicRequest,period:number){
 // Buffered acceptance precedes this frame's legacy recovery decrement. Acceptance
 // itself is the existing chain's qualification signal; do not retime it to wait
 // for another attackTimer tick or leave the outgoing action without a terminal row.
 if(u.basicAction?.released){recordCombatLifecycle(s,u.basicAction.combatContext,'action-finished','next-basic-accepted');u.basicAction=undefined;}
 const stage=definition.stages[stageIndex],readyAt=typeof stage.attackReadyAt==='number'?stage.attackReadyAt:Math.max(stage.releaseAt,period);
 const a:BasicActionRuntime={definitionId:definition.id,presentationId:stage.presentationId,stageIndex,acceptedAt:s.time,elapsed:0,remaining:stage.releaseAt,targetId:r.targetId||'',acceptedFacing:u.facing,releaseAt:stage.releaseAt,moveReadyAt:stage.moveReadyAt,attackReadyAt:readyAt,finishAt:typeof stage.finishAt==='number'?stage.finishAt:readyAt,cancelBeforeReleaseBy:stage.cancelBeforeReleaseBy,released:false,moveReady:false,attackReady:false,requestId:r.id,requestSource:r.source,combatContext:recordCombatAction(s,u,'basic',{requestId:r.id,requestSource:r.source,stageIndex})};
 u.basicAction=a;u.attackPending=pending(a);u.attackTimer=definition.clock==='real'?readyAt:Math.max(u.attackTimer,period);
 if(definition.clock==='real'){const al=definition.id==='al-basic-v1',h=al?alState(u):hunterState(u);a.angle=Math.atan2(r.aim.y-u.pos.y,r.aim.x-u.pos.x);h.nextStage=(stageIndex+1)%definition.stages.length;h.comboUntil=Infinity;h.edgeUntil=-Infinity;if(!al&&stageIndex===3)hunterState(u).finalRecoveryUntil=s.time+.5;(al?alNote:hunterNote)(s,u,'accepted',stageIndex,a.combatContext?.actionId);}u.attackFlash=stage.releaseAt;return a;
}
/** attackTimer remains the single recovery authority, including its existing pause rules. */
export function syncBasicReadiness(s:GameState,u:Unit){
 const a=u.basicAction;if(!a||BASIC_DEFINITIONS[a.definitionId]?.clock==='real')return;a.elapsed=Math.max(a.elapsed,a.attackReadyAt-u.attackTimer);a.moveReady=a.released&&a.elapsed>=a.moveReadyAt;a.attackReady=u.attackTimer<=1e-8;
 if(a.released&&a.attackReady){recordCombatLifecycle(s,a.combatContext,'action-finished','basic-finish');u.basicAction=undefined;}
}
/** Only called at the original eligible pending execution point. The mirror cannot trigger Release. */
export function advanceBasicAction(s:GameState,u:Unit,dt:number,release:(value:NonNullable<Unit['attackPending']>)=>void):boolean{
 const a=u.basicAction;if(!a)return false;
 if(BASIC_DEFINITIONS[a.definitionId]?.clock==='real'){
  const al=a.definitionId==='al-basic-v1',note=al?alNote:hunterNote;const stage=BASIC_DEFINITIONS[a.definitionId].stages[a.stageIndex];a.elapsed=Math.min(a.finishAt,a.elapsed+dt);a.remaining=a.releaseAt-a.elapsed;
  if(!a.dashStarted&&a.elapsed+1e-10>=stage.dashAt!){a.dashStarted=true;a.dashLeft=stage.dashDuration;note(s,u,'Dash',a.stageIndex,a.combatContext?.actionId);}
  if(!a.released&&a.elapsed+1e-10>=a.releaseAt){a.released=true;u.attackPending=undefined;note(s,u,'Hit',a.stageIndex,a.combatContext?.actionId,'release');release(pending(a));}
  if(!a.attackReady&&a.elapsed+1e-10>=a.attackReadyAt){a.attackReady=true;note(s,u,'AttackReady',a.stageIndex,a.combatContext?.actionId);}
  if(!a.moveReady&&a.elapsed+1e-10>=a.moveReadyAt){a.moveReady=true;note(s,u,'MoveReady',a.stageIndex,a.combatContext?.actionId);}
  u.attackTimer=Math.max(0,a.attackReadyAt-a.elapsed);if(!a.released)u.attackPending=pending(a);
  if(a.elapsed>=a.finishAt){recordCombatLifecycle(s,a.combatContext,'action-finished','basic-finish');note(s,u,'Finish',a.stageIndex,a.combatContext?.actionId);(al?alState(u):hunterState(u)).comboUntil=(s.realTime??s.time)+(al?.5:.625);u.basicAction=undefined;}
  return true;
 }
 if(a.released)return false;
 a.remaining-=dt;a.elapsed=a.releaseAt-a.remaining;
 if(a.remaining<=0){a.released=true;a.moveReady=a.elapsed>=a.moveReadyAt;u.attackPending=undefined;release(pending(a));syncBasicReadiness(s,u);}
 else u.attackPending=pending(a);
 return true;
}
/** Common windup cancellation. Recovery after release is preserved, as is the old attackTimer. */
export function cancelBasicAction(s:GameState|undefined,u:Unit,reason:string,reset=false){
 const a=u.basicAction;
 if(a&&BASIC_DEFINITIONS[a.definitionId]?.clock==='real'){
  if(a.definitionId==='al-basic-v1'){const h=alState(u);h.comboUntil=(s?.realTime??s?.time??0)+.5;h.entities=h.entities.filter(e=>e.context?.actionId!==a.combatContext?.actionId);if(s){recordCombatLifecycle(s,a.combatContext,'action-cancelled',reason);alNote(s,u,'Cancel',a.stageIndex,a.combatContext?.actionId);}u.basicAction=undefined;u.attackPending=undefined;u.attackTimer=0;return;}
  const h=hunterState(u);h.comboUntil=(s?.realTime??s?.time??0)+.625;
  if(s){recordCombatLifecycle(s,a.combatContext,'action-cancelled',reason);hunterNote(s,u,'Cancel',a.stageIndex,a.combatContext?.actionId);}
  if(reset||a.stageIndex<3)h.hazards=h.hazards.filter(x=>x.context?.actionId!==a.combatContext?.actionId);
  u.basicAction=undefined;u.attackPending=undefined;u.attackTimer=0;return;
 }
 const tag=reason.split(':').at(-1),cause=tag==='motion'||tag==='movement'||tag==='ai-walk'||tag==='command-defense-walk'?'move':tag==='loadout'?'skill':tag==='stun'?'stagger':tag;
 if(a&&!a.released&&!reset&&['move','direct','evade','blink','skill','stagger'].includes(cause!)&&!a.cancelBeforeReleaseBy.includes(cause as BasicCancelCause))return;
 if(a&&(!a.released||reset)){if(s)recordCombatLifecycle(s,a.combatContext,'action-cancelled',reason);u.basicAction=undefined;}
 u.attackPending=undefined;
}
