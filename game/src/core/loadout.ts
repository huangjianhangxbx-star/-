import {bindSkillMirrors,canConfigure,currentSkill,initializeProfile,initializeSkills} from './progression';
import {DEFAULT_SKILLS,professionOf} from './skill-catalog';
import {compatibleWeapon} from './combat-config';
import type {CommandResult,GameState,Unit} from './types';
export {canConfigure} from './progression';
export function interruptSkill(u:Unit,reason:'action'|'movement'='action'):void{const st=currentSkill(u);if(reason==='movement'&&u.skillId==='rain'&&st.run)return;if(st.run?.spec.id==='reap'&&!u.cloneOf&&u.life==='active')u.skillLanding={origin:{...u.pos}};if(st.time>0){st.time=0;st.cd=st.max;}st.pulse=0;st.snapshot=undefined;st.run=undefined;}
export function cancelLoadout(u:Unit):void{u.loadout=undefined;}
export function requestWeapon(s:GameState,u:Unit,index:number):CommandResult{
 if(u.loadout)return {ok:false,reason:'当前换装未结束，不能重复请求'};
 const target=u.weapons[index];
 const configuration=canConfigure(s);
 if(u.team!=='ally'||u.cloneOf||(!configuration&&u.life!=='active')||(configuration&&!['active','reserve','withdrawn'].includes(u.life)))return {ok:false,reason:'当前生命状态不能换装'};
 if(!Number.isInteger(index)||index===u.weaponIndex||!target||!compatibleWeapon(u,target)||target.durability<=0)return {ok:false,reason:'目标武器不存在或不可用'};
 if(u.crossing||u.recall||u.rescueTarget||u.intent==='rescue'||u.statuses.some(a=>a.kind==='stun'&&a.remaining>0))return {ok:false,reason:'跨层、回收、救援或眩晕时不能换装'};
 if(!configuration&&s.phase!=='battle')return {ok:false,reason:'当前流程不能换装'};
 initializeSkills(u,s.profile);interruptSkill(u);
 u.path=[];u.destination=null;u.direct=undefined;u.intent=null;u.attackPending=undefined;
 u.loadout={targetIndex:index,elapsed:0,duration:.8};if(configuration)commitWeapon(s,u);return {ok:true};
}
function commitWeapon(s:GameState,u:Unit):void{const action=u.loadout!;const prior=professionOf(u),old=currentSkill(u);u.weaponIndex=action.targetIndex;const next=professionOf(u);if(next!==prior){if(old.enabled&&u.skillId==='dance')old.cd=old.max;old.enabled=false;u.skillId=initializeProfile(s).defaults[u.id]?.[next]??DEFAULT_SKILLS[next];currentSkill(u);}bindSkillMirrors(u);cancelLoadout(u);}
export function tickLoadout(s:GameState,u:Unit,dt:number):boolean{
 const action=u.loadout;if(!action||dt<=0)return false;
 if(u.life!=='active'){cancelLoadout(u);return false;}
 action.elapsed+=dt;if(action.elapsed+1e-9<action.duration)return false;
 const target=u.weapons[action.targetIndex];
 if(!target||!compatibleWeapon(u,target)||target.durability<=0){cancelLoadout(u);return false;}
 commitWeapon(s,u);return true;
}
