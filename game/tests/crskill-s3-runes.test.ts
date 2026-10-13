import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {step,command} from '../src/core/engine';
import {alState} from '../src/core/al-state';
import {trialState} from '../src/core/ability-trial';
import {quoteTrial,acquireTrialRune,upgradeTrialPassive,removeTrialRune,upgradeTrialSkill} from '../src/core/trial-progression';
function setup(){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;a.s.trialProgression=true;beginWorld(a.s);a.s.context='explorationIdle';alState(a.al);command(a.s,{type:'controlBody',id:'ranger'});a.s.combatIdentity!.enabled=false;a.e.ready=100;a.e.hp=a.e.maxHp=1000;return a;}
test.each([false,true])('S3 last-round rune base/upgraded actually modifies final shot; upgrade consumes once (%s)',upgraded=>{
 const {s,al,e}=setup();upgradeTrialSkill(s,quoteTrial(s,al),'E','火箭弹射2');expect(acquireTrialRune(s,quoteTrial(s,al),'last-round').ok).toBe(true);
 const t=trialState(al)!,id=t.sources.find(x=>x.definitionId==='last-round')!.id;
 if(upgraded){expect(upgradeTrialPassive(s,quoteTrial(s,al),id).ok).toBe(true);expect(upgradeTrialPassive(s,quoteTrial(s,al),id).ok).toBe(false);}
 t.magazine=['normal'];command(s,{type:'offhandInput',id:al.id,held:true,aim:e.pos});for(let i=0;i<8;i++)step(s,.02);command(s,{type:'offhandInput',id:al.id,held:false});
 expect(e.hp).toBeCloseTo(1000-32*(upgraded?2.85:2.25));expect(t.magazine).toHaveLength(0);
});
test('S3 removing one rune retracts only that source, leaves branch and another body intact',()=>{
 const {s,al,h}=setup();upgradeTrialSkill(s,quoteTrial(s,al),'E','火箭弹射2');acquireTrialRune(s,quoteTrial(s,al),'last-round');const t=trialState(al)!;
 const id=t.sources.find(x=>x.definitionId==='last-round')!.id,before=structuredClone(trialState(h));expect(removeTrialRune(s,quoteTrial(s,al),id).ok).toBe(true);
 expect(t.sources.some(x=>x.definitionId==='rocket-power')).toBe(true);expect(trialState(h)).toEqual(before);
 const snapshot=structuredClone(s);expect(removeTrialRune(s,quoteTrial(s,al),id).ok).toBe(false);expect(s).toEqual(snapshot);
});
test('S3 unresolved rune cannot consume an upgrade stone or become a different native rune',()=>{
 const {s,h}=setup();command(s,{type:'controlBody',id:h.id});
 expect(acquireTrialRune(s,quoteTrial(s,h),'frost-aftershock').ok).toBe(true);
 const id=trialState(h)!.sources.find(x=>x.definitionId==='frost-aftershock')!.id;
 const before=structuredClone(s);
 expect(upgradeTrialPassive(s,quoteTrial(s,h),id).ok).toBe(false);
 expect(s).toEqual(before);
});
