// AR05: this frozen historical suite verifies the retained pre-Blue branch.

vi.mock('../src/core/hunter-state',async importActual=>({...await importActual<object>(),isHunterV2:()=>false}));
import {beforeEach,vi} from 'vitest';
import * as definitions from '../src/core/basic-definition';
const currentResolver=definitions.resolveBasicDefinition;
// Frozen AR02/AR03 contract regression explicitly exercises the retained legacy definition.
beforeEach(()=>{vi.spyOn(definitions,'resolveBasicDefinition').mockImplementation(u=>{const d=currentResolver(u);return d.id==='hunter-basic-v1'?definitions.BASIC_DEFINITIONS['legacy-main-basic']:d;});});
import {expect,test} from 'vitest';
import {arena} from './ar02-fixture';
import {command,step,resolveHit} from '../src/core/engine';
import {requestBasic,advanceBasicInputs} from '../src/core/basic-chain';
import {combatTraceSnapshot,configureCombatTrace} from '../src/core/combat-identity';
import {skillState} from '../src/core/progression';
import {sniper,tickEchoes} from '../src/core/skill-execution';
import {startIntent} from '../src/core/attack-intent';
import {projection} from './ar02-fixture';

test('rejected/buffered requests cannot become actions until the original Basic starts',()=>{
 const {s,h,e}=arena();configureCombatTrace(s,true);
 expect(requestBasic(s,h,{x:NaN,y:10},1).ok).toBe(false);
 expect(combatTraceSnapshot(s).filter(r=>r.type==='action-started')).toHaveLength(0);
 requestBasic(s,h,e.pos,2);const starts=()=>combatTraceSnapshot(s).filter(r=>r.type==='action-started');expect(starts()).toHaveLength(1);
 expect(requestBasic(s,h,e.pos,2).ok).toBe(false);expect(starts()).toHaveLength(1);
 h.attackPending=undefined;h.attackTimer=0;s.time=h.basicChain!.nextStageAllowedAt-.05;
 requestBasic(s,h,e.pos,3);expect(starts()).toHaveLength(1);expect(combatTraceSnapshot(s).some(r=>r.type==='request-buffered')).toBe(true);
 s.time=h.basicChain!.nextStageAllowedAt;advanceBasicInputs(s);advanceBasicInputs(s);
 expect(starts()).toHaveLength(2);expect(starts().at(-1)!.context!.requestId).toBe(3);
});

test.each(['player-input','companion-ai','order-auto'] as const)('%s requester remains separate from actor identity',source=>{
 const {s,h,p,e}=arena();configureCombatTrace(s,true);const actor=source==='player-input'?h:p;actor.pos={x:15,y:10};
 expect(requestBasic(s,actor,e.pos,44,source).ok).toBe(true);
 const context=combatTraceSnapshot(s).find(r=>r.type==='action-started')!.context!;
 expect(context.actorId).toBe(actor.id);expect(context.requestSource).toBe(source);expect(context.requestId).toBe(44);
});

test('whiff releases one attack opportunity without fabricated hit, cost or original release statistics',()=>{
 const {s,h}=arena();s.units=s.units.filter(u=>u.team==='ally');configureCombatTrace(s,true);
 const durability=h.weapons[0].durability;command(s,{type:'basic',id:h.id,aim:{x:16,y:10},requestId:3});step(s,.3);
 const trace=combatTraceSnapshot(s);expect(trace.filter(r=>r.type==='attack-released'&&r.context?.actorId===h.id)).toHaveLength(1);
 expect(trace.filter(r=>r.type==='hit-outcome')).toHaveLength(0);expect(h.weapons[0].durability).toBe(durability);expect(s.stats.basicAttacksReleased||0).toBe(0);
});

test('HP0 accepted contact preserves actual posture while duplicate eventId is still rejected',()=>{
 const {s,h,e}=arena();configureCombatTrace(s,true);e.statuses.push({kind:'guard',power:1,remaining:10});
 expect(resolveHit(s,e,h.weapons[0],100,h,{eventId:779,castId:55,postureDamage:10})).toBe(true);
 expect(resolveHit(s,e,h.weapons[0],100,h,{eventId:779,castId:55,postureDamage:10})).toBe(false);
 const out=combatTraceSnapshot(s).filter(r=>r.type==='hit-outcome').map(r=>r.outcome!);
 expect(out[0]).toMatchObject({resolveAccepted:true,hpLost:0,postureApplied:10,legacyEventId:779,legacyCastId:55});
 expect(out[1]).toMatchObject({resolveAccepted:false,hpLost:0,postureApplied:0});
});

