import {test,expect} from 'vitest';
import {setup} from './crskill-architecture-fixture';
import {beginWorld} from '../src/core/world-session';
import {hunterState} from '../src/core/hunter-state';
import {alState} from '../src/core/al-state';
import {trialState,trialSourceStates,trialSnapshot,trialFrostStats,trialCooldownRate,acquireTrialSource} from '../src/core/ability-trial';
import {SOURCE_DEFINITIONS,type SourceDefinition} from '../src/core/ability-sources';
import {quoteTrial,acquireTrialRune,removeTrialRune,upgradeTrialPassive,configureTrialSlot,PASSIVE_TOKEN} from '../src/core/trial-progression';
import {resolveBasicDefinition} from '../src/core/basic-definition';
import {trialSkillPower} from '../src/core/trial-effects';
import {step,command} from '../src/core/engine';
// Test registry exercises real consumers; these are NOT researched game identities.
function definitions(){const defs:Record<string,SourceDefinition>={...SOURCE_DEFINITIONS};for(let i=0;i<24;i++){
 const id=`fixture-${i}`,common={id,nativeId:`Fixture ${i}`,profession:'blue' as const,origin:'rune' as const,phase:0};
 defs[id]=Object.freeze(i<6?{...common,effect:'frost-capacity',frostCap:1,frostRecovery:.1}:i<12?{...common,effect:'frost-haste',requires:'active',hastePerFrost:.01}:i<18?{...common,effect:'skill-modifier',requires:'rush',skillModifier:Object.freeze({root:'rush',damageAdd:2,cooldownAdd:-.1})}:i===18?{...common,effect:'chisel',damage:31,upgradesTo:'fixture-18-plus'}:i===19?{...common,effect:'combo-prefix',comboPrefix:'rapid'}:i===20?{...common,effect:'chisel',damage:44}:i===21?{...common,effect:'rush-frost',requires:'rush'}:i===22?{...common,effect:'skill-modifier',requires:'precision',skillModifier:Object.freeze({root:'precision',damageAdd:9})}:{...common,effect:'unresolved'});
 }defs['fixture-18-plus']=Object.freeze({...defs['fixture-18'],id:'fixture-18-plus',nativeId:'Fixture 18+',damage:53,phase:1,upgraded:true,upgradesTo:undefined});return Object.freeze(defs);}
test('24 different owned sources reach real consumers, retain dormancy and deterministically compete',()=>{
 const {s,h}=setup(),t=trialState(h)!;t.sources=[];(t as any).definitions=definitions();
 for(let i=0;i<24;i++)expect(acquireTrialRune(s,quoteTrial(s,h),`fixture-${i}`).ok).toBe(true);
 expect(t.sources).toHaveLength(24);expect(new Set(t.sources.map(x=>x.id)).size).toBe(24);
 expect(trialFrostStats(h)).toEqual({cap:9,recovery:1.6});h.hunterCombat!.frost=3;expect(trialCooldownRate(h)).toBeCloseTo(1.18);
 expect(resolveBasicDefinition(h).stages).toHaveLength(5);expect(resolveBasicDefinition(h).stages[3].damage).toBe(31);
 expect(trialSkillPower({composition:trialSnapshot(h)} as any,'rush',75)).toBe(87);
 h.hunterCombat!.frostPaidAt=s.time;h.hunterCombat!.activeCharge=0;h.hunterCombat!.activeCooldown=8;step(s,.02);expect(h.hunterCombat!.activeCooldown).toBeCloseTo(7.9764);
 const states=trialSourceStates(h);expect(states.find(x=>x.definitionId==='fixture-20')!.status).toBe('superseded');expect(states.find(x=>x.definitionId==='fixture-22')!.status).toBe('dormant');expect(states.find(x=>x.definitionId==='fixture-23')!.status).toBe('imported_unresolved');
 const result=structuredClone(states);t.sources.reverse();expect(trialSourceStates(h)).toEqual(result);
 configureTrialSlot(s,quoteTrial(s,h),'E',null);expect(t.sources).toHaveLength(24);expect(trialCooldownRate(h)).toBe(1);expect(trialSkillPower({composition:trialSnapshot(h)} as any,'rush',75)).toBe(75);
 configureTrialSlot(s,quoteTrial(s,h),'E','rush');expect(trialCooldownRate(h)).toBeCloseTo(1.18);
});
test('24-source combination changes actual basic hit with trace off and frozen definitions survive caller mutation',()=>{
 const {s,h,e}=setup(),t=trialState(h)!;t.sources=[];t.definitions=definitions();for(let i=0;i<24;i++)acquireTrialRune(s,quoteTrial(s,h),`fixture-${i}`);
 s.combatIdentity!.enabled=false;e.hp=e.maxHp=1000;h.hunterCombat!.nextStage=3;h.hunterCombat!.frost=9;
 expect(command(s,{type:'hunterInput',id:h.id,kind:'basic',aim:e.pos}).ok).toBe(true);for(let i=0;i<8;i++)step(s,.02);expect(e.hp).toBe(969);expect(h.hunterCombat!.frost).toBe(8);
 const mutable={...SOURCE_DEFINITIONS['rush-force'],skillModifier:{root:'rush',damageAdd:30}};
 t.definitions={...t.definitions,'mutable':mutable};acquireTrialSource(h,'mutable');const accepted=trialSnapshot(h)!;mutable.skillModifier.damageAdd=999;
 expect(trialSkillPower({composition:accepted} as any,'rush',75)).toBe(117);
});
test('one injected rune upgrades once with real payment, preserves 23 others and accepted snapshot',()=>{
 const {s,h,al}=setup(),t=trialState(h)!;t.sources=[];(t as any).definitions=definitions();for(let i=0;i<24;i++)acquireTrialRune(s,quoteTrial(s,h),`fixture-${i}`);
 const chosen=t.sources.find(x=>x.definitionId==='fixture-18')!,others=structuredClone(t.sources.filter(x=>x!==chosen)),old=trialSnapshot(h)!,q=quoteTrial(s,h),quantity=s.world!.backpack!.stacks.find(x=>x.itemId===PASSIVE_TOKEN)!.quantity;
 expect(upgradeTrialPassive(s,q,chosen.id).ok).toBe(true);expect(chosen.definitionId).toBe('fixture-18-plus');expect(t.sources.filter(x=>x!==chosen)).toEqual(others);expect(s.world!.backpack!.stacks.find(x=>x.itemId===PASSIVE_TOKEN)!.quantity).toBe(quantity-1);
 for(const bad of [q,quoteTrial(s,h),{...quoteTrial(s,h),bodyId:al.id},{...quoteTrial(s,h),mainId:'bad'}]){const before=structuredClone(t.sources);expect(upgradeTrialPassive(s,bad,chosen.id).ok).toBe(false);expect(t.sources).toEqual(before);}
 expect(old.sources.find(x=>x.id===chosen.id)!.definitionId).toBe('fixture-18');expect(resolveBasicDefinition(h).stages[3].damage).toBe(53);
 expect(removeTrialRune(s,quoteTrial(s,h),chosen.id).ok).toBe(true);expect(resolveBasicDefinition(h).stages[3].damage).toBe(44);
 const modifier=t.sources.find(x=>x.definitionId==='fixture-12')!;removeTrialRune(s,quoteTrial(s,h),modifier.id);expect(trialSkillPower({composition:trialSnapshot(h)} as any,'rush',75)).toBe(85);expect(trialSkillPower({composition:old} as any,'rush',75)).toBe(87);
});
