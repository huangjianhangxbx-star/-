import type {GameState,Unit,SkillId} from './types';
import {isStandaloneExploration} from './exploration-party';

export type CombatRequestSource='player-input'|'companion-ai'|'order-auto'|'enemy-ai'|'system'|'legacy';
export type ActionContext={generation:number;actionId:number;rootActionId:number;parentActionId?:number;actorId:string;requestId?:number;requestSource:CombatRequestSource;kind:'basic'|'skill'|'enemy'|'echo';stageIndex?:number;slot?:0|1|2;slotSkillId?:SkillId;executedAbilityId?:string;acceptedAt:number;legacyCastId?:number;entityId?:number};
export type AttackEvent={generation:number;attackEventId:number;actionId:number;rootActionId:number;parentActionId?:number;actorId:string;executedAbilityId?:string;waveId?:number;entityId?:number;releasedAt:number};
export type HitOutcome={enemyPressure?:import('./enemy-pressure').EnemyPressurePreset;rawPower?:number;rawPosture?:number;attackEventId?:number;actionId?:number;sourceActorId?:string;targetId:string;resolveAccepted:boolean;hpBefore:number;hpAfter:number;hpLost:number;postureBefore:number;postureAfter:number;postureApplied:number;lifeBefore:string;lifeAfter:string;legacyEventId?:number;legacyCastId?:number;attribution:'observed'|'legacy'|'unattributed'};
export type CombatTraceRecord={sequence:number;generation:number;at:number;type:'action-started'|'request-rejected'|'request-buffered'|'attack-released'|'hit-outcome'|'action-finished'|'action-cancelled';context?:ActionContext;attack?:AttackEvent;outcome?:HitOutcome;reason?:string;actorId?:string;requestId?:number;requestSource?:CombatRequestSource};
export type CombatIdentityState={nextRuntimeActionId?:number;nextRuntimeAttackId?:number;enabled:boolean;generation:number;nextActionId:number;nextAttackEventId:number;nextTraceSequence:number;trace:CombatTraceRecord[];request?:{source:CombatRequestSource;slot?:0|1|2};activeAttack?:{context:ActionContext;attack:AttackEvent}};
export const COMBAT_TRACE_LIMIT=512;
const fresh=(enabled=true,generation=1):CombatIdentityState=>({enabled,generation,nextActionId:1,nextAttackEventId:1,nextTraceSequence:1,trace:[]});
function state(s:GameState){if(!isStandaloneExploration(s))return undefined;return s.combatIdentity??=fresh();}
export function combatTraceEnabled(s:GameState){return !!state(s)?.enabled;}
export function configureCombatTrace(s:GameState,enabled:boolean){s.combatIdentity??=fresh(enabled);s.combatIdentity.enabled=enabled;}
export function resetCombatTrace(s:GameState){if(s.combatIdentity)s.combatIdentity=fresh(s.combatIdentity.enabled,s.combatIdentity.generation+1);}
/** Copies only bounded scalar metadata; never retains a Unit or a subscriber. */
export function combatTraceSnapshot(s:GameState):CombatTraceRecord[]{return structuredClone(s.combatIdentity?.trace??[]);}
function emit(s:GameState,r:Omit<CombatTraceRecord,'sequence'|'generation'|'at'>,at=s.time){const st=state(s);if(!st?.enabled)return;st.trace.push(structuredClone({...r,sequence:st.nextTraceSequence++,generation:st.generation,at}));if(st.trace.length>COMBAT_TRACE_LIMIT)st.trace.splice(0,st.trace.length-COMBAT_TRACE_LIMIT);}
export function currentCombatAttack(s:GameState){return s.combatIdentity?.enabled?s.combatIdentity.activeAttack:undefined;}
export function recordCombatAction(s:GameState,u:Unit,kind:ActionContext['kind'],details:Partial<Omit<ActionContext,'generation'|'actionId'|'rootActionId'|'actorId'|'kind'|'acceptedAt'>>={},parent?:ActionContext):ActionContext|undefined{
 const st=state(s);if(!st?.enabled)return;const validParent=parent?.generation===st.generation?parent:undefined,actionId=st.nextActionId++;
 const context:ActionContext={...details,generation:st.generation,actionId,rootActionId:validParent?.rootActionId??actionId,parentActionId:validParent?.actionId,actorId:u.id,kind,acceptedAt:s.time,requestSource:details.requestSource??st.request?.source??'system'};
 emit(s,{type:'action-started',context});return context;
}
export function recordSkillAction(s:GameState,u:Unit,id:SkillId,legacyCastId?:number,parent=currentCombatAttack(s)?.context){
 const slot=s.combatIdentity?.request?.slot??u.skillSlots?.findIndex(x=>x===id),namedSlot=slot!==undefined&&slot>=0&&slot<=2?slot as 0|1|2:undefined;
 return recordCombatAction(s,u,'skill',{slot:namedSlot,slotSkillId:namedSlot!==undefined?u.skillSlots?.[namedSlot]??undefined:undefined,executedAbilityId:id,legacyCastId,requestSource:parent?.requestSource??s.combatIdentity?.request?.source??'system'},parent);
}
export function recordAttackEvent(s:GameState,context:ActionContext|undefined,details:Pick<AttackEvent,'waveId'|'entityId'>={},at=s.time):AttackEvent|undefined{
 const st=state(s);if(!st?.enabled||!context||context.generation!==st.generation)return;
 const attack:AttackEvent={...details,generation:st.generation,attackEventId:st.nextAttackEventId++,actionId:context.actionId,rootActionId:context.rootActionId,parentActionId:context.parentActionId,actorId:context.actorId,executedAbilityId:context.executedAbilityId,releasedAt:at};emit(s,{type:'attack-released',context,attack},at);return attack;
}
/** A synchronous observation scope around the existing executor, not a scheduler. */
export function withCombatAttack<T>(s:GameState,context:ActionContext|undefined,execute:()=>T,details:Pick<AttackEvent,'waveId'|'entityId'>={},at=s.time):T{
 const attack=recordAttackEvent(s,context,details,at),st=s.combatIdentity,previous=st?.activeAttack;
 if(attack&&context&&st)st.activeAttack={attack,context};
 try{return execute();}finally{if(st)st.activeAttack=previous;}
}
export function withCombatRequest<T>(s:GameState,source:CombatRequestSource,slot:0|1|2|undefined,execute:()=>T):T{
 const st=state(s);if(!st?.enabled)return execute();const prior=st.request;st.request={source,slot};try{return execute();}finally{st.request=prior;}
}
export function recordCombatRequest(s:GameState,u:Unit,type:'request-rejected'|'request-buffered',requestId:number,requestSource:CombatRequestSource,reason?:string){emit(s,{type,actorId:u.id,requestId,requestSource,reason});}
export function recordCombatLifecycle(s:GameState,context:ActionContext|undefined,type:'action-finished'|'action-cancelled',reason:string){if(context&&context.generation===s.combatIdentity?.generation)emit(s,{type,context,reason});}
/** Observe only existing run/time removal. Does not clear a context, mode or Echo. */
export function withSkillInterruption<T>(s:GameState,u:Unit,interrupt:()=>T,reason='legacy/unknown'):T{
 if(!combatTraceEnabled(s))return interrupt();
 const before=Object.values(u.skillStates??{}).filter(st=>st.run||st.time>0).map(st=>({st,run:st.run,context:st.run?.combatContext??st.combatContext}));
 const result=interrupt();
 for(const prior of before)if(prior.run?prior.st.run!==prior.run:prior.st.time<=0)recordCombatLifecycle(s,prior.context,'action-cancelled',reason);
 return result;
}
export function recordHitOutcome(s:GameState,outcome:HitOutcome,scope=currentCombatAttack(s),at=s.time){emit(s,{type:'hit-outcome',context:scope?.context,attack:scope?.attack,outcome},at);}

