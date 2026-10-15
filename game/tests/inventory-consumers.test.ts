import {test,expect} from 'vitest';
import {createGame,command} from '../src/core/engine';
import {inventoryQuantity} from '../src/core/world-inventory';
import {initializeAbilityTrial} from '../src/core/ability-trial';
import {changeTeamItems} from '../src/core/inventory-world';
function world(){const s=createGame();s.sessionMode='exploration';command(s,{type:'selectJourney',journey:'exploration'});command(s,{type:'selectExplorationCompanion',id:'ranger'});command(s,{type:'carry',gold:0,vitality:0});return s;}
test('normal world uses item registry and both extra upgrade grants fit once',()=>{const s=world();expect(s.world!.backpack!.inventory).toBeDefined();s.abilityTrial=s.trialProgression=true;initializeAbilityTrial(s);expect(inventoryQuantity(s.world!.backpack,'sample-cr-active-upgrade')).toBe(6);initializeAbilityTrial(s);expect(inventoryQuantity(s.world!.backpack,'sample-cr-active-upgrade')).toBe(6);expect(changeTeamItems(s.world!.backpack!,[{definitionId:'sample-cr-active-upgrade',quantity:-1}]).ok).toBe(true);expect(inventoryQuantity(s.world!.backpack,'sample-cr-active-upgrade')).toBe(5);});
