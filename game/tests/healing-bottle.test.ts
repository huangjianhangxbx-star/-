import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {command,createExplorationEntry,resolveHit,step} from '../src/core/engine';
const setup=()=>{const f=base();f.s.sessionMode='exploration';beginWorld(f.s);f.s.context='explorationIdle';return f;};
const use=(s:any)=>command(s,{type:'useHealingBottle'} as any);
const module=()=>import('../src/core/healing-bottle').catch(()=>undefined);
test('Y01 pure query, equal absolute healing with caps and exactly one shared consumption',async()=>{
 const {s,h,al}=setup(),m=await module();expect(m,'bottle module').toBeDefined();h.hp=10;al.hp=al.maxHp-20;const before=structuredClone(s);
 expect(m!.queryHealingBottle(s)).toMatchObject({ok:true,count:1});expect(s).toEqual(before);expect(use(s).ok).toBe(true);expect(h.hp).toBe(Math.min(h.maxHp,110));expect(al.hp).toBe(al.maxHp);expect(s.world!.healingBottle).toEqual({count:0,uses:1,refills:0});expect(s.inventory.heal).toBe(before.inventory.heal);
 const empty=structuredClone(s);expect(use(s).ok).toBe(false);expect(s).toEqual(empty);
});
test('Y01 full party refuses purely; Al may use for injured hunter while full himself',()=>{
 const {s,h,al}=setup(),before=structuredClone(s);expect(use(s).ok).toBe(false);expect(s).toEqual(before);h.hp=1;s.controlledBodyId=al.id;expect(use(s).ok).toBe(true);expect(h.hp).toBe(Math.min(101,h.maxHp));expect(al.hp).toBe(al.maxHp);
});
test('Y01 eligibility excludes corpse/respawn, clones, enemies and foreign units',()=>{
 const {s,h,al,e}=setup();h.hp=1;al.life='respawning';al.hp=0;e.hp=1;const clone=structuredClone(h);clone.id='hunter-copy';clone.cloneOf=h.id;s.units.push(clone);const foreign=structuredClone(h);foreign.id='extra';s.units.push(foreign);
 expect(use(s).ok).toBe(true);expect(al.hp).toBe(0);expect(al.life).toBe('respawning');expect(e.hp).toBe(1);expect(clone.hp).toBe(1);expect(foreign.hp).toBe(1);
});
test('Y01 illegal world/control/aim routes reject without any mutation',()=>{
 for(const alter of [(s:any)=>s.sessionMode='legacy',(s:any)=>s.world=undefined,(s:any)=>s.world.visit.active=false,(s:any)=>s.phase='world',(s:any)=>s.xxExperiment=true,(s:any)=>s.controlledBodyId='missing',(s:any)=>s.units[0].cloneOf='other',(s:any)=>s.units[0].shadowResident=true,(s:any)=>s.explorationControl={commandFocusId:'ranger'},(s:any)=>s.explorationControl={commandFocusId:null,aim:{actorId:'hunter'}},(s:any)=>s.units.forEach((u:any)=>u.life='respawning'),(s:any)=>s.units.push(structuredClone(s.units[0]))]){
  const {s,h}=setup();h.hp=1;alter(s);const before=structuredClone(s);expect(use(s).ok).toBe(false);expect(s).toEqual(before);
 }
});
test('Y01 accepted combat action, fees and cooldowns are untouched; grey health clamps through authority',()=>{
 const {s,h,e}=setup();h.hp=1;expect(command(s,{type:'rightSkillInput',id:h.id,key:'Q',aim:e.pos}).ok).toBe(true);const a=h.equipment!.equipped.right.skills!.action,stamina=structuredClone(h.stamina),right=structuredClone(h.equipment!.equipped.right),activation=structuredClone(s.world!.activation);h.grayHp=20;
 expect(use(s).ok).toBe(true);expect(h.equipment!.equipped.right.skills!.action).toBe(a);expect(h.equipment!.equipped.right).toEqual(right);expect(h.stamina).toEqual(stamina);expect(s.world!.activation).toEqual(activation);expect(h.hp+h.grayHp).toBeLessThanOrEqual(h.maxHp);
});
test('Y01 legal visible campfire refills to one, repeat/pursuit/remote request does not refill',()=>{
 const {s,h,al,e}=setup(),p=s.exploration!.definition.points.find(p=>p.kind==='campfire')!;h.hp=1;use(s);h.pos={...p.pos};al.pos={x:p.pos.x+.3,y:p.pos.y};h.ready=0;e.pursuitTargetId=h.id;
 const snapshot=structuredClone(s.world!.healingBottle);expect(command(s,{type:'interactExploration',id:p.id}).ok).toBe(false);expect(s.world!.healingBottle).toEqual(snapshot);
 s.units=s.units.filter(u=>u.team==='ally');
 expect(command(s,{type:'interactExploration',id:p.id}).ok).toBe(true);expect(s.world!.healingBottle).toEqual({count:1,uses:1,refills:1});h.hp=1;use(s);expect(command(s,{type:'interactExploration',id:p.id}).ok).toBe(false);expect(s.world!.healingBottle.count).toBe(0);
});
test('Y01 same-world leave/continue and death/wipe do not grant bottles; explicit new world starts one',()=>{
 const {s,h,al,e}=setup();h.hp=1;use(s);const w=s.world!,balance=structuredClone(w.healingBottle);s.units=s.units.filter(u=>u.team==='ally');h.pos={...s.goal};al.pos={...s.goal};s.context='explorationIdle';expect(command(s,{type:'exitExploration'}).ok).toBe(true);expect(command(s,{type:'continueWorld',worldId:w.id,visit:w.visit.generation}).ok).toBe(true);expect(w.healingBottle).toEqual(balance);
 resolveHit(s,h,{...e.weapons[0],subtype:'impact'},99999,e);resolveHit(s,al,{...e.weapons[0],subtype:'impact'},99999,e);expect(use(s).ok).toBe(false);for(let i=0;i<200;i++)step(s,.01);expect(h.life).toBe('active');expect(w.healingBottle).toEqual(balance);
 expect(command(s,{type:'restartWorld',worldId:w.id}).ok).toBe(true);expect(command(s,{type:'carry',gold:0,vitality:0}).ok).toBe(true);expect(s.world!.healingBottle).toEqual({count:1,uses:0,refills:0});expect(s.world!.id).not.toBe(w.id);
 expect(use(createExplorationEntry()).ok).toBe(false);
});

