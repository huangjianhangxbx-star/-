import {clearSpecialTactic} from './party-tactics';
import type {CommandResult,GameState,Pos,Unit} from './types';
import type {ExplorationAimSource} from './exploration-control';
import {isPartyBody,isStandaloneExploration} from './exploration-party';
import {navigate} from './navigation';
import {canStop,near,radius,terrainFits} from './spatial';
import {pathSafeFromInactiveEncounters} from './encounter-domain';
import {foregroundSkill} from './skill-slots';

export type MoveOrderSuspendReason='aim'|'basic'|'skill'|'mobility'|'forced'|'stagger'|'temporary-block'|'defense';
export type ExplorationMoveOrder={id:number;actorId:string;destination:Pos;source:ExplorationAimSource;issuedAt:number;state:'moving'|'suspended'|'blocked';suspendReason?:MoveOrderSuspendReason;lastRepathAt?:number};
const enabled=(s:GameState)=>isStandaloneExploration(s)&&s.phase==='battle';
export const moveOrder=(s:GameState,u:Unit)=>enabled(s)?s.explorationControl?.moveOrders?.[u.id]:undefined;
export const hasMoveOrder=(s:GameState,u:Unit)=>!!moveOrder(s,u);
function clearRoute(u:Unit){if(u.crossing||u.skillLanding||Object.values(u.skillStates||{}).some(st=>st.run?.spec.id==='reap'))return;u.path=[];u.destination=null;if(u.intent==='move')u.intent=null;u.moveFrom=undefined;u.moveProgress=0;}
/** A failed route can be temporary; terrain and source policy are checked separately. */
export function queryMoveOrderRoute(s:GameState,u:Unit,to:Pos,source:ExplorationAimSource):{path:Pos[];valid:boolean;permanent:boolean;reason?:string}{
 if(!Number.isFinite(to.x)||!Number.isFinite(to.y)||!terrainFits(s,to,radius(u)))return {path:[],valid:false,permanent:true,reason:'destination-invalid'};
 if(!canStop(s,to,u))return {path:[],valid:false,permanent:false,reason:'temporary-block'};
 const path=navigate(s,u.pos,to,false,true,radius(u));
 if(!path.length&&!near(u.pos,to))return {path,valid:false,permanent:false,reason:'temporary-block'};
 if(source==='command'&&!pathSafeFromInactiveEncounters(s,[u.pos,...path],false))return {path:[],valid:false,permanent:true,reason:'inactive-encounter'};
 return {path,valid:true,permanent:false};
}
export function cancelMoveOrder(s:GameState,u:Unit,reason:string,keepMotion=false){const order=moveOrder(s,u);if(!order)return;delete s.explorationControl!.moveOrders![u.id];if(!keepMotion)clearRoute(u);if(u.ai?.command==='move'){u.ai.command=undefined;u.ai.commandUntil=s.time;u.ai.nextDecision=s.time;u.ai.anchor={...u.pos};}s.log.unshift(`${u.name} MoveOrder ${order.id} cancelled: ${reason}`);s.log.length=Math.min(40,s.log.length);}
export function completeMoveOrder(s:GameState,u:Unit){const order=moveOrder(s,u);if(!order||u.crossing||u.skillLanding||!near(u.pos,order.destination))return false;cancelMoveOrder(s,u,'arrived');return true;}
export function suspendMoveOrder(s:GameState,u:Unit,reason:MoveOrderSuspendReason){const o=moveOrder(s,u);if(!o)return;o.state='suspended';o.suspendReason=reason;clearRoute(u);}
export function issueMoveOrder(s:GameState,u:Unit,to:Pos,source:ExplorationAimSource):CommandResult{
 if(!enabled(s)||!isPartyBody(s,u)||u.life!=='active'||u.shadowResident||!['command','direct'].includes(source))return {ok:false,reason:'无效移动命令角色或来源'};
 const query=queryMoveOrderRoute(s,u,to,source);if(!query.valid)return {ok:false,reason:query.reason};
 clearSpecialTactic(s,u,'新移动订单');
 const runtime=s.explorationControl??={commandFocusId:null};const orders=runtime.moveOrders??={};
 orders[u.id]={id:s.nextId++,actorId:u.id,destination:{...to},source,issuedAt:s.time,state:'moving',lastRepathAt:s.time};
 u.path=query.path;u.destination={...to};u.intent='move';u.following=false;u.direct=undefined;
 if(u.companionCombat)u.companionCombat.moving=false;if(u.ai)u.ai.moving=false;
 completeMoveOrder(s,u);return {ok:true};
}
export const replaceMoveOrder=issueMoveOrder;
export function moveOrderSuspendReason(s:GameState,u:Unit):MoveOrderSuspendReason|undefined {
 if(s.explorationControl?.aim?.actorId===u.id)return 'aim';
 if(u.forcedMotion)return 'forced';
 if(u.stagger>0||u.posture<=0||u.wallPin||u.ready>0||u.statuses.some(st=>st.kind==='stun'&&st.remaining>0))return 'stagger';
 if(u.evasion?.action||u.evasion?.finishedAt===s.time)return 'mobility';
 if(foregroundSkill(u)||u.skillLanding||Object.values(u.skillStates||{}).some(st=>st.run))return 'skill';
 if(u.attackPending)return 'basic';
}
/** Order never stores a route snapshot. Every recovery plans from the live body. */
export function advanceMoveOrders(s:GameState){if(!enabled(s))return;
 for(const id of Object.keys(s.explorationControl?.moveOrders||{})){
  const u=s.units.find(a=>a.id===id);if(!u){delete s.explorationControl!.moveOrders![id];continue;}
  if(!isPartyBody(s,u)||u.life!=='active'||u.shadowResident){cancelMoveOrder(s,u,'actor-invalid');continue;}
  const o=moveOrder(s,u)!;
  if(u.crossing)continue;
  if(!terrainFits(s,o.destination,radius(u))){cancelMoveOrder(s,u,'destination-invalid');continue;}
  if(u.commandDefense?.ownedPath===u.path&&u.path.length){o.state='suspended';o.suspendReason='defense';continue;}
  const reason=moveOrderSuspendReason(s,u);if(reason){suspendMoveOrder(s,u,reason);continue;}
  if(completeMoveOrder(s,u))continue;
  if(o.state==='moving'&&u.path.length)continue;
  if(o.state==='blocked'&&s.time-(o.lastRepathAt??-Infinity)<.25-1e-8)continue;
  const query=queryMoveOrderRoute(s,u,o.destination,o.source);o.lastRepathAt=s.time;
  if(query.permanent){cancelMoveOrder(s,u,query.reason!);continue;}
  if(!query.valid){clearRoute(u);o.state='blocked';o.suspendReason='temporary-block';continue;}
  o.state='moving';delete o.suspendReason;u.path=query.path;u.destination={...o.destination};u.intent='move';u.following=false;if(u.ai)u.ai.moving=false;
 }
}
