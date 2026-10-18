import {HOME_GOALS,chooseGoal,type HomeGoalId,type HomeRoutineStep} from './home-goals';
import {homeScheduleContext} from './home-schedule';
import type {GameState,Pos,Unit} from './types';
import type {ActivityAnchor} from './scene-layout';
import {distance,radius,terrainFits} from './spatial';
import {navigate} from './navigation';

type Phase = 'idle'|'moving'|'dwelling'|'blocked'|'interrupted'|'completed'|'cancelled';
type Event = {at:number;kind:string;step:number;task?:HomeGoalId;anchor?:string;reason:string;pos:Pos};
export type HomeRoutine = {
  phase:Phase;stepIndex:number;steps:readonly HomeRoutineStep[];attemptedAnchors:string[];interruptedAt?:number;clock:number;serial:number;selection:number;planCount:number;
  goalId?:HomeGoalId;anchorId?:string;mapInstance?:string;layoutRevision?:string;
  remaining:number;retryAt:number;retries:number;lastProgress:number;lastPos:Pos;
  pathToken?:number;ownedPath?:Pos[];resume?:'moving'|'dwelling';reason:string;
  lastCompleted?:HomeGoalId;completed:Partial<Record<HomeGoalId,number>>;
  cooldowns:Partial<Record<HomeGoalId,number>>;holds:Record<string,string>;history:Event[];goalTransitions:Event[];
};

