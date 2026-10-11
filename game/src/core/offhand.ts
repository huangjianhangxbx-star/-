import {rightSkillAction} from './right-skill-state';
import type {CommandResult,GameState,Pos,Unit,Weapon} from './types';
import {initializeEquipment,queryEquipmentAbility,equipmentBusy,wearOffhand,wearToken,mainWeapon,type OffhandInstance} from './equipment';
import {hunterInput} from './hunter-combat';
import {alInput} from './al-combat';
import {queryActionStamina,acceptActionStamina} from './stamina';
import {terrainFits,segmentClear,distance} from './spatial';
import {areaHits} from './attack-area';
import {recordCombatAction,recordCombatLifecycle,recordAttackEvent,allocateRuntimeAction,allocateRuntimeAttack,type ActionContext,type AttackEvent} from './combat-identity';
export const BOMB_SAMPLE=Object.freeze({damage:45,posture:25,stamina:20,cooldown:5,range:4.5,releaseDelay:.05,flight:.45,radius:1.25});
export type BombEntity={id:number;instanceId:string;sourceId:string;context:ActionContext;attack:AttackEvent;weapon:Weapon;from:Pos;to:Pos;elapsed:number;releasedAt:number;hit:string[]};
export type OffhandState={held:boolean;pending?:{instance:OffhandInstance;token:number;context:ActionContext;target:Pos;origin:Pos;weapon:Weapon;elapsed:number};entities:BombEntity[]};
const fail=(reason:string):CommandResult=>({ok:false,reason});
export function queryOffhandAction(s:GameState,u:Unit,aim?:Pos):CommandResult{
 if(rightSkillAction(u))return fail('右手技能动作尚未结束');const item=u.equipment?.equipped.left;if(!item)return fail('未装备副手');const ability=queryEquipmentAbility(s,u,item.action);if(!ability.ok)return ability;
 if(s.controlledBodyId!==u.id||u.life!=='active'||s.phase!=='battle'||u.ready>0||u.stagger>0||u.statuses.some(x=>x.kind==='stun'&&x.remaining>0)||s.explorationControl?.aim||s.explorationControl?.commandFocusId)return fail('当前不能使用副手动作');
 if(item.action!=='bomb'){
 const h=item.action==='guard'?u.hunterCombat:u.alCombat;
 if(u.offhand?.pending||u.forcedMotion||h?.motion||u.basicAction&&!u.basicAction.attackReady||h?.special&&!h.special.attackReady||s.time<(h?.hurtUntil??0))return fail('动作尚未解锁');
 if(item.action==='guard'&&(u.hunterCombat?.frost??3)<1)return fail('霜寒不足');
 if(item.action==='shot'&&(u.alCombat?.ammo??4)<1)return fail('资源恢复中');return queryActionStamina(s,u,item.action);
 }
 if(equipmentBusy(u)||s.time<(u.hunterCombat?.hurtUntil??0)||s.time<(u.alCombat?.hurtUntil??0))return fail('动作尚未结束');
 if(item.cd>1e-8)return fail(`炸弹冷却 ${item.cd.toFixed(1)}s`);
 if(!aim||!Number.isFinite(aim.x)||!Number.isFinite(aim.y)||!terrainFits(s,aim,.08))return fail('落点不可用');
 if(distance(u.pos,aim)>BOMB_SAMPLE.range+1e-8)return fail('超出投弹距离（4.5）');
 if(!segmentClear(s,u.pos,aim,false,false,.08))return fail('投弹路径被障碍阻挡');return queryActionStamina(s,u,'bomb');
}
/** Single physical down chooses the equipped action. Held repeats never retry bombs. */
export function acceptOffhandAction(s:GameState,u:Unit,held=true,aim?:Pos):CommandResult{
 initializeEquipment(s);if(held&&rightSkillAction(u))return fail('右手技能动作尚未结束');const item=u.equipment?.equipped.left;if(!item)return fail('未装备副手');
 const st=u.offhand??={held:false,entities:[]};
 if(!held){st.held=false;if(item.action==='guard')return hunterInput(s,u,'guard',false,aim);if(item.action==='shot')return alInput(s,u,'shot',false,aim);return {ok:true};}
 if(st.held)return {ok:true};st.held=true;
 const check=queryOffhandAction(s,u,aim);if(!check.ok)return check;
 if(item.action==='guard')return hunterInput(s,u,'guard',true,aim);if(item.action==='shot')return alInput(s,u,'shot',true,aim);
 const cost=acceptActionStamina(s,u,'bomb');if(!cost.ok)return cost;
 const context=recordCombatAction(s,u,'skill',{executedAbilityId:'offhand-bomb',requestSource:'player-input',offhandInstanceId:item.id})??allocateRuntimeAction(s,u,{executedAbilityId:'offhand-bomb'});
 context.kind='skill';context.requestSource='player-input';context.offhandInstanceId=item.id;
 item.cd=BOMB_SAMPLE.cooldown;st.pending={instance:item,token:wearToken(u),context,target:{...aim!},origin:{...u.pos},weapon:{...mainWeapon(u),remote:false,damage:BOMB_SAMPLE.damage,postureDamage:BOMB_SAMPLE.posture,subtype:'impact'},elapsed:0};return {ok:true};
}
export function cancelOffhand(s:GameState,u:Unit,reason:string,entities=false){const st=u.offhand;if(!st)return;recordCombatLifecycle(s,st.pending?.context,'action-cancelled',reason);st.pending=undefined;st.held=false;if(entities){for(const e of st.entities)recordCombatLifecycle(s,e.context,'action-cancelled',reason);st.entities=[];}}
export function pauseOffhands(s:GameState){for(const u of s.units)cancelOffhand(s,u,'pause');}
/** Shared Release only; each caller retains its own qualification and payment authority. */
export function releaseBombEntity(s:GameState,u:Unit,data:Pick<BombEntity,'instanceId'|'context'|'weapon'|'from'|'to'>){
 if(!segmentClear(s,data.from,data.to,false,false,.08))return undefined;
 const id=s.nextId++,attack=recordAttackEvent(s,data.context,{entityId:id})??allocateRuntimeAttack(s,data.context,s.time,{entityId:id});
 const entity:BombEntity={...data,from:{...data.from},to:{...data.to},id,sourceId:u.id,attack,elapsed:0,releasedAt:s.time,hit:[]};
 (u.offhand??={held:false,entities:[]}).entities.push(entity);return entity;
}
export function advanceOffhand(s:GameState,u:Unit,dt:number,hit:(target:Unit,e:BombEntity)=>void){
 const st=u.offhand;if(u.life!=='active'){cancelOffhand(s,u,'death',true);return;}
 if(u.equipment&&s.controlledBodyId===u.id)for(const item of u.equipment.owned)item.cd=Math.max(0,item.cd-dt);
 if(!st)return;
 if(st.pending){const p=st.pending;if(u.stagger>0||u.forcedMotion||u.statuses.some(x=>x.kind==='stun'&&x.remaining>0)||s.controlledBodyId!==u.id){cancelOffhand(s,u,'interrupted');}else{
 p.elapsed+=dt;if(p.elapsed+1e-9>=BOMB_SAMPLE.releaseDelay){st.pending=undefined;
 if(!segmentClear(s,p.origin,p.target,false,false,.08)){recordCombatLifecycle(s,p.context,'action-cancelled','release-obstructed');}else{wearOffhand(u,p.instance,p.token);releaseBombEntity(s,u,{instanceId:p.instance.id,context:p.context,weapon:p.weapon,from:p.origin,to:p.target});}
 }} }
 for(const e of [...st.entities]){e.elapsed=s.time-e.releasedAt;if(e.elapsed+1e-9<BOMB_SAMPLE.flight)continue;
 if(segmentClear(s,e.from,e.to,false,false,.08))for(const target of s.units)if(target.team==='enemy'&&target.life==='active'&&!e.hit.includes(target.id)&&areaHits(s,{kind:'circle',center:e.to,radius:BOMB_SAMPLE.radius},target)){e.hit.push(target.id);hit(target,e);}
 s.effects.push({id:s.nextId++,kind:'bombExplosion',from:{...e.to},to:{...e.to},color:'#d7a366',remaining:.3,sourceId:u.id,amount:BOMB_SAMPLE.radius});recordCombatLifecycle(s,e.context,'action-finished','bomb-exploded');st.entities=st.entities.filter(x=>x!==e);
 }
}
