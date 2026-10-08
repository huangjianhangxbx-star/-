import type {GameState,Unit,Pos,CommandResult} from './types';
import {XX_PROFILE} from './xx-profile';
import {recordCombatAction,recordCombatLifecycle,recordAttackEvent,type ActionContext,type AttackEvent} from './combat-identity';
import {faceToward,clearShot} from './spatial';
import {commandFocus} from './exploration-control';
import {attackCommit} from './exploration';
export type XXAction={pose:string;stage:number;elapsed:number;facing:number;attackReady:boolean;moveReady:boolean;windows:{start:number;end:number}[];context?:ActionContext;attack?:AttackEvent;hit:Set<string>};
export type XXState={held:boolean;aim:Pos;nextStage:number;comboUntil:number;hurtUntil:number;bufferUntil:number;lastInput:number;action?:XXAction;trace:{name:string;stage?:number;time:number;at:number;actionId?:number}[]};
export function isXX(s:GameState,u:Unit){return s.journey==='exploration'&&u.id==='hunter'&&!u.cloneOf&&u.basicProfileId===XX_PROFILE.id;}
export function xxState(u:Unit):XXState{return u.xxCombat??={held:false,aim:{x:u.pos.x+1,y:u.pos.y},nextStage:0,comboUntil:Infinity,hurtUntil:0,bufferUntil:-Infinity,lastInput:-1,trace:[]};}
function note(s:GameState,u:Unit,name:string,a=xxState(u).action,time=a?.elapsed??0){const x=xxState(u);x.trace.push({name,stage:a?.stage,time,at:s.time,actionId:a?.context?.actionId});if(x.trace.length>512)x.trace.shift();}
export function cancelXX(s:GameState|undefined,u:Unit,reason:string){const x=u.xxCombat;if(!x)return;if(s&&(x.action||x.held||Number.isFinite(x.bufferUntil))){recordCombatLifecycle(s,x.action?.context,'action-cancelled',reason);note(s,u,'cancel:'+reason);}x.action=undefined;x.held=false;x.bufferUntil=-Infinity;u.attackPending=undefined;u.attackTimer=0;}
export function xxDamage(s:GameState,u:Unit){cancelXX(s,u,'hurt');xxState(u).hurtUntil=s.time+.5;note(s,u,'hurt');}
export function requestXX(s:GameState,u:Unit,aim:Pos,id:number,source:'player-input'|'companion-ai'|'order-auto'='player-input'):CommandResult{
 const x=xxState(u);if(!isXX(s,u)||u.life!=='active'||u.ready>0||u.shadowResident||u.stagger>0||u.forcedMotion||u.crossing||u.partyTask||u.recall||u.loadout||u.statuses.some(st=>st.kind==='stun'&&st.remaining>0)||s.time<x.hurtUntil||!Number.isFinite(aim.x)||!Number.isFinite(aim.y))return {ok:false,reason:'xx 动作不可用'};
 if(source==='player-input'&&(s.controlledBodyId!==u.id||s.explorationControl?.aim||commandFocus(s)||id<=x.lastInput))return {ok:false,reason:'xx 输入权限不符'};
 if(source==='player-input')x.lastInput=id;x.aim={...aim};if(x.action&&!x.action.attackReady){if(source==='player-input')x.bufferUntil=(s.realTime??s.time)+.25;return {ok:true};}
 if(x.action)recordCombatLifecycle(s,x.action.context,'action-finished','xx-next-basic');else if((s.realTime??s.time)>x.comboUntil)x.nextStage=0;
 u.following=false;attackCommit(s,u);const stage=x.nextStage,d=XX_PROFILE.stages[stage];x.action={pose:d.pose,stage,elapsed:0,facing:Math.atan2(aim.y-u.pos.y,aim.x-u.pos.x),attackReady:false,moveReady:false,windows:[{start:d.start,end:d.end}],context:recordCombatAction(s,u,'basic',{requestId:id,requestSource:source,stageIndex:stage}),hit:new Set()};x.nextStage=(stage+1)%4;x.bufferUntil=-Infinity;faceToward(u,aim);u.heading=x.action.facing;u.path=[];u.destination=null;u.attackPending=undefined;u.attackTimer=0;note(s,u,'accepted');return {ok:true};
}
export function xxInput(s:GameState,u:Unit,held=true,aim?:Pos){const x=xxState(u);if(!held){x.held=false;return {ok:true};}if(!isXX(s,u)||s.controlledBodyId!==u.id)return {ok:false,reason:'xx 不是当前操控角色'};x.held=true;return requestXX(s,u,aim??x.aim,s.nextId++);}
export function advanceXX(s:GameState,u:Unit,dt:number,targets:Unit[],hit:(t:Unit,power:number,a:XXAction)=>boolean){
 const x=xxState(u);if(u.life!=='active'||u.stagger>0||u.forcedMotion||u.statuses.some(st=>st.kind==='stun'&&st.remaining>0)){cancelXX(s,u,'interrupt');return;}
 const a=x.action;if(!a)return;const d=XX_PROFILE.stages[a.stage],old=a.elapsed;a.elapsed=Math.min(d.duration,a.elapsed+dt);
 const events=a.windows.flatMap(w=>[{at:w.start,name:'hit_start'},{at:w.end,name:'hit_end'}]).concat([{at:d.recovery,name:'hit_to_idle'}]).sort((a,b)=>a.at-b.at);
 for(const e of events)if((old+1e-8<e.at||old===0&&e.at===0)&&a.elapsed+1e-8>=e.at){note(s,u,e.name,a,e.at);if(e.name==='hit_start'&&!a.attack)a.attack=recordAttackEvent(s,a.context);}
 if(!a.attackReady&&a.elapsed>=d.recovery+1/60){a.attackReady=true;note(s,u,'AttackReady:SAMPLE');}if(!a.moveReady&&a.elapsed>=d.recovery+2/60){a.moveReady=true;note(s,u,'MoveReady:SAMPLE');}
 if(a.attack&&a.windows.some(w=>a.elapsed>=w.start&&old<w.end))for(const t of targets){if(t.team===u.team||t.life!=='active'||a.hit.has(t.id))continue;const dx=t.pos.x-u.pos.x,dy=t.pos.y-u.pos.y,r=Math.hypot(dx,dy),delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-a.facing),Math.cos(Math.atan2(dy,dx)-a.facing));if(r>d.range+.25||Math.abs(delta)>d.halfAngle||!clearShot(s,u.pos,t.pos))continue;a.hit.add(t.id);if(hit(t,d.damage,a)){note(s,u,'contact');s.combatHitstop={until:(s.realTime??s.time)+.03,scale:.15,actorId:u.id,actionId:a.context?.actionId};}}
 if(a.elapsed>=d.duration){recordCombatLifecycle(s,a.context,'action-finished','xx-finish');note(s,u,'Finish');x.action=undefined;x.comboUntil=(s.realTime??s.time)+.625;}
}
export function xxLocked(s:GameState,u:Unit){return isXX(s,u)&&(s.time<xxState(u).hurtUntil||!!xxState(u).action&&!xxState(u).action!.moveReady);}