function resident(s:GameState){const h=s.world?.homeResident;return h&&s.units.find(u=>u.id===h.id);}
function runtime(s:GameState):HomeRoutine|undefined {
  const h=s.world?.homeResident,u=resident(s);if(!h||!u||h.mode!=='resident')return h?.activity;
  return h.activity??={phase:'idle',stepIndex:0,steps:[],attemptedAnchors:[],clock:0,serial:0,selection:0,planCount:0,remaining:0,
    retryAt:0,retries:0,lastProgress:0,lastPos:{...u.pos},reason:'new-resident',
    completed:{},cooldowns:{},holds:{},history:[],goalTransitions:[]};
}
function record(a:HomeRoutine,u:Unit,kind:string,reason:string){
  a.reason=reason;a.history.push({at:a.clock,kind,step:a.stepIndex,task:a.goalId,anchor:a.anchorId,reason,pos:{...u.pos}});
  if(['selected','completed','failed','cancelled'].includes(kind)){a.goalTransitions.push(a.history[a.history.length-1]);if(a.goalTransitions.length>6)a.goalTransitions.shift();}
  if(a.history.length>32)a.history.shift();
}
/** Compare the actual route identity. A stale task must never erase a new party route. */
function releasePath(a:HomeRoutine,u:Unit){
  if(a.ownedPath&&u.path===a.ownedPath){u.path=[];u.destination=null;if(u.intent==='move')u.intent=null;}
  a.ownedPath=undefined;a.pathToken=undefined;
}
function interrupt(s:GameState,a:HomeRoutine,u:Unit,reason:string){
  if(a.phase==='cancelled')return;
  if(a.phase!=='interrupted'){
    a.interruptedAt=s.time;a.resume=a.phase==='dwelling'?'dwelling':'moving';releasePath(a,u);a.phase='interrupted';record(a,u,'interrupted',reason);
  }else a.reason=reason;
}
/** A session lease freezes only this resident. Release has no authority to issue a route. */
export function holdHomeRoutine(s:GameState,id:string,reason:string):()=>void {
  const h=s.world?.homeResident,u=resident(s);if(!h||h.id!==id||h.mode!=='resident'||!u)return ()=>{};
  const a=runtime(s)!,token='hold-'+(++a.serial);a.holds[token]=reason;interrupt(s,a,u,reason);
  return ()=>{delete a.holds[token];};
}
export function suspendHomeRoutine(s:GameState,reason:string){
  const a=s.world?.homeResident?.activity,u=resident(s);if(a&&u)interrupt(s,a,u,reason);
}
export function cancelHomeRoutine(s:GameState,reason:string){
  const a=s.world?.homeResident?.activity,u=resident(s);if(!a||!u||a.phase==='cancelled')return;
  releasePath(a,u);a.phase='cancelled';a.resume=undefined;record(a,u,'cancelled',reason);
}
function anchorFor(s:GameState,a:HomeRoutine):ActivityAnchor|undefined {
  const l=s.exploration?.definition.sceneLayout,w=s.world;
  if(!l||!w||a.mapInstance!==w.id+':'+w.visit.placeId||a.layoutRevision!==l.revision)return;
  const anchor=l.activities.find(p=>p.id===a.anchorId);
  return anchor&&l.props.some(p=>p.id===anchor.ownerObject)?anchor:undefined;
}
function clearTask(a:HomeRoutine,u:Unit,reason:string){
  releasePath(a,u);if(a.goalId)a.cooldowns[a.goalId]=a.clock+8;record(a,u,'failed',reason);a.goalId=undefined;a.anchorId=undefined;
  a.steps=[];a.stepIndex=0;a.attemptedAnchors=[];a.remaining=0;a.retries=0;a.resume=undefined;a.phase='idle';a.retryAt=a.clock+1;
}
function block(a:HomeRoutine,u:Unit,reason:string){
  releasePath(a,u);a.phase='blocked';a.retryAt=a.clock+1;a.retries++;record(a,u,'blocked',reason);
  if(a.retries>=3){if(a.goalId)a.cooldowns[a.goalId]=a.clock+8;clearTask(a,u,'retry-budget-exhausted');}
}
function plan(s:GameState,u:Unit,a:HomeRoutine,p:ActivityAnchor){
  if(distance(u.pos,p.approach)<.04){arrive(s,a,u,p);return;}
  a.planCount++;
  const route=navigate(s,u.pos,p.approach,false,true,radius(u),{remaining:1600});
  if(!route.length){a.attemptedAnchors.push(p.id);block(a,u,'route-unavailable');return;}
  a.pathToken=++a.serial;a.ownedPath=route;u.path=route;u.destination={...p.approach};u.intent='move';
  a.phase='moving';a.lastProgress=a.clock;a.lastPos={...u.pos};
}
function stepTag(a:HomeRoutine){
  for(let i=a.stepIndex;i>=0;i--){const step=a.steps[i];if(step?.kind==='move-to-activity')return step.tag;}
}
function available(s:GameState,u:Unit,p:ActivityAnchor){
  return terrainFits(s,p.approach,radius(u))&&!s.units.some(other=>other!==u&&other.life==='active'&&distance(other.pos,p.approach)<radius(other)+radius(u)+.05);
}
function candidates(s:GameState,u:Unit,tag:string){
  const l=s.exploration!.definition.sceneLayout!;
  return l.activities.filter(p=>p.tags.includes(tag)&&l.props.some(o=>o.id===p.ownerObject)&&available(s,u,p))
    .sort((a,b)=>distance(u.pos,a.approach)-distance(u.pos,b.approach)||a.id.localeCompare(b.id));
}
function scoreContext(s:GameState,u:Unit,a:HomeRoutine){
  const l=s.exploration!.definition.sceneLayout!,tags=new Set(l.activities.flatMap(p=>p.tags));
  const garden=l.groundRegions?.find(r=>r.id==='garden');
  const points=[...tags].map(tag=>({tag,point:candidates(s,u,tag)[0]})).filter(p=>p.point);
  return {clock:a.clock,schedule:homeScheduleContext(s),nearGarden:!!garden&&u.pos.x>=garden.x-.5&&u.pos.x<garden.x+garden.width-.5&&u.pos.y>=garden.y-.5&&u.pos.y<garden.y+garden.height-.5,availableTags:points.map(p=>p.tag),
    distances:Object.fromEntries(points.map(p=>[p.tag,distance(u.pos,p.point.approach)])),completed:a.completed,cooldowns:a.cooldowns,
    lastCompleted:a.lastCompleted,commitment:a.goalId};
}
function chooseAnchor(s:GameState,u:Unit,a:HomeRoutine){
  const tag=stepTag(a);if(!tag)return;
  const points=candidates(s,u,tag).filter(p=>!a.attemptedAnchors.includes(p.id));
  return points.find(p=>p.id===a.anchorId)??points[0];
}
function finishGoal(a:HomeRoutine,u:Unit){
  const goal=HOME_GOALS.find(g=>g.id===a.goalId)!;a.lastCompleted=goal.id;a.completed[goal.id]=a.clock;
  a.cooldowns[goal.id]=a.clock+goal.cooldown;a.phase='completed';record(a,u,'completed','goal-finished / no-reward');
}
function startStep(s:GameState,u:Unit,a:HomeRoutine){
  const step=a.steps[a.stepIndex];if(!step){finishGoal(a,u);return;}
  a.retries=0;a.attemptedAnchors=[];
  if(step.kind==='move-to-activity'){
    const point=chooseAnchor(s,u,a);if(!point){clearTask(a,u,'activity-unavailable');return;}
    a.anchorId=point.id;plan(s,u,a,point);return;
  }
  if(step.kind==='face'){
    const point=anchorFor(s,a);if(step.direction)u.facing=step.direction;else if(point)u.facing=point.facing;
    a.stepIndex++;startStep(s,u,a);return;
  }
  const seed=((s.world!.generation*2654435761)^(a.selection*1013904223)^(a.stepIndex*69069))>>>0;
  a.remaining=step.seconds[0]+seed%(step.seconds[1]-step.seconds[0]+1);a.phase='dwelling';record(a,u,'step-start','stand-placeholder');
}
function arrive(s:GameState,a:HomeRoutine,u:Unit,p:ActivityAnchor){
  releasePath(a,u);u.facing=p.facing;
  u.heading={north:-Math.PI/2,south:Math.PI/2,east:0,west:Math.PI}[p.facing];record(a,u,'arrived','stand-placeholder');
  if(a.steps[a.stepIndex]?.kind==='move-to-activity'){a.stepIndex++;startStep(s,u,a);}else a.phase='dwelling';
}
function select(s:GameState,u:Unit,a:HomeRoutine){
  const selected=chooseGoal({...scoreContext(s,u,a),commitment:undefined});
  const goal=selected.goal;if(!goal){a.retryAt=a.clock+1;return;}
  a.selection++;a.goalId=goal.id;a.steps=goal.steps;a.stepIndex=0;a.anchorId=undefined;
  a.mapInstance=s.world!.id+':'+s.world!.homeResident!.home;a.layoutRevision=s.exploration!.definition.sceneLayout!.revision;
  record(a,u,'selected','stable-score / commitment');startStep(s,u,a);
}
export function homeRoutineOwnsMovement(s:GameState,u:Unit){
  const h=s.world?.homeResident,a=h?.activity;
  return !!(h?.mode==='resident'&&h.id===u.id&&s.world?.visit.active&&s.world.visit.placeId===h.home&&
    a?.phase==='moving'&&a.ownedPath===u.path&&a.pathToken!==undefined);
}
/** A simulation-clock controller; off-map residents and paused frames do no work. */
export function advanceHomeRoutine(s:GameState,dt:number){
  const h=s.world?.homeResident;if(!h||h.mode!=='resident'||!s.world!.visit.active||s.world!.visit.placeId!==h.home||
    s.phase!=='battle'||!s.exploration?.definition.sceneLayout||!Number.isFinite(dt)||dt<=0)return;
  const u=resident(s);if(!u)return;const a=runtime(s)!;
  const danger=s.context==='explorationBattle'||s.units.some(e=>e.team==='enemy'&&e.life==='active'&&e.hp>0);
  const reason=Object.values(a.holds)[0]??(h.busy==='dialogue'?undefined:h.busy)??(danger?'danger':undefined)??
    (u.direct||u.partyTask||u.recall||u.skillLanding||u.evasion?.action||u.path.length&&u.path!==a.ownedPath?'foreign-movement':undefined)??
    (u.life!=='active'||u.hp<=0||u.stagger>0||u.forcedMotion||u.crossing||u.ready>0||u.statuses.some(t=>t.kind==='stun'&&t.remaining>0)?'body-unavailable':undefined);
  if(reason){interrupt(s,a,u,reason);return;}
  if(a.phase==='cancelled')return;
  a.clock+=dt;
  const layout=s.exploration!.definition.sceneLayout!;
  if(a.goalId&&(a.layoutRevision!==layout.revision||a.mapInstance!==s.world!.id+':'+s.world!.visit.placeId)){clearTask(a,u,'layout-or-object-invalid');return;}
  if(a.phase==='completed'){a.phase='idle';a.goalId=undefined;a.anchorId=undefined;}
  if(a.phase==='idle'){if(a.clock>=a.retryAt)select(s,u,a);return;}
  let p=a.goalId?anchorFor(s,a):undefined;
  if(a.phase==='interrupted'){
    if(a.reason==='danger'&&s.time-(a.interruptedAt??s.time)>30){clearTask(a,u,'danger-timeout');return;}
    p=chooseAnchor(s,u,a);
    if(!p){clearTask(a,u,'layout-or-object-invalid');return;}
    const changed=p.id!==a.anchorId;a.anchorId=p.id;record(a,u,'resumed','owner-released / step-revalidated');
    const dwell=a.resume==='dwelling'&&!changed&&distance(u.pos,p.approach)<.04;a.resume=undefined;
    if(dwell){a.phase='dwelling';u.facing=p.facing;}else plan(s,u,a,p);return;
  }
  if(a.phase==='blocked'){
    if(a.clock>=a.retryAt){p=chooseAnchor(s,u,a);if(p){a.anchorId=p.id;plan(s,u,a,p);}else block(a,u,'no-equivalent-activity');}return;
  }
  if(!p||!available(s,u,p)){
    const alternative=chooseAnchor(s,u,a);
    if(alternative&&alternative.id!==p?.id){a.anchorId=alternative.id;plan(s,u,a,alternative);return;}
    if(!p){clearTask(a,u,'layout-or-object-invalid');return;}block(a,u,'activity-occupied');return;
  }
  if(a.phase==='moving'){
    if(distance(u.pos,p.approach)<.04){arrive(s,a,u,p);return;}
    if(a.ownedPath!==u.path){block(a,u,'path-owner-changed');return;}
    if(distance(u.pos,a.lastPos)>.02){a.lastProgress=a.clock;a.lastPos={...u.pos};}
    if(!u.path.length||a.clock-a.lastProgress>2.5){block(a,u,'movement-blocked');}return;
  }
  if(a.phase==='dwelling'){
    if(!terrainFits(s,p.approach,radius(u))||distance(u.pos,p.approach)>=.04){plan(s,u,a,p);return;}
    a.remaining=Math.max(0,a.remaining-dt);
    if(a.remaining<=1e-7){a.stepIndex++;startStep(s,u,a);}
  }
}
export function homeRoutineDebug(s:GameState){
  const a=s.world?.homeResident?.activity;if(!a)return null;
  return {owner:s.world!.homeResident!.mode==='party'?'existing-party':a.phase==='interrupted'?a.reason:'home-activity',
    phase:a.phase,goalId:a.goalId,taskId:a.goalId,stepIndex:a.stepIndex,stepType:a.steps[a.stepIndex]?.kind,
    schedule:homeScheduleContext(s),scores:resident(s)&&s.exploration?.definition.sceneLayout?chooseGoal(scoreContext(s,resident(s)!,a)).scores.slice(0,3):[],
    goalTransitions:a.goalTransitions.map(e=>({...e,pos:{...e.pos}})),anchorId:a.anchorId,mapInstance:a.mapInstance,layoutRevision:a.layoutRevision,
    remaining:a.remaining,pathToken:a.pathToken,pathLength:a.ownedPath?.length??0,reason:a.reason,
    retries:a.retries,planCount:a.planCount,clock:a.clock,lastCompleted:a.lastCompleted,
    animation:'stand-placeholder',holds:Object.values(a.holds),history:a.history.map(e=>({...e,pos:{...e.pos}}))};
}
