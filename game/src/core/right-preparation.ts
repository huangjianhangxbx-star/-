import type {CommandResult,GameState} from './types';
import type {RightAbilityId,RightSkillState} from './right-skill-state';
import {RIGHT_ABILITIES} from './right-hand-skills';

export type PreparedOwner='hunter'|'ranger';
export type MainDefinitionId='hunter-golden-main'|'al-golden-main';
export type PreparedMainLoadout={ownerId:PreparedOwner;mainDefinitionId:MainDefinitionId;profession:PreparedOwner;slots:RightSkillState['slots']};
/** Stable selections only. Future Level1/2/3 choices belong to this loadout, never runtime CD. */
export type RightPreparation=Record<PreparedOwner,PreparedMainLoadout>;
export const mainDefinitionFor=(id:string):MainDefinitionId=>id==='hunter'?'hunter-golden-main':'al-golden-main';
export function createRightPreparation():RightPreparation{
 return {hunter:{ownerId:'hunter',mainDefinitionId:'hunter-golden-main',profession:'hunter',slots:{Q:'hunter-break',E:'hunter-native-E',R:'hunter-sweep'}},ranger:{ownerId:'ranger',mainDefinitionId:'al-golden-main',profession:'ranger',slots:{Q:'al-stab',E:'al-native-E',R:'al-spin'}}};
}
export function initializeRightPreparation(s:GameState){s.rightPreparation??=createRightPreparation();}
export function preparedMain(s:GameState,id:string){return id==='hunter'||id==='ranger'?s.rightPreparation?.[id]:undefined;}
const fail=(reason:string):CommandResult=>({ok:false,reason});
export function queryPreparedSkillChange(s:GameState,id:string,key:'Q'|'R',abilityId:RightAbilityId|null,definitionId:string):CommandResult{
 const p=preparedMain(s,id),u=s.units.find(u=>u.id===id);
 if(s.sessionMode!=='exploration'||s.journey!=='exploration'||s.xxExperiment||s.phase!=='account'||s.world||s.economy.active)return fail('仅出征前可编辑准备方案');
 if(!p||!u||u.team!=='ally'||u.cloneOf||u.shadowResident||p.ownerId!==id||p.profession!==id||p.mainDefinitionId!==mainDefinitionFor(id)||definitionId!==p.mainDefinitionId)return fail('不是该角色可用的主武器方案');
 if(key!=='Q'&&key!=='R')return fail('本阶段 E 固定');
 const a=abilityId===null?undefined:RIGHT_ABILITIES[abilityId];
 if(abilityId!==null&&(!a||a.native||a.profession!==p.profession))return fail('不是该职业已拥有的可用技能');
 return {ok:true};
}
/** Same-slot selection is idempotent; selecting the other slot swaps, including an empty slot. */
export function setPreparedSlot(slots:RightSkillState['slots'],key:'Q'|'R',id:RightAbilityId|null){
 const other=key==='Q'?'R':'Q';if(id!==null&&slots[other]===id)slots[other]=slots[key];slots[key]=id;
}
export function configurePreparedSkill(s:GameState,id:string,key:'Q'|'R',abilityId:RightAbilityId|null,definitionId:string):CommandResult{
 const check=queryPreparedSkillChange(s,id,key,abilityId,definitionId);if(!check.ok)return check;
 setPreparedSlot(preparedMain(s,id)!.slots,key,abilityId);return {ok:true};
}
