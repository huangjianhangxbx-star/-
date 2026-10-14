import {test,expect} from 'vitest';
import {setup} from './crskill-architecture-fixture';
import {trialState,SOURCE_DEFINITIONS} from '../src/core/ability-trial';
import {quoteTrial,configureTrialSlot,upgradeTrialSkill,ACTIVE_TOKEN} from '../src/core/trial-progression';
import {rightSkillInput,rightSkillCooldown,rightSkillSpec} from '../src/core/right-hand-skills';
import {step,command} from '../src/core/engine';
function probe(){const a=setup();const {s,al}=a;s.controlledBodyId=al.id;
 const t=trialState(al)!;(t as any).roots={probe:{name:'TEST ONLY probe',profession:'yellow',abilityId:'al-stab'}};
 (t as any).branches=Object.fromEntries(Array.from({length:6},(_,i)=>[`probe-${i}`,{root:'probe',tier:Math.floor(i/2)+1,source:`probe-source-${i}`}]));
 (t as any).definitions={...SOURCE_DEFINITIONS,...Object.fromEntries(Array.from({length:6},(_,i)=>[`probe-source-${i}`,Object.freeze({id:`probe-source-${i}`,nativeId:`TEST ONLY ${i}`,profession:'yellow',effect:'skill-modifier',origin:'active-branch',phase:0,requires:'probe',skillModifier:Object.freeze({root:'probe',damageAdd:1,cooldownAdd:-.1})})]))};
 expect(configureTrialSlot(s,quoteTrial(s,al),'R','probe').ok).toBe(true);return a;}
