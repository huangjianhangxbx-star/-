import {test,expect} from 'vitest';
import {createExplorationEntry,command,step,resolveHit} from '../src/core/engine';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {credit,rewardKill} from '../src/core/economy';
import {tickStamina} from '../src/core/stamina';
import {configureCombatTrace} from '../src/core/combat-identity';
const setup=()=>{const f=base();f.s.sessionMode='exploration';beginWorld(f.s);f.s.context='explorationIdle';return f;};
const upgrade=(s:any,level:number,worldId=s.world.id)=>command(s,{type:'upgradePartyWeaponActivation',worldId,expectedLevel:level} as any);
const module=()=>import('../src/core/weapon-activation').catch(()=>undefined);
test('SK02 real reward funds exactly one common level, stale and max requests are pure',async()=>{
 const {s,e}=setup(),m=await module();expect(m,'activation module').toBeDefined();expect(s.world!.activation.activeLevel).toBe(0);
 const before=structuredClone(s);expect(m!.queryWeaponActivationUpgrade(s,s.world!.id,0).ok).toBe(false);expect(upgrade(s,0).ok).toBe(false);expect(s).toEqual(before);
 expect(rewardKill(s,e)).toBe(true);expect(s.fragments).toBe(4);expect(upgrade(s,0).ok).toBe(true);expect(s.fragments).toBe(0);expect(s.world!.activation.activeLevel).toBe(1);
 const one=structuredClone(s);expect(upgrade(s,0).ok).toBe(false);expect(upgrade(s,1,'world-old').ok).toBe(false);expect(rewardKill(s,e)).toBe(false);expect(s).toEqual(one);
 credit(s,20,'fixture');expect(upgrade(s,1).ok).toBe(true);expect(s.fragments).toBe(12);expect(upgrade(s,2).ok).toBe(true);expect(s.fragments).toBe(0);expect(s.world!.activation.activeLevel).toBe(3);
 const max=structuredClone(s);expect(upgrade(s,3).ok).toBe(false);expect(s).toEqual(max);expect(s.economy.audit.filter(a=>a.action==='weapon-activation').map(a=>a.amount)).toEqual([4,8,12]);
});
test('SK02 wrong route/owner/weapon/preparation and inactive visit refuse atomically',async()=>{
 const m=await module();expect(m).toBeDefined();for(const alter of [(s:any)=>s.xxExperiment=true,(s:any)=>s.sessionMode='legacy',(s:any)=>s.phase='world',(s:any)=>s.world.visit.active=false,(s:any)=>s.rightPreparation.hunter.mainDefinitionId='al-golden-main',(s:any)=>s.units[1].cloneOf='hunter',(s:any)=>s.units[1].equipment.equipped.right.ownerId='hunter',(s:any)=>s.units[0].equipment.equipped.right.id='stale',(s:any)=>s.rightPreparation=undefined,(s:any)=>{s.units.push({...s.units[0],id:'clone',cloneOf:'hunter'});s.controlledBodyId='clone'},(s:any)=>s.units[0].equipment.equipped.right.weapon={...s.units[0].equipment.equipped.right.weapon,shadow:true}]){
  const {s}=setup();credit(s,40,'fixture');alter(s);const before=structuredClone(s);expect(m!.queryWeaponActivationUpgrade(s,s.world!.id,0).ok).toBe(false);expect(upgrade(s,0).ok).toBe(false);expect(s).toEqual(before);
 }
 expect(upgrade({...createExplorationEntry(),world:{id:'none'}},0).ok).toBe(false);
});
test.each([0,1,2,3])('SK02 level %s has staged effects with single Q Accept/HP and trace off',async level=>{
 const m=await module();expect(m).toBeDefined();const {s,h,al,e}=setup();credit(s,24,'fixture');for(let n=0;n<level;n++)expect(upgrade(s,n).ok).toBe(true);
 for(const u of [h,al]){const mods=m!.effectivePassiveModifiers(s,u);expect(mods).toEqual({recovery:level>=1?1.1:1,posture:level>=2?1.1:1,damage:level>=3?1.1:1});u.stamina!.current=50;u.stamina!.recoverAt=0;}s.time=1;tickStamina(s,h,1);expect(h.stamina!.current).toBe(level?72:70);
 h.stamina!.current=100;e.hp=e.maxHp=150;configureCombatTrace(s,false);expect(command(s,{type:'rightSkillInput',id:h.id,key:'Q',aim:e.pos}).ok).toBe(true);const a=h.equipment!.equipped.right.skills!.action!;expect(a.spec.damage).toBe(level>=3?22:20);expect(a.spec.posture).toBeCloseTo(level>=2?27.5:25);expect(h.stamina!.current).toBe(82);step(s,.2);expect(e.hp).toBe(level>=3?128:130);step(s,.2);expect(e.hp).toBe(level>=3?128:130);expect(h.stamina!.lastAcceptedId).toBe(1);
});
test('SK02 growth does not mutate old Accept or native E/basic/offhand definitions; invalid bodies have no bonus',async()=>{
 const m=await module();expect(m).toBeDefined();const {s,h,al,e}=setup();credit(s,24,'fixture');upgrade(s,0);upgrade(s,1);expect(command(s,{type:'rightSkillInput',id:h.id,key:'Q',aim:e.pos}).ok).toBe(true);const old=h.equipment!.equipped.right.skills!.action!;
 expect(upgrade(s,2).ok).toBe(true);expect(old.spec.damage).toBe(20);expect(old.weapon.damage).toBe(20);expect(old.spec.posture).toBeCloseTo(27.5);expect(Object.isFrozen(old.spec)).toBe(true);
 const defs=await import('../src/core/right-hand-skills');expect(defs.RIGHT_ABILITIES['hunter-native-E'].damage).toBe(75);expect(defs.RIGHT_ABILITIES['al-native-E'].damage).toBe(85);expect(h.equipment!.equipped.right.weapon.damage).toBe(h.weapons[0].damage);expect(h.equipment!.equipped.left.cd).toBe(0);
 const neutral={recovery:1,posture:1,damage:1};for(const u of [{...h,cloneOf:'hunter'},{...h,shadowResident:true},{...h,team:'enemy'},{...h,id:'foreign'},e])expect(m!.effectivePassiveModifiers(s,u as any)).toEqual(neutral);
 const correct=al.equipment!.equipped.right.ownerId;al.equipment!.equipped.right.ownerId='hunter';expect(m!.effectivePassiveModifiers(s,al)).toEqual(neutral);al.equipment!.equipped.right.ownerId=correct;s.xxExperiment=true;expect(m!.effectivePassiveModifiers(s,h)).toEqual(neutral);
});
test('SK02 one dead member reads common upgrade after legal revival; leave/continue/wipe retain level and payment',async()=>{
 const m=await module();expect(m).toBeDefined();const {s,h,al,e}=setup();credit(s,24,'fixture');resolveHit(s,al,{...e.weapons[0],subtype:'impact'},99999,e);expect(al.life).toBe('respawning');expect(upgrade(s,0).ok).toBe(true);expect(m!.effectivePassiveModifiers(s,al).recovery).toBe(1.1);
 s.units=s.units.filter(u=>u.team==='ally');for(let i=0;s.time<10.03&&i<2000;i++)step(s,.01);expect(al.life).toBe('active');const w=s.world!,paid=s.economy.audit.filter(a=>a.action==='weapon-activation').length;h.pos={...s.goal};al.pos={...s.goal};s.context='explorationIdle';expect(command(s,{type:'exitExploration'}).ok).toBe(true);expect(upgrade(s,1).ok).toBe(false);expect(command(s,{type:'continueWorld',worldId:w.id,visit:w.visit.generation}).ok).toBe(true);expect(s.world).toBe(w);expect(w.activation.activeLevel).toBe(1);
 resolveHit(s,h,{...e.weapons[0],subtype:'impact'},99999,e);resolveHit(s,al,{...e.weapons[0],subtype:'impact'},99999,e);for(let i=0;i<200;i++)step(s,.01);expect(h.life).toBe('active');expect(al.life).toBe('active');expect(w.activation.activeLevel).toBe(1);expect(s.economy.audit.filter(a=>a.action==='weapon-activation')).toHaveLength(paid);
});
test('SK02 new world resets level while selected QR/passives and account remain; safe opening rejects active actions',async()=>{
 const m=await module();expect(m).toBeDefined();const s=createExplorationEntry();command(s,{type:'configurePreparedSkill',id:'hunter',key:'Q',abilityId:'hunter-sweep',mainDefinitionId:'hunter-golden-main'});command(s,{type:'carry',gold:0,vitality:0});credit(s,4,'fixture');upgrade(s,0);const prep=structuredClone(s.rightPreparation);expect(prep!.hunter.preparedPassives).toEqual(['sample-recovery','sample-posture','sample-damage']);const h=s.units.find(u=>u.id==='hunter')!;h.ready=0;
 expect(m!.queryWeaponActivationOpen(s).ok).toBe(true);command(s,{type:'rightSkillInput',id:'hunter',key:'Q',aim:{x:h.pos.x+1,y:h.pos.y}});const action=h.equipment!.equipped.right.skills!.action;expect(m!.queryWeaponActivationOpen(s).ok).toBe(false);expect(h.equipment!.equipped.right.skills!.action).toBe(action);
 command(s,{type:'restartWorld',worldId:s.world!.id});expect(s.rightPreparation).toEqual(prep);command(s,{type:'carry',gold:0,vitality:0});expect(s.world!.activation.activeLevel).toBe(0);expect(s.units[0].equipment!.equipped.right.skills!.slots.Q).toBe('hunter-sweep');expect(s.units[0].equipment!.equipped.right.preparedPassives).not.toBe(s.rightPreparation!.hunter.preparedPassives);
});

