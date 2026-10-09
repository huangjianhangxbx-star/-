import {legacyEnemy,hazard} from './legacy-enemy-fixture';
import {test,expect} from 'vitest';
import {createGame,command,step} from '../src/core/engine';
import {cancelBasicAction,advanceBasicAction} from '../src/core/basic-runtime';
import {requestBasic} from '../src/core/basic-chain';
import {advanceCompanionCombat,nativeBasicTarget,nativeCombatDiagnostics} from '../src/core/companion-combat';
import {startIntent} from '../src/core/attack-intent';

function fixture(role='hunter',enemies=false){
 const s=createGame();command(s,{type:'selectJourney',journey:'exploration'});command(s,{type:'selectExplorationCompanion',id:'ranger'});command(s,{type:'carry',gold:0,vitality:0});
 const h=s.units.find(u=>u.id==='hunter')!,p=s.units.find(u=>u.id==='ranger')!,e=legacyEnemy(s,'melee');
 s.tiles.forEach(t=>{t.obstacle=false;t.layer=0;});s.units=[h,p];h.pos={x:14,y:10};p.pos={x:15,y:10};
 for(const u of [h,p]){u.ready=0;u.path=[];u.direct=undefined;u.hp=u.maxHp=10000;u.drawPos={...u.pos};}
 command(s,{type:'controlBody',id:role});const u=role==='hunter'?h:p;
 if(enemies){const b=structuredClone(e);e.id='a';b.id='b';e.pos={x:16.3,y:10};b.pos={x:15,y:11.5};
  for(const t of [e,b]){t.ready=999;t.hp=t.maxHp=100000;t.encounterRoom=1;t.enemyMotion='engaged';t.pursuitTargetId=h.id;t.reveal=999;t.drawPos={...t.pos};}
  s.units.push(e,b);s.context='explorationBattle';s.exploration!.definition.encounters=[{room:1,name:'test',tier:'strong',enemyIds:['a','b'],center:{x:15,y:10},tacticalRadius:6.5}];
 }
 return {s,u,h,p,e:s.units.find(t=>t.id==='a')!,b:s.units.find(t=>t.id==='b')!};
}
const trace=(u:ReturnType<typeof fixture>['u'])=>u.id==='hunter'?u.hunterCombat!.trace:u.alCombat!.trace;
const input=(s:ReturnType<typeof fixture>['s'],u:ReturnType<typeof fixture>['u'],held=true)=>command(s,{type:u.id==='hunter'?'hunterInput':'alInput',id:u.id,kind:'basic',held,aim:{x:30,y:10}});
const run=(s:ReturnType<typeof fixture>['s'],seconds:number,scale=1)=>{for(let i=0;i<Math.ceil(seconds/.01);i++)step(s,.01*scale,.01);};

test.each(['hunter','ranger'])('%s held terminal finishes before the next A1, plus .25 simulation seconds',role=>{
 const {s,u}=fixture(role);input(s,u);run(s,4);const rows=trace(u),last=role==='hunter'?3:2;
 const end=rows.find(r=>r.kind==='accepted'&&r.stage===last)!,finish=rows.find(r=>r.action===end.action&&r.kind==='Finish');
 const next=rows.find(r=>r.kind==='accepted'&&r.stage===0&&r.at>end.at)!;
 expect(finish).toBeDefined();expect(next.at-end.at).toBeGreaterThanOrEqual(role==='hunter'?1.0833:1.5167);
 expect(next.at-finish!.at).toBeGreaterThanOrEqual(.24);
});

test.each(['hunter','ranger'])('%s committed terminal cancellation and AI cannot bypass full recovery',role=>{
 const {s,u}=fixture(role);input(s,u);while(u.basicAction?.stageIndex!==(role==='hunter'?3:2)||!u.basicAction.released)step(s,.01);
 const accepted=u.basicAction.acceptedAt,deadline=accepted+(role==='hunter'?1.0833:1.5167);input(s,u,false);cancelBasicAction(s,u,'movement');
 command(s,{type:'controlBody',id:role==='hunter'?'ranger':'hunter'});
 expect(requestBasic(s,u,{x:30,y:10},s.nextId++,'companion-ai').ok).toBe(false);expect(u.basicAction).toBeUndefined();
 while(s.time<deadline-.02)step(s,.01);expect(u.basicAction).toBeUndefined();step(s,.03);
 expect(requestBasic(s,u,{x:30,y:10},s.nextId++,'companion-ai').ok).toBe(true);expect(u.basicAction?.stageIndex).toBe(0);
});

