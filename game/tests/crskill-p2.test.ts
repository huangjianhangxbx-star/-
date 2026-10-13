import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld,leaveWorldArea,continueWorld} from '../src/core/world-session';
import {command,step} from '../src/core/engine';
import {hunterState} from '../src/core/hunter-state';
import {resolveBasicDefinition} from '../src/core/basic-definition';
import * as trial from '../src/core/ability-trial';
const api=trial as any;
function setup(){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;beginWorld(a.s);a.s.context='explorationIdle';hunterState(a.h);a.e.ready=100;a.e.hp=a.e.maxHp=1000;return a;}
test('P2 real replacement competition retains losing ownership, freezes acceptance and retracts precisely',()=>{
 const {s,h}=setup(),t=trial.trialState(h)!;
 const plus=api.acquireTrialSource(h,'chisel-plus');expect(plus).toBeTruthy();
 expect(resolveBasicDefinition(h).stages[2].damage).toBe(40);
 h.hunterCombat!.nextStage=2;command(s,{type:'hunterInput',id:h.id,kind:'basic',aim:{x:12,y:10}});
 const accepted=h.basicAction!;trial.removeTrialSource(h,plus);
 expect(accepted.stageSpec.damage).toBe(40);expect(resolveBasicDefinition(h).stages[2].damage).toBe(25);
 expect(t.sources.some(x=>x.effect==='chisel')).toBe(true);
});
test('P2 rune can be owned while dormant, changes actual cooldown after equip, retracts and resumes with trace off',()=>{
 const {s,h}=setup(),t=trial.trialState(h)!;s.combatIdentity!.enabled=false;
 trial.configureTrial(s,h,t.revision,'root');const id=api.acquireTrialSource(h,'frost-haste');
 expect(api.trialSourceStates(h).find((x:any)=>x.id===id).status).toBe('dormant');
 h.hunterCombat!.frost=3;h.hunterCombat!.activeCooldown=8;h.hunterCombat!.activeCharge=0;
 step(s,.02);expect(h.hunterCombat!.activeCooldown).toBeCloseTo(7.98);
 trial.configureTrial(s,h,t.revision,'root');const before=h.hunterCombat!.activeCooldown;step(s,.02);
 expect(before-h.hunterCombat!.activeCooldown).toBeCloseTo(.0248);
 trial.configureTrial(s,h,t.revision,'root');const next=h.hunterCombat!.activeCooldown;step(s,.02);expect(next-h.hunterCombat!.activeCooldown).toBeCloseTo(.02);
 trial.configureTrial(s,h,t.revision,'root');expect(api.trialSourceStates(h).find((x:any)=>x.id===id).status).toBe('active');
});
test('P2 unresolved is not dormant; no fixed ownership cap; wrong profession and absent removal are pure',()=>{
 const {h,al}=setup(),t=trial.trialState(h)!;
 const unknown=api.acquireTrialSource(h,'frost-aftershock');expect(api.trialSourceStates(h).find((x:any)=>x.id===unknown).status).toBe('imported_unresolved');
 for(let i=0;i<8;i++)expect(api.acquireTrialSource(h,'chisel')).toBeTruthy();expect(t.sources.length).toBeGreaterThan(5);
 const before=structuredClone(trial.trialState(al));expect(api.acquireTrialSource(al,'frost-haste')).toBeUndefined();expect(trial.trialState(al)).toEqual(before);
 const rev=t.revision;trial.removeTrialSource(h,'missing');expect(t.revision).toBe(rev);
});
test('P2 stable winner does not depend on array order; precision snapshot excludes dormant/unresolved',()=>{
 const {s,h}=setup(),t=trial.trialState(h)!;api.acquireTrialSource(h,'chisel-plus');api.acquireTrialSource(h,'frost-aftershock');
 const first=trial.trialSnapshot(h);t.sources.reverse();expect(trial.trialSnapshot(h)).toEqual(first);
 trial.configureTrial(s,h,t.revision,'root');expect(trial.trialSnapshot(h)!.sources.some(x=>x.effect==='rush-frost')).toBe(false);
});
test('P2 lifecycle preserves ownership and source IDs across visit, death disables live modifiers',()=>{
 const {s,h}=setup(),t=trial.trialState(h)!;api.acquireTrialSource(h,'frost-haste');const before=t.sources.map(x=>x.id);
 expect(leaveWorldArea(s).ok).toBe(true);expect(continueWorld(s,s.world!.id,s.world!.visit.generation).ok).toBe(true);expect(t.sources.map(x=>x.id)).toEqual(before);
 h.life='dead' as any;expect(api.trialCooldownRate(h)).toBe(1);
});

test('P2 upgraded replacement actually deals 40 at release, not only a view label',()=>{
 const {s,h,e}=setup();api.acquireTrialSource(h,'chisel-plus');h.hunterCombat!.nextStage=2;
 command(s,{type:'hunterInput',id:h.id,kind:'basic',aim:e.pos});for(let i=0;i<6;i++)step(s,.02);
 expect(e.hp).toBe(960);expect(h.hunterCombat!.frost).toBe(2);
});
