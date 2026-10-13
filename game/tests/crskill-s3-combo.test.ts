import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {step,command} from '../src/core/engine';
import {hunterState} from '../src/core/hunter-state';
import {quoteTrial,acquireTrialRune,upgradeTrialPassive,removeTrialRune} from '../src/core/trial-progression';
import {trialState,removeTrialSource} from '../src/core/ability-trial';
import {resolveBasicDefinition} from '../src/core/basic-definition';
function setup(){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;a.s.trialProgression=true;beginWorld(a.s);a.s.context='explorationIdle';hunterState(a.h);a.e.ready=100;a.e.hp=a.e.maxHp=1000;return a;}
test('S3 rapid combo base/+ changes real topology and original presentation/timing, keeps chisel and terminal a4',()=>{
 const {s,h,e}=setup();expect(resolveBasicDefinition(h).stages).toHaveLength(4);
 expect(acquireTrialRune(s,quoteTrial(s,h),'rapid-combo').ok).toBe(true);const id=trialState(h)!.sources.find(x=>x.definitionId==='rapid-combo')!.id;
 const def=resolveBasicDefinition(h);expect(def.stages).toHaveLength(5);expect(def.stages[0].presentationId).toBe('a快速+1');expect(def.stages[3].id).toBe('CR-chisel');expect(def.stages[4].presentationId).toBe('a4');
 expect(upgradeTrialPassive(s,quoteTrial(s,h),id).ok).toBe(true);const plus=resolveBasicDefinition(h);expect(plus.stages).toHaveLength(6);expect(plus.stages[3].presentationId).toBe('a快速++2');
 command(s,{type:'hunterInput',id:h.id,kind:'basic',aim:e.pos});for(let i=0;i<3;i++)step(s,.02);expect(e.hp).toBe(982);
});
test('S3 removal restores underlying topology without rewriting accepted stage or other source',()=>{
 const {s,h}=setup();acquireTrialRune(s,quoteTrial(s,h),'rapid-combo');const id=trialState(h)!.sources.find(x=>x.definitionId==='rapid-combo')!.id;
 command(s,{type:'hunterInput',id:h.id,kind:'basic',aim:{x:12,y:10}});const accepted=h.basicAction!;removeTrialSource(h,id);
 expect(accepted.definition.stages).toHaveLength(5);expect(accepted.presentationId).toBe('a快速+1');expect(resolveBasicDefinition(h).stages).toHaveLength(4);expect(resolveBasicDefinition(h).stages[2].id).toBe('CR-chisel');
});
test('S3 frost-haste base/+ changes real cooldown and uninstall restores one, default golden remains unchanged',()=>{
 const {s,h}=setup();acquireTrialRune(s,quoteTrial(s,h),'frost-haste');const id=trialState(h)!.sources.find(x=>x.definitionId==='frost-haste')!.id;expect(upgradeTrialPassive(s,quoteTrial(s,h),id).ok).toBe(true);
 h.hunterCombat!.frost=3;h.hunterCombat!.activeCharge=0;h.hunterCombat!.activeCooldown=8;step(s,.02);expect(h.hunterCombat!.activeCooldown).toBeCloseTo(8-.02*1.36,6);
 expect(removeTrialRune(s,quoteTrial(s,h),id).ok).toBe(true);const before=h.hunterCombat!.activeCooldown;step(s,.02);expect(before-h.hunterCombat!.activeCooldown).toBeCloseTo(.02);
});
