import {hunterState} from '../src/core/hunter-state';
import {alState} from '../src/core/al-state';
import {describe,it,expect} from 'vitest';
import {createExplorationEntry,createGame,command,step} from '../src/core/engine';
import {createEnemyPlaytest} from '../src/core/enemy-playtest';
import {rewardKill,payVitality,settle} from '../src/core/economy';
import {recordCombatAction,recordAttackEvent} from '../src/core/combat-identity';
import {interactExploration,exitExploration} from '../src/core/exploration';

function start(){const s=createExplorationEntry();command(s,{type:'selectExplorationCompanion',id:'ranger'});expect(command(s,{type:'carry',gold:0,vitality:0}).ok).toBe(true);hunterState(s.units.find(u=>u.id==='hunter')!);alState(s.units.find(u=>u.id==='ranger')!);return s;}
function atExit(s:ReturnType<typeof start>){const p=s.exploration!.definition.exit;for(const u of s.units.filter(u=>u.team==='ally'&&u.life==='active')){u.pos={...p,x:p.x+(u.id==='hunter'?0:.8)};u.drawPos={...u.pos};}s.context='explorationIdle';}
function resume(s:ReturnType<typeof start>){return command(s,{type:'continueWorld',worldId:s.world!.id,visit:s.world!.visit.generation});}
describe('NR-01 world and area lifecycle',()=>{
 it('advances the visit combat generation even if no action has run',()=>{
  const s=start(),generation=s.combatIdentity!.generation;atExit(s);command(s,{type:'exitExploration'});expect(s.combatIdentity!.generation).toBeGreaterThan(generation);const outside=s.combatIdentity!.generation;resume(s);expect(s.combatIdentity!.generation).toBeGreaterThan(outside);
  const enemies=s.units.filter(u=>u.team==='enemy');for(let i=0;i<70;i++){atExit(s);expect(command(s,{type:'exitExploration'}).ok).toBe(true);expect(resume(s).ok).toBe(true);}expect(s.world!.changes).toHaveLength(128);expect(s.units.filter(u=>u.team==='enemy')).toEqual(enemies);expect(s.world!.places[s.node].unloadedEnemies).toEqual([]);
 });
 it('retains the old explicit Legacy exit contract as a scoped reproduction of the former reset chain',()=>{
  const s=createGame();command(s,{type:'selectJourney',journey:'exploration'});command(s,{type:'selectExplorationCompanion',id:'ranger'});command(s,{type:'carry',gold:0,vitality:0});s.fragments=4;atExit(s);
  expect(command(s,{type:'exitExploration'}).ok).toBe(true);expect(s.phase).toBe('ended');expect(s.economy.settled).toBe('success');expect(s.fragments).toBe(0);expect(s.economy.account.vitality).toBe(4);expect(s.world).toBeUndefined();
 });
 it('ordinary leave retains identity, resources, both actors and native clocks without settlement',()=>{
  const s=start(),h=s.units.find(u=>u.id==='hunter')!,a=s.units.find(u=>u.id==='ranger')!,w=s.world!;
  expect(w).toBeDefined();step(s,.1);h.hp-=5;h.grayHp=3;h.posture-=2;h.weapons[0].durability-=2;a.hp-=4;
  h.hunterCombat!.activeCooldown=5;h.hunterCombat!.activeCharge=0;a.alCombat!.ammo=2;a.alCombat!.rocketCd=4;
  s.fragments=8;expect(payVitality(s,2,'test-paid')).toEqual({ok:true});atExit(s);
  const clock=s.time,values=JSON.stringify([h.hp,h.grayHp,h.posture,h.weapons,a.hp,h.hunterCombat!.activeCooldown,a.alCombat!.ammo,a.alCombat!.rocketCd]);
  expect(command(s,{type:'exitExploration'}).ok).toBe(true);expect(s.phase).toBe('world');expect(s.world).toBe(w);expect(s.economy.settled).toBeNull();expect(s.fragments).toBe(6);
  step(s,20);expect(s.time).toBe(clock);expect(resume(s).ok).toBe(true);expect(s.time).toBe(clock);expect(s.units.find(u=>u.id==='hunter')).toBe(h);expect(s.units.find(u=>u.id==='ranger')).toBe(a);
  expect(JSON.stringify([h.hp,h.grayHp,h.posture,h.weapons,a.hp,h.hunterCombat!.activeCooldown,a.alCombat!.ammo,a.alCombat!.rocketCd])).toBe(values);
 });
 it('fixed enemy and memory survive repeat visits with stable one-time reward identities',()=>{
  const s=start(),e=s.units.find(u=>u.team==='enemy')!,memory=s.exploration!.memory,id=e.id;
  e.hp=0;e.life='dead';expect(rewardKill(s,e)).toBe(true);const reward=e.rewardKey;memory.mechanisms.push('campfire-1');memory.seen.push('test-discovered');
  atExit(s);command(s,{type:'exitExploration'});expect(resume(s).ok).toBe(true);
  expect(s.units.find(u=>u.id===id)).toBe(e);expect(e.life).toBe('dead');expect(e.rewardKey).toBe(reward);expect(reward).toContain(s.world!.id);expect(rewardKill(s,e)).toBe(false);expect(s.fragments).toBe(4);expect(s.exploration!.memory).toBe(memory);expect(memory.mechanisms).toContain('campfire-1');
 });
 it('rejects wrong, duplicate and stale transitions without partial mutation or consumption',()=>{
  const s=start();expect(command(s,{type:'exitExploration'}).ok).toBe(false);atExit(s);s.context='explorationBattle';expect(command(s,{type:'exitExploration'}).ok).toBe(false);s.context='explorationIdle';
  command(s,{type:'exitExploration'});const before=JSON.stringify(s),token={type:'continueWorld' as const,worldId:s.world!.id,visit:s.world!.visit.generation};
  expect(command(s,{...token,worldId:'stale'}).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(command(s,token).ok).toBe(true);
  const after=JSON.stringify(s);expect(command(s,token).ok).toBe(false);expect(JSON.stringify(s)).toBe(after);
  expect(settle(s,'success').ok).toBe(false);expect(command(s,{type:'newExpedition'}).ok).toBe(false);expect(command(s,{type:'abandon'}).ok).toBe(false);
 });
 it('unloads temporary actions and stale combat generation, keeping paid costs and final gates',()=>{
  const s=start(),h=s.units.find(u=>u.id==='hunter')!,a=s.units.find(u=>u.id==='ranger')!;const context=recordCombatAction(s,h,'basic');
  h.hunterCombat!.held=true;h.hunterCombat!.frost=1;h.hunterCombat!.activeCooldown=7;h.hunterCombat!.finalRecoveryUntil=9;
  a.alCombat!.ammo=1;a.alCombat!.shotHeld=true;a.alCombat!.rocketCd=6;s.skillEffects!.push({combatContext:context} as any);
  atExit(s);expect(command(s,{type:'exitExploration'}).ok).toBe(true);expect(s.skillEffects).toEqual([]);expect(s.combatIdentity!.generation).toBeGreaterThan(context!.generation);
  resume(s);expect(h.hunterCombat!.held).toBe(false);expect(a.alCombat!.shotHeld).toBe(false);expect(h.hunterCombat!.frost).toBe(1);expect(h.hunterCombat!.activeCooldown).toBe(7);expect(h.hunterCombat!.finalRecoveryUntil).toBe(9);expect(a.alCombat!.ammo).toBe(1);expect(a.alCombat!.rocketCd).toBe(6);
  expect(recordAttackEvent(s,context)).toBeUndefined();
 });
 it('a real paid Al release is cancelled at unload without restoring ammunition',()=>{
  const s=start(),a=s.units.find(u=>u.id==='ranger')!;command(s,{type:'controlBody',id:a.id});expect(command(s,{type:'alInput',id:a.id,kind:'shot',held:true,aim:{x:a.pos.x+3,y:a.pos.y}}).ok).toBe(true);step(s,.06);
  expect(a.alCombat!.ammo).toBe(3);expect(a.alCombat!.entities.length).toBeGreaterThan(0);const old=a.alCombat!.entities[0].context;
  atExit(s);command(s,{type:'exitExploration'});expect(a.alCombat!.entities).toEqual([]);expect(a.alCombat!.ammo).toBe(3);expect(s.world!.lastUnload!.cancelled.some(row=>row.context?.actorId===a.id)).toBe(true);
  resume(s);expect(recordAttackEvent(s,old)).toBeUndefined();expect(a.alCombat!.ammo).toBe(3);
 });
 it('campfire and resource interactions each retain their own one-time boundary',()=>{
  const s=start(),h=s.units.find(u=>u.id==='hunter')!,r=s.exploration!;h.hp-=100;
  expect(interactExploration(s,'campfire-1').ok).toBe(true);const healed=h.hp;expect(interactExploration(s,'campfire-1').ok).toBe(false);expect(h.hp).toBe(healed);
  // Existing ordinary map has only campfires. Resource consumer is tested on a local definition extension.
  r.definition.points.push({id:'test-resource',pos:{...h.pos},kind:'resource',reward:10});expect(interactExploration(s,'test-resource').ok).toBe(true);const key=s.economy.rewards.at(-1);expect(key).toContain(s.world!.id);
  atExit(s);command(s,{type:'exitExploration'});resume(s);expect(interactExploration(s,'test-resource').ok).toBe(false);expect(interactExploration(s,'campfire-1').ok).toBe(false);expect(s.fragments).toBe(10);expect(h.hp).toBe(healed);
 });
 it('downed abandonment and missing place fail atomically; approved death does not revive on continue',()=>{
  const s=start(),a=s.units.find(u=>u.id==='ranger')!;atExit(s);a.life='downed';a.hp=0;
  const before=JSON.stringify(s);expect(command(s,{type:'exitExploration'}).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(command(s,{type:'exitExploration',abandonIds:['unknown']}).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
  const place=s.world!.places[s.node];delete s.world!.places[s.node];const invalid=JSON.stringify(s);expect(command(s,{type:'exitExploration',abandonIds:[a.id]}).ok).toBe(false);expect(JSON.stringify(s)).toBe(invalid);s.world!.places[s.node]=place;
  expect(command(s,{type:'exitExploration',abandonIds:[a.id]}).ok).toBe(true);expect(a.life).toBe('dead');expect(resume(s).ok).toBe(true);expect(a.life).toBe('dead');expect(a.hp).toBe(0);
 });
 it('missing destination, changed entry and duplicate leave reject with no partial write',()=>{
  const s=start();atExit(s);command(s,{type:'exitExploration'});const w=s.world!,place=w.places[s.node];delete w.places[s.node];const lost=JSON.stringify(s);expect(resume(s).ok).toBe(false);expect(JSON.stringify(s)).toBe(lost);w.places[s.node]=place;
  const entry={...place.definition.entry};place.definition.entry={x:-100,y:-100};const noSpace=JSON.stringify(s);expect(resume(s).ok).toBe(false);expect(JSON.stringify(s)).toBe(noSpace);place.definition.entry=entry;
  const before=JSON.stringify(s);expect(exitExploration(s,[],()=>{throw Error('must not reach death');}).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
 });
 it('existing objective payment failure cannot half-leave or consume a downed companion',()=>{
  const s=start(),a=s.units.find(u=>u.id==='ranger')!;s.exploration!.definition.points.push({id:'test-objective',kind:'objective',pos:{...s.exploration!.definition.entry},reward:10});s.exploration!.memory.objective=true;atExit(s);a.life='downed';a.hp=0;s.fragments=Number.MAX_SAFE_INTEGER;
  const before=JSON.stringify(s);expect(command(s,{type:'exitExploration',abandonIds:[a.id]}).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
  s.fragments=0;expect(command(s,{type:'exitExploration',abandonIds:[a.id]}).ok).toBe(true);expect(s.fragments).toBe(10);resume(s);atExit(s);command(s,{type:'exitExploration'});expect(s.fragments).toBe(10);
 });
 it('only explicit new-world command discards progress; named fixtures have no persistent world',()=>{
  const s=start(),id=s.world!.id;atExit(s);command(s,{type:'exitExploration'});
  expect(command(s,{type:'restartWorld',worldId:'old'}).ok).toBe(false);expect(command(s,{type:'restartWorld',worldId:id}).ok).toBe(true);expect(s.phase).toBe('account');expect(s.exploration).toBeUndefined();expect(s.enemyRuntime).toBeUndefined();expect(s.explorationMemories).toBeUndefined();
  command(s,{type:'selectExplorationCompanion',id:'ranger'});command(s,{type:'carry',gold:0,vitality:0});expect(s.world!.id).not.toBe(id);expect(s.exploration!.memory.mechanisms).toEqual([]);
  expect(createEnemyPlaytest(0,'mix').world).toBeUndefined();
 });
});
