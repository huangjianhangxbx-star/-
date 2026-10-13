import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {step,command} from '../src/core/engine';
import {alState} from '../src/core/al-state';
import {quoteTrial,upgradeTrialSkill} from '../src/core/trial-progression';
import {trialState} from '../src/core/ability-trial';
function setup(){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;a.s.trialProgression=true;beginWorld(a.s);a.s.context='explorationIdle';alState(a.al);command(a.s,{type:'controlBody',id:'ranger'});a.s.combatIdentity!.enabled=false;a.e.ready=100;return a;}
test('S3 precision native branches produce actual eight-second CD, instant commit and six rounds',()=>{
 const {s,al}=setup();for(const branch of ['精准装填1','精准装填3','精准装填5'])expect(upgradeTrialSkill(s,quoteTrial(s,al),'Q',branch).ok).toBe(true);
 const left=structuredClone(al.equipment!.equipped.left);expect(command(s,{type:'rightSkillInput',id:al.id,key:'Q'}).ok).toBe(true);
 const t=trialState(al)!;expect(t.precisionCd).toBe(8);expect(t.magazine).toEqual(Array(6).fill('mortar'));expect(t.reload).toBe(0);
 command(s,{type:'offhandInput',id:al.id,held:true,aim:{x:12,y:10}});for(let i=0;i<6;i++)step(s,.02);command(s,{type:'offhandInput',id:al.id,held:false});
 expect(t.magazine).toHaveLength(5);expect(al.equipment!.equipped.left).toEqual(left);
 for(let i=0;i<220;i++)step(s,.02);expect(t.magazine).toEqual(Array(4).fill('normal'));
});
test('S3 ordinary precision retains delayed commitment; cancel cannot receive instant upgrade retroactively',()=>{
 const {s,al}=setup();expect(upgradeTrialSkill(s,quoteTrial(s,al),'Q','精准装填1').ok).toBe(true);
 command(s,{type:'rightSkillInput',id:al.id,key:'Q'});expect(trialState(al)!.magazine[0]).toBe('normal');
 command(s,{type:'controlBody',id:'hunter'});for(let i=0;i<50;i++)step(s,.02);expect(trialState(al)!.magazine[0]).toBe('normal');expect(trialState(al)!.precisionCd).toBeGreaterThan(0);
});