test.each(['hunter','ranger'])('%s released expired press is not replayed; death clears committed gate',role=>{
 const {s,u}=fixture(role);input(s,u);while(u.basicAction?.stageIndex!==(role==='hunter'?3:2)||!u.basicAction.released)step(s,.01);
 input(s,u,false);requestBasic(s,u,{x:30,y:10},s.nextId++);run(s,2);expect(trace(u).filter(r=>r.kind==='accepted'&&r.stage===0)).toHaveLength(1);
 u.life='downed';step(s,.01);expect((u.id==='hunter'?u.hunterCombat:u.alCombat)!.finalRecoveryUntil).toBe(0);
});

test.each(['hunter','ranger'])('%s true pre-Hit terminal cancel has no full-chain penalty',role=>{
 const {s,u}=fixture(role);input(s,u);while(u.basicAction?.stageIndex!==(role==='hunter'?3:2))step(s,.01);
 input(s,u,false);expect(u.basicAction!.released).toBe(false);cancelBasicAction(s,u,'movement');
 expect(requestBasic(s,u,{x:30,y:10},s.nextId++).ok).toBe(true);expect(u.basicAction?.stageIndex).toBe(0);
});

test.each([.1,1,2])('simulation recovery survives paused wall time and scale %s',scale=>{
 const {s,u}=fixture();input(s,u);while(u.basicAction?.stageIndex!==3||!u.basicAction.released)step(s,.01*scale,.01);
 input(s,u,false);cancelBasicAction(s,u,'movement');const gate=u.hunterCombat!.finalRecoveryUntil;
 const before=s.time;step(s,0,2);expect(s.time).toBe(before);expect(u.hunterCombat!.finalRecoveryUntil).toBe(gate);
 while(s.time<gate-.03)step(s,.001*scale,.001);expect(requestBasic(s,u,{x:30,y:10},s.nextId++).ok).toBe(true);expect(u.basicAction).toBeUndefined();
 while(s.time<gate+.01)step(s,.001*scale,.001);expect(requestBasic(s,u,{x:30,y:10},s.nextId++).ok).toBe(true);
});

test('target commitment retains ordinary A despite distance jitter and does not silently hit nearer B',()=>{
 const {s,h,p,e,b}=fixture('hunter',true);advanceCompanionCombat(s);const chosen=p.companionCombat!.targetId!;const target=chosen==='a'?e:b,other=chosen==='a'?b:e;
 p.pos={x:15,y:10};p.path=[];p.destination=null;p.companionCombat!.moving=false;target.pos={x:16.5,y:10};other.pos={x:15,y:11.1};
 s.time=.4;advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(chosen);p.path=[];p.destination=null;step(s,.01);
 expect(p.basicAction?.targetId).toBe(chosen);expect(p.basicAction?.angle).toBeCloseTo(0);expect(h.basicAction).toBeUndefined();
});

test.each(['hunter','ranger'])('G focus is the actual native %s AI Basic target even when another enemy is nearer',role=>{
 const {s,h,p,e,b}=fixture(role==='hunter'?'ranger':'hunter',true),u=role==='hunter'?h:p;
 h.pos={x:15,y:10};p.pos={x:15,y:9};e.pos={x:16.4,y:u.pos.y};b.pos={x:15,y:u.pos.y+1.1};
 expect(command(s,{type:'partyTactic',issuerId:s.controlledBodyId!,recipientId:u.id,kind:'focus',targetId:e.id,requestId:100,expectedControlRevision:s.controlRevision??0}).ok).toBe(true);
 advanceCompanionCombat(s);u.path=[];u.destination=null;step(s,.01);expect(u.basicAction?.targetId).toBe(e.id);expect(u.basicAction?.angle).toBeCloseTo(0);
});

test('rank advantage must persist after finite commitment; dead and Return targets invalidate immediately',()=>{
 const {s,h,p,e,b}=fixture('hunter',true);advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(e.id);
 const started=p.companionCombat!.targetCommittedAt;b.pursuitTargetId=p.id;e.pursuitTargetId=undefined;e.engagement={targetId:h.id} as any;
 s.time=1;advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(e.id);expect(p.companionCombat!.targetCommittedAt).toBe(started);
 s.time=1.6;advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(e.id);
 s.time=1.8;advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(e.id);
 s.time=2;advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(b.id);expect(p.companionCombat!.switchReason).toBe('sustained-rank-advantage');
 b.enemyMotion='return';s.time=2.01;advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(e.id);expect(p.companionCombat!.switchReason).toBe('target-return');
 e.life='dead';s.time=2.02;advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBeUndefined();expect(nativeBasicTarget(s,p)).toBeUndefined();
});

