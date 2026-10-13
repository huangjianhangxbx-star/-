import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {step,command,resolveHit} from '../src/core/engine';
import {alState} from '../src/core/al-state';
import {trialState} from '../src/core/ability-trial';
import {quoteTrial,upgradeTrialSkill} from '../src/core/trial-progression';
function setup(){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;a.s.trialProgression=true;beginWorld(a.s);a.s.context='explorationIdle';alState(a.al);command(a.s,{type:'controlBody',id:'ranger'});a.s.combatIdentity!.enabled=false;a.e.ready=100;a.e.hp=a.e.maxHp=1000;for(const b of ['火箭弹射2','火箭弹射3','火箭弹射5'])expect(upgradeTrialSkill(a.s,quoteTrial(a.s,a.al),'E',b).ok).toBe(true);return a;}
test('S3 direct rocket kill restores actual one-charge readiness, not other actor or precision CD',()=>{
 const {s,al,h,e}=setup();e.hp=50;trialState(al)!.precisionCd=10;h.hunterCombat!.activeCooldown=8;h.hunterCombat!.activeCharge=0;command(s,{type:'rightSkillInput',id:al.id,key:'E',aim:e.pos});for(let i=0;i<10;i++)step(s,.02);expect(e.life).toBe('dead');expect(al.alCombat!.rocketCd).toBe(0);expect(trialState(al)!.precisionCd).toBeGreaterThan(9);expect(h.hunterCombat!.activeCooldown).toBeGreaterThan(7);
});
test.each([.3,1.1])('S3 marked death window routes refill to original caster after Z, elapsed=%s',delay=>{
 const {s,al,h,e}=setup();command(s,{type:'rightSkillInput',id:al.id,key:'E',aim:{x:15,y:10}});for(let i=0;i<8;i++)step(s,.02);expect(e.hp).toBe(916);command(s,{type:'controlBody',id:'hunter'});for(let i=0;i<Math.round(delay/.02);i++)step(s,.02);resolveHit(s,e,{...h.weapons[0],damage:2000},2000,h,{kind:'basic'});step(s,.02);expect(e.life).toBe('dead');if(delay<1)expect(al.alCombat!.rocketCd).toBe(0);else expect(al.alCombat!.rocketCd).toBeGreaterThan(0);
});
