import {cancelMoveOrder} from './move-order';
import {controlledBody} from './direct-control';
import {tacticalAutonomyAllowed} from './exploration-control';
import {isPartyBody,participates,isStandaloneExploration} from './exploration-party';
import {aiState,selectControl,playerOwns,claimControl,initializeAnchor} from './autonomy';
import type {CommandResult,GameState,Pos,Unit} from './types';
import {actionable,clearMotion,clearPersonalAction,protectRecall,requestRecall,PERSONAL} from './personal';
import {cancelLoadout,interruptSkill} from './loadout';
import {canStop,distance,radius} from './spatial';
import {navigate} from './navigation';
import {EXPLORE} from './exploration-content';
import {locomotionLocked} from './pressure';
const bodies=(s:GameState)=>s.units.filter(u=>isPartyBody(s,u)&&u.id!=='hunter'&&actionable(u)&&u.ready<=0);
function note(s:GameState,message:string){s.notice=message;s.log.unshift(message);s.log=s.log.slice(0,40);}
function nearSpot(s:GameState,u:Unit,h:Unit,within=1.8):Pos|null{
 const options:Pos[]=[];for(let r=.65;r<=within;r+=.35)for(let i=0;i<24;i++)options.push({x:h.pos.x+Math.cos(i*Math.PI/12)*r,y:h.pos.y+Math.sin(i*Math.PI/12)*r});
 options.sort((a,b)=>distance(a,u.pos)-distance(b,u.pos));return options.find(p=>canStop(s,p,u))||null;
}
function regroup(s:GameState,u:Unit,h:Unit){const p=nearSpot(s,u,h);if(!p){note(s,u.name+' 集结落点不足，保留原处');return false;}const from={...u.pos};clearPersonalAction(u);clearMotion(u);u.pos={...p};u.drawPos={...p};initializeAnchor(s,u);s.effects.push({id:s.nextId++,kind:'blink',from,to:{...p},remaining:.3,color:'#74b9c7'});return true;}
export function requestParty(s:GameState,kind:'recall'|'regroup'):CommandResult{
 const h=s.units.find(a=>a.id==='hunter');if(s.phase!=='battle'||!h||!actionable(h)||h.ready>0)return {ok:false,reason:'需要可行动的在场猎人'};
 const targets=bodies(s);if(!targets.length)return {ok:false,reason:'没有可处理的在场同行本体'};
 let accepted=0;for(const u of targets){if(u.evasion?.action||u.crossing||u.skillLanding||!!u.skillStates?.reap?.run){note(s,u.name+' 跨层或回镰中，未接受队伍命令');continue;}
  if(u.partyTask?.kind===kind||kind==='recall'&&u.recall){cancelMoveOrder(s,u,'party-'+kind,true);accepted++;continue;}
  if(isStandaloneExploration(s)&&s.context==='explorationIdle'&&kind==='regroup'){
   if(regroup(s,u,h)){cancelLoadout(u);interruptSkill(u);claimControl(s,u,'action');cancelMoveOrder(s,u,'party-'+kind,true);accepted++;}
   continue;
  }
  cancelLoadout(u);interruptSkill(u);clearPersonalAction(u);clearMotion(u);claimControl(s,u,'action');
  if(s.exploration&&s.context==='explorationIdle'){if(kind==='recall')protectRecall(s,u);else regroup(s,u,h);cancelMoveOrder(s,u,'party-'+kind,true);accepted++;continue;}
  if(kind==='recall'){const r=requestRecall(s,u);if(r.ok){cancelMoveOrder(s,u,'party-'+kind,true);accepted++;}else note(s,u.name+' '+r.reason);}
  else{u.partyTask={kind,elapsed:0,repath:0};cancelMoveOrder(s,u,'party-'+kind,true);accepted++;}
 }
 return accepted?{ok:true}:{ok:false,reason:'对象当前无法接受队伍命令'};
}
export function advanceParty(s:GameState,dt:number){const h=s.units.find(a=>a.id==='hunter');for(const u of s.units){const task=u.partyTask;if(!task)continue;
 if(!participates(s,u)||!h||!actionable(h)||!actionable(u)){clearPersonalAction(u);clearMotion(u);note(s,u.name+' 集结取消：猎人或对象不可行动');continue;}
 if(u.crossing){task.elapsed=0;continue;}
 if(locomotionLocked(u)&&distance(h.pos,u.pos)>PERSONAL.recallRadius){task.elapsed=0;task.repath=0;continue;}
 if(distance(h.pos,u.pos)<=PERSONAL.recallRadius){u.path=[];u.destination=null;u.attackPending=undefined;task.elapsed+=dt;if(task.elapsed>=PERSONAL.recallSeconds-1e-7){regroup(s,u,h);u.partyTask=undefined;}continue;}
 task.elapsed=0;task.repath-=dt;if(task.repath>0&&u.path.length)continue;task.repath=.3;const p=nearSpot(s,u,h,PERSONAL.recallRadius);
 const path=p?navigate(s,u.pos,p,false,true,radius(u)):[];if(!path.length){u.partyTask=undefined;clearMotion(u);note(s,u.name+' 集结路径受阻，保留原处');continue;}u.path=path;u.destination={...p!};u.intent='move';
}}
export function setPartySelection(s:GameState,id:string|null){selectControl(s,id);if(s.exploration)s.exploration.selectedId=id;}
/** Stable logical slots are soft regions: close bodies keep their place through short reversals. */
export function followParty(s:GameState,dt:number){if(!s.exploration)return;const h=isStandaloneExploration(s)?controlledBody(s):s.units.find(a=>a.id==='hunter'&&actionable(a));
 const party=s.units.filter(a=>isPartyBody(s,a)&&a.id!==h?.id);
 const run=s.exploration;if(h){const heading=h.heading||0,old=run.formationHeading??heading,delta=Math.atan2(Math.sin(heading-old),Math.cos(heading-old));run.formationHeading=old+Math.max(-dt*1.8,Math.min(dt*1.8,delta));}
 for(const [slot,u] of party.entries()){
  const ai=aiState(u);ai.slot=slot;
  if(!tacticalAutonomyAllowed(s,u))continue;
  if(s.context!=='explorationIdle'||!h||!actionable(u)){if(u.following){if(!u.crossing)clearMotion(u);u.following=false;}continue;}
  if((isStandaloneExploration(s)?s.controlledBodyId:s.selectedBodyId)===u.id&&u.following&&!u.crossing){clearMotion(u);u.following=false;}
  if(playerOwns(s,u))continue;
  if(locomotionLocked(u)){if(u.following){u.path=[];u.destination=null;u.intent=null;u.following=false;}continue;}
  const standalone=isStandaloneExploration(s),leaderDistance=distance(u.pos,h.pos);
  if(standalone){if(leaderDistance>3.5)ai.catchingUp=true;else if(leaderDistance<=2.5)ai.catchingUp=false;}
  if(s.time<ai.nextDecision)continue;ai.nextDecision=s.time+(standalone&&ai.catchingUp?.18:.35);
  const heading=run.formationHeading||0,back=.85+Math.floor(slot/2)*.7,side=(slot%2?-.7:.7),wanted={x:h.pos.x-Math.cos(heading)*back-Math.sin(heading)*side,y:h.pos.y-Math.sin(heading)*back+Math.cos(heading)*side};
  if(standalone&&ai.catchingUp){const dx=u.pos.x-h.pos.x,dy=u.pos.y-h.pos.y,len=Math.hypot(dx,dy)||1;wanted.x=h.pos.x+dx/len*1.2;wanted.y=h.pos.y+dy/len*1.2;}ai.followPoint=wanted;
  const d=distance(u.pos,wanted),separation=s.units.filter(a=>a!==u&&a.team==='ally'&&a.life==='active').reduce((n,a)=>n+Math.max(0,.55-distance(a.pos,u.pos)),0);
  if(d<.65&&separation<.1&&distance(u.pos,h.pos)<EXPLORE.followFar){if(u.following)clearMotion(u);u.following=false;ai.intent='hold';continue;}
  if(u.following&&u.path.length&&u.destination&&distance(u.destination,wanted)<.6)continue;
  const options:Pos[]=[wanted];for(let r=.35;r<=1.05;r+=.35)for(let i=0;i<16;i++)options.push({x:wanted.x+Math.cos(i*Math.PI/8)*r,y:wanted.y+Math.sin(i*Math.PI/8)*r});
  const cost=(p:Pos)=>distance(p,wanted)+distance(p,u.pos)*.08+s.units.filter(a=>a!==u&&a.team==='ally'&&a.life==='active').reduce((n,a)=>n+Math.max(0,.65-distance(p,a.destination||a.pos))*3,0);
  options.sort((a,b)=>cost(a)-cost(b));
  for(const p of options){if(!canStop(s,p,u))continue;const path=navigate(s,u.pos,p,false,true,radius(u));if(!path.length)continue;u.path=path;u.destination={...p};u.intent='move';u.following=true;ai.intent='follow';break;}
 }
}
