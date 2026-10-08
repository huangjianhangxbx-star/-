import {test,expect} from 'vitest';
import {step,resolveHit,command} from '../src/core/engine';
import {configureCombatTrace,resetCombatTrace} from '../src/core/combat-identity';
import {setup,profile} from './en01-fixture';
import {requestEnemyAction} from '../src/core/enemy-action';
function ready(){const f=setup();requestEnemyAction(f.s,f.e,profile,f.h);return f;}
test('EN01 main tick owns real HP and never invokes old Intent/reaction/basic fallback',()=>{
 const {s,e,h,al}=ready(),hp=[h.hp,al.hp];step(s,.65);expect(h.hp).toBeLessThan(hp[0]);expect(al.hp).toBeLessThan(hp[1]);expect(e.attackIntent).toBeUndefined();expect(s.stats.telegraphsStarted??0).toBe(0);expect(e.enemyV2!.trace.filter(x=>x.kind==='contact')).toHaveLength(2);
});
test('EN01 trace on/off produces identical IDs, HP, RNG and release times',()=>{
 const run=(enabled:boolean)=>{const {s,e,h,al}=setup();configureCombatTrace(s,enabled);requestEnemyAction(s,e,profile,h);step(s,.8);return {hp:[h.hp,al.hp],seed:s.seed,trace:e.enemyV2!.trace,ids:s.enemyRuntime?.entities.map(x=>({id:x.id,action:x.context.actionId,attack:x.attack.attackEventId}))};};expect(run(false)).toEqual(run(true));
});
test('EN01 real hit before release cancels V2 future events without invoking legacy counter-step',()=>{
 const {s,e,h}=ready();resolveHit(s,e,h.weapons[0],5,h,{postureDamage:0});step(s,.7);expect(e.enemyV2!.trace.some(x=>x.event==='attack')).toBe(false);expect(e.enemyCombat?.reaction).toBeUndefined();
});
test('EN01 real Hunter guard uses direction and Al roll uses the approved immunity window',()=>{
 const {s,h,al,e}=ready();al.pos={x:20,y:20};command(s,{type:'hunterInput',id:h.id,kind:'guard',held:true,aim:e.pos});const hp=h.hp;step(s,.65);expect(h.hp).toBe(hp);expect(h.hunterCombat!.trace.some(x=>x.kind==='block')).toBe(true);
 const f=ready();f.h.pos={x:20,y:20};f.al.pos={x:10.4,y:10};command(f.s,{type:'controlBody',id:f.al.id});step(f.s,.57);command(f.s,{type:'alInput',id:f.al.id,kind:'roll',direction:{x:0,y:1}});const before=f.al.hp;step(f.s,.06);expect(f.al.hp).toBe(before);expect(f.e.enemyV2!.trace.some(x=>x.targetId===f.al.id&&x.defense==='invulnerable')).toBe(true);
});
test('EN01 pause and reset do not leak old attacks into a same-ID replacement',()=>{
 const {s,e,h}=ready();step(s,0,1);expect(s.time).toBe(0);expect(e.enemyV2!.trace.some(x=>x.event==='attack')).toBe(false);resetCombatTrace(s);step(s,.7);expect(h.hp).toBe(h.maxHp);expect(s.enemyRuntime?.entities??[]).toHaveLength(0);
});

test('EN01 Al roll outside its immunity window permits real main HP contact',()=>{
 const f=ready();f.h.pos={x:20,y:20};f.al.pos={x:10.4,y:10};command(f.s,{type:'controlBody',id:f.al.id});
 command(f.s,{type:'alInput',id:f.al.id,kind:'roll',direction:{x:0,y:1}});step(f.s,.57);
 // Controlled geometry fixture returns the body to the sector after its real roll.
 f.al.pos={x:10.4,y:10};const before=f.al.hp;step(f.s,.08);
 expect(f.al.hp).toBeLessThan(before);expect(f.e.enemyV2!.trace.some(r=>r.targetId===f.al.id&&r.defense==='contact'&&r.hpLost!>0)).toBe(true);
});
