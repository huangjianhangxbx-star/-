import {freeEquipmentSpace} from './inventory-fixture';
import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {command,step} from '../src/core/engine';
import {hunterState} from '../src/core/hunter-combat';
import {hunterDefense} from '../src/core/hunter-combat';
function setup(){const a=base();a.s.sessionMode='exploration';beginWorld(a.s);freeEquipmentSpace(a.s);return a;}

test.each(['bomb','broken'])('F01 Hunter E independent of %s left, Accept pays once and charge uses native contract',left=>{
 const {s,h}=setup();s.context='explorationIdle';hunterState(h);const item=left==='bomb'?h.equipment!.owned[1]:h.equipment!.equipped.left;
 if(left==='bomb')expect(command(s,{type:'equipOffhand',id:h.id,instanceId:item.id}).ok).toBe(true);else item.durability=0;
 const cd=item.cd,wear=item.durability,paid=h.stamina!.lastAcceptedId;
 expect(command(s,{type:'hunterInput',id:h.id,kind:'active',held:true,aim:{x:12,y:10}})).toEqual({ok:true});
 expect(h.hunterCombat!.special!.kind).toBe('prepare');expect(h.stamina!.current).toBe(72);expect(h.stamina!.lastAcceptedId).toBe(paid+1);
 command(s,{type:'hunterInput',id:h.id,kind:'active',held:false});for(let i=0;i<8;i++)step(s,.05);
 expect(h.hunterCombat!.trace.some(t=>t.kind==='accepted')).toBe(true);expect(h.hunterCombat!.special!.kind).toBe('charge');expect(h.stamina!.lastAcceptedId).toBe(paid+1);expect(item.cd).toBe(cd);expect(item.durability).toBe(wear);expect(h.offhand?.entities??[]).toHaveLength(0);
});
test('F01 damaged shield blocks only RMB and never pays or defends',()=>{
 const {s,h}=setup();hunterState(h);h.equipment!.equipped.left.durability=0;const paid=h.stamina!.lastAcceptedId;
 expect(command(s,{type:'hunterInput',id:h.id,kind:'guard'}).ok).toBe(false);expect(hunterDefense(s,h,{x:12,y:10})).toBeUndefined();expect(h.stamina!.lastAcceptedId).toBe(paid);expect(h.stamina!.current).toBe(100);
});
test('F01 bomb pending temporarily locks E, released bomb does not own right ability',()=>{
 const {s,h,al}=setup();s.context='explorationIdle';const bomb=h.equipment!.owned[1];command(s,{type:'equipOffhand',id:h.id,instanceId:bomb.id});command(s,{type:'offhandInput',id:h.id,held:true,aim:{x:12,y:10}});
 expect(command(s,{type:'hunterInput',id:h.id,kind:'active',aim:{x:12,y:10}}).ok).toBe(false);expect(h.stamina!.current).toBe(80);step(s,.06);
 expect(command(s,{type:'switchMainForm',id:h.id,form:'II'}).ok).toBe(true);command(s,{type:'controlBody',id:al.id});expect(command(s,{type:'hunterInput',id:h.id,kind:'active'}).ok).toBe(false);command(s,{type:'controlBody',id:h.id});
 expect(command(s,{type:'hunterInput',id:h.id,kind:'active',aim:{x:12,y:10}}).ok).toBe(true);expect(h.stamina!.current).toBe(52);expect(bomb.durability).toBe(99);expect(bomb.cd).toBeCloseTo(4.94);
});