test.each(['hunter','ranger'])('%s near-gate buffered direction is valid, bounded, and cannot cross control ownership',role=>{
 const {s,u}=fixture(role);input(s,u);while(u.basicAction?.stageIndex!==(role==='hunter'?3:2)||!u.basicAction.released)step(s,.01);
 input(s,u,false);cancelBasicAction(s,u,'movement');const h=(role==='hunter'?u.hunterCombat:u.alCombat)!;
 while(s.time<h.finalRecoveryUntil-.15)step(s,.01);const edge=h.edgeUntil;
 expect(requestBasic(s,u,{x:NaN,y:10},s.nextId++).ok).toBe(false);expect(h.edgeUntil).toBe(edge);
 const id=s.nextId++;requestBasic(s,u,{x:u.pos.x,y:u.pos.y+10},id);const buffered=h.edgeUntil;
 expect(requestBasic(s,u,{x:30,y:10},id).ok).toBe(false);expect(h.edgeUntil).toBe(buffered);
 run(s,.17);expect(u.basicAction?.angle).toBeCloseTo(Math.PI/2);expect(trace(u).filter(r=>r.kind==='accepted'&&r.stage===0)).toHaveLength(2);
});

test('legacy courtyard terminal Hit has no new standalone full-chain gate',()=>{
 const {s,u}=fixture();input(s,u);while(u.basicAction?.stageIndex!==3)step(s,.01);
 input(s,u,false);s.exploration!.definition.kind=undefined;const before=u.hunterCombat!.finalRecoveryUntil;
 advanceBasicAction(s,u,.2,()=>{});expect(u.basicAction?.released).toBe(true);expect(u.hunterCombat!.finalRecoveryUntil).toBe(before);
});

test('far preparation cannot bypass commitment, but imminent known area on DirectActor can',()=>{
 const {s,h,p,e,b}=fixture('hunter',true);advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(e.id);
 b.pos={x:h.pos.x+1,y:h.pos.y};expect(hazard(s,b,h)).toBe(true);b.pos={x:15,y:13};b.attackIntent!.area={kind:'circle',center:{x:15,y:13},radius:1};
 s.time=.4;advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(e.id);
 b.attackIntent!.area={kind:'circle',center:{...h.pos},radius:.4};b.attackIntent!.resolveAt=.65;s.time=.61;
 advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(b.id);expect(p.companionCombat!.switchReason).toBe('imminent-known-threat');
});

test('out-of-domain and occluded/unreachable targets hold briefly, never silently attack nearest',()=>{
 const {s,h,p,e,b}=fixture('hunter',true);advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(e.id);
 e.pos={x:30,y:30};s.time=.4;advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(e.id);expect(nativeBasicTarget(s,p)).toBeUndefined();
 s.time=2.5;advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(b.id);expect(p.companionCombat!.switchReason).toBe('unreachable-timeout');
 b.encounterRoom=99;s.time=2.51;advanceCompanionCombat(s);expect(p.companionCombat!.targetId).not.toBe(b.id);
});

test('a lower ordinary rank cannot hide an imminent known hazard on DirectActor',()=>{
 const {s,h,p,e,b}=fixture('hunter',true);advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(e.id);
 b.pos={x:h.pos.x+1,y:h.pos.y};expect(hazard(s,b,h)).toBe(true);
 b.pursuitTargetId=undefined;b.engagement={targetId:h.id} as any;b.attackIntent!.targetId=undefined as any;
 b.attackIntent!.area={kind:'circle',center:{...h.pos},radius:.4};b.attackIntent!.resolveAt=.65;s.time=.61;
 advanceCompanionCombat(s);expect(p.companionCombat!.targetId).toBe(b.id);expect(p.companionCombat!.switchReason).toBe('imminent-known-threat');
});

test('closed-panel diagnostics do not mutate world, clocks, commitment or RNG',()=>{
 const {s,p}=fixture('hunter',true);advanceCompanionCombat(s);const before=JSON.stringify(s);
 for(let i=0;i<50;i++){const r=nativeCombatDiagnostics(s,p);expect(r.decisionTargetId).toBe(p.companionCombat!.targetId);}
 expect(JSON.stringify(s)).toBe(before);
});