test('SK02 actual Al R damage/posture and campfire share the world level without extra payment',async()=>{
 const {s,h,al,e}=setup();credit(s,24,'fixture');for(let n=0;n<3;n++)upgrade(s,n);s.controlledBodyId=al.id;h.pos={x:8,y:8};e.hp=e.maxHp=150;configureCombatTrace(s,false);expect(command(s,{type:'rightSkillInput',id:al.id,key:'R',aim:e.pos}).ok).toBe(true);const a=al.equipment!.equipped.right.skills!.action!;expect(a.weapon.damage).toBeCloseTo(19.8);expect(a.weapon.postureDamage).toBeCloseTo(33);const posture=e.posture;step(s,.2);expect(e.hp).toBeCloseTo(130.2);expect(e.posture).toBeLessThan(posture);step(s,.2);expect(e.hp).toBeCloseTo(130.2);expect(al.stamina!.lastAcceptedId).toBe(1);
 const {useCampfire}=await import('../src/core/campfire'),p=s.exploration!.definition.points.find(p=>p.kind==='campfire')!;s.units=s.units.filter(u=>u.team==='ally');s.context='explorationIdle';h.pos={...p.pos};al.pos={x:p.pos.x+.3,y:p.pos.y};const paid=s.economy.audit.length;expect(useCampfire(s,p.id).ok).toBe(true);expect(s.world!.activation.activeLevel).toBe(3);expect(s.economy.audit.length).toBe(paid);
});
