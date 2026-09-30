import {it,expect} from 'vitest';
import {arena,foe} from './rework-fixtures';
import {command,step} from '../src/core/engine';
import {currentSkill} from '../src/core/progression';
import {skillAreas} from '../src/view/skill-areas';
it('shows fixed field/core borders and removes them on interruption',()=>{const s=arena(),u=s.units[2];u.life='active';u.pos={x:5,y:5};u.skillId='sanctuary';currentSkill(u).cd=0;currentSkill(u).stage=2;command(s,{type:'skill',id:u.id});expect(skillAreas(s).map(a=>a.radius)).toEqual([3.2,1.6]);command(s,{type:'move',id:u.id,to:{x:5,y:7}});expect(skillAreas(s)).toEqual([]);});
it('shows bounded traces and a stationary clone virtual head without duplicating body occupancy',()=>{const s=arena(),u=s.units[1];u.life='active';u.pos={x:5,y:5};u.skillId='reap';command(s,{type:'clone',id:u.id,to:{x:8,y:5}});const c=s.units.at(-1)!;currentSkill(c).counter=5;foe(s,9,5);step(s,.1);const a=skillAreas(s).find(a=>a.id===c.id+':virtual');expect(a?.center.x).toBeGreaterThan(8);expect(c.pos).toEqual({x:8,y:5});});
