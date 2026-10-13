import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {step,command} from '../src/core/engine';
import {alState} from '../src/core/al-state';
import {trialState,trialSnapshot,removeTrialSource,clearTrialVisit} from '../src/core/ability-trial';
import {quoteTrial,upgradeTrialSkill} from '../src/core/trial-progression';
function setup(){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;a.s.trialProgression=true;beginWorld(a.s);a.s.context='explorationIdle';alState(a.al);command(a.s,{type:'controlBody',id:'ranger'});a.s.combatIdentity!.enabled=false;a.e.ready=100;a.e.hp=a.e.maxHp=1000;for(const b of ['精准装填1','精准装填3','精准装填6'])expect(upgradeTrialSkill(a.s,quoteTrial(a.s,a.al),'Q',b).ok).toBe(true);return a;}
function fire(a:ReturnType<typeof setup>,aim:{x:number;y:number}){command(a.s,{type:'offhandInput',id:a.al.id,held:true,aim});step(a.s,.02);command(a.s,{type:'offhandInput',id:a.al.id,held:false});for(let i=0;i<55;i++)step(a.s,.02);}
test('S3 guaranteed crit uses native 2.25 factor, persists after miss, clears after matching hit for next shot',()=>{
 const a=setup();command(a.s,{type:'rightSkillInput',id:a.al.id,key:'Q'});fire(a,{x:16,y:10});expect(a.e.hp).toBe(1000);expect(trialSnapshot(a.al)?.critical?.multiplier).toBe(2.25);
 fire(a,a.e.pos);expect(a.e.hp).toBe(820);expect(trialSnapshot(a.al)?.critical).toBeUndefined();fire(a,a.e.pos);expect(a.e.hp).toBe(740);
});
test('S3 crit is owner/source scoped and visit clearing cannot retain it',()=>{
 const {s,al,h}=setup();command(s,{type:'rightSkillInput',id:al.id,key:'Q'});expect(trialSnapshot(h)?.critical).toBeUndefined();removeTrialSource(al,trialState(al)!.sources.find(x=>x.definitionId==='precision-critical')!.id);expect(trialSnapshot(al)?.critical).toBeUndefined();clearTrialVisit(al);expect(trialSnapshot(al)?.critical).toBeUndefined();
});
