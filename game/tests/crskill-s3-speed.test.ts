import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {step,command} from '../src/core/engine';
import {alState} from '../src/core/al-state';
import {trialState,removeTrialSource,clearTrialVisit} from '../src/core/ability-trial';
import {quoteTrial,upgradeTrialSkill} from '../src/core/trial-progression';
function setup(){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;a.s.trialProgression=true;beginWorld(a.s);a.s.context='explorationIdle';alState(a.al);command(a.s,{type:'controlBody',id:'ranger'});a.s.combatIdentity!.enabled=false;a.e.ready=100;for(const branch of ['火箭弹射2','火箭弹射3','火箭弹射6'])expect(upgradeTrialSkill(a.s,quoteTrial(a.s,a.al),'E',branch).ok).toBe(true);return a;}
test('S3 rocket speed starts on landing cast even without an enemy; actual shot and pose clock double then expire',()=>{
 const {s,al}=setup();command(s,{type:'rightSkillInput',id:al.id,key:'E',aim:{x:12,y:10}});for(let i=0;i<50;i++)step(s,.02);
 command(s,{type:'offhandInput',id:al.id,held:true,aim:{x:16,y:10}});step(s,.02);command(s,{type:'offhandInput',id:al.id,held:false});
 expect(trialState(al)!.magazine).toHaveLength(3);expect(al.alCombat!.special!.elapsed).toBeCloseTo(.04,6);
 for(let i=0;i<300;i++)step(s,.02);command(s,{type:'offhandInput',id:al.id,held:true,aim:{x:16,y:10}});step(s,.02);command(s,{type:'offhandInput',id:al.id,held:false});expect(al.alCombat!.special!.elapsed).toBeCloseTo(.02,6);expect(al.alCombat!.special!.paid).toBeFalsy();
});
test('S3 cancel before landing grants no speed; source removal retracts future shots while accepted shot retains rate',()=>{
 const {s,al}=setup();command(s,{type:'rightSkillInput',id:al.id,key:'E',aim:{x:12,y:10}});step(s,.02);command(s,{type:'controlBody',id:'hunter'});for(let i=0;i<50;i++)step(s,.02);command(s,{type:'controlBody',id:'ranger'});
 command(s,{type:'offhandInput',id:al.id,held:true,aim:{x:16,y:10}});step(s,.02);command(s,{type:'offhandInput',id:al.id,held:false});expect(al.alCombat!.special!.elapsed).toBeCloseTo(.02,6);
 for(let i=0;i<350;i++)step(s,.02);command(s,{type:'rightSkillInput',id:al.id,key:'E',aim:{x:12,y:10}});for(let i=0;i<50;i++)step(s,.02);
 command(s,{type:'offhandInput',id:al.id,held:true,aim:{x:16,y:10}});command(s,{type:'offhandInput',id:al.id,held:false});const shot=al.alCombat!.special!;removeTrialSource(al,trialState(al)!.sources.find(x=>x.definitionId==='rocket-speed')!.id);step(s,.02);expect(shot.elapsed).toBeCloseTo(.04,6);
});
test('S3 speed belongs to caster and visit; leaving clears transient rate but preserves paid branch',()=>{
 const {s,al,h}=setup();command(s,{type:'rightSkillInput',id:al.id,key:'E',aim:{x:12,y:10}});for(let i=0;i<50;i++)step(s,.02);
 expect(trialState(al)!.timedRates).toHaveLength(1);expect(trialState(h)!.timedRates??[]).toHaveLength(0);
 const branches=[...trialState(al)!.loadout!.skills.rocket!.branches];clearTrialVisit(al);
 expect(trialState(al)!.timedRates).toHaveLength(0);expect(trialState(al)!.loadout!.skills.rocket!.branches).toEqual(branches);
});
