import {canPay,payVitality} from './economy';
import {DEFAULT_SKILLS,SKILL_CATALOG,professionOf,resolveSkill,skillInfo} from './skill-catalog';
import type {CommandResult,GameState,Profession,SkillCap,SkillId,SkillProfile,SkillState,Unit,Weapon} from './types';

const caps=(preset:'starter'|'expanded'):Record<SkillId,SkillCap>=>Object.fromEntries(Object.values(SKILL_CATALOG).map(d=>[d.id,{stage:Math.min(d.stages.length,preset==='starter'?1:2),branches:Object.fromEntries(d.branches.map((b,i)=>[b.id,preset==='starter'?(i===2?0:1):b.levels.length]))}])) as Record<SkillId,SkillCap>;
export function initializeProfile(s:GameState):SkillProfile{return s.profile??=( {defaults:{},unlockCaps:caps('expanded'),preset:'expanded'} );}
export function setUnlockPreset(s:GameState,preset:'starter'|'expanded'):void{const p=initializeProfile(s);p.preset=preset;p.unlockCaps=caps(preset);}
function makeWeapons(u:Unit):void{
 const profession:Profession=u.role==='fiorre'?'healer':u.role==='ines'?'shieldguard':u.role==='guard'?'guard':u.role==='ranger'?'ranger':'hunter';
 for(const w of u.weapons){w.profession??=profession;if(u.role==='fiorre'&&w.profession==='healer'&&!w.shadow)w.weight=3;}
 if(u.role!=='fiorre'||u.weapons.some(w=>w.profession==='cantor'))return;
 const w:Weapon={...u.weapons[0],profession:'cantor',name:'霜镜长杖',range:5,width:0,remote:true,damage:30,attackPeriod:1.4,damageKind:'arcane',subtype:'frost',class:'focus',weight:3,durability:60,maxDurability:60,shadow:false};
 u.weapons.push(w,{...w,name:'影·霜镜长杖',shadow:true,damage:20,weight:1,durability:1,maxDurability:1});
 const scythe:Weapon={...w,profession:'scythe',name:'永夜长镰',range:1.8,remote:false,damage:35,attackPeriod:1.1,damageKind:'physical',subtype:'slash',class:'blade',weight:3};
 u.weapons.push(scythe,{...scythe,name:'影·永夜长镰',shadow:true,damage:23,weight:1,durability:1,maxDurability:1});u.compatibleClasses=['focus','blade'];u.capacity=14;

}
function newState(u:Unit,id:SkillId):SkillState{const d=SKILL_CATALOG[id];return {stage:0,branches:{},counter:0,cd:d.cooldown,max:d.cooldown,time:0,pulse:0,enabled:id==='poison'};}
export function currentSkill(u:Unit):SkillState{
 const id=skillInfo(u).id;u.skillId=id;u.skillStates??={};return u.skillStates[id]??=(newState(u,id));
}
export function bindSkillMirrors(u:Unit):void{
 for(const [legacy,key] of [['skillCd','cd'],['skillMax','max'],['skillTime','time'],['skillPulse','pulse']] as const)Object.defineProperty(u,legacy,{configurable:true,enumerable:true,get(){return currentSkill(u)[key];},set(v:number){currentSkill(u)[key]=v;}});
 for(const legacy of ['sniperMode','autoSkill'] as const)Object.defineProperty(u,legacy,{configurable:true,enumerable:true,get(){return currentSkill(u).enabled;},set(v:boolean){currentSkill(u).enabled=!!v;}});
}
export function initializeSkills(u:Unit,profile?:SkillProfile):void{
 if(u.team!=='ally')return;
 const legacy={cd:u.skillCd,max:u.skillMax,time:u.skillTime,pulse:u.skillPulse??0,enabled:u.role==='guard'?u.autoSkill??true:u.sniperMode??false};
 const existed=!!u.skillStates;
 makeWeapons(u);u.skillId??=profile?.defaults[u.id]?.[professionOf(u)]??DEFAULT_SKILLS[professionOf(u)];
 const st=currentSkill(u);
 if(!existed){st.cd=skillInfo(u).cooldown>0?legacy.cd:0;st.time=legacy.time;st.pulse=legacy.pulse;st.enabled=legacy.enabled;}
 if(u.cloneOf)u.loadout=undefined;
 bindSkillMirrors(u);
}
export function resetNodeSkills(u:Unit):void{
 initializeSkills(u);for(const [id,st] of Object.entries(u.skillStates??{})){const d=SKILL_CATALOG[id as SkillId];if(!d)continue;const pseudo={...u,skillId:id as SkillId,weapons:[{...u.weapons[u.weaponIndex],profession:d.profession}],weaponIndex:0};st.max=resolveSkill(pseudo).cooldown;st.cd=st.max;st.counter=0;st.readyAt=undefined;st.targetClocks=undefined;st.run=undefined;st.time=0;st.pulse=0;st.snapshot=undefined;st.enabled=id==='poison';}u.loadout=undefined;bindSkillMirrors(u);
}
export function resetExpeditionSkills(s:GameState):void{initializeProfile(s);for(const u of s.units.filter(a=>a.team==='ally'&&!a.cloneOf)){u.skillStates={};u.skillId=s.profile!.defaults[u.id]?.[professionOf(u)]??DEFAULT_SKILLS[professionOf(u)];currentSkill(u);resetNodeSkills(u);}s.units=s.units.filter(u=>!u.cloneOf);}
export function canConfigure(s:GameState):boolean{return s.phase==='account'||s.phase==='briefing'||s.phase==='nodes'||s.phase==='battle'&&s.context==='explorationIdle';}
export function buyUpgrade(s:GameState,u:Unit,kind:'stage'|'branch',branch:string|undefined,expectedLevel:number):CommandResult{
 if(u.team!=='ally'||u.cloneOf)return {ok:false,reason:'复制体和敌人不能独立培养'};
 if(!['briefing','battle','nodes'].includes(s.phase))return {ok:false,reason:'当前流程不能培养'};
 if(!Number.isInteger(expectedLevel)||expectedLevel<0)return {ok:false,reason:'购买等级无效'};
 initializeSkills(u,s.profile);const p=initializeProfile(s),d=skillInfo(u),st=currentSkill(u),cap=p.unlockCaps[d.id];
 const b=kind==='branch'?d.branches.find(a=>a.id===branch):undefined;
 if(kind!=='stage'&&kind!=='branch'||kind==='branch'&&!b)return {ok:false,reason:'该培养项目不存在'};
 const level=kind==='stage'?st.stage:st.branches[b!.id]??0;
 if(level!==expectedLevel)return {ok:false,reason:'培养等级已变化，请查看新价格'};
 const limit=kind==='stage'?cap?.stage??0:cap?.branches[b!.id]??0;
 const levels=kind==='stage'?d.stages:b!.levels,next=levels[level];
 if(!next)return {ok:false,reason:'已达到本轮最高等级'};
 if(level>=limit)return {ok:false,reason:'局外未解锁下一级'};
 if(kind==='branch'&&level===0&&Object.values(st.branches).filter(v=>v>0).length>=2)return {ok:false,reason:'两个分支已锁定，不能改选第三个'};
 if(!canPay(s,next.cost))return {ok:false,reason:'随身生命力不足'};
 const fraction=st.max>0?Math.min(1,Math.max(0,st.cd/st.max)):0;
 if(kind==='stage')st.stage++;else st.branches[b!.id]=level+1;
 payVitality(s,next.cost,'upgrade');st.max=resolveSkill(u).cooldown;st.cd=st.max*fraction;
 return {ok:true};
}
export function configureSkill(s:GameState,u:Unit,id:SkillId):CommandResult{
 if(u.team!=='ally'||u.cloneOf)return {ok:false,reason:'复制体不能配置技能'};
 if(!canConfigure(s))return {ok:false,reason:'战斗中不能更换同职业技能'};
 const d=SKILL_CATALOG[id];if(!d||d.profession!==professionOf(u))return {ok:false,reason:'技能不属于当前职业'};
 if(u.loadout||u.crossing||u.recall||u.rescueTarget)return {ok:false,reason:'当前动作未结束'};
 initializeSkills(u,s.profile);const p=initializeProfile(s),old=currentSkill(u);
 if(u.skillId!==id){if(old.time>0)old.cd=old.max;old.run=undefined;old.time=0;old.pulse=0;old.snapshot=undefined;old.enabled=false;}
 (p.defaults[u.id]??={})[d.profession]=id;u.skillId=id;currentSkill(u);bindSkillMirrors(u);return {ok:true};
}
