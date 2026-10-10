import {test,expect} from 'vitest';
import {setup} from './en01-fixture';
import {createExplorationEntry,command,step} from '../src/core/engine';
import {queryActionStamina,spendAcceptedAction,initializeStamina,tickStamina} from '../src/core/stamina';
import {requestBasic} from '../src/core/basic-chain';
import {hunterState,cancelHunterSpecial} from '../src/core/hunter-state';
import {alState} from '../src/core/al-state';
import {cancelAl} from '../src/core/al-combat';
import {cancelBasicAction} from '../src/core/basic-runtime';
import {configureCombatTrace} from '../src/core/combat-identity';
import {useCampfire} from '../src/core/campfire';
import {skillState} from '../src/core/progression';
import type {GameState} from '../src/core/types';
function fixture(){const x=setup();x.s.sessionMode='exploration';x.s.units=x.s.units.filter(u=>u.team==='ally');initializeStamina(x.s);return x;}
const aim={x:15,y:10};
test('official world initializes only two real bodies; query is read-only and repeated acceptance pays once',()=>{
 const s=createExplorationEntry();command(s,{type:'carry',gold:0,vitality:0});
 expect(s.units.filter(u=>u.stamina).map(u=>u.id).sort()).toEqual(['hunter','ranger']);
 const h=s.units.find(u=>u.id==='hunter')!;const before=JSON.stringify(h.stamina);expect(queryActionStamina(s,h,'basic').ok).toBe(true);expect(JSON.stringify(h.stamina)).toBe(before);
 spendAcceptedAction(s,h,'basic',1);spendAcceptedAction(s,h,'basic',1);expect(h.stamina!.current).toBe(90);
});
test('recovery obeys exact simulation delay, cap, freeze and slow dt rather than real dt',()=>{
 const {s,h}=fixture();spendAcceptedAction(s,h,'active',1);s.time=.4;tickStamina(s,h,.4);expect(h.stamina!.current).toBe(72);s.time=.6;tickStamina(s,h,.2);expect(h.stamina!.current).toBeCloseTo(74);
 s.phase='world';step(s,9);expect(h.stamina!.current).toBeCloseTo(74);s.phase='battle';step(s,.1,1);expect(h.stamina!.current).toBeCloseTo(76);step(s,4);expect(h.stamina!.current).toBe(100);
});
test('Basic buffer, duplicate and Finish do not pay; next actual Accept pays, insufficient cannot change stage',()=>{
 const {s,h}=fixture();expect(requestBasic(s,h,aim,1).ok).toBe(true);expect(h.stamina!.current).toBe(90);expect(requestBasic(s,h,aim,2).ok).toBe(true);expect(h.stamina!.current).toBe(90);expect(requestBasic(s,h,aim,2).ok).toBe(false);
 command(s,{type:'hunterInput',id:h.id,kind:'basic',held:false});step(s,.35);expect(h.stamina!.current).toBe(80);expect(h.stamina!.nextAcceptedId).toBe(3);step(s,.25);
 h.stamina!.current=9;const stage=h.hunterCombat!.nextStage,a=h.basicAction;expect(requestBasic(s,h,aim,3).ok).toBe(false);expect(h.hunterCombat!.nextStage).toBe(stage);expect(h.basicAction).toBe(a);expect(h.stamina!.current).toBe(9);
});
test('guard pays enter and simulation drain, repeated held cannot reenter exhaustion until release',()=>{
 const {s,h}=fixture();expect(command(s,{type:'hunterInput',id:h.id,kind:'guard',held:true,aim}).ok).toBe(true);expect(h.stamina!.current).toBe(92);step(s,1);expect(h.stamina!.current).toBeCloseTo(86);
 h.stamina!.current=.03;step(s,.01);expect(h.stamina!.current).toBe(0);expect(h.hunterCombat!.special).toBeUndefined();step(s,1);const amount=h.stamina!.current;
 const logs=s.log.length;for(let i=0;i<30;i++)expect(command(s,{type:'hunterInput',id:h.id,kind:'guard',held:true}).ok).toBe(false);expect(h.stamina!.current).toBe(amount);expect(s.log.length-logs).toBeLessThanOrEqual(1);expect(s.notice).toContain('体力');
 command(s,{type:'hunterInput',id:h.id,kind:'guard',held:false});expect(command(s,{type:'hunterInput',id:h.id,kind:'guard',held:true,aim}).ok).toBe(true);
});
test('dodge and active insufficient preserve golden charges, CD, action and motion; accepted cancel never refunds',()=>{
 const {s,h}=fixture(),hs=hunterState(h);h.stamina!.current=21;const before=[hs.dodgeCharges,hs.activeCharge,hs.mp];expect(command(s,{type:'hunterInput',id:h.id,kind:'dodge'}).ok).toBe(false);expect(hs.motion).toBeUndefined();expect([hs.dodgeCharges,hs.activeCharge,hs.mp]).toEqual(before);
 h.stamina!.current=27;expect(command(s,{type:'hunterInput',id:h.id,kind:'active'}).ok).toBe(false);expect(hs.special).toBeUndefined();h.stamina!.current=100;expect(command(s,{type:'hunterInput',id:h.id,kind:'active',aim}).ok).toBe(true);expect(h.stamina!.current).toBe(72);command(s,{type:'hunterInput',id:h.id,kind:'active',held:false});step(s,.45);expect(h.stamina!.current).toBe(72);cancelHunterSpecial(s,h,'test-cancel');expect(h.stamina!.current).toBe(72);
});
test('Al four Accept payments retain .0333 Hit ammo clock and reload; cancelled before Hit has no ammo payment or stamina refund',()=>{
 const {s,al}=fixture();s.controlledBodyId=al.id;const a=alState(al);command(s,{type:'alInput',id:al.id,kind:'shot',aim});expect(al.stamina!.current).toBe(85);expect(a.ammo).toBe(4);step(s,.02);expect(a.ammo).toBe(4);step(s,.02);expect(a.ammo).toBe(3);command(s,{type:'alInput',id:al.id,kind:'shot',held:false});
 for(let i=0;i<3;i++){step(s,.54);expect(command(s,{type:'alInput',id:al.id,kind:'shot',aim}).ok).toBe(true);command(s,{type:'alInput',id:al.id,kind:'shot',held:false});step(s,.04);}expect(a.ammo).toBe(0);expect(al.stamina!.nextAcceptedId).toBe(5);step(s,1.5);expect(a.ammo).toBe(4);
 command(s,{type:'alInput',id:al.id,kind:'shot',aim});const paid=al.stamina!.current;cancelAl(s,al,'cancel');command(s,{type:'alInput',id:al.id,kind:'shot',held:false});expect(a.ammo).toBe(4);expect(al.stamina!.current).toBe(paid);
});
test('Al roll / rocket share stamina gates but retain CD/Hit cost and derived explosion is free',()=>{
 const {s,al}=fixture();s.controlledBodyId=al.id;const a=alState(al);al.stamina!.current=21;expect(command(s,{type:'alInput',id:al.id,kind:'roll'}).ok).toBe(false);expect(a.rollCd).toBe(0);expect(a.motion).toBeUndefined();al.stamina!.current=100;
 expect(command(s,{type:'alInput',id:al.id,kind:'rocket',aim}).ok).toBe(true);expect(al.stamina!.current).toBe(72);expect(a.rocketCd).toBe(0);step(s,.11);expect(a.rocketCd).toBeGreaterThan(5.9);step(s,.4);expect(al.stamina!.current).toBe(72);expect(al.stamina!.nextAcceptedId).toBe(2);expect(a.trace.some(t=>t.kind==='land')).toBe(true);
});
test('AI and order-auto Basic use same authority; zero stamina cannot start an attack',()=>{
 const {s,h,al}=fixture();s.controlledBodyId=h.id;expect(requestBasic(s,al,aim,1,'companion-ai').ok).toBe(true);expect(al.stamina!.current).toBe(90);cancelBasicAction(s,al,'test');alState(al).nextStage=0;al.stamina!.current=0;expect(requestBasic(s,al,aim,2,'order-auto').ok).toBe(false);expect(al.basicAction).toBeUndefined();expect(h.stamina!.current).toBe(100);
});
test('F/G/Z and free movement neither exchange nor reset independent values',()=>{
 const {s,h,al}=fixture();h.stamina!.current=31;al.stamina!.current=67;command(s,{type:'direct',id:h.id,direction:{x:0,y:1}});command(s,{type:'direct',id:h.id,direction:null});
 // Use the same public swap command as Z, without invoking another world's reset.
 for(let i=0;i<4;i++)expect(command(s,{type:'controlBody',id:i%2===0?al.id:h.id}).ok).toBe(true);expect([h.stamina!.current,al.stamina!.current]).toEqual([31,67]);
 expect(command(s,{type:'partyTactic',issuerId:h.id,recipientId:al.id,kind:'free',requestId:1,expectedControlRevision:s.controlRevision??0}).ok).toBe(true);
 expect(command(s,{type:'beginExplorationAim',id:h.id,kind:'path',source:'direct'}).ok).toBe(true);expect(command(s,{type:'cancelExplorationAim'}).ok).toBe(true);expect([h.stamina!.current,al.stamina!.current]).toEqual([31,67]);
});
test('same world unload/continue retains resource and acceptance history; new test world rebuilds',()=>{
 const s=createExplorationEntry();command(s,{type:'carry',gold:0,vitality:0});const h=s.units.find(u=>u.id==='hunter')!;spendAcceptedAction(s,h,'active',1);
 for(const u of s.units.filter(u=>u.team==='ally'&&u.life==='active'))u.pos={...s.goal,x:s.goal.x+(u.id==='hunter'?0:.8)};s.context='explorationIdle';expect(command(s,{type:'exitExploration'}).ok).toBe(true);step(s,20);expect(h.stamina!.current).toBe(72);expect(command(s,{type:'continueWorld',worldId:s.world!.id,visit:s.world!.visit.generation}).ok).toBe(true);spendAcceptedAction(s,h,'active',1);expect(h.stamina!.current).toBe(72);
 expect(command(s,{type:'restartWorld',worldId:s.world!.id}).ok).toBe(true);command(s,{type:'carry',gold:0,vitality:0});expect(s.units.find(u=>u.id==='hunter')!.stamina!.current).toBe(100);
});
test('only valid first campfire restores stamina; duplicate or unsafe transaction gives no benefit',()=>{
 const {s,h}=fixture();const p=s.exploration!.definition.points.find(p=>p.kind==='campfire')!;h.pos={...p.pos};s.context='explorationIdle';h.stamina!.current=18;expect(useCampfire(s,p).ok).toBe(true);expect(h.stamina!.current).toBe(100);h.stamina!.current=18;expect(useCampfire(s,p).ok).toBe(false);expect(h.stamina!.current).toBe(18);
});
test('legacy/independent Lab/enemy/clone never receive stamina; trace-off payment equals trace-on',()=>{
 const run=(enabled:boolean)=>{const {s,h}=fixture();configureCombatTrace(s,enabled);command(s,{type:'hunterInput',id:h.id,kind:'dodge'});return h.stamina;};expect(run(false)).toEqual(run(true));
 const {s,h}=setup();initializeStamina(s);expect(h.stamina).toBeUndefined();spendAcceptedAction(s,h,'basic',1);expect(h.stamina).toBeUndefined();
 const x=setup();x.s.sessionMode='exploration';const clone={...structuredClone(x.h),id:'clone-test',cloneOf:x.h.id};x.s.units.push(clone);initializeStamina(x.s);expect(x.e.stamina).toBeUndefined();expect(clone.stamina).toBeUndefined();spendAcceptedAction(x.s,x.e,'basic',1);spendAcceptedAction(x.s,clone,'basic',1);expect(x.e.stamina).toBeUndefined();expect(clone.stamina).toBeUndefined();
 const isolated=setup();isolated.s.sessionMode='exploration';isolated.s.xxExperiment=true;initializeStamina(isolated.s);expect(isolated.h.stamina).toBeUndefined();
});
test('invalid numeric state cannot grant action; epsilon and recovery always stay within max',()=>{
 const {s,h}=fixture();h.stamina!.current=NaN;expect(queryActionStamina(s,h,'basic').ok).toBe(false);s.time=1;tickStamina(s,h,.1);expect(Number.isFinite(h.stamina!.current)).toBe(true);h.stamina!.current=10-1e-9;expect(spendAcceptedAction(s,h,'basic',1).ok).toBe(true);expect(h.stamina!.current).toBe(0);h.stamina!.current=150;tickStamina(s,h,.1);expect(h.stamina!.current).toBe(100);
});
test('unsafe campfire and downed requests never restore/spend resource',()=>{
 const {s,h}=fixture();h.stamina!.current=18;s.context='explorationBattle';const p=s.exploration!.definition.points.find(p=>p.kind==='campfire')!;expect(useCampfire(s,p).ok).toBe(false);expect(h.stamina!.current).toBe(18);h.life='downed';expect(command(s,{type:'hunterInput',id:h.id,kind:'guard',aim}).ok).toBe(false);expect(h.stamina!.current).toBe(18);
});
