import {teamModel} from './inventory-world';
import {containerItems,itemFits,queryInventoryMove,moveInventoryItem,changeInventoryItems} from './inventory-model';
import type {CommandResult,GameState,Unit,Pos} from './types';
import {farmItem,inventoryQuantity,queryClearCompanionFreeItem,type InventoryVisit,type WorldInventory} from './world-inventory';
import {clearShot,distance,surface,terrainFits,segmentClear} from './spatial';
import {BOMB_SAMPLE,releaseBombEntity} from './offhand';
import {mainWeapon} from './equipment';
import {recordCombatAction,allocateRuntimeAction} from './combat-identity';
import {positionVisible} from './visibility';
import {encounterEngaged} from './encounter-domain';
import {tacticalAutonomyAllowed} from './exploration-control';
import {foregroundSkill} from './skill-slots';
import {visibleEnemyHazards} from './enemy-observation';
import {areaHits} from './attack-area';

export const AL_ITEM_SAMPLE=Object.freeze({capacity:5,interval:.2,reach:3,hpRatio:.65,power:4,duration:5});
export type AlReserve={nextBombAt?:number;slots:({itemId:string;quantity:number}|null)[];revision:number;useSerial:number;nextDecision:number;uses:{id:string;itemId:string;targetId:string;at:number}[]};
export type AlItemRequest=InventoryVisit&{ownerId:'ranger';source:'team'|'reserve';itemId:string;amount:1;expectedRevision:number};
export type AlUseRequest=InventoryVisit&{ownerId:'ranger';itemId:string;targetId:string;expectedRevision:number;useSerial:number;prioritySource:'preferred'|'reserve';aim?:Pos};
const reject=(reason:string):CommandResult=>({ok:false,reason});
export function createAlReserve():AlReserve{return {slots:Array(5).fill(null),revision:0,useSerial:0,nextDecision:0,uses:[]};}
function validReserve(r:AlReserve|undefined){return !!r&&Array.isArray(r.slots)&&r.slots.length===AL_ITEM_SAMPLE.capacity&&Number.isSafeInteger(r.revision)&&r.revision>=0&&r.revision<Number.MAX_SAFE_INTEGER&&Number.isSafeInteger(r.useSerial)&&r.useSerial>=0&&r.useSerial<Number.MAX_SAFE_INTEGER&&Number.isFinite(r.nextDecision)&&r.slots.every(x=>x===null||!!farmItem(x.itemId)&&Number.isSafeInteger(x.quantity)&&x.quantity>0);}
export function alQuantity(b:WorldInventory|undefined,id:string|null|undefined){if(!validReserve(b?.alReserve)||!farmItem(id)||b?.inventory&&containerItems(b.inventory,'reserve').some(i=>!itemFits(b.inventory!,i)))return 0;return b!.alReserve.slots.filter(x=>x?.itemId===id).reduce((n,x)=>n+x!.quantity,0);}
function checkRequest(s:GameState,r:AlItemRequest){const q=queryClearCompanionFreeItem(s,r);if(!q.ok)return q;const b=s.world!.backpack!;
 if(!validReserve(b.alReserve)||r.expectedRevision!==b.alReserve.revision)return reject('后备库存已变化，请重新操作');
 if(r.amount!==1||!farmItem(r.itemId)||!['team','reserve'].includes(r.source))return reject('仅支持团队与芙蕾茜娅后备间转交1件；礼物及模型交互尚未接入');return {ok:true};
}
export function queryTransferAlItem(s:GameState,r:AlItemRequest):CommandResult{
 const q=checkRequest(s,r);if(!q.ok)return q;const m=teamModel(s.world!.backpack!);if(!m)return reject('库存迁移失败');const item=containerItems(m,r.source==='team'?'team':'reserve').find(i=>i.definitionId===r.itemId&&!i.weapon);if(!item)return reject('源库存不足');return queryInventoryMove(m,{id:item.id,to:r.source==='team'?'reserve':'team',quantity:1});
}
export function transferAlItem(s:GameState,r:AlItemRequest,prefer=false):CommandResult{
 const q=queryTransferAlItem(s,r);if(!q.ok)return q;const b=s.world!.backpack!,m=b.inventory!,item=containerItems(m,r.source==='team'?'team':'reserve').find(i=>i.definitionId===r.itemId&&!i.weapon)!;const moved=moveInventoryItem(m,{id:item.id,to:r.source==='team'?'reserve':'team',quantity:1});if(!moved.ok)return moved;if(prefer)b.companionFreeItem.itemId=r.itemId;s.notice=`${farmItem(r.itemId)!.name} ${r.source==='team'?'交给芙蕾茜娅':'收回团队'} ×1${prefer?' · 优先考虑':''}`;return {ok:true};
}
export function queryAlPriority(s:GameState,r:AlItemRequest):CommandResult{const q=checkRequest(s,r);if(!q.ok)return q;return r.source==='reserve'&&alQuantity(s.world!.backpack,r.itemId)>0?{ok:true}:reject('先交付道具，芙蕾茜娅才可优先考虑');}
export function setAlPriority(s:GameState,r:AlItemRequest):CommandResult{const q=queryAlPriority(s,r);if(!q.ok)return q;const b=s.world!.backpack!;b.companionFreeItem.itemId=r.itemId;b.alReserve.revision++;s.notice='芙蕾茜娅优先考虑 '+farmItem(r.itemId)!.name;return {ok:true};}
function locked(s:GameState,a:Unit){const c=a.alCombat;return a.life!=='active'||a.hp<=0||a.cloneOf||a.shadowResident||a.ready>0||a.stagger>0||a.posture<=0||a.forcedMotion||a.crossing||a.skillLanding||a.direct||a.attackPending||a.attackIntent||a.basicAction||a.evasion?.action||a.loadout||a.recall||a.partyTask||a.rescueTarget||c?.special||c?.motion||c?.shotHeld||s.time<(c?.hurtUntil??0)||s.time<(c?.finalRecoveryUntil??0)||foregroundSkill(a)||Object.values(a.skillStates||{}).some(st=>st.run)||a.offhand?.pending||a.statuses.some(st=>st.kind==='stun'&&st.remaining>0);}
/** Read-only eligibility; no lazy constructors, clocks, random choices, pathing or stock repair. */
export function queryAlItemCandidates(s:GameState):{candidates:AlUseRequest[];reason:string}{
 const w=s.world,b=w?.backpack,a=s.units.find(u=>u.id==='ranger');const none=(reason:string)=>({candidates:[],reason});
 if(!w||!b||!a||!queryClearCompanionFreeItem(s,{worldId:w.id,visit:w.visit.generation,ownerId:'ranger'}).ok||!validReserve(b.alReserve))return none('条件不符');
 if(!['explorationIdle','explorationBattle'].includes(s.context??''))return none('条件不符 · 非探索状态');
 if(s.controlledBodyId==='ranger')return none('实控芙蕾茜娅 · 等待托管');
 if(locked(s,a)||!tacticalAutonomyAllowed(s,a))return none('等待时机');
 const threatened=visibleEnemyHazards(s,a).some(h=>areaHits(s,h.area,a))||s.units.some(e=>e.team==='enemy'&&e.life==='active'&&e.attackIntent&&e.attackIntent.resolveAt>=s.time&&areaHits(s,e.attackIntent.area,a));
 if(threatened)return none('先避险');
 const medicine=alQuantity(b,'sample-al-regen'),bomb=alQuantity(b,'sample-al-bomb');
 if(!medicine&&!bomb)return none(b.companionFreeItem.itemId?'未持有或耗尽 · 请交付':'芙蕾茜娅后备无可用道具');
 const targets=s.units.filter(u=>['hunter','ranger'].includes(u.id)&&u.team==='ally'&&u.life==='active'&&u.hp>0&&!u.shadowResident&&!u.cloneOf&&u.hp/u.maxHp<=AL_ITEM_SAMPLE.hpRatio&&surface(s,u.pos)?.layer===surface(s,a.pos)?.layer&&terrainFits(s,a.pos,.18)&&distance(a.pos,u.pos)<=AL_ITEM_SAMPLE.reach&&clearShot(s,a.pos,u.pos)&&!u.statuses.some(st=>st.kind==='regen'&&st.remaining>0)).sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp||x.id.localeCompare(y.id));
 const candidates:AlUseRequest[]=medicine?targets.map(u=>({worldId:w.id,visit:w.visit.generation,ownerId:'ranger',itemId:'sample-al-regen',targetId:u.id,expectedRevision:b.alReserve.revision,useSerial:b.alReserve.useSerial+1,prioritySource:b.companionFreeItem.itemId==='sample-al-regen'?'preferred':'reserve'})):[];
 // Two concrete consumers only. Legal healing always precedes offensive preference.
 if(bomb&&Number.isFinite(b.alReserve.nextBombAt??0)&&s.time>=(b.alReserve.nextBombAt??0)){
  const enemies=s.units.filter(e=>e.team==='enemy'&&e.life==='active'&&e.hp>0&&e.enemyMotion!=='return'&&(!e.enemyV2||encounterEngaged(s,e))&&positionVisible(s,e.pos)&&surface(s,e.pos)?.layer===surface(s,a.pos)?.layer);
  const preferred=b.companionFreeItem.itemId==='sample-al-bomb';
  for(const e of enemies.sort((x,y)=>x.id.localeCompare(y.id))){if(distance(a.pos,e.pos)>BOMB_SAMPLE.range||!terrainFits(s,e.pos,.08)||!clearShot(s,a.pos,e.pos)||!segmentClear(s,a.pos,e.pos,false,false,.08))continue;
   const count=enemies.filter(t=>areaHits(s,{kind:'circle',center:e.pos,radius:BOMB_SAMPLE.radius},t)).length;if(count<(preferred?1:2))continue;
   candidates.push({worldId:w.id,visit:w.visit.generation,ownerId:'ranger',itemId:'sample-al-bomb',targetId:e.id,aim:{...e.pos},expectedRevision:b.alReserve.revision,useSerial:b.alReserve.useSerial+1,prioritySource:preferred?'preferred':'reserve'});
  }
 }
 return {reason:candidates[0]?.itemId==='sample-al-regen'?'先治疗 · 可考虑缓回药':candidates.length?'可考虑实验投弹':bomb?'等待安全敌群/距离/投弹间隔':'条件不符 · 无需治疗或距离/视线受限',candidates};
}
export function acceptAlItemUse(s:GameState,r:AlUseRequest):CommandResult{
 const candidates=queryAlItemCandidates(s).candidates;
 const match=candidates.find(c=>c.worldId===r.worldId&&c.visit===r.visit&&c.ownerId===r.ownerId&&c.itemId===r.itemId&&c.targetId===r.targetId&&c.expectedRevision===r.expectedRevision&&c.useSerial===r.useSerial&&c.prioritySource===r.prioritySource&&c.aim?.x===r.aim?.x&&c.aim?.y===r.aim?.y);if(!match||match.itemId==='sample-al-bomb'&&candidates[0]?.itemId==='sample-al-regen')return reject('道具请求已失效或当前应先治疗');
 const b=s.world!.backpack!,a=b.alReserve,i=a.slots.findIndex(x=>x?.itemId===r.itemId),u=s.units.find(u=>u.id===r.targetId)!,id=`al-item:${r.worldId}:${r.visit}:${r.useSerial}`;
 if(r.itemId==='sample-al-bomb'){
  const actor=s.units.find(x=>x.id==='ranger')!,context=recordCombatAction(s,actor,'skill',{executedAbilityId:'al-item-bomb',requestSource:'companion-ai'})??allocateRuntimeAction(s,actor,{executedAbilityId:'al-item-bomb'});context.kind='skill';context.requestSource='companion-ai';
  const entity=releaseBombEntity(s,actor,{instanceId:id,context,weapon:{...mainWeapon(actor),remote:false,damage:BOMB_SAMPLE.damage,postureDamage:BOMB_SAMPLE.posture,subtype:'impact'},from:actor.pos,to:match.aim!});if(!entity)return reject('释放路径不合法');a.nextBombAt=s.time+BOMB_SAMPLE.cooldown;s.notice='芙蕾茜娅释放实验投弹 · 后备消耗1 SAMPLE';
 }else{u.statuses.push({kind:'regen',power:AL_ITEM_SAMPLE.power,remaining:AL_ITEM_SAMPLE.duration,duration:AL_ITEM_SAMPLE.duration,source:id,name:'实验缓回药'});s.notice=`芙蕾茜娅对${u.id==='hunter'?'猎人':'自己'}使用实验缓回药 · 4HP/秒，5秒 SAMPLE`;}
 changeInventoryItems(b.inventory!,'reserve',[{definitionId:r.itemId,quantity:-1}]);a.useSerial=r.useSerial;a.uses.push({id,itemId:r.itemId,targetId:r.targetId,at:s.time});if(a.uses.length>32)a.uses.shift();return {ok:true};
}
/** Called in the existing companion decision loop; instantaneous support never cancels combat. */
export function advanceAlItemDecision(s:GameState){const a=s.world?.backpack?.alReserve;if(!alQuantity(s.world?.backpack,'sample-al-regen')&&!alQuantity(s.world?.backpack,'sample-al-bomb')||!validReserve(a)||s.phase!=='battle'||!s.world?.visit.active||s.time<a!.nextDecision)return;a!.nextDecision=s.time+AL_ITEM_SAMPLE.interval;const q=queryAlItemCandidates(s);if(q.candidates.length)acceptAlItemUse(s,q.candidates[0]);}
