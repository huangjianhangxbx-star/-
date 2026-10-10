import {queryActionStamina,refuseStamina} from './stamina';
import {isXX,xxState,requestXX} from './xx-combat';
import {isAlV2,alState,alNote} from './al-state';
import {isHunterV2,hunterState,cancelHunterSpecial} from './hunter-state';
import {BASIC_DEFINITIONS,resolveBasicDefinition,nextBasicStage} from './basic-definition';
import {startBasicAction,syncBasicReadiness,cancelBasicAction} from './basic-runtime';
import {recordCombatLifecycle,recordCombatRequest} from './combat-identity';
import type {CommandResult,GameState,Pos,Unit} from './types';
import {tacticalBodyHeld,partyTacticFor,focusTargetLegal} from './party-tactics';
import {usesExplorationControl,localAutoCombatAllowed,commandFocus} from './exploration-control';
import {isPartyBody} from './exploration-party';
import {skillState} from './progression';
import {resolveSkill} from './skill-catalog';
import {hasEquippedSkill} from './skill-slots';
import {foregroundSkill} from './skill-slots';
import {canHit} from './engine';
import {distance,faceToward} from './spatial';
import {weightProfile} from './combat-config';
import {cancelMoveOrder} from './move-order';
import {attackCommit} from './exploration';
import {claimControl} from './autonomy';
export type BasicRequestSource='player-input'|'companion-ai'|'order-auto';
export type BasicStage={windup:number;recoveryScale:number};
/** Compatibility view; definitions remain the sole timing data. */
export const BASIC_PROFILES=Object.freeze({default:Object.freeze(BASIC_DEFINITIONS['legacy-main-basic'].stages.map(stage=>Object.freeze({windup:stage.releaseAt,recoveryScale:stage.recoveryScale})))});
export const BASIC_TIMING={buffer:BASIC_DEFINITIONS['legacy-main-basic'].bufferSeconds,continuation:BASIC_DEFINITIONS['legacy-main-basic'].continuationSeconds};
export type BasicRequest={id:number;aim:Pos;targetId?:string;source:BasicRequestSource;expiresAt:number};
export type BasicChainRuntime={stageIndex:number;stageStartedAt:number;targetId?:string;nextStageAllowedAt:number;continuationExpiresAt:number;source:BasicRequestSource;lastRequestId?:number;buffer?:BasicRequest};
export const autoBasicAllowed=(s:GameState,u:Unit)=>!tacticalBodyHeld(s,u)&&localAutoCombatAllowed(s,u)&&(!usesExplorationControl(s)||!isPartyBody(s,u)||s.controlledBodyId!==u.id);
export function clearBasicInput(u:Unit,endChain=false){if(u.stamina)u.stamina.guardExhausted=false;if(u.xxCombat){u.xxCombat.held=false;u.xxCombat.bufferUntil=-Infinity;}if(u.alCombat){u.alCombat.held=false;u.alCombat.shotHeld=false;u.alCombat.edgeUntil=-Infinity;}if(u.hunterCombat){u.hunterCombat.held=false;u.hunterCombat.edgeUntil=-Infinity;}if(u.basicChain){u.basicChain.buffer=undefined;if(endChain)u.basicChain.continuationExpiresAt=-Infinity;}}
const ready=(u:Unit)=>u.life==='active'&&!u.shadowResident&&!u.forcedMotion&&u.stagger<=0&&u.ready<=0&&!u.statuses.some(st=>st.kind==='stun'&&st.remaining>0)&&!foregroundSkill(u)&&!Object.values(u.skillStates||{}).some(st=>st.run)&&!u.crossing&&!u.skillLanding&&!u.evasion?.action&&!u.loadout&&!u.recall&&!u.partyTask&&!u.rescueTarget;
function targetAt(s:GameState,u:Unit,aim:Pos){const oriented={...u};faceToward(oriented,aim);const dx=aim.x-u.pos.x,dy=aim.y-u.pos.y,len=Math.hypot(dx,dy);if(len<1e-7)return undefined;return s.units.filter(e=>e.team!==u.team&&e.life==='active'&&((e.pos.x-u.pos.x)*dx+(e.pos.y-u.pos.y)*dy)/Math.max(.001,distance(e.pos,u.pos)*len)>.5&&canHit(s,oriented,e)).sort((a,b)=>distance(u.pos,a.pos)-distance(u.pos,b.pos)||a.id.localeCompare(b.id))[0];}
function start(s:GameState,u:Unit,r:BasicRequest){
 const check=queryActionStamina(s,u,'basic');if(!check.ok)return refuseStamina(s,u,check);
 const old=u.basicChain,target=r.targetId?s.units.find(e=>e.id===r.targetId):undefined,profile=resolveBasicDefinition(u);
 const follow=profile.clock==='real'?!!old&&(!!u.basicAction||(s.realTime??s.time)<=(u.basicProfileId==='al-basic-v1'?alState(u):hunterState(u)).comboUntil):!!target&&old?.targetId===target.id&&s.time<=old.continuationExpiresAt+1e-8;
 const stage=profile.clock==='real'?(u.basicProfileId==='al-basic-v1'?alState(u):hunterState(u)).nextStage:nextBasicStage(profile,old?.stageIndex,follow),def=profile.stages[stage];
 const w=u.weapons[u.weaponIndex],snipe=hasEquippedSkill(u,'snipe')&&skillState(u,'snipe').enabled?resolveSkill(u,undefined,'snipe'):null,period=(w.attackPeriod??u.attackPeriod)/weightProfile(u).attack*def.recoveryScale*(snipe?.attackPeriodMultiplier??1);
 u.basicChain={stageIndex:stage,targetId:r.targetId,stageStartedAt:s.time,nextStageAllowedAt:s.time+Math.max(def.releaseAt,period),continuationExpiresAt:s.time+Math.max(def.releaseAt,period)+profile.continuationSeconds,source:r.source,lastRequestId:old?.lastRequestId};
 if(r.source==='player-input'){cancelMoveOrder(s,u,'player-basic');if(profile.clock!=='real')u.direct=undefined;u.path=[];u.destination=null;u.intent=null;u.following=false;claimControl(s,u,'action');}
 syncBasicReadiness(s,u);faceToward(u,r.aim);startBasicAction(s,u,profile,stage,r,period);
 if(r.source==='player-input'&&target)u.lastManualBasic={targetId:target.id,at:s.time};
 attackCommit(s,u,target);s.stats.basicStagesStarted=(s.stats.basicStagesStarted||0)+1;return {ok:true};
}
/** One input grants one stage. Authority is checked again at deferred commit. */
export function requestBasic(s:GameState,u:Unit,aim:Pos,id:number,source:BasicRequestSource='player-input',targetId?:string):CommandResult{
 if(source!=='player-input'){const cost=queryActionStamina(s,u,'basic');if(!cost.ok)return cost;}
 if(isXX(s,u)){if(source!=='player-input'&&!autoBasicAllowed(s,u))return {ok:false,reason:'xx AI无权攻击'};return requestXX(s,u,aim,id,source);}
 if(isAlV2(s,u)){
  const h=alState(u),now=s.realTime??s.time;if(!Number.isFinite(aim.x)||!Number.isFinite(aim.y)||!ready(u)||h.motion||h.special&&!h.special.attackReady||s.time<h.hurtUntil||(source==='player-input'?s.controlledBodyId!==u.id||!!s.explorationControl?.aim||!!commandFocus(s):!autoBasicAllowed(s,u)))return {ok:false,reason:'阿尔动作或控制权限不符'};
  if(source==='player-input'&&id<=h.lastInput)return {ok:false,reason:'重复输入'};
  if(s.time+1e-8<h.finalRecoveryUntil){if(source==='player-input'&&h.finalRecoveryUntil-s.time<=.25){h.lastInput=id;h.aim={...aim};h.edgeUntil=now+.25;recordCombatRequest(s,u,'request-buffered',id,source);return {ok:true};}return {ok:false,reason:'整套普攻恢复中'};}
  if(source==='player-input')h.lastInput=id;h.aim={...aim};if(!u.basicAction&&now>h.comboUntil)h.nextStage=0;
  const r:BasicRequest={id,aim:{...aim},targetId,source,expiresAt:now+.25};if(u.basicAction&&!u.basicAction.attackReady){h.edgeUntil=r.expiresAt;return {ok:true};}
  const check=queryActionStamina(s,u,'basic');if(!check.ok)return refuseStamina(s,u,check);
  if(h.special){recordCombatLifecycle(s,h.special.context,'action-finished','next-basic');h.special=undefined;}if(u.basicAction)cancelBasicAction(s,u,'next-basic');start(s,u,r);return {ok:true};
 }
 if(isHunterV2(s,u)){
  const h=hunterState(u);if(!Number.isFinite(aim.x)||!Number.isFinite(aim.y)||!ready(u)||h.special&&!h.special.attackReady||h.motion||s.time<h.hurtUntil||(source==='player-input'?s.controlledBodyId!==u.id||!!s.explorationControl?.aim||!!commandFocus(s):!autoBasicAllowed(s,u)))return {ok:false,reason:'猎人动作或控制权限不符'};
  if(source==='player-input'&&id<=h.lastInput)return {ok:false,reason:'重复普攻请求'};
  if(s.time+1e-8<h.finalRecoveryUntil){if(source==='player-input'&&h.finalRecoveryUntil-s.time<=.25){h.lastInput=id;h.aim={...aim};h.edgeUntil=(s.realTime??s.time)+.25;recordCombatRequest(s,u,'request-buffered',id,source);return {ok:true};}return {ok:false,reason:'整套普攻恢复中'};}
  h.aim={...aim};if(source==='player-input')h.lastInput=id;const now=s.realTime??s.time;
  if(!u.basicAction&&now>h.comboUntil){h.nextStage=0;h.comboUntil=Infinity;}
  const r:BasicRequest={id,aim:{...aim},targetId,source,expiresAt:now+.25};
  if(u.basicAction&&!u.basicAction.attackReady||s.time<h.finalRecoveryUntil){h.edgeUntil=now+.25;u.basicChain??={stageIndex:0,stageStartedAt:0,nextStageAllowedAt:0,continuationExpiresAt:0,source};u.basicChain.buffer=r;recordCombatRequest(s,u,'request-buffered',id,source);return {ok:true};}
  const check=queryActionStamina(s,u,'basic');if(!check.ok)return refuseStamina(s,u,check);
  if(h.special)cancelHunterSpecial(s,u,'next-basic');if(u.basicAction){cancelBasicAction(s,u,'next-basic');}start(s,u,r);return {ok:true};
 }
 const result=requestBasicLegacy(s,u,aim,id,source);if(!result.ok)recordCombatRequest(s,u,'request-rejected',id,source,result.reason);else if(u.basicChain?.buffer?.id===id)recordCombatRequest(s,u,'request-buffered',id,source);return result;
}
function requestBasicLegacy(s:GameState,u:Unit,aim:Pos,id:number,source:BasicRequestSource):CommandResult{
 if(!usesExplorationControl(s)||!isPartyBody(s,u)||!Number.isFinite(aim.x)||!Number.isFinite(aim.y))return {ok:false,reason:'无效普攻请求'};
 if(source==='player-input'?s.controlledBodyId!==u.id||!!s.explorationControl?.aim||!!commandFocus(s):!autoBasicAllowed(s,u))return {ok:false,reason:'当前普攻控制权限不符'};
 if(source==='player-input'&&(!Number.isSafeInteger(id)||id<0||id<=(u.basicChain?.lastRequestId??-1)))return {ok:false,reason:'重复普攻请求'};
 if(!ready(u))return {ok:false,reason:'当前动作尚未结束'};
 const chain=u.basicChain,allowed=Math.max(chain?.nextStageAllowedAt??0,s.time+u.attackTimer),remaining=allowed-s.time;
 if(remaining>resolveBasicDefinition(u).bufferSeconds+1e-8||chain?.buffer)return {ok:false,reason:'尚未进入普攻衔接窗口'};
 if(chain&&source==='player-input')chain.lastRequestId=id;
 const focus=source!=='player-input'&&partyTacticFor(s,u)?.kind==='focus'?partyTacticFor(s,u)?.targetId:undefined;
 const target=focus?(focusTargetLegal(s,focus)?s.units.find(e=>e.id===focus&&canHit(s,{...u,facing:(Math.abs(e.pos.x-u.pos.x)>=Math.abs(e.pos.y-u.pos.y)?e.pos.x<u.pos.x?'west':'east':e.pos.y<u.pos.y?'north':'south')},e)):undefined):targetAt(s,u,aim);if(focus&&!target)return {ok:false,reason:'集火目标当前不可攻击'};const r:BasicRequest={id,aim:{...aim},targetId:target?.id,source,expiresAt:s.time+resolveBasicDefinition(u).bufferSeconds+.05};
 if(remaining>1e-8||u.attackPending){if(!chain)return {ok:false,reason:'当前普攻恢复中'};chain.buffer=r;return {ok:true};}
 const check=start(s,u,r);if(!check.ok)return check;if(source==='player-input')u.basicChain!.lastRequestId=id;return {ok:true};
}
export function advanceBasicInputs(s:GameState){for(const u of s.units){if(isXX(s,u)){const x=xxState(u);if(s.controlledBodyId===u.id&&(x.held||(s.realTime??s.time)<x.bufferUntil)&&(!x.action||x.action.attackReady))requestXX(s,u,x.aim,s.nextId++);continue;}
 if(isAlV2(s,u)){const h=alState(u),now=s.realTime??s.time;if(!u.basicAction&&now>h.comboUntil)h.nextStage=0;if(u.life!=='active'){h.held=false;continue;}if(s.controlledBodyId===u.id&&(h.held||now<h.edgeUntil)&&s.time+1e-8>=h.finalRecoveryUntil&&(!u.basicAction||u.basicAction.attackReady)&&(!h.special||h.special.attackReady)&&!h.motion&&ready(u))requestBasic(s,u,h.aim,Math.max(h.lastInput+1,s.nextId++));continue;}
 if(isHunterV2(s,u)){
  const h=hunterState(u),now=s.realTime??s.time;
  if(!u.basicAction&&now>h.comboUntil){h.nextStage=0;h.comboUntil=Infinity;}
  if(u.life!=='active'){h.held=false;h.edgeUntil=-Infinity;continue;}
  if(s.controlledBodyId===u.id&&usesExplorationControl(s)&&!s.explorationControl?.aim&&!commandFocus(s)&&(!h.special||h.special.attackReady)&&!h.motion&&ready(u)&&s.time>=h.hurtUntil&&s.time>=h.finalRecoveryUntil&&(!u.basicAction||u.basicAction.attackReady)&&(h.held||now<h.edgeUntil)){
   const r=u.basicChain?.buffer;const id=Math.max(h.lastInput+1,s.nextId++);requestBasic(s,u,h.aim,id,'player-input');if(r)u.basicChain!.buffer=undefined;
  }
  continue;
 }
 const c=u.basicChain;if(!c)continue;if(u.life!=='active'){u.basicChain=undefined;continue;}
 if(!ready(u)||s.controlledBodyId!==u.id||!usesExplorationControl(s)||s.explorationControl?.aim||commandFocus(s)){clearBasicInput(u,true);continue;}
 const b=c.buffer;if(!b)continue;
 const target=b.targetId?s.units.find(e=>e.id===b.targetId):undefined;
 if(s.time>b.expiresAt+1e-8||b.targetId&&(!target||!canHit(s,u,target))){clearBasicInput(u,true);continue;}
 if(s.time+1e-8<c.nextStageAllowedAt||u.attackPending)continue;c.buffer=undefined;start(s,u,b);
}}
