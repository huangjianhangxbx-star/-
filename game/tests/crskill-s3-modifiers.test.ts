import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {step} from '../src/core/engine';
import {hunterState} from '../src/core/hunter-state';
import {trialState,removeTrialSource} from '../src/core/ability-trial';
import {quoteTrial,upgradeTrialSkill} from '../src/core/trial-progression';
import {rightSkillInput} from '../src/core/right-hand-skills';
function setup(branch:string){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;a.s.trialProgression=true;beginWorld(a.s);a.s.context='explorationIdle';hunterState(a.h);a.s.combatIdentity!.enabled=false;a.e.ready=100;a.e.hp=a.e.maxHp=1000;
 expect(upgradeTrialSkill(a.s,quoteTrial(a.s,a.h),'E',branch).ok).toBe(true);return a;}
function rush(a:ReturnType<typeof setup>){rightSkillInput(a.s,a.h,'E',{x:16,y:10});rightSkillInput(a.s,a.h,'E',undefined,false);for(let i=0;i<17;i++)step(a.s,.02);a.e.pos={x:a.h.pos.x+1.2,y:a.h.pos.y};const contact={...a.e.pos};step(a.s,.02);return {contact,hazard:a.h.hunterCombat!.hazards.find(h=>h.kind==='charge')!};}
test('S3 rush L1 B changes real damage and horizontal displacement; A retains first-hit frost',()=>{
 const b=setup('破阵猛冲2');b.h.hunterCombat!.frost=0;b.h.hunterCombat!.frostPaidAt=b.s.time;const {hazard:hz,contact}=rush(b);
 expect(hz.damage).toBe(105);expect(b.e.hp).toBe(895);expect(b.e.forcedMotion!.remaining+Math.hypot(b.e.pos.x-contact.x,b.e.pos.y-contact.y)).toBeCloseTo(2.3*1.8);expect(b.h.hunterCombat!.frost).toBe(0);
 const a=setup('破阵猛冲1');a.h.hunterCombat!.frost=0;a.h.hunterCombat!.frostPaidAt=a.s.time;const hit=rush(a);expect(a.e.hp).toBe(925);expect(a.e.forcedMotion!.remaining+Math.hypot(a.e.pos.x-hit.contact.x,a.e.pos.y-hit.contact.y)).toBeCloseTo(2.3);expect(a.h.hunterCombat!.frost).toBe(2);
});
test('S3 accepted modifier survives source removal; next action restores base without mutating definition',()=>{
 const a=setup('破阵猛冲2');rightSkillInput(a.s,a.h,'E',{x:16,y:10});const source=trialState(a.h)!.sources.find(x=>x.definitionId==='rush-force')!;removeTrialSource(a.h,source.id);
 rightSkillInput(a.s,a.h,'E',undefined,false);for(let i=0;i<17;i++)step(a.s,.02);a.e.pos={x:a.h.pos.x+1.2,y:a.h.pos.y};step(a.s,.02);expect(a.e.hp).toBe(895);
});
test('S3 single attack cannot apply damage or displacement twice',()=>{
 const a=setup('破阵猛冲2');rush(a);const hp=a.e.hp,position={...a.e.pos};for(let i=0;i<5;i++)step(a.s,.02);expect(a.e.hp).toBe(hp);expect(a.e.pos.x).toBeGreaterThan(position.x);
});
test('S3 L2 A freezes frost-based damage at acceptance, independently of later source/resource changes',()=>{
 const a=setup('破阵猛冲1');expect(upgradeTrialSkill(a.s,quoteTrial(a.s,a.h),'E','破阵猛冲3').ok).toBe(true);
 a.h.hunterCombat!.frost=3;rightSkillInput(a.s,a.h,'E',{x:16,y:10});a.h.hunterCombat!.frost=0;a.h.hunterCombat!.frostPaidAt=a.s.time;
 rightSkillInput(a.s,a.h,'E',undefined,false);for(let i=0;i<17;i++)step(a.s,.02);a.e.pos={x:a.h.pos.x+1.2,y:a.h.pos.y};step(a.s,.02);
 expect(a.e.hp).toBe(880);expect(a.h.hunterCombat!.frost).toBe(2);
});
test('S3 L2 B changes the actual root cooldown to six seconds without changing other cooldowns',()=>{
 const a=setup('破阵猛冲2');expect(upgradeTrialSkill(a.s,quoteTrial(a.s,a.h),'E','破阵猛冲4').ok).toBe(true);rush(a);
 expect(a.h.hunterCombat!.activeCooldown).toBeLessThanOrEqual(6);expect(a.h.hunterCombat!.activeCooldown).toBeGreaterThan(5.8);
});
test('S3 L3 B really preserves forward motion on contact while ordinary experimental rush stops',()=>{
 const normal=setup('破阵猛冲1');rush(normal);expect(normal.h.hunterCombat!.motion).toBeUndefined();
 const through=setup('破阵猛冲1');upgradeTrialSkill(through.s,quoteTrial(through.s,through.h),'E','破阵猛冲4');
 expect(upgradeTrialSkill(through.s,quoteTrial(through.s,through.h),'E','破阵猛冲6').ok).toBe(true);rush(through);expect(through.h.hunterCombat!.motion?.distance).toBe(6);
});
