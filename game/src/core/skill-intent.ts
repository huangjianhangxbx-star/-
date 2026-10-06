import type {CommandResult,GameState,Pos,SkillId,Unit} from './types';
import {aimActor,beginExplorationAim,cancelExplorationAim,commandFocus,directActor} from './exploration-control';
import {foregroundSkill,skillInSlot} from './skill-slots';
import {professionOf,resolveSkill,SKILL_CATALOG} from './skill-catalog';
import {positionVisible} from './visibility';
import {clearShot,distance,inWeaponRange} from './spatial';

export type SkillTarget={kind:'self'}|{kind:'direction';direction:Pos}|{kind:'point';point:Pos}|{kind:'unit';unitId:string};
export type InputStyle='instant'|'aimConfirm'|'selfToggle'|'auto'|'holdRelease';
export type SkillInputDefinition={target:'self'|'direction'|'point'|'unit';direct:InputStyle;command:InputStyle;description:string};
/** No production skill acquires a new target contract in XC09. */
export function skillInput(id:SkillId):SkillInputDefinition {
 const auto=id==='rain'||id==='reap';
 return {target:'self',direct:auto?'auto':['snipe','poison'].includes(id)?'selfToggle':'instant',command:auto?'auto':'aimConfirm',description:id==='hunt'?'沿现有索敌自动射击':id==='dance'?'自动进入；确认退出':auto?'自动发动':['snipe','poison'].includes(id)?'确认切换自身模式':'自身范围 · 左键确认'};
}
export type SkillAimPayload={sessionId:number;slot:0|1|2;skillId:SkillId;profession:ReturnType<typeof professionOf>;target?:SkillTarget};
export type SkillPreview=CommandResult&{invalid?:boolean;actorId?:string;skillId?:SkillId;center?:Pos;range?:number;counter?:number;target?:SkillTarget;description?:string;unitIds?:string[]};
const fail=(reason:string,invalid=false):SkillPreview=>({ok:false,reason,invalid});
export function querySkillIntent(s:GameState,u:Unit,slot:number):SkillPreview {
 const id=skillInSlot(u,slot);if(!id)return fail('技能槽为空',true);
 if(SKILL_CATALOG[id].profession!==professionOf(u))return fail('技能职业不符',true);
 if(u.life!=='active'||u.shadowResident)return fail('角色当前不在场',true);
 const st=u.skillStates?.[id],r=resolveSkill(u,undefined,id),metadata=skillInput(id);
 const result:SkillPreview={ok:true,actorId:u.id,skillId:id,center:{...u.pos},range:r.range,counter:st?.counter||0,description:metadata.description};
 if(metadata.direct==='auto')return {...result,ok:false,reason:'此技能自动发动，无需手动施放'};
 if(id==='dance'&&!st?.enabled)return {...result,ok:false,reason:'镰舞自动充能中'};
 if(u.stagger>0||u.statuses.some(st=>st.kind==='stun'&&st.remaining>0)||u.evasion?.action||u.crossing||u.forcedMotion||u.skillLanding||u.loadout||u.recall||u.partyTask||u.rescueTarget)return {...result,ok:false,reason:'动作结束后可确认'};
 if(!['toggle','chargedMode'].includes(r.kind)&&foregroundSkill(u)||u.attackPending)return {...result,ok:false,reason:'动作结束后可确认'};
 if(id==='pain')return {...result,ok:(st?.counter||0)>0,reason:(st?.counter||0)>0?undefined:'没有痛印可释放'};
 if(['snipe','poison'].includes(id))return {...result,description:st?.enabled?'确认关闭自身模式':'确认开启自身模式'};
 if(id!=='dance'&&((st?.cd||0)>0||(st?.time||0)>0||u.ready>0))return {...result,ok:false,reason:'技能尚未就绪'};
 return result;
}
/** Target validation is shared with controlled framework definitions, never a fake cast. */
export function querySkillTarget(s:GameState,u:Unit,definition:SkillInputDefinition,range:number,target:SkillTarget):CommandResult {
 if(target.kind!==definition.target)return {ok:false,reason:'目标类型不符'};
 if(target.kind==='self')return {ok:true};
 if(target.kind==='direction'){const p=target.direction;return Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.hypot(p.x,p.y)>1e-7?{ok:true}:{ok:false,reason:'需要有效方向'};}
 const unit=target.kind==='unit'?s.units.find(a=>a.id===target.unitId):undefined;
 const p=target.kind==='point'?target.point:unit?.pos;
 if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||target.kind==='unit'&&(!unit||unit.life!=='active'||unit.shadowResident)||!positionVisible(s,p))return {ok:false,reason:'目标失效或不可见'};
 return distance(u.pos,p)<=range+1e-7&&clearShot(s,u.pos,p)?{ok:true}:{ok:false,reason:'目标超出范围或视线受阻'};
}
export function uniqueSkillUnitCandidate(s:GameState,u:Unit,definition:SkillInputDefinition,range:number):SkillTarget|undefined {
 const legal=s.units.filter(a=>a.team!==u.team&&querySkillTarget(s,u,definition,range,{kind:'unit',unitId:a.id}).ok);
 return legal.length===1?{kind:'unit',unitId:legal[0].id}:undefined;
}
/** Called only for a real pointer intent; a camera update is not a new target. */
export function pointerSkillTarget(s:GameState,u:Unit,definition:SkillInputDefinition,range:number,worldPoint:Pos,unitId?:string):SkillTarget|undefined {
 if(definition.target==='self')return {kind:'self'};
 if(definition.target==='point')return {kind:'point',point:{...worldPoint}};
 if(definition.target==='direction'){const x=worldPoint.x-u.pos.x,y=worldPoint.y-u.pos.y,length=Math.hypot(x,y);return length>1e-7?{kind:'direction',direction:{x:x/length,y:y/length}}:undefined;}
 return unitId?{kind:'unit',unitId}:uniqueSkillUnitCandidate(s,u,definition,range);
}
export function beginSkillAim(s:GameState,actorId:string,slot:0|1|2,source:'command'|'direct'):CommandResult {
 const u=source==='direct'?directActor(s):null;
 if(!u||u.id!==actorId)return fail('技能角色与控制身份不符');
 const q=querySkillIntent(s,u,slot);if(q.invalid||q.skillId&&skillInput(q.skillId).command==='auto'||q.skillId==='dance'&&!u.skillStates?.dance?.enabled)return q;
 if(!q.skillId)return q;
 const r=beginExplorationAim(s,actorId,'skill',source);if(!r.ok)return r;
 const definition=skillInput(q.skillId);
 s.explorationControl!.aim!.skill={sessionId:s.nextId++,slot,skillId:q.skillId,profession:professionOf(u),target:definition.target==='self'?{kind:'self'}:definition.target==='unit'?uniqueSkillUnitCandidate(s,u,definition,q.range||0):undefined};
 return {ok:true};
}
export function querySkillAimPreview(s:GameState):SkillPreview {
 const aim=s.explorationControl?.aim,p=aim?.skill,u=aimActor(s);
 if(aim?.kind!=='skill'||!p||!u)return fail('技能会话或角色失效',true);
 if(skillInSlot(u,p.slot)!==p.skillId||professionOf(u)!==p.profession)return fail('技能槽或职业已改变，请重新准备',true);
 const q=querySkillIntent(s,u,p.slot),r=querySkillTarget(s,u,skillInput(p.skillId),q.range||0,p.target||{kind:'direction',direction:{x:0,y:0}});
 const unitIds=q.center?s.units.filter(a=>(['bell','hunt'].includes(p.skillId)?a.team!==u.team:a.team===u.team)&&a.life==='active'&&!a.shadowResident&&positionVisible(s,a.pos)&&inWeaponRange(s,u,a.pos,{range:q.range||0,remote:true})).map(a=>a.id):[];
 return {...q,target:p.target?structuredClone(p.target):undefined,unitIds,...(!r.ok?{ok:false,reason:r.reason}:{})};
}
export function validateSkillConfirmation(s:GameState,sessionId:number):SkillPreview {
 const q=querySkillAimPreview(s);
 if(s.explorationControl?.aim?.skill?.sessionId!==sessionId)return fail('技能会话已替换或已消费');
 if(q.invalid)cancelExplorationAim(s);return q;
}

export function updateSkillAimPointer(s:GameState,worldPoint:Pos,unitId?:string):void {
 const aim=s.explorationControl?.aim,u=aimActor(s),p=aim?.skill;if(aim?.kind!=='skill'||!p||!u)return;
 const definition=skillInput(p.skillId);if(definition.target==='self')return;
 p.target=pointerSkillTarget(s,u,definition,resolveSkill(u,undefined,p.skillId).range,worldPoint,unitId);
}
