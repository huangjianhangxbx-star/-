import {test,expect} from 'vitest';
import {createGame,createExplorationEntry,createExplorationScenario,command} from '../src/core/engine';
test('ROST ordinary and renewed entry have exactly hunter and Al without selection',()=>{
 for(const s of [createGame(),createExplorationEntry()])expect(s.units.filter(u=>u.team==='ally'&&!u.cloneOf).map(u=>u.id)).toEqual(['hunter','ranger']);
 const s=createExplorationEntry();expect(s.explorationCompanionId).toBe('ranger');expect(command(s,{type:'carry',gold:0,vitality:0}).ok).toBe(true);
 expect(command(s,{type:'restartWorld',worldId:s.world!.id}).ok).toBe(true);expect(s.explorationCompanionId).toBe('ranger');expect(command(s,{type:'carry',gold:0,vitality:0}).ok).toBe(true);
});
test('ROST retired body commands cannot create, spend or mutate current world',()=>{
 const s=createExplorationEntry(),before=JSON.stringify(s.economy);
 for(const id of ['fiorre','ines']){expect(command(s,{type:'selectExplorationCompanion',id}).ok).toBe(false);expect(command(s,{type:'controlBody',id}).ok).toBe(false);}
 expect(JSON.stringify(s.economy)).toBe(before);expect(s.explorationCompanionId).toBe('ranger');
});
test('ROST developer copy has explicit living source rather than third roster index',()=>{
 const s=createExplorationScenario();const copy=s.units.find(u=>u.id==='validation-copy')!;expect(copy).toBeDefined();expect(copy.cloneOf).toBe('ranger');expect(copy.role).toBe('ranger');
});