test('ordinary attack pulse keeps one event for multiple targets and a named skill/slot',()=>{
 const {s,h}=arena('bell');configureCombatTrace(s,true);command(s,{type:'skill',id:h.id,slot:0});step(s,1.1);
 const events=combatTraceSnapshot(s).filter(r=>r.type==='attack-released'&&r.context?.executedAbilityId==='bell');expect(events).toHaveLength(1);
 const hits=combatTraceSnapshot(s).filter(r=>r.type==='hit-outcome'&&r.outcome?.attackEventId===events[0].attack!.attackEventId);
 expect(hits.length).toBeGreaterThanOrEqual(2);expect(events[0].context).toMatchObject({slot:0,slotSkillId:'bell',executedAbilityId:'bell',requestSource:'player-input'});
});

test.each(['prayer','pain','sanctuary','poison','snipe'] as const)('%s support/mode acceptance does not fabricate an attack',skill=>{
 const {s,h}=arena(skill);s.units=s.units.filter(u=>u.team==='ally');configureCombatTrace(s,true);command(s,{type:'skill',id:h.id,slot:0});step(s,1.1);
 expect(combatTraceSnapshot(s).some(r=>r.type==='action-started'&&r.context?.executedAbilityId===skill)).toBe(true);
 expect(combatTraceSnapshot(s).some(r=>r.type==='attack-released')).toBe(false);
});

test('new worlds are isolated, snapshots cannot mutate trace, and long combat stays bounded',()=>{
 const a=arena(),b=arena();configureCombatTrace(a.s,true);configureCombatTrace(b.s,true);
 for(let i=0;i<700;i++)resolveHit(a.s,a.e,a.h.weapons[0],0,a.h,{eventId:8000+i});
 const trace=combatTraceSnapshot(a.s);expect(trace.length).toBeLessThanOrEqual(512);expect(trace.length).toBeGreaterThan(0);
 trace.length=0;expect(combatTraceSnapshot(a.s).length).toBeGreaterThan(0);expect(combatTraceSnapshot(b.s)).toEqual([]);
});

test('committed Basic survives DirectActor switch; moving cancels only its own pending action',()=>{
 const {s,h,p,e}=arena();configureCombatTrace(s,true);requestBasic(s,h,e.pos,1);
 const first=h.attackPending!.combatContext!;command(s,{type:'controlBody',id:p.id});step(s,.3);
 expect(combatTraceSnapshot(s).filter(r=>r.type==='attack-released'&&r.context?.actionId===first.actionId)).toHaveLength(1);
 expect(combatTraceSnapshot(s).some(r=>r.type==='action-cancelled'&&r.context?.actionId===first.actionId)).toBe(false);
 command(s,{type:'controlBody',id:h.id});h.attackTimer=0;h.basicChain=undefined;requestBasic(s,h,e.pos,2);
 const second=h.attackPending!.combatContext!;expect(command(s,{type:'direct',id:h.id,direction:{x:0,y:1}}).ok).toBe(true);step(s,.3);
 expect(combatTraceSnapshot(s).filter(r=>r.type==='action-cancelled'&&r.context?.actionId===second.actionId)).toHaveLength(1);
 expect(combatTraceSnapshot(s).some(r=>r.type==='attack-released'&&r.context?.actionId===second.actionId)).toBe(false);
});

test('delayed sniper Echo keeps its own event and frozen actor/root/parent after switching and death',()=>{
 const {s,h,p,e}=arena('snipe');configureCombatTrace(s,true);sniper(s,h,e,5,{hit:resolveHit});
 const echo=s.skillEffects!.find(e=>e.kind==='snipeEcho')!,parent=combatTraceSnapshot(s).find(r=>r.type==='action-started'&&r.context?.kind==='skill')!.context!;
 expect(echo.combatContext).toMatchObject({actorId:h.id,parentActionId:parent.actionId,rootActionId:parent.rootActionId,legacyCastId:echo.castId});
 command(s,{type:'controlBody',id:p.id});h.life='dead';s.time=echo.at;tickEchoes(s,{hit:resolveHit});
 const release=combatTraceSnapshot(s).find(r=>r.type==='attack-released'&&r.attack?.entityId===echo.id)!;
 expect(release.context?.actorId).toBe(h.id);expect(release.context?.parentActionId).toBe(parent.actionId);
 expect(s.skillEffects?.some(e=>e.id===echo.id)).toBe(false);
});

