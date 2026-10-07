import {describe,expect,it} from 'vitest';
import {LabWorld,type Actor} from '../../src/action-lab/runtime/world';
function pair(w:LabWorld):Actor {
  w.reset(true);w.enemy.enabled=false;
  const second:Actor={...w.enemy,id:'enemy-fixture-2',x:1.3,y:.15,knock:{x:0,y:0}};
  w.enemies.push(second);return second;
}
describe('AL03 finite actor collection / existing attack contracts',()=>{
  it('one body attack contacts two real targets once each',()=>{
    const w=new LabWorld(),second=pair(w);w.press();w.release();w.advance(.1);
    expect(w.enemy.hp).toBe(95);expect(second.hp).toBe(95);
    w.advance(.05);expect(w.enemy.hp).toBe(95);expect(second.hp).toBe(95);
    expect(w.log.filter(e=>e.eventKind==='damage').map(e=>e.targetId)).toEqual(['zombie','enemy-fixture-2']);
  });
  it('a second target outside geometry receives no damage',()=>{
    const w=new LabWorld(),second=pair(w);second.y=3;w.press();w.release();w.advance(.1);
    expect(w.enemy.hp).toBe(95);expect(second.hp).toBe(110);
  });
  it('independent auxiliary axe can contact both targets without duplicating equipment requests',()=>{
    const w=new LabWorld();w.setBuild('axe',true);const second:Actor={...w.enemy,id:'enemy-fixture-2',y:.15,knock:{x:0,y:0},enabled:false};
    w.enemy.enabled=false;w.enemies.push(second);w.press();w.release();w.advance(.25);
    expect(w.log.filter(e=>e.eventKind==='axe-created')).toHaveLength(1);
    expect(w.log.filter(e=>e.eventKind==='damage'&&e.result==='axe-contact').map(e=>e.targetId)).toEqual(['zombie','enemy-fixture-2']);
  });
  it('one shield wave hitting two targets refunds once, with actual target identity',()=>{
    const w=new LabWorld();w.setBuild('energy',true);w.enemy.enabled=false;
    const second:Actor={...w.enemy,id:'enemy-fixture-2',y:.15,knock:{x:0,y:0},enabled:false};w.enemies.push(second);
    w.resources.spendBlock(w.simTime);w.resources.spendBlock(w.simTime);w.resources.spendBlock(w.simTime);
    w.prepareActive();w.advance(.2);w.releaseActive();w.advance(.5);
    expect(w.log.filter(e=>e.eventKind==='damage').map(e=>e.targetId)).toEqual(['zombie','enemy-fixture-2']);
    expect(w.log.filter(e=>e.eventKind==='frost-return')).toHaveLength(1);
    expect(w.resources.frost).toBe(2);
  });
  it('one ice replacement pays and summons once; its burst independently hits both real targets',()=>{
    const w=new LabWorld();w.setBuild('ice',true);w.enemy.enabled=false;w.nextStage=2;
    const second:Actor={...w.enemy,id:'enemy-fixture-2',y:.15,knock:{x:0,y:0},enabled:false};w.enemies.push(second);
    w.press();w.release();w.advance(.35);
    expect(w.log.filter(e=>e.eventKind==='ice-payment')).toHaveLength(1);expect(w.columns).toHaveLength(1);
    expect(w.log.filter(e=>e.eventKind==='damage').map(e=>e.targetId)).toEqual(['zombie','enemy-fixture-2']);
    const c=w.columns[0];w.interrupt(w.blue,'fixture');w.blue.x=c.x-1;w.blue.y=c.y;
    w.hazards.push({id:100,kind:'basic',skillTags:['盾击'],rootId:100,parentId:null,actionId:100,owner:'blue',stage:0,facing:0,range:2,halfAngle:1,damage:1,expires:w.simTime+.1,generation:w.generation,requestId:null,hit:false});
    w.advance(.03);
    expect(w.log.filter(e=>e.eventKind==='damage'&&e.result==='ice-burst-contact').map(e=>e.targetId)).toEqual(['zombie','enemy-fixture-2']);
    expect(w.log.filter(e=>e.eventKind==='column-created')).toHaveLength(1);
  });
  it('reset retires the entire old collection while keeping the legacy first-enemy access',()=>{
    const w=new LabWorld();pair(w);w.reset();expect(w.enemies).toHaveLength(1);expect(w.enemy).toBe(w.enemies[0]);
  });
});
