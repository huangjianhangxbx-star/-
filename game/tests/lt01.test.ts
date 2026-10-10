import {test,expect} from 'vitest';
import {setup} from './en01-fixture';
import {command,resolveHit,step,createExplorationEntry} from '../src/core/engine';
import {spendAcceptedAction} from '../src/core/stamina';
import {useCampfire} from '../src/core/campfire';
import {interactExploration} from '../src/core/exploration';
import {updateVision} from '../src/core/visibility';
import {beginWorld} from '../src/core/world-session';
import {tickPartyLifecycle} from '../src/core/party-lifecycle';
import {requestEnemyAction,advanceEnemyAction} from '../src/core/enemy-action';
import {commitEnemyRelease} from '../src/core/enemy-attack-entity';
import {profile} from './en01-fixture';
import {canStop,distance,radius} from '../src/core/spatial';
function fixture(){const a=setup();a.s.sessionMode='exploration';a.s.units=a.s.units.filter(u=>u.team==='ally');beginWorld(a.s);return a;}
function until(s:ReturnType<typeof fixture>['s'],time:number){for(let i=0;s.time<time&&i<10000;i++)step(s,Math.min(.01,time-s.time));expect(s.time).toBeCloseTo(time,6);}
function kill(a:ReturnType<typeof fixture>,u=a.h){u.hunterCombat&&(u.hunterCombat.invulnerableUntil=0);u.alCombat&&(u.alCombat.invulnerableUntil=0);resolveHit(a.s,u,{...u.weapons[0],remote:false,subtype:'impact',postureDamage:0},u.maxHp*100,a.e,{kind:'hit'});}
test('LT single death immediately removes both logical control and occupancy; 10 sim seconds restore without ledger rewind',()=>{
 const a=fixture(),{s,h,al}=a;spendAcceptedAction(s,h,'active',1);h.stamina!.guardExhausted=true;const st=h.stamina!,id=st.nextAcceptedId;
 kill(a);expect(h.life).toBe('respawning');expect(h.hp).toBe(0);expect(s.controlledBodyId).toBe('ranger');expect(command(s,{type:'controlBody',id:'hunter'}).ok).toBe(false);
 expect(canStop(s,h.pos,al)).toBe(true);const hp=h.hp;resolveHit(s,h,h.weapons[0],99,a.e);expect(h.hp).toBe(hp);
 s.phase='world';step(s,30);expect(h.respawnTimer).toBe(10);s.phase='battle';until(s,9.99);expect(h.life).toBe('respawning');until(s,10.01);
 expect(h.life).toBe('active');expect(h.hp).toBe(h.maxHp);expect(h.posture).toBe(h.maxPosture);expect(h.stamina).toBe(st);expect(st.current).toBe(st.max);expect(st.nextAcceptedId).toBe(id);expect(st.lastAcceptedId).toBe(1);expect(st.guardExhausted).toBe(false);expect(s.controlledBodyId).toBe('ranger');expect(distance(h.pos,al.pos)).toBeGreaterThanOrEqual(radius(h)+radius(al));
 spendAcceptedAction(s,h,'active',1);expect(st.current).toBe(100);spendAcceptedAction(s,h,'basic',id);expect(st.current).toBe(90);
});
test('LT offhand Al death preserves Hunter control, ammo/CD and persistent weapon instances',()=>{
 const a=fixture(),{s,h,al}=a;command(s,{type:'controlBody',id:al.id});expect(command(s,{type:'alInput',id:al.id,kind:'shot',aim:{x:15,y:10}}).ok).toBe(true);step(s,.04);command(s,{type:'controlBody',id:h.id});const ammo=al.alCombat!.ammo,wp=al.weapons[0];al.alCombat!.rocketCd=5;
 kill(a,al);expect(s.controlledBodyId).toBe(h.id);expect(al.life).toBe('respawning');step(s,10.01);expect(al.life).toBe('active');expect(al.weapons[0]).toBe(wp);expect(al.alCombat!.ammo).toBe(ammo);expect(al.alCombat!.rocketCd).toBeGreaterThan(4.9);expect(al.alCombat!.held).toBe(false);expect(al.alCombat!.shotHeld).toBe(false);
});
test('LT no safe nearby position retries without flashes, refunds, or repeated accepted IDs',()=>{
 const a=fixture(),{s,h}=a;kill(a);s.tiles.forEach(t=>t.obstacle=true);step(s,12);expect(h.life).toBe('respawning');expect(h.hp).toBe(0);expect(h.respawnTimer).toBe(0);
 s.tiles.forEach(t=>t.obstacle=false);step(s,.3);expect(h.life).toBe('active');
});
test('LT double lethal has observable absence and exactly one atomic same-world respawn, without economy or reward reset',()=>{
 const a=fixture(),{s,h,al}=a;spendAcceptedAction(s,h,'basic',7);spendAcceptedAction(s,al,'basic',9);const world=s.world!,economy=structuredClone(s.economy),generation=world.generation;
 s.exploration!.memory.mechanisms.push('used-fire');kill(a);kill(a,al);expect([h.life,al.life]).toEqual(['respawning','respawning']);expect(s.controlledBodyId).toBeNull();until(s,.49);expect(h.life).toBe('respawning');until(s,.51);
 expect([h.life,al.life]).toEqual(['active','active']);expect(s.controlledBodyId).toBe('hunter');expect(s.world).toBe(world);expect(world.generation).toBe(generation);expect(s.economy).toEqual(economy);expect(s.exploration!.memory.mechanisms).toContain('used-fire');expect([h.stamina!.lastAcceptedId,al.stamina!.lastAcceptedId]).toEqual([7,9]);expect(s.partyLifecycle!.wipeCount).toBe(1);step(s,2);expect(s.partyLifecycle!.wipeCount).toBe(1);expect(distance(h.pos,al.pos)).toBeGreaterThanOrEqual(radius(h)+radius(al));
});
test('LT blocked wipe stays absent and commits neither member until both spots legal',()=>{
 const a=fixture();kill(a);kill(a,a.al);a.s.tiles.forEach(t=>t.obstacle=true);step(a.s,1);expect(a.s.partyLifecycle!.wipeCount).toBe(0);expect([a.h.life,a.al.life]).toEqual(['respawning','respawning']);a.s.tiles.forEach(t=>t.obstacle=false);step(a.s,.3);expect(a.s.partyLifecycle!.wipeCount).toBe(1);
});
test('LT survivor campfire never revives dead body or rewinds its waiting ledger',()=>{
 const a=fixture(),{s,h,al}=a;spendAcceptedAction(s,h,'active',1);kill(a);s.context='explorationIdle';const p=s.exploration!.definition.points.find(p=>p.kind==='campfire')!;
 al.pos={...p.pos};al.drawPos={...al.pos};al.stamina!.current=20;expect(useCampfire(s,p).ok).toBe(true);expect(al.stamina!.current).toBe(100);expect(h.life).toBe('respawning');expect(h.stamina!.current).toBe(72);expect(h.respawnTimer).toBe(10);expect(useCampfire(s,p).ok).toBe(false);
});
test('LT surviving Al claims visible resource once without reviving Hunter',()=>{
 const a=fixture(),{s,h,al}=a;kill(a);const p={id:'LT-fixture-resource',pos:{...al.pos},kind:'resource' as const,reward:10};s.exploration!.definition.points.push(p);al.pos={...p.pos};al.drawPos={...p.pos};updateVision(s,true);const money=s.fragments;expect(interactExploration(s,p.id).ok).toBe(true);expect(s.fragments).toBe(money+p.reward);expect(interactExploration(s,p.id).ok).toBe(false);expect(h.life).toBe('respawning');
});
test('LT living Al can exit and continue same world, without early revival or elapsed waiting',()=>{
 const s=createExplorationEntry();command(s,{type:'carry',gold:0,vitality:0});const h=s.units.find(u=>u.id==='hunter')!,al=s.units.find(u=>u.id==='ranger')!,e=structuredClone(h);e.id='fixture';e.team='enemy';e.role='melee';e.weapons[0].damage=9999;const a={s,h,al,e};kill(a);s.units=s.units.filter(u=>u.team==='ally');s.context='explorationIdle';al.pos={...s.goal};al.drawPos={...al.pos};const world=s.world!;
 expect(command(s,{type:'exitExploration'}).ok).toBe(true);step(s,50);expect(h.respawnTimer).toBe(10);expect(command(s,{type:'continueWorld',worldId:world.id,visit:world.visit.generation}).ok).toBe(true);expect(s.world).toBe(world);expect(h.life).toBe('respawning');expect(s.controlledBodyId).toBe('ranger');
});
test('LT lethal handoff leaves surviving accepted rocket intact and does not repay it',()=>{
 const a=fixture(),{s,al}=a;command(s,{type:'controlBody',id:al.id});expect(command(s,{type:'alInput',id:al.id,kind:'rocket',aim:{x:14,y:10}}).ok).toBe(true);const action=al.alCombat!.special,ledger=al.stamina!.nextAcceptedId;command(s,{type:'controlBody',id:a.h.id});kill(a);expect(al.alCombat!.special).toBe(action);until(s,.45);expect(al.alCombat!.trace.filter(e=>e.kind==='land')).toHaveLength(1);expect(al.stamina!.nextAcceptedId).toBe(ledger);expect(al.alCombat!.rocketCd).toBeGreaterThan(5);
});
test('LT safe placement respects committed future arrow landings and death does not clear enemy entities',()=>{
 const a=fixture(),{s,h,al,e}=a;s.units.push(e);expect(requestEnemyAction(s,e,{...profile,kind:'transport',radius:100,travel:20},h).ok).toBe(true);s.time=.6;commitEnemyRelease(s,advanceEnemyAction(s,e)[0]);const entity=s.enemyRuntime!.entities[0];kill(a);expect(s.enemyRuntime!.entities[0]).toBe(entity);s.time=h.respawnAt!;tickPartyLifecycle(s);expect(h.life).toBe('respawning');expect(h.reviveRetryAt).toBeGreaterThan(s.time);s.enemyRuntime!.entities=[];s.time+=.26;tickPartyLifecycle(s);expect(h.life).toBe('active');expect(distance(h.pos,al.pos)).toBeGreaterThanOrEqual(radius(h)+radius(al));
});
test('LT all-dead transaction retains dead monsters and claim ledger but discards invalid pre-wipe hazards once',()=>{
 const a=fixture(),{s,h,al,e}=a;e.life='dead';s.units.push(e);s.economy.rewards.push('lt-once');const entityWorld={generation:s.combatIdentity!.generation,nextEntityId:77,entities:[]};s.enemyRuntime=entityWorld;kill(a);kill(a,al);const deadline=s.partyLifecycle!.wipeAt,epoch=s.inputEpoch;kill(a);expect(s.partyLifecycle!.wipeAt).toBe(deadline);expect(s.inputEpoch).toBe(epoch);until(s,.51);expect(e.life).toBe('dead');expect(s.economy.rewards).toContain('lt-once');expect(s.enemyRuntime?.nextEntityId).toBe(77);expect(s.partyLifecycle!.wipeCount).toBe(1);
});
