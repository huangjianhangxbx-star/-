import {professionOf} from './skill-catalog';
import {clearBasicInput} from './basic-chain';
import {releaseCommandDefense} from './command-defense';
import {hasMoveOrder,suspendMoveOrder} from './move-order';
import type {CommandResult,GameState,Unit} from './types';
import {controlledBody,ensureControlledBody} from './direct-control';
import {isStandaloneExploration} from './exploration-party';
import {foregroundSkill,skillInSlot} from './skill-slots';

export type ExplorationAimKind='path'|'skill'|'mobility';
export type ExplorationAimSource='command'|'direct';
export type ExplorationAimSession={kind:ExplorationAimKind;actorId:string;source:ExplorationAimSource;startedAt:number;skill?:import('./skill-intent').SkillAimPayload};
export type ExplorationControlState={commandFocusId:string|null;aim?:ExplorationAimSession;moveOrders?:Record<string,import('./move-order').ExplorationMoveOrder>};
export type InputAuthority='modal'|'aim'|'direct'|'order'|'auto'|'ai';
export const usesExplorationControl=(s:GameState)=>isStandaloneExploration(s)&&s.phase==='battle';
export const directActor=(s:GameState):Unit|null=>usesExplorationControl(s)?controlledBody(s):null;
export const commandFocus=(_s:GameState):Unit|null=>null;
export const controlMode=(_s:GameState):'direct'|'command'=>'direct';
/** Existing modal owners remain exclusive; future Aim sessions can use this seam. */
export const inputAuthority=(s:GameState,modal=false):InputAuthority=>modal?'modal':aimActor(s)?'aim':directActor(s)?'direct':'ai';
export function aimActor(s:GameState):Unit|null {const aim=s.explorationControl?.aim;if(!aim||!usesExplorationControl(s)||!['path','skill','mobility'].includes(aim.kind))return null;const u=aim.source==='direct'?directActor(s):null;return u?.id===aim.actorId?u:null;}
export const commandReserved=(s:GameState,u:Unit)=>s.explorationControl?.aim?.source==='command'&&aimActor(s)?.id===u.id;
export const tacticalAutonomyAllowed=(s:GameState,u:Unit)=>!commandReserved(s,u)&&!hasMoveOrder(s,u);
export const localAutoCombatAllowed=(s:GameState,u:Unit)=>!commandReserved(s,u)&&!(hasMoveOrder(s,u)&&s.explorationControl?.aim?.actorId===u.id);
/** Legacy consumers can retain the local-body gate. */
export const autonomousBodyStartAllowed=localAutoCombatAllowed;
/** Reservation is an authority claim, not an interruption or a new life state. */
export const bodyActionReady=(u:Unit)=>!u.attackPending&&!(u.xxCombat?.action&&!u.xxCombat.action.moveReady)&&!foregroundSkill(u)&&!Object.values(u.skillStates||{}).some(st=>st.run)&&!u.evasion?.action&&!u.forcedMotion&&!u.crossing&&!u.skillLanding&&!u.loadout&&!u.recall&&!u.partyTask&&!u.rescueTarget&&u.stagger<=0&&u.ready<=0&&!u.statuses.some(st=>st.kind==='stun'&&st.remaining>0);
export const commandReservationReady=(s:GameState,u:Unit)=>commandReserved(s,u)&&bodyActionReady(u);
const legacyRejected=():CommandResult=>({ok:false,reason:'指令焦点控制已停用，请显式切换当前操控角色'});
export const queryBeginCommandAim=(_s:GameState,_kind:ExplorationAimKind)=>legacyRejected();
export const beginCommandAim=(_s:GameState,_kind:ExplorationAimKind)=>legacyRejected();
export function beginExplorationAim(s:GameState,actorId:string,kind:ExplorationAimKind,source:ExplorationAimSource):CommandResult {
 if(!usesExplorationControl(s))return {ok:false,reason:'仅独立探索可开始瞄准'};
 if(!['path','skill','mobility'].includes(kind)||source!=='direct')return {ok:false,reason:'无效瞄准类型或来源'};
 const u=directActor(s);
 if(!u||u.id!==actorId)return {ok:false,reason:'瞄准角色与当前控制身份不符'};
 const result={ok:true};
 const runtime=s.explorationControl??={commandFocusId:null};
 if(runtime.aim?.actorId===u.id&&runtime.aim.kind===kind&&runtime.aim.source===source)return result;
 for(const body of s.units)clearBasicInput(body);
 runtime.aim={kind,actorId:u.id,source,startedAt:s.time};
 suspendMoveOrder(s,u,'aim');
 return result;
}
export function cancelCommandAim(s:GameState):CommandResult {
 return cancelExplorationAim(s);
}
export function cancelExplorationAim(s:GameState):CommandResult {
 if(!usesExplorationControl(s))return {ok:false,reason:'当前不是独立探索控制'};
 if(s.explorationControl)s.explorationControl.aim=undefined;
 return {ok:true};
}
export const queryCommandFocus=(_s:GameState,_id:string|null)=>legacyRejected();
export const clearCommandFocus=(_s:GameState)=>legacyRejected();
export const setCommandFocus=(_s:GameState,_id:string|null)=>legacyRejected();
export const promoteForDirectAction=(_s:GameState)=>legacyRejected();
export function ensureExplorationControl(s:GameState){
 ensureControlledBody(s);
 if(!usesExplorationControl(s)){s.explorationControl=undefined;return;}
 const runtime=s.explorationControl??={commandFocusId:null};
 runtime.commandFocusId=null;s.tacticalFocus=undefined;
 for(const body of s.units)releaseCommandDefense(body);
 if(runtime.aim&&!aimActor(s)){s.notice='瞄准角色或身份失效';runtime.aim=undefined;}
 if(runtime.aim?.skill){const p=runtime.aim.skill,u=aimActor(s);if(!u||skillInSlot(u,p.slot)!==p.skillId||professionOf(u)!==p.profession){runtime.aim=undefined;s.notice='技能槽或职业已改变，请重新准备';}}
}
