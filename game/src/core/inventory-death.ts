import {carriedContainer} from './home-resident';
import type {GameState,Pos} from './types';
import {initializeInventoryEquipment,syncInventoryEquipment} from './inventory-operations';
import {terrainFits,distance,surface,segmentClear} from './spatial';
/** Called exactly on the authoritative last-body death, before existing wipe revival. */
export function dropPartyInventory(s:GameState,last:Pos,event:number){
 const q=initializeInventoryEquipment(s),w=s.world,m=w?.backpack?.inventory;if(!q.ok||!w||!m)return;const key=`${w.id}:wipe:${event}`;if(m.wipes.includes(key))return;
 const items=Object.values(m.items).filter(i=>carriedContainer(s,i.location.container)&&(['team','reserve'].includes(i.location.container)||i.location.container.startsWith('equip:')));
 if(!items.length){m.wipes.push(key);return;}const floor=surface(s,last)?.layer;const candidates=s.tiles.filter(t=>terrainFits(s,t,.08)&&(floor===undefined||t.layer===floor)).sort((a,b)=>distance(a,last)-distance(b,last)||a.y-b.y||a.x-b.x);const pos=terrainFits(s,last,.08)?candidates.find(t=>segmentClear(s,last,t,false,false,.08)):candidates[0];if(!pos){s.notice='掉落点无合法空间，物品保持原所有权';return;}
 const id=`drop:${key}`,rows=Math.max(1,items.reduce((n,i)=>n+m.definitions[i.definitionId].height,0));m.containers[id]={id,name:`团队掉落包 ${event}`,kind:'grid',columns:5,rows,revision:0,placeId:w.visit.placeId,pos:{x:pos.x,y:pos.y},dropOrigin:{...last},dropOffset:distance(last,pos)};
 let y=0;const changed=new Set<string>();for(const item of items){changed.add(item.location.container);item.location={container:id,x:0,y};y+=m.definitions[item.definitionId].height;}for(const c of changed)m.containers[c].revision++;m.containers[id].revision++;m.wipes.push(key);w.backpack!.hotbar.fill(null);w.backpack!.selectedSlot=null;if(carriedContainer(s,'reserve'))w.backpack!.companionFreeItem.itemId=null;s.inputEpoch=(s.inputEpoch??0)+1;s.controlRevision=(s.controlRevision??0)+1;syncInventoryEquipment(s);
}
