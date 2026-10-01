import {createGame} from './economy-fixtures';
import {test,expect} from 'vitest';
import {command,step} from '../src/core/engine';
test('movement faces the current segment, including after crossing its midpoint',()=>{
 const s=createGame();command(s,{type:'start'});const u=s.units[0];
 u.pos={x:4,y:4};u.drawPos={...u.pos};command(s,{type:'move',id:u.id,to:{x:3,y:4}});
 step(s,.05);expect(u.facing).toBe('west');
 for(let i=0;i<10;i++)step(s,.05);
 expect(u.facing).toBe('west');
});
