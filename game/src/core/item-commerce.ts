import {addInventoryItem,itemFits,type InventoryModel,type InventoryResult} from './inventory-model';
import type {GameState} from './types';
import {queryBackpack} from './world-inventory';
import {distance,clearShot,surface} from './spatial';
import {COIN} from './item-catalog';
const fail=(reason:string):InventoryResult=>({ok:false,reason});
/** Exact-instance optimistic transaction: neither debit nor proceeds escape a failed draft. */
export function exchangeItem(m:InventoryModel,id:string,quantity:number,revision:number,credit?:string,amount=0):InventoryResult{
 const i=m.items[id];if(!i||!['team','safe','reserve'].includes(i.location.container)||i.weapon||!itemFits(m,i)||m.containers[i.location.container].revision!==revision)return fail('物品已变化或不能处理');
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>i.quantity||!Number.isSafeInteger(amount)||amount<0)return fail('数量无效');
 const draft:InventoryModel={...m,items:Object.fromEntries(Object.entries(m.items).map(([k,v])=>[k,{...v,location:{...v.location}}])),containers:Object.fromEntries(Object.entries(m.containers).map(([k,v])=>[k,{...v}]))};
 draft.items[id].quantity-=quantity;if(!draft.items[id].quantity)delete draft.items[id];draft.containers[i.location.container].revision++;
 if(credit){const q=addInventoryItem(draft,'team',credit,amount);if(!q.ok)return fail('团队包放不下所得钱币，交易未发生');}
 m.items=draft.items;m.containers=draft.containers;m.serial=draft.serial;return {ok:true};
}
export type ItemAction={worldId:string;visit:number;actorId:string;controlRevision:number;id:string;revision:number;quantity:number};
export function itemAction(s:GameState,id:string,quantity=1):ItemAction{const w=s.world!,m=w.backpack!.inventory!,i=m.items[id];return {worldId:w.id,visit:w.visit.generation,actorId:s.controlledBodyId!,controlRevision:s.controlRevision??0,id,revision:i?m.containers[i.location.container].revision:-1,quantity};}
function valid(s:GameState,r:ItemAction){return queryBackpack(s).ok&&s.world?.id===r.worldId&&s.world.visit.generation===r.visit&&s.controlledBodyId===r.actorId&&(s.controlRevision??0)===r.controlRevision;}
export function merchantAccess(s:GameState,id:string){const n=s.units.find(u=>u.id===id&&u.npc?.kind==='merchant'),u=s.units.find(u=>u.id===s.controlledBodyId);return !!n&&!!u&&queryBackpack(s).ok&&n.npc!.worldId===s.world?.id&&n.npc!.placeId===s.world?.visit.placeId&&u.life==='active'&&!u.crossing&&!u.forcedMotion&&distance(n.pos,u.pos)<=3&&surface(s,u.pos)?.layer===surface(s,n.pos)?.layer&&clearShot(s,u.pos,n.pos);}
export function sellItem(s:GameState,r:ItemAction,merchantId:string):InventoryResult{
 if(!valid(s,r)||!merchantAccess(s,merchantId))return fail('请靠近同层商人，交易身份不可失效');
 const m=s.world!.backpack!.inventory!,i=m.items[r.id],d=i&&m.definitions[i.definitionId];if(!d||!Number.isSafeInteger(d.sellValue)||d.sellValue!<=0)return fail('商人不收购此物品');
 return exchangeItem(m,r.id,r.quantity,r.revision,COIN,d.sellValue!*r.quantity);
}
export function eatFood(s:GameState,r:ItemAction):InventoryResult{
 if(!valid(s,r))return fail('使用身份已失效');const u=s.units.find(u=>u.id===r.actorId)!,m=s.world!.backpack!.inventory!,i=m.items[r.id],effect=i&&m.definitions[i.definitionId]?.use;
 if(!effect||effect.kind!=='regen'||r.quantity!==1||u.life!=='active'||u.hp>=u.maxHp||u.statuses.some(st=>st.kind==='regen'&&st.remaining>0))return fail('需生命未满且没有正在生效的持续恢复');
 const q=exchangeItem(m,r.id,1,r.revision);if(q.ok)u.statuses.push({kind:'regen',name:'食物恢复',source:'food:'+i.definitionId,power:effect.perSecond,remaining:effect.seconds,duration:effect.seconds});return q;
}
