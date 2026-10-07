import {test,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {setup} from './ar03-fixture';
import {command,step} from '../src/core/engine';
import {pauseHunter} from '../src/core/hunter-combat';
const golden=JSON.parse(readFileSync('../docs/tasks/AR-05/AR05-golden-reference.json','utf8'));
const cases=JSON.parse(readFileSync('../docs/tasks/AR-05/AR05-frozen-cases.json','utf8'));
function fixture(){const a=setup('loop',742);a.s.units=a.s.units.filter(u=>u.team==='ally'||u.id===a.e.id);a.e.pos={x:a.h.pos.x+4,y:a.h.pos.y};a.e.drawPos={...a.e.pos};a.e.attackTimer=999;a.e.ready=999;a.e.speed=0;a.e.dodge=0;a.h.basicProfileId='hunter-v2';return a;}
test('immutable M3 held oracle matches ordered native events and total linear displacement',()=>{
 const {s,h}=fixture(),x=h.pos.x;command(s,{type:'hunterInput',id:h.id,kind:'basic',aim:{x:x+20,y:h.pos.y},held:true});for(let i=0;i<145;i++)step(s,.01);command(s,{type:'hunterInput',id:h.id,kind:'basic',held:false});
 writeFileSync('../work/AR-05/main-held-trace.json',JSON.stringify({time:s.time,real:s.realTime,pos:h.pos,target:s.units.find(u=>u.team==='enemy')?.pos,trace:h.hunterCombat!.trace},null,2));const expected=golden.events.filter((e:any)=>e.eventKind==='track-event').map((e:any)=>({stage:e.stage,kind:e.result==='Break'?'AttackReady':e.result==='End'?'MoveReady':e.result,at:e.simTime}));
 const actual=h.hunterCombat!.trace.filter(e=>['Dash','Hit','AttackReady','MoveReady'].includes(e.kind));expect(actual.map(e=>[e.stage,e.kind])).toEqual(expected.map((e:any)=>[e.stage,e.kind]));for(let i=0;i<actual.length;i++)expect(Math.abs(actual[i].at-expected[i].at)).toBeLessThanOrEqual(.010001);expect(h.pos.x-x).toBeCloseTo(golden.positionDelta.x,2);
});
test.each(['dodge','active','cancel','pause','slow'])('frozen %s replay: displacement, simulation clock and resource values',kind=>{
 const {s,h}=fixture(),x=h.pos.x,y=h.pos.y;const aim={x:x+20,y};
 if(kind==='dodge')command(s,{type:'hunterInput',id:h.id,kind:'dodge',aim});if(kind==='active'||kind==='cancel')command(s,{type:'hunterInput',id:h.id,kind:'active',aim});if(kind==='slow'||kind==='pause')command(s,{type:'hunterInput',id:h.id,kind:'basic',aim,held:true});
 for(let i=0;i<120;i++){if(i===20&&kind==='active')command(s,{type:'hunterInput',id:h.id,kind:'active',held:false});if(i===10&&kind==='cancel')command(s,{type:'hunterInput',id:h.id,kind:'cancel'});if(i===20&&kind==='pause')pauseHunter(s);if(kind==='pause'&&i>=20&&i<40)continue;step(s,kind==='slow'?.001:.01,.01);}
 const hstate=h.hunterCombat!,g=cases[kind];expect(Math.abs((h.pos.x-x)-g.delta.x)).toBeLessThan(.04);expect(Math.abs(h.pos.y-y-g.delta.y)).toBeLessThan(.04);expect(Math.abs(s.time-g.sim)).toBeLessThan(.010001);expect(hstate.dodgeCharges).toBe(g.resources.dashCharges);expect(hstate.activeCharge).toBe(g.resources.activeCharge);expect(hstate.frost).toBe(g.resources.frost);
});
