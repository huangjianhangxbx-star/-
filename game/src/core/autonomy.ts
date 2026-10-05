import {isPartyBody,isStandaloneExploration} from './exploration-party';
import type {AIState,AITendency,GameState,Pos,Unit} from './types';
import {actionable,clearMotion} from './personal';
import {professionOf} from './skill-catalog';
import {positionVisible} from './visibility';
import {canStop,distance,inWeaponRange} from './spatial';
import {localPoints,localPath,comfortRadius,queryAttackContribution,querySupportContribution,responseCoverage,supportAt,estimateTimeToContribute,type Contribution} from './autonomy-query';
import {canHit,visible} from './engine';
import {AUTONOMY} from './autonomy-config';
import {locomotionLocked} from './pressure';
export {AUTONOMY} from './autonomy-config';

export const TENDENCIES:Record<AITendency,string>={default:'默认',preserve:'保势',rescue:'救护优先',avoid:'规避优先',aggressive:'进攻积极'};
export function aiState(u:Unit):AIState{return u.ai??={intent:'hold',phase:'hold',nextDecision:0,movedAt:-10,commandUntil:0,directTravel:0};}
export const activityRadius=(s:GameState)=>s.exploration?AUTONOMY.exploreRadius:AUTONOMY.towerRadius;
export function initializeAnchor(s:GameState,u:Unit){const ai=aiState(u);ai.anchor={...u.pos};ai.nextDecision=s.time;ai.directTravel=0;}
export function clearAutonomy(u:Unit){if(u.ai?.moving&&!u.crossing)clearMotion(u);u.ai=undefined;}
export function selectControl(s:GameState,id:string|null){s.selectedBodyId=id;if(isStandaloneExploration(s))return;const u=s.units.find(a=>a.id===id);if(!u)return;const ai=aiState(u);if((ai.moving||u.following)&&!u.crossing){clearMotion(u);ai.moving=false;u.following=false;}ai.intent='player';ai.phase='player';ai.task=undefined;ai.targetId=undefined;ai.contributionPoint=undefined;ai.braceUntil=undefined;ai.invalidatedAt=undefined;ai.lastAutoMoveAt=undefined;ai.lastAutoMoveDirection=undefined;}
export function claimControl(s:GameState,u:Unit,kind:NonNullable<AIState['command']>){const ai=aiState(u);ai.moving=false;ai.intent='player';ai.phase='player';ai.task=undefined;ai.targetId=undefined;ai.contributionPoint=undefined;ai.settleUntil=undefined;ai.braceUntil=undefined;ai.invalidatedAt=undefined;ai.lastAutoMoveAt=undefined;ai.lastAutoMoveDirection=undefined;ai.command=kind;ai.commandUntil=s.time+AUTONOMY.commandGrace;ai.nextDecision=ai.commandUntil;if(!ai.anchor&&(!s.exploration||s.context==='explorationBattle'))initializeAnchor(s,u);}
export function completePlayerMove(s:GameState,u:Unit){const ai=u.ai;if(ai?.command==='move'&&!u.path.length&&!u.crossing&&!u.skillLanding){initializeAnchor(s,u);ai.command=undefined;ai.commandUntil=s.time+AUTONOMY.commandGrace;}}
export function recordDirectMove(s:GameState,u:Unit,travel:number){const ai=aiState(u);if(ai.command!=='direct')return;ai.directTravel+=travel;if(ai.directTravel+1e-7>=AUTONOMY.directDistance){ai.anchor={...u.pos};ai.directTravel=0;}}
export function playerOwns(s:GameState,u:Unit){const ai=aiState(u);return (isStandaloneExploration(s)?s.controlledBodyId===u.id:s.selectedBodyId===u.id)||!!u.evasion?.action||!!u.direct||!!u.recall||!!u.partyTask||!!u.rescueTarget||!!u.loadout||!!u.skillLanding||!!u.crossing||u.ready>0||!!u.attackPending||u.skillTime>0||!!u.skillStates?.[u.skillId||'']?.run||!!(u.path.length&&!ai.moving&&!u.following)||!!(u.destination&&!ai.moving&&!u.following)||s.time<ai.commandUntil;}
export function stopAutonomous(u:Unit){if(u.ai?.moving&&!u.crossing)clearMotion(u);if(u.ai)u.ai.moving=false;}

export function recordAutonomyContribution(u:Unit,target:Unit){const task=u.ai?.task;if(task?.kind==='attack'&&task.targetId===target.id)task.contributed=true;}

