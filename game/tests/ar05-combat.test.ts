import {test,expect} from 'vitest';
import {setup} from './ar03-fixture';
import {command,step,resolveHit} from '../src/core/engine';
const run=(s:any,n:number)=>{for(let i=0;i<n;i++)step(s,.01);};
test('held request executes four native event stages on empty ground',()=>{
 const {s,h,e,f}=setup('loop',742);e.pos={x:35,y:20};f.pos={x:36,y:20};
 expect(command(s,{type:'hunterInput',id:h.id,kind:'basic',held:true,aim:{x:h.pos.x+8,y:h.pos.y}} as any).ok).toBe(true);
 run(s,105);const started=s.combatIdentity?.trace.filter(x=>x.type==='action-started'&&x.context?.kind==='basic');
 expect(started?.slice(0,4).map(x=>x.context?.stageIndex)).toEqual([0,1,2,3]);
 expect(h.pos.x).toBeGreaterThan(15.5);
});
test('guard charges frost only on qualified front contact and recovers after delay',()=>{
 const {s,h,e}=setup('loop',742);e.pos={x:h.pos.x+1,y:h.pos.y};
 expect(command(s,{type:'hunterInput',id:h.id,kind:'guard',held:true,aim:e.pos} as any).ok).toBe(true);run(s,9);
 const hp=h.hp;resolveHit(s,h,e.weapons[0],10,e);expect(h.hp).toBe(hp);expect((h as any).hunterCombat.frost).toBe(2);
 command(s,{type:'hunterInput',id:h.id,kind:'guard',held:false} as any);run(s,100);expect((h as any).hunterCombat.frost).toBe(2);
 run(s,120);expect((h as any).hunterCombat.frost).toBeGreaterThan(2);
});
test('dodge spends a charge and active pays at root Attack even on empty ground',()=>{
 const {s,h}=setup('loop',742);
 expect(command(s,{type:'hunterInput',id:h.id,kind:'dodge',direction:{x:0,y:1}} as any).ok).toBe(true);expect((h as any).hunterCombat.dodgeCharges).toBe(1);run(s,40);
 expect(command(s,{type:'hunterInput',id:h.id,kind:'active',held:true,aim:{x:h.pos.x+6,y:h.pos.y}} as any).ok).toBe(true);
 expect((h as any).hunterCombat.activeCharge).toBe(1);run(s,20);command(s,{type:'hunterInput',id:h.id,kind:'active',held:false} as any);run(s,3);
 expect((h as any).hunterCombat.activeCharge).toBe(0);expect((h as any).hunterCombat.activeCooldown).toBeGreaterThan(7);
});
