import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {step} from '../src/core/engine';
import {hunterState} from '../src/core/hunter-state';
import {trialState} from '../src/core/ability-trial';
import {quoteTrial,acquireTrialRune,upgradeTrialPassive,removeTrialRune} from '../src/core/trial-progression';
function setup(){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;a.s.trialProgression=true;beginWorld(a.s);a.s.context='explorationIdle';hunterState(a.h);a.e.ready=100;return a;}
test('S3 bastion increases actual frost by positive cap delta, upgrades once, removes with clamp',()=>{
 const {s,h,al}=setup();const other=structuredClone(trialState(al));h.hunterCombat!.frost=3;
 expect(acquireTrialRune(s,quoteTrial(s,h),'bastion').ok).toBe(true);expect(h.hunterCombat!.frost).toBe(5);
 const id=trialState(h)!.sources.find(x=>x.definitionId==='bastion')!.id;
 expect(upgradeTrialPassive(s,quoteTrial(s,h),id).ok).toBe(true);expect(h.hunterCombat!.frost).toBe(6);
 expect(upgradeTrialPassive(s,quoteTrial(s,h),id).ok).toBe(false);
 expect(removeTrialRune(s,quoteTrial(s,h),id).ok).toBe(true);expect(h.hunterCombat!.frost).toBe(3);expect(trialState(al)).toEqual(other);
});
test.each([false,true])('S3 bastion recovery consumes native base/+ ratio and retains approved recovery delay (%s)',plus=>{
 const {s,h}=setup();expect(acquireTrialRune(s,quoteTrial(s,h),'bastion').ok).toBe(true);const id=trialState(h)!.sources.find(x=>x.definitionId==='bastion')!.id;
 if(plus)expect(upgradeTrialPassive(s,quoteTrial(s,h),id).ok).toBe(true);
 const hc=h.hunterCombat!;hc.frost=0;hc.frostPaidAt=s.time;step(s,.02);expect(hc.frost).toBe(0);
 hc.frostPaidAt=s.time-3;step(s,.02);expect(hc.frost).toBeCloseTo(.8*(plus?1.66:1.33)*.02,6);
 expect(removeTrialRune(s,quoteTrial(s,h),id).ok).toBe(true);const before=hc.frost;step(s,.02);expect(hc.frost-before).toBeCloseTo(.8*.02,6);
});
