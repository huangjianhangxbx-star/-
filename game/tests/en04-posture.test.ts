import {test,expect} from 'vitest';
import {createEnemyPlaytest} from '../src/core/enemy-playtest';
import {command,resolveHit,step} from '../src/core/engine';
import {configureCombatTrace} from '../src/core/combat-identity';
import {requestEnemyAction,advanceEnemyAction} from '../src/core/enemy-action';
import {ARCHER} from '../src/core/enemy-profiles';
import {commitEnemyRelease,enemyWorld} from '../src/core/enemy-attack-entity';
function fixture(mode:'zombie'|'ranged'='zombie',postureMode:'xinghai'|'reference'='xinghai'){
 const s=createEnemyPlaytest(0,mode,postureMode),h=s.units.find(u=>u.id==='hunter')!,al=s.units.find(u=>u.id==='ranger')!,e=s.units.find(u=>u.enemyV2)!;
 h.maxPosture=90;h.posture=90;al.pos={x:20,y:20};e.enemyV2!.brain=undefined;e.enemyV2!.readyAt=100;return {s,h,al,e};
}
const hit=(x:ReturnType<typeof fixture>,target=x.e,posture=15)=>resolveHit(x.s,target,{...x.h.weapons[0],damage:1,postureDamage:posture},1,target.team==='enemy'?x.h:x.e,{hitOrigin:{x:target.pos.x+1,y:target.pos.y}});

