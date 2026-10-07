import {describe,it,expect} from 'vitest';
import {LabWorld} from '../../src/action-lab/runtime/world';
describe('AL02 limited four-build playable integration',()=>{
  it('replaces actual third skill once, pays on whiff and spawns a delayed column after body cancel',()=>{
    const w=new LabWorld();w.setBuild('ice');w.enemy.enabled=false;w.nextStage=2;w.aim={x:-1,y:0};
    w.press();w.release();w.advance(.12);
    expect(w.blue.action?.pose).toBe('a改戳地跳');expect(w.nextStage).toBe(3);
    expect(w.log.filter(e=>e.eventKind==='ice-payment')).toHaveLength(1);
    expect(w.log.find(e=>e.eventKind==='attack-event')?.executedSkillId).toBe('小蓝a4.8戳地');
    w.interrupt(w.blue,'test-cancel');w.advance(.22);expect(w.columns).toHaveLength(1);
    expect(w.enemy.hp).toBe(110);expect(w.resources.mp).toBe(100);
  });
  it('insufficient frost skips old a3 to a4 without a fake ice attack',()=>{
    const w=new LabWorld();w.setBuild('ice');w.enemy.enabled=false;w.nextStage=2;w.resources.frost=0;
    w.press();w.release();w.advance(.06);
    expect(w.blue.action?.stage).toBe(3);expect(w.log.some(e=>e.eventKind==='ice-payment')).toBe(false);
    expect(w.log.some(e=>e.executedSkillId==='小蓝a3'&&e.eventKind==='attack-event')).toBe(false);
  });
  it('prechecked ice loses resource before release, then produces no attack or column',()=>{
    const w=new LabWorld();w.setBuild('ice');w.enemy.enabled=false;w.nextStage=2;w.press();w.release();w.advance(.03);
    w.resources.frost=0;w.advance(.09);expect(w.blue.action).toBeUndefined();w.advance(.3);
    expect(w.columns).toHaveLength(0);expect(w.log.some(e=>e.eventKind==='attack-event')).toBe(false);
  });
  it('axe is independent, whiff still starts CD and B3 actual ice triggers the same consumer',()=>{
    const w=new LabWorld();w.setBuild('ice-axe');w.enemy.enabled=false;w.nextStage=2;w.aim={x:-1,y:0};
    w.press();w.release();w.advance(.12);const action=w.blue.action;
    expect(w.axeCooldown).toBeGreaterThan(7.9);expect(w.log.filter(e=>e.eventKind==='axe-created')).toHaveLength(1);
    expect(w.effects).toHaveLength(1);w.advance(.15);expect(w.blue.action).toBe(action);
    expect(w.enemy.hp).toBe(110);expect(w.log.find(e=>e.eventKind==='axe-created')?.executedSkillId).toBe('小蓝a4.8戳地');
  });
  it('B3 has real independent damage; reset back to base isolates all old entities',()=>{
    const w=new LabWorld();w.setBuild('ice-axe',true);w.enemy.enabled=false;w.nextStage=2;
    w.press();w.release();w.advance(.3);expect(w.log.some(e=>e.eventKind==='damage'&&e.result==='axe-contact')).toBe(true);
    w.setBuild('base');expect(w.columns).toHaveLength(0);expect(w.effects).toHaveLength(0);expect(w.axeCooldown).toBe(0);
    w.enemy.enabled=false;w.nextStage=2;w.press();w.release();w.advance(.1);expect(w.blue.action?.pose).toBe('a3');
  });
  it('damage retains actual auxiliary and initiating attack identities',()=>{
    const w=new LabWorld();w.setBuild('ice-axe',true);w.enemy.enabled=false;w.nextStage=2;
    w.press();w.release();w.advance(.3);
    const damage=w.log.find(e=>e.eventKind==='damage'&&e.result==='axe-contact')!;
    expect(damage.executedSkillId).toBe('兽人的大斧挥舞一');expect(damage.sourceSkillId).toBe('小蓝a4.8戳地');
    expect(damage.attackEventId).toBe(w.log.find(e=>e.eventKind==='attack-event')?.attackEventId);
  });
  it('reports CD rejection without an extra successful request',()=>{
    const w=new LabWorld();w.setBuild('axe');w.enemy.enabled=false;w.aim={x:-1,y:0};w.press();w.advance(.7);w.release();
    expect(w.log.filter(e=>e.eventKind==='axe-created')).toHaveLength(1);
    expect(w.log.some(e=>e.eventKind==='axe-rejected'&&e.result==='cooldown')).toBe(true);
  });
  it('paused CD/delays do not advance and old generation never spawns into reset',()=>{
    const w=new LabWorld();w.setBuild('ice-axe');w.enemy.enabled=false;w.nextStage=2;w.press();w.release();w.advance(.12);
    const cd=w.axeCooldown;w.pause(true);w.advance(20);expect(w.axeCooldown).toBe(cd);expect(w.columns).toHaveLength(0);
    w.reset();w.enemy.enabled=false;w.advance(1);expect(w.columns).toHaveLength(0);expect(w.effects).toHaveLength(0);
  });
  it('column destruction checks actual no-shatter / shield tags, and expiry makes no burst',()=>{
    const w=new LabWorld();w.setBuild('ice');w.enemy.enabled=false;w.nextStage=2;w.press();w.release();w.advance(.35);
    const column=w.columns[0];w.interrupt(w.blue,'fixture');w.blue.x=column.x-1;w.blue.y=column.y;
    const hazard=(id:number,tags:string[])=>({id,kind:'basic' as const,skillTags:tags,rootId:id,parentId:null,actionId:id,owner:'blue' as const,stage:0,facing:0,range:2,halfAngle:1,damage:15,expires:w.simTime+.1,generation:w.generation,requestId:null,hit:false});
    w.hazards.push(hazard(100,['不碎冰','盾击']));w.advance(.01);expect(column.hp).toBe(4);
    w.hazards=[];w.hazards.push(hazard(101,['盾击']));w.advance(.02);expect(w.columns).toHaveLength(0);
    expect(w.log.some(e=>e.eventKind==='column-shattered')).toBe(true);expect(w.effects.some(e=>e.kind==='ice-burst')).toBe(true);
    w.reset();w.enemy.enabled=false;w.nextStage=2;w.press();w.release();w.advance(.4);w.interrupt(w.blue,'fixture');w.advance(8);
    expect(w.columns).toHaveLength(0);expect(w.log.some(e=>e.eventKind==='column-expired')).toBe(true);
    expect(w.log.some(e=>e.eventKind==='column-shattered')).toBe(false);
  });
});
it('auxiliary publishes its own non-left attack and cannot recurse through equipment',()=>{
 const w=new LabWorld();w.setBuild('ice-axe');w.enemy.enabled=false;w.nextStage=2;w.press();w.release();w.advance(.3);
 expect(w.log.filter(e=>e.eventKind==='axe-created')).toHaveLength(1);
 const child=w.log.find(e=>e.eventKind==='attack-event'&&e.executedSkillId==='兽人的大斧挥舞一');
 expect(child).toBeDefined();expect(child!.parentActionId).toBe(w.log.find(e=>e.eventKind==='axe-created')!.actionInstanceId);
 expect(w.log.some(e=>e.eventKind==='axe-rejected'&&e.result==='qualification')).toBe(true);
});
it('frozen causal log distinguishes loadout, equipment and damage wave',()=>{
 const w=new LabWorld();w.setBuild('ice-axe',true);w.enemy.enabled=false;w.nextStage=2;w.press();w.release();w.advance(.3);
 const attack=w.log.find(e=>e.eventKind==='axe-created')!;const damage=w.log.find(e=>e.result==='axe-contact')!;
 expect(attack.loadoutRevision).toBe(w.generation);expect(attack.equipmentInstanceId).toBeDefined();
 expect(damage.equipmentInstanceId).toBe(attack.equipmentInstanceId);expect(damage.waveId).toBe(damage.effectId);
});
it('pending summon requires living caster while already generated axe has its own finite life',()=>{
 const w=new LabWorld();w.setBuild('ice-axe',true);w.enemy.enabled=false;w.nextStage=2;w.press();w.release();w.advance(.12);
 w.blue.hp=0;w.advance(.2);expect(w.columns).toHaveLength(0);
 expect(w.log.some(e=>e.result==='axe-contact')).toBe(true);w.advance(1);expect(w.effects).toHaveLength(0);
});
it('different frame partitions and slow simulation retain one ice fee, attack and summon',()=>{
 for(const frame of [.016,.25]){const w=new LabWorld();w.setBuild('ice');w.enemy.enabled=false;w.speed=.25;w.nextStage=2;w.press();w.release();
 for(let elapsed=0;elapsed<2;elapsed+=frame)w.advance(frame);
 expect(w.log.filter(e=>e.eventKind==='ice-payment')).toHaveLength(1);expect(w.log.filter(e=>e.eventKind==='column-created')).toHaveLength(1);
 expect(w.log.filter(e=>e.eventKind==='attack-event'&&e.executedSkillId==='小蓝a4.8戳地')).toHaveLength(1);}
});
it('ordinary positive damage decrements column once per wave, then creates real independent burst damage',()=>{
 const w=new LabWorld();w.setBuild('ice');w.enemy.enabled=false;w.nextStage=2;w.aim={x:-1,y:0};w.press();w.release();w.advance(.4);w.interrupt(w.blue,'fixture');
 const c=w.columns[0];w.blue.x=c.x-1;w.blue.y=c.y;w.enemy.x=c.x+1;w.enemy.y=c.y;
 const wave=(id:number,damage:number)=>({id,kind:'basic' as const,rootId:id,parentId:null,actionId:id,owner:'blue' as const,stage:0,facing:0,range:1.2,halfAngle:1,damage,expires:w.simTime+.5,generation:w.generation,requestId:null,hit:false});
 w.hazards=[wave(100,0)];w.advance(.01);expect(c.hp).toBe(4);
 w.hazards=[wave(101,15)];w.advance(.02);expect(c.hp).toBe(3);w.advance(.02);expect(c.hp).toBe(3);
 for(const id of [102,103,104]){w.hazards=[wave(id,15)];w.advance(.01);}w.advance(.03);
 expect(w.log.filter(e=>e.eventKind==='column-shattered')).toHaveLength(1);
 expect(w.log.some(e=>e.eventKind==='damage'&&e.result==='ice-burst-contact'&&e.resourceDelta===-80)).toBe(true);
});
it('already released ice body hazard retains actual identity after body cancellation',()=>{
 const w=new LabWorld();w.setBuild('ice');w.enemy.enabled=false;w.nextStage=2;w.press();w.release();w.advance(.12);
 const id=w.blue.action!.id;w.interrupt(w.blue,'fixture-cancel');w.enemy.x=w.blue.x+1;w.enemy.y=w.blue.y;w.advance(.02);
 const damage=w.log.find(e=>e.eventKind==='damage'&&e.actionInstanceId===id)!;
 expect(damage.executedSkillId).toBe('小蓝a4.8戳地');expect(damage.attackEventId).toBeDefined();expect(damage.slotSkillId).toBe('小蓝a3');
});