test('sweep derived nodes are children of the Basic opportunity; no old cast IDs become global gates',()=>{
 const {s,h,e}=arena('dance');configureCombatTrace(s,true);requestBasic(s,h,e.pos,7);step(s,.3);
 const trace=combatTraceSnapshot(s),basic=trace.find(r=>r.type==='action-started'&&r.context?.kind==='basic')!.context!;
 const sweep=trace.find(r=>r.type==='action-started'&&r.context?.executedAbilityId==='dance'&&r.context.kind==='skill')!.context!;
 expect(sweep).toMatchObject({parentActionId:basic.actionId,rootActionId:basic.rootActionId});
 const child=s.skillEffects!.find(e=>e.kind==='backslash')!;expect(child.combatContext?.parentActionId).toBe(sweep.actionId);
 const hits=trace.filter(r=>r.type==='hit-outcome'&&r.outcome?.actionId===sweep.actionId);expect(hits.length).toBeGreaterThan(0);
 expect(new Set(hits.map(r=>r.outcome?.legacyEventId)).size).toBe(hits.length);
});

test('lethal reset cannot disguise the actual posture application; unattributed hits stay explicit',()=>{
 const {s,h,e,f}=arena();configureCombatTrace(s,true);e.hp=1;e.posture=100;
 resolveHit(s,e,h.weapons[0],10000,h,{postureDamage:9});
 const lethal=combatTraceSnapshot(s).filter(r=>r.type==='hit-outcome').at(-1)!.outcome!;
 expect(lethal).toMatchObject({postureApplied:9,lifeBefore:'active',lifeAfter:'dead',hpLost:1,attribution:'legacy'});
 expect(lethal.postureAfter).toBe(e.maxPosture);
 resolveHit(s,f,h.weapons[0],0,undefined);expect(combatTraceSnapshot(s).at(-1)!.outcome!.attribution).toBe('unattributed');
});

test('old avoidance consumes explicit event ID before returning false, with zero loss',()=>{
 const {s,h,p,e}=arena();configureCombatTrace(s,true);p.evasion={charges:1,progress:0,action:{from:{...p.pos},to:{...p.pos},startedAt:s.time,layer:0}};
 expect(resolveHit(s,p,e.weapons[0],50,e,{eventId:91})).toBe(false);p.evasion.action=undefined;
 expect(resolveHit(s,p,e.weapons[0],50,e,{eventId:91})).toBe(false);
 expect(combatTraceSnapshot(s).filter(r=>r.type==='hit-outcome').map(r=>[r.outcome!.resolveAccepted,r.outcome!.hpLost,r.outcome!.postureApplied])).toEqual([[false,0,0],[false,0,0]]);
 expect(h.hp).toBe(h.maxHp);
});

test('enemy accepted telegraph is enemy-ai and resolves through its own attack event',()=>{
 const {s,h,e}=arena();configureCombatTrace(s,true);expect(startIntent(s,e,h)).toBe(true);step(s,.3);
 const release=combatTraceSnapshot(s).find(r=>r.type==='attack-released'&&r.context?.actorId===e.id)!;
 expect(release.context).toMatchObject({requestSource:'enemy-ai',kind:'enemy'});
 expect(combatTraceSnapshot(s).some(r=>r.type==='hit-outcome'&&r.outcome?.attackEventId===release.attack!.attackEventId)).toBe(true);
});

test('new expedition resets the trace generation and deep snapshots cannot corrupt identity',()=>{
 const {s,h,e}=arena();configureCombatTrace(s,true);requestBasic(s,h,e.pos,1);const before=combatTraceSnapshot(s),gen=s.combatIdentity!.generation;
 before[0].context!.actorId='corrupt';expect(combatTraceSnapshot(s)[0].context!.actorId).toBe(h.id);
 expect(command(s,{type:'endExpedition'}).ok).toBe(true);expect(command(s,{type:'newExpedition'}).ok).toBe(true);expect(combatTraceSnapshot(s)).toEqual([]);expect(s.combatIdentity!.generation).toBe(gen+1);expect(s.combatIdentity!.nextActionId).toBe(1);
});

