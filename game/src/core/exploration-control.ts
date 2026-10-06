import {clearBasicInput} from './basic-chain';
import {releaseCommandDefense} from './command-defense';
import {hasMoveOrder,suspendMoveOrder} from './move-order';
import type {CommandResult,GameState,Unit} from './types';
import {controlledBody,ensureControlledBody,queryControlBody,switchControlledBody} from './direct-control';
import {isStandaloneExploration} from './exploration-party';
import {foregroundSkill} from './skill-slots';

export type ExplorationAimKind='path'|'skill'|'mobility';
export type ExplorationAimSource='command'|'direct';
export type ExplorationAimSession={kind:ExplorationAimKind;actorId:string;source:ExplorationAimSource;startedAt:number};
export type ExplorationControlState={commandFocusId:string|null;aim?:ExplorationAimSession;moveOrders?:Record<string,import('./move-order').ExplorationMoveOrder>};
export type InputAuthority='modal'|'aim'|'direct'|'order'|'auto'|'ai';
export const usesExplorationControl=(s:GameState)=>isStandaloneExploration(s)&&s.phase==='battle';
export const directActor=(s:GameState):Unit|null=>usesExplorationControl(s)?controlledBody(s):null;
export function commandFocus(s:GameState):Unit|null {
 const id=s.explorationControl?.commandFocusId;
 return usesExplorationControl(s)&&id&&id!==s.controlledBodyId&&queryControlBody(s,id).ok?s.units.find(u=>u.id===id)||null:null;
}
export const controlMode=(s:GameState):'direct'|'command'=>commandFocus(s)?'command':'direct';
/** Existing modal owners remain exclusive; future Aim sessions can use this seam. */
export const inputAuthority=(s:GameState,modal=false):InputAuthority=>modal?'modal':aimActor(s)?'aim':directActor(s)?'direct':'ai';
export function aimActor(s:GameState):Unit|null {const aim=s.explorationControl?.aim;if(!aim||!usesExplorationControl(s)||!['path','skill','mobility'].includes(aim.kind))return null;const u=aim.source==='command'?commandFocus(s):aim.source==='direct'&&!commandFocus(s)?directActor(s):null;return u?.id===aim.actorId?u:null;}
export const commandReserved=(s:GameState,u:Unit)=>s.explorationControl?.aim?.source==='command'&&aimActor(s)?.id===u.id;
export const tacticalAutonomyAllowed=(s:GameState,u:Unit)=>!commandReserved(s,u)&&!hasMoveOrder(s,u);
export const localAutoCombatAllowed=(s:GameState,u:Unit)=>!commandReserved(s,u)&&!(hasMoveOrder(s,u)&&s.explorationControl?.aim?.actorId===u.id);
/** Legacy consumers can retain the local-body gate. */
export const autonomousBodyStartAllowed=localAutoCombatAllowed;
/** Reservation is an authority claim, not an interruption or a new life state. */
export const bodyActionReady=(u:Unit)=>!u.attackPending&&!foregroundSkill(u)&&!Object.values(u.skillStates||{}).some(st=>st.run)&&!u.evasion?.action&&!u.forcedMotion&&!u.crossing&&!u.skillLanding&&!u.loadout&&!u.recall&&!u.partyTask&&!u.rescueTarget&&u.stagger<=0&&u.ready<=0&&!u.statuses.some(st=>st.kind==='stun'&&st.remaining>0);
export const commandReservationReady=(s:GameState,u:Unit)=>commandReserved(s,u)&&bodyActionReady(u);
export function queryBeginCommandAim(s:GameState,kind:ExplorationAimKind):CommandResult {
 if(!usesExplorationControl(s))return {ok:false,reason:'仅独立探索可开始指令瞄准'};
 if(!['path','skill','mobility'].includes(kind))return {ok:false,reason:'无效指令瞄准类型'};
 const u=commandFocus(s);if(!u)return {ok:false,reason:'需要合法的离控指令焦点'};
 if(!hasMoveOrder(s,u)&&u.ai?.command==='move'&&(u.path.length||u.destination)||u.recall||u.partyTask||u.rescueTarget||u.loadout)return {ok:false,reason:'既有玩家行动尚未结束'};
 return {ok:true};
}
/** Withdraw only free AI locomotion. Atomic crossing/landing keeps its physical route. */
export function beginCommandAim(s:GameState,kind:ExplorationAimKind):CommandResult {
 return beginExplorationAim(s,commandFocus(s)?.id||'',kind,'command');
}
export function beginExplorationAim(s:GameState,actorId:string,kind:ExplorationAimKind,source:ExplorationAimSource):CommandResult {
 if(!usesExplorationControl(s))return {ok:false,reason:'仅独立探索可开始瞄准'};
 if(!['path','skill','mobility'].includes(kind)||!['command','direct'].includes(source))return {ok:false,reason:'无效瞄准类型或来源'};
 const u=source==='command'?commandFocus(s):!commandFocus(s)?directActor(s):null;
 if(!u||u.id!==actorId)return {ok:false,reason:'瞄准角色与当前控制身份不符'};
 const result=source==='command'?queryBeginCommandAim(s,kind):{ok:true};if(!result.ok)return result;
 const runtime=s.explorationControl??={commandFocusId:null};
 if(runtime.aim?.actorId===u.id&&runtime.aim.kind===kind&&runtime.aim.source===source)return result;
 for(const body of s.units)clearBasicInput(body);
 runtime.aim={kind,actorId:u.id,source,startedAt:s.time};
 suspendMoveOrder(s,u,'aim');
 if(source==='direct')return result;
 if(u.companionCombat?.moving||u.ai?.moving||u.following){
  if(!u.skillLanding){u.path=u.crossing?[{...u.crossing.to}]:[];u.destination=null;u.afterCross=undefined;if(u.intent==='move')u.intent=null;}
  else u.skillLanding.after=undefined;
 }
 if(u.companionCombat){u.companionCombat.moving=false;u.companionCombat.nextDecision=s.time;u.companionCombat.committedUntil=undefined;u.companionCombat.rejectReason='command-reserved';}
 if(u.ai){u.ai.moving=false;u.ai.nextDecision=s.time;}
 u.following=false;return result;
}
export function cancelCommandAim(s:GameState):CommandResult {
 return cancelExplorationAim(s);
}
export function cancelExplorationAim(s:GameState):CommandResult {
 if(!usesExplorationControl(s))return {ok:false,reason:'当前不是独立探索控制'};
 if(s.explorationControl)s.explorationControl.aim=undefined;
 return {ok:true};
}
export function queryCommandFocus(s:GameState,id:string|null):CommandResult {
 if(!usesExplorationControl(s))return {ok:false,reason:'仅独立暗牢可设置指令焦点'};
 return id===null?{ok:true}:queryControlBody(s,id);
}
export function clearCommandFocus(s:GameState):CommandResult {
 const result=queryCommandFocus(s,null);if(!result.ok)return result;
 for(const body of s.units)releaseCommandDefense(body);
 (s.explorationControl??={commandFocusId:null}).commandFocusId=null;
 s.explorationControl.aim=undefined;s.tacticalFocus=undefined;return result;
}
export function setCommandFocus(s:GameState,id:string|null):CommandResult {
 const result=queryCommandFocus(s,id);if(!result.ok)return result;
 if(id===null||id===s.controlledBodyId)return clearCommandFocus(s);
 const runtime=s.explorationControl??={commandFocusId:null};
 if(runtime.commandFocusId!==id){for(const body of s.units)clearBasicInput(body);runtime.commandFocusId=id;runtime.aim=undefined;s.tacticalFocus={elapsed:0};}
 return result;
}
/** Call before validating the direct action: an action rejection cannot undo takeover. */
export function promoteForDirectAction(s:GameState):CommandResult {
 if(!usesExplorationControl(s))return {ok:false,reason:'当前不是独立探索控制'};
 const focused=commandFocus(s);if(!focused)return {ok:true};
 cancelCommandAim(s);
 const result=switchControlledBody(s,focused.id);
 if(result.ok)clearCommandFocus(s);return result;
}
export function ensureExplorationControl(s:GameState){
 ensureControlledBody(s);
 if(!usesExplorationControl(s)){s.explorationControl=undefined;return;}
 const runtime=s.explorationControl??={commandFocusId:null};
 if(runtime.commandFocusId&&!commandFocus(s))clearCommandFocus(s);
 if(runtime.aim&&!aimActor(s))runtime.aim=undefined;
}
