import {trialState,queryPrecision,acceptPrecision} from './ability-trial';
import {effectivePassiveModifiers} from './weapon-activation';
import {initializeRightPreparation,preparedMain,setPreparedSlot,mainDefinitionFor} from './right-preparation';
import type {GameState,Unit,Pos,CommandResult} from './types';
import {usesEquipment,equipmentBusy,mainWeapon} from './equipment';
import {hunterInput} from './hunter-combat';
import {cancelHunterSpecial} from './hunter-state';
import {alInput,cancelAl} from './al-combat';
import {cancelBasicAction} from './basic-runtime';
import {clearBasicInput} from './basic-chain';
import {acceptActionStamina,queryActionStamina} from './stamina';
import {areaHits} from './attack-area';
import {faceToward} from './spatial';
import {commandFocus} from './exploration-control';
import {cancelMoveOrder} from './move-order';
import {recordCombatAction,allocateRuntimeAction,recordAttackEvent,allocateRuntimeAttack,recordCombatLifecycle} from './combat-identity';
import {cancelRightSkill,rightSkillAction,type RightAbility,type RightAbilityId,type RightSkillKey,type RightSkillAction} from './right-skill-state';
export type {RightSkillKey,RightAbilityId} from './right-skill-state';
const sample=(id:RightAbilityId,name:string,profession:'hunter'|'ranger',wide:boolean,posture:number):Readonly<RightAbility>=>Object.freeze({id,name,profession,cooldown:wide?10:6,stamina:wide?24:18,damage:wide?18:20,posture,range:wide?2.2:2.1,arc:wide?Math.PI*1.5:1.6,release:wide?.18:.12,finish:wide?.5:.4,color:profession==='hunter'?'#9dcad1':'#d7b86f'});
/** All four Q/R definitions and their geometry/timing are replaceable SAMPLE, not source facts. */
export const RIGHT_ABILITIES:Readonly<Record<RightAbilityId,Readonly<RightAbility>>>=Object.freeze({
 'hunter-break':sample('hunter-break','实验·破势斩','hunter',false,25),'hunter-sweep':sample('hunter-sweep','实验·横扫','hunter',true,30),
 'al-stab':sample('al-stab','实验·快刺','ranger',false,20),'al-spin':sample('al-spin','实验·回旋击','ranger',true,30),
 'hunter-native-E':Object.freeze({id:'hunter-native-E',name:'盾冲',profession:'hunter',native:true,cooldown:8,stamina:28,damage:75,posture:0,range:0,arc:0,release:0,finish:0,color:'#9dcad1'}),
 'al-native-E':Object.freeze({id:'al-native-E',name:'火箭弹射',profession:'ranger',native:true,cooldown:6,stamina:28,damage:85,posture:0,range:0,arc:0,release:0,finish:0,color:'#d7b86f'})
});
const fail=(reason:string):CommandResult=>({ok:false,reason});
const cost=(a:RightAbility)=>a.native?'active':a.stamina===18?'rightQuick':'rightWide';
export const usesRightSkills=(s:GameState,u:Unit)=>usesEquipment(s,u)&&((u.id==='hunter'&&u.basicProfileId==='hunter-v2')||(u.id==='ranger'&&u.basicProfileId==='al-basic-v1'));
export function initializeRightSkills(s:GameState){initializeRightPreparation(s);for(const u of s.units){const r=u.equipment?.equipped.right;if(!usesRightSkills(s,u)||!r||r.skills)continue;const ids:RightAbilityId[]=u.id==='hunter'?['hunter-break','hunter-native-E','hunter-sweep']:['al-stab','al-native-E','al-spin'];r.preparedPassives=Object.freeze([...preparedMain(s,u.id)!.preparedPassives]) as import('./passive-definition').PreparedPassives;r.skills={ownerId:u.id,mainInstanceId:r.id,profession:u.id==='hunter'?'hunter':'ranger',slots:{...preparedMain(s,u.id)!.slots},instances:Object.fromEntries(ids.map(id=>[id,{id:r.id+':'+id,abilityId:id,cd:0}]))};}}
const precisionSpec=Object.freeze({...RIGHT_ABILITIES['al-stab'],name:'精准装填',cooldown:12,stamina:0,damage:0});
function isPrecision(u:Unit,key:RightSkillKey){const t=trialState(u);return t?.loadout?t.loadout.slots[key]==='precision':!!t&&u.id==='ranger'&&key==='Q';}
export function rightSkillSpec(u:Unit,key:RightSkillKey){const l=trialState(u)?.loadout;if(l){const root=l.slots[key];return root==='precision'?precisionSpec:root==='rush'?RIGHT_ABILITIES['hunter-native-E']:root==='rocket'?RIGHT_ABILITIES['al-native-E']:undefined;}if(trialState(u)){if(key==='Q'&&u.id==='ranger')return trialState(u)!.rootEnabled?precisionSpec:undefined;if(key!=='E'||!trialState(u)!.rootEnabled&&u.id==='hunter')return undefined;}const id=u.equipment?.equipped.right.skills?.slots[key];return id?RIGHT_ABILITIES[id]:undefined;}
export function rightSkillCooldown(u:Unit,key:RightSkillKey){if(isPrecision(u,key))return trialState(u)!.precisionCd;const a=rightSkillSpec(u,key);if(!a)return 0;if(a.native)return u.id==='hunter'?u.hunterCombat?.activeCooldown??0:u.alCombat?.rocketCd??0;return u.equipment?.equipped.right.skills?.instances[a.id]?.cd??0;}
/** Pure eligibility, including the shared body lock; left equipment never participates. */
export function queryRightSkill(s:GameState,u:Unit,key:RightSkillKey,aim?:Pos):CommandResult{
 if(isPrecision(u,key))return queryPrecision(s,u);
 const r=u.equipment?.equipped.right,st=r?.skills,a=rightSkillSpec(u,key);
 if(!usesRightSkills(s,u)||!r||!st||st.ownerId!==u.id||st.mainInstanceId!==r.id||r.ownerId!==u.id||r.hand!=='right'||r.weapon.shadow||r.weapon.durability<=0)return fail('当前右手技能来源不可用');
 if(!a)return fail('空槽 · 脱战时编辑技能配置');if(st.profession!==(u.id==='hunter'?'hunter':'ranger')||!st.instances[a.id]||st.instances[a.id]!.abilityId!==a.id||st.instances[a.id]!.id!==r.id+':'+a.id)return fail('右手技能实例不匹配');if(a.profession!==st.profession)return fail('技能职业不匹配');
 if(s.phase!=='battle'||u.life!=='active'||s.controlledBodyId!==u.id||u.ready>0||s.explorationControl?.aim||commandFocus(s))return fail('当前控制或生命状态不可用');
 const n=u.id==='hunter'?u.hunterCombat:u.alCombat;
 if(rightSkillAction(u)||u.offhand?.pending||u.attackPending||u.evasion?.action||u.crossing||u.forcedMotion||u.recall||u.partyTask||u.rescueTarget||u.loadout||u.stagger>0||u.statuses.some(t=>t.kind==='stun'&&t.remaining>0)||s.time<(n?.hurtUntil??0)||n?.motion||u.basicAction&&!u.basicAction.attackReady||n?.special&&!n.special.attackReady)return fail('动作尚未解锁');
 if(rightSkillCooldown(u,key)>1e-8||a.native&&u.id==='hunter'&&(u.hunterCombat?.activeCharge??1)<1)return fail('技能冷却或次数恢复中');
 if(!aim||!Number.isFinite(aim.x)||!Number.isFinite(aim.y)||Math.hypot(aim.x-u.pos.x,aim.y-u.pos.y)<1e-8)return fail('瞄准方向无效');
 return queryActionStamina(s,u,cost(a));
}
export function configureRightSkill(s:GameState,u:Unit,key:'Q'|'R',id:RightAbilityId|null):CommandResult{
 const right=u.equipment?.equipped.right,st=right?.skills;if(!usesRightSkills(s,u)||!st||!right||st.ownerId!==u.id||st.mainInstanceId!==right.id||right.ownerId!==u.id||right.hand!=='right'||right.definitionId!==mainDefinitionFor(u.id)||st.profession!==(u.id==='hunter'?'hunter':'ranger'))return fail('当前没有正式右手技能');
 if(key!=='Q'&&key!=='R')return fail('本轮 E 固定位，不能改配');
 if(s.phase!=='battle'||s.context!=='explorationIdle'||u.life!=='active'||s.controlledBodyId!==u.id||equipmentBusy(u)||s.explorationControl?.aim||commandFocus(s))return fail('仅当前主控脱战且动作结束时可配置');
 if(id!==null&&(!RIGHT_ABILITIES[id]||RIGHT_ABILITIES[id].native||RIGHT_ABILITIES[id].profession!==st.profession||!st.instances[id]))return fail('不是该右手职业的可配置技能');
 setPreparedSlot(st.slots,key,id);initializeRightPreparation(s);preparedMain(s,u.id)!.slots={...st.slots};return {ok:true};
}
export function rightSkillInput(s:GameState,u:Unit,key:RightSkillKey,aim?:Pos,held=true):CommandResult{
 // Release belongs to the actor that accepted E, even after pointer/control changes.
 if(!held&&u.id==='hunter'){const slot=u.hunterCombat?.special?.context?.slot;return (slot===({Q:0,E:1,R:2} as const)[key]||!trialState(u)?.loadout&&key==='E')?hunterInput(s,u,'active',false,aim):{ok:true};}
 if(!held)return {ok:true};if(isPrecision(u,key)){const t=trialState(u)!;t.dispatch=t.loadout?{root:'precision',key}:undefined;try{return acceptPrecision(s,u);}finally{t.dispatch=undefined;}}const check=queryRightSkill(s,u,key,aim);if(!check.ok)return check;const a=rightSkillSpec(u,key)!,r=u.equipment!.equipped.right;
 if(a.native){const t=trialState(u);if(t?.loadout)t.dispatch={root:u.id==='hunter'?'rush':'rocket',key};try{return u.id==='hunter'?hunterInput(s,u,'active',true,aim):alInput(s,u,'rocket',true,aim);}finally{if(t)t.dispatch=undefined;}}
 const pay=acceptActionStamina(s,u,cost(a));if(!pay.ok)return pay;
 cancelBasicAction(s,u,'right-skill');clearBasicInput(u,true);cancelMoveOrder(s,u,'player-skill');u.direct=undefined;u.path=[];u.destination=null;u.intent=null;u.following=false;
 if(u.hunterCombat?.special)cancelHunterSpecial(s,u,"right-skill");if(u.alCombat?.special)cancelAl(s,u,"right-skill");
 const details={executedAbilityId:a.id,requestSource:'player-input' as const,mainInstanceId:r.id,formId:r.currentForm,slot:(key==='Q'?0:2) as 0|2};
 const context=recordCombatAction(s,u,'skill',details)??allocateRuntimeAction(s,u,{executedAbilityId:a.id});Object.assign(context,details,{kind:'skill'});
 const mods=effectivePassiveModifiers(s,u),spec=Object.freeze({...a,damage:a.damage*mods.damage,posture:a.posture*mods.posture});r.skills!.instances[a.id]!.cd=a.cooldown;r.skills!.action={context,spec,weapon:Object.freeze({...mainWeapon(u),damage:spec.damage,postureDamage:spec.posture,remote:false,range:a.range,subtype:'impact'}),origin:{...u.pos},heading:Math.atan2(aim!.y-u.pos.y,aim!.x-u.pos.x),acceptedAt:s.time,released:false};
 u.heading=r.skills!.action.heading;faceToward(u,aim!);return {ok:true};
}
export function advanceRightSkills(s:GameState,u:Unit,dt:number,hit:(target:Unit,a:RightSkillAction,attack:import('./combat-identity').AttackEvent)=>void){
 if(!usesRightSkills(s,u))return;const st=u.equipment?.equipped.right.skills;if(!st)return;
 const a=st.action;if(u.life!=='active'){cancelRightSkill(s,u,'death');return;}
 if(a&&(a.context.generation!==s.combatIdentity?.generation||s.controlledBodyId!==u.id||u.stagger>0||u.forcedMotion||u.statuses.some(t=>t.kind==='stun'&&t.remaining>0)))cancelRightSkill(s,u,'interrupted');
 for(const x of Object.values(st.instances))if(x&&!RIGHT_ABILITIES[x.abilityId].native)x.cd=Math.max(0,x.cd-dt);
 if(!a||st.action!==a)return;const elapsed=s.time-a.acceptedAt;
 if(!a.released&&elapsed+1e-9>=a.spec.release){a.released=true;const attack=recordAttackEvent(s,a.context)??allocateRuntimeAttack(s,a.context,s.time);Object.assign(attack,{mainInstanceId:a.context.mainInstanceId,formId:a.context.formId});
  const area={kind:'sector' as const,origin:a.origin,heading:a.heading,range:a.spec.range,arc:a.spec.arc};for(const target of s.units)if(target.team==='enemy'&&target.life==='active'&&areaHits(s,area,target))hit(target,a,attack);
  s.effects.push({id:s.nextId++,sourceId:u.id,kind:'burst',from:{...a.origin},to:{x:a.origin.x+Math.cos(a.heading)*a.spec.range,y:a.origin.y+Math.sin(a.heading)*a.spec.range},remaining:.22,color:a.spec.color});
 }
 if(elapsed+1e-9>=a.spec.finish){recordCombatLifecycle(s,a.context,'action-finished','right-skill-finish');st.action=undefined;}
}
