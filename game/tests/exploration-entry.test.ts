import {expect,test} from 'vitest';
import {createGame,command,step} from '../src/core/engine';

// Catches opening an exploration node through a debug-only command or an unopened branch.
test('normal node map opens the exploration branch only after the short defense',()=>{
 const s=createGame();command(s,{type:'carry',gold:0,vitality:0});s.phase='nodes';
 expect(command(s,{type:'enter',node:4}).ok).toBe(false);
 s.completed.push(1);
 expect(command(s,{type:'enter',node:4}).ok).toBe(true);
 expect(s.phase).toBe('battle');expect(s.ruleset).toBe('exploration');expect(s.context).toBe('explorationIdle');
 expect([s.width,s.height]).toEqual([28,20]);expect(s.waves).toEqual([]);expect(s.waveState).toBeNull();
 expect(s.units.filter(u=>u.team==='enemy').length).toBeGreaterThan(0);
 expect(s.units.find(u=>u.id==='hunter')!.hp).toBe(360);
 expect(command(s,{type:'enter',node:4}).ok).toBe(false);
});

// Catches applying tower crystal failure to a scene with no defense objective.
test('exploration runs while idle without crystal failure or tower spawns',()=>{
 const s=createGame();command(s,{type:'carry',gold:0,vitality:0});s.completed.push(1);s.phase='nodes';
 expect(command(s,{type:'enter',node:4}).ok).toBe(true);
 s.crystalHp=0;const enemies=s.units.filter(u=>u.team==='enemy').map(u=>u.id),retries=s.retries;
 step(s,2);
 expect(s.phase).toBe('battle');expect(s.time).toBeCloseTo(2);expect(s.retries).toBe(retries);
 expect(s.units.filter(u=>u.team==='enemy').map(u=>u.id)).toEqual(enemies);
});
