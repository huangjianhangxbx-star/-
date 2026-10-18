import type {GameState,Pos,Unit} from './types';
import type {ActivityAnchor} from './scene-layout';
import {distance,radius,terrainFits} from './spatial';
import {navigate} from './navigation';

export const HOME_BEHAVIORS = [
  {id:'read',tag:'read',weight:3,dwell:[8,12],cooldown:18},
  {id:'kitchen-stand',tag:'prepare',weight:2,dwell:[9,13],cooldown:18},
  {id:'garden-inspect',tag:'garden',weight:1,dwell:[10,15],cooldown:18},
] as const;
type BehaviorId = typeof HOME_BEHAVIORS[number]['id'];
type Phase = 'idle'|'moving'|'dwelling'|'blocked'|'interrupted'|'completed'|'cancelled';
type Event = {at:number;kind:string;task?:BehaviorId;anchor?:string;reason:string;pos:Pos};
export type HomeActivity = {
  phase:Phase;clock:number;serial:number;selection:number;planCount:number;
  taskId?:BehaviorId;anchorId?:string;mapInstance?:string;layoutRevision?:string;
  remaining:number;retryAt:number;retries:number;lastProgress:number;lastPos:Pos;
  pathToken?:number;ownedPath?:Pos[];resume?:'moving'|'dwelling';reason:string;
  lastCompleted?:BehaviorId;completed:Partial<Record<BehaviorId,number>>;
  cooldowns:Partial<Record<BehaviorId,number>>;holds:Record<string,string>;history:Event[];
};

