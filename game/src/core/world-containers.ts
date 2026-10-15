import type {GameState} from './types';
import {terrainFits,clearShot,surface,distance} from './spatial';
import {initializeInventoryEquipment} from './inventory-operations';
import {addInventoryItem} from './inventory-model';
/** Called by the application after renderer-specific fixture installation; one finite chest per world. */
export function initializeWorldContainers(s:GameState){const q=initializeInventoryEquipment(s),w=s.world,m=w?.backpack?.inventory;if(!q.ok||!w||!m||s.phase!=='battle'||!w.visit.active)return;const c=m.containers.external;if(c.placeId!==undefined)return;
 const u=s.units.find(u=>u.id===s.controlledBodyId);if(!u)return;const p=s.tiles.filter(t=>terrainFits(s,t,.08)&&surface(s,t)?.layer===surface(s,u.pos)?.layer&&clearShot(s,u.pos,t)&&distance(t,u.pos)>=1.5&&distance(t,u.pos)<=3).sort((a,b)=>distance(a,{x:u.pos.x+2,y:u.pos.y})-distance(b,{x:u.pos.x+2,y:u.pos.y})||a.y-b.y||a.x-b.x)[0];if(!p)return;c.placeId=w.visit.placeId;c.pos={x:p.x,y:p.y};
 addInventoryItem(m,'external','sample-crop',3);addInventoryItem(m,'external','sample-seed',5);
 const source=Object.values(m.items).find(i=>i.weapon?.hand==='left'&&'action'in i.weapon&&i.weapon.action==='guard');if(source){const copy=structuredClone(source.weapon!);copy.id=`${w.id}:chest:guard`;addInventoryItem(m,'external',source.definitionId,1,copy);}
}
