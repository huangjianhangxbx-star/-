import {recordDirectMove,initializeAnchor} from './autonomy';
import {healHealth,resetPressure} from './pressure';
import type {CommandResult,GameState,Pos,Unit} from './types';
import {canStop,distance,terrainFits,enemyContact,radius,faceToward,surface} from './spatial';
import {navigate} from './navigation';
import {reapReturnPath} from './reap-path';
import {COMBAT_CONFIG,weightProfile} from './combat-config';
import {cancelLoadout,interruptSkill} from './loadout';
import {movementSpeed} from './movement-speed';

export const PERSONAL={blinkCharges:10,blinkSeconds:5,blinkInterval:.25,blinkDistance:1,minBlink:.05,recallRadius:2,recallSeconds:1,shadowHeal:.02,lowHealth:.3,warningSeconds:8};
const cp=(p:Pos)=>({...p});
const ok=():CommandResult=>({ok:true});
const fail=(reason:string):CommandResult=>({ok:false,reason});
export const actionable=(u:Unit)=>u.life==='active'&&!(u.stagger>0)&&!u.statuses.some(t=>t.kind==='stun'&&t.remaining>0);
const hunter=(s:GameState)=>s.units.find(u=>u.id==='hunter'&&actionable(u));
// Eligibility is sampled after arrivals, before damage, so simultaneous deaths
// cannot revoke protection merely because the units array has a different order.
const damageProtection=new WeakMap<GameState,Set<string>>();
export function captureRecallProtection(s:GameState){const h=hunter(s);damageProtection.set(s,new Set(s.units.filter(u=>u.recall&&!u.recall.waitingCross&&h&&distance(h.pos,u.pos)<=PERSONAL.recallRadius).map(u=>u.id)));}
function note(s:GameState,t:string){s.notice=t;s.log.unshift(t);s.log.length=Math.min(40,s.log.length);}
export function clearPersonalAction(u:Unit){u.direct=undefined;u.recall=undefined;u.rescueTarget=null;u.partyTask=undefined;u.following=false;}
export function clearMotion(u:Unit){u.skillLanding=undefined;u.path=[];u.destination=null;u.intent=null;u.crossing=undefined;u.afterCross=undefined;u.transition=0;u.moveProgress=0;u.moveFrom=undefined;u.drawPos=cp(u.pos);u.attackPending=undefined;}
export function resetPersonal(u:Unit){u.ai=undefined;u.skillLanding=undefined;clearPersonalAction(u);u.shadowResident=false;u.protectedRecall=false;u.lowHealthAt=undefined;u.blink=u.id==='hunter'?{charges:PERSONAL.blinkCharges,progress:0,interval:0}:undefined;}
export function tickPersonalClocks(s:GameState,dt:number){for(const u of s.units){
 const b=u.blink;if(b){b.interval=Math.max(0,b.interval-dt);if(b.charges<PERSONAL.blinkCharges){b.progress+=dt;while(b.progress+1e-8>=PERSONAL.blinkSeconds&&b.charges<PERSONAL.blinkCharges){b.progress=Math.max(0,b.progress-PERSONAL.blinkSeconds);b.charges++;}}if(b.charges>=PERSONAL.blinkCharges)b.progress=0;}
 if(u.shadowResident&&u.role==='fiorre'&&!u.cloneOf)healHealth(u,u.maxHp*PERSONAL.shadowHeal*dt);
 if(u.team==='ally'&&!u.cloneOf&&u.life==='active'&&u.hp/u.maxHp<PERSONAL.lowHealth&&(u.lowHealthAt===undefined||s.time-u.lowHealthAt>=PERSONAL.warningSeconds)){u.lowHealthAt=s.time;note(s,u.name+' 生命垂危 · 可请求影庭回收');}
}}
export function blink(s:GameState,u:Unit,d:Pos):CommandResult{
 if(u.id!=='hunter'||u.cloneOf||!actionable(u))return fail('只有可行动的猎人能使用瞬影');
 const b=u.blink!,len=Math.hypot(d.x,d.y);if(!Number.isFinite(len)||len<1e-6)return fail('请指定瞬影方向');
 if(!b||b.charges<=0||b.interval>1e-8)return fail('瞬影正在恢复');
 const from=cp(u.pos);let last=from;
 for(let i=1;i<=40;i++){const p={x:from.x+d.x/len*PERSONAL.blinkDistance*i/40,y:from.y+d.y/len*PERSONAL.blinkDistance*i/40};
  if(!terrainFits(s,p,radius(u),false)||enemyContact(s,p,radius(u)))break;
  if(canStop(s,p,u))last=p;
 }
 if(distance(from,last)<PERSONAL.minBlink-1e-7)return fail('瞬影路径或落点受阻');
 clearPersonalAction(u);clearMotion(u);cancelLoadout(u);interruptSkill(u);
 faceToward(u,last);u.pos=cp(last);u.drawPos=cp(last);b.charges--;b.interval=PERSONAL.blinkInterval;
 s.effects.push({id:s.nextId++,from,to:cp(last),color:'#74b9c7',remaining:.24,kind:'blink'});return ok();
}
function settleDirect(s:GameState,u:Unit){
 if(canStop(s,u.pos,u)){u.direct=undefined;initializeAnchor(s,u);return;}
 const candidates:Pos[]=[];
 for(let r=.1;r<=2;r+=.1)for(let i=0;i<24;i++)candidates.push({x:u.pos.x+Math.cos(i*Math.PI/12)*r,y:u.pos.y+Math.sin(i*Math.PI/12)*r});
 candidates.sort((a,b)=>distance(a,u.pos)-distance(b,u.pos));
 const trail=u.direct?.trail||[];
 for(const p of [...candidates,...trail.slice().reverse()]){if(!canStop(s,p,u))continue;const path=navigate(s,u.pos,p,false,true,radius(u));if(!path.length)continue;u.path=path;u.destination=cp(p);u.intent='move';u.direct=undefined;return;}
 // A dynamic enclosure can temporarily prevent every route. Retry without teleporting.
 if(u.direct)u.direct.direction=null;
 if(!u.direct?.notified){note(s,'暂时无法落位，等待通路恢复');if(u.direct)u.direct.notified=true;}
}
export function direct(s:GameState,u:Unit,d:Pos|null):CommandResult{
 if(!d){if(u.direct){u.direct.direction=null;if(!u.crossing){settleDirect(s,u);if(!u.direct)initializeAnchor(s,u);}}return ok();}
 const len=Math.hypot(d.x,d.y);if(!Number.isFinite(len)||len<1e-6)return fail('移动方向无效');
 if(u.cloneOf||!actionable(u))return fail('该角色不能直接移动');
 const trail=u.direct?.trail||[cp(u.pos)];u.recall=undefined;u.rescueTarget=null;
 if(!u.crossing)clearMotion(u);else u.afterCross=undefined;
 interruptSkill(u,'movement');
 u.direct={direction:{x:d.x/len,y:d.y/len},trail};return ok();
}
export function advanceDirect(s:GameState,u:Unit,dt:number){
 const ctl=u.direct;if(!ctl||!actionable(u)||u.crossing)return;
 if(!ctl.direction){settleDirect(s,u);return;}
 const d=ctl.direction,travel=movementSpeed(s,u,true)*dt,from=cp(u.pos);
 for(const v of [d,{x:d.x,y:0},{x:0,y:d.y}]){
  if(!v.x&&!v.y)continue;
  const p={x:from.x+v.x*travel,y:from.y+v.y*travel};
  if(!terrainFits(s,p,radius(u),false)||enemyContact(s,p,radius(u)))continue;
  if(!terrainFits(s,p,radius(u))||surface(s,p)?.layer!==surface(s,from)?.layer){
   const n=Math.hypot(v.x,v.y),to={x:from.x+v.x/n*.7,y:from.y+v.y/n*.7};
   if(canStop(s,to,u)){const path=navigate(s,from,to,false,true,radius(u));if(path.length){u.path=path;u.destination=to;u.intent='move';}}return;
  }
  if(distance(from,p)>1e-8)cancelLoadout(u);u.pos=p;u.drawPos=cp(p);recordDirectMove(s,u,distance(from,p));faceToward(u,p.x===from.x&&p.y===from.y?{x:from.x+d.x,y:from.y+d.y}:{x:p.x+v.x,y:p.y+v.y});u.attackPending=undefined;
  if(canStop(s,p,u)){ctl.trail.push(cp(p));if(ctl.trail.length>120)ctl.trail.shift();}return;
 }
}
function routeToCircle(s:GameState,u:Unit,center:Pos){
 if(distance(u.pos,center)<=PERSONAL.recallRadius&&canStop(s,u.pos,u))return [];
 const candidates:Pos[]=s.tiles.filter(t=>distance(t,center)<=PERSONAL.recallRadius).map(cp);
 for(let r=PERSONAL.recallRadius;r>=.4;r-=.4)for(let i=0;i<24;i++)candidates.push({x:center.x+Math.cos(i*Math.PI/12)*r,y:center.y+Math.sin(i*Math.PI/12)*r});
 candidates.sort((a,b)=>distance(a,u.pos)-distance(b,u.pos));
 for(const p of candidates){if(!canStop(s,p,u))continue;const route=navigate(s,u.pos,p,false,true,radius(u));if(route.length)return route;}return null;
}
export function requestRecall(s:GameState,u:Unit,inRangeOnly=false):CommandResult{
 const h=hunter(s);if(!h||u.id==='hunter'||u.cloneOf||!actionable(u))return fail('需要在场猎人与可回收本体');
 if(inRangeOnly&&distance(h.pos,u.pos)>PERSONAL.recallRadius)return fail('目标不在收纳范围内');
 if(u.recall)return ok();
 const exit=!canStop(s,u.pos,u)&&(u.skillLanding||u.skillStates?.[u.skillId||'']?.run?.spec.id==='reap')?reapReturnPath(s,u,u.pos,u.pos):undefined;
 if(!u.crossing&&distance(h.pos,u.pos)>PERSONAL.recallRadius&&routeToCircle(s,u,h.pos)===null&&(!exit?.length||routeToCircle(s,{...u,pos:exit.at(-1)!},h.pos)===null))return fail('回收路径受阻，请调整位置后重试');
 cancelLoadout(u);interruptSkill(u);u.direct=undefined;u.rescueTarget=null;u.recall={elapsed:0,waitingCross:!!u.crossing,repath:0};
 if(!u.crossing){const landing=u.skillLanding;clearMotion(u);u.skillLanding=landing;u.intent='extract';}return ok();
}
export function requestRescue(s:GameState,u:Unit):CommandResult{
 const h=hunter(s);if(!h||u.cloneOf||u.life!=='downed')return fail('需要可行动猎人与濒死本体');
 const route=routeToCircle(s,h,u.pos);if(route===null)return fail('救援路径受阻');
 cancelLoadout(h);h.recall=undefined;h.direct=undefined;
 // Complete the current fade, then plan the rescue instead of replaying an old goal.
 if(!h.crossing)clearMotion(h);else{h.afterCross=undefined;h.path=[];h.destination=null;}
 h.rescueTarget=u.id;h.intent='rescue';if(!h.crossing){h.path=route;h.destination=route.at(-1)?cp(route.at(-1)!):null;}return ok();
}
export function protectRecall(s:GameState,u:Unit,down=false){
 if(u.shadowResident)return;
 cancelLoadout(u);interruptSkill(u);clearMotion(u);clearPersonalAction(u);u.shadowResident=true;u.protectedRecall=true;u.life=down?'rescued':'withdrawn';
 if(down){resetPressure(u);(s.rescueRestrictions??={})[u.id]=s.node;if(u.skillId==='dance'&&u.skillStates?.dance){u.skillStates.dance.enabled=false;u.skillStates.dance.cd=u.skillStates.dance.max;}u.hp=1;s.stats.rescues++;}u.ready=COMBAT_CONFIG.warmup[u.role as keyof typeof COMBAT_CONFIG.warmup]||0;
 s.effects.push({id:s.nextId++,from:cp(u.pos),to:cp(u.pos),kind:'recall',color:'#74b9c7',remaining:.32});
 note(s,u.name+(down?' 已保护并救回 · 下节点可部署':' 已进入影庭 · 始动积累中'));
}
export function protectLethalRecall(s:GameState,u:Unit){if(u.recall&&damageProtection.get(s)?.has(u.id)){protectRecall(s,u,true);return true;}return false;}
export function advanceRecall(s:GameState,dt:number){
 const h=hunter(s);
 for(const u of s.units){if(!u.recall)continue;
  if(!h||u.life!=='active'){u.recall=undefined;if(u.intent==='extract')clearMotion(u);note(s,'回收请求结束：猎人或目标不可用');continue;}
  if(u.crossing||u.skillLanding)continue;
  if(u.recall.waitingCross){u.recall.waitingCross=false;clearMotion(u);u.intent='extract';}
  if(distance(h.pos,u.pos)<=PERSONAL.recallRadius){u.path=[];u.destination=null;u.attackPending=undefined;u.recall.elapsed+=dt;if(u.recall.elapsed+1e-8>=PERSONAL.recallSeconds)protectRecall(s,u);}
  else{u.recall.elapsed=0;u.recall.repath-=dt;if(u.recall.repath<=0||!u.path.length){u.recall.repath=.25;const route=routeToCircle(s,u,h.pos);if(route===null){u.recall=undefined;clearMotion(u);note(s,u.name+' 回收无路，请重新发起');}else{u.path=route;u.destination=route.at(-1)?cp(route.at(-1)!):null;u.intent='extract';}}}
 }
 for(const actor of s.units){if(!actor.rescueTarget)continue;
  const t=s.units.find(u=>u.id===actor.rescueTarget);
  if(actor!==h||!t||t.life!=='downed'){actor.rescueTarget=null;if(actor.intent==='rescue')clearMotion(actor);continue;}
  if(actor.crossing)continue;
  if(distance(actor.pos,t.pos)<=PERSONAL.recallRadius){protectRecall(s,t,true);actor.rescueTarget=null;clearMotion(actor);}
  else if(!actor.path.length){const route=routeToCircle(s,actor,t.pos);if(route===null){actor.rescueTarget=null;clearMotion(actor);note(s,'救援无路，请重新发起');}else{actor.path=route;actor.destination=route.at(-1)?cp(route.at(-1)!):null;actor.intent='rescue';}}
 }
}
