import {it,expect} from 'vitest';
import {enemyHealth} from '../src/core/enemy-health';
import {makeUnit} from '../src/core/unit-factory';
import {createExplorationEntry,command} from '../src/core/engine';
it('binds only visible active enemies to their real HP and clamps the display ratio',()=>{
 const s=createExplorationEntry();s.sessionMode='exploration';command(s,{type:'selectJourney',journey:'exploration',seed:18});command(s,{type:'carry',gold:0,vitality:0});
 const actor=s.units.find(u=>u.id==='hunter')!;
 const u=makeUnit('enemy','怪物','melee',{...actor.pos},'enemy');u.hp=75;u.maxHp=200;s.units.push(u);
 expect(enemyHealth(s,u)?.ratio).toBe(.375);u.hp=30;expect(enemyHealth(s,u)?.hp).toBe(30);
 u.life='dead';expect(enemyHealth(s,u)).toBeNull();u.life='active';u.team='ally';expect(enemyHealth(s,u)).toBeNull();
 u.team='enemy';u.pos={x:999,y:999};expect(enemyHealth(s,u)).toBeNull();
});