test('Y01 healing uses absolute amounts for different maximum HP; untouched full bottle never stacks at rest',()=>{
 const {s,h,al}=setup();h.maxHp=600;al.maxHp=300;h.hp=50;al.hp=20;expect(use(s).ok).toBe(true);expect(h.hp).toBe(150);expect(al.hp).toBe(120);
 const f=setup(),p=f.s.exploration!.definition.points.find(p=>p.kind==='campfire')!;f.s.units=f.s.units.filter(u=>u.team==='ally');f.h.pos={...p.pos};f.al.pos={x:p.pos.x+.3,y:p.pos.y};expect(command(f.s,{type:'interactExploration',id:p.id}).ok).toBe(true);expect(f.s.world!.healingBottle).toEqual({count:1,uses:0,refills:1});
 const g=setup(),q=g.s.exploration!.definition.points.find(p=>p.kind==='campfire')!;g.h.hp=1;use(g.s);g.s.units=g.s.units.filter(u=>u.team==='ally');g.h.pos={x:0,y:0};expect(command(g.s,{type:'interactExploration',id:q.id}).ok).toBe(false);expect(g.s.world!.healingBottle.count).toBe(0);
});

test('Y01 single surviving Al heals without early hunter revival or changing respawn schedule',()=>{
 const {s,h,al}=setup();h.life='respawning';h.hp=0;h.respawnAt=12;al.hp=1;s.controlledBodyId=al.id;expect(use(s).ok).toBe(true);expect(al.hp).toBe(Math.min(101,al.maxHp));expect(h.hp).toBe(0);expect(h.life).toBe('respawning');expect(h.respawnAt).toBe(12);expect(s.world!.healingBottle.uses).toBe(1);
});

test('Y01 XX campfire keeps its old rest semantics without granting or claiming a formal bottle refill',()=>{
 const {s,h,al}=setup();h.hp=1;use(s);s.xxExperiment=true;s.units=s.units.filter(u=>u.team==='ally');const p=s.exploration!.definition.points.find(p=>p.kind==='campfire')!;h.pos={...p.pos};al.pos={x:p.pos.x+.3,y:p.pos.y};expect(command(s,{type:'interactExploration',id:p.id}).ok).toBe(true);expect(s.world!.healingBottle).toEqual({count:0,uses:1,refills:0});expect(s.notice).not.toContain('Y回血瓶补至');
});
