import {test,expect} from 'vitest';
import * as identity from '../src/core/combat-identity';
import {configureCombatTrace} from '../src/core/combat-identity';
import {setup,profile,runtime} from './en01-fixture';

test('EN01 authority allocates actor/root identity even when tracing is disabled',()=>{
 const {s,e}=setup();configureCombatTrace(s,false);const c=(identity as any).allocateRuntimeAction?.(s,e,{executedAbilityId:'en01-melee'});
 expect(c?.actorId).toBe('en01-enemy');expect(c?.rootActionId).toBe(c?.actionId);expect(s.combatIdentity!.trace).toHaveLength(0);
});
test('EN01 legal request accepts once; final heading rejection has no CD or identity side effect',async()=>{
 const {s,e,h}=setup(),api=await runtime();const first=api?.requestEnemyAction(s,e,profile,h);expect(first?.ok).toBe(true);
 const id=e.enemyV2!.action!.context.actionId;expect(api?.requestEnemyAction(s,e,profile,h).ok).toBe(false);expect(e.enemyV2!.action!.context.actionId).toBe(id);
 const other=setup();other.e.heading=0;expect(api?.requestEnemyAction(other.s,other.e,profile,other.h).reason).toBe('direction');expect(other.e.enemyV2?.action).toBeUndefined();expect(other.e.enemyV2?.readyAt??0).toBe(0);
});
test('EN01 elapsed events keep source order, two readiness gates and cached aim across a large step',async()=>{
 const {s,e,h}=setup(),api=await runtime();expect(api?.requestEnemyAction(s,e,profile,h).ok).toBe(true);h.pos={x:20,y:10};s.time=1.05;
 const releases=api?.advanceEnemyAction(s,e);expect(releases).toHaveLength(1);expect(releases?.[0].point).toEqual({x:10,y:10});expect(e.enemyV2!.action!.attackReady).toBe(true);expect(e.enemyV2!.action!.moveReady).toBe(false);
 s.time=1.3;api?.advanceEnemyAction(s,e);expect(e.enemyV2!.action).toBeUndefined();expect(e.enemyV2!.trace.filter(r=>r.kind==='event').map(r=>r.event)).toEqual(['prepare','lock','attack','attack-ready','move-ready','finish']);expect(api?.advanceEnemyAction(s,e)).toEqual([]);
});
test('EN01 cancellation before release never produces a future AttackEvent',async()=>{
 const {s,e,h}=setup(),api=await runtime();expect(api?.requestEnemyAction(s,e,profile,h).ok).toBe(true);api?.cancelEnemyAction(s,e,'hurt');s.time=2;
 expect(api?.advanceEnemyAction(s,e)).toEqual([]);expect(e.enemyV2!.trace.some(r=>r.event==='attack')).toBe(false);
});
test('EN01 AttackReady can accept another action while MoveReady is still locked',async()=>{
 const {s,e,h}=setup(),api=await runtime(),p={...profile,cooldown:0};api!.requestEnemyAction(s,e,p,h);s.time=1.02;api!.advanceEnemyAction(s,e);
 expect(e.enemyV2!.action!.attackReady).toBe(true);expect(e.enemyV2!.action!.moveReady).toBe(false);
 expect(api!.requestEnemyAction(s,e,p,h).ok).toBe(true);expect(e.enemyV2!.trace.some(r=>r.reason==='superseded')).toBe(true);
});
test('EN01 control acquired during windup cancels the remaining body events',async()=>{
 const {s,e,h}=setup(),api=await runtime();api!.requestEnemyAction(s,e,profile,h);e.stagger=.2;s.time=.7;
 expect(api!.advanceEnemyAction(s,e)).toEqual([]);expect(e.enemyV2!.action).toBeUndefined();
});
