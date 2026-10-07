import {describe,expect,it} from 'vitest';
import {LabWorld} from '../../src/action-lab/runtime/world';
import {ProjectileRuntime} from '../../src/action-lab/runtime/projectiles';
import {al03 as p} from '../../src/action-lab/profiles/al03';
function ranged(){const w=new LabWorld();w.setEncounter('ranged');w.enemy.cooldown=0;return w;}
describe('AL03 approved ballistic chain',()=>{
 it('ballistic flight never damages a crossed actor and emits one landing at exact endpoint',()=>{
  const r=new ProjectileRuntime();r.spawn({id:1,generation:1,ownerId:'ranged',sourceActionId:2,rootActionId:2,position:{x:0,y:0},velocity:{x:10,y:0},radius:.1,damage:3,spawnedAt:0,expiresAt:1,ownerDeath:'retain',kind:'ballistic',landing:{x:10,y:0},height:3.8,duration:1});
  expect(r.advance(.5,1,[{id:'blue',position:{x:5,y:0},radius:.25}])).toEqual([]);expect(r.entities[0].altitude).toBeCloseTo(3.8);
  r.advance(1.2,1,[]);expect(r.landings).toHaveLength(1);expect(r.landings[0].position.x).toBe(10);r.advance(2,1,[]);expect(r.landings).toEqual([]);
 });
 it('candidate and final facing are separate, and rejected final gate never fires',()=>{
  const w=ranged();w.enemy.facing=0;expect(w.enemyReady(true)).toBe(true);expect(w.enemyReady(false)).toBe(false);w.advance(.05);expect(w.projectiles.entities).toHaveLength(0);
 });
 it('Hit emits 1+2 independent entities with immutable target snapshot and replay seed',()=>{
  const a=ranged(),b=ranged();a.advance(.2);b.advance(.2);a.blue.y=3;a.advance(.5);b.advance(.5);
  expect(a.projectiles.entities).toHaveLength(3);expect(a.projectiles.entities.map(e=>e.landing)).toEqual(b.projectiles.entities.map(e=>e.landing));
 });
 it('pre-Hit interruption suppresses spawn; post-Hit interruption and death retain admitted entities',()=>{
  const w=ranged();w.advance(.2);w.interrupt(w.enemy,'fixture-interrupt');w.enemy.enabled=false;w.advance(1);expect(w.projectiles.entities).toHaveLength(0);
  w.setEncounter('ranged');w.enemy.cooldown=0;w.advance(.7);expect(w.projectiles.entities).toHaveLength(3);w.interrupt(w.enemy,'fixture-interrupt');w.enemy.hp=0;w.advance(1.2);
  expect(w.log.filter(e=>e.eventKind==='explosion-created')).toHaveLength(3);expect(w.log.filter(e=>e.eventKind==='accepted')).toHaveLength(1);
 });
 it('same seed stationary contact hits while actual movement misses, no flying damage',()=>{
  const a=ranged(),b=ranged();a.advance(.7);b.advance(.7);expect(a.blue.hp).toBe(100);b.move={x:0,y:1};a.advance(1);b.advance(1);
  expect(a.blue.hp).toBeLessThan(100);expect(b.blue.hp).toBe(100);expect(b.log.some(e=>e.eventKind==='explosion-created')).toBe(true);
 });
 it('pause and quarter speed drive transport by simulation time, reset clears all entities',()=>{
  const w=ranged();w.advance(.7);const pos={...w.projectiles.entities[0].position};w.pause(true);w.advance(5);expect(w.projectiles.entities[0].position).toEqual(pos);
  w.pause(false);w.speed=.25;w.advance(.4);expect(w.projectiles.entities[0].updatedAt).toBeCloseTo(.8);w.reset();expect(w.projectiles.entities).toEqual([]);
 });
 it('front / back / exhausted guard use explosion origin, never the archer current position',()=>{
  for(const mode of ['front','back','empty']){const w=ranged();w.advance(.7);const landing=w.projectiles.entities[0].landing!;w.blue.x=landing.x-.4;w.blue.y=landing.y;w.aim={x:mode==='back'?-1:1,y:0};w.shield(true);w.enemy.x=-7;
   if(mode==='empty')w.resources.frost=0;w.advance(1);
   expect(w.blue.hp===100).toBe(mode==='front');expect(w.log.some(e=>e.eventKind==='block')).toBe(mode==='front');
  }
 });
 it('actual invulnerability contact resolves evade while explosion remains',()=>{
  const w=ranged();w.advance(1.5);const landing=w.projectiles.entities[0].landing!;w.blue.x=landing.x;w.blue.y=landing.y;
  w.defense.protect(99,w.simTime+.2);w.advance(.1);expect(w.blue.hp).toBe(100);expect(w.log.some(e=>e.eventKind==='evade')).toBe(true);expect(w.log.some(e=>e.eventKind==='explosion-created')).toBe(true);
 });
 it('an expired explosion cannot contact a target entering on a later tick',()=>{
  const w=ranged();w.enemy.enabled=false;
  w.hazards.push({kind:'ranged-explosion',id:90,damage:3,projectileId:80,actionId:70,rootId:70,parentId:70,owner:w.enemy.id,stage:-1,facing:0,range:.8,halfAngle:Math.PI,expires:0,generation:w.generation,requestId:null,hit:false,origin:{x:w.blue.x,y:w.blue.y},persistent:true});
  w.advance(.01);expect(w.blue.hp).toBe(100);
 });
 it('mixed enemies retain independent cooldowns and both causal owners',()=>{
  const w=new LabWorld();w.setEncounter('mixed');expect(w.enemies.map(e=>e.id)).toEqual(['zombie','ranged-1']);w.advance(4);
  expect(w.log.some(e=>e.eventKind==='accepted'&&e.actorId==='ranged-1')).toBe(true);expect(w.log.some(e=>e.eventKind==='accepted'&&e.actorId==='zombie')).toBe(true);
  expect(p.sample.landingCount).toBe(3);
 });
});
