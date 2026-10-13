import type {GameState,Unit} from './types';
import type {ActionContext} from './combat-identity';
import {trialState} from './ability-trial';
export type TrialRocketMark={target:Unit;expires:number;context:ActionContext};
function valid(s:GameState,owner:Unit,c:ActionContext){const t=trialState(owner);return owner.life==='active'&&t&&c.composition?.mainId===t.mainId&&c.generation===s.combatIdentity?.generation?t:undefined;}
function refill(s:GameState,owner:Unit,c:ActionContext,kind:string){const t=valid(s,owner,c);if(!t||!owner.alCombat)return;owner.alCombat.rocketCd=0;t.facts.push({kind,action:c.actionId,at:s.time});if(t.facts.length>64)t.facts.shift();}
/** Original refresh grants one charge; the existing one-charge AL gate represents readiness as CD0.
 * Direct kill and target-marker death are separate consumers, never tied to DirectActor.
 */
export function trialRocketContact(s:GameState,owner:Unit,target:Unit,c:ActionContext|undefined,accepted:boolean){
 if(!accepted||target.team!=='enemy'||!c||!['火箭弹射爆炸','火箭弹射起跳爆炸'].includes(c.executedAbilityId??'')||!c.composition?.sources.some(x=>x.effect==='rocket-reset'))return;
 const t=valid(s,owner,c);if(!t)return;
 if(target.life==='dead'){if(s.time>=(t.rocketDirectReadyAt??0)){t.rocketDirectReadyAt=s.time+.5;refill(s,owner,c,'rocket-direct-kill-refill');}}
 else (t.rocketMarks??=new Map()).set(target.id,{target,expires:s.time+1,context:c});
}
export function advanceTrialRocketMarks(s:GameState,owner:Unit){const t=trialState(owner);if(!t)return;for(const [id,mark] of t.rocketMarks??[]){
 if(!s.units.includes(mark.target)||s.time>mark.expires||!valid(s,owner,mark.context)){t.rocketMarks!.delete(id);continue;}
 if(mark.target.life==='dead'){refill(s,owner,mark.context,'rocket-mark-death-refill');t.rocketMarks!.delete(id);}
}}
