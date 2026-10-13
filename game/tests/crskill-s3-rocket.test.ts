import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {step,command} from '../src/core/engine';
import {alState} from '../src/core/al-state';
import {quoteTrial,upgradeTrialSkill} from '../src/core/trial-progression';
function setup(branch:string){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;a.s.trialProgression=true;beginWorld(a.s);a.s.context='explorationIdle';alState(a.al);command(a.s,{type:'controlBody',id:'ranger'});a.s.combatIdentity!.enabled=false;a.e.ready=100;a.e.hp=a.e.maxHp=1000;expect(upgradeTrialSkill(a.s,quoteTrial(a.s,a.al),'E',branch).ok).toBe(true);return a;}
test('S3 rocket L1 B modifies landing and launch separately with DATA35/24, preserving native base damage',()=>{
 const {s,al,e}=setup('火箭弹射2');expect(upgradeTrialSkill(s,quoteTrial(s,al),'E','火箭弹射3').ok).toBe(true);
 command(s,{type:'rightSkillInput',id:'ranger',key:'E',aim:e.pos});for(let i=0;i<6;i++)step(s,.02);expect(e.hp).toBe(916);
 for(let i=0;i<30;i++)step(s,.02);expect(e.hp).toBe(796);
});
test('S3 rocket L1 A actually stuns a hit target while a miss does not affect remote units',()=>{
 const {s,al,e}=setup('火箭弹射1');const remote=structuredClone(e);remote.id='far';remote.pos={x:20,y:20};s.units.push(remote);
 command(s,{type:'rightSkillInput',id:al.id,key:'E',aim:e.pos});for(let i=0;i<25;i++)step(s,.02);
 expect(e.statuses.find(x=>x.kind==='stun')?.remaining).toBeGreaterThan(1);expect(remote.statuses.some(x=>x.kind==='stun')).toBe(false);
});
