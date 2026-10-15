import {test,expect} from 'vitest';
import {createGame,command} from '../src/core/engine';
import {mainWeapon} from '../src/core/equipment';
import {requestBasic} from '../src/core/basic-chain';
function world(){const s=createGame();s.sessionMode='exploration';command(s,{type:'selectJourney',journey:'exploration'});command(s,{type:'carry',gold:0,vitality:0});return s;}
test('same weapon moves to safety and back; empty hand cannot fall back to legacy attack',async()=>{const m=await import('../src/core/inventory-operations').catch(()=>undefined);expect(m).toBeDefined();const s=world();expect(m!.initializeInventoryEquipment(s).ok).toBe(true);const h=s.units.find(u=>u.id==='hunter')!,weapon=h.equipment!.equipped.right!;weapon.weapon.durability=41;weapon.skills!.instances['hunter-break']!.cd=3;
 const req=m!.inventoryMoveRequest(s,weapon.id,'safe',undefined,0);expect(m!.commitInventoryMove(s,req).ok).toBe(true);expect(h.equipment!.equipped.right).toBeNull();expect(mainWeapon(h).damage).toBe(0);expect(requestBasic(s,h,{x:h.pos.x+1,y:h.pos.y},s.nextId++)).toMatchObject({ok:false});
 expect(m!.commitInventoryMove(s,m!.inventoryMoveRequest(s,weapon.id,'equip:hunter:right')).ok).toBe(true);expect(h.equipment!.equipped.right).toBe(weapon);expect(weapon.weapon.durability).toBe(41);expect(weapon.skills!.instances['hunter-break']!.cd).toBe(3);expect(m!.initializeInventoryEquipment(s).ok).toBe(true);expect(Object.values(s.world!.backpack!.inventory!.items).filter(i=>i.id===weapon.id)).toHaveLength(1);
});

test('full footprint rejects shield replacement atomically; stale control and wrong hand never change equipment',async()=>{const m=await import('../src/core/inventory-operations'),s=world();m.initializeInventoryEquipment(s);const h=s.units.find(u=>u.id==='hunter')!,store=s.world!.backpack!.inventory!,bomb=h.equipment!.owned.find(i=>i.action==='bomb')!;let before=JSON.stringify(s);expect(m.commitInventoryMove(s,m.inventoryMoveRequest(s,bomb.id,'equip:hunter:left')).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
 const weapon=h.equipment!.equipped.right!;for(const r of [{...m.inventoryMoveRequest(s,weapon.id,'safe',undefined,0),controlRevision:999},m.inventoryMoveRequest(s,weapon.id,'equip:hunter:left'),{...m.inventoryMoveRequest(s,weapon.id,'safe',undefined,0),fromRevision:999}]){before=JSON.stringify(s);expect(m.commitInventoryMove(s,r).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}expect(store.items[weapon.id].weapon).toBe(weapon);
});
