import {equippedSkills,equipProfileSlots} from './skill-slots';
import {syncPostureMaximum} from './pressure';
import {bindSkillMirrors,canConfigure,currentSkill,skillState,initializeProfile,initializeSkills} from './progression';
import {DEFAULT_SKILLS,professionOf} from './skill-catalog';
import {compatibleWeapon} from './combat-config';
import type {CommandResult,GameState,Unit} from './types';
export {canConfigure} from './progression';
export function interruptSkill(u:Unit,reason:'action'|'movement'='action'):void{
 for(const id of equippedSkills(u)){const st=skillState(u,id);if(reason==='movement'&&id==='rain'&&st.run)continue;if(st.run?.spec.id==='reap'&&!u.cloneOf&&u.life==='active')u.skillLanding={origin:{...u.pos}};if(st.time>0){st.time=0;st.cd=st.max;}st.pulse=0;st.snapshot=undefined;st.run=undefined;}
}
export function cancelLoadout(u:Unit):void{u.loadout=undefined;}
export function requestWeapon(s:GameState,u:Unit,index:number):CommandResult{
 if(u.loadout)return {ok:false,reason:'当前换装未结束，不能重复请求'};
 const target=u.weapons[index];
 const configuration=canConfigure(s);
 if(u.team!=='ally'||u.cloneOf||(!configuration&&u.life!=='active')||(configuration&&!['active','reserve','withdrawn'].includes(u.life)))return {ok:false,reason:'当前生命状态不能换装'};
 if(!Number.isInteger(index)||index===u.weaponIndex||!target||!compatibleWeapon(u,target)||target.durability<=0)return {ok:false,reason:'目标武器不存在或不可用'};
 if(u.forcedMotion||u.stagger>0||u.crossing||u.recall||u.rescueTarget||u.intent==='rescue'||u.statuses.some(a=>a.kind==='stun'&&a.remaining>0))return {ok:false,reason:'失能、跨层、回收、救援或眩晕时不能换装'};
 if(!configuration&&s.phase!=='battle')return {ok:false,reason:'当前流程不能换装'};
 initializeSkills(u,s.profile);interruptSkill(u);
 u.path=[];u.destination=null;u.direct=undefined;u.intent=null;u.attackPending=undefined;
 u.loadout={targetIndex:index,elapsed:0,duration:.8};if(configuration)commitWeapon(s,u);return {ok:true};
}
function commitWeapon(s:GameState,u:Unit):void{
 const action=u.loadout!,prior=professionOf(u),ids=equippedSkills(u);if(u.skillSlots)(u.professionSlots??={})[prior]=[...u.skillSlots];
 u.weaponIndex=action.targetIndex;const next=professionOf(u);
 if(next!==prior){for(const id of ids){const old=skillState(u,id);if(old.enabled&&id==='dance')old.cd=old.max;old.enabled=false;}
  if(u.skillSlots){const saved=u.professionSlots?.[next];if(saved){u.skillSlots=[...saved];u.skillId=saved[0]!;for(const id of equippedSkills(u))skillState(u,id);}else equipProfileSlots(s,u);}
  else {u.skillId=initializeProfile(s).defaults[u.id]?.[next]??DEFAULT_SKILLS[next];currentSkill(u);}
 }syncPostureMaximum(u);bindSkillMirrors(u);cancelLoadout(u);
}
export function tickLoadout(s:GameState,u:Unit,dt:number):boolean{
 const action=u.loadout;if(!action||dt<=0)return false;
 if(u.life!=='active'){cancelLoadout(u);return false;}
 action.elapsed+=dt;if(action.elapsed+1e-9<action.duration)return false;
 const target=u.weapons[action.targetIndex];
 if(!target||!compatibleWeapon(u,target)||target.durability<=0){cancelLoadout(u);return false;}
 commitWeapon(s,u);return true;
}