test('V2 first contact from 1 to zero immediately controls, cancels an unconsumed native Hit',()=>{
 const x=fixture();x.e.pos={x:x.h.pos.x+1,y:x.h.pos.y};x.e.heading=Math.PI;x.e.enemyV2!.readyAt=0;
 expect(requestEnemyAction(x.s,x.e,x.e.enemyV2!.profile,x.h).ok).toBe(true);x.e.posture=1;const hp=x.e.hp;
 expect(hit(x)).toBe(true);expect(x.e.hp).toBeLessThan(hp);expect(x.e.posture).toBe(0);expect(x.e.stagger).toBeCloseTo(.6);
 expect(x.e.enemyV2!.action).toBeUndefined();x.s.time=.7;expect(advanceEnemyAction(x.s,x.e)).toEqual([]);
});
test('successful front guard costs half posture even with zero HP loss and can break at once',()=>{
 const x=fixture();command(x.s,{type:'hunterInput',id:x.h.id,kind:'guard',held:true,aim:{x:x.h.pos.x+5,y:x.h.pos.y}});step(x.s,.1);
 x.h.posture=7;x.h.postureDelay=0;const hp=x.h.hp;hit(x,x.h);expect(x.h.hp).toBe(hp);expect(x.h.posture).toBe(0);expect(x.h.stagger).toBeCloseTo(.6);expect(x.h.hunterCombat!.special).toBeUndefined();
});
test('rear contact costs full posture while roll immunity consumes neither HP nor posture',()=>{
 const x=fixture();x.h.posture=90;command(x.s,{type:'hunterInput',id:x.h.id,kind:'guard',held:true,aim:{x:x.h.pos.x-4,y:x.h.pos.y}});step(x.s,.1);hit(x,x.h);expect(x.h.posture).toBe(75);
 command(x.s,{type:'controlBody',id:x.al.id});command(x.s,{type:'alInput',id:x.al.id,kind:'roll',direction:{x:0,y:1}});const before=[x.al.hp,x.al.posture];hit(x,x.al);expect([x.al.hp,x.al.posture]).toEqual(before);
});
test('continuous zero contacts do not refresh control; completion restores nonzero half maximum',()=>{
 const x=fixture();x.e.posture=1;hit(x);step(x.s,.3);const left=x.e.stagger;hit(x);expect(x.e.stagger).toBeCloseTo(left);step(x.s,.31);expect(x.e.stagger).toBe(0);expect(x.e.posture).toBe(45);
});
test('ordinary walking recovers but real main attack pauses and guard recovers at half speed',()=>{
 const x=fixture();x.h.posture=30;x.h.postureDelay=0;expect(command(x.s,{type:'direct',id:x.h.id,direction:{x:0,y:1}}).ok).toBe(true);const pos={...x.h.pos};step(x.s,.2);expect(x.h.posture).toBeCloseTo(34.5);expect(x.h.pos).not.toEqual(pos);
 command(x.s,{type:'direct',id:x.h.id,direction:null});command(x.s,{type:'hunterInput',id:x.h.id,kind:'basic',held:true,aim:x.e.pos});const before=x.h.posture;step(x.s,.1);expect(x.h.posture).toBeCloseTo(before);
 const g=fixture();g.h.posture=30;g.h.postureDelay=0;command(g.s,{type:'hunterInput',id:g.h.id,kind:'guard',held:true,aim:g.e.pos});step(g.s,.2);expect(g.h.posture).toBeCloseTo(32.25);
});
test('post-Hit posture interruption retains all three committed arrows including the unborn third',()=>{
 const x=fixture('ranged');x.e.enemyV2!.readyAt=0;x.e.heading=Math.atan2(x.h.pos.y-x.e.pos.y,x.h.pos.x-x.e.pos.x);
 expect(requestEnemyAction(x.s,x.e,ARCHER,x.h).ok).toBe(true);x.s.time=.6333;advanceEnemyAction(x.s,x.e).forEach(r=>commitEnemyRelease(x.s,r));x.e.posture=1;hit(x);
 expect(x.e.stagger).toBeCloseTo(.6);expect(enemyWorld(x.s).entities).toHaveLength(3);expect(enemyWorld(x.s).entities[2].spawnAt).toBeCloseTo(.7333);
});
test('diagnostic OFF changes no HP posture control RNG or runtime ID allocation',()=>{
 const run=(trace:boolean)=>{const x=fixture();configureCombatTrace(x.s,trace);x.e.posture=1;hit(x);step(x.s,.7);return {hp:x.e.hp,posture:x.e.posture,stagger:x.e.stagger,seed:x.s.seed,next:x.s.nextId,ids:x.s.combatIdentity?.nextRuntimeActionId};};expect(run(false)).toEqual(run(true));
});
import {tickEnemyPosture,postureActivity} from '../src/core/enemy-posture';
import {resetCombatTrace} from '../src/core/combat-identity';
import {applyPosture} from '../src/core/pressure';
test('effective-hit delay elapses during control rather than adding another control-length wait',()=>{
 const x=fixture();x.e.posture=1;hit(x);x.s.time=.6;tickEnemyPosture(x.s,x.e,.6);expect(x.e.posture).toBe(45);x.s.time=1.6;tickEnemyPosture(x.s,x.e,1);expect(x.e.posture).toBeCloseTo(47.25);
});
test('death wins over posture break without producing a living-control trace',()=>{
 const x=fixture();x.e.posture=1;x.e.hp=.1;hit(x);expect(x.e.life).toBe('dead');expect(x.e.stagger).toBe(0);expect(x.e.postureControl).toBeUndefined();expect(x.s.postureRuntime!.trace.filter(t=>t.kind==='PostureBroken')).toHaveLength(0);
});
test('DOT alone neither postpones recovery nor cancels a real action',()=>{
 const x=fixture();x.e.posture=20;x.e.postureDelay=0;x.e.statuses.push({kind:'poison',power:1,remaining:10,name:'fixture DOT',source:x.h.id});step(x.s,.2);expect(x.e.posture).toBeCloseTo(24.5);expect(x.e.postureDelay).toBe(0);
 hit(x);expect(x.e.postureDelay).toBe(1.5);step(x.s,.2);expect(x.e.posture).toBeCloseTo(9.5);expect(x.e.postureDelay).toBeCloseTo(1.3);
});
test('Al RMB is main-hand action rather than assuming every RMB is offhand',()=>{
 const x=fixture();command(x.s,{type:'controlBody',id:x.al.id});x.al.posture=30;x.al.postureDelay=0;command(x.s,{type:'alInput',id:x.al.id,kind:'shot',held:true,aim:x.e.pos});expect(postureActivity(x.al)).toBe('main-skill');step(x.s,.1);expect(x.al.posture).toBe(30);
});
test('legacy second-hit break stays isolated, frozen reference has no added posture',()=>{
 const x=fixture('zombie','reference');x.e.posture=1;hit(x);expect(x.e.posture).toBe(1);expect(x.e.stagger).toBe(0);
 const u=fixture().e;u.posture=1;expect(applyPosture(u,15).breakReaction).toBe(false);expect(u.stagger).toBe(0);expect(applyPosture(u,15).breakReaction).toBe(true);
});
test('world generation reset clears control and diagnostic state before new-world ticking',()=>{
 const x=fixture();x.e.posture=1;hit(x);resetCombatTrace(x.s);step(x.s,.01);expect(x.e.postureControl).toBeUndefined();expect(x.e.stagger).toBe(0);expect(x.e.posture).toBe(90);expect(x.s.postureRuntime!.generation).toBe(x.s.combatIdentity!.generation);
});

test('substepped recovery deadline is measured from last real contact including control time',()=>{const x=fixture();x.e.posture=1;hit(x);step(x.s,1.6);expect(x.e.posture).toBeCloseTo(47.25);});