test('same profession three distinct QER roots use actual accept, payment, release and independent cooldown',()=>{
 const {s,al,e}=probe(),t=trialState(al)!;e.hp=e.maxHp=1000;
 expect(t.loadout!.slots).toEqual({Q:'precision',E:'rocket',R:'probe'});expect(rightSkillSpec(al,'R')!.name).toBe('TEST ONLY probe');
 const stock=s.world!.backpack!.stacks.find(x=>x.itemId===ACTIVE_TOKEN)!;stock.quantity=9;
 for(const [key,branches] of [['Q',['精准装填1','精准装填3','精准装填5']],['E',['火箭弹射2','火箭弹射3','火箭弹射5']],['R',['probe-0','probe-3','probe-4']]] as const){for(const branch of branches)expect(upgradeTrialSkill(s,quoteTrial(s,al),key,branch).ok).toBe(true);}
 expect(stock.quantity).toBe(0);expect(Object.values(t.loadout!.skills).map(x=>x!.level)).toEqual([3,3,3]);
 const before=structuredClone(t.loadout);expect(upgradeTrialSkill(s,quoteTrial(s,al),'R','probe-5').ok).toBe(false);expect(t.loadout).toEqual(before);
 s.combatIdentity!.enabled=false;const stamina=al.stamina!.current;
 expect(rightSkillInput(s,al,'R',e.pos).ok).toBe(true);const action=al.equipment!.equipped.right.skills!.action!;expect(action.context.composition!.skill).toMatchObject({root:'probe',level:3,slot:2});expect(al.stamina!.current).toBeLessThan(stamina);
 for(let i=0;i<30;i++)step(s,.02);expect(e.hp).toBeLessThan(1000);expect(rightSkillCooldown(al,'R')).toBeGreaterThan(0);expect(rightSkillCooldown(al,'Q')).toBe(0);expect(rightSkillCooldown(al,'E')).toBe(0);
 s.context='explorationIdle';expect(configureTrialSlot(s,quoteTrial(s,al),'Q','probe' as any).ok).toBe(true);expect(rightSkillCooldown(al,'Q')).toBeGreaterThan(0);expect(action.context.composition!.skill!.slot).toBe(2);
 expect(configureTrialSlot(s,quoteTrial(s,al),'Q',null).ok).toBe(true);expect(rightSkillInput(s,al,'Q',e.pos).ok).toBe(false);expect(configureTrialSlot(s,quoteTrial(s,al),'R','probe' as any).ok).toBe(true);expect(rightSkillCooldown(al,'R')).toBeGreaterThan(0);
});
test('three roots cast at level zero, each release and original cooldown remains single authority',()=>{
 const {s,al,e}=probe(),t=trialState(al)!;s.combatIdentity!.enabled=false;
 expect(command(s,{type:'rightSkillInput',id:al.id,key:'Q',aim:e.pos}).ok).toBe(true);expect(t.precision!.composition!.skill).toMatchObject({root:'precision',level:0});for(let i=0;i<45;i++)step(s,.02);
 expect(command(s,{type:'rightSkillInput',id:al.id,key:'E',aim:e.pos}).ok).toBe(true);expect(al.alCombat!.special!.context!.composition!.skill).toMatchObject({root:'rocket',level:0});for(let i=0;i<60;i++)step(s,.02);
 expect(command(s,{type:'rightSkillInput',id:al.id,key:'R',aim:{x:al.pos.x+1,y:al.pos.y}}).ok).toBe(true);const action=al.equipment!.equipped.right.skills!.action!;expect(action.context.composition!.skill).toMatchObject({root:'probe',level:0});expect(action.spec.damage).toBe(20);
 for(let i=0;i<30;i++)step(s,.02);for(const key of ['Q','E','R'] as const)expect(rightSkillCooldown(al,key)).toBeGreaterThan(0);
 expect(rightSkillCooldown(al,'Q')).toBe(t.precisionCd);expect(rightSkillCooldown(al,'E')).toBe(al.alCombat!.rocketCd);
 command(s,{type:'controlBody',id:'hunter'});const before=structuredClone(t);expect(command(s,{type:'rightSkillInput',id:al.id,key:'R',aim:e.pos}).ok).toBe(false);expect(t).toEqual(before);
});
test.each([[['probe-0','probe-2','probe-4']],[['probe-1','probe-3','probe-5']]])('each tier commits A or B only once (%j)',branches=>{
 const {s,al}=probe(),t=trialState(al)!;
 for(const branch of branches){const q=quoteTrial(s,al);expect(upgradeTrialSkill(s,q,'R',branch).ok).toBe(true);const before=structuredClone(t);expect(upgradeTrialSkill(s,q,'R',branch).ok).toBe(false);expect(t).toEqual(before);}
 expect(t.loadout!.skills.probe!.level).toBe(3);expect(t.loadout!.skills.rocket!.level).toBe(0);expect(t.loadout!.skills.precision!.level).toBe(0);
});
test('unregistered or unresolved branch consumers cannot charge inventory or advance levels',()=>{
 const {s,al}=probe(),t=trialState(al)!;t.branches={...t.branches,missing:{root:'probe',tier:1,source:'not-registered'},unresolved:{root:'probe',tier:1,source:'fixture-unresolved'}};
 t.definitions={...t.definitions,'fixture-unresolved':{id:'fixture-unresolved',nativeId:'TEST ONLY unresolved',profession:'yellow',origin:'active-branch',phase:0,effect:'unresolved',requires:'probe'}};
 for(const branch of ['missing','unresolved']){const before=structuredClone(s);expect(upgradeTrialSkill(s,quoteTrial(s,al),'R',branch).ok).toBe(false);expect(s).toEqual(before);}
});
test('a new world does not retain an unregistered test root or its acquired runtime levels',()=>{
 const {s,al}=probe();expect(upgradeTrialSkill(s,quoteTrial(s,al),'R','probe-0').ok).toBe(true);
 expect(command(s,{type:'restartWorld',worldId:s.world!.id}).ok).toBe(true);expect(command(s,{type:'carry',gold:0,vitality:0}).ok).toBe(true);
 const next=s.units.find(u=>u.id==='ranger')!,t=trialState(next)!;expect(t.loadout!.slots.R).toBeNull();expect(t.loadout!.skills.probe).toBeUndefined();expect(t.loadout!.skills.rocket!.level).toBe(0);expect(t.loadout!.skills.precision!.level).toBe(0);
});
