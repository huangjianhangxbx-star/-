import type {AbilityTrial} from './ability-trial';
import type {ActionContext} from './combat-identity';
import {SOURCE_DEFINITIONS} from './ability-sources';
export type TrialReloadEffect={sourceId:string;context:ActionContext;kind:'speed'|'damage';value:number;phase:'pending'|'waiting'|'active';at:number};
/** Native .05 after-cast delay is separate from reload commitment and its events. */
export function scheduleTrialReloadEffects(t:AbilityTrial,c:ActionContext,now:number){
 for(const source of c.composition?.sources??[]){const m=SOURCE_DEFINITIONS[source.definitionId]?.skillModifier;if(m?.root!=='precision')continue;
  for(const [kind,value] of [['speed',m.reloadShotRate],['damage',m.reloadShotDamage]] as const){if(!value)continue;(t.reloadEffects??=[]).push({sourceId:source.id,context:c,kind,value,phase:'pending',at:now+.05});}
 }
}
export function advanceTrialReloadEffects(t:AbilityTrial,now:number){for(const e of t.reloadEffects??[])if(e.phase==='pending'&&e.at<=now+1e-10)e.phase=e.kind==='speed'?'active':'waiting';}
export function trialReloadStarted(t:AbilityTrial){t.reloadEffects=t.reloadEffects?.filter(e=>!(e.phase==='active'&&e.kind==='speed'));}
export function trialReloadCompleted(t:AbilityTrial){t.reloadEffects=t.reloadEffects?.filter(e=>!(e.phase==='active'&&e.kind==='damage'));for(const e of t.reloadEffects??[])if(e.phase==='waiting')e.phase='active';}
export function trialReloadCancelled(t:AbilityTrial,c?:ActionContext){t.reloadEffects=t.reloadEffects?.filter(e=>e.phase==='active'?false:!!c&&e.context.actionId!==c.actionId);}
export function trialReloadValue(t:AbilityTrial,kind:'speed'|'damage'){return (t.reloadEffects??[]).filter(e=>e.phase==='active'&&e.kind===kind).reduce((n,e)=>n+e.value,0);}
