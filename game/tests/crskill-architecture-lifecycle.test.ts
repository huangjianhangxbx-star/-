import {test,expect} from 'vitest';
import {setup} from './crskill-architecture-fixture';
import {step,command,resolveHit} from '../src/core/engine';
import {trialState} from '../src/core/ability-trial';
import {quoteTrial,upgradeTrialSkill} from '../src/core/trial-progression';
import {advanceTrialRocketMarks} from '../src/core/trial-rocket-reset';
test('a detached former caster cannot receive a late marker refund outside the actual roster',()=>{
 const {s,al,h,e}=setup();e.hp=e.maxHp=1000;command(s,{type:'controlBody',id:'ranger'});
 for(const b of ['火箭弹射2','火箭弹射3','火箭弹射5'])expect(upgradeTrialSkill(s,quoteTrial(s,al),'E',b).ok).toBe(true);
 command(s,{type:'rightSkillInput',id:al.id,key:'E',aim:{x:15,y:10}});for(let i=0;i<8;i++)step(s,.02);expect(trialState(al)!.rocketMarks!.size).toBe(1);
 s.units=s.units.filter(u=>u!==al);const cd=al.alCombat!.rocketCd;resolveHit(s,e,{...h.weapons[0],damage:2000},2000,h,{kind:'basic'});advanceTrialRocketMarks(s,al);expect(al.alCombat!.rocketCd).toBe(cd);expect(trialState(al)!.rocketMarks!.size).toBe(0);
});
