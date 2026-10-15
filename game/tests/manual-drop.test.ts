import {test,expect} from 'vitest';
import {createExplorationEntry,command} from '../src/core/engine';
import {inventoryMoveRequest} from '../src/core/inventory-operations';
import {dropInventoryItem,clearManualDrops} from '../src/core/inventory-manual-drop';
test('drop preserves instance, stale request cannot duplicate, unload clears only manual drops',()=>{const s=createExplorationEntry();command(s,{type:'carry',gold:0,vitality:0});const m=s.world!.backpack!.inventory!,i=Object.values(m.items).find(i=>i.location.container==='team')!,r=inventoryMoveRequest(s,i.id,'team');expect(dropInventoryItem(s,r).ok).toBe(true);expect(m.items[i.id].location.container).toMatch(/^drop:manual:/);expect(dropInventoryItem(s,r).ok).toBe(false);clearManualDrops(s);expect(m.items[i.id]).toBeUndefined();expect(m.containers.team).toBeDefined();});
