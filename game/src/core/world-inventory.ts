import {createAlReserve,queryTransferAlItem,transferAlItem,type AlReserve} from './al-items';
import {containerItems,itemFits} from './inventory-model';
import type {CommandResult,GameState} from './types';
import {isStandaloneExploration,isPartyBody} from './exploration-party';

/** One world inventory authority. AL-ITEM-01A gives Al actual ownership, separately from preference. */
export type ItemKind='environment'|'farm'|'usable'|'gift'|'material'|'handoff';
export const FARM_ITEMS:Readonly<Record<string,{name:string;category:string;kind:ItemKind}>>=Object.freeze({
 'sample-cr-active-upgrade':Object.freeze({name:'实验技能升阶石',kind:'material',category:'SAMPLE · V 指定技能升一级'}),
 'sample-cr-passive-upgrade':Object.freeze({name:'实验符文升级石',kind:'material',category:'SAMPLE · V 指定符文升级一次'}),
 'sample-field-lamp':Object.freeze({name:'实验便携灯',kind:'environment',category:'环境消耗 · Tab主动照明'}),
 'sample-al-regen':Object.freeze({name:'实验缓回药',kind:'usable',category:'可使用 · 缓慢回血'}),
 'sample-al-bomb':Object.freeze({name:'实验消耗型炸弹',kind:'usable',category:'可使用 · 芙萝蕾茜娅投弹 SAMPLE'}),
 'sample-seed':Object.freeze({name:'实验种子',kind:'farm',category:'种子'}),
 'sample-tool':Object.freeze({name:'实验农具',kind:'farm',category:'农具'}),
 'sample-crop':Object.freeze({name:'实验收成',kind:'farm',category:'作物'})
});
export type WorldInventory={inventory?:import('./inventory-model').InventoryModel;trialUpgradeGranted?:boolean;alReserve:AlReserve;stacks:{itemId:string;quantity:number}[];hotbar:(string|null)[];selectedSlot:number|null;companionFreeItem:{ownerId:'ranger';itemId:string|null}};
export type InventoryVisit={worldId:string;visit:number};
export type CompanionFreeItemRequest=InventoryVisit&{ownerId:'ranger'};
export type AssignCompanionFreeItemRequest=CompanionFreeItemRequest&{itemId:string;expectedRevision:number};
export type HotbarRequest=InventoryVisit&{slot:number};
export type AssignHotbarRequest=HotbarRequest&{itemId:string};
const reject=(reason:string):CommandResult=>({ok:false,reason});
export function createWorldInventory(includeLamp=false):WorldInventory{return {alReserve:createAlReserve(),stacks:[...(includeLamp?[{itemId:'sample-field-lamp',quantity:2}]:[]),{itemId:'sample-al-regen',quantity:2},{itemId:'sample-al-bomb',quantity:2},{itemId:'sample-seed',quantity:5},{itemId:'sample-tool',quantity:1}],hotbar:Array(10).fill(null),selectedSlot:null,companionFreeItem:{ownerId:'ranger',itemId:null}};}
export function farmItem(itemId:string|null|undefined){return itemId&&Object.hasOwn(FARM_ITEMS,itemId)?FARM_ITEMS[itemId]:undefined;}
/** Single quantity source. Duplicate/malformed stacks never become usable stock. */
export function inventoryQuantity(bag:WorldInventory|undefined,itemId:string|null|undefined):number{
 if(bag?.inventory&&farmItem(itemId)){const m=bag.inventory,all=containerItems(m,'team');if(all.some(i=>!itemFits(m,i)))return 0;const items=all.filter(i=>i.definitionId===itemId);const sum=items.reduce((n,i)=>n+i.quantity,0);return Number.isSafeInteger(sum)&&sum>0?sum:0;}
 if(!bag||!farmItem(itemId))return 0;const rows=bag.stacks.filter(x=>x.itemId===itemId);
 return rows.length===1&&Number.isSafeInteger(rows[0].quantity)&&rows[0].quantity>0?rows[0].quantity:0;
}
export function queryBackpack(s:GameState):CommandResult{
 const w=s.world,r=s.exploration,u=s.units.find(a=>a.id===s.controlledBodyId);
 if(s.sessionMode!=='exploration'||s.xxExperiment||!isStandaloneExploration(s)||s.phase!=='battle'||!w?.visit.active||!r||w.visit.placeId!==r.definition.id||w.places[w.visit.placeId]?.definition!==r.definition||!w.backpack||w.backpack.hotbar.length!==10)return reject('仅当前正式探索世界可整理背包');
 if(!u||!isPartyBody(s,u)||u.cloneOf||u.shadowResident||u.life!=='active'||u.hp<=0||s.units.filter(a=>a.id===u.id).length!==1)return reject('需要存活的实控本体');
 if(s.explorationControl?.aim||s.explorationControl?.commandFocusId)return reject('先结束瞄准或指令操作');
 return {ok:true};
}
function queryVisit(s:GameState,request:InventoryVisit):CommandResult{
 const check=queryBackpack(s);if(!check.ok)return check;
 if(request.worldId!==s.world!.id||request.visit!==s.world!.visit.generation)return reject('背包请求已失效，请重新打开');
 return {ok:true};
}
function querySlot(s:GameState,request:HotbarRequest):CommandResult{
 const check=queryVisit(s,request);if(!check.ok)return check;
 if(!Number.isInteger(request.slot)||request.slot<0||request.slot>=10)return reject('无效快捷栏格位');return {ok:true};
}
export function queryAssignHotbar(s:GameState,request:AssignHotbarRequest):CommandResult{
 const check=querySlot(s,request);if(!check.ok)return check;
 return inventoryQuantity(s.world!.backpack,request.itemId)>0?{ok:true}:reject('没有可绑定的团队物品库存');
}
export function assignHotbar(s:GameState,request:AssignHotbarRequest):CommandResult{
 const check=queryAssignHotbar(s,request);if(!check.ok)return check;
 s.world!.backpack!.hotbar[request.slot]=request.itemId;return {ok:true};
}
export function clearHotbar(s:GameState,request:HotbarRequest):CommandResult{
 const check=querySlot(s,request);if(!check.ok)return check;const b=s.world!.backpack!;
 b.hotbar[request.slot]=null;if(b.selectedSlot===request.slot)b.selectedSlot=null;return {ok:true};
}
export function queryActivateHotbar(s:GameState,request:HotbarRequest):CommandResult{
 const check=querySlot(s,request);if(!check.ok)return check;
 return inventoryQuantity(s.world!.backpack,s.world!.backpack!.hotbar[request.slot])>0?{ok:true}:reject('快捷栏为空或库存已失效');
}
export function activateHotbar(s:GameState,request:HotbarRequest):CommandResult{
 const check=queryActivateHotbar(s,request);if(!check.ok)return check;const b=s.world!.backpack!;
 b.selectedSlot=request.slot;s.notice=`${farmItem(b.hotbar[request.slot])!.name} · ${b.hotbar[request.slot]==='sample-field-lamp'?'Tab选此物品点亮照明；数字栏不直接消费':b.hotbar[request.slot]==='sample-crop'?'仅展示/绑定，尚无使用':farmItem(b.hotbar[request.slot])?.kind==='usable'?'交给芙萝蕾茜娅后由AI合法使用':'靠近试验田，左键操作'}`;return {ok:true};
}

