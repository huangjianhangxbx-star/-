import type {GameState,Unit,Pos,CommandResult} from './types';
import {HUNTER_V2 as p} from './hunter-combat-profile';
import {hunterState,hunterNote,isHunterV2,cancelHunterSpecial,type HunterAction,type HunterHazard} from './hunter-state';
import {advanceBasicAction,cancelBasicAction} from './basic-runtime';
import {recordCombatAction,recordCombatLifecycle,withCombatAttack,currentCombatAttack,type ActionContext} from './combat-identity';
import {requestBasic} from './basic-chain';
import {segmentClear,terrainFits,radius,faceToward,clearShot} from './spatial';
import {commandFocus} from './exploration-control';
export {isHunterV2,hunterState} from './hunter-state';
const angle=(u:Unit,aim:Pos)=>Math.atan2(aim.y-u.pos.y,aim.x-u.pos.x);
const cancelSpecial=cancelHunterSpecial;
function special(s:GameState,u:Unit,kind:HunterAction['kind'],pose:string,duration:number,parent?:ActionContext){cancelBasicAction(s,u,kind);cancelSpecial(s,u,kind);const h=hunterState(u),context=recordCombatAction(s,u,'skill',{executedAbilityId:'hunter-'+kind,requestSource:parent?.requestSource??'player-input'},parent);h.special={kind,pose,elapsed:0,duration,facing:angle(u,h.aim),context};hunterNote(s,u,'accepted',undefined,context?.actionId);return h.special;}
/** Main input qualification. Release paths may clear a held latch after control changes. */
export function hunterInput(s:GameState,u:Unit,kind:'basic'|'guard'|'dodge'|'active'|'cancel',held=true,aim?:Pos,direction?:Pos):CommandResult{
 if(!isHunterV2(s,u))return {ok:false,reason:'该角色没有猎人V2能力'};const h=hunterState(u);
 if(aim){if(!Number.isFinite(aim.x)||!Number.isFinite(aim.y))return {ok:false,reason:'无效方向'};h.aim={...aim};}
 if(!held&&kind==='basic'){h.held=false;return {ok:true};}
 if(!held&&kind==='guard'){if(h.special?.kind==='guard')cancelSpecial(s,u,'guard-release');return {ok:true};}
 if(kind==='active'&&!held){if(h.special?.kind!=='prepare')return {ok:false,reason:'没有准备中的盾冲'};h.special.releasing=true;return {ok:true};}
 if(u.shadowResident||u.life!=='active'||u.stagger>0||u.forcedMotion||u.ready>0||s.time<h.hurtUntil||s.controlledBodyId!==u.id||s.explorationControl?.aim||commandFocus(s))return {ok:false,reason:'猎人控制或动作不可用'};
 if(kind==='basic'){if(h.held)return {ok:true};h.held=held;h.edgeUntil=(s.realTime??s.time)+.25;return requestBasic(s,u,h.aim,Math.max(h.lastInput+1,s.nextId++));}
 if(kind==='cancel'){if(h.special?.kind==='prepare')cancelSpecial(s,u,'aim-cancel');return {ok:true};}
 if(h.motion)return {ok:false,reason:'位移进行中'};
 if(kind==='dodge'){
  if(h.dodgeCharges<1||h.special&&!['guard','dodge'].includes(h.special.kind))return {ok:false,reason:'闪避不可用'};
  h.edgeUntil=-Infinity;if(u.basicChain)u.basicChain.buffer=undefined;h.dodgeCharges--;if(h.dodgeCooldown<=0)h.dodgeCooldown=2.5;
  const a=special(s,u,'dodge',p.dodge.pose,p.dodge.durationClip);const v=direction??u.direct?.direction,dir=v&&Math.hypot(v.x,v.y)>0?Math.atan2(v.y,v.x):a.facing;
  h.motion={distance:2.6,duration:.14,elapsed:0,facing:dir,ease:true};h.invulnerableUntil=s.time+.13;hunterNote(s,u,'dodge',undefined,a.context?.actionId,'dodge');return {ok:true};
 }
 if(u.basicAction&&!u.basicAction.attackReady||h.special&&!h.special.attackReady)return {ok:false,reason:'动作尚未攻击解锁'};
 if(kind==='guard'){
  if(h.frost<1)return {ok:false,reason:'霜寒不足'};if(h.special?.kind==='guard')return {ok:true};special(s,u,'guard',p.guard.pose,86400);h.guardStartedAt=s.time;return {ok:true};
 }
 if(h.activeCharge<1||h.mp<0)return {ok:false,reason:'盾冲正在恢复'};
 const a=special(s,u,'prepare',p.active.preparePose,86400);h.invulnerableUntil=s.time+2;h.motion={distance:-1.7,duration:.15,elapsed:0,facing:a.facing,ease:true};return {ok:true};
}
function translate(s:GameState,u:Unit,dx:number,dy:number){const n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.04));for(let i=0;i<n;i++){const to={x:u.pos.x+dx/n,y:u.pos.y+dy/n};if(!segmentClear(s,u.pos,to,false,false,radius(u))||!terrainFits(s,to,radius(u),false))break;u.pos=to;}u.drawPos={...u.pos};}
function release(s:GameState,u:Unit,kind:string,stage:number,context:ActionContext|undefined,facing:number,damage:number,range:number,halfAngle:number,life:number){
 const h=hunterState(u);withCombatAttack(s,context,()=>{h.hazards.push({id:s.nextId++,context,attack:currentCombatAttack(s)?.attack,stage,kind,facing,damage,range,halfAngle,expires:s.time+life,hit:new Set()});});
}
export function releaseHunterBasic(s:GameState,u:Unit){const a=u.basicAction!;const d=p.stages[a.stageIndex];release(s,u,'basic',a.stageIndex,a.combatContext,a.angle!,d.damage,d.range,d.halfAngle,.1);}
/** Contact before HP, while posture remains the existing main consumer. */
export function hunterDefense(s:GameState,u:Unit,origin?:Pos):'invulnerable'|'block'|undefined{
 if(!isHunterV2(s,u))return;const h=hunterState(u);if(s.time<h.invulnerableUntil)return 'invulnerable';
 const a=h.special;if(a?.kind!=='guard'||!origin)return;
 const incoming=angle(u,origin),delta=Math.atan2(Math.sin(incoming-a.facing),Math.cos(incoming-a.facing));
 if(s.time-h.guardStartedAt+1e-10>=.08&&Math.abs(delta)<=Math.PI/3&&h.frost>=1){h.frost--;h.frostPaidAt=s.time;hunterNote(s,u,'block',undefined,a.context?.actionId,'block');return 'block';}
 hunterNote(s,u,'block-failed',undefined,a.context?.actionId);
}
export function hunterDamage(s:GameState,u:Unit){const h=hunterState(u);s.combatHitstop={until:(s.realTime??s.time)+.2,scale:.5,actorId:u.id};cancelBasicAction(s,u,'hurt');cancelSpecial(s,u,'hurt');h.hurtUntil=s.time+.24;hunterNote(s,u,'hurt',undefined,undefined,'hurt');if(u.life!=='active'){h.held=false;h.edgeUntil=-Infinity;h.hazards=[];hunterNote(s,u,'death',undefined,undefined,'hurt');}}
export function pauseHunter(s:GameState){for(const u of s.units){if(!isHunterV2(s,u)||!u.hunterCombat)continue;const h=u.hunterCombat;h.held=false;h.edgeUntil=-Infinity;h.motion=undefined;if(h.special)cancelSpecial(s,u,'pause');}}
export function hunterTimeScale(s:GameState){return s.combatHitstop&&(s.realTime??s.time)<s.combatHitstop.until?s.combatHitstop.scale:1;}
/** Main mobility/defense/ability clocks, with Basic delegated to AR03. */
export function advanceHunter(s:GameState,u:Unit,dt:number,hit:(target:Unit,power:number,hazard:HunterHazard)=>boolean){
 const h=hunterState(u);if(u.shadowResident)return;if(u.life!=='active'){cancelBasicAction(s,u,'death',true);cancelSpecial(s,u,'death');h.held=false;h.hazards=[];return;}
 if(h.activeCharge<1){h.activeCooldown=Math.max(0,h.activeCooldown-dt);if(h.activeCooldown===0)h.activeCharge=1;}
 if(h.dodgeCharges<2){h.dodgeCooldown=Math.max(0,h.dodgeCooldown-dt);if(h.dodgeCooldown===0){h.dodgeCharges++;if(h.dodgeCharges<2)h.dodgeCooldown=2.5;}}
 if(h.special?.kind!=='guard'&&s.time-h.frostPaidAt>2)h.frost=Math.min(3,h.frost+.8*dt);
 if(u.stagger>0||u.forcedMotion||u.statuses.some(st=>st.kind==='stun'&&st.remaining>0)){cancelBasicAction(s,u,'stagger');cancelSpecial(s,u,'stagger');}
 else if(s.time>=h.hurtUntil){
  const motion=h.motion;if(motion){const old=motion.elapsed/motion.duration;motion.elapsed=Math.min(motion.duration,motion.elapsed+dt);const next=motion.elapsed/motion.duration,ease=(t:number)=>motion.ease?1-(1-t)**2:t,d=motion.distance*(ease(next)-ease(old));translate(s,u,Math.cos(motion.facing)*d,Math.sin(motion.facing)*d);if(motion.elapsed>=motion.duration)h.motion=undefined;}
  const a=h.special;
  if(a){
   if(a.kind==='guard'||a.kind==='prepare'&&a.pose===p.active.preparePose){a.facing=angle(u,h.aim);faceToward(u,h.aim);u.heading=a.facing;}
   if(a.kind==='prepare'&&a.pose===p.active.preparePose){
    if(a.elapsed>=2)cancelSpecial(s,u,'aim-timeout');
    else if(a.releasing&&!h.motion){a.pose=p.active.releasePose;a.elapsed=0;a.duration=.1667;}
   }
   if(h.special===a){a.elapsed=Math.min(a.duration,a.elapsed+dt);
    if(a.kind==='prepare'&&a.pose===p.active.releasePose&&!a.paid){a.paid=true;h.activeCharge--;h.activeCooldown=8;withCombatAttack(s,a.context,()=>{});hunterNote(s,u,'Dash',undefined,a.context?.actionId);hunterNote(s,u,'Hit',undefined,a.context?.actionId);hunterNote(s,u,'active-payment',undefined,a.context?.actionId,'release');}
    if((a.kind==='dodge'||a.kind==='charge')&&!a.release){a.release=true;if(a.kind==='charge')hunterNote(s,u,'Dash',undefined,a.context?.actionId);release(s,u,a.kind,-1,a.context,a.facing,a.kind==='charge'?75:15,a.kind==='charge'?1.4:1.8,a.kind==='charge'?.7:.75,a.kind==='charge'?.24:.1);hunterNote(s,u,'Hit',undefined,a.context?.actionId,'release');}
    if(a.kind==='dodge'&&!a.attackReady&&a.elapsed>=.2)hunterNote(s,u,'AttackReady',undefined,a.context?.actionId);if(!a.moveReady&&(a.kind==='dodge'&&a.elapsed>=.2||a.kind==='charge'&&a.elapsed>=.0667))hunterNote(s,u,'MoveReady',undefined,a.context?.actionId);a.attackReady=a.kind==='dodge'&&a.elapsed>=.2;a.moveReady=a.kind==='dodge'&&a.elapsed>=.2||a.kind==='charge'&&a.elapsed>=.0667;
    if(a.elapsed>=a.duration){recordCombatLifecycle(s,a.context,'action-finished','hunter-special-finish');hunterNote(s,u,'Finish',undefined,a.context?.actionId);h.special=undefined;h.invulnerableUntil=0;
     if(a.kind==='prepare'){const child=special(s,u,'charge',p.active.chargePose,.6,a.context);child.facing=a.facing;h.invulnerableUntil=s.time+.6;h.motion={distance:6,duration:.2,elapsed:0,facing:child.facing,ease:true};}
    }
   }
  }
  if(u.basicAction){const a=u.basicAction;advanceBasicAction(s,u,dt,()=>releaseHunterBasic(s,u));if(a.dashLeft!>0){const def=p.stages[a.stageIndex],travel=Math.min(dt,a.dashLeft!)*def.dashDistance/def.dashDuration;translate(s,u,Math.cos(a.angle!)*travel,Math.sin(a.angle!)*travel);a.dashLeft=Math.max(0,a.dashLeft!-dt);}}
 }
 h.hazards=h.hazards.filter(x=>x.expires>s.time);
 for(const hz of h.hazards)for(const target of s.units){if(target.team===u.team||target.life!=='active'||hz.hit.has(target.id))continue;const dx=target.pos.x-u.pos.x,dy=target.pos.y-u.pos.y,d=Math.hypot(dx,dy),delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-hz.facing),Math.cos(Math.atan2(dy,dx)-hz.facing));if(d>hz.range+.25||Math.abs(delta)>hz.halfAngle+Math.asin(Math.min(1,.25/Math.max(.001,d)))||!clearShot(s,u.pos,target.pos))continue;hz.hit.add(target.id);if(hit(target,hz.damage,hz)){hunterNote(s,u,'contact',hz.stage,hz.context?.actionId,'hit');s.combatHitstop={until:(s.realTime??s.time)+(hz.stage===3?.045:.03),scale:.15,actorId:u.id,actionId:hz.context?.actionId};}}
}
export function hunterLocomotionLocked(s:GameState,u:Unit){const h=u.hunterCombat;return isHunterV2(s,u)&&!!h&&(s.time<h.hurtUntil||!!h.motion||!!u.basicAction&&!u.basicAction.moveReady||!!h.special&&!h.special.moveReady&&h.special.kind!=='guard');}

/** Voluntary locomotion consumes the separate MoveReady gate, never AttackReady. */
export function hunterMovement(s:GameState,u:Unit){if(!isHunterV2(s,u))return;const h=hunterState(u);if(u.basicAction?.moveReady)cancelBasicAction(s,u,'movement');if(h.special?.moveReady&&h.special.kind!=='guard')cancelSpecial(s,u,'movement');}
