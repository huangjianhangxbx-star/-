import type {CommandResult,GameState,Unit} from './types';
import {controlledBody,ensureControlledBody,queryControlBody,switchControlledBody} from './direct-control';
import {isStandaloneExploration} from './exploration-party';

export type ExplorationAimKind='path'|'skill'|'mobility';
export type ExplorationAimSession={kind:ExplorationAimKind;actorId:string};
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
export const inputAuthority=(s:GameState,modal=false):InputAuthority=>modal?'modal':usesExplorationControl(s)&&s.explorationControl?.aim?'aim':directActor(s)?'direct':'ai';
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
 const result=switchControlledBody(s,focused.id);
 if(result.ok)clearCommandFocus(s);return result;
}
export function ensureExplorationControl(s:GameState){
 ensureControlledBody(s);
 if(!usesExplorationControl(s)){s.explorationControl=undefined;return;}
 const runtime=s.explorationControl??={commandFocusId:null};
 if(runtime.commandFocusId&&!commandFocus(s))clearCommandFocus(s);
}
