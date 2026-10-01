import type {CommandResult,GameState,Pos,Unit} from './types';
import {actionable,clearMotion,clearPersonalAction,protectRecall,requestRecall,PERSONAL} from './personal';
import {cancelLoadout,interruptSkill} from './loadout';
import {canStop,distance,radius} from './spatial';
import {navigate} from './navigation';
import {EXPLORE} from './exploration-content';
const bodies=(s:GameState)=>s.units.filter(u=>u.team==='ally'&&!u.cloneOf&&u.id!=='hunter'&&actionable(u)&&u.ready<=0);
function note(s:GameState,message:string){s.notice=message;s.log.unshift(message);s.log=s.log.slice(0,40);}
function nearSpot(s:GameState,u:Unit,h:Unit,within=1.8):Pos|null{
 const options:Pos[]=[];for(let r=.65;r<=within;r+=.35)for(let i=0;i<24;i++)options.push({x:h.pos.x+Math.cos(i*Math.PI/12)*r,y:h.pos.y+Math.sin(i*Math.PI/12)*r});
 options.sort((a,b)=>distance(a,u.pos)-distance(b,u.pos));return options.find(p=>canStop(s,p,u))||null;
}
function regroup(s:GameState,u:Unit,h:Unit){const p=nearSpot(s,u,h);if(!p){note(s,u.name+' 集结落点不足，保留原处');return false;}const from={...u.pos};clearPersonalAction(u);clearMotion(u);u.pos={...p};u.drawPos={...p};s.effects.push({id:s.nextId++,kind:'blink',from,to:{...p},remaining:.3,color:'#74b9c7'});return true;}
export function requestParty(s:GameState,kind:'recall'|'regroup'):CommandResult{
 const h=s.units.find(a=>a.id==='hunter');if(s.phase!=='battle'||!h||!actionable(h)||h.ready>0)return {ok:false,reason:'需要可行动的在场猎人'};
 const targets=bodies(s);if(!targets.length)return {ok:false,reason:'没有可处理的在场同行本体'};
 let accepted=0;for(const u of targets){if(u.crossing||u.skillLanding||u.skillStates?.[u.skillId||'']?.run?.spec.id==='reap'){note(s,u.name+' 跨层或回镰中，未接受队伍命令');continue;}
  if(u.partyTask?.kind===kind||kind==='recall'&&u.recall){accepted++;continue;}
  cancelLoadout(u);interruptSkill(u);clearPersonalAction(u);clearMotion(u);
  if(s.exploration&&s.context==='explorationIdle'){if(kind==='recall')protectRecall(s,u);else regroup(s,u,h);accepted++;continue;}
  if(kind==='recall'){const r=requestRecall(s,u);if(r.ok)accepted++;else note(s,u.name+' '+r.reason);}
  else{u.partyTask={kind,elapsed:0,repath:0};accepted++;}
 }
 return accepted?{ok:true}:{ok:false,reason:'对象当前无法接受队伍命令'};
}
export function advanceParty(s:GameState,dt:number){const h=s.units.find(a=>a.id==='hunter');for(const u of s.units){const task=u.partyTask;if(!task)continue;
 if(!h||!actionable(h)||!actionable(u)){clearPersonalAction(u);clearMotion(u);note(s,u.name+' 集结取消：猎人或对象不可行动');continue;}
 if(u.crossing){task.elapsed=0;continue;}
 if(distance(h.pos,u.pos)<=PERSONAL.recallRadius){u.path=[];u.destination=null;u.attackPending=undefined;task.elapsed+=dt;if(task.elapsed>=PERSONAL.recallSeconds-1e-7){regroup(s,u,h);u.partyTask=undefined;}continue;}
 task.elapsed=0;task.repath-=dt;if(task.repath>0&&u.path.length)continue;task.repath=.3;const p=nearSpot(s,u,h,PERSONAL.recallRadius);
 const path=p?navigate(s,u.pos,p,false,true,radius(u)):[];if(!path.length){u.partyTask=undefined;clearMotion(u);note(s,u.name+' 集结路径受阻，保留原处');continue;}u.path=path;u.destination={...p!};u.intent='move';
}}
export function setPartySelection(s:GameState,id:string|null){if(!s.exploration)return;s.exploration.selectedId=id;const u=s.units.find(a=>a.id===id);if(u?.following&&!u.crossing){clearMotion(u);u.following=false;}}
export function followParty(s:GameState,_dt:number){if(!s.exploration)return;const h=s.units.find(a=>a.id==='hunter'&&actionable(a));
 for(const u of s.units.filter(a=>a.team==='ally'&&!a.cloneOf&&a.id!=='hunter')){
  if(s.context!=='explorationIdle'||!h||!actionable(u)){if(u.following){if(!u.crossing)clearMotion(u);u.following=false;}continue;}
  if(u.id===s.exploration.selectedId||u.direct||u.recall||u.partyTask||u.rescueTarget||u.loadout||u.skillTime>0||u.skillLanding||u.crossing||u.ready>0||u.skillStates?.[u.skillId||'']?.run)continue;
  if(u.destination&&!u.following||u.path.length&&!u.following)continue;
  const d=distance(u.pos,h.pos);if(d<EXPLORE.followNear){if(u.following)clearMotion(u);u.following=false;continue;}
  if(d<=EXPLORE.followFar&&!u.following)continue;
  if(u.following&&u.path.length&&u.destination&&distance(u.destination,h.pos)<EXPLORE.followFar)continue;
  const p=nearSpot(s,u,h);if(!p)continue;const path=navigate(s,u.pos,p,false,true,radius(u));if(path.length){u.path=path;u.destination={...p};u.intent='move';u.following=true;}
 }
}
