import {personalContainerAccessible} from './home-resident';
import type {GameState,CommandResult,Pos} from './types';
import {equipmentBusy,type MainInstance,type OffhandInstance} from './equipment';
import {queryBackpack,type InventoryVisit} from './world-inventory';
import {teamModel} from './inventory-world';
import {containerItems,addInventoryItem,moveInventoryItem,queryInventoryMove,type InventoryModel,type ItemMove} from './inventory-model';
import {distance,clearShot,surface,terrainFits} from './spatial';
export type InventoryMoveRequest=InventoryVisit&ItemMove&{actorId:string;controlRevision:number};
/** Shared by opening, transfers and packing; measured from the controlled body on the ground. */
export const INVENTORY_INTERACTION_RADIUS=3;
const reject=(reason:string):CommandResult=>({ok:false,reason});
export function initializeInventoryEquipment(s:GameState):CommandResult{
 const bag=s.world?.backpack;if(!bag)return {ok:true};const m=teamModel(bag);if(!m)return reject('旧库存容量迁移失败');if(m.equipmentRegistered)return {ok:true};
 const draft:InventoryModel={...m,definitions:{...m.definitions},items:{...m.items},containers:{...m.containers}};
 for(const u of s.units.filter(u=>['hunter','ranger'].includes(u.id)&&!u.cloneOf&&u.equipment)){
  const e=u.equipment!;for(const hand of ['left','right'] as const){const id=`equip:${u.id}:${hand}`;draft.containers[id]={id,name:(u.id==='hunter'?'猎人':'芙蕾茜娅')+(hand==='left'?'左手':'右手'),kind:'slots',columns:1,rows:1,revision:0,owner:u.id,hand};}
  const weapons=[e.equipped.right,e.equipped.left,...e.owned.filter(i=>i!==e.equipped.left)].filter(Boolean) as (MainInstance|OffhandInstance)[];
  for(const weapon of weapons){if(draft.items[weapon.id])return reject('武器实例ID重复，迁移未提交');const right=weapon.hand==='right',action=right?u.id:(weapon as OffhandInstance).action,def=`weapon-${action}`;draft.definitions[def]={id:def,name:right?`${u.id==='hunter'?'猎人':'芙蕾茜娅'}主武器`:weapon.name,description:'既有战斗包 · 固定朝向占格SAMPLE，实例状态随物品保存',width:right?(u.id==='hunter'?2:1):action==='guard'?2:action==='shot'?2:1,height:right?(u.id==='ranger'?2:1):action==='guard'?2:1,maxStack:1,category:'weapon',hand:weapon.hand,owners:action==='bomb'?['hunter','ranger']:[u.id]};
   const to=weapon===e.equipped[weapon.hand]?`equip:${u.id}:${weapon.hand}`:'team',q=addInventoryItem(draft,to,def,1,weapon);if(!q.ok)return q;
  }
 }
 m.definitions=draft.definitions;m.items=draft.items;m.containers=draft.containers;m.serial=draft.serial;m.equipmentRegistered=true;return {ok:true};
}
export function syncInventoryEquipment(s:GameState){const m=s.world?.backpack?.inventory;if(!m?.equipmentRegistered)return;for(const u of s.units.filter(u=>u.equipment&&!u.cloneOf)){
 const e=u.equipment!,oldRight=e.equipped.right,oldLeft=e.equipped.left;e.equipped.right=containerItems(m,`equip:${u.id}:right`)[0]?.weapon as MainInstance??null;e.equipped.left=containerItems(m,`equip:${u.id}:left`)[0]?.weapon as OffhandInstance??null;
 if(oldRight!==e.equipped.right||oldLeft!==e.equipped.left){if(u.offhand)u.offhand.held=false;if(u.hunterCombat)u.hunterCombat.held=false;if(u.alCombat)u.alCombat.held=u.alCombat.shotHeld=false;}
 for(const hand of ['left','right'] as const){const w=e.equipped[hand];if(w)w.ownerId=u.id;}
 if(e.equipped.left)e.nextWearId=Math.max(e.nextWearId,(e.equipped.left.lastWearId??0)+1);
 e.owned=Object.values(m.items).filter(i=>i.weapon?.hand==='left'&&i.weapon.ownerId===u.id&&['team','safe',`equip:${u.id}:left`].includes(i.location.container)).map(i=>i.weapon as OffhandInstance);
}}
export function inventoryMoveRequest(s:GameState,id:string,to:string,position?:Pos,slot?:number,quantity?:number):InventoryMoveRequest{const w=s.world!,m=w.backpack!.inventory!,i=m.items[id];return {worldId:w.id,visit:w.visit.generation,actorId:s.controlledBodyId!,controlRevision:s.controlRevision??0,id,to,position,slot,quantity,fromRevision:i?m.containers[i.location.container].revision:-1,toRevision:m.containers[to]?.revision??-1};}
export function inventoryContainerAccess(s:GameState,id:string):CommandResult{const m=s.world?.backpack?.inventory,c=m?.containers[id];if(!c)return reject('容器不存在');if(!personalContainerAccessible(s,id))return reject('个人物品留在家中，请返回家园或先组队');if(['team','safe','reserve'].includes(id)||id.startsWith('equip:'))return {ok:true};const u=s.units.find(u=>u.id===s.controlledBodyId);return c.pos&&c.placeId===s.world!.visit.placeId&&u&&distance(u.pos,c.pos)<=INVENTORY_INTERACTION_RADIUS&&surface(s,u.pos)?.layer===surface(s,c.pos)?.layer&&terrainFits(s,c.pos,.08)&&clearShot(s,u.pos,c.pos)?{ok:true}:reject('靠近同层容器，不能隔墙或远程操作');}
export function queryInventoryTransfer(s:GameState,r:InventoryMoveRequest):CommandResult{
 const q=queryBackpack(s);if(!q.ok)return q;const w=s.world!,m=w.backpack!.inventory,i=m?.items[r.id];if(!m||!i||w.id!==r.worldId||w.visit.generation!==r.visit||s.controlledBodyId!==r.actorId||(s.controlRevision??0)!==r.controlRevision||!Number.isSafeInteger(r.fromRevision)||!Number.isSafeInteger(r.toRevision))return reject('物品访问或控制身份已失效');
 if(r.to==='reserve'&&i.weapon)return reject('芙蕾茜娅后备仅用于道具，武器请放团队或安全包');
 for(const id of [i.location.container,r.to]){const access=inventoryContainerAccess(s,id);if(!access.ok)return access;const c=m.containers[id];if(c.owner){const u=s.units.find(u=>u.id===c.owner);if(!u||u.life!=='active'||s.context!=='explorationIdle'||equipmentBusy(u))return reject('请脱战并结束该角色动作后换装');}}
 return queryInventoryMove(m,r);
}
export function commitInventoryMove(s:GameState,r:InventoryMoveRequest):CommandResult{const q=queryInventoryTransfer(s,r);if(!q.ok)return q;const m=s.world!.backpack!.inventory!,done=moveInventoryItem(m,r);if(done.ok){syncInventoryEquipment(s);for(const id of Object.keys(m.containers))if(id.startsWith('drop:')&&!containerItems(m,id).length)delete m.containers[id];const bag=s.world!.backpack!;bag.hotbar=bag.hotbar.map(id=>id&&containerItems(m,'team').some(i=>i.definitionId===id)?id:null);if(bag.companionFreeItem.itemId&&!containerItems(m,'reserve').some(i=>i.definitionId===bag.companionFreeItem.itemId))bag.companionFreeItem.itemId=null;}return done;}
