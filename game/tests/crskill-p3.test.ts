import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld,leaveWorldArea,continueWorld} from '../src/core/world-session';
import {step,command} from '../src/core/engine';
import {alState} from '../src/core/al-state';
import {hunterState} from '../src/core/hunter-state';
import {trialState,trialSnapshot,trialSourceStates,acquireTrialSource} from '../src/core/ability-trial';
import {rightSkillInput,rightSkillCooldown} from '../src/core/right-hand-skills';
import {resolveBasicDefinition} from '../src/core/basic-definition';
import {inventoryQuantity} from '../src/core/world-inventory';
import {quoteTrial,configureTrialSlot,upgradeTrialSkill,upgradeTrialPassive,prepareTrialSlot,prepareTrialBranch,ACTIVE_TOKEN,PASSIVE_TOKEN} from '../src/core/trial-progression';
function setup(){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;a.s.trialProgression=true;beginWorld(a.s);a.s.context='explorationIdle';hunterState(a.h);alState(a.al);a.e.ready=100;return a;}
test('P3 native root swaps/clears across QER without resetting independent cooldown',()=>{
 const {s,al}=setup();s.controlledBodyId=al.id;al.alCombat!.rocketCd=4;
 expect(configureTrialSlot(s,quoteTrial(s,al),'Q','rocket').ok).toBe(true);
 expect(trialState(al)!.loadout!.slots).toEqual({Q:'rocket',E:'precision',R:null});
 expect(rightSkillCooldown(al,'Q')).toBe(4);expect(rightSkillCooldown(al,'E')).toBe(0);
 expect(configureTrialSlot(s,quoteTrial(s,al),'Q',null).ok).toBe(true);expect(al.alCombat!.rocketCd).toBe(4);
 expect(rightSkillInput(s,al,'Q',{x:12,y:10}).ok).toBe(false);
});
test('P3 selected root level upgrades atomically; replay, unknown branch and other body are pure',()=>{
 const {s,h,al}=setup(),t=trialState(h)!,q=quoteTrial(s,h),stock=inventoryQuantity(s.world!.backpack,ACTIVE_TOKEN);
 const old=trialSnapshot(h);expect(upgradeTrialSkill(s,q,'E','破阵猛冲1').ok).toBe(true);
 expect(t.loadout!.skills.rush!.level).toBe(1);expect(inventoryQuantity(s.world!.backpack,ACTIVE_TOKEN)).toBe(stock-1);
 expect(old!.sources.some(x=>x.effect==='rush-frost')).toBe(false);expect(trialSnapshot(h)!.sources.some(x=>x.effect==='rush-frost')).toBe(true);
 const before=structuredClone(s);expect(upgradeTrialSkill(s,q,'E','破阵猛冲1').ok).toBe(false);
 expect(upgradeTrialSkill(s,quoteTrial(s,h),'E','破阵猛冲7').ok).toBe(false);
 expect(upgradeTrialSkill(s,quoteTrial(s,al),'Q','精准装填7').ok).toBe(false);expect(s).toEqual(before);
});
test('P3 passive upgrade spends real inventory once; retains identity and changes actual hit',()=>{
 const {s,h,e}=setup(),t=trialState(h)!,id=t.sources.find(x=>x.effect==='chisel')!.id,stock=inventoryQuantity(s.world!.backpack,PASSIVE_TOKEN);
 const old=trialSnapshot(h);expect(upgradeTrialPassive(s,quoteTrial(s,h),id).ok).toBe(true);
 expect(t.sources.find(x=>x.id===id)?.upgraded).toBe(true);expect(inventoryQuantity(s.world!.backpack,PASSIVE_TOKEN)).toBe(stock-1);
 expect(old!.sources[0].definitionId).toBe('chisel');expect(resolveBasicDefinition(h).stages[2].damage).toBe(40);
 const before=structuredClone(s);expect(upgradeTrialPassive(s,quoteTrial(s,h),id).ok).toBe(false);expect(s).toEqual(before);
 e.hp=e.maxHp=1000;h.hunterCombat!.nextStage=2;command(s,{type:'hunterInput',id:h.id,kind:'basic',aim:e.pos});for(let i=0;i<6;i++)step(s,.02);expect(e.hp).toBe(960);
});
test('P3 native hold release follows remapped key and carries frozen skill/slot through child',()=>{
 const {s,h}=setup();configureTrialSlot(s,quoteTrial(s,h),'R','rush');upgradeTrialSkill(s,quoteTrial(s,h),'R','破阵猛冲1');
 expect(rightSkillInput(s,h,'R',{x:12,y:10},true).ok).toBe(true);const accepted=h.hunterCombat!.special!.context!;
 expect(accepted.slot).toBe(2);expect(accepted.composition!.skill!.level).toBe(1);
 rightSkillInput(s,h,'Q',undefined,false);expect(h.hunterCombat!.special!.kind).toBe('prepare');
 rightSkillInput(s,h,'R',undefined,false);for(let i=0;i<25;i++)step(s,.02);
 expect(h.hunterCombat!.special?.kind).not.toBe('prepare');expect(h.hunterCombat!.activeCooldown).toBeGreaterThan(0);
});
test('P3 visit identity and inventory reject; dormant ownership persists on unequip/continue',()=>{
 const {s,h}=setup(),id=acquireTrialSource(h,'frost-haste')!;configureTrialSlot(s,quoteTrial(s,h),'E',null);
 expect(trialSourceStates(h).find(x=>x.id===id)?.status).toBe('dormant');const stale=quoteTrial(s,h);
 leaveWorldArea(s);continueWorld(s,s.world!.id,s.world!.visit.generation);s.context='explorationIdle';
 expect(configureTrialSlot(s,stale,'E','rush').ok).toBe(false);expect(configureTrialSlot(s,quoteTrial(s,h),'E','rush').ok).toBe(true);
 expect(trialSourceStates(h).find(x=>x.id===id)?.status).toBe('active');
 s.world!.backpack!.stacks=s.world!.backpack!.stacks.filter(x=>x.itemId!==ACTIVE_TOKEN);const before=structuredClone(s);
 expect(upgradeTrialSkill(s,quoteTrial(s,h),'E','破阵猛冲1').ok).toBe(false);expect(s).toEqual(before);
});
test('P3 preparation survives new world while levels and once-per-world grants reset',()=>{
 const {s,h}=setup();configureTrialSlot(s,quoteTrial(s,h),'Q','rush');upgradeTrialSkill(s,quoteTrial(s,h),'Q','破阵猛冲1');
 expect(command(s,{type:'restartWorld',worldId:s.world!.id}).ok).toBe(true);
 expect(s.trialProgression).toBe(true);expect(s.trialPreparation!.hunter.slots.Q).toBe('rush');
 expect(prepareTrialSlot(s,'hunter','R','rush').ok).toBe(true);
 command(s,{type:'carry',gold:0,vitality:0});const next=s.units.find(u=>u.id==='hunter')!;
 expect(trialState(next)!.loadout!.slots.R).toBe('rush');expect(trialState(next)!.loadout!.skills.rush!.level).toBe(0);
 expect(inventoryQuantity(s.world!.backpack,ACTIVE_TOKEN)).toBe(6);
});
test('P3 stale body/main/world, malformed duplicate stock, busy and death reject without mutations',()=>{
 const {s,h,al}=setup(),q=quoteTrial(s,h),id=trialState(h)!.sources[0].id;
 for(const invalid of [{...q,bodyId:al.id},{...q,mainId:'wrong'},{...q,worldId:'old'},{...q,visit:0}]){
  const before=structuredClone(s);expect(upgradeTrialPassive(s,invalid,id).ok).toBe(false);expect(s).toEqual(before);
 }
 s.world!.backpack!.stacks.push({itemId:PASSIVE_TOKEN,quantity:2});const before=structuredClone(s);expect(upgradeTrialPassive(s,q,id).ok).toBe(false);expect(s).toEqual(before);
 h.life='dead';const dead=structuredClone(s);expect(configureTrialSlot(s,q,'R','rush').ok).toBe(false);expect(s).toEqual(dead);
});
test('P3 level-one branch produces native first-hit frost with trace disabled; other root unchanged',()=>{
 const {s,h,e,al}=setup();upgradeTrialSkill(s,quoteTrial(s,h),'E','破阵猛冲1');s.combatIdentity!.enabled=false;h.hunterCombat!.frost=0;h.hunterCombat!.frostPaidAt=s.time;
 rightSkillInput(s,h,'E',{x:16,y:10},true);rightSkillInput(s,h,'E',undefined,false);for(let i=0;i<17;i++)step(s,.02);
 const hz=h.hunterCombat!.hazards.find(x=>x.kind==='charge')!;expect(hz.context!.composition!.skill!.branches).toEqual(['破阵猛冲1']);
 e.pos={x:h.pos.x+1.2,y:h.pos.y};step(s,.02);expect(h.hunterCombat!.frost).toBe(2);expect(trialState(al)!.loadout!.skills.precision!.level).toBe(0);
});


test('P3 preselected branches are preparation, not free runtime levels, and unresolved choices reject',()=>{
 const {s}=setup();command(s,{type:'restartWorld',worldId:s.world!.id});
 expect(prepareTrialBranch(s,'hunter','rush',1,null).ok).toBe(true);
 const before=structuredClone(s);expect(prepareTrialBranch(s,'hunter','rush',1,'破阵猛冲3').ok).toBe(false);expect(s).toEqual(before);
 expect(prepareTrialBranch(s,'hunter','rush',1,'破阵猛冲1').ok).toBe(true);command(s,{type:'carry',gold:0,vitality:0});
 const h=s.units.find(u=>u.id==='hunter')!;h.ready=0;s.context='explorationIdle';
 expect(trialState(h)!.loadout!.skills.rush!.level).toBe(0);expect(upgradeTrialSkill(s,quoteTrial(s,h),'E').ok).toBe(true);
 expect(trialState(h)!.loadout!.skills.rush!.branches).toEqual(['破阵猛冲1']);
});
