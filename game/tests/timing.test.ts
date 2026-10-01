import {createGame} from './economy-fixtures';
import {it,expect} from 'vitest';
import {command,step} from '../src/core/engine';
import {simulationDelta} from '../src/interaction';
it('skill duration and cooldown follow scaled simulation seconds',()=>{
 for(const [slow,speed,elapsed] of [[true,1,.1],[false,1,1],[false,2,2]] as const){
 const s=createGame();command(s,{type:'start'});const h=s.units[0];h.skillCd=0;expect(command(s,{type:'skill',id:'hunter'}).ok).toBe(true);
 for(let i=0;i<60;i++)step(s,simulationDelta(1/60,false,false,slow,speed));expect(h.skillTime).toBeCloseTo(8-elapsed,5);
 h.skillTime=0;h.skillCd=18;for(let i=0;i<60;i++)step(s,simulationDelta(1/60,false,false,slow,speed));expect(h.skillCd).toBeCloseTo(18-elapsed,5);
 const before=h.skillCd;step(s,simulationDelta(.05,true,false,slow,speed));expect(h.skillCd).toBe(before);
 }
});
