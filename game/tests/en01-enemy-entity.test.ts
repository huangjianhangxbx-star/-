import {test,expect} from 'vitest';
import {requestEnemyAction,advanceEnemyAction,cancelEnemyAction} from '../src/core/enemy-action';
import {resetCombatTrace} from '../src/core/combat-identity';
import {setup,profile} from './en01-fixture';
async function api(){const path='../src/core/enemy-attack-entity.ts';return import(/* @vite-ignore */path).catch(()=>undefined);}
async function release(kind:'melee'|'transport'='melee'){
 const f=setup(),a=await api();requestEnemyAction(f.s,f.e,{...profile,kind},f.h);f.s.time=.6;const r=advanceEnemyAction(f.s,f.e)[0];a?.commitEnemyRelease(f.s,r);return {...f,a};
}
test('EN01 one sector contacts both bodies once, without treating release as a hit',async()=>{
 const {s,a}=await release();expect(s.enemyRuntime?.entities).toHaveLength(1);const targets:string[]=[];const hit=(_e:any,t:any)=>{targets.push(t.id);return {accepted:true,hpLost:5,defense:'contact'};};
 a?.advanceEnemyEntities(s,hit);a?.advanceEnemyEntities(s,hit);expect(targets.sort()).toEqual(['hunter','ranger']);
});
test('EN01 sector can whiff and rejects a real wall separately from immunity',async()=>{
 for(const wall of [false,true]){const {s,h,al,a}=await release();al.pos={x:20,y:20};if(wall)s.tiles.find(t=>t.x===11&&t.y===10)!.obstacle=true;else h.pos={x:11.3,y:13};let hits=0;a?.advanceEnemyEntities(s,()=>{hits++;return {accepted:true,hpLost:5};});expect(hits).toBe(0);expect(s.enemyRuntime?.entities).toHaveLength(1);}
});
test('EN01 precommitted future transport survives finish/death, then emits a distinct landing hazard',async()=>{
 const {s,e,a}=await release('transport');expect(s.enemyRuntime?.entities).toHaveLength(1);const transport=s.enemyRuntime!.entities[0];cancelEnemyAction(s,e,'hurt');e.life='dead';let hits=0;
 expect(transport.attack.actionId).toBe(transport.context.actionId);
 s.time=.8;a?.advanceEnemyEntities(s,()=>{hits++;return {accepted:true,hpLost:5};});expect(hits).toBe(0);
 s.time=1.85;a?.advanceEnemyEntities(s,()=>{hits++;return {accepted:true,hpLost:5};});expect(hits).toBe(2);const landing=s.enemyRuntime!.entities.find(x=>x.kind==='hazard')!;expect(landing.id).not.toBe(transport.id);expect(landing.context.parentActionId).toBe(transport.context.actionId);expect(landing.context.rootActionId).toBe(transport.context.rootActionId);
});
test('EN01 reset destroys old generation and clear policy differs from retain',async()=>{
 const {s,e,a}=await release('transport');resetCombatTrace(s);s.time=3;a?.advanceEnemyEntities(s,()=>{throw Error('old world hit');});expect(s.enemyRuntime?.entities).toHaveLength(0);
 requestEnemyAction(s,e,{...profile,kind:'transport',deathPolicy:'clear'},s.units[0]);s.time=3.6;const r=advanceEnemyAction(s,e)[0];a?.commitEnemyRelease(s,r);e.life='dead';a?.advanceEnemyEntities(s,()=>{throw Error('dead clear policy hit');});expect(s.enemyRuntime?.entities).toHaveLength(0);
});
test('EN01 overdue landing has its scheduled birth identity before its AttackEvent',async()=>{
 const {s,a}=await release('transport');s.time=1.89;a!.advanceEnemyEntities(s,()=>({accepted:true,hpLost:0}));const landing=s.enemyRuntime!.entities.find(e=>e.kind==='hazard')!;
 expect(landing.context.acceptedAt).toBe(landing.spawnAt);expect(landing.attack.releasedAt).toBeGreaterThanOrEqual(landing.context.acceptedAt);
});
