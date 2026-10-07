import {test,expect} from 'vitest';
import {resolveBasicDefinition} from '../src/core/basic-definition';
import {createGame,command} from '../src/core/engine';
test('standalone hunter selects the approved four stage golden topology',()=>{
 const s=createGame();command(s,{type:'selectJourney',journey:'exploration'});
 const h=s.units.find(u=>u.id==='hunter')!,d=resolveBasicDefinition(h);
 expect(d.id).toBe('hunter-v2');expect(d.stages.map(x=>x.releaseAt)).toEqual([.0333,0,.0333,.1333]);
});
