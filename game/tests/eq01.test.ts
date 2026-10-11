import {test,expect} from 'vitest';
import {setup} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {command,step,resolveHit} from '../src/core/engine';
import {weightProfile} from '../src/core/combat-config';
import {hunterDefense} from '../src/core/hunter-combat';
import {acceptOffhandAction,cancelOffhand} from '../src/core/offhand';
import {queryOffhandAction} from '../src/core/offhand';
async function module(){return import('../src/core/equipment').catch(()=>undefined);}
function fixture(){const a=setup();a.s.sessionMode='exploration';beginWorld(a.s);a.s.context='explorationIdle';return a;}
test('EQ defaults are independent real right/left instances, and owned candidates do not change main weapon',async()=>{
 const m=await module();expect(m,'equipment authority exists').toBeDefined();const {s,h,al}=fixture();
 const right=h.equipment!.equipped.right;expect(h.equipment!.equipped.left.action).toBe('guard');expect(al.equipment!.equipped.left.action).toBe('shot');
 expect(new Set([right.id,h.equipment!.equipped.left.id,al.equipment!.equipped.right.id,al.equipment!.equipped.left.id]).size).toBe(4);
 const bomb=h.equipment!.owned.find(e=>e.action==='bomb')!;expect(command(s,{type:'equipOffhand',id:h.id,instanceId:bomb.id}).ok).toBe(true);expect(h.equipment!.equipped.right).toBe(right);
 expect(command(s,{type:'equipOffhand',id:al.id,instanceId:bomb.id}).ok).toBe(false);
});
test('EQ qualification is read-only, invalid wall/range/target and exhausted stamina never pay',()=>{
 const {s,h}=fixture(),bomb=h.equipment!.owned[1];command(s,{type:'equipOffhand',id:h.id,instanceId:bomb.id});const before=structuredClone(h);
 for(const aim of [undefined,{x:NaN,y:10},{x:20,y:10}])expect(queryOffhandAction(s,h,aim).ok).toBe(false);expect(h).toEqual(before);
 s.tiles.find(t=>t.x===11&&t.y===10)!.obstacle=true;expect(acceptOffhandAction(s,h,true,{x:12,y:10}).reason).toContain('障碍');expect(h.stamina!.current).toBe(100);expect(bomb.cd).toBe(0);expect(bomb.durability).toBe(100);
 acceptOffhandAction(s,h,false);s.tiles.forEach(t=>t.obstacle=false);h.stamina!.current=19;expect(acceptOffhandAction(s,h,true,{x:12,y:10}).reason).toContain('体力');expect(bomb.cd).toBe(0);
});
test('EQ cancel before Release loses accepted stamina/CD, never wears or creates entity',()=>{
 const {s,h}=fixture(),bomb=h.equipment!.owned[1];command(s,{type:'equipOffhand',id:h.id,instanceId:bomb.id});acceptOffhandAction(s,h,true,{x:12,y:10});cancelOffhand(s,h,'cancel');step(s,.2);
 expect(h.stamina!.current).toBe(80);expect(bomb.cd).toBeCloseTo(4.8);expect(bomb.durability).toBe(100);expect(h.offhand!.entities).toHaveLength(0);
});
test('EQ released bomb survives Z with source identity, but source cooldown freezes; death clears entity without equipment reset',()=>{
 const {s,h,al,e}=fixture(),bomb=h.equipment!.owned[1];command(s,{type:'equipOffhand',id:h.id,instanceId:bomb.id});acceptOffhandAction(s,h,true,{x:12,y:10});step(s,.06);const entity=h.offhand!.entities[0],cd=bomb.cd;
 command(s,{type:'controlBody',id:al.id});step(s,.5);expect(bomb.cd).toBe(cd);expect(entity.sourceId).toBe(h.id);expect(entity.attack.actorId).toBe(h.id);expect(bomb.durability).toBe(99);
 command(s,{type:'controlBody',id:h.id});bomb.cd=0;acceptOffhandAction(s,h,false);acceptOffhandAction(s,h,true,{x:12,y:10});step(s,.06);resolveHit(s,h,{...e.weapons[0],subtype:'impact'},99999,e);expect(h.offhand!.entities).toHaveLength(0);const equipment=h.equipment;step(s,10.01);expect(h.equipment).toBe(equipment);expect(bomb.durability).toBe(98);expect(bomb.cd).toBeGreaterThan(4.8);
});
test('EQ shield only wears on successful defense once per guard; broken shield blocks guard but not right E',()=>{
 const {s,h}=fixture(),shield=h.equipment!.equipped.left,bomb=h.equipment!.owned[1];expect(command(s,{type:'hunterInput',id:h.id,kind:'guard',aim:{x:12,y:10}}).ok).toBe(true);expect(shield.durability).toBe(100);
 expect(command(s,{type:'equipOffhand',id:h.id,instanceId:bomb.id}).ok).toBe(false);step(s,.09);expect(hunterDefense(s,h,{x:12,y:10})).toBe('block');expect(hunterDefense(s,h,{x:12,y:10})).toBe('block');expect(shield.durability).toBe(99);
 shield.durability=0;expect(hunterDefense(s,h,{x:12,y:10})).not.toBe('block');command(s,{type:'hunterInput',id:h.id,kind:'guard',held:false});expect(command(s,{type:'hunterInput',id:h.id,kind:'guard'}).ok).toBe(false);expect(command(s,{type:'hunterInput',id:h.id,kind:'active'}).ok).toBe(true);
});
test('EQ Al shot Release wear keeps ammo timing; bomb gate blocks held autoshot and rocket remains independent',()=>{
 const {s,al}=fixture();command(s,{type:'controlBody',id:al.id});const gun=al.equipment!.equipped.left,bomb=al.equipment!.owned[1];expect(acceptOffhandAction(s,al,true,{x:12,y:10})).toEqual({ok:true});step(s,.02);expect(al.alCombat!.ammo).toBe(4);expect(gun.durability).toBe(100);step(s,.02);expect(al.alCombat!.ammo).toBe(3);expect(gun.durability).toBe(99);acceptOffhandAction(s,al,false);step(s,.55);
 expect(command(s,{type:'equipOffhand',id:al.id,instanceId:bomb.id}).ok).toBe(true);const ammo=al.alCombat!.ammo;expect(command(s,{type:'alInput',id:al.id,kind:'shot'}).ok).toBe(false);expect(al.alCombat!.shotHeld).toBe(false);expect(al.alCombat!.ammo).toBe(ammo);expect(command(s,{type:'alInput',id:al.id,kind:'rocket',aim:{x:12,y:10}}).ok).toBe(true);
});
test('EQ damage authority works with tracing disabled and blocked targets never take splash',()=>{
 const {s,h,e}=fixture();s.combatIdentity!.enabled=false;const bomb=h.equipment!.owned[1];command(s,{type:'equipOffhand',id:h.id,instanceId:bomb.id});e.hp=150;e.pos={x:12,y:10};const wallTarget=structuredClone(e);wallTarget.id='behind';wallTarget.pos={x:13,y:10};s.units.push(wallTarget);s.tiles.find(t=>t.x===13&&t.y===10)!.obstacle=true;
 acceptOffhandAction(s,h,true,{x:12,y:10});step(s,.6);expect(e.hp).toBe(105);expect(wallTarget.hp).toBe(150);expect(bomb.durability).toBe(99);expect(h.offhand!.entities).toHaveLength(0);
});
test('EQ left candidates preserve golden weight, main durability and profession; broken bomb cannot pay',()=>{
 const {s,h}=fixture();const profile=weightProfile(h),right=h.equipment!.equipped.right,bomb=h.equipment!.owned[1];command(s,{type:'equipOffhand',id:h.id,instanceId:bomb.id});expect(weightProfile(h)).toEqual(profile);expect(right.weapon).toBe(h.weapons[h.weaponIndex]);const durability=right.weapon.durability;bomb.durability=0;expect(acceptOffhandAction(s,h,true,{x:12,y:10}).reason).toContain('损坏');expect(h.stamina!.current).toBe(100);expect(right.weapon.durability).toBe(durability);
});
test('EQ area unload discards Release entity, preserves gear/resource IDs/CD and does not use wall time',()=>{
 const {s,h,al}=fixture(),bomb=h.equipment!.owned[1];command(s,{type:'equipOffhand',id:h.id,instanceId:bomb.id});acceptOffhandAction(s,h,true,{x:12,y:10});step(s,.06);s.units=s.units.filter(u=>u.team==='ally');s.context='explorationIdle';h.pos={...s.goal};al.pos={...s.goal};const equipment=h.equipment,cd=bomb.cd,ledger=h.stamina!.lastAcceptedId,world=s.world!;expect(command(s,{type:'exitExploration'}).ok).toBe(true);step(s,100);expect(bomb.cd).toBe(cd);expect(h.offhand!.entities).toHaveLength(0);expect(command(s,{type:'continueWorld',worldId:world.id,visit:world.visit.generation}).ok).toBe(true);expect(h.equipment).toBe(equipment);expect(h.stamina!.lastAcceptedId).toBe(ledger);expect(bomb.durability).toBe(99);
});
test('EQ last legal shield block closes broken guard; subsequent held gate cannot pay',()=>{
 const {s,h}=fixture(),shield=h.equipment!.equipped.left;shield.durability=1;command(s,{type:'hunterInput',id:h.id,kind:'guard',aim:{x:12,y:10}});step(s,.09);expect(hunterDefense(s,h,{x:12,y:10})).toBe('block');expect(h.hunterCombat!.special).toBeUndefined();const cost=h.stamina!.current;expect(command(s,{type:'hunterInput',id:h.id,kind:'guard'}).reason).toContain('损坏');expect(h.stamina!.current).toBe(cost);
});
test('EQ second physical edge during cooldown rejects, then two bodies own independent CD/durability',()=>{
 const {s,h,al}=fixture();for(const u of [h,al])command(s,{type:'equipOffhand',id:u.id,instanceId:u.equipment!.owned[1].id});acceptOffhandAction(s,h,true,{x:12,y:10});step(s,.6);acceptOffhandAction(s,h,false);const accepted=h.stamina!.lastAcceptedId,wear=h.equipment!.owned[1].durability;expect(acceptOffhandAction(s,h,true,{x:12,y:10}).reason).toContain('冷却');expect(h.stamina!.lastAcceptedId).toBe(accepted);expect(h.equipment!.owned[1].durability).toBe(wear);command(s,{type:'controlBody',id:al.id});expect(acceptOffhandAction(s,al,true,{x:12,y:10}).ok).toBe(true);expect(al.stamina!.current).toBe(80);expect(h.equipment!.owned[1]).not.toBe(al.equipment!.owned[1]);
});
test('EQ bomb multi-kill resolves each reward once and never damages friend; stagger applies exactly 25',()=>{
 const {s,h,al,e}=fixture();const bomb=h.equipment!.owned[1];command(s,{type:'equipOffhand',id:h.id,instanceId:bomb.id});e.hp=40;e.pos={x:12,y:10};e.rewardKey='eq-first';const other=structuredClone(e);other.id='eq-second';other.rewardKey='eq-second';other.pos={x:12,y:10.5};s.units.push(other);const hp=al.hp;acceptOffhandAction(s,h,true,{x:12,y:10});step(s,.6);expect(e.life).toBe('dead');expect(other.life).toBe('dead');expect(s.kills).toBe(2);expect(al.hp).toBe(hp);const rewards=[...s.economy.rewards];step(s,2);expect(s.kills).toBe(2);expect(s.economy.rewards).toEqual(rewards);
 const outcomes=s.combatIdentity!.trace.filter(r=>r.type==='hit-outcome'&&r.context?.offhandInstanceId===bomb.id);expect(outcomes).toHaveLength(2);expect(outcomes.map(r=>r.outcome!.postureApplied)).toEqual([25,25]);
});
test('EQ Hunter bomb blocks left guard but keeps right E with its own payment',async()=>{
 expect(await module()).toBeDefined();const {s,h}=fixture();const bomb=h.equipment!.owned.find(e=>e.action==='bomb')!;command(s,{type:'equipOffhand',id:h.id,instanceId:bomb.id});const balance=h.stamina!.current;
 expect(command(s,{type:'hunterInput',id:h.id,kind:'guard',aim:{x:12,y:10}}).ok).toBe(false);expect(h.stamina!.current).toBe(balance);expect(command(s,{type:'hunterInput',id:h.id,kind:'active'}).ok).toBe(true);expect(h.stamina!.current).toBe(balance-28);expect(bomb.cd).toBe(0);expect(bomb.durability).toBe(100);
});
test('EQ bomb pays once, held cannot repeat, real Release wears once and hurts two enemies through main authority',async()=>{
 expect(await module()).toBeDefined();const {s,h,e}=fixture();e.hp=e.maxHp=150;e.pos={x:12,y:10};s.units.push({...structuredClone(e),id:'second',pos:{x:12,y:10.5}});const bomb=h.equipment!.owned.find(e=>e.action==='bomb')!;command(s,{type:'equipOffhand',id:h.id,instanceId:bomb.id});
 expect(command(s,{type:'offhandInput',id:h.id,held:true,aim:{x:12,y:10}}).ok).toBe(true);expect(h.stamina!.current).toBe(80);expect(bomb.durability).toBe(100);
 command(s,{type:'offhandInput',id:h.id,held:true,aim:{x:12,y:10}});step(s,.06);expect(bomb.durability).toBe(99);expect(h.offhand!.entities).toHaveLength(1);step(s,.5);
 expect(e.hp).toBe(105);expect(s.units.find(u=>u.id==='second')!.hp).toBe(105);expect(h.offhand!.entities).toHaveLength(0);expect(s.combatIdentity!.trace.filter(r=>r.type==='attack-released'&&r.attack?.offhandInstanceId===bomb.id)).toHaveLength(1);
 step(s,6);expect(bomb.durability).toBe(99);expect(e.hp).toBe(105);
});

test('EQ profession follows authoritative right instance, never stale legacy selector or left candidate',async()=>{
 const {professionOf}=await import('../src/core/skill-catalog');const {s,h}=fixture();h.equipment!.equipped.right.weapon={...h.equipment!.equipped.right.weapon,profession:'hunter'};h.weapons.push({...h.weapons[0],profession:'ranger'});h.weaponIndex=h.weapons.length-1;expect(professionOf(h)).toBe('hunter');
});
test('EQ flight clock starts at true Release and cannot explode a frame early',()=>{
 const {s,h,e}=fixture();e.hp=150;e.pos={x:12,y:10};command(s,{type:'equipOffhand',id:h.id,instanceId:h.equipment!.owned[1].id});acceptOffhandAction(s,h,true,{x:12,y:10});step(s,.05);expect(h.offhand!.entities).toHaveLength(1);step(s,.444);expect(e.hp).toBe(150);step(s,.009);expect(e.hp).toBe(105);
});
