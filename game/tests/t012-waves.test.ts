import {test,expect} from 'vitest';
import {createGame,command,step,resolveHit} from '../src/core/engine';
import type {GameState} from '../src/core/types';
import {createWaveRuntime,wavePreviews,validateWaves} from '../src/core/waves';
import {currentSkill} from '../src/core/progression';
const route=[{x:21,y:9},{x:18,y:9},{x:18,y:8},{x:2,y:8},{x:2,y:5},{x:0,y:5}];
const entry=(id:string)=>({id,role:'melee',asset:'Dustin',hpScale:.5,damageScale:.5});
const batch=(id:string,offset=0,count=1)=>({id,route,offset,interval:2,previewSeconds:5,entries:Array.from({length:count},(_,i)=>entry('e'+i))});
function setup(waves:any[]){const s:any=createGame();command(s,{type:'carry',gold:0,vitality:0});s.waves=waves;s.totalEnemies=waves.reduce((n,w)=>n+w.batches.reduce((a:number,b:any)=>a+b.entries.length,0),0);s.waveState={index:0,phase:'waiting',anchor:18,spawned:{},intermissionUntil:null};command(s,{type:'start'});s.units.forEach((u:any)=>u.life='reserve');return s as GameState;}
const kill=(s:GameState)=>s.units.filter(u=>u.team==='enemy'&&u.life==='active').forEach(u=>{u.dodge=0;resolveHit(s,u,u.weapons[0],10000);});
test('a later batch keeps an empty field inside its current wave',()=>{const s:any=setup([{id:'w1',batches:[batch('a'),batch('b',10)]},{id:'w2',batches:[batch('a')]}]);step(s,18.05);expect(s.spawned).toBe(1);kill(s);step(s,9);expect(s.waveState.phase).not.toBe('intermission');expect(s.result).toBeNull();step(s,1);expect(s.spawned).toBe(2);expect(s.waveState.index).toBe(0);});
test('a living controlled returning enemy prevents wave advancement',()=>{const s:any=setup([{id:'w1',batches:[batch('a')]},{id:'w2',batches:[batch('a')]}]);step(s,18.05);const e=s.units.find((u:any)=>u.team==='enemy')!;expect(e).toBeDefined();e.enemyMotion='return';e.returnPoint={...e.pos};e.statuses=[{kind:'stun',remaining:100,power:0}];step(s,20);expect(s.waveState.index).toBe(0);expect(s.waveState.phase).toBe('clearing');});
test('one clear starts one five-second intermission and leaves the simulation clock continuous',()=>{const s:any=setup([{id:'w1',batches:[batch('a')]},{id:'w2',batches:[batch('a')]}]);step(s,18.05);expect(s.spawned).toBe(1);kill(s);step(s,.05);expect(s.waveState.phase).toBe('intermission');const end=s.waveState.intermissionUntil;step(s,4.9);expect(s.waveState.intermissionUntil).toBe(end);expect(s.spawned).toBe(1);step(s,.15);expect(s.spawned).toBe(2);expect(s.time).toBeGreaterThan(23);expect(s.result).toBeNull();kill(s);step(s,.05);expect(s.result).toBe('victory');});
test('simultaneous batches generate every slot once under different step sizes',()=>{const defs=[{id:'w1',batches:[batch('a',0,3),batch('b',0,3)]}];const a=setup(defs),b=setup(defs);step(a,23);for(let i=0;i<230;i++)step(b,.1);expect(a.spawned).toBe(6);expect(b.spawned).toBe(6);const keys=(s:GameState)=>s.units.filter(u=>u.team==='enemy').map(u=>u.rewardKey).sort();expect(new Set(keys(a)).size).toBe(6);expect(keys(a)).toEqual(keys(b));});
test.each([0,1,2])('abandoning a battle with %i retries consumes only one node failure',retries=>{const s:any=setup([{id:'w1',batches:[batch('a')]}]);s.retries=retries;s.fragments=27;const r=command(s,{type:'abandonBattle'} as any);expect(r.ok).toBe(true);expect(s.phase).toBe('result');expect(s.result).toBe('defeat');expect(s.endReason).toBe('abandon');expect(s.retries).toBe(Math.max(0,retries-1));expect(s.economy.active).toBe(retries>0);expect(s.fragments).toBe(retries>0?27:0);expect(command(s,{type:'abandonBattle'} as any).ok).toBe(false);expect(s.retries).toBe(Math.max(0,retries-1));});

