import {ITEM_CATALOG} from './item-catalog';
import {makeUnit} from './unit-factory';
import type {GameState} from './types';
import {terrainFits,clearShot,surface,distance} from './spatial';
import {initializeInventoryEquipment} from './inventory-operations';
import {addInventoryItem} from './inventory-model';
/** Called by the application after renderer-specific fixture installation; one finite chest per world. */
export function initializeWorldContainers(s:GameState){const q=initializeInventoryEquipment(s),w=s.world,m=w?.backpack?.inventory;if(!q.ok||!w||!m||s.phase!=='battle'||!w.visit.active)return;const c=m.containers.external;Object.assign(m.definitions,ITEM_CATALOG);
 if(c.placeId!==undefined){initializeTradeFixture(s);return;}
 const u=s.units.find(u=>u.id===s.controlledBodyId);if(!u)return;const p=s.tiles.filter(t=>terrainFits(s,t,.08)&&surface(s,t)?.layer===surface(s,u.pos)?.layer&&clearShot(s,u.pos,t)&&distance(t,u.pos)>=1.5&&distance(t,u.pos)<=3).sort((a,b)=>distance(a,{x:u.pos.x+2,y:u.pos.y})-distance(b,{x:u.pos.x+2,y:u.pos.y})||a.y-b.y||a.x-b.x)[0];if(!p)return;c.placeId=w.visit.placeId;c.pos={x:p.x,y:p.y};
 addInventoryItem(m,'external','sample-crop',3);addInventoryItem(m,'external','sample-seed',5);
 const source=Object.values(m.items).find(i=>i.weapon?.hand==='left'&&'action'in i.weapon&&i.weapon.action==='guard');if(source){const copy=structuredClone(source.weapon!);copy.id=`${w.id}:chest:guard`;addInventoryItem(m,'external',source.definitionId,1,copy);}
 initializeTradeFixture(s);
}

/** One finite grant per world, independent of visits and panel opening. */
function initializeTradeFixture(s:GameState){
 const w=s.world!,m=w.backpack!.inventory!,c=m.containers.external;
 if(!m.catalogSeeded){const draft=structuredClone(m);draft.containers.external.rows=Math.max(c.rows,6);for(const d of Object.values(ITEM_CATALOG).filter(d=>d.category!=='currency'))if(!addInventoryItem(draft,'external',d.id,1).ok)return;m.items=draft.items;m.containers=draft.containers;m.serial=draft.serial;m.catalogSeeded=true;}
 if(!m.merchantHome&&c.pos){const pos=s.tiles.filter(t=>terrainFits(s,t,.25)&&surface(s,t)?.layer===surface(s,c.pos!)?.layer&&clearShot(s,c.pos!,t)&&distance(c.pos!,t)>=1&&distance(c.pos!,t)<=2).sort((a,b)=>distance(a,{x:c.pos!.x,y:c.pos!.y+1})-distance(b,{x:c.pos!.x,y:c.pos!.y+1}))[0];if(pos)m.merchantHome={pos:{x:pos.x,y:pos.y},placeId:c.placeId!};}
 const home=m.merchantHome,id='merchant:'+w.id;
 s.units=s.units.filter(u=>!u.npc||(u.id===id&&home?.placeId===w.visit.placeId));
 if(home&&home.placeId===w.visit.placeId){let u=s.units.find(u=>u.id===id);if(!u){u=makeUnit(id,'巡旅商人','guard',home.pos);u.npc={kind:'merchant',worldId:w.id,placeId:home.placeId};u.life='active';u.weapons=[];u.damage=0;u.speed=0;u.block=0;s.units.push(u);}u.pos={...home.pos};u.drawPos={...home.pos};}
}
