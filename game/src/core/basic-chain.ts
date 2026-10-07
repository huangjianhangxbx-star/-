import {recordCombatAction,recordCombatRequest} from './combat-identity';
import type {CommandResult,GameState,Pos,Unit} from './types';
import {tacticalBodyHeld,partyTacticFor,focusTargetLegal} from './party-tactics';
import {usesExplorationControl,localAutoCombatAllowed,commandFocus} from './exploration-control';
import {isPartyBody} from './exploration-party';
import {skillState} from './progression';
import {resolveSkill,professionOf} from './skill-catalog';
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
export const BASIC_PROFILES:Record<string,BasicStage[]>={default:[{windup:.25,recoveryScale:1},{windup:.25,recoveryScale:1}]};
export const BASIC_TIMING={buffer:.12,continuation:.45};
export type BasicRequest={id:number;aim:Pos;targetId?:string;source:BasicRequestSource;expiresAt:number};
export type BasicChainRuntime={stageIndex:number;stageStartedAt:number;targetId?:string;nextStageAllowedAt:number;continuationExpiresAt:number;source:BasicRequestSource;lastRequestId?:number;buffer?:BasicRequest};
export const autoBasicAllowed=(s:GameState,u:Unit)=>!tacticalBodyHeld(s,u)&&localAutoCombatAllowed(s,u)&&(!usesExplorationControl(s)||!isPartyBody(s,u)||s.controlledBodyId!==u.id);
export function clearBasicInput(u:Unit,endChain=false){if(u.basicChain){u.basicChain.buffer=undefined;if(endChain)u.basicChain.continuationExpiresAt=-Infinity;}}
const ready=(u:Unit)=>u.life==='active'&&!u.shadowResident&&!u.forcedMotion&&u.stagger<=0&&u.ready<=0&&!u.statuses.some(st=>st.kind==='stun'&&st.remaining>0)&&!foregroundSkill(u)&&!Object.values(u.skillStates||{}).some(st=>st.run)&&!u.crossing&&!u.skillLanding&&!u.evasion?.action&&!u.loadout&&!u.recall&&!u.partyTask&&!u.rescueTarget;
function targetAt(s:GameState,u:Unit,aim:Pos){const oriented={...u};faceToward(oriented,aim);const dx=aim.x-u.pos.x,dy=aim.y-u.pos.y,len=Math.hypot(dx,dy);if(len<1e-7)return undefined;return s.units.filter(e=>e.team!==u.team&&e.life==='active'&&((e.pos.x-u.pos.x)*dx+(e.pos.y-u.pos.y)*dy)/Math.max(.001,distance(e.pos,u.pos)*len)>.5&&canHit(s,oriented,e)).sort((a,b)=>distance(u.pos,a.pos)-distance(u.pos,b.pos)||a.id.localeCompare(b.id))[0];}
function start(s:GameState,u:Unit,r:BasicRequest){
 const old=u.basicChain,target=r.targetId?s.units.find(e=>e.id===r.targetId):undefined,profile=BASIC_PROFILES[u.basicProfileId||professionOf(u)]||BASIC_PROFILES.default;
 const follow=!!target&&old?.targetId===target.id&&s.time<=old.continuationExpiresAt+1e-8;
 const stage=follow?(old!.stageIndex+1)%profile.length:0,def=profile[stage];
 const w=u.weapons[u.weaponIndex],snipe=hasEquippedSkill(u,'snipe')&&skillState(u,'snipe').enabled?resolveSkill(u,undefined,'snipe'):null,period=(w.attackPeriod??u.attackPeriod)/weightProfile(u).attack*def.recoveryScale*(snipe?.attackPeriodMultiplier??1);
 u.basicChain={stageIndex:stage,targetId:r.targetId,stageStartedAt:s.time,nextStageAllowedAt:s.time+Math.max(def.windup,period),continuationExpiresAt:s.time+Math.max(def.windup,period)+BASIC_TIMING.continuation,source:r.source,lastRequestId:old?.lastRequestId};
 if(r.source==='player-input'){cancelMoveOrder(s,u,'player-basic');u.direct=undefined;u.path=[];u.destination=null;u.intent=null;u.following=false;claimControl(s,u,'action');}
 faceToward(u,r.aim);u.attackPending={targetId:r.targetId||'',remaining:def.windup,facing:u.facing,basic:true};u.attackTimer=Math.max(u.attackTimer,period);u.attackFlash=def.windup;
 if(r.source==='player-input'&&target)u.lastManualBasic={targetId:target.id,at:s.time};
 u.attackPending!.combatContext=recordCombatAction(s,u,'basic',{requestId:r.id,requestSource:r.source,stageIndex:stage});
 attackCommit(s,u,target);s.stats.basicStagesStarted=(s.stats.basicStagesStarted||0)+1;
}
/** One input grants one stage. Authority is checked again at deferred commit. */
export function requestBasic(s:GameState,u:Unit,aim:Pos,id:number,source:BasicRequestSource='player-input'):CommandResult{
 const result=requestBasicLegacy(s,u,aim,id,source);if(!result.ok)recordCombatRequest(s,u,'request-rejected',id,source,result.reason);else if(u.basicChain?.buffer?.id===id)recordCombatRequest(s,u,'request-buffered',id,source);return result;
}
function requestBasicLegacy(s:GameState,u:Unit,aim:Pos,id:number,source:BasicRequestSource):CommandResult{
 if(!usesExplorationControl(s)||!isPartyBody(s,u)||!Number.isFinite(aim.x)||!Number.isFinite(aim.y))return {ok:false,reason:'无效普攻请求'};
 if(source==='player-input'?s.controlledBodyId!==u.id||!!s.explorationControl?.aim||!!commandFocus(s):!autoBasicAllowed(s,u))return {ok:false,reason:'当前普攻控制权限不符'};
 if(source==='player-input'&&(!Number.isSafeInteger(id)||id<0||id<=(u.basicChain?.lastRequestId??-1)))return {ok:false,reason:'重复普攻请求'};
 if(!ready(u))return {ok:false,reason:'当前动作尚未结束'};
 const chain=u.basicChain,allowed=Math.max(chain?.nextStageAllowedAt??0,s.time+u.attackTimer),remaining=allowed-s.time;
 if(remaining>BASIC_TIMING.buffer+1e-8||chain?.buffer)return {ok:false,reason:'尚未进入普攻衔接窗口'};
 if(chain&&source==='player-input')chain.lastRequestId=id;
 const focus=source!=='player-input'&&partyTacticFor(s,u)?.kind==='focus'?partyTacticFor(s,u)?.targetId:undefined;
 const target=focus?(focusTargetLegal(s,focus)?s.units.find(e=>e.id===focus&&canHit(s,{...u,facing:(Math.abs(e.pos.x-u.pos.x)>=Math.abs(e.pos.y-u.pos.y)?e.pos.x<u.pos.x?'west':'east':e.pos.y<u.pos.y?'north':'south')},e)):undefined):targetAt(s,u,aim);if(focus&&!target)return {ok:false,reason:'集火目标当前不可攻击'};const r:BasicRequest={id,aim:{...aim},targetId:target?.id,source,expiresAt:s.time+BASIC_TIMING.buffer+.05};
 if(remaining>1e-8||u.attackPending){if(!chain)return {ok:false,reason:'当前普攻恢复中'};chain.buffer=r;return {ok:true};}
 start(s,u,r);if(source==='player-input')u.basicChain!.lastRequestId=id;return {ok:true};
}
export function advanceBasicInputs(s:GameState){for(const u of s.units){const c=u.basicChain;if(!c)continue;if(u.life!=='active'){u.basicChain=undefined;continue;}
 if(!ready(u)||s.controlledBodyId!==u.id||!usesExplorationControl(s)||s.explorationControl?.aim||commandFocus(s)){clearBasicInput(u,true);continue;}
 const b=c.buffer;if(!b)continue;
 const target=b.targetId?s.units.find(e=>e.id===b.targetId):undefined;
 if(s.time>b.expiresAt+1e-8||b.targetId&&(!target||!canHit(s,u,target))){clearBasicInput(u,true);continue;}
 if(s.time+1e-8<c.nextStageAllowedAt||u.attackPending)continue;c.buffer=undefined;start(s,u,b);
}}
