import type {CommandResult,GameState,Unit} from './types';
import {farmItem,inventoryQuantity,queryClearCompanionFreeItem,type InventoryVisit,type WorldInventory} from './world-inventory';
import {clearShot,distance,surface,terrainFits} from './spatial';
import {tacticalAutonomyAllowed} from './exploration-control';
import {foregroundSkill} from './skill-slots';
import {visibleEnemyHazards} from './enemy-observation';
import {areaHits} from './attack-area';

export const AL_ITEM_SAMPLE=Object.freeze({capacity:5,interval:.2,reach:3,hpRatio:.65,power:4,duration:5});
export type AlReserve={slots:({itemId:string;quantity:number}|null)[];revision:number;useSerial:number;nextDecision:number;uses:{id:string;itemId:string;targetId:string;at:number}[]};
export type AlItemRequest=InventoryVisit&{ownerId:'ranger';source:'team'|'reserve';itemId:string;amount:1;expectedRevision:number};
export type AlUseRequest=InventoryVisit&{ownerId:'ranger';itemId:string;targetId:string;expectedRevision:number;useSerial:number;prioritySource:'preferred'|'reserve'};
const reject=(reason:string):CommandResult=>({ok:false,reason});
export function createAlReserve():AlReserve{return {slots:Array(5).fill(null),revision:0,useSerial:0,nextDecision:0,uses:[]};}
function validReserve(r:AlReserve|undefined){return !!r&&Array.isArray(r.slots)&&r.slots.length===AL_ITEM_SAMPLE.capacity&&Number.isSafeInteger(r.revision)&&r.revision>=0&&r.revision<Number.MAX_SAFE_INTEGER&&Number.isSafeInteger(r.useSerial)&&r.useSerial>=0&&r.useSerial<Number.MAX_SAFE_INTEGER&&Number.isFinite(r.nextDecision)&&r.slots.every(x=>x===null||!!farmItem(x.itemId)&&Number.isSafeInteger(x.quantity)&&x.quantity>0)&&new Set(r.slots.filter(x=>x!==null).map(x=>x!.itemId)).size===r.slots.filter(Boolean).length;}
export function alQuantity(b:WorldInventory|undefined,id:string|null|undefined){if(!validReserve(b?.alReserve)||!farmItem(id))return 0;return b!.alReserve.slots.find(x=>x?.itemId===id)?.quantity??0;}
function checkRequest(s:GameState,r:AlItemRequest){const q=queryClearCompanionFreeItem(s,r);if(!q.ok)return q;const b=s.world!.backpack!;
 if(!validReserve(b.alReserve)||r.expectedRevision!==b.alReserve.revision)return reject('后备库存已变化，请重新操作');
 if(r.amount!==1||!farmItem(r.itemId)||!['team','reserve'].includes(r.source))return reject('仅支持团队与阿尔后备间转交1件；礼物及模型交互尚未接入');return {ok:true};
}
export function queryTransferAlItem(s:GameState,r:AlItemRequest):CommandResult{
 const q=checkRequest(s,r);if(!q.ok)return q;const b=s.world!.backpack!,a=b.alReserve,rows=b.stacks.filter(x=>x.itemId===r.itemId);
 if(rows.length>1||rows.some(x=>!Number.isSafeInteger(x.quantity)||x.quantity<0))return reject('团队库存无效');
 if(r.source==='team'){if(!inventoryQuantity(b,r.itemId))return reject('团队库存不足');const row=a.slots.find(x=>x?.itemId===r.itemId);if(row?.quantity===Number.MAX_SAFE_INTEGER||!row&&!a.slots.includes(null))return reject('阿尔后备已满或数量溢出');}
 else if(!alQuantity(b,r.itemId)||rows[0]?.quantity===Number.MAX_SAFE_INTEGER)return reject('阿尔未持有该物品或团队数量溢出');return {ok:true};
}
export function transferAlItem(s:GameState,r:AlItemRequest,prefer=false):CommandResult{
 const q=queryTransferAlItem(s,r);if(!q.ok)return q;const b=s.world!.backpack!,a=b.alReserve;let team=b.stacks.find(x=>x.itemId===r.itemId),i=a.slots.findIndex(x=>x?.itemId===r.itemId);
 if(r.source==='team'){team!.quantity--;if(i<0){i=a.slots.indexOf(null);a.slots[i]={itemId:r.itemId,quantity:0};}a.slots[i]!.quantity++;}
 else{a.slots[i]!.quantity--;if(a.slots[i]!.quantity===0)a.slots[i]=null;if(!team){team={itemId:r.itemId,quantity:0};b.stacks.push(team);}team.quantity++;}
 if(prefer)b.companionFreeItem.itemId=r.itemId;a.revision++;s.notice=`${farmItem(r.itemId)!.name} ${r.source==='team'?'交给阿尔':'收回团队'} ×1${prefer?' · 优先考虑':''}`;return {ok:true};
}
export function queryAlPriority(s:GameState,r:AlItemRequest):CommandResult{const q=checkRequest(s,r);if(!q.ok)return q;return r.source==='reserve'&&alQuantity(s.world!.backpack,r.itemId)>0?{ok:true}:reject('先交付道具，阿尔才可优先考虑');}
export function setAlPriority(s:GameState,r:AlItemRequest):CommandResult{const q=queryAlPriority(s,r);if(!q.ok)return q;const b=s.world!.backpack!;b.companionFreeItem.itemId=r.itemId;b.alReserve.revision++;s.notice='阿尔优先考虑 '+farmItem(r.itemId)!.name;return {ok:true};}
function locked(s:GameState,a:Unit){const c=a.alCombat;return a.life!=='active'||a.hp<=0||a.cloneOf||a.shadowResident||a.ready>0||a.stagger>0||a.posture<=0||a.forcedMotion||a.crossing||a.skillLanding||a.direct||a.attackPending||a.attackIntent||a.basicAction||a.evasion?.action||a.loadout||a.recall||a.partyTask||a.rescueTarget||c?.special||c?.motion||c?.shotHeld||s.time<(c?.hurtUntil??0)||s.time<(c?.finalRecoveryUntil??0)||foregroundSkill(a)||Object.values(a.skillStates||{}).some(st=>st.run)||a.offhand?.pending||a.statuses.some(st=>st.kind==='stun'&&st.remaining>0);}
/** Read-only eligibility; no lazy constructors, clocks, random choices, pathing or stock repair. */
export function queryAlItemCandidates(s:GameState):{candidates:AlUseRequest[];reason:string}{
 const w=s.world,b=w?.backpack,a=s.units.find(u=>u.id==='ranger');const none=(reason:string)=>({candidates:[],reason});
 if(!w||!b||!a||!queryClearCompanionFreeItem(s,{worldId:w.id,visit:w.visit.generation,ownerId:'ranger'}).ok||!validReserve(b.alReserve))return none('条件不符');
 if(!['explorationIdle','explorationBattle'].includes(s.context??''))return none('条件不符 · 非探索状态');
 if(s.controlledBodyId==='ranger')return none('实控阿尔 · 等待托管');
 if(locked(s,a)||!tacticalAutonomyAllowed(s,a))return none('等待时机');
 const threatened=visibleEnemyHazards(s,a).some(h=>areaHits(s,h.area,a))||s.units.some(e=>e.team==='enemy'&&e.life==='active'&&e.attackIntent&&e.attackIntent.resolveAt>=s.time&&areaHits(s,e.attackIntent.area,a));
 if(threatened)return none('先避险');
 if(!alQuantity(b,'sample-al-regen'))return none(b.companionFreeItem.itemId?'未持有或耗尽 · 请交付':'阿尔后备无可用药');
 const targets=s.units.filter(u=>['hunter','ranger'].includes(u.id)&&u.team==='ally'&&u.life==='active'&&u.hp>0&&!u.shadowResident&&!u.cloneOf&&u.hp/u.maxHp<=AL_ITEM_SAMPLE.hpRatio&&surface(s,u.pos)?.layer===surface(s,a.pos)?.layer&&terrainFits(s,a.pos,.18)&&distance(a.pos,u.pos)<=AL_ITEM_SAMPLE.reach&&clearShot(s,a.pos,u.pos)&&!u.statuses.some(st=>st.kind==='regen'&&st.remaining>0)).sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp||x.id.localeCompare(y.id));
 if(!targets.length)return none('条件不符 · 无需治疗或距离/视线受限');
 return {reason:'可考虑缓回药',candidates:targets.map(u=>({worldId:w.id,visit:w.visit.generation,ownerId:'ranger',itemId:'sample-al-regen',targetId:u.id,expectedRevision:b.alReserve.revision,useSerial:b.alReserve.useSerial+1,prioritySource:b.companionFreeItem.itemId==='sample-al-regen'?'preferred':'reserve'}))};
}
export function acceptAlItemUse(s:GameState,r:AlUseRequest):CommandResult{
 const match=queryAlItemCandidates(s).candidates.find(c=>c.worldId===r.worldId&&c.visit===r.visit&&c.ownerId===r.ownerId&&c.itemId===r.itemId&&c.targetId===r.targetId&&c.expectedRevision===r.expectedRevision&&c.useSerial===r.useSerial&&c.prioritySource===r.prioritySource);if(!match)return reject('用药请求已失效或条件不符');
 const b=s.world!.backpack!,a=b.alReserve,i=a.slots.findIndex(x=>x?.itemId===r.itemId),u=s.units.find(u=>u.id===r.targetId)!;a.slots[i]!.quantity--;if(!a.slots[i]!.quantity)a.slots[i]=null;a.revision++;a.useSerial=r.useSerial;
 const id=`al-item:${r.worldId}:${r.visit}:${r.useSerial}`;u.statuses.push({kind:'regen',power:AL_ITEM_SAMPLE.power,remaining:AL_ITEM_SAMPLE.duration,duration:AL_ITEM_SAMPLE.duration,source:id,name:'实验缓回药'});a.uses.push({id,itemId:r.itemId,targetId:r.targetId,at:s.time});if(a.uses.length>32)a.uses.shift();s.notice=`阿尔对${u.id==='hunter'?'猎人':'自己'}使用实验缓回药 · 4HP/秒，5秒 SAMPLE`;return {ok:true};
}
/** Called in the existing companion decision loop; instantaneous support never cancels combat. */
export function advanceAlItemDecision(s:GameState){const a=s.world?.backpack?.alReserve;if(!alQuantity(s.world?.backpack,'sample-al-regen')||!validReserve(a)||s.phase!=='battle'||!s.world?.visit.active||s.time<a!.nextDecision)return;a!.nextDecision=s.time+AL_ITEM_SAMPLE.interval;const q=queryAlItemCandidates(s);if(q.candidates.length)acceptAlItemUse(s,q.candidates[0]);}
