import {describe, expect, it} from 'vitest';
import {LabWorld,canInterrupt} from '../../src/action-lab/runtime/world';

describe('AL01 SAMPLE playable authority', () => {
  it('a later buffered input cannot rewrite the originating request of a running action event',()=>{
    const w=new LabWorld();w.enemy.enabled=false;w.press();w.release();w.advance(.05);const id=w.blue.action!.id;
    w.press();w.release();w.advance(.19);
    const event=w.log.find(e=>e.actionInstanceId===id&&e.eventKind==='track-event'&&e.result==='Break');
    expect(event?.inputRequestId).toBe(1);
  });
  it('equal toughness damages without interruption; only strict greater interrupts',()=>{
    expect(canInterrupt(1,1)).toBe(false);expect(canInterrupt(1,0)).toBe(true);
    const w=new LabWorld();w.reset(true);w.enemy.toughness=1;w.enemy.cooldown=0;w.advance(.01);
    w.press();w.release();w.advance(.08);expect(w.enemy.hp).toBe(95);expect(w.enemy.action).toBeDefined();
    expect(w.enemy.hurtUntil).toBe(0);
  });
  it('the active enemy can kill an idle player; death suppresses further attacks and reset clears it',()=>{
    const w=new LabWorld();w.reset(true);for(let i=0;i<8;i++)w.advance(30);
    expect(w.blue.hp).toBe(0);expect(w.log.some(e=>e.eventKind==='death'&&e.actorId==='blue')).toBe(true);
    const actions=w.log.filter(e=>e.eventKind==='accepted').length;w.press();w.advance(2);
    expect(w.log.filter(e=>e.eventKind==='accepted')).toHaveLength(actions);w.reset();expect(w.blue.hp).toBe(100);
  });
  it('zero time never accepts a buffered action or changes position',()=>{
    const w=new LabWorld();w.press();w.advance(0);expect(w.blue.action).toBeUndefined();expect(w.realTime).toBe(0);
  });
  it('a real whiff advances on acceptance but never manufactures damage', () => {
    const w=new LabWorld(); w.enemy.enabled=false; w.aim={x:-1,y:0}; w.press(); w.release(); w.advance(.12);
    expect(w.nextStage).toBe(1); expect(w.enemy.hp).toBe(110);
    expect(w.log.some(e=>e.eventKind==='hazard-created')).toBe(true);
    expect(w.log.some(e=>e.eventKind==='damage')).toBe(false);
  });
  it('held traverses four accepted stages and can start a fresh set; release stops retry', () => {
    const w=new LabWorld(); w.enemy.enabled=false; w.aim={x:-1,y:0}; w.press(); w.advance(2.5); w.release();
    const accepted=w.log.filter(e=>e.eventKind==='accepted'&&e.actorId==='blue').map(e=>e.stage);
    expect(accepted.slice(0,5)).toEqual([0,1,2,3,0]);
    const count=accepted.length; w.advance(2);
    expect(w.log.filter(e=>e.eventKind==='accepted'&&e.actorId==='blue')).toHaveLength(count);
  });
  it('expired edge cannot fire after a lock expires', () => {
    const w=new LabWorld(); w.enemy.enabled=false; w.blue.hurtUntil=1; w.press(); w.release(); w.advance(1.2);
    expect(w.log.some(e=>e.eventKind==='accepted')).toBe(false);
  });
  it('Break unlocks attack, End unlocks movement, and movement truly cancels the old track', () => {
    const w=new LabWorld(); w.enemy.enabled=false; w.press(); w.release(); w.advance(.21);
    w.move={x:0,y:1}; const y=w.blue.y; w.advance(.01); expect(w.blue.y).toBe(y);
    w.advance(.04); expect(w.blue.y).toBeGreaterThan(y);
    expect(w.blue.action).toBeUndefined();
    expect(w.log.some(e=>e.eventKind==='cancel'&&e.result==='move')).toBe(true);
  });
  it('two qualification checks refuse a facing mismatch even when in range', () => {
    const w=new LabWorld(); w.blue.x=0; w.enemy.x=1.4; w.enemy.y=0; w.enemy.facing=0; w.enemy.cooldown=0;
    expect(w.enemyReady(true)).toBe(true); expect(w.enemyReady(false)).toBe(false);
    w.advance(.01);
    expect(w.log.some(e=>e.actorId==='zombie'&&e.eventKind==='accepted')).toBe(false);
    expect(w.enemy.reject).toBe('facing');
  });
  it('real sector contact loses HP and a prior interrupt prevents a future enemy Hit', () => {
    const w=new LabWorld(); w.blue.x=0; w.enemy.x=1.2; w.enemy.y=0; w.enemy.facing=Math.PI; w.enemy.cooldown=0;
    w.advance(.01); expect(w.enemy.action).toBeDefined();
    w.aim={x:1,y:0}; w.press(); w.release(); w.advance(.6);
    expect(w.enemy.hp).toBe(95); expect(w.blue.hp).toBe(100);
    expect(w.log.some(e=>e.actorId==='zombie'&&e.eventKind==='cancel'&&e.result==='hurt')).toBe(true);
    expect(w.log.some(e=>e.actorId==='zombie'&&e.eventKind==='hazard-created')).toBe(false);
  });
  it('an already generated zombie danger survives an action interrupt until its lifetime', () => {
    const w=new LabWorld(); w.blue.x=0; w.enemy.x=1.5; w.enemy.y=0; w.enemy.facing=Math.PI; w.enemy.cooldown=0;
    w.advance(.575);
    expect(w.hazards.some(h=>h.owner==='zombie')).toBe(true);
    w.interrupt(w.enemy,'hurt');
    expect(w.hazards.some(h=>h.owner==='zombie')).toBe(true);
    w.advance(.4); expect(w.hazards.some(h=>h.owner==='zombie')).toBe(false);
  });
  it('low FPS produces the same gameplay as fine stepping and reset isolates the prior generation', () => {
    const a=new LabWorld(),b=new LabWorld(); a.enemy.enabled=b.enemy.enabled=false;
    a.press();b.press(); a.advance(.6); for(let i=0;i<60;i++)b.advance(.01);
    expect(a.log.filter(e=>e.eventKind==='track-event').map(e=>e.result)).toEqual(b.log.filter(e=>e.eventKind==='track-event').map(e=>e.result));
    const generation=a.generation; a.reset(); a.advance(1);
    expect(a.generation).toBe(generation+1); expect(a.hazards).toEqual([]); expect(a.blue.hp).toBe(100);
  });
  it('pause clears held input and does not advance simulation', () => {
    const w=new LabWorld(); w.enemy.enabled=false; w.press(); w.pause(true); w.advance(1);
    expect(w.simTime).toBe(0); expect(w.input.held).toBe(false);
    w.pause(false);w.advance(.1);expect(w.blue.action).toBeUndefined();
  });
});
