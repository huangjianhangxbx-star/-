import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {command,step,resolveHit} from '../src/core/engine';
function setup(){const a=base();a.s.sessionMode='exploration';beginWorld(a.s);a.s.context='explorationIdle';return a;}
async function runtime(){return import('../src/core/right-hand-skills').catch(()=>undefined);}
test.each(['hunter','ranger'])('SK01A %s native E owns Accept and child snapshot; Q cooldown independent',async id=>{
 const m=await runtime();expect(m).toBeDefined();const {s,h,al,e}=setup(),u=id==='hunter'?h:al;command(s,{type:'controlBody',id:u.id});
 command(s,{type:'rightSkillInput',id:u.id,key:'Q',aim:e.pos});step(s,.5);const qcd=m!.rightSkillCooldown(u,'Q'),right=u.equipment!.equipped.right,posture=right.weapon.postureDamage;command(s,{type:'switchMainForm',id:u.id,form:'II'});
 expect(command(s,{type:'rightSkillInput',id:u.id,key:'E',aim:{x:u.pos.x+1,y:u.pos.y}}).ok).toBe(true);const action=u.hunterCombat?.special??u.alCombat!.special!;
 expect(action.weaponSnapshot?.postureDamage).toBe(posture);const start=s.combatIdentity!.trace.find(r=>r.type==='action-started'&&r.context!.actionId===action.context!.actionId)!;expect(start.context!.mainInstanceId).toBe(right.id);expect(start.context!.formId).toBe('II');expect(start.context!.slot).toBe(1);
 right.weapon.postureDamage=999;command(s,{type:'rightSkillInput',id:u.id,key:'E',held:false});for(let i=0;i<16;i++)step(s,.05);
 const child=s.combatIdentity!.trace.find(r=>r.type==='action-started'&&r.context?.parentActionId===action.context!.actionId);expect(child?.context!.mainInstanceId).toBe(right.id);expect(child?.context!.formId).toBe('II');expect(m!.rightSkillCooldown(u,'Q')).toBeLessThan(qcd);expect(u.stamina!.lastAcceptedId).toBe(2);
});
test.each(['hunter','ranger'])('SK01A %s Q real authority single Accept/payment/Release cached right origin',async id=>{
 const m=await runtime();expect(m,'formal right skills exist').toBeDefined();const {s,h,al,e}=setup(),u=id==='hunter'?h:al;command(s,{type:'controlBody',id:u.id});e.hp=e.maxHp=150;e.pos={x:11.3,y:10};const right=u.equipment!.equipped.right,bomb=u.equipment!.owned[1];command(s,{type:'equipOffhand',id:u.id,instanceId:bomb.id});const paid=u.stamina!.lastAcceptedId;
 expect(command(s,{type:'rightSkillInput',id:u.id,key:'Q',aim:e.pos} as any)).toEqual({ok:true});expect(u.stamina!.current).toBe(82);expect(u.stamina!.lastAcceptedId).toBe(paid+1);expect(command(s,{type:'rightSkillInput',id:u.id,key:'Q',aim:e.pos} as any).ok).toBe(false);
 const action=(right as any).skills.action;right.currentForm='II';right.weapon.postureDamage=999;step(s,.2);expect(e.hp).toBe(130);step(s,.2);expect(e.hp).toBe(130);expect(bomb.cd).toBe(0);expect(bomb.durability).toBe(100);
 const outcomes=s.combatIdentity!.trace.filter(r=>r.type==='hit-outcome'&&r.context?.actionId===action.context.actionId);expect(outcomes).toHaveLength(1);expect(outcomes[0].outcome!.postureApplied).toBe(id==='hunter'?25:20);expect(outcomes[0].context!.mainInstanceId).toBe(right.id);expect(outcomes[0].context!.actorId).toBe(u.id);expect(u.stamina!.lastAcceptedId).toBe(paid+1);
});
test('SK01A R distinct cooldown, slots swap with cooldown identity and empty rejects atomically',async()=>{
 const m=await runtime();expect(m).toBeDefined();const {s,h,e}=setup(),right=h.equipment!.equipped.right as any;
 expect(command(s,{type:'configureRightSkill',id:h.id,key:'Q',abilityId:'hunter-sweep'} as any).ok).toBe(true);expect(right.skills.slots.R).toBe('hunter-break');
 expect(command(s,{type:'rightSkillInput',id:h.id,key:'Q',aim:e.pos} as any).ok).toBe(true);expect(h.stamina!.current).toBe(76);const cd=right.skills.instances['hunter-sweep'].cd;expect(cd).toBe(10);step(s,.6);s.context='explorationIdle';
 expect(command(s,{type:'configureRightSkill',id:h.id,key:'R',abilityId:'hunter-sweep'} as any).ok).toBe(true);expect(right.skills.slots.Q).toBe('hunter-break');expect(right.skills.instances['hunter-sweep'].cd).toBeLessThan(cd);const before=structuredClone(h);
 expect(command(s,{type:'rightSkillInput',id:h.id,key:'R',aim:e.pos} as any).reason).toContain('冷却');expect(h).toEqual(before);expect(command(s,{type:'configureRightSkill',id:h.id,key:'R',abilityId:null} as any).ok).toBe(true);expect(command(s,{type:'rightSkillInput',id:h.id,key:'R',aim:e.pos} as any).reason).toContain('空槽');
});
test('SK01A own profession, E fixed, false eligibility pure; no pay on invalid/body lock/low stamina',async()=>{
 const m=await runtime();expect(m).toBeDefined();const {s,h,al}=setup();const before=structuredClone(h);
 for(const key of ['Q','R'])expect(m!.queryRightSkill(s,h,key as any,{x:NaN,y:10}).ok).toBe(false);expect(h).toEqual(before);
 expect(command(s,{type:'configureRightSkill',id:h.id,key:'Q',abilityId:'al-stab'} as any).ok).toBe(false);expect(command(s,{type:'configureRightSkill',id:h.id,key:'E',abilityId:null} as any).ok).toBe(false);expect(command(s,{type:'rightSkillInput',id:al.id,key:'Q',aim:{x:12,y:10}} as any).ok).toBe(false);
 h.stamina!.current=17;expect(command(s,{type:'rightSkillInput',id:h.id,key:'Q',aim:{x:12,y:10}} as any).reason).toContain('体力');expect(h.stamina!.lastAcceptedId).toBe(0);h.stamina!.current=100;command(s,{type:'hunterInput',id:h.id,kind:'guard'});expect(command(s,{type:'rightSkillInput',id:h.id,key:'Q',aim:{x:12,y:10}} as any).ok).toBe(false);
});
test('SK01A accepted Q blocks Basic, RMB, E, C and locomotion until finish',async()=>{
 expect(await runtime()).toBeDefined();const {s,h,e}=setup();command(s,{type:'rightSkillInput',id:h.id,key:'Q',aim:e.pos} as any);const paid=h.stamina!.lastAcceptedId,pos={...h.pos};
 expect(command(s,{type:'hunterInput',id:h.id,kind:'basic',aim:e.pos}).ok).toBe(false);expect(command(s,{type:'hunterInput',id:h.id,kind:'active',aim:e.pos}).ok).toBe(false);expect(command(s,{type:'offhandInput',id:h.id,held:true,aim:e.pos}).ok).toBe(false);expect(command(s,{type:'switchMainForm',id:h.id,form:'II'}).ok).toBe(false);command(s,{type:'direct',id:h.id,direction:{x:1,y:0}} as any);step(s,.1);expect(h.pos).toEqual(pos);expect(h.stamina!.lastAcceptedId).toBe(paid);
});
test('SK01A RMB release remains consumable during a right action, no sticky held input',async()=>{
 const {s,h,e}=setup();command(s,{type:'equipOffhand',id:h.id,instanceId:h.equipment!.owned[1].id});expect(command(s,{type:'offhandInput',id:h.id,held:true,aim:{x:11,y:10}}).ok).toBe(true);step(s,.1);
 expect(command(s,{type:'rightSkillInput',id:h.id,key:'Q',aim:e.pos}).ok).toBe(true);expect(command(s,{type:'offhandInput',id:h.id,held:false}).ok).toBe(true);expect(h.offhand!.held).toBe(false);expect(h.stamina!.lastAcceptedId).toBe(2);
});
test('SK01A trace disabled still hurts, walls prevent real hit, Z cancels pending without refund/cooldown reset',async()=>{
 expect(await runtime()).toBeDefined();const {s,h,al,e}=setup();s.combatIdentity!.enabled=false;e.hp=150;e.pos={x:12,y:10};s.tiles.find(t=>t.x===11&&t.y===10)!.obstacle=true;
 command(s,{type:'rightSkillInput',id:h.id,key:'Q',aim:e.pos} as any);step(s,.2);expect(e.hp).toBe(150);step(s,.4);s.tiles.forEach(t=>t.obstacle=false);command(s,{type:'rightSkillInput',id:h.id,key:'R',aim:e.pos} as any);step(s,.2);expect(e.hp).toBe(132);
 const {s:t,h:a,al:b,e:z}=setup();command(t,{type:'rightSkillInput',id:a.id,key:'Q',aim:z.pos} as any);command(t,{type:'controlBody',id:b.id});step(t,.2);expect(z.hp).toBe(40);expect(a.stamina!.lastAcceptedId).toBe(1);expect((a.equipment!.equipped.right as any).skills.instances['hunter-break'].cd).toBeCloseTo(5.8);
});
test('SK01A same-world configure/CD survive death revive and unload; new world defaults',async()=>{
 expect(await runtime()).toBeDefined();const {s,h,al,e}=setup();command(s,{type:'configureRightSkill',id:h.id,key:'R',abilityId:null} as any);command(s,{type:'rightSkillInput',id:h.id,key:'Q',aim:e.pos} as any);const right=h.equipment!.equipped.right as any;resolveHit(s,h,{...e.weapons[0],subtype:'impact'},99999,e);step(s,10.01);expect(right.skills.slots.R).toBeNull();expect(right.skills.instances['hunter-break'].cd).toBeGreaterThan(0);expect(right.skills.action).toBeUndefined();
 s.units=s.units.filter(u=>u.team==='ally');s.context='explorationIdle';h.pos={...s.goal};al.pos={...s.goal};const cd=right.skills.instances['hunter-break'].cd,w=s.world!;expect(command(s,{type:'exitExploration'}).ok).toBe(true);step(s,50);expect(right.skills.instances['hunter-break'].cd).toBe(cd);expect(command(s,{type:'continueWorld',worldId:w.id,visit:w.visit.generation}).ok).toBe(true);expect(h.equipment!.equipped.right).toBe(right);expect(right.skills.slots.R).toBeNull();expect((setup().h.equipment!.equipped.right as any).skills.slots.R).toBe('hunter-sweep');
});
