import {test,expect} from 'vitest';
import {configureCombatTrace} from '../src/core/combat-identity';
import {createEnemyPlaytest} from '../src/core/enemy-playtest';
import {setup} from './en01-fixture';
import {registerEnemy,ZOMBIE,ARCHER} from '../src/core/enemy-profiles';
import {moveEnemy,advanceEnemyDash} from '../src/core/enemy-motion';
import {requestEnemyAction,advanceEnemyAction} from '../src/core/enemy-action';
import {commitEnemyRelease,enemyWorld,interruptEnemyV2} from '../src/core/enemy-attack-entity';
import {distance,terrainFits,clearShot} from '../src/core/spatial';
import {navigate} from '../src/core/navigation';
import {activeEncounters} from '../src/core/encounter-domain';
import {tickEnemyDecision} from '../src/core/enemy-decision';
import {command,step} from '../src/core/engine';
import {advanceEnemyEntities} from '../src/core/enemy-attack-entity';

for(const [mode,z,r] of [['zombie',1,0],['ranged',0,1],['mix',1,1],['three',2,1],['four',2,2],['five',3,2]] as const){
 test('six-group legal original-body matrix: '+mode,()=>{const s=createEnemyPlaytest(0,mode as any),es=s.units.filter(u=>u.enemyV2),h=s.units.find(u=>u.id==='hunter')!;
  expect(es.filter(u=>u.enemyVisualProfileId==='zombie')).toHaveLength(z);expect(es.filter(u=>u.enemyVisualProfileId==='ranged')).toHaveLength(r);expect(new Set(es.map(u=>u.id)).size).toBe(z+r);
  for(const e of es){expect(terrainFits(s,e.pos)).toBe(true);expect(clearShot(s,e.pos,h.pos)).toBe(true);expect(navigate(s,h.pos,e.pos,false,false).length).toBeGreaterThan(0);for(const other of es.filter(u=>u.id!==e.id))expect(distance(e.pos,other.pos)).toBeGreaterThan(.36);}
 });
}
function bodies(){const x=setup();configureCombatTrace(x.s,true);registerEnemy(x.s,x.e,ZOMBIE);x.s.postureRuntime={generation:x.s.combatIdentity!.generation,mode:'xinghai',trace:[]};x.h.pos={x:5,y:5};x.al.pos={x:5,y:6};x.e.pos={x:10,y:10};x.e.bodyRadius=.25;const b=structuredClone(x.e);b.id='other-enemy';b.pos={x:11,y:10};x.s.units.push(b);return {...x,b};}
test('fixed dash sweeps to same-floor body contact without tunnelling through',()=>{const x=bodies();moveEnemy(x.s,x.e,{x:13,y:10},3);expect(x.e.pos.x).toBeLessThanOrEqual(10.501);expect(x.e.pos.x).toBeGreaterThan(10.45);expect(distance(x.e.pos,x.b.pos)).toBeGreaterThanOrEqual(.499);});
test('ordinary approach finds a legal side path while root motion keeps its locked line',()=>{const x=bodies();moveEnemy(x.s,x.e,{x:13,y:10},1,true);expect(Math.abs(x.e.pos.y-10)).toBeGreaterThan(.1);expect(distance(x.e.pos,x.b.pos)).toBeGreaterThanOrEqual(.499);});
test('knockback owns the frame when competing dash exists',()=>{const x=bodies();x.e.enemyV2!.dash={at:0,lastAt:0,duration:1,distance:1,facing:0};x.e.enemyV2!.knock={at:0,lastAt:0,duration:1,distance:1,facing:Math.PI/2};x.s.time=.2;advanceEnemyDash(x.s,x.e);expect(x.e.pos.x).toBe(10);expect(x.e.pos.y).toBeCloseTo(10.2);expect(x.e.enemyV2!.dash).toBeUndefined();});
test('dead body releases space',()=>{const x=bodies();x.b.life='dead';moveEnemy(x.s,x.e,{x:13,y:10},3);expect(x.e.pos.x).toBe(13);});
test('two simultaneous archers retain six distinct independent transports on one death',()=>{const x=bodies();x.e.pos={x:10,y:10};x.b.pos={x:10,y:12};x.h.pos={x:14,y:11};for(const e of [x.e,x.b]){registerEnemy(x.s,e,ARCHER);e.enemyV2!.readyAt=0;e.heading=Math.atan2(x.h.pos.y-e.pos.y,x.h.pos.x-e.pos.x);expect(requestEnemyAction(x.s,e,ARCHER,x.h).ok).toBe(true);}x.s.time=.634;
 for(const e of [x.e,x.b])advanceEnemyAction(x.s,e).forEach(r=>commitEnemyRelease(x.s,r));const es=enemyWorld(x.s).entities;expect(es).toHaveLength(6);expect(new Set(es.map(e=>e.id)).size).toBe(6);expect(new Set(es.map(e=>e.context.rootActionId)).size).toBe(2);expect(es.filter(e=>e.spawnAt>x.s.time)).toHaveLength(2);interruptEnemyV2(x.s,x.e,'death');expect(enemyWorld(x.s).entities).toHaveLength(6);expect(es.filter(e=>e.context.actorId===x.b.id)).toHaveLength(3);
});
test('twenty reset generations allocate unique bodies and discard old danger',()=>{let s=createEnemyPlaytest(0,'five' as any);for(let i=0;i<20;i++){const old=s.combatIdentity!.generation;s=createEnemyPlaytest(old,'five' as any);expect(s.combatIdentity!.generation).toBe(old+1);expect(enemyWorld(s).entities).toHaveLength(0);expect(s.postureRuntime!.trace).toHaveLength(0);expect(s.units.filter(u=>u.enemyV2)).toHaveLength(5);}});
test('dead target knowledge expires to return without pursuing hidden live position',()=>{const x=bodies();x.e.enemyV2!.brain={home:{...x.e.pos},repathAt:0,decision:'approach',known:{id:x.h.id,point:{x:12,y:10},at:0}};x.h.life='dead';x.al.life='dead';x.s.time=4;tickEnemyDecision(x.s,x.e,.1);expect(x.e.enemyV2!.brain!.known).toBeUndefined();expect(x.e.enemyMotion).toBe('return');});
test('corpse does not keep the battle domain after all committed danger expires',()=>{const s=createEnemyPlaytest(0,'mix');s.context='explorationBattle';for(const e of s.units.filter(u=>u.enemyV2)){e.life='dead';e.enemyV2!.action=undefined;e.enemyV2!.brain!.known=undefined;}expect(activeEncounters(s)).toHaveLength(0);});
test('a known dead target is replaced by a genuinely observed living body without sticky dead ID',()=>{const x=bodies();x.e.pos={x:10,y:10};x.h.pos={x:11,y:10};x.al.pos={x:11,y:11};x.h.life='dead';x.e.enemyV2!.brain={home:{...x.e.pos},repathAt:0,decision:'ready',chosenAt:0,known:{id:x.h.id,point:{...x.h.pos},at:0}};x.s.time=.1;tickEnemyDecision(x.s,x.e,.1);expect(x.e.enemyV2!.brain!.known?.id).toBe(x.al.id);});
test('real Z control switch alone does not redirect independent known enemy targets',()=>{const s=createEnemyPlaytest(0,'three');step(s,.2);const before=s.units.filter(u=>u.enemyV2).map(u=>u.enemyV2!.brain!.known?.id);expect(command(s,{type:'controlBody',id:'ranger'}).ok).toBe(true);step(s,.01);expect(s.units.filter(u=>u.enemyV2).map(u=>u.enemyV2!.brain!.known?.id)).toEqual(before);});
test('continuous three-body approach remains separated over repeated main substeps',()=>{const s=createEnemyPlaytest(0,'three');for(let i=0;i<80;i++){step(s,.05);const es=s.units.filter(u=>u.enemyV2&&u.life==='active');for(let a=0;a<es.length;a++)for(let b=a+1;b<es.length;b++)expect(distance(es[a].pos,es[b].pos)).toBeGreaterThanOrEqual(.359);}});
test('fixed motion never passes a wall and its blocked path is discarded',()=>{const x=bodies();x.s.tiles.find(t=>t.x===11&&t.y===10)!.obstacle=true;x.e.path=[{x:12,y:10}];moveEnemy(x.s,x.e,{x:12,y:10},2);expect(x.e.pos).toEqual({x:10,y:10});expect(x.e.path).toEqual([]);});
test('simultaneous hazard deduplication is per source entity and per actual body',()=>{const x=bodies();x.h.pos={x:11,y:11};x.al.pos={x:11.1,y:11};for(const e of [x.e,x.b]){registerEnemy(x.s,e,ARCHER);e.enemyV2!.readyAt=0;e.pos={x:10,y:e===x.e?10:12};e.heading=Math.atan2(x.h.pos.y-e.pos.y,x.h.pos.x-e.pos.x);expect(requestEnemyAction(x.s,e,ARCHER,x.h).ok).toBe(true);}x.s.time=.634;for(const e of [x.e,x.b])advanceEnemyAction(x.s,e).forEach(r=>commitEnemyRelease(x.s,r));const es=enemyWorld(x.s).entities;for(const e of es){e.kind='hazard';e.pos={...x.h.pos};e.spawnAt=0;e.expireAt=1;}const calls:string[]=[];for(let i=0;i<2;i++)advanceEnemyEntities(x.s,(e,t)=>{calls.push(e.id+':'+t.id);return {accepted:true,hpLost:1};});expect(calls).toHaveLength(12);expect(new Set(calls).size).toBe(12);});
