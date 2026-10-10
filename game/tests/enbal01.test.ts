import {test,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
const evidence='../work/EN-BAL-01-20261010/core-contacts';mkdirSync(evidence,{recursive:true});
function record(s:GameState,name:string){writeFileSync(evidence+'/'+name+'.json',JSON.stringify({mode:s.enemyPressure,time:s.time,units:s.units.map(u=>({id:u.id,hp:u.hp,maxHp:u.maxHp,posture:u.posture,maxPosture:u.maxPosture,life:u.life,profile:u.enemyV2?.profile,trace:u.enemyV2?.trace})),posture:s.postureRuntime?.trace,combat:combatTraceSnapshot(s)},null,2));}

import {setup} from './en01-fixture';
import {createExplorationEntry,command,step} from '../src/core/engine';
import {registerEnemy,ZOMBIE,ARCHER} from '../src/core/enemy-profiles';
import {requestEnemyAction,advanceEnemyAction,cancelEnemyAction} from '../src/core/enemy-action';
import {commitEnemyRelease,enemyWorld} from '../src/core/enemy-attack-entity';
import {configureCombatTrace,combatTraceSnapshot,resetCombatTrace} from '../src/core/combat-identity';
import {visibleEnemyHazards} from '../src/core/enemy-observation';
import {abilityThreat} from '../src/core/companion-combat';
import {updateVision} from '../src/core/visibility';
import {tickEnemyPosture} from '../src/core/enemy-posture';
import {damageAfterDefense} from '../src/core/combat-config';
import type {GameState,Unit} from '../src/core/types';

// Regression: preset must affect the real released entity and resolveHit, not a label or independent HP write.
function fixture(targetId='hunter',preset='high-pressure-v1',family:'zombie'|'ranged'='zombie'){
 const x=setup();(x.s as any).enemyPressure=preset;x.s.sessionMode='exploration';x.s.postureRuntime={generation:x.s.combatIdentity!.generation,mode:'xinghai',trace:[]};
 const t=targetId==='hunter'?x.h:x.al,other=t===x.h?x.al:x.h;other.pos={x:25,y:25};x.s.controlledBodyId=t.id;
 t.pos={x:10,y:10};t.drawPos={...t.pos};t.defense={subtype:'impact',flat:0};t.maxPosture=t.posture=targetId==='hunter'?90:70;
 x.e.pos={x:family==='zombie'?11.2:15,y:10};x.e.drawPos={...x.e.pos};x.e.heading=Math.PI;registerEnemy(x.s,x.e,family==='zombie'?ZOMBIE:ARCHER);x.e.enemyV2!.readyAt=0;return {...x,t};
}
function release(x:ReturnType<typeof fixture>){const {s,e,t}=x;cancelEnemyAction(s,e,'fixture-next');e.enemyV2!.readyAt=0;expect(requestEnemyAction(s,e,e.enemyV2!.profile,t).ok).toBe(true);s.time+=e.enemyV2!.profile.events.find(v=>v.kind==='attack')!.at;advanceEnemyAction(s,e).forEach(r=>commitEnemyRelease(s,r));e.enemyV2!.dash=undefined;return enemyWorld(s).entities;}
function contact(x:ReturnType<typeof fixture>){release(x);step(x.s,.01);}

for(const id of ['hunter','ranger']){
 test(id+' real source contact loses one third maxHp and .60 maxPosture',()=>{const x=fixture(id);const hp=x.t.hp;contact(x);expect(hp-x.t.hp).toBeCloseTo(id==='hunter'?120:260/3);expect(x.t.posture).toBeCloseTo(id==='hunter'?36:28);expect(x.e.enemyV2!.trace.filter(v=>v.kind==='contact'&&v.targetId===id)).toHaveLength(1);});
 test(id+' second short contact breaks immediately without duplicate HP consumer',()=>{const x=fixture(id);contact(x);contact(x);expect(x.t.hp).toBeCloseTo(x.t.maxHp/3);expect(x.t.posture).toBe(0);expect(x.t.stagger).toBeCloseTo(.6);expect(x.s.postureRuntime!.trace.filter(v=>v.kind==='PostureBroken'&&v.targetId===id)).toHaveLength(1);});
}
test('armor is legally offset only in this preset; Ward still reduces real contact',()=>{const x=fixture();x.t.defense={subtype:'slash',flat:17};contact(x);expect(x.t.hp).toBeCloseTo(240);const y=fixture();y.t.statuses.push({kind:'warding',remaining:10,power:.35});contact(y);expect(y.t.hp).toBeCloseTo(268.8);});
test('actual maximums are authoritative, not Hunter hardcoded HP or posture',()=>{const x=fixture();x.t.hp=x.t.maxHp=600;x.t.posture=x.t.maxPosture=120;contact(x);expect(x.t.hp).toBe(400);expect(x.t.posture).toBe(48);});
test('full natural recovery allows a later first-style contact rather than permanent two-hit counter',()=>{const x=fixture();contact(x);cancelEnemyAction(x.s,x.e,'fixture-rest');x.s.time+=6;tickEnemyPosture(x.s,x.t,6);expect(x.t.posture).toBe(90);contact(x);expect(x.t.posture).toBe(36);expect(x.t.stagger).toBe(0);});
test('front shield preserves HP and halves impact; rear shield does not',()=>{const x=fixture();expect(command(x.s,{type:'hunterInput',id:x.h.id,kind:'guard',held:true,aim:x.e.pos}).ok).toBe(true);step(x.s,.1);contact(x);expect(x.h.hp).toBe(360);expect(x.h.posture).toBeCloseTo(63);expect(x.e.enemyV2!.trace.some(v=>v.defense==='block')).toBe(true);const y=fixture();command(y.s,{type:'hunterInput',id:y.h.id,kind:'guard',held:true,aim:{x:5,y:10}});step(y.s,.1);contact(y);expect(y.h.hp).toBe(240);expect(y.h.posture).toBe(36);});
for(const id of ['hunter','ranger'])test(id+' real invulnerability window prevents HP and posture',()=>{const x=fixture(id);release(x);const before=[x.t.hp,x.t.posture];command(x.s,id==='hunter'?{type:'hunterInput',id,kind:'dodge',direction:{x:0,y:1}}:{type:'alInput',id,kind:'roll',direction:{x:0,y:1}});step(x.s,.01);expect([x.t.hp,x.t.posture]).toEqual(before);expect(x.e.enemyV2!.trace.some(v=>v.targetId===id&&v.defense==='invulnerable')).toBe(true);});
test('same hazard repeated ticking cannot charge twice',()=>{const x=fixture();contact(x);const hp=x.t.hp;step(x.s,.04);expect(x.t.hp).toBe(hp);expect(x.e.enemyV2!.trace.filter(v=>v.kind==='contact'&&v.targetId===x.t.id)).toHaveLength(1);});
test('outside geometry or real wall has neither charge nor contact',()=>{for(const wall of [false,true]){const x=fixture();release(x);if(wall)x.s.tiles.find(t=>t.x===11&&t.y===10)!.obstacle=true;else x.t.pos={x:10,y:14};step(x.s,.01);expect(x.t.hp).toBe(360);expect(x.t.posture).toBe(90);expect(x.e.enemyV2!.trace.some(v=>v.kind==='contact')).toBe(false);}});
test('baseline and legacy keep original 5 power / 15 posture with same resolve chain',()=>{for(const legacy of [false,true]){const x=fixture('hunter',legacy?'high-pressure-v1':'baseline');if(legacy)x.s.sessionMode='legacy';contact(x);expect(x.h.hp).toBe(355);expect(x.h.posture).toBe(75);}});
test('official entry defaults high, developer fixture without opt-in is baseline',()=>{expect((createExplorationEntry() as any).enemyPressure).toBe('high-pressure-v1');const x=fixture();delete (x.s as any).enemyPressure;contact(x);expect(x.h.hp).toBe(355);});
test('target-aware visible danger and companion urgency agree with real pressure, never reveal fog',()=>{const x=fixture();release(x);x.s.time+=.001;updateVision(x.s,true);const hazards=visibleEnemyHazards(x.s,x.t);expect(hazards).toHaveLength(1);expect(damageAfterDefense(hazards[0].weapon,x.t,hazards[0].damage)).toBeCloseTo(120);expect(hazards[0].postureDamage).toBe(54);expect(abilityThreat(x.s,x.t).score).toBeCloseTo(120/360*4+54/90*1.5);x.e.pos={x:120,y:110};enemyWorld(x.s).entities[0].pos={...x.e.pos};updateVision(x.s,true);expect(visibleEnemyHazards(x.s,x.t)).toEqual([]);});
test('trace OFF leaves real HP posture RNG entity IDs equal',()=>{const run=(enabled:boolean)=>{const x=fixture();configureCombatTrace(x.s,enabled);contact(x);return {hp:x.t.hp,posture:x.t.posture,seed:x.s.seed,next:x.s.nextId,entity:enemyWorld(x.s).entities.map(e=>e.attack)};};expect(run(false)).toEqual(run(true));});
test('trace outcome identifies preset and raw input alongside measured real HP and posture',()=>{const x=fixture();contact(x);const hit=combatTraceSnapshot(x.s).find(v=>v.type==='hit-outcome'&&v.outcome?.targetId==='hunter')!;expect(hit.outcome).toMatchObject({hpLost:120,postureApplied:54,enemyPressure:'high-pressure-v1',rawPower:120,rawPosture:54});});
test('dead target and replaced generation reject old hazards',()=>{for(const dead of [false,true]){const x=fixture();release(x);if(dead)x.t.life='dead';else resetCombatTrace(x.s);step(x.s,.01);expect(x.t.hp).toBe(360);expect(x.e.enemyV2!.trace.some(v=>v.kind==='contact'&&v.targetId==='hunter')).toBe(false);}});

// Controlled landing geometry, not evidence that every naturally sampled three-arrow volley overlaps.
for(const count of [1,2,3])test(count+' independent archer explosions retain real per-entity HP ownership',()=>{
 const x=fixture('hunter','high-pressure-v1','ranged');release(x);x.e.enemyV2!.brain=undefined;
 const arrows=enemyWorld(x.s).entities;expect(arrows).toHaveLength(3);expect(new Set(arrows.map(a=>a.context.actionId)).size).toBe(3);
 arrows.forEach((a,i)=>a.to=i<count?{...x.h.pos}:{x:20,y:20});
 x.s.time=1.55;step(x.s,.004);step(x.s,.35);
 const hits=combatTraceSnapshot(x.s).filter(r=>r.type==='hit-outcome'&&r.outcome?.targetId==='hunter'&&r.outcome.hpLost>0);
 expect(hits).toHaveLength(count);expect(new Set(hits.map(r=>r.outcome!.attackEventId)).size).toBe(count);
 expect(hits.reduce((n,r)=>n+r.outcome!.hpLost,0)).toBeCloseTo(count*120);expect(x.h.hp).toBeCloseTo(360-count*120);
 expect(x.e.enemyV2!.trace.filter(r=>r.kind==='contact'&&r.targetId==='hunter')).toHaveLength(count);record(x.s,'archer-'+count+'-controlled-overlap');
});
test('two native archers own six independent transports, with no silent group damage budget',()=>{
 const x=fixture('hunter','high-pressure-v1','ranged');release(x);x.e.enemyV2!.brain=undefined;
 const second=structuredClone(x.e);second.id='second-archer';second.pos={x:15,y:10.3};registerEnemy(x.s,second,ARCHER);second.enemyV2!.readyAt=0;x.s.units.push(second);
 expect(requestEnemyAction(x.s,second,ARCHER,x.h).ok).toBe(true);x.s.time+=.6333;advanceEnemyAction(x.s,second).forEach(r=>commitEnemyRelease(x.s,r));second.enemyV2!.brain=undefined;
 const arrows=enemyWorld(x.s).entities;expect(arrows).toHaveLength(6);expect(new Set(arrows.map(a=>a.context.actorId)).size).toBe(2);expect(new Set(arrows.map(a=>a.id)).size).toBe(6);
 arrows.forEach(a=>a.to={...x.h.pos});x.s.time=1.55;step(x.s,.004);step(x.s,.35);x.s.time=2.18;step(x.s,.008);step(x.s,.35);
 record(x.s,'two-archers-controlled-overlap');expect(x.h.hp).toBeCloseTo(0);expect(combatTraceSnapshot(x.s).filter(r=>r.type==='hit-outcome'&&r.outcome?.targetId==='hunter').reduce((n,r)=>n+r.outcome!.hpLost,0)).toBeCloseTo(360);
});
test('danger estimate for Al uses Al maximums even while Hunter is controlled',()=>{const x=fixture();x.al.pos={x:10,y:10.3};release(x);x.s.time+=.001;updateVision(x.s,true);const a=visibleEnemyHazards(x.s,x.al)[0],h=visibleEnemyHazards(x.s,x.h)[0];expect(a.damage).toBeCloseTo(260/3);expect(a.postureDamage).toBe(42);expect(h.damage).toBe(120);expect(h.postureDamage).toBe(54);});
test('front blocked trace retains original raw pressure but records zero HP and half posture',()=>{const x=fixture();command(x.s,{type:'hunterInput',id:x.h.id,kind:'guard',held:true,aim:x.e.pos});step(x.s,.1);contact(x);const hit=combatTraceSnapshot(x.s).find(r=>r.type==='hit-outcome'&&r.outcome?.targetId==='hunter')!.outcome!;expect(hit).toMatchObject({hpLost:0,rawPower:120,rawPosture:54,postureApplied:27});});
test('ordinary leave and continue retain selected pressure while clearing future released arrows',()=>{
 const s=createExplorationEntry();command(s,{type:'selectExplorationCompanion',id:'ranger'});command(s,{type:'carry',gold:0,vitality:0});
 const h=s.units.find(u=>u.id==='hunter')!,e=s.units.find(u=>u.enemyV2?.profile.visual==='ranged')!;e.pos={x:h.pos.x+5,y:h.pos.y};e.heading=Math.PI;e.enemyV2!.readyAt=0;
 expect(requestEnemyAction(s,e,ARCHER,h).ok).toBe(true);s.time=.6333;advanceEnemyAction(s,e).forEach(r=>commitEnemyRelease(s,r));expect(enemyWorld(s).entities).toHaveLength(3);
 for(const u of s.units.filter(u=>u.team==='ally'&&u.life==='active'))u.pos={...s.goal,x:s.goal.x+(u.id==='hunter'?0:.8)};s.context='explorationIdle';expect(command(s,{type:'exitExploration'}).ok).toBe(true);
 expect(enemyWorld(s).entities).toEqual([]);expect(command(s,{type:'continueWorld',worldId:s.world!.id,visit:s.world!.visit.generation}).ok).toBe(true);expect(s.enemyPressure).toBe('high-pressure-v1');const hp=h.hp;for(let i=0;i<20;i++)step(s,.1);expect(h.hp).toBe(hp);
});
test('pressure preset does not change player attacks or source enemy timelines and power',()=>{
 const attack=(preset:string)=>{const x=fixture('hunter',preset);x.e.enemyV2!.brain=undefined;x.e.enemyV2!.readyAt=999;command(x.s,{type:'hunterInput',id:x.h.id,kind:'basic',held:true,aim:x.e.pos});step(x.s,1.2);return {hp:x.e.hp,events:x.h.hunterCombat!.trace,profile:x.e.enemyV2!.profile};};
 expect(attack('high-pressure-v1')).toEqual(attack('baseline'));expect(ZOMBIE.power).toBe(5);expect(ARCHER.power).toBe(3);
});