test('bad definitions fail explicitly before an attempt can start',()=>{
 const valid=[{id:'w1',batches:[batch('a')]}];expect(()=>validateWaves(valid as any)).not.toThrow();
 const invalid:any[][]=[[],[valid[0],valid[0]],[{id:'w',batches:[]}]];
 for(const changes of [{offset:-1},{interval:0},{previewSeconds:NaN},{route:[{x:0,y:0}]},{entries:[]},{entries:[entry('same'),entry('same')]},{entries:[{...entry('bad'),hpScale:0}]}])invalid.push([{id:'w',batches:[{...batch('a'),...changes}]}]);
 invalid.push([{id:'w',batches:[batch('a'),batch('a')]}]);
 for(const config of invalid)expect(()=>createWaveRuntime(config as any)).toThrow();
});
test('same route previews retain different batch identities and overlap next-wave intermission',()=>{
 const s=setup([{id:'w1',batches:[batch('a'),batch('b',1)]},{id:'w2',batches:[batch('a')]}]);
 step(s,14);expect(wavePreviews(s).map(p=>p.id)).toEqual(['w1/a','w1/b']);
 expect(wavePreviews(s).map(p=>p.startAt)).toEqual([18,19]);step(s,5.1);kill(s);step(s,.05);
 expect(s.waveState?.phase).toBe('intermission');expect(wavePreviews(s).map(p=>p.id)).toEqual(['w2/a']);
 expect(s.spawned).toBe(2);step(s,4.9);expect(s.spawned).toBe(2);step(s,.15);expect(s.spawned).toBe(3);expect(wavePreviews(s)).toEqual([]);
});
test('intermission preserves shadows, damage, build, cards and prices while clocks keep running',()=>{
 const s=setup([{id:'w1',batches:[batch('a')]},{id:'w2',batches:[batch('a')]}]);
 const h=s.units[0];h.life='active';h.hp=123;h.weapons[0].durability=7;s.fragments=80;
 expect(command(s,{type:'upgradeSkill',id:'ranger',kind:'stage',expectedLevel:0}).ok).toBe(true);
 expect(command(s,{type:'draw',expectedPrice:10}).ok).toBe(true);expect(command(s,{type:'clone',id:h.id,to:{x:3,y:4}}).ok).toBe(true);
 const clone=s.units.find(u=>u.cloneOf)!,cards=s.cards.map(c=>c.id),r=s.units.find(u=>u.id==='ranger')!;
 step(s,18.05);kill(s);step(s,.05);const balance=s.fragments;
 h.statuses=[{kind:'attack',remaining:10,power:2}];h.blink!.charges=8;h.blink!.progress=0;
 const f=s.units.find(u=>u.id==='fiorre')!;f.life='downed';f.downTimer=30;f.hp=0;
 currentSkill(h).cd=10;
 step(s,4.9);expect(s.waveState?.phase).toBe('intermission');expect(s.units).toContain(clone);
 expect(h.hp).toBe(123);expect(h.weapons[0].durability).toBe(7);expect(currentSkill(h).cd).toBeCloseTo(5.1);
 expect(h.statuses[0].remaining).toBeCloseTo(5.1);expect(h.blink!.charges).toBeLessThan(10);
 expect(f.life).toBe('downed');expect(f.downTimer).toBeCloseTo(25.1);
 expect(currentSkill(r).stage).toBe(1);expect(s.fragments).toBe(balance);expect(s.economy.draws).toBe(1);expect(s.cards.map(c=>c.id)).toEqual(cards);
 expect(command(s,{type:'configureSkill',id:'fiorre',skillId:'ward'}).ok).toBe(false);
 step(s,.15);expect(s.waveState?.index).toBe(1);expect(s.units).toContain(clone);expect(s.economy.draws).toBe(1);
});
test('last leak destroys the crystal before final-wave victory can settle',()=>{
 const s=setup([{id:'w1',batches:[batch('a')]}]);step(s,18.05);const e=s.units.find(u=>u.team==='enemy')!;
 e.pos={x:s.goal.x+.01,y:s.goal.y};e.drawPos={...e.pos};e.path=[{...s.goal}];e.route=[{...s.goal}];e.routeIndex=0;s.crystalHp=1;
 step(s,.1);expect(s.result).toBe('defeat');expect(s.endReason).toBe('crystal');expect(s.kills).toBe(0);expect(s.fragments).toBe(0);
});
