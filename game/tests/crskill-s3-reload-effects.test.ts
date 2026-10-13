import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {step,command} from '../src/core/engine';
import {alState} from '../src/core/al-state';
import {trialState,trialSnapshot} from '../src/core/ability-trial';
import {quoteTrial,upgradeTrialSkill} from '../src/core/trial-progression';
function setup(branches:string[]){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;a.s.trialProgression=true;beginWorld(a.s);a.s.context='explorationIdle';alState(a.al);command(a.s,{type:'controlBody',id:'ranger'});a.s.combatIdentity!.enabled=false;a.e.ready=100;a.e.hp=a.e.maxHp=1000;for(const b of branches)expect(upgradeTrialSkill(a.s,quoteTrial(a.s,a.al),'Q',b).ok).toBe(true);return a;}
test('S3 precision speed waits .05 after cast even for instant reload, then retracts on next reload start',()=>{
 const {s,al}=setup(['精准装填2','精准装填3']);command(s,{type:'rightSkillInput',id:al.id,key:'Q'});step(s,.04);expect(trialSnapshot(al)?.shotRate).toBe(1);step(s,.02);expect(trialSnapshot(al)?.shotRate).toBeCloseTo(1.4);
 command(s,{type:'offhandInput',id:al.id,held:true,aim:{x:12,y:10}});step(s,.02);command(s,{type:'offhandInput',id:al.id,held:false});expect(al.alCombat!.special!.elapsed).toBeCloseTo(.028,6);
 for(let i=0;i<50;i++)step(s,.02);trialState(al)!.magazine=[];step(s,.02);expect(trialSnapshot(al)?.shotRate).toBe(1);
});
test('S3 precision damage begins on real reload completion, persists through next reload start and ends at completion',()=>{
 const {s,al}=setup(['精准装填1','精准装填4']);command(s,{type:'rightSkillInput',id:al.id,key:'Q'});for(let i=0;i<10;i++)step(s,.02);expect(trialSnapshot(al)?.shotDamageRatio??0).toBe(0);
 for(let i=0;i<35;i++)step(s,.02);expect(trialSnapshot(al)?.shotDamageRatio).toBe(.35);
 trialState(al)!.magazine=[];step(s,.02);expect(trialSnapshot(al)?.shotDamageRatio).toBe(.35);for(let i=0;i<45;i++)step(s,.02);expect(trialSnapshot(al)?.shotDamageRatio??0).toBe(0);
});
test('S3 reload damage increases actual right-shot damage, not rocket or other actor',()=>{
 const {s,al,e,h}=setup(['精准装填1','精准装填4']);command(s,{type:'rightSkillInput',id:al.id,key:'Q'});for(let i=0;i<45;i++)step(s,.02);trialState(al)!.magazine=['normal','normal'];
 command(s,{type:'offhandInput',id:al.id,held:true,aim:e.pos});for(let i=0;i<8;i++)step(s,.02);command(s,{type:'offhandInput',id:al.id,held:false});expect(e.hp).toBeCloseTo(1000-32*1.35);expect(trialSnapshot(h)?.shotDamageRatio??0).toBe(0);
});
test('S3 interrupted reload clears uncommitted modifier and does not award it on a later ordinary reload',()=>{
 const {s,al}=setup(['精准装填1','精准装填4']);command(s,{type:'rightSkillInput',id:al.id,key:'Q'});for(let i=0;i<5;i++)step(s,.02);command(s,{type:'controlBody',id:'hunter'});for(let i=0;i<50;i++)step(s,.02);command(s,{type:'controlBody',id:'ranger'});trialState(al)!.magazine=[];for(let i=0;i<50;i++)step(s,.02);expect(trialSnapshot(al)?.shotDamageRatio??0).toBe(0);
});
