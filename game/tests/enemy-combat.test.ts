// AR05: this frozen historical suite verifies the retained pre-Blue branch.

vi.mock('../src/core/hunter-state',async importActual=>({...await importActual<object>(),isHunterV2:()=>false}));
import {vi,expect,it} from 'vitest';
import {createGame,command,step,resolveHit} from '../src/core/engine';
import type {Unit} from '../src/core/types';
import {ENEMY_ABILITIES,ENEMY_KITS,abilityArea} from '../src/core/enemy-abilities';
import {initializeEnemyCombat,initialAbilityOffset,chooseEnemyCombat,tickEnemyReaction,scheduleEnemyReaction,braceActive} from '../src/core/enemy-combat';
import {startIntent,tickIntent,intentTargets} from '../src/core/attack-intent';
import {activeAvoidanceWindow} from '../src/core/evasion';
import {combatStep} from '../src/core/combat-step';
import {distance} from '../src/core/spatial';
export function fixture(role:Unit['role']='melee'){
 const s=createGame();command(s,{type:'selectJourney',journey:'exploration'});command(s,{type:'selectExplorationCompanion',id:'ines'});command(s,{type:'carry',gold:0,vitality:0});
 s.tiles.forEach(t=>{t.obstacle=false;t.layer=0;});const h=s.units[0],p=s.units.find(u=>u.id==='ines')!,e=s.units.find(u=>u.role===role)!;s.units=[h,p,e];
 h.pos={x:11,y:10};p.pos={x:11,y:11};e.pos={x:10,y:10};for(const u of s.units){u.drawPos={...u.pos};u.path=[];u.ready=0;u.dodge=0;u.defense=undefined;u.hp=u.maxHp=10000;u.attackTimer=100;u.weapons.forEach(w=>w.weight=0);}
 p.life='withdrawn';e.enemySense!.home={...e.pos};e.enemyMotion='engaged';e.pursuitTargetId=h.id;s.context='explorationBattle';return {s,h,p,e};
}
it('Standalone assigns three independent enemy kits, leaving player slots separate',()=>{
 const {s}=fixture();const d=s.exploration!.definition;expect(new Set(d.enemies.map(e=>(e as any).combatKitId))).toEqual(new Set(['melee-v1','ranged-v1','heavy-v1']));
 expect((s.units.find(u=>u.team==='enemy') as any).enemyCombat?.kitId).toBe('melee-v1');
});
it('ready enemy uses an ability intent with committed cooldown rather than a player skill',()=>{
 const {s,e}=fixture();const c=(e as any).enemyCombat;if(c){c.armed=true;c.abilityReadyAt=0;}e.attackTimer=0;step(s,.05);
 expect((e.attackIntent as any)?.enemyAbilityId).toBe('melee-heavy-cleave');expect((e.attackIntent as any)?.kind).toBe('ability');expect((e as any).enemyCombat?.abilityReadyAt).toBeCloseTo(s.time+5);
});
function ready(role:Unit['role']='melee') {const f=fixture(role);f.e.enemyCombat!.armed=true;f.e.enemyCombat!.abilityReadyAt=0;f.e.attackTimer=0;return f;}
for(const role of ['melee','ranged','heavy'] as const){
 it(role+' snapshots ability shape, timing, HP and posture, and cannot double commit',()=>{
  const {s,h,e}=ready(role);if(role==='ranged')h.pos.x=13;const id=ENEMY_KITS[e.enemyCombat!.kitId].ability,c=ENEMY_ABILITIES[id];
  expect(chooseEnemyCombat(s,e,h)).toBe(true);const a=e.attackIntent!;expect(a).toMatchObject({kind:'ability',enemyAbilityId:id,label:c.label,lockAt:c.lock,resolveAt:c.total});
  expect(a.damage).toBeCloseTo(e.weapons[0].damage*c.hp);expect(a.postureDamage).toBeCloseTo(e.weapons[0].postureDamage!*c.posture);expect(a.area.kind).toBe(role==='melee'?'sector':role==='ranged'?'capsule':'circle');
  expect(e.enemyCombat!.abilityReadyAt).toBe(c.cooldown);expect(chooseEnemyCombat(s,e,h)).toBe(false);expect(e.attackIntent).toBe(a);
  s.time=c.lock;tickIntent(s,e,c.lock);expect(a.phase).toBe('locked');const locked=structuredClone(a.area);h.pos.y+=2;s.time=c.total-.01;expect(tickIntent(s,e,.1)).toBeNull();expect(a.area).toEqual(locked);s.time=c.total;expect(tickIntent(s,e,.01)).toBe(a);
 });
 for(const phase of ['tracking','locked'] as const)it(role+' true Break cancels '+phase+' ability without cooldown refund or hit',()=>{
  const {s,h,e}=ready(role);if(role==='ranged')h.pos.x=13;chooseEnemyCombat(s,e,h);e.attackIntent!.phase=phase;e.posture=0;e.postureDelay=100;const cd=e.enemyCombat!.abilityReadyAt;
  resolveHit(s,e,h.weapons[0],1,h,{kind:'basic',postureDamage:1});expect(e.attackIntent).toBeUndefined();expect(e.enemyCombat!.abilityReadyAt).toBe(cd);expect(e.stagger).toBeGreaterThan(0);const hp=h.hp;step(s,1.3);expect(h.hp).toBe(hp);expect(s.stats.enemyAbilitiesReleased||0).toBe(0);
 });
 it(role+' ability resolves once through common hit events and exact multipliers',()=>{
  const {s,h,e}=ready(role);if(role==='ranged')h.pos.x=13;const id=ENEMY_KITS[e.enemyCombat!.kitId].ability,c=ENEMY_ABILITIES[id];chooseEnemyCombat(s,e,h);const hp=h.hp,posture=h.posture;
  step(s,c.total);expect(hp-h.hp).toBeCloseTo(e.weapons[0].damage*c.hp);expect(posture-h.posture).toBeCloseTo(e.weapons[0].postureDamage!*c.posture);expect(s.combatEvents!.filter(a=>a.enemyAbilityId===id)).toHaveLength(1);expect(s.stats.enemyAbilitiesReleased).toBe(1);
 });
 it(role+' position avoid and active evasion produce no HP/posture/on-hit',()=>{
  const {s,h,p,e}=ready(role);if(role==='ranged')h.pos.x=13;chooseEnemyCombat(s,e,h);const a=e.attackIntent!;a.phase='locked';h.pos={x:20,y:20};p.life='active';p.pos={x:10.8,y:10};p.evasion={charges:1,progress:0,action:{from:{...p.pos},to:{...p.pos},startedAt:a.resolveAt-.03,layer:0}};p.attackTimer=100;
  const hp=p.hp,posture=p.posture;step(s,a.resolveAt);expect(h.hp).toBe(10000);expect(p.hp).toBe(hp);expect(p.posture).toBe(posture);expect(s.combatEvents||[]).toHaveLength(0);
 });
}
it('initial offsets are deterministic by stable identity and seed, armed only on first contact',()=>{
 const {s,h,e}=fixture();e.attackTimer=100;const first=initialAbilityOffset('room-1-0',5);expect(first).toBe(initialAbilityOffset('room-1-0',5));expect(first).toBeGreaterThanOrEqual(0);expect(first).toBeLessThanOrEqual(1.2);expect(first).not.toBe(initialAbilityOffset('room-1-1',5));
 s.time=90;expect(e.enemyCombat!.armed).toBe(false);chooseEnemyCombat(s,e,h);expect(e.enemyCombat!.abilityReadyAt).toBeCloseTo(90+e.enemyCombat!.initialOffset);s.time=100;chooseEnemyCombat(s,e,h);expect(e.enemyCombat!.abilityReadyAt).toBeCloseTo(90+e.enemyCombat!.initialOffset);
});
it('ability cooldown expires and basic remains available in between',()=>{
 const {s,h,e}=ready();chooseEnemyCombat(s,e,h);const c=e.enemyCombat!.abilityReadyAt;e.attackIntent=undefined;e.attackTimer=0;expect(chooseEnemyCombat(s,e,h)).toBe(false);expect(startIntent(s,e,h)).toBe(true);expect(e.attackIntent!.kind).toBe('basic');e.attackIntent=undefined;e.attackTimer=0;s.time=c;expect(chooseEnemyCombat(s,e,h)).toBe(true);
});
it('tower and old courtyard never receive kits or enemy avoidance',()=>{
 const {s,e}=fixture();s.exploration!.definition.kind=undefined;initializeEnemyCombat(s,e);expect(e.enemyCombat).toBeUndefined();s.exploration=undefined;s.ruleset='tower';initializeEnemyCombat(s,e);expect(e.enemyCombat).toBeUndefined();expect(chooseEnemyCombat(s,e)).toBe(false);expect(activeAvoidanceWindow(s,e)).toBe(false);
});
it('Power Shot only starts at 2.2–6U with LOS',()=>{
 const {s,h,e}=ready('ranged');e.enemyCombat!.reactionReadyAt=100;
 for(const x of [12.1,16.01]){h.pos.x=x;expect(chooseEnemyCombat(s,e,h)).toBe(false);}h.pos.x=13;s.tiles.find(t=>t.x===12&&t.y===10)!.obstacle=true;expect(chooseEnemyCombat(s,e,h)).toBe(false);s.tiles.find(t=>t.x===12&&t.y===10)!.obstacle=false;
});
it('Power Shot uses a clipped 0.16 half-width capsule and Slam uses source-centred 1.75 circle',()=>{
 const {s,e}=ready('ranged');s.tiles.find(t=>t.x===14&&t.y===10)!.obstacle=true;const a=abilityArea(s,e,'ranged-power-shot',0);expect(a.kind).toBe('capsule');if(a.kind==='capsule'){expect(a.radius).toBe(.16);expect(a.to.x).toBeLessThan(13.51);}expect(abilityArea(s,e,'heavy-ground-slam',0)).toEqual({kind:'circle',center:e.pos,radius:1.75});
});
it('Slam can hit both originals with one cast, even when pursuit target is outside but another is close',()=>{
 const {s,h,p,e}=ready('heavy');h.pos={x:11,y:10};p.life='active';p.pos={x:10,y:11};chooseEnemyCombat(s,e,h);expect(intentTargets(s,e.attackIntent!)).toHaveLength(2);step(s,1.15);expect(h.hp).toBeLessThan(10000);expect(p.hp).toBeLessThan(10000);const events=s.combatEvents!.filter(a=>a.kind==='ability');expect(events).toHaveLength(2);expect(events[0].castId).toBe(events[1].castId);
 e.attackIntent=undefined;e.attackTimer=0;e.enemyCombat!.abilityReadyAt=0;h.pos={x:15,y:10};p.pos={x:10,y:11};expect(chooseEnemyCombat(s,e,h)).toBe(true);
});
for(const role of ['melee','ranged','heavy'] as const)it(role+' reaction has pending delay, duration, cooldown and no overlap with existing intent',()=>{
 const {s,h,e}=fixture(role);expect(scheduleEnemyReaction(s,e,h)).toBe(true);const a=e.enemyCombat!.reaction!,start={...e.pos};s.time=.14;expect(tickEnemyReaction(s,e)).toBe(true);expect(e.pos).toEqual(start);expect(a.phase).toBe('pending');s.time=.15;tickEnemyReaction(s,e);expect(a.phase).toBe('active');s.time=a.endsAt;tickEnemyReaction(s,e);expect(e.enemyCombat!.reaction).toBeUndefined();expect(distance(start,e.pos)).toBeCloseTo(role==='melee'?.55:role==='ranged'?.9:0);expect(scheduleEnemyReaction(s,e,h)).toBe(false);
 s.time=e.enemyCombat!.reactionReadyAt;expect(scheduleEnemyReaction(s,e,h)).toBe(true);e.enemyCombat!.reaction=undefined;startIntent(s,e,h);expect(scheduleEnemyReaction(s,e,h)).toBe(false);
});
it('Counter Step only follows real direct non-derived hit, no evade window',()=>{
 const {s,h,e}=fixture();for(const options of [{derived:true},{originKind:'field' as const},{originKind:'delayed' as const}]){resolveHit(s,e,h.weapons[0],1,h,options);expect(e.enemyCombat!.reaction).toBeUndefined();}resolveHit(s,e,h.weapons[0],1,h);expect(e.enemyCombat!.reaction?.id).toBe('counter-step');s.time=.18;tickEnemyReaction(s,e);expect(activeAvoidanceWindow(s,e)).toBe(false);const hp=e.hp;expect(resolveHit(s,e,h.weapons[0],10,h)).toBe(true);expect(e.hp).toBeLessThan(hp);
});
it('zero damage and posture does not fabricate a real reaction trigger',()=>{const {s,h,e}=fixture();resolveHit(s,e,h.weapons[0],0,h,{postureDamage:0});expect(e.enemyCombat!.reaction).toBeUndefined();});
it('Counter Step chooses more available side, stable tie, and resumes pursuit',()=>{
 const {s,h,e}=fixture();scheduleEnemyReaction(s,e,h);const first={...e.enemyCombat!.reaction!.to};e.enemyCombat!.reaction=undefined;e.enemyCombat!.reactionReadyAt=0;scheduleEnemyReaction(s,e,h);expect(e.enemyCombat!.reaction!.to).toEqual(first);
 s.tiles.find(t=>t.x===10&&t.y===Math.round(first.y))!.obstacle=true;e.enemyCombat!.reaction=undefined;e.enemyCombat!.reactionReadyAt=0;scheduleEnemyReaction(s,e,h);expect((e.enemyCombat!.reaction!.to.y-10)*(first.y-10)).toBeLessThan(0);
});
it('Backstep proximity reads visible Party Bodies, not input/control changes, and has only .08 active window',()=>{
 const {s,h,e}=fixture('ranged');e.attackTimer=100;h.pos.x=11.7;chooseEnemyCombat(s,e,h);expect(e.enemyCombat!.reaction).toBeUndefined();s.controlledBodyId='ines';h.pos.x=11.5;expect(chooseEnemyCombat(s,e,h)).toBe(true);expect(activeAvoidanceWindow(s,e)).toBe(false);s.time=.16;tickEnemyReaction(s,e);const hp=e.hp,posture=e.posture;expect(activeAvoidanceWindow(s,e)).toBe(true);expect(resolveHit(s,e,h.weapons[0],100,h,{postureDamage:100})).toBe(false);expect(e.hp).toBe(hp);expect(e.posture).toBe(posture);s.time=.24;tickEnemyReaction(s,e);expect(activeAvoidanceWindow(s,e)).toBe(false);expect(resolveHit(s,e,h.weapons[0],10,h)).toBe(true);
});
for(const reason of ['wall','layer','body','map','leash'] as const)it('Backstep safely stops at '+reason+' without tunnelling',()=>{
 const {s,h,e}=fixture('ranged');if(reason==='wall')s.tiles.find(t=>t.x===9&&t.y===10)!.obstacle=true;if(reason==='layer')s.tiles.find(t=>t.x===9&&t.y===10)!.layer=1;if(reason==='body'){const b=structuredClone(h);b.id='blocker';b.pos={x:9.3,y:10};s.units.push(b);}if(reason==='map'){e.pos={x:0,y:10};h.pos={x:1,y:10};e.enemySense!.home={...e.pos};}if(reason==='leash'){e.enemySense!.home={x:18,y:10};e.enemySense!.pursuitPolicy='territorial';}const from={...e.pos};scheduleEnemyReaction(s,e,h);s.time=.4;tickEnemyReaction(s,e);expect(distance(from,e.pos)).toBeLessThan(.9-1e-6);expect(distance(e.pos,e.enemySense!.home)).toBeLessThanOrEqual(8+1e-7);expect(e.pos.x).toBeGreaterThanOrEqual(-.32-1e-7);expect(e.enemyCombat!.reactionReadyAt).toBe(5);
});
it('failed Backstep does not grant invulnerability or retry every frame',()=>{const {s,h,e}=fixture('ranged');e.enemySense!.home={x:18,y:10};e.enemySense!.pursuitPolicy='territorial';chooseEnemyCombat(s,e,h);s.time=.16;tickEnemyReaction(s,e);expect(activeAvoidanceWindow(s,e)).toBe(false);expect(e.enemyCombat!.reaction).toBeUndefined();expect(chooseEnemyCombat(s,e,h)).toBe(false);expect(e.enemyCombat!.reactionReadyAt).toBe(5);});
for(const dir of ['front','side','back'] as const)it('Heavy Brace '+dir+' HP/posture and Weakpoint respect EC06',()=>{
 const {s,h,e}=fixture('heavy');e.heading=0;scheduleEnemyReaction(s,e,h);s.time=.15;tickEnemyReaction(s,e);expect(braceActive(s,e)).toBe(true);h.pos=dir==='front'?{x:11,y:10}:dir==='side'?{x:10,y:11}:{x:9,y:10};const hp=e.hp,posture=e.posture;resolveHit(s,e,h.weapons[0],100,h,{postureDamage:10});expect(hp-e.hp).toBeCloseTo(dir==='front'?45.5:dir==='back'?125:100);expect(posture-e.posture).toBeCloseTo(dir==='front'?4.9:dir==='back'?13.5:10);expect(s.combatEvents!.at(-1)!.weakpointId).toBe(dir==='back'?'rear-core':undefined);
});
it('Brace only triggers from a Front direct hit and Broken immediately removes it',()=>{
 const {s,h,e}=fixture('heavy');e.heading=0;h.pos={x:9,y:10};resolveHit(s,e,h.weapons[0],1,h);expect(e.enemyCombat!.reaction).toBeUndefined();h.pos.x=11;resolveHit(s,e,h.weapons[0],1,h);expect(e.enemyCombat!.reaction?.phase).toBe('pending');s.time=.15;tickEnemyReaction(s,e);e.posture=1;resolveHit(s,e,h.weapons[0],1,h,{postureDamage:10});expect(e.posture).toBe(0);expect(e.enemyCombat!.reaction).toBeUndefined();
});
for(const phase of ['pending','active'] as const)it('true Break cancels '+phase+' Reaction, retains cooldown, prioritises Impact',()=>{
 const {s,h,e}=fixture('melee');scheduleEnemyReaction(s,e,h);if(phase==='active'){s.time=.18;tickEnemyReaction(s,e);}e.posture=0;e.postureDelay=100;const cd=e.enemyCombat!.reactionReadyAt;resolveHit(s,e,h.weapons[0],1,h,{postureDamage:1,kind:'basic'});expect(e.enemyCombat!.reaction).toBeUndefined();expect(e.enemyCombat!.reactionReadyAt).toBe(cd);expect(e.forcedMotion).toBeDefined();
});
it('Cleave and Slam apply declared Break Impact without WallPin',()=>{
 for(const role of ['melee','heavy'] as const){const {s,h,e}=ready(role);chooseEnemyCombat(s,e,h);h.posture=0;h.postureDelay=100;step(s,e.attackIntent!.resolveAt);expect(s.stats.break).toBe(1);expect(h.forcedMotion?.wallPin).toBe(false);expect(h.forcedMotion?.remaining).toBeCloseTo((role==='melee'?.65:1.15)*.75);}
});
it('combat step checks every intermediate terrain sample',()=>{const {s,e}=fixture();s.tiles.find(t=>t.x===11&&t.y===10)!.obstacle=true;const p=combatStep(s,e,{x:10,y:10},{x:13,y:10},0,()=>true);expect(p.x).toBeLessThan(10.5);});
it('two identical nearby melee units start first abilities on distinct simulation steps',()=>{
 const {s,h,e}=fixture();e.attackTimer=0;const b=structuredClone(e);b.id='second-enemy';b.pos={x:10.5,y:10.7};b.drawPos={...b.pos};b.enemySense!.home={...b.pos};initializeEnemyCombat(s,e,'room-1-0');initializeEnemyCombat(s,b,'room-1-1');s.units.push(b);
 const starts=new Map<string,number>();for(let i=0;i<80;i++){step(s,.05);for(const u of [e,b])if(u.attackIntent?.kind==='ability'&&!starts.has(u.id))starts.set(u.id,u.attackIntent.startedAt);}
 expect(starts.size).toBe(2);expect(starts.get(e.id)).not.toBe(starts.get(b.id));expect(e.enemyCombat!.initialOffset).not.toBe(b.enemyCombat!.initialOffset);expect(h.hp).toBeLessThan(10000);
});
it('Broken alone leaves committed ability intact; only the later Break cancels it',()=>{const {s,h,e}=ready();chooseEnemyCombat(s,e,h);e.posture=1;resolveHit(s,e,h.weapons[0],1,h,{postureDamage:10});expect(e.posture).toBe(0);expect(e.attackIntent?.kind).toBe('ability');expect(e.stagger).toBe(0);resolveHit(s,e,h.weapons[0],1,h,{postureDamage:10});expect(e.attackIntent).toBeUndefined();});
it('dynamic body blocking during reaction clips movement and gives no lingering window',()=>{const {s,h,p,e}=fixture('ranged');scheduleEnemyReaction(s,e,h);s.time=.2;tickEnemyReaction(s,e);p.life='active';p.pos={x:e.pos.x-.36,y:e.pos.y};const pos={...e.pos};s.time=.3;tickEnemyReaction(s,e);expect(distance(pos,e.pos)).toBeLessThan(.03);expect(e.enemyCombat!.reaction).toBeUndefined();expect(activeAvoidanceWindow(s,e)).toBe(false);});
