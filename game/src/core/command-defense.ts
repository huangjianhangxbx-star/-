import type {GameState,Pos,Unit,CommandResult} from './types';
import {commandFocus,usesExplorationControl} from './exploration-control';
import {foregroundSkill} from './skill-slots';
import {COMBAT_AI} from './companion-combat';
import {queryAbilityDefense,queryProximityDefense,type DefenseObservation} from './defense-query';
import {blink} from './personal';
import {evade} from './evasion';
import {moveOrder} from './move-order';
import {clearBasicInput} from './basic-chain';
export type CommandDefenseState=DefenseObservation&{action:'hold'|'walk'|'blink'|'evade';reason:string;nextDecision:number;ownedPath?:Pos[];point?:Pos};
export const commandDefenseEligible=(s:GameState,u:Unit)=>usesExplorationControl(s)&&s.context==='explorationBattle'&&s.controlledBodyId===u.id&&u.life==='active'&&!u.shadowResident&&!!commandFocus(s);
const physicalReady=(u:Unit)=>!u.direct&&!u.forcedMotion&&u.stagger<=0&&u.posture>0&&u.ready<=0&&!u.statuses.some(st=>st.kind==='stun'&&st.remaining>0)&&!foregroundSkill(u)&&!Object.values(u.skillStates||{}).some(st=>st.run)&&!u.crossing&&!u.skillLanding&&!u.evasion?.action&&!u.loadout&&!u.recall&&!u.partyTask&&!u.rescueTarget;
export function releaseCommandDefense(u:Unit){const a=u.commandDefense;if(!a)return;if(a.ownedPath===u.path&&u.crossing){u.path=[{...u.crossing.to}];u.destination=null;u.afterCross=undefined;if(u.intent==='move')u.intent=null;}else if(a.ownedPath===u.path&&!u.skillLanding){u.path=[];u.destination=null;if(u.intent==='move')u.intent=null;u.moveFrom=undefined;u.moveProgress=0;}u.commandDefense=undefined;}
/** Explicit restricted requester, never masquerades as player or complete AI. */
export function commandDefenseMobility(s:GameState,u:Unit,d:Pos):CommandResult{
 if(!commandDefenseEligible(s,u)||!physicalReady(u))return {ok:false,reason:'防御托管无动作权限'};
 return u.id==='hunter'?blink(s,u,d):evade(s,u,d,'command-defense');
}
export function advanceCommandDefense(s:GameState){for(const u of s.units){
 if(!commandDefenseEligible(s,u)){releaseCommandDefense(u);continue;}
 const a=u.commandDefense??={action:'hold',reason:'safe',nextDecision:0};
 if(a.ownedPath&&a.ownedPath!==u.path){a.ownedPath=undefined;a.action='hold';}
 if(a.ownedPath&&!u.path.length){a.ownedPath=undefined;a.action='hold';a.nextDecision=Math.max(a.nextDecision,s.time+COMBAT_AI.commit);}
 if(!physicalReady(u)){a.reason='atomic-or-disabled';clearBasicInput(u);continue;}
 const plan=queryAbilityDefense(s,u,a,2.5);
 if(plan?.kind==='hold'){a.reason=plan.reason;continue;}
 if(a.ownedPath&&u.path.length)return;
 if(!plan&&s.time<a.nextDecision)continue;
 const choice=plan||queryProximityDefense(s,u);if(!choice){a.reason='safe';continue;}
 a.nextDecision=s.time+Math.max(COMBAT_AI.interval,COMBAT_AI.commit);a.reason=choice.reason;
 if(choice.kind==='mobility'){
  const result=commandDefenseMobility(s,u,choice.direction!);if(!result.ok){a.reason=result.reason!;continue;}a.action=u.id==='hunter'?'blink':'evade';a.ownedPath=undefined;
  clearBasicInput(u,true);const order=moveOrder(s,u);if(order){order.state='suspended';order.suspendReason='defense';}
  s.stats.commandDefenseMobility=(s.stats.commandDefenseMobility||0)+1;continue;
 }
 if(choice.kind==='walk'){
  clearBasicInput(u,true);u.attackPending=undefined;u.path=choice.path!;u.destination={...choice.point!};u.intent='move';u.following=false;u.moveFrom=undefined;u.moveProgress=0;a.ownedPath=u.path;a.point=choice.point;a.action='walk';
  const order=moveOrder(s,u);if(order){order.state='suspended';order.suspendReason='defense';}s.stats.commandDefenseWalks=(s.stats.commandDefenseWalks||0)+1;
 }
}}
