import type {CommandResult,GameState,Pos,Unit} from './types';
import {isPartyBody,isStandaloneExploration} from './exploration-party';
import {positionVisible} from './visibility';
import {activeEncounters,pathSafeFromInactiveEncounters} from './encounter-domain';
import {cancelMoveOrder,hasMoveOrder} from './move-order';
import {foregroundSkill} from './skill-slots';
import {canStop,distance,radius,segmentClear} from './spatial';
import {navigate,type NavigationBudget} from './navigation';

export type PartyTacticKind='free'|'rally'|'focus'|'cautious';
export type PartyTacticRequest={issuerId:string;recipientId:string;kind:PartyTacticKind;targetId?:string;requestId:number;expectedControlRevision:number};
export type PartyTactic={kind:Exclude<PartyTacticKind,'free'>;issuerId:string;recipientId:string;issuedAt:number;execution:'pending-body'|'active'|'blocked';reason?:string;targetId?:string;lastKnownTarget?:{point:Pos;seenAt:number};ownedPath?:Pos[];nextDecision:number;budget:number;lastTick:number;blockedFor:number};
export const PARTY_TACTIC={rallyRadius:2,rallyBudget:8,retry:.25,memory:1.5,focusBlocked:2,basicMemory:2};
const legalBody=(s:GameState,u?:Unit)=>!!u&&isPartyBody(s,u)&&u.life==='active'&&!u.shadowResident;
export function focusTargetLegal(s:GameState,id?:string,visible=true){const e=s.units.find(e=>e.id===id);return !!e&&e.team==='enemy'&&e.life==='active'&&e.enemyMotion!=='return'&&activeEncounters(s).some(a=>a.room===e.encounterRoom)&&(!visible||positionVisible(s,e.pos));}
export function focusCandidate(s:GameState,hoverId?:string){if(focusTargetLegal(s,hoverId))return hoverId;const h=s.units.find(u=>u.id===s.controlledBodyId),recent=h?.lastManualBasic;return recent&&s.time>=recent.at&&s.time-recent.at<=PARTY_TACTIC.basicMemory&&focusTargetLegal(s,recent.targetId)?recent.targetId:undefined;}
export function queryPartyTactic(s:GameState,r:PartyTacticRequest):CommandResult{
 if(!isStandaloneExploration(s)||s.phase!=='battle')return {ok:false,reason:'仅独立探索可下达战术'};
 const issuer=s.units.find(u=>u.id===r.issuerId),recipient=s.units.find(u=>u.id===r.recipientId);
 if(!Number.isSafeInteger(r.requestId)||r.requestId<0||!['free','rally','focus','cautious'].includes(r.kind))return {ok:false,reason:'战术请求无效'};
 if(r.expectedControlRevision!==(s.controlRevision??0)||s.controlledBodyId!==r.issuerId||!legalBody(s,issuer)||!legalBody(s,recipient)||r.issuerId===r.recipientId)return {ok:false,reason:'战术对象或主控已变化'};
 if((r.kind==='rally'||r.kind==='focus')&&(recipient!.recall||recipient!.partyTask||recipient!.rescueTarget||recipient!.intent==='extract'))return {ok:false,reason:'对象正在执行高层任务'};
 if(r.kind==='focus'&&!focusTargetLegal(s,r.targetId))return {ok:false,reason:'集火目标不可见或未交战'};
 return {ok:true};
}
export const partyTacticFor=(s:GameState,u:Unit)=>isStandaloneExploration(s)?s.partyTactics?.[u.id]:undefined;
export const tacticalBodyHeld=(s:GameState,u:Unit)=>u.id!==s.controlledBodyId&&partyTacticFor(s,u)?.kind==='rally';
export function finishPartyTactic(s:GameState,u:Unit,reason:string){const t=s.partyTactics?.[u.id];if(!t)return;
 if(t.ownedPath===u.path&&u.crossing){u.path=[{...u.crossing.to}];u.destination={...u.crossing.to};u.afterCross=undefined;}
 if(t.ownedPath===u.path&&!u.skillLanding&&!u.crossing&&!u.forcedMotion&&!u.evasion?.action){u.path=[];u.destination=null;if(u.intent==='move')u.intent=null;}
 if(u.companionCombat){u.companionCombat.targetId=undefined;if(t.ownedPath===u.path||!u.path.length)u.companionCombat.moving=false;u.companionCombat.committedUntil=0;u.companionCombat.nextDecision=s.time;}
 delete s.partyTactics![u.id];s.notice=u.name+' · '+reason+'，恢复自由';s.log.unshift(s.notice);s.log.length=Math.min(s.log.length,40);
}
export function clearSpecialTactic(s:GameState,u:Unit,reason:string){const t=partyTacticFor(s,u);if(t&&t.kind!=='cautious')finishPartyTactic(s,u,reason);}
export function issuePartyTactic(s:GameState,r:PartyTacticRequest):CommandResult{
 const key=r.issuerId;
 if(r.requestId<=(s.partyTacticRequests?.[key]??-1))return {ok:false,reason:'重复战术请求'};
 const q=queryPartyTactic(s,r);if(!q.ok)return q;const u=s.units.find(u=>u.id===r.recipientId)!;
 finishPartyTactic(s,u,'战术替换');
 if(r.kind==='rally'||r.kind==='focus'){
  cancelMoveOrder(s,u,'party-tactic',true);
  if(!u.crossing&&!u.skillLanding&&!u.forcedMotion&&!u.evasion?.action&&!(foregroundSkill(u)||Object.values(u.skillStates||{}).some(st=>st.run))){u.path=[];u.destination=null;if(u.intent==='move')u.intent=null;}
  u.following=false;if(u.companionCombat){u.companionCombat.moving=false;u.companionCombat.targetId=undefined;u.companionCombat.committedUntil=0;u.companionCombat.nextDecision=0;}if(u.ai){u.ai.command=undefined;u.ai.commandUntil=s.time;u.ai.moving=false;}
 }
 if(r.kind!=='free'){const e=s.units.find(e=>e.id===r.targetId);(s.partyTactics??={})[u.id]={kind:r.kind,issuerId:r.issuerId,recipientId:u.id,issuedAt:s.time,execution:bodyPending(u)?'pending-body':'active',targetId:r.targetId,lastKnownTarget:e?{point:{...e.pos},seenAt:s.time}:undefined,nextDecision:0,budget:0,lastTick:s.time,blockedFor:0};}
 (s.partyTacticRequests??={})[key]=r.requestId;
 s.notice=u.name+' · 已接收 '+({free:'自由行动',rally:'集合',focus:'集火',cautious:'保守'}[r.kind]);return {ok:true};
}
export function bodyPending(u:Unit){return !!(u.ready>0||u.forcedMotion||u.stagger>0||u.posture<=0||u.statuses.some(t=>t.kind==='stun'&&t.remaining>0)||u.attackPending||u.basicAction&&!u.basicAction.moveReady||u.hunterCombat?.special||u.hunterCombat?.motion||u.alCombat?.special||u.alCombat?.motion||u.xxCombat?.action&&!u.xxCombat.action.moveReady||u.crossing||u.skillLanding||u.evasion?.action||u.loadout||foregroundSkill(u)||Object.values(u.skillStates||{}).some(st=>st.run));}
export function maintainPartyTactics(s:GameState){for(const [id,t] of Object.entries(s.partyTactics||{})){const u=s.units.find(u=>u.id===id),leader=s.units.find(u=>u.id===t.issuerId);
 if(!isStandaloneExploration(s)||s.phase!=='battle'||!legalBody(s,u)){if(u)finishPartyTactic(s,u,'对象失效');else delete s.partyTactics![id];continue;}
 if(t.kind==='cautious'){t.execution=bodyPending(u!)?'pending-body':'active';continue;}
 if(u!.id===s.controlledBodyId||!legalBody(s,leader)){finishPartyTactic(s,u!,'控制变化');continue;}
 const dt=Math.max(0,s.time-t.lastTick);t.lastTick=s.time;
 if(t.kind==='focus'){
  if(!focusTargetLegal(s,t.targetId,false)){finishPartyTactic(s,u!,'集火目标结束');continue;}
  const e=s.units.find(e=>e.id===t.targetId)!;
  if(positionVisible(s,e.pos))t.lastKnownTarget={point:{...e.pos},seenAt:s.time};
  else if(!t.lastKnownTarget||s.time-t.lastKnownTarget.seenAt>PARTY_TACTIC.memory){finishPartyTactic(s,u!,'目标记忆过期');continue;}
 }
 if(bodyPending(u!)){t.execution='pending-body';continue;}if(t.execution==='pending-body')t.execution='active';t.budget+=dt;
 if(t.kind==='rally'&&t.budget>=PARTY_TACTIC.rallyBudget)finishPartyTactic(s,u!,'集合超时');
}}
/** Same policy overlays the original profile without mutating its permanent tendency. */
export function effectiveTacticWeights(s:GameState,u:Unit,w:{risk:number;flank:number;peel:number;separation:number}){return partyTacticFor(s,u)?.kind==='cautious'&&u.id!==s.controlledBodyId?{...w,risk:Math.max(2,w.risk),flank:Math.min(.7,w.flank),separation:Math.max(.25,w.separation)}:w;}
function safeRoute(s:GameState,u:Unit,p:Pos,budget?:NavigationBudget){if(!canStop(s,p,u))return null;const path=navigate(s,u.pos,p,false,true,radius(u),budget);return (path.length||distance(u.pos,p)<.05)&&pathSafeFromInactiveEncounters(s,[u.pos,...path],false)?path:null;}
/** Invoked by the single companion writer after defense; Follow yields to this policy. */
export function advanceTacticRoute(s:GameState,u:Unit):boolean{
 const t=partyTacticFor(s,u);if(!t||t.kind==='cautious'||u.id===s.controlledBodyId)return false;
 if(bodyPending(u)||hasMoveOrder(s,u)||u.recall||u.partyTask||u.rescueTarget){t.execution='pending-body';return true;}
 const leader=s.units.find(a=>a.id===t.issuerId)!;
 if(t.kind==='focus'&&focusTargetLegal(s,t.targetId))return false;
 const target=t.kind==='rally'?leader.pos:t.lastKnownTarget?.point;if(!target)return true;
 if(s.time<t.nextDecision)return true;t.nextDecision=s.time+PARTY_TACTIC.retry;
 if(t.kind==='rally'&&distance(u.pos,target)<=PARTY_TACTIC.rallyRadius+.05&&safeRoute(s,u,{...u.pos})!==null){
  if(segmentClear(s,u.pos,target,false,false,radius(u))){finishPartyTactic(s,u,'已到达');return true;}
 }
 const points:Pos[]=[];for(const r of t.kind==='rally'?[1.2,1.6,2]:[.4,.8,1.2])for(let i=0;i<16;i++)points.push({x:target.x+Math.cos(i*Math.PI/8)*r,y:target.y+Math.sin(i*Math.PI/8)*r});points.sort((a,b)=>distance(a,u.pos)-distance(b,u.pos));
 const budget={remaining:128};for(const p of points){if(budget.remaining<=0)break;const path=safeRoute(s,u,p,budget);if(path===null)continue;if(t.ownedPath===u.path&&u.path.length&&u.destination&&distance(u.destination,p)<.5){t.execution='active';return true;}u.path=path;u.destination=path.length?{...p}:null;u.intent=path.length?'move':null;u.following=false;t.ownedPath=path;if(u.companionCombat)u.companionCombat.moving=false;t.execution='active';t.reason=undefined;return true;}
 if(t.ownedPath===u.path){u.path=[];u.destination=null;if(u.intent==='move')u.intent=null;if(u.companionCombat)u.companionCombat.moving=false;}
 t.execution='blocked';t.reason='没有安全可达路径';return true;
}
export function focusPathResult(s:GameState,u:Unit,ok:boolean){const t=partyTacticFor(s,u);if(t?.kind!=='focus')return;if(ok){t.blockedFor=0;t.execution='active';t.reason=undefined;}else{t.blockedFor+=.2;t.execution='blocked';t.reason='集火贡献路径受阻';if(t.blockedFor>=PARTY_TACTIC.focusBlocked)finishPartyTactic(s,u,'集火路径超时');}}
