import {test,expect} from 'vitest';
import {setup} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {command,step,resolveHit} from '../src/core/engine';
import {resolveBasicDefinition,BASIC_DEFINITIONS} from '../src/core/basic-definition';
import {hunterState} from '../src/core/hunter-state';
import {requestBasic} from '../src/core/basic-chain';
const fixture=()=>{const a=setup();a.s.sessionMode='exploration';beginWorld(a.s);hunterState(a.h);a.s.context='explorationIdle';return a;};
const switchTo=(s:any,u:any,form:'I'|'II')=>command(s,{type:'switchMainForm',id:u.id,form} as any);
test('EQ02 same right instance only current controller can switch; no payment or left mutation',()=>{
 const {s,h,al}=fixture(),right=h.equipment!.equipped.right,left=structuredClone(h.equipment!.equipped.left),st=structuredClone(h.stamina);
 expect((right as any).currentForm).toBe('I');expect(switchTo(s,al,'II').ok).toBe(false);expect(switchTo(s,h,'II').ok).toBe(true);
 expect(h.equipment!.equipped.right).toBe(right);expect(h.equipment!.equipped.left).toEqual(left);expect(h.stamina).toEqual(st);expect(resolveBasicDefinition(h).stages.map(d=>d.presentationId)).toEqual(['a3','a4']);
 expect(resolveBasicDefinition(al)).toBe(BASIC_DEFINITIONS['al-basic-v1']);command(s,{type:'controlBody',id:al.id});expect(switchTo(s,al,'II').ok).toBe(true);expect(resolveBasicDefinition(al).stages.map(d=>d.presentationId)).toEqual(['a2','a3']);
});
test('EQ02 busy C is read-only rejection; accepted snapshot governs real Hit even equipment mutates',()=>{
 const {s,h,e}=fixture();e.hp=e.maxHp=150;e.pos={x:11.9,y:10};expect(switchTo(s,h,'II').ok).toBe(true);requestBasic(s,h,e.pos,100);const a=h.basicAction!;const before=structuredClone(h);
 expect(switchTo(s,h,'I').ok).toBe(false);expect(h).toEqual(before);expect((a as any).formId).toBe('II');expect((a as any).mainInstanceId).toBe(h.equipment!.equipped.right.id);
 (h.equipment!.equipped.right as any).currentForm='I';h.equipment!.equipped.right.weapon={...h.equipment!.equipped.right.weapon,postureDamage:999};step(s,.05);
 expect(e.hp).toBe(130);const outcome=s.combatIdentity!.trace.find(r=>r.type==='hit-outcome'&&r.context?.actionId===a.combatContext?.actionId)!;expect(outcome.outcome!.postureApplied).toBeCloseTo(((a as any).weaponSnapshot.postureDamage));expect((outcome.attack as any).formId).toBe('II');
});
test('EQ02 lawful switch flushes only unaccepted chain; I golden definition remains identical',()=>{
 const {s,h}=fixture();h.hunterCombat!.nextStage=3;h.hunterCombat!.held=true;expect(switchTo(s,h,'II').ok).toBe(true);expect(h.hunterCombat!.nextStage).toBe(0);expect(h.hunterCombat!.held).toBe(false);expect(switchTo(s,h,'I').ok).toBe(true);expect(resolveBasicDefinition(h)).toBe(BASIC_DEFINITIONS['hunter-v2']);expect(resolveBasicDefinition(h).stages).toHaveLength(4);
});
test('EQ02 owner/alive/aim/stun/guard and terminal recovery reject without resource changes',()=>{
 for(const bad of ['dead','aim','stun','guard','recovery','owner']){const {s,h}=fixture();if(bad==='dead')h.life='respawning';if(bad==='aim')s.explorationControl!.aim={kind:'path'} as any;if(bad==='stun')h.stagger=1;if(bad==='guard')command(s,{type:'hunterInput',id:h.id,kind:'guard'});if(bad==='recovery')h.hunterCombat!.finalRecoveryUntil=s.time+1;if(bad==='owner')h.equipment!.equipped.right.ownerId='ranger';const before=structuredClone(h);expect(switchTo(s,h,'II').ok,bad).toBe(false);expect(h).toEqual(before);}
});
test('EQ02 same world unload/continue and death/revive preserve II, fresh world defaults I',()=>{
 const {s,h,al,e}=fixture();switchTo(s,h,'II');resolveHit(s,h,{...e.weapons[0],subtype:'impact'},99999,e);step(s,10.01);expect((h.equipment!.equipped.right as any).currentForm).toBe('II');s.units=s.units.filter(u=>u.team==='ally');s.context='explorationIdle';h.pos={...s.goal};al.pos={...s.goal};const right=h.equipment!.equipped.right,w=s.world!;expect(command(s,{type:'exitExploration'}).ok).toBe(true);step(s,100);expect(command(s,{type:'continueWorld',worldId:w.id,visit:w.visit.generation}).ok).toBe(true);expect(h.equipment!.equipped.right).toBe(right);expect((right as any).currentForm).toBe('II');expect((fixture().h.equipment!.equipped.right as any).currentForm).toBe('I');
});
import {querySwitchMainForm} from '../src/core/main-form';
import {alState} from '../src/core/al-state';
import {advanceBasicAction} from '../src/core/basic-runtime';
test.each(['hunter','ranger'])('EQ02 %s actual two-stage chain pays once each and cannot bypass terminal gate by C',id=>{
 const {s,h,al}=fixture(),u=id==='hunter'?h:al;command(s,{type:'controlBody',id:u.id});alState(al);switchTo(s,u,'II');const n=u.id==='hunter'?h.hunterCombat!:al.alCombat!,before=u.stamina!.lastAcceptedId;
 requestBasic(s,u,{x:13,y:10},200);const first=u.basicAction!,original=BASIC_DEFINITIONS[u.basicProfileId!];expect(first.releaseAt).toBe(original.stages[u.id==='hunter'?2:1].releaseAt);expect(first.attackReadyAt).toBeGreaterThan(original.stages[u.id==='hunter'?2:1].attackReadyAt as number);const paid=u.stamina!.lastAcceptedId;
 expect(requestBasic(s,u,{x:13,y:10},200).ok).toBe(false);expect(u.stamina!.lastAcceptedId).toBe(paid);expect(paid).toBe(before+1);advanceBasicAction(s,u,first.attackReadyAt,()=>{});requestBasic(s,u,{x:13,y:10},201);expect(u.basicAction!.stageIndex).toBe(1);expect(u.stamina!.lastAcceptedId).toBe(before+2);advanceBasicAction(s,u,u.basicAction!.releaseAt,()=>{});expect(n.finalRecoveryUntil).toBeCloseTo(u.basicAction!.acceptedAt+u.basicAction!.finishAt+.4);expect(switchTo(s,u,'I').ok).toBe(false);
});
test.each(['hunter','ranger'])('EQ02 %s range/posture differ, wall prevents any hit; query is pure and trace-off still executes',id=>{
 const {s,h,al,e}=fixture(),u=id==='hunter'?h:al;command(s,{type:'controlBody',id:u.id});const copy=structuredClone(u);querySwitchMainForm(s,u,'II');expect(u).toEqual(copy);const normal=resolveBasicDefinition(u);switchTo(s,u,'II');const heavy=resolveBasicDefinition(u);expect(heavy.stages).toHaveLength(2);expect(normal.stages).toHaveLength(id==='hunter'?4:3);e.hp=150;e.pos={x:12,y:10};s.tiles.find(t=>t.x===11&&t.y===10)!.obstacle=true;s.combatIdentity!.enabled=false;requestBasic(s,u,e.pos,400);const a=u.basicAction!;expect(a.weaponSnapshot.postureDamage).toBeCloseTo((u.equipment!.equipped.right.weapon.postureDamage??0)*1.35);step(s,.18);expect(e.hp).toBe(150);
});
test('EQ02 Al Release reads accepted I stage and weapon even form/weapon replaced; no duplicate Release',()=>{
 const {s,al,e}=fixture();command(s,{type:'controlBody',id:al.id});e.hp=150;e.pos={x:11.5,y:10};requestBasic(s,al,e.pos,100);const a=al.basicAction!,weapon=a.weaponSnapshot;al.equipment!.equipped.right.currentForm='II';al.equipment!.equipped.right.weapon={...weapon,postureDamage:999};step(s,.05);step(s,.05);expect(e.hp).toBe(135);const rows=s.combatIdentity!.trace.filter(r=>r.type==='attack-released'&&r.context?.actionId===a.combatContext?.actionId);expect(rows).toHaveLength(1);expect(rows[0].attack!.formId).toBe('I');expect(s.combatIdentity!.trace.find(r=>r.type==='hit-outcome'&&r.context?.actionId===a.combatContext?.actionId)!.outcome!.postureApplied).toBe(weapon.postureDamage);
});
test('EQ02 C before bomb Release rejects atomically; after Release can switch without cancelling source entity',()=>{
 const {s,h}=fixture(),bomb=h.equipment!.owned[1];command(s,{type:'equipOffhand',id:h.id,instanceId:bomb.id});command(s,{type:'offhandInput',id:h.id,held:true,aim:{x:12,y:10}});const before=structuredClone(h);expect(switchTo(s,h,'II').ok).toBe(false);expect(h).toEqual(before);step(s,.06);const entity=h.offhand!.entities[0],cd=bomb.cd;expect(switchTo(s,h,'II').ok).toBe(true);expect(h.offhand!.entities[0]).toBe(entity);expect(bomb.cd).toBe(cd);expect(bomb.durability).toBe(99);
});
test('EQ02 II cannot leak to a copied clone/foreign owner or legacy profile',()=>{
 const {s,h}=fixture();switchTo(s,h,'II');const clone=structuredClone(h);clone.id='copy';clone.cloneOf=h.id;expect(resolveBasicDefinition(clone)).toBe(BASIC_DEFINITIONS['hunter-v2']);expect(querySwitchMainForm(s,clone,'I').ok).toBe(false);h.basicProfileId='legacy-main-basic';expect(resolveBasicDefinition(h)).toBe(BASIC_DEFINITIONS['legacy-main-basic']);
});