/** Fixed Al ownership guard; prior references never imply stock. */
export function queryClearCompanionFreeItem(s:GameState,request:CompanionFreeItemRequest):CommandResult{
 const check=queryVisit(s,request);if(!check.ok)return check;
 if(request.ownerId!=='ranger'||s.explorationCompanionId!=='ranger'||s.world!.backpack!.companionFreeItem?.ownerId!=='ranger')return reject('自由道具栏仅属于芙萝蕾茜娅');
 for(const id of ['hunter','ranger']){const rows=s.units.filter(u=>u.id===id);if(rows.length!==1||!isPartyBody(s,rows[0])||rows[0].cloneOf||rows[0].shadowResident)return reject('需要唯一的猎人与芙萝蕾茜娅本体');}
 return {ok:true};
}
export function queryAssignCompanionFreeItem(s:GameState,request:AssignCompanionFreeItemRequest):CommandResult{
 const check=queryClearCompanionFreeItem(s,request);if(!check.ok)return check;
 return queryTransferAlItem(s,{...request,source:'team',amount:1});
}
export function assignCompanionFreeItem(s:GameState,request:AssignCompanionFreeItemRequest):CommandResult{
 const check=queryAssignCompanionFreeItem(s,request);if(!check.ok)return check;
 return transferAlItem(s,{...request,source:'team',amount:1},true);
}
export function clearCompanionFreeItem(s:GameState,request:CompanionFreeItemRequest):CommandResult{
 const check=queryClearCompanionFreeItem(s,request);if(!check.ok)return check;
 const b=s.world!.backpack!;if(b.companionFreeItem.itemId!==null){b.companionFreeItem.itemId=null;if(Number.isSafeInteger(b.alReserve?.revision)&&b.alReserve.revision<Number.MAX_SAFE_INTEGER)b.alReserve.revision++;}return {ok:true};
}
