import {teamModel,changeTeamItems} from '../src/core/inventory-world';
// Deliberate malformed authoritative fixtures; production projections remain read-only.
export function stock(b:any,id:string,n:number){const m=teamModel(b)!;const i=Object.values(m.items).find(i=>i.location.container==='team'&&i.definitionId===id)!;if(n===0)delete m.items[i.id];else i.quantity=n;}
export function corruptItem(b:any,id:string,n:number,container='team',slot=0){const m=teamModel(b)!;const key='corrupt-'+Object.keys(m.items).length;m.items[key]={id:key,definitionId:id,quantity:n,location:container==='team'?{container,x:0,y:0}:{container,slot}};}
export {changeTeamItems};

import {moveInventoryItem} from '../src/core/inventory-model';
export function freeEquipmentSpace(s:any){const m=s.world.backpack.inventory;for(const i of Object.values(m.items) as any[])if(i.location.container==='team'&&!i.weapon)moveInventoryItem(m,{id:i.id,to:'external'});}
