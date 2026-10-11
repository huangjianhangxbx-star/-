import type {CommandResult,GameState} from './types';
import {isStandaloneExploration,isPartyBody} from './exploration-party';

/** INV01A SAMPLE stocks. Farming uses this same stock; no healing, equipment or economy effects. */
export const FARM_ITEMS:Readonly<Record<string,{name:string;category:string}>>=Object.freeze({
 'sample-seed':Object.freeze({name:'实验种子',category:'种子'}),
 'sample-tool':Object.freeze({name:'实验农具',category:'农具'}),
 'sample-crop':Object.freeze({name:'实验收成',category:'作物'})
});
export type WorldInventory={stacks:{itemId:string;quantity:number}[];hotbar:(string|null)[];selectedSlot:number|null;companionFreeItem:{ownerId:'ranger';itemId:string|null}};
export type InventoryVisit={worldId:string;visit:number};
export type CompanionFreeItemRequest=InventoryVisit&{ownerId:'ranger'};
export type AssignCompanionFreeItemRequest=CompanionFreeItemRequest&{itemId:string};
export type HotbarRequest=InventoryVisit&{slot:number};
export type AssignHotbarRequest=HotbarRequest&{itemId:string};
const reject=(reason:string):CommandResult=>({ok:false,reason});
export function createWorldInventory():WorldInventory{return {stacks:[{itemId:'sample-seed',quantity:5},{itemId:'sample-tool',quantity:1}],hotbar:Array(10).fill(null),selectedSlot:null,companionFreeItem:{ownerId:'ranger',itemId:null}};}
export function farmItem(itemId:string|null|undefined){return itemId&&Object.hasOwn(FARM_ITEMS,itemId)?FARM_ITEMS[itemId]:undefined;}
/** Single quantity source. Duplicate/malformed stacks never become usable stock. */
export function inventoryQuantity(bag:WorldInventory|undefined,itemId:string|null|undefined):number{
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
 return inventoryQuantity(s.world!.backpack,request.itemId)>0?{ok:true}:reject('没有可绑定的农用物品库存');
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
 b.selectedSlot=request.slot;s.notice=`${farmItem(b.hotbar[request.slot])!.name} · ${b.hotbar[request.slot]==='sample-crop'?'仅展示/绑定，尚无使用':'靠近试验田，左键操作'}`;return {ok:true};
}

/** INV01B binds a reference to fixed Al; does not grant a use/AI consumer. */
export function queryClearCompanionFreeItem(s:GameState,request:CompanionFreeItemRequest):CommandResult{
 const check=queryVisit(s,request);if(!check.ok)return check;
 if(request.ownerId!=='ranger'||s.explorationCompanionId!=='ranger'||s.world!.backpack!.companionFreeItem?.ownerId!=='ranger')return reject('自由道具栏仅属于阿尔');
 for(const id of ['hunter','ranger']){const rows=s.units.filter(u=>u.id===id);if(rows.length!==1||!isPartyBody(s,rows[0])||rows[0].cloneOf||rows[0].shadowResident)return reject('需要唯一的猎人与阿尔本体');}
 return {ok:true};
}
export function queryAssignCompanionFreeItem(s:GameState,request:AssignCompanionFreeItemRequest):CommandResult{
 const check=queryClearCompanionFreeItem(s,request);if(!check.ok)return check;
 return inventoryQuantity(s.world!.backpack,request.itemId)>0?{ok:true}:reject('没有可绑定的背包物品库存');
}
export function assignCompanionFreeItem(s:GameState,request:AssignCompanionFreeItemRequest):CommandResult{
 const check=queryAssignCompanionFreeItem(s,request);if(!check.ok)return check;
 s.world!.backpack!.companionFreeItem.itemId=request.itemId;return {ok:true};
}
export function clearCompanionFreeItem(s:GameState,request:CompanionFreeItemRequest):CommandResult{
 const check=queryClearCompanionFreeItem(s,request);if(!check.ok)return check;
 s.world!.backpack!.companionFreeItem.itemId=null;return {ok:true};
}
