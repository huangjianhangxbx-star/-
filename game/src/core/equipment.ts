import type {CommandResult,GameState,Unit,Weapon} from './types';
import {isStandaloneExploration} from './exploration-party';

export type OffhandActionType='guard'|'shot'|'bomb';
export type OffhandInstance={id:string;ownerId:string;hand:'left';name:string;action:OffhandActionType;durability:number;maxDurability:number;cd:number;lastWearId?:number};
export type MainInstance={id:string;ownerId:string;hand:'right';currentForm:import('./main-form-spec').MainFormId;weapon:Weapon};
export type EquipmentState={equipped:{right:MainInstance;left:OffhandInstance};owned:OffhandInstance[];migrationLoad:number;nextWearId:number};
const fail=(reason:string):CommandResult=>({ok:false,reason});
export const usesEquipment=(s:GameState,u:Unit)=>s.sessionMode==='exploration'&&!s.xxExperiment&&isStandaloneExploration(s)&&!u.cloneOf&&!u.shadowResident&&u.team==='ally'&&['hunter','ranger'].includes(u.id);
export function initializeEquipment(s:GameState){for(const u of s.units)if(usesEquipment(s,u)&&!u.equipment){
 const native:OffhandActionType=u.id==='hunter'?'guard':'shot';
 const make=(action:OffhandActionType):OffhandInstance=>({id:`${s.world?.id??'session'}:${u.id}:left:${action}`,ownerId:u.id,hand:'left',action,name:action==='guard'?'实验护盾':action==='shot'?'实验射击器':'试验炸弹',durability:100,maxDurability:100,cd:0});
 const left=make(native);u.equipment={equipped:{right:{id:`${s.world?.id??'session'}:${u.id}:right:golden`,ownerId:u.id,hand:'right',currentForm:'I',weapon:u.weapons[u.weaponIndex]},left},owned:[left,make('bomb')],migrationLoad:u.weapons.reduce((n,w)=>n+(w.weight||0),0),nextWearId:1};
}}
/** Existing main-weapon consumers read the same object; candidates never become a second authority. */
export function mainWeapon(u:Unit){return u.equipment?.equipped.right.weapon??u.weapons[u.weaponIndex];}
export function queryEquipmentAbility(s:GameState,u:Unit,action:OffhandActionType):CommandResult{
 if(!usesEquipment(s,u))return {ok:true};
 const left=u.equipment?.equipped.left,defaultAction=u.id==='hunter'?'guard':'shot';
 if((left?.action??defaultAction)!==action)return fail(action==='guard'?'需要装备护盾型副手':action==='shot'?'需要装备射击器型副手':'需要装备炸弹型副手');
 if(left&&(left.ownerId!==u.id||left.hand!=='left'))return fail('副手所有权或手别不合法');
 if(left&&left.durability<=0)return fail('副手已损坏');return {ok:true};
}
export function equipmentBusy(u:Unit){return !!(u.offhand?.pending||u.basicAction||u.attackPending||u.hunterCombat?.special||u.hunterCombat?.motion||u.alCombat?.special||u.alCombat?.motion||u.forcedMotion||u.crossing||u.stagger>0||u.loadout||u.skillLanding||Object.values(u.skillStates??{}).some(st=>st.run||st.time>0));}
export function queryEquipOffhand(s:GameState,u:Unit,instanceId:string):CommandResult{
 if(!usesEquipment(s,u)||!u.equipment)return fail('当前角色未接入双手装备');
 const item=u.equipment.owned.find(e=>e.id===instanceId);if(!item||item.ownerId!==u.id||item.hand!=='left')return fail('不是该角色拥有的左手装备');
 if(item.action!=='bomb'&&item.action!==(u.id==='hunter'?'guard':'shot'))return fail('该角色不支持此副手');
 if(u.life!=='active'||s.phase!=='battle'||s.context!=='explorationIdle')return fail('仅存活且脱战时可更换副手');
 if(equipmentBusy(u))return fail('动作尚未结束，不能更换副手');return {ok:true};
}
export function equipOffhand(s:GameState,u:Unit,instanceId:string):CommandResult{
 const check=queryEquipOffhand(s,u,instanceId);if(!check.ok)return check;u.equipment!.equipped.left=u.equipment!.owned.find(e=>e.id===instanceId)!;
 if(u.offhand)u.offhand.held=false;if(u.hunterCombat)u.hunterCombat.held=false;if(u.alCombat)u.alCombat.shotHeld=false;return {ok:true};
}
/** Monotonic per-owner wear token is independent of optional combat tracing. */
export function wearOffhand(u:Unit,item:OffhandInstance,token:number){if(item.ownerId!==u.id||token<1||token<=(item.lastWearId??0))return;item.lastWearId=token;item.durability=Math.max(0,item.durability-1);}
export function wearToken(u:Unit){return u.equipment?u.equipment.nextWearId++:0;}
