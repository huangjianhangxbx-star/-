import type {GameState,Unit,Direction} from './types';
import type {BasicRequest} from './basic-chain';
import type {BasicDefinition,BasicCancelCause} from './basic-definition';
import {recordCombatAction,recordCombatLifecycle,type ActionContext} from './combat-identity';

export type BasicActionRuntime={definitionId:string;stageIndex:number;acceptedAt:number;elapsed:number;remaining:number;targetId:string;acceptedFacing:Direction;releaseAt:number;moveReadyAt:number;attackReadyAt:number;finishAt:number;cancelBeforeReleaseBy:readonly BasicCancelCause[];released:boolean;moveReady:boolean;attackReady:boolean;requestId:number;requestSource:BasicRequest['source'];combatContext?:ActionContext};
const pending=(a:BasicActionRuntime):NonNullable<Unit['attackPending']>=>({targetId:a.targetId,remaining:a.remaining,facing:a.acceptedFacing,basic:true,combatContext:a.combatContext});
/** The only migrated start creates identity once. Definition and period are resolved once by the chain. */
export function startBasicAction(s:GameState,u:Unit,definition:BasicDefinition,stageIndex:number,r:BasicRequest,period:number){
 // Buffered acceptance precedes this frame's legacy recovery decrement. Acceptance
 // itself is the existing chain's qualification signal; do not retime it to wait
 // for another attackTimer tick or leave the outgoing action without a terminal row.
 if(u.basicAction?.released){recordCombatLifecycle(s,u.basicAction.combatContext,'action-finished','next-basic-accepted');u.basicAction=undefined;}
 const stage=definition.stages[stageIndex],readyAt=Math.max(stage.releaseAt,period);
 const a:BasicActionRuntime={definitionId:definition.id,stageIndex,acceptedAt:s.time,elapsed:0,remaining:stage.releaseAt,targetId:r.targetId||'',acceptedFacing:u.facing,releaseAt:stage.releaseAt,moveReadyAt:stage.moveReadyAt,attackReadyAt:readyAt,finishAt:readyAt,cancelBeforeReleaseBy:stage.cancelBeforeReleaseBy,released:false,moveReady:false,attackReady:false,requestId:r.id,requestSource:r.source,combatContext:recordCombatAction(s,u,'basic',{requestId:r.id,requestSource:r.source,stageIndex})};
 u.basicAction=a;u.attackPending=pending(a);u.attackTimer=Math.max(u.attackTimer,period);u.attackFlash=stage.releaseAt;return a;
}
/** attackTimer remains the single recovery authority, including its existing pause rules. */
export function syncBasicReadiness(s:GameState,u:Unit){
 const a=u.basicAction;if(!a)return;a.elapsed=Math.max(a.elapsed,a.attackReadyAt-u.attackTimer);a.moveReady=a.released&&a.elapsed>=a.moveReadyAt;a.attackReady=u.attackTimer<=1e-8;
 if(a.released&&a.attackReady){recordCombatLifecycle(s,a.combatContext,'action-finished','basic-finish');u.basicAction=undefined;}
}
/** Only called at the original eligible pending execution point. The mirror cannot trigger Release. */
export function advanceBasicAction(s:GameState,u:Unit,dt:number,release:(value:NonNullable<Unit['attackPending']>)=>void):boolean{
 const a=u.basicAction;if(!a||a.released)return false;
 a.remaining-=dt;a.elapsed=a.releaseAt-a.remaining;
 if(a.remaining<=0){a.released=true;a.moveReady=a.elapsed>=a.moveReadyAt;u.attackPending=undefined;release(pending(a));syncBasicReadiness(s,u);}
 else u.attackPending=pending(a);
 return true;
}
/** Common windup cancellation. Recovery after release is preserved, as is the old attackTimer. */
export function cancelBasicAction(s:GameState|undefined,u:Unit,reason:string,reset=false){
 const a=u.basicAction;
 const tag=reason.split(':').at(-1),cause=tag==='motion'||tag==='movement'||tag==='ai-walk'||tag==='command-defense-walk'?'move':tag==='loadout'?'skill':tag==='stun'?'stagger':tag;
 if(a&&!a.released&&!reset&&['move','direct','evade','blink','skill','stagger'].includes(cause!)&&!a.cancelBeforeReleaseBy.includes(cause as BasicCancelCause))return;
 if(a&&(!a.released||reset)){if(s)recordCombatLifecycle(s,a.combatContext,'action-cancelled',reason);u.basicAction=undefined;}
 u.attackPending=undefined;
}
