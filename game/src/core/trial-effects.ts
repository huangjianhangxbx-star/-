import {trialRocketContact} from './trial-rocket-reset';
import {trialState} from './ability-trial';
import type {TrialSnapshot} from './ability-trial';
import {SOURCE_DEFINITIONS} from './ability-sources';
import type {ActionContext} from './combat-identity';
import type {GameState,Unit} from './types';
import {startForcedMotion} from './impact';

/** Compile only effects backed by registered consumers, using the accepted source set. */
export function trialSkillModifiers(snapshot:TrialSnapshot|undefined,root:string){
 let damageRatio=root==='ranged-shot'?(snapshot?.shotDamageRatio??0):0,damageAdd=0,knockRatio=0,cooldownAdd=0,passesTargets=false,stunSeconds=0,instantReload=false,ammoCount=4;
 for(const source of snapshot?.sources??[]){const def=(source.definition??SOURCE_DEFINITIONS[source.definitionId])?.skillModifier;if(!def)continue;for(const m of [def,...def.also??[]]){if(m.root!==root||m.condition==='last-round'&&!snapshot?.lastRound)continue;damageRatio+=m.damageRatio??0;damageAdd+=(m.damageAdd??0)+(m.damagePerFrost??0)*(snapshot?.frost??0);cooldownAdd+=m.cooldownAdd??0;passesTargets ||=!!m.passesTargets;knockRatio+=m.knockRatio??0;stunSeconds=Math.max(stunSeconds,m.stunSeconds??0);instantReload ||=!!m.instantReload;ammoCount=Math.max(ammoCount,m.ammoCount??4);}}
 return {damageRatio,damageAdd,knockRatio,cooldownAdd,passesTargets,stunSeconds,instantReload,ammoCount};
}
export function trialRushPower(context:ActionContext|undefined,base:number){return base+trialSkillModifiers(context?.composition,'rush').damageAdd;}
/** DATA2.3 horizontal travel; project weight/wall motion is the documented port adapter.
 * Vertical knock height and original .75s trajectory are not claimed as reproduced.
 */
export function trialRushImpact(s:GameState,owner:Unit,target:Unit,context:ActionContext|undefined,accepted:boolean,facing:number){
 if(target.team!=='enemy'||!context?.composition||context.executedAbilityId!=='hunter-charge')return;
 const {knockRatio,passesTargets}=trialSkillModifiers(context.composition,'rush');
 if(s.trialProgression&&!passesTargets&&owner.hunterCombat)owner.hunterCombat.motion=undefined;
 if(!accepted)return;
 startForcedMotion(s,target,{distance:2.3*(1+knockRatio),direction:{x:Math.cos(facing),y:Math.sin(facing)}},owner);
}

export function trialSkillCooldown(context:ActionContext|undefined,root:string,base:number){return Math.max(0,base+trialSkillModifiers(context?.composition,root).cooldownAdd);}

export function trialSkillPower(context:ActionContext|undefined,root:string,base:number){const m=trialSkillModifiers(context?.composition,root);return (base+m.damageAdd)*(1+m.damageRatio)*(root==='ranged-shot'?(context?.composition?.critical?.multiplier??1):1);}
export function trialHitEffects(s:GameState,owner:Unit,target:Unit,context:ActionContext|undefined,accepted:boolean){
 trialRocketContact(s,owner,target,context,accepted);
 if(accepted&&context?.composition?.critical&&['小黄远程','小黄远程迫击炮','小黄远程迫击炮爆炸'].includes(context.executedAbilityId??'')){const t=trialState(owner);if(t?.critical?.sourceId===context.composition.critical.sourceId)t.critical=undefined;}
 if(!accepted||target.life!=='active'||target.team===owner.team||!context?.composition)return;
 const root=context.executedAbilityId==='火箭弹射爆炸'?'rocket-land':context.executedAbilityId==='火箭弹射起跳爆炸'?'rocket-launch':undefined;if(!root)return;
 const {stunSeconds}=trialSkillModifiers(context.composition,root);if(stunSeconds<=0)return;
 const key=`cr:${owner.id}:${context.rootActionId}:${root}`,prior=target.statuses.find(x=>x.kind==='stun'&&x.source===key);
 if(prior)prior.remaining=Math.max(prior.remaining,stunSeconds);else target.statuses.push({kind:'stun',remaining:stunSeconds,power:0,source:key,name:'火箭弹射眩晕',origin:owner});
}
