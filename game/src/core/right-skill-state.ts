import type {Unit,Weapon,Pos,GameState,Profession} from './types';
import type {ActionContext} from './combat-identity';
import {recordCombatLifecycle} from './combat-identity';
export type RightSkillKey='Q'|'E'|'R';
export type RightAbilityId='hunter-break'|'hunter-sweep'|'hunter-native-E'|'al-stab'|'al-spin'|'al-native-E';
export type RightAbility={id:RightAbilityId;name:string;profession:Profession;native?:true;cooldown:number;stamina:number;damage:number;posture:number;range:number;arc:number;release:number;finish:number;color:string};
export type RightSkillAction={context:ActionContext;spec:Readonly<RightAbility>;weapon:Readonly<Weapon>;origin:Pos;heading:number;acceptedAt:number;released:boolean};
export type RightSkillState={ownerId:string;mainInstanceId:string;profession:Profession;slots:Record<RightSkillKey,RightAbilityId|null>;instances:Partial<Record<RightAbilityId,{id:string;abilityId:RightAbilityId;cd:number}>>;action?:RightSkillAction};
/** The right main instance owns in-world config/resources; preparation holds only future selections. */
export const rightSkillAction=(u:Unit)=>!u.cloneOf&&!u.shadowResident?u.equipment?.equipped.right.skills?.action:undefined;
export function cancelRightSkill(s:GameState|undefined,u:Unit,reason:string){const st=u.equipment?.equipped.right.skills;if(!st?.action)return;if(s)recordCombatLifecycle(s,st.action.context,'action-cancelled',reason);st.action=undefined;}
