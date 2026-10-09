import {describe,it,expect} from 'vitest';
import {createExplorationEntry,command,step} from '../src/core/engine';
import {standaloneDefinition} from '../src/core/standalone-exploration';
import {usesEnemyPosture} from '../src/core/enemy-posture';
import {requestEnemyAction,advanceEnemyAction} from '../src/core/enemy-action';
import {commitEnemyRelease,enemyWorld} from '../src/core/enemy-attack-entity';
import {visibleEnemyHazards} from '../src/core/enemy-observation';
import {enemyAlert} from '../src/enemy-alerts';
import {updateVision} from '../src/core/visibility';
import previousDefinition from './fixtures/pre-en06-definition.json';
function start(){const s=createExplorationEntry();command(s,{type:'selectExplorationCompanion',id:'ranger'});expect(command(s,{type:'carry',gold:0,vitality:0}).ok).toBe(true);return s;}
function leave(s:ReturnType<typeof start>){for(const u of s.units.filter(u=>u.team==='ally'&&u.life==='active'))u.pos={...s.goal,x:s.goal.x+(u.id==='hunter'?0:.8)};s.context='explorationIdle';expect(command(s,{type:'exitExploration'}).ok).toBe(true);}
describe('EN06-I01 ordinary map replacement',()=>{
 it('every seeded group registers only explicit native families, with stable source IDs and legal density',()=>{
  const current=standaloneDefinition(18),sources=(d:typeof current)=>d.enemies.map(e=>({id:e.id,encounterId:e.encounterId,encounterRoom:e.encounterRoom,pos:e.pos}));
  expect(sources(current)).toEqual(sources(previousDefinition as typeof current));
  expect(current.encounters).toEqual(previousDefinition.encounters);expect(current.points).toEqual(previousDefinition.points);expect(current.tiles).toEqual(previousDefinition.tiles);
  for(const seed of [1,2,18,3107]){const d=standaloneDefinition(seed);expect(d).toEqual(standaloneDefinition(seed));expect(d.enemies.length).toBeLessThanOrEqual(48);expect(d.encounters).toHaveLength(20);
   for(const g of d.encounters!){expect(g.enemyIds.length).toBe(g.tier==='safe'?0:g.tier==='small'?3:4);for(const id of g.enemyIds){const e=d.enemies.find(e=>e.id===id)!;expect((e as any).enemyProfileId).toMatch(/^(zombie|ranged)$/);expect(e.combatKitId).toBeUndefined();expect(e.role).not.toBe('heavy');expect(e.asset).not.toMatch(/Dustin|Verlaine/);}}
  }
  const s=start();for(const e of s.units.filter(u=>u.team==='enemy')){expect(e.enemyV2?.brain).toBeDefined();expect(e.enemyV2?.profile.visual).toMatch(/^(zombie|ranged)$/);expect(e.enemyCombat).toBeUndefined();expect(e.enemySense).toBeUndefined();expect(e.attackIntent).toBeUndefined();expect(usesEnemyPosture(s,e)).toBe(true);}
 });
 it('ordinary new enemy AI moves, releases original events and exposes visible danger through main geometry',()=>{
  const s=start(),h=s.units.find(u=>u.id==='hunter')!,e=s.units.find(u=>u.team==='enemy'&&u.role==='melee')!;expect(e.enemyV2?.brain).toBeDefined();
  // Local unit fixture: map remains real, players do not attack; natural input is tested separately.
  s.units=s.units.filter(u=>u===h||u===e);e.pos={x:h.pos.x+3,y:h.pos.y};e.drawPos={...e.pos};e.enemyV2!.brain!.home={...e.pos};e.heading=Math.PI;const before={...e.pos};
  for(let i=0;i<40;i++)step(s,.1);expect(e.pos).not.toEqual(before);expect(e.enemyV2!.trace.some(r=>r.kind==='accepted')).toBe(true);expect(e.enemyV2!.trace.some(r=>r.event==='attack')).toBe(true);expect(e.enemySense).toBeUndefined();
  expect(s.postureRuntime?.mode).toBe('xinghai');
 });
 it('legal leave and continue retain numeric posture and cooldown while rebuilding home-based brain, never a fixture AI',()=>{
  const s=start(),h=s.units.find(u=>u.id==='hunter')!,e=s.units.find(u=>u.team==='enemy')!;expect(e.enemyV2?.brain).toBeDefined();const home={...e.enemyV2!.brain!.home};
  h.posture=17;h.postureDelay=1.2;e.posture=13;e.postureDelay=.9;e.enemyV2!.readyAt=s.time+9;e.enemyV2!.brain!.known={id:h.id,point:{...h.pos},at:s.time};e.enemyV2!.brain!.decision='approach';
  leave(s);const old=s.combatIdentity!.generation;expect(enemyWorld(s).entities).toEqual([]);expect(command(s,{type:'continueWorld',worldId:s.world!.id,visit:s.world!.visit.generation}).ok).toBe(true);
  expect(s.units).toContain(e);expect(e.enemyV2!.brain!.home).toEqual(home);expect(e.enemyV2!.brain!.known).toBeUndefined();expect(e.enemyV2!.generation).toBeGreaterThan(old);step(s,.01);
  expect(h.posture).toBe(17);expect(e.posture).toBe(13);expect(h.postureDelay).toBeCloseTo(1.19);expect(e.enemyV2!.readyAt).toBe(9);expect(usesEnemyPosture(s,e)).toBe(true);
 });
 it('already committed three-arrow release including future third is discarded on area unload and cannot land after continue',()=>{
  const s=start(),h=s.units.find(u=>u.id==='hunter')!,e=s.units.find(u=>u.team==='enemy'&&u.role==='ranged')!;expect(e.enemyV2).toBeDefined();e.pos={x:h.pos.x+5,y:h.pos.y};e.heading=Math.PI;e.enemyV2!.readyAt=0;
  expect(requestEnemyAction(s,e,e.enemyV2!.profile,h).ok).toBe(true);s.time=.6333;advanceEnemyAction(s,e).forEach(r=>commitEnemyRelease(s,r));expect(enemyWorld(s).entities).toHaveLength(3);expect(enemyWorld(s).entities.filter(e=>e.spawnAt>s.time)).toHaveLength(1);
  leave(s);command(s,{type:'continueWorld',worldId:s.world!.id,visit:s.world!.visit.generation});const hp=h.hp;for(let i=0;i<20;i++)step(s,.1);expect(h.hp).toBe(hp);expect(enemyWorld(s).entities).toEqual([]);
 });
 it('brain alerts and dangerous actors never disclose fogged enemy positions',()=>{
  const s=start(),h=s.units.find(u=>u.id==='hunter')!,e=s.units.find(u=>u.team==='enemy'&&u.role==='melee')!;expect(e.enemyV2?.brain).toBeDefined();e.pos={x:h.pos.x+1,y:h.pos.y};e.heading=Math.PI;e.enemyV2!.brain!.home={...e.pos};e.enemyV2!.readyAt=0;step(s,.01);updateVision(s,true);
  expect(enemyAlert(s,e)).toBe('!');expect(visibleEnemyHazards(s).some(x=>x.sourceId===e.id)).toBe(true);e.pos={x:120,y:110};updateVision(s,true);expect(enemyAlert(s,e)).toBeNull();expect(visibleEnemyHazards(s).some(x=>x.sourceId===e.id)).toBe(false);
 });
});
