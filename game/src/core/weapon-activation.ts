import {RESOURCE_NAMES} from './resource-label';
import type {CommandResult,GameState,Unit} from './types';
import {canPay,payVitality} from './economy';
import {isStandaloneExploration,isPartyBody} from './exploration-party';
import {preparedMain,mainDefinitionFor} from './right-preparation';
import {equipmentBusy} from './equipment';
import {commandFocus} from './exploration-control';
import {ACTIVATION_SAMPLE,validPreparedPassives} from './passive-definition';
export type ActiveLevel=0|1|2|3;
/** The level itself is the monotonic transaction watermark within this world. */
export type WeaponActivation={activeLevel:ActiveLevel};
const fail=(reason:string):CommandResult=>({ok:false,reason});
const neutral=Object.freeze({recovery:1,posture:1,damage:1});
function validBody(s:GameState,u:Unit){
 const r=u.equipment?.equipped.right,p=preparedMain(s,u.id);
 return s.units.find(a=>a.id===u.id)===u&&s.units.filter(a=>a.id===u.id).length===1&&u.team==='ally'&&!u.cloneOf&&!u.shadowResident&&!!r&&!r.weapon.shadow&&!!p&&p.ownerId===u.id&&p.profession===u.id&&p.mainDefinitionId===mainDefinitionFor(u.id)&&r.definitionId===p.mainDefinitionId&&r.ownerId===u.id&&r.hand==='right'&&r.id===`${s.world?.id}:${u.id}:right:golden`&&r.skills?.ownerId===u.id&&r.skills.mainInstanceId===r.id&&r.skills.profession===p.profession&&validPreparedPassives(p.preparedPassives)&&validPreparedPassives(r.preparedPassives)&&((u.id==='hunter'&&u.basicProfileId==='hunter-v2')||(u.id==='ranger'&&u.basicProfileId==='al-basic-v1'));
}
function activeWorld(s:GameState){const w=s.world;return s.sessionMode==='exploration'&&!s.xxExperiment&&isStandaloneExploration(s)&&s.phase==='battle'&&!!w?.visit.active&&w.places[w.visit.placeId]?.definition===s.exploration?.definition&&Number.isInteger(w.activation?.activeLevel)&&w.activation.activeLevel>=0&&w.activation.activeLevel<=3;}
function queryAccess(s:GameState):CommandResult{
 if(!activeWorld(s))return fail('仅当前普通探索区域可激活');
 if(!s.units.filter(u=>isPartyBody(s,u)).every(u=>validBody(s,u)))return fail('双人右手预设或世界实例失效');
 const u=s.units.find(a=>a.id===s.controlledBodyId);if(!u||!validBody(s,u)||u.life!=='active'||s.explorationControl?.aim||commandFocus(s))return fail('先结束当前控制操作');
 return {ok:true};
}
/** UI opening must not cancel a dangerous accepted action just to freeze simulation. */
export function queryWeaponActivationOpen(s:GameState):CommandResult{
 const check=queryAccess(s);if(!check.ok)return check;const u=s.units.find(a=>a.id===s.controlledBodyId)!,n=u.id==='hunter'?u.hunterCombat:u.alCombat;
 if(equipmentBusy(u)||u.ready>0||u.evasion?.action||u.recall||u.partyTask||u.rescueTarget||s.time<(n?.hurtUntil??0)||s.time+1e-8<(n?.finalRecoveryUntil??0)||u.statuses.some(t=>t.kind==='stun'&&t.remaining>0))return fail('动作或恢复尚未结束，不能打开升级');return {ok:true};
}
/** Pure complete qualification. Other ongoing accepted attacks are never rewritten. */
export function queryWeaponActivationUpgrade(s:GameState,worldId:string,expectedLevel:number):CommandResult{
 const check=queryAccess(s);if(!check.ok)return check;const level=s.world!.activation.activeLevel;
 if(s.world!.id!==worldId||!Number.isInteger(expectedLevel)||expectedLevel<0||expectedLevel>2||expectedLevel!==level)return fail(level===3?'已经达到 Level 3':'升级请求已失效');
 return canPay(s,ACTIVATION_SAMPLE.costs[expectedLevel as 0|1|2])?{ok:true}:fail(`随身${RESOURCE_NAMES.vitality}不足或当前不可消费`);
}
export function commitWeaponActivationUpgrade(s:GameState,worldId:string,expectedLevel:number):CommandResult{
 const check=queryWeaponActivationUpgrade(s,worldId,expectedLevel);if(!check.ok)return check;
 const paid=payVitality(s,ACTIVATION_SAMPLE.costs[expectedLevel],'weapon-activation');if(!paid.ok)return paid;
 s.world!.activation.activeLevel=(expectedLevel+1) as ActiveLevel;return {ok:true};
}
/** Only current-world owned right samples benefit. No unit/HUD level or resource mutation. */
export function effectivePassiveModifiers(s:GameState,u:Unit){
 if(!activeWorld(s)||!isPartyBody(s,u)||!validBody(s,u))return neutral;const level=s.world!.activation.activeLevel,ids=u.equipment!.equipped.right?.preparedPassives!;
 return {recovery:level>=1&&ids[0]==='sample-recovery'?ACTIVATION_SAMPLE.recovery:1,posture:level>=2&&ids[1]==='sample-posture'?ACTIVATION_SAMPLE.posture:1,damage:level>=3&&ids[2]==='sample-damage'?ACTIVATION_SAMPLE.damage:1};
}
