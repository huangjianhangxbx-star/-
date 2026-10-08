import {test,expect} from 'vitest';
import {command,step,resolveHit} from '../src/core/engine';
import {requestEnemyAction,advanceEnemyAction,enemyCanMove} from '../src/core/enemy-action';
import {commitEnemyRelease,advanceEnemyEntities,interruptEnemyV2} from '../src/core/enemy-attack-entity';
import {setup,profile} from './en01-fixture';
test('EN01 front block, back exposure and immunity are separate actual results',()=>{
 const f=setup();f.al.pos={x:20,y:20};requestEnemyAction(f.s,f.e,profile,f.h);command(f.s,{type:'hunterInput',id:f.h.id,kind:'guard',held:true,aim:{x:5,y:10}});step(f.s,.65);
 expect(f.h.hp).toBeLessThan(f.h.maxHp);expect(f.e.enemyV2!.trace.some(r=>r.hpLost===5&&r.defense==='contact')).toBe(true);
});
test('EN01 target leaves after lock: release remains, actual HP unchanged',()=>{
 const {s,e,h,al}=setup();requestEnemyAction(s,e,profile,h);h.pos={x:15,y:15};al.pos={x:20,y:20};step(s,.8);
 expect(e.enemyV2!.trace.some(x=>x.event==='attack')).toBe(true);expect(e.enemyV2!.trace.some(x=>x.kind==='contact')).toBe(false);expect(h.hp).toBe(h.maxHp);
});
test('EN01 Z switches input ownership without rewriting cached enemy target/caster',()=>{
 const {s,e,h,al}=setup();requestEnemyAction(s,e,profile,h);const before=structuredClone(e.enemyV2!.action);command(s,{type:'controlBody',id:al.id});
 expect(e.enemyV2!.action).toEqual(before);s.time=.6;const r=advanceEnemyAction(s,e)[0];expect(r.context.actorId).toBe(e.id);expect(r.point).toEqual(before!.point);
});
test('EN01 true wall rejects contact after lock and transports cannot fly through it',()=>{
 for(const kind of ['melee','transport'] as const){const {s,e,h,al}=setup();al.pos={x:20,y:20};requestEnemyAction(s,e,{...profile,kind},h);s.tiles.find(t=>t.x===11&&t.y===10)!.obstacle=true;step(s,2.2);
  expect(h.hp).toBe(h.maxHp);expect(e.enemyV2!.trace.some(r=>r.kind==='blocked'&&r.reason==='wall')).toBe(true);
 }
});
test('EN01 released delayed transport survives main body death and hits through main HP only once',()=>{
 const {s,e,h,al}=setup();al.pos={x:20,y:20};requestEnemyAction(s,e,{...profile,kind:'transport'},h);step(s,.62);resolveHit(s,e,h.weapons[0],100,h,{postureDamage:0});expect(e.life).toBe('dead');
 step(s,1.5);expect(h.hp).toBe(h.maxHp-5);expect(e.enemyV2!.action).toBeUndefined();expect(e.enemyV2!.trace.filter(r=>r.targetId===h.id&&r.kind==='contact')).toHaveLength(1);
});
test('EN01 Finish does not remove precommitted future spawn; clear cancellation does',()=>{
 for(const clear of [false,true]){const {s,e,h}=setup();requestEnemyAction(s,e,{...profile,kind:'transport',spawnDelay:2,cancelPolicy:clear?'clear':'retain'},h);s.time=.6;commitEnemyRelease(s,advanceEnemyAction(s,e)[0]);
  s.time=1.3;advanceEnemyAction(s,e);expect(e.enemyV2!.action).toBeUndefined();expect(s.enemyRuntime!.entities).toHaveLength(1);interruptEnemyV2(s,e,'hurt');
  s.time=2.7;advanceEnemyEntities(s,()=>({accepted:true,hpLost:0}));expect(s.enemyRuntime!.entities).toHaveLength(clear?0:1);
 }
});
test('EN01 different entities under one root retain independent per-target contacts',()=>{
 const {s,e,h,al}=setup();requestEnemyAction(s,e,profile,h);s.time=.6;const r=advanceEnemyAction(s,e)[0];commitEnemyRelease(s,r);commitEnemyRelease(s,r);let hits=0;
 advanceEnemyEntities(s,()=>{hits++;return {accepted:true,hpLost:5};});advanceEnemyEntities(s,()=>{hits++;return {accepted:true,hpLost:5};});expect(hits).toBe(4);expect(s.enemyRuntime!.entities[0].context.rootActionId).toBe(s.enemyRuntime!.entities[1].context.rootActionId);
});
test('EN01 qualification rejects range, LOS, stun and death without CD or ID payment',()=>{
 for(const reason of ['range','unseen','hurt','dead'] as const){const {s,e,h}=setup();if(reason==='range')h.pos={x:14,y:10};if(reason==='unseen')s.tiles.find(t=>t.x===11&&t.y===10)!.obstacle=true;if(reason==='hurt')e.stagger=.5;if(reason==='dead')e.life='dead';
  expect(requestEnemyAction(s,e,profile,h).reason).toBe(reason);expect(e.enemyV2!.readyAt).toBe(0);expect(e.enemyV2!.action).toBeUndefined();expect(s.combatIdentity?.nextRuntimeActionId??1).toBe(1);
 }
});
test('EN01 pauses, slow/normal/double rates and low-frame main dt consume the same ordered events',()=>{
 const runs=[.1,1,2].map(rate=>{const {s,e,h,al}=setup();h.pos={x:10,y:10};al.pos={x:20,y:20};requestEnemyAction(s,e,profile,h);h.pos={x:20,y:10};step(s,0,1);step(s,1.4,1.4/rate);return e.enemyV2!.trace.filter(x=>x.kind==='event').map(x=>({at:x.at,event:x.event}));});
 expect(runs[0]).toEqual(runs[1]);expect(runs[2]).toEqual(runs[1]);expect(runs[0]).toHaveLength(6);
});
test('EN01 MoveReady is not inferred from AttackReady',()=>{
 const {s,e,h}=setup();requestEnemyAction(s,e,profile,h);s.time=1.02;advanceEnemyAction(s,e);expect(enemyCanMove(e)).toBe(false);s.time=1.11;advanceEnemyAction(s,e);expect(enemyCanMove(e)).toBe(true);
});

test('EN01 main Hitstop delays the shared clock without replaying enemy events',()=>{
 const {s,e,h,al}=setup();requestEnemyAction(s,e,profile,h);h.pos={x:20,y:10};al.pos={x:20,y:20};
 s.combatHitstop={until:(s.realTime??s.time)+.5,scale:.15,actorId:h.id};
 step(s,.6,.6);expect(s.time).toBeLessThan(.6);expect(e.enemyV2!.trace.some(r=>r.event==='attack')).toBe(false);
 step(s,1.3,1.3);expect(e.enemyV2!.trace.filter(r=>r.kind==='event').map(r=>r.event)).toEqual(profile.events.map(r=>r.kind));
 expect(e.enemyV2!.trace.filter(r=>r.event==='attack')).toHaveLength(1);
});