/** V2 authority exists without tracing. Negative IDs share this world's generation
 * but cannot collide with the legacy positive recorder or change its sequencing. */
export function allocateRuntimeAction(s:GameState,u:Unit,details:Pick<ActionContext,'executedAbilityId'>={},parent?:ActionContext,at=s.time):ActionContext{
 const st=state(s);if(!st)throw new Error('Runtime identity requires standalone exploration');
 const actionId=-(st.nextRuntimeActionId??1);st.nextRuntimeActionId=-actionId+1;
 const p=parent?.generation===st.generation?parent:undefined;
 const context:ActionContext={...details,generation:st.generation,actionId,rootActionId:p?.rootActionId??actionId,parentActionId:p?.actionId,actorId:u.id,kind:'enemy',requestSource:'enemy-ai',acceptedAt:at};
 emit(s,{type:'action-started',context},at);return context;
}
export function allocateRuntimeAttack(s:GameState,context:ActionContext,at:number,details:Pick<AttackEvent,'entityId'|'waveId'>={}):AttackEvent{
 const st=state(s);if(!st||context.generation!==st.generation)throw new Error('Stale runtime action');
 const attackEventId=-(st.nextRuntimeAttackId??1);st.nextRuntimeAttackId=-attackEventId+1;
 const attack:AttackEvent={...details,generation:context.generation,attackEventId,actionId:context.actionId,rootActionId:context.rootActionId,parentActionId:context.parentActionId,actorId:context.actorId,executedAbilityId:context.executedAbilityId,releasedAt:at};
 emit(s,{type:'attack-released',context,attack},at);return attack;
}