function beginSettle(s:GameState,u:Unit,reason:string){stopAutonomous(u);const ai=aiState(u);ai.task=undefined;ai.targetId=undefined;ai.contributionPoint=undefined;ai.phase='settle';ai.intent='hold';ai.settleUntil=s.time+AUTONOMY.settleSeconds;if(reason!=='固守：反向移动等待')ai.invalidatedAt=s.time;ai.nextDecision=s.time;ai.rejectReason=reason;}
function risk(s:GameState,u:Unit,p:Pos){return s.units.filter(e=>e.team==='enemy'&&e.life==='active'&&visible(s,e)).reduce((n,e)=>n+(inWeaponRange(s,e,p,e.weapons[e.weaponIndex])?1:0)+(e.attackPending?.targetId===u.id?1:0),0);}
function directThreat(s:GameState,u:Unit,e:Unit){return e.attackPending?.targetId===u.id||e.engagement?.targetId===u.id;}
function shieldguard(u:Unit){return professionOf(u)==='shieldguard';}
function brace(s:GameState,u:Unit){if(!shieldguard(u))return false;const ai=aiState(u),enemies=s.units.filter(e=>e.team==='enemy'&&e.life==='active'&&distance(ai.anchor!,e.pos)<=u.weapons[u.weaponIndex].range+activityRadius(s)+.6);if(enemies.some(e=>directThreat(s,u,e)&&!canHit(s,u,e)&&queryAttackContribution(s,u,e).options.length)){ai.braceUntil=undefined;u.attackPending=undefined;return false;}const effective=enemies.find(e=>canHit(s,u,e));if(effective){stopAutonomous(u);ai.task=undefined;ai.targetId=effective.id;ai.contributionPoint={...u.pos};ai.phase='brace';ai.intent='hold';ai.braceUntil=s.time+AUTONOMY.braceRelease;ai.invalidatedAt=undefined;ai.rejectReason='固守：当前位置可接敌';return true;}if(ai.phase==='brace'&&ai.invalidatedAt===undefined)ai.invalidatedAt=s.time;if(ai.braceUntil&&s.time<ai.braceUntil){stopAutonomous(u);ai.task=undefined;ai.phase='brace';ai.intent='hold';ai.rejectReason='固守：等待接敌稳定';return true;}return false;}
function reverseBlocked(s:GameState,u:Unit,point:Pos,target?:Unit){if(!shieldguard(u))return false;const ai=aiState(u),last=ai.lastAutoMoveDirection;if(!last||s.time-(ai.lastAutoMoveAt??-Infinity)>=AUTONOMY.reverseWindow)return false;const dx=point.x-u.pos.x,dy=point.y-u.pos.y,length=Math.hypot(dx,dy);if(length<.02||(dx*last.x+dy*last.y)/length>=AUTONOMY.reverseDot)return false;if(ai.invalidatedAt!==undefined&&s.time-ai.invalidatedAt<=AUTONOMY.reverseWindow)return false;const enemies=s.units.filter(e=>e.team==='enemy'&&e.life==='active');if(enemies.some(e=>directThreat(s,u,e)&&!canHit(s,u,e)))return false;if(target&&!enemies.some(e=>canHit(s,u,e))&&canHit(s,{...u,pos:point},target))return false;return true;}
function rankPosition(s:GameState,u:Unit,c:Contribution){const profession=professionOf(u),t=u.aiTendency||'default';const weight=t==='avoid'?2.2:t==='preserve'?1+4*(1-u.posture/Math.max(1,u.maxPosture)):.2;const separation=s.units.filter(a=>a!==u&&a.team==='ally'&&a.life==='active').reduce((n,a)=>n+Math.max(0,.65-distance(c.point,a.destination||a.pos)),0);return c.ttc+distance(c.point,aiState(u).anchor!)*(profession==='shieldguard'?.7:.15)+risk(s,u,c.point)*weight+separation*.6;}
function bestPosition(s:GameState,u:Unit,options:Contribution[]){return options.slice().sort((a,b)=>rankPosition(s,u,a)-rankPosition(s,u,b))[0];}
type Choice={kind:'attack'|'support';target:Unit;contribution:Contribution;priority:number};
function chooseTask(s:GameState,u:Unit):Choice|undefined{
 const ai=aiState(u),choices:Choice[]=[];ai.rejectReason='没有局部任务';
 const enemies=s.units.filter(e=>e.team==='enemy'&&e.life==='active'&&distance(ai.anchor!,e.pos)<=u.weapons[u.weaponIndex].range+activityRadius(s)+.6).sort((a,b)=>distance(u.pos,a.pos)-distance(u.pos,b.pos)).slice(0,8);
 for(const e of enemies){const guarding=u.aiTendency==='preserve'||u.aiTendency==='avoid',already=canHit(s,u,e);if(already){const stay={point:{...u.pos},path:[],ttc:AUTONOMY.windup,window:Infinity};choices.push({kind:'attack',target:e,contribution:stay,priority:(directThreat(s,u,e)?100:10)-distance(u.pos,e.pos)-rankPosition(s,u,stay)});if(!guarding)continue;}const query=queryAttackContribution(s,u,e);if(!query.options.length){ai.rejectReason=query.reason;continue;}const coverage=responseCoverage(s,u,e),required=e.role==='heavy'?2:1;ai.coverage=coverage;ai.required=required;
  if(!already&&coverage>=required&&!directThreat(s,u,e)){ai.rejectReason='已有足够响应者';continue;}
  const c=bestPosition(s,u,query.options),t=u.aiTendency||'default';if(already&&risk(s,u,c.point)>=risk(s,u,u.pos)-.5)continue;if((t==='preserve'||t==='avoid')&&risk(s,u,c.point)>risk(s,u,u.pos)+.5){ai.rejectReason='倾向拒绝危险方向';continue;}
  choices.push({kind:'attack',target:e,contribution:c,priority:(directThreat(s,u,e)?100:10)+(t==='aggressive'?2:0)+(already?3:0)-rankPosition(s,u,c)});
 }
 for(const a of s.units){if(a===u||a.team!=='ally'||a.cloneOf||a.life!=='active')continue;const query=querySupportContribution(s,u,a);if(!query.options.length)continue;const c=bestPosition(s,u,query.options);choices.push({kind:'support',target:a,contribution:c,priority:12+(1-a.hp/a.maxHp)*3+(u.aiTendency==='rescue'?5:0)-rankPosition(s,u,c)});}
 return choices.sort((a,b)=>b.priority-a.priority||a.target.id.localeCompare(b.target.id))[0];
}
function startTask(s:GameState,u:Unit,choice:Choice){if(choice.contribution.path.length&&reverseBlocked(s,u,choice.contribution.point,choice.kind==='attack'?choice.target:undefined)){beginSettle(s,u,'固守：反向移动等待');return;}stopAutonomous(u);const ai=aiState(u);ai.phase='commit';ai.task={kind:choice.kind,targetId:choice.target.id,startedAt:s.time,contributed:false,point:{...choice.contribution.point}};ai.targetId=choice.target.id;ai.settleUntil=undefined;ai.invalidatedAt=undefined;ai.rejectReason='';startMove(s,u,choice.contribution,choice.kind==='support'?'support':'approach');}
function startMove(s:GameState,u:Unit,c:Contribution,intent:'approach'|'support'|'return'){const ai=aiState(u);ai.contributionPoint={...c.point};ai.ttc=c.ttc;ai.window=c.window;u.path=c.path.map(p=>({...p}));u.destination=c.path.length?{...c.point}:null;u.intent=c.path.length?'move':null;ai.moving=!!c.path.length;ai.phase=intent==='return'?'return':c.path.length?'approach':'engage';ai.intent=intent;ai.movedAt=s.time;}
function validateTask(s:GameState,u:Unit){const ai=aiState(u),task=ai.task;if(!task)return;const target=s.units.find(a=>a.id===task.targetId);
 if(!target||target.life!=='active'||target.shadowResident){beginSettle(s,u,'任务目标失效');return;}
 if(task.kind==='attack'){
  if(canHit(s,u,target)&&!(ai.moving&&(u.aiTendency==='preserve'||u.aiTendency==='avoid')&&risk(s,u,task.point)<risk(s,u,u.pos)-.5)){stopAutonomous(u);ai.phase='engage';ai.intent='hold';return;}
  if(!canHit(s,{...u,pos:task.point},target)){const q=queryAttackContribution(s,u,target);if(!q.options.length){beginSettle(s,u,q.reason);return;}task.point={...bestPosition(s,u,q.options).point};}
  ai.coverage=responseCoverage(s,u,target);ai.required=target.role==='heavy'?2:1;
  if(!task.contributed&&ai.coverage>=ai.required&&!directThreat(s,u,target)){beginSettle(s,u,'任务需求已满足');return;}
 }else{
  if(target.hp>=target.maxHp){beginSettle(s,u,'支援需求已结束');return;}
  if(supportAt(u,target,u.pos)){stopAutonomous(u);ai.phase='engage';ai.intent='hold';return;}
  if(!supportAt(u,target,task.point)){const q=querySupportContribution(s,u,target);if(!q.options.length){beginSettle(s,u,q.reason);return;}task.point={...bestPosition(s,u,q.options).point};}
 }
 if(ai.moving&&s.time>=ai.nextDecision&&s.time-ai.movedAt>=AUTONOMY.dwell){ai.nextDecision=s.time+AUTONOMY.interval;const q=task.kind==='attack'?queryAttackContribution(s,u,target):querySupportContribution(s,u,target),path=localPath(s,u,task.point);if(q.options.length&&path){const candidate=bestPosition(s,u,q.options),current={point:task.point,path,ttc:estimateTimeToContribute(s,u,path),window:ai.window??Infinity};if(rankPosition(s,u,current)-rankPosition(s,u,candidate)>=AUTONOMY.improvement)task.point={...candidate.point};}}
 if(!ai.moving||!u.path.length||distance(u.destination||u.pos,task.point)>.15){const path=localPath(s,u,task.point);if(!path){beginSettle(s,u,'贡献路径失效');return;}if(path.length&&reverseBlocked(s,u,task.point,task.kind==='attack'?target:undefined)){stopAutonomous(u);ai.phase='settle';ai.intent='hold';ai.rejectReason='固守：反向移动等待';return;}startMove(s,u,{point:task.point,path,ttc:ai.ttc||0,window:ai.window??Infinity},task.kind==='support'?'support':'approach');}
}
/** Validate task lifetime every simulation tick; rate-limit only task selection. */
export function advanceAutonomy(s:GameState,_dt:number){for(const u of s.units){if(!isPartyBody(s,u))continue;
 if(u.life!=='active'||u.shadowResident){clearAutonomy(u);continue;}const ai=aiState(u);
 if(s.exploration&&s.context!=='explorationBattle'){stopAutonomous(u);continue;}ai.anchor??={...u.pos};
 if(locomotionLocked(u)){if(ai.moving)stopAutonomous(u);ai.task=undefined;ai.targetId=undefined;ai.phase='hold';ai.intent='hold';continue;}
 if(actionable(u)&&(!playerOwns(s,u)||ai.phase==='brace'&&!!u.attackPending)&&brace(s,u))continue;
 validateTask(s,u);
 if(!actionable(u)||playerOwns(s,u)){if(ai.moving)stopAutonomous(u);if(!ai.task){ai.phase='player';ai.intent='player';}continue;}
 if(shieldguard(u)){const urgent=s.units.find(e=>e.team==='enemy'&&e.life==='active'&&directThreat(s,u,e)&&!canHit(s,u,e)&&queryAttackContribution(s,u,e).options.length);if(urgent){if(ai.task?.targetId!==urgent.id){const q=queryAttackContribution(s,u,urgent);startTask(s,u,{kind:'attack',target:urgent,contribution:bestPosition(s,u,q.options),priority:100});}continue;}}
 if(ai.task){const target=s.units.find(e=>e.id===ai.task!.targetId);const urgent=s.units.find(e=>e.team==='enemy'&&e.life==='active'&&e.id!==target?.id&&directThreat(s,u,e));if(urgent){const q=queryAttackContribution(s,u,urgent);if(q.options.length)startTask(s,u,{kind:'attack',target:urgent,contribution:bestPosition(s,u,q.options),priority:100});}else if(ai.task.kind==='attack'){const critical=s.units.filter(a=>a!==u&&a.team==='ally'&&!a.cloneOf&&a.life==='active'&&a.hp/a.maxHp<.25).map(a=>({a,q:querySupportContribution(s,u,a)})).find(v=>v.q.options.length);if(critical)startTask(s,u,{kind:'support',target:critical.a,contribution:bestPosition(s,u,critical.q.options),priority:90});}continue;}
 if(ai.phase==='return'&&distance(u.pos,ai.anchor)<=comfortRadius(s)){stopAutonomous(u);ai.phase='hold';ai.intent='hold';}
 // Return never prevents new work; normal decisions retain the existing .35s cadence.
 if(s.time+1e-7<ai.nextDecision&&ai.phase!=='return'&&ai.phase!=='settle')continue;ai.nextDecision=s.time+AUTONOMY.interval;ai.command=undefined;
 const settleReason=ai.rejectReason,choice=chooseTask(s,u);if(choice){startTask(s,u,choice);continue;}
 if(ai.settleUntil&&s.time<ai.settleUntil){ai.phase='settle';ai.intent='hold';ai.rejectReason=settleReason||ai.rejectReason;continue;}
 if(ai.phase==='return'&&ai.moving&&u.path.length)continue;
 ai.settleUntil=undefined;
 if(distance(u.pos,ai.anchor)<=comfortRadius(s)){ai.phase='hold';ai.intent='hold';continue;}
 const d=distance(u.pos,ai.anchor),r=comfortRadius(s)*.8,p={x:ai.anchor.x+(u.pos.x-ai.anchor.x)*r/d,y:ai.anchor.y+(u.pos.y-ai.anchor.y)*r/d};
 const points=[p,...localPoints(s,u).filter(q=>distance(q,ai.anchor!)<=comfortRadius(s))];const point=points.find(q=>canStop(s,q,u)&&localPath(s,u,q));if(!point){ai.phase='hold';ai.intent='hold';ai.rejectReason='舒适区无合法路径';continue;}if(reverseBlocked(s,u,point)){ai.phase='hold';ai.intent='hold';ai.rejectReason='固守：反向返回等待';continue;}const path=localPath(s,u,point)!;startMove(s,u,{point,path,ttc:0,window:Infinity},'return');
}}