function resident(s:GameState){const h=s.world?.homeResident;return h&&s.units.find(u=>u.id===h.id);}
function runtime(s:GameState):HomeActivity|undefined {
  const h=s.world?.homeResident,u=resident(s);if(!h||!u||h.mode!=='resident')return h?.activity;
  return h.activity??={phase:'idle',clock:0,serial:0,selection:0,planCount:0,remaining:0,
    retryAt:0,retries:0,lastProgress:0,lastPos:{...u.pos},reason:'new-resident',
    completed:{},cooldowns:{},holds:{},history:[]};
}
function record(a:HomeActivity,u:Unit,kind:string,reason:string){
  a.reason=reason;a.history.push({at:a.clock,kind,task:a.taskId,anchor:a.anchorId,reason,pos:{...u.pos}});
  if(a.history.length>32)a.history.shift();
}
/** Compare the actual route identity. A stale task must never erase a new party route. */
function releasePath(a:HomeActivity,u:Unit){
  if(a.ownedPath&&u.path===a.ownedPath){u.path=[];u.destination=null;if(u.intent==='move')u.intent=null;}
  a.ownedPath=undefined;a.pathToken=undefined;
}
function interrupt(a:HomeActivity,u:Unit,reason:string){
  if(a.phase==='cancelled')return;
  if(a.phase!=='interrupted'){
    a.resume=a.phase==='dwelling'?'dwelling':'moving';releasePath(a,u);a.phase='interrupted';record(a,u,'interrupted',reason);
  }else a.reason=reason;
}
/** A session lease freezes only this resident. Release has no authority to issue a route. */
export function holdHomeActivity(s:GameState,id:string,reason:string):()=>void {
  const h=s.world?.homeResident,u=resident(s);if(!h||h.id!==id||h.mode!=='resident'||!u)return ()=>{};
  const a=runtime(s)!,token='hold-'+(++a.serial);a.holds[token]=reason;interrupt(a,u,reason);
  return ()=>{delete a.holds[token];};
}
export function suspendHomeActivity(s:GameState,reason:string){
  const a=s.world?.homeResident?.activity,u=resident(s);if(a&&u)interrupt(a,u,reason);
}
export function cancelHomeActivity(s:GameState,reason:string){
  const a=s.world?.homeResident?.activity,u=resident(s);if(!a||!u||a.phase==='cancelled')return;
  releasePath(a,u);a.phase='cancelled';a.resume=undefined;record(a,u,'cancelled',reason);
}
function anchorFor(s:GameState,a:HomeActivity):ActivityAnchor|undefined {
  const l=s.exploration?.definition.sceneLayout,w=s.world;
  if(!l||!w||a.mapInstance!==w.id+':'+w.visit.placeId||a.layoutRevision!==l.revision)return;
  const anchor=l.activities.find(p=>p.id===a.anchorId);
  return anchor&&l.props.some(p=>p.id===anchor.ownerObject)?anchor:undefined;
}
function clearTask(a:HomeActivity,u:Unit,reason:string){
  releasePath(a,u);record(a,u,'cancelled',reason);a.taskId=undefined;a.anchorId=undefined;
  a.remaining=0;a.retries=0;a.resume=undefined;a.phase='idle';a.retryAt=a.clock+1;
}
function block(a:HomeActivity,u:Unit,reason:string){
  releasePath(a,u);a.phase='blocked';a.retryAt=a.clock+1;a.retries++;record(a,u,'blocked',reason);
  if(a.retries>=3){if(a.taskId)a.cooldowns[a.taskId]=a.clock+8;clearTask(a,u,'retry-budget-exhausted');}
}
function plan(s:GameState,u:Unit,a:HomeActivity,p:ActivityAnchor){
  if(distance(u.pos,p.approach)<.04){arrive(a,u,p);return;}
  a.planCount++;
  const route=navigate(s,u.pos,p.approach,false,true,radius(u),{remaining:1600});
  if(!route.length){block(a,u,'route-unavailable');return;}
  a.pathToken=++a.serial;a.ownedPath=route;u.path=route;u.destination={...p.approach};u.intent='move';
  a.phase='moving';a.lastProgress=a.clock;a.lastPos={...u.pos};
}
function arrive(a:HomeActivity,u:Unit,p:ActivityAnchor){
  releasePath(a,u);a.phase='dwelling';u.facing=p.facing;
  u.heading={north:-Math.PI/2,south:Math.PI/2,east:0,west:Math.PI}[p.facing];record(a,u,'arrived','stand-placeholder');
}
function select(s:GameState,u:Unit,a:HomeActivity){
  const l=s.exploration!.definition.sceneLayout!;
  const choices=HOME_BEHAVIORS.filter(b=>b.id!==a.lastCompleted&&(a.cooldowns[b.id]??0)<=a.clock)
    .map(b=>({b,anchor:l.activities.find(p=>p.tags.includes(b.tag)&&l.props.some(o=>o.id===p.ownerObject))}))
    .filter((c):c is typeof c&{anchor:ActivityAnchor}=>!!c.anchor);
  // Oldest completed wins; stable weights break ties without starving a lower-weight activity.
  choices.sort((x,y)=>(a.completed[x.b.id]??-1e6)-(a.completed[y.b.id]??-1e6)||y.b.weight-x.b.weight);
  const chosen=choices[0];if(!chosen){a.retryAt=a.clock+1;return;}
  const {b,anchor}=chosen;const seed=((s.world!.generation*2654435761)^(++a.selection*1013904223))>>>0;
  a.taskId=b.id;a.anchorId=anchor.id;a.mapInstance=s.world!.id+':101';a.layoutRevision=l.revision;
  a.remaining=b.dwell[0]+seed%((b.dwell[1]-b.dwell[0])+1);a.retries=0;
  record(a,u,'selected','oldest-completed / stable-weight');plan(s,u,a,anchor);
}
export function homeActivityOwnsMovement(s:GameState,u:Unit){
  const h=s.world?.homeResident,a=h?.activity;
  return !!(h?.mode==='resident'&&h.id===u.id&&s.world?.visit.active&&s.world.visit.placeId===h.home&&
    a?.phase==='moving'&&a.ownedPath===u.path&&a.pathToken!==undefined);
}
/** A simulation-clock controller; off-map residents and paused frames do no work. */
export function advanceHomeActivity(s:GameState,dt:number){
  const h=s.world?.homeResident;if(!h||h.mode!=='resident'||!s.world!.visit.active||s.world!.visit.placeId!==h.home||
    s.phase!=='battle'||!s.exploration?.definition.sceneLayout||!Number.isFinite(dt)||dt<=0)return;
  const u=resident(s);if(!u)return;const a=runtime(s)!;
  const danger=s.context==='explorationBattle'||s.units.some(e=>e.team==='enemy'&&e.life==='active'&&e.hp>0);
  const reason=Object.values(a.holds)[0]??(h.busy==='dialogue'?undefined:h.busy)??(danger?'danger':undefined)??
    (u.direct||u.partyTask||u.recall||u.skillLanding||u.evasion?.action||u.path.length&&u.path!==a.ownedPath?'foreign-movement':undefined)??
    (u.life!=='active'||u.hp<=0||u.stagger>0||u.forcedMotion||u.crossing||u.ready>0||u.statuses.some(t=>t.kind==='stun'&&t.remaining>0)?'body-unavailable':undefined);
  if(reason){interrupt(a,u,reason);return;}
  if(a.phase==='cancelled')return;
  a.clock+=dt;
  const p=a.taskId?anchorFor(s,a):undefined;
  if(a.taskId&&!p){clearTask(a,u,'layout-or-object-invalid');return;}
  if(a.phase==='interrupted'){
    record(a,u,'resumed','owner-released / revalidated');
    if(!p){a.phase='idle';a.resume=undefined;return;}
    const dwell=a.resume==='dwelling'&&distance(u.pos,p.approach)<.04;a.resume=undefined;
    if(dwell){a.phase='dwelling';u.facing=p.facing;}else plan(s,u,a,p);return;
  }
  if(a.phase==='completed'){a.phase='idle';a.taskId=undefined;a.anchorId=undefined;}
  if(a.phase==='idle'){if(a.clock>=a.retryAt)select(s,u,a);return;}
  if(!p)return;
  if(a.phase==='blocked'){if(a.clock>=a.retryAt)plan(s,u,a,p);return;}
  if(a.phase==='moving'){
    if(distance(u.pos,p.approach)<.04){arrive(a,u,p);return;}
    if(a.ownedPath!==u.path){block(a,u,'path-owner-changed');return;}
    if(distance(u.pos,a.lastPos)>.02){a.lastProgress=a.clock;a.lastPos={...u.pos};}
    if(!u.path.length||a.clock-a.lastProgress>2.5){block(a,u,'movement-blocked');}return;
  }
  if(a.phase==='dwelling'){
    if(!terrainFits(s,p.approach,radius(u))||distance(u.pos,p.approach)>=.04){plan(s,u,a,p);return;}
    a.remaining=Math.max(0,a.remaining-dt);
    if(a.remaining<=1e-7){const b=HOME_BEHAVIORS.find(b=>b.id===a.taskId)!;a.lastCompleted=b.id;a.completed[b.id]=a.clock;
      a.cooldowns[b.id]=a.clock+b.cooldown;a.phase='completed';record(a,u,'completed','dwell-finished / no-reward');}
  }
}
export function homeActivityDebug(s:GameState){
  const a=s.world?.homeResident?.activity;if(!a)return null;
  return {owner:s.world!.homeResident!.mode==='party'?'existing-party':a.phase==='interrupted'?a.reason:'home-activity',
    phase:a.phase,taskId:a.taskId,anchorId:a.anchorId,mapInstance:a.mapInstance,layoutRevision:a.layoutRevision,
    remaining:a.remaining,pathToken:a.pathToken,pathLength:a.ownedPath?.length??0,reason:a.reason,
    retries:a.retries,planCount:a.planCount,clock:a.clock,lastCompleted:a.lastCompleted,
    animation:'stand-placeholder',holds:Object.values(a.holds),history:a.history.map(e=>({...e,pos:{...e.pos}}))};
}
