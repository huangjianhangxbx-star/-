import {expect,test} from 'vitest';
import {createGame,command,resolveHit} from '../src/core/engine';
import {standaloneSummary} from '../src/core/standalone-summary';
import {movementAnimationRate} from '../src/view/movement-animation';
function run(){const s=createGame();command(s,{type:'selectJourney',journey:'exploration'});command(s,{type:'selectExplorationCompanion',id:'ines'});command(s,{type:'carry',gold:0,vitality:0});return s;}
test('run-only animation rate is bounded; action and tower timings stay original',()=>{const s=run(),h=s.units[0];expect(movementAnimationRate(s,h,'move')).toBeGreaterThan(1);expect(movementAnimationRate(s,h,'move')).toBeLessThanOrEqual(1.35);for(const action of ['idle','attack','skill','dead'] as const)expect(movementAnimationRate(s,h,action)).toBe(1);h.skillTime=1;expect(movementAnimationRate(s,h,'move')).toBe(1);const t=createGame();expect(movementAnimationRate(t,t.units[0],'move')).toBe(1);});
test('run summary records first casualty time, count and actual received damage',()=>{const s=run(),h=s.units[0],e=s.units.find(u=>u.team==='enemy')!;h.dodge=0;s.time=12.5;resolveHit(s,h,e.weapons[0],10000,e);expect(standaloneSummary(s)).toMatchObject({firstCasualtySeconds:12.5,casualties:1,damageTaken:360});});