test('posture Break, forced impact and per-cast reclaim budgets remain identical with observation disabled',()=>{
 const a=arena(),b=arena();configureCombatTrace(a.s,true);configureCombatTrace(b.s,false);
 for(const v of [a,b]){v.h.hp=v.h.maxHp-20;v.h.grayHp=20;v.e.posture=0;v.e.dodge=0;for(const w of v.e.weapons)w.weight=0;
  for(const target of [v.e,v.f])resolveHit(v.s,target,v.h.weapons[0],10,v.h,{eventId:target===v.e?73:74,castId:72,postureDamage:1,kind:'basic',reclaimBudget:4,reclaimRate:1});
 }
 expect(projection(a.s)).toBe(projection(b.s));expect(a.e.forcedMotion).toBeDefined();expect(a.s.recoveryBudgets).toEqual(b.s.recoveryBudgets);
});

test('two original Basic stages have different action IDs and the original stage indices',()=>{
 const {s,h,e}=arena();configureCombatTrace(s,true);requestBasic(s,h,e.pos,1);step(s,.3);
 s.time=h.basicChain!.nextStageAllowedAt;h.attackTimer=0;requestBasic(s,h,e.pos,2);step(s,.3);
 const contexts=combatTraceSnapshot(s).filter(r=>r.type==='action-started'&&r.context?.actorId===h.id&&r.context.kind==='basic').map(r=>r.context!);
 expect(contexts.map(c=>c.stageIndex)).toEqual([0,1]);expect(new Set(contexts.map(c=>c.actionId)).size).toBe(2);
});

test('rain fired slots own wave IDs; its delayed field inherits root and old cast budget',()=>{
 const {s,h}=arena('rain');configureCombatTrace(s,true);step(s,.45);
 const trace=combatTraceSnapshot(s),run=skillState(h,'rain').run!;
 const arrows=trace.filter(r=>r.type==='attack-released'&&r.attack?.waveId!==undefined);
 expect(arrows.length).toBeGreaterThan(10);expect(new Set(arrows.map(r=>r.attack!.waveId)).size).toBe(arrows.length);
 expect(arrows.every(r=>r.context?.actionId===run.combatContext?.actionId)).toBe(true);
 const field=s.skillEffects!.find(e=>e.kind==='rainTrace')!;expect(field.combatContext).toMatchObject({parentActionId:run.combatContext!.actionId,rootActionId:run.combatContext!.rootActionId,legacyCastId:run.id});
});

test('a poison threshold is a real child skill opportunity, not an unnamed Basic hit',()=>{
 const {s,h,e}=arena('poison');h.weapons[h.weaponIndex].profession='guard';skillState(h,'poison').enabled=true;e.poisonMeter=1000;configureCombatTrace(s,true);
 requestBasic(s,h,e.pos,1);step(s,.3);
 const trace=combatTraceSnapshot(s),basic=trace.find(r=>r.type==='action-started'&&r.context?.kind==='basic')!.context!;
 const poison=trace.find(r=>r.type==='attack-released'&&r.context?.executedAbilityId==='poison');
 expect(poison?.context).toMatchObject({parentActionId:basic.actionId,rootActionId:basic.rootActionId,slot:0,slotSkillId:'poison'});
});

test('automatic dance readiness is a mode action with no fabricated attack',()=>{
 const {s,h}=arena('dance');s.units=s.units.filter(u=>u.team==='ally');skillState(h,'dance').enabled=false;configureCombatTrace(s,true);step(s,.05);
 expect(skillState(h,'dance').enabled).toBe(true);
 expect(combatTraceSnapshot(s).some(r=>r.type==='action-started'&&r.context?.executedAbilityId==='dance'&&r.context.requestSource==='system')).toBe(true);
 expect(combatTraceSnapshot(s).some(r=>r.type==='attack-released')).toBe(false);
});

test('stun interruption of an ordinary support action is observed without cancelling emitted Echoes',()=>{
 const {s,h}=arena('prayer');configureCombatTrace(s,true);command(s,{type:'skill',id:h.id,slot:0});const action=skillState(h,'prayer').combatContext!;
 h.statuses.push({kind:'stun',power:0,remaining:1});step(s,.05);
 expect(skillState(h,'prayer').time).toBe(0);
 expect(combatTraceSnapshot(s).some(r=>r.type==='action-cancelled'&&r.context?.actionId===action.actionId)).toBe(true);
});
