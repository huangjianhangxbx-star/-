import type {WorldInventory} from './world-inventory';
import {FARM_ITEMS} from './world-inventory';
import {createInventoryModel,addInventoryItem,changeInventoryItems,containerItems,type InventoryModel,type InventoryResult} from './inventory-model';
/** Legacy stock/Al slots are read-only projections of the item registry, never second writers. */
export function ensureInventoryModel(b:WorldInventory):InventoryResult{
 if(b.inventory)return {ok:true};if(new Set(b.stacks.map(i=>i.itemId)).size!==b.stacks.length||b.stacks.some(i=>!Number.isSafeInteger(i.quantity)||i.quantity<0))return {ok:false,reason:'旧库存重复或损坏，迁移未提交'};const model=createInventoryModel();for(const [id,d]of Object.entries(FARM_ITEMS))model.definitions[id]={id,name:d.name,description:d.category+' · 占格/上限 SAMPLE',width:1,height:1,maxStack:id==='sample-tool'?1:99,category:d.kind};
 for(const row of b.stacks){if(row.quantity===0)continue;const q=addInventoryItem(model,'team',row.itemId,row.quantity);if(!q.ok)return {ok:false,reason:'旧库存不能完整装入10格，迁移未提交：'+q.reason};}
 for(let i=0;i<b.alReserve.slots.length;i++){const row=b.alReserve.slots[i];if(!row)continue;const q=addInventoryItem(model,'reserve',row.itemId,row.quantity);if(!q.ok)return q;}
 model.containers.reserve.revision=b.alReserve.revision;b.inventory=model;
 Object.defineProperty(b,'stacks',{enumerable:true,configurable:true,get:()=>Object.freeze(Object.entries(FARM_ITEMS).flatMap(([itemId])=>{const quantity=containerItems(model,'team').filter(i=>i.definitionId===itemId).reduce((n,i)=>n+i.quantity,0);return quantity?[Object.freeze({itemId,quantity})]:[]}))});
 Object.defineProperty(b.alReserve,'slots',{enumerable:true,configurable:true,get:()=>Array.from({length:5},(_,slot)=>{const i=containerItems(model,'reserve').find(i=>i.location.slot===slot);return i?Object.freeze({itemId:i.definitionId,quantity:i.quantity}):null;})});
 Object.defineProperty(b.alReserve,'revision',{enumerable:true,configurable:true,get:()=>model.containers.reserve.revision,set:(n:number)=>{model.containers.reserve.revision=n;}});return {ok:true};
}
export function teamModel(b:WorldInventory):InventoryModel|undefined{return ensureInventoryModel(b).ok?b.inventory:undefined;}
export function changeTeamItems(b:WorldInventory,changes:{definitionId:string;quantity:number}[],dryRun=false){const m=teamModel(b);return m?changeInventoryItems(m,'team',changes,dryRun):{ok:false,reason:'旧库存迁移失败'};}
