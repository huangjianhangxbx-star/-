import type {CommandResult,GameState,Unit} from './types';
import {controlledBody,ensureControlledBody,queryControlBody,switchControlledBody} from './direct-control';
import {isStandaloneExploration} from './exploration-party';
import {foregroundSkill} from './skill-slots';

export type ExplorationAimKind='path'|'skill'|'mobility';
export type ExplorationAimSession={kind:ExplorationAimKind;actorId:string;startedAt:number};
export type ExplorationControlState={commandFocusId:string|null;aim?:ExplorationAimSession};
export type InputAuthority='modal'|'aim'|'direct'|'order'|'auto'|'ai';
export const usesExplorationControl=(s:GameState)=>isStandaloneExploration(s)&&s.phase==='battle';
export const directActor=(s:GameState):Unit|null=>usesExplorationControl(s)?controlledBody(s):null;
export function commandFocus(s:GameState):Unit|null {
 const id=s.explorationControl?.commandFocusId;
 return usesExplorationControl(s)&&id&&id!==s.controlledBodyId&&queryControlBody(s,id).ok?s.units.find(u=>u.id===id)||null:null;
}
export const controlMode=(s:GameState):'direct'|'command'=>commandFocus(s)?'command':'direct';
/** Existing modal owners remain exclusive; future Aim sessions can use this seam. */
export const inputAuthority=(s:GameState,modal=false):InputAuthority=>modal?'modal':validCommandAim(s)?'aim':directActor(s)?'direct':'ai';
function validCommandAim(s:GameState){const focus=commandFocus(s),aim=s.explorationControl?.aim;return !!focus&&!!aim&&aim.actorId===focus.id&&['path','skill','mobility'].includes(aim.kind);}
export const commandReserved=(s:GameState,u:Unit)=>validCommandAim(s)&&s.explorationControl!.aim!.actorId===u.id;
export const autonomousBodyStartAllowed=(s:GameState,u:Unit)=>!commandReserved(s,u);
/** Reservation is an authority claim, not an interruption or a new life state. */
export function commandReservationReady(s:GameState,u:Unit){
 return commandReserved(s,u)&&!u.attackPending&&!foregroundSkill(u)&&!Object.values(u.skillStates||{}).some(st=>st.run)&&!u.evasion?.action&&!u.forcedMotion&&!u.crossing&&!u.skillLanding&&!u.loadout&&!u.recall&&!u.partyTask&&!u.rescueTarget&&u.stagger<=0&&u.ready<=0&&!u.statuses.some(st=>st.kind==='stun'&&st.remaining>0);
}
export function queryBeginCommandAim(s:GameState,kind:ExplorationAimKind):CommandResult {
 if(!usesExplorationControl(s))return {ok:false,reason:'仅独立探索可开始指令瞄准'};
 if(!['path','skill','mobility'].includes(kind))return {ok:false,reason:'无效指令瞄准类型'};
 const u=commandFocus(s);if(!u)return {ok:false,reason:'需要合法的离控指令焦点'};
 if(u.ai?.command==='move'&&(u.path.length||u.destination)||u.recall||u.partyTask||u.rescueTarget||u.loadout)return {ok:false,reason:'既有玩家行动尚未结束'};
 return {ok:true};
}
/** Withdraw only free AI locomotion. Atomic crossing/landing keeps its physical route. */
export function beginCommandAim(s:GameState,kind:ExplorationAimKind):CommandResult {
 const result=queryBeginCommandAim(s,kind);if(!result.ok)return result;
 const u=commandFocus(s)!,runtime=s.explorationControl!;
 if(runtime.aim?.actorId===u.id&&runtime.aim.kind===kind)return result;
 runtime.aim={kind,actorId:u.id,startedAt:s.time};
 if(u.companionCombat?.moving||u.ai?.moving||u.following){
  if(!u.skillLanding){u.path=u.crossing?[{...u.crossing.to}]:[];u.destination=null;u.afterCross=undefined;if(u.intent==='move')u.intent=null;}
  else u.skillLanding.after=undefined;
 }
 if(u.companionCombat){u.companionCombat.moving=false;u.companionCombat.nextDecision=s.time;u.companionCombat.committedUntil=undefined;u.companionCombat.rejectReason='command-reserved';}
 if(u.ai){u.ai.moving=false;u.ai.nextDecision=s.time;}
 u.following=false;return result;
}
export function cancelCommandAim(s:GameState):CommandResult {
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
 (s.explorationControl??={commandFocusId:null}).commandFocusId=null;
 s.explorationControl.aim=undefined;s.tacticalFocus=undefined;return result;
}
export function setCommandFocus(s:GameState,id:string|null):CommandResult {
 const result=queryCommandFocus(s,id);if(!result.ok)return result;
 if(id===null||id===s.controlledBodyId)return clearCommandFocus(s);
 const runtime=s.explorationControl??={commandFocusId:null};
 if(runtime.commandFocusId!==id){runtime.commandFocusId=id;runtime.aim=undefined;s.tacticalFocus={elapsed:0};}
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
 if(runtime.aim&&!validCommandAim(s))runtime.aim=undefined;
}
