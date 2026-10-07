// AR05: this frozen historical suite verifies the retained pre-Blue branch.

vi.mock('../src/core/hunter-state',async importActual=>({...await importActual<object>(),isHunterV2:()=>false}));
import {vi,test,expect} from 'vitest';
import {setup} from './ar03-fixture';
import {command,step} from '../src/core/engine';
import {resolveBasicDefinition,BASIC_DEFINITIONS,nextBasicStage} from '../src/core/basic-definition';
import {combatTraceSnapshot} from '../src/core/combat-identity';
import {requestBasic} from '../src/core/basic-chain';
import {issueMoveOrder} from '../src/core/move-order';
test('Hunter owns two named stages; peer professions retain immutable legacy',()=>{
 const {h}=setup('loop',742);const d=resolveBasicDefinition(h);
 expect(d.id).toBe('hunter-basic-v1');expect(d.stages.map(s=>s.id)).toEqual(['Shot01','Shot02']);
 expect(nextBasicStage(d,1,true)).toBe(0);expect(nextBasicStage(d,1,false)).toBe(0);
 expect(d.stages.map(s=>s.presentationId)).toEqual(['hunter-shot-01','hunter-shot-02']);
 for(const profession of ['guard','shieldguard','healer','cantor','ranger','scythe'] as const){h.weapons[0].profession=profession;expect(resolveBasicDefinition(h)).toBe(BASIC_DEFINITIONS['legacy-main-basic']);}
});
test('three accepted requests cycle Shot01 Shot02 Shot01 on the same target',()=>{
 const {s,h,e}=setup('loop',742);const stages:number[]=[];
 for(let id=1;id<=3;id++){expect(command(s,{type:'basic',id:h.id,aim:e.pos,requestId:id}).ok).toBe(true);stages.push(h.basicAction!.stageIndex);for(let i=0;i<17;i++)step(s,.05);}
 expect(stages).toEqual([0,1,0]);expect(combatTraceSnapshot(s).filter(r=>r.type==='attack-released'&&r.context?.actorId===h.id)).toHaveLength(3);
});
test.each(['move','direct','blink'] as const)('%s cancels before Hunter release once, never refunds recovery',kind=>{
 const {s,h,e}=setup('loop',742);command(s,{type:'basic',id:h.id,aim:e.pos,requestId:1});step(s,.1);const timer=h.attackTimer;
 const result=kind==='move'?command(s,{type:'move',id:h.id,to:{x:15,y:12}}):command(s,{type:kind,id:h.id,direction:{x:0,y:1}});
 expect(result.ok).toBe(true);expect(h.basicAction).toBeUndefined();expect(h.attackTimer).toBe(timer);for(let i=0;i<10;i++)step(s,.05);
 const rows=combatTraceSnapshot(s).filter(r=>r.context?.actorId===h.id&&r.context?.kind==='basic');expect(rows.filter(r=>r.type==='action-cancelled')).toHaveLength(1);expect(rows.filter(r=>r.type==='attack-released')).toHaveLength(0);
});
test('release followed by direct movement retains committed outcome and cannot start an early second shot',()=>{
 const {s,h,e}=setup('loop',742);command(s,{type:'basic',id:h.id,aim:e.pos,requestId:1});for(let i=0;i<9;i++)step(s,.05);const action=h.basicAction;
 expect(command(s,{type:'direct',id:h.id,direction:{x:0,y:1}}).ok).toBe(true);expect(h.basicAction).toBe(action);
 expect(command(s,{type:'basic',id:h.id,aim:e.pos,requestId:2}).ok).toBe(false);expect(combatTraceSnapshot(s).filter(r=>r.type==='attack-released'&&r.context?.actorId===h.id)).toHaveLength(1);
});
test('buffer waits for recovery, changed target and continuation timeout restart Shot01',()=>{
 const {s,h,e,f}=setup('loop',742);command(s,{type:'basic',id:h.id,aim:e.pos,requestId:1});for(let i=0;i<14;i++)step(s,.05);const first=h.basicAction;
 expect(command(s,{type:'basic',id:h.id,aim:e.pos,requestId:2}).ok).toBe(true);expect(h.basicAction).toBe(first);for(let i=0;i<4;i++)step(s,.05);expect(h.basicAction?.stageIndex).toBe(1);
 for(let i=0;i<17;i++)step(s,.05);e.pos={x:30,y:10};f.pos={x:16,y:10};expect(command(s,{type:'basic',id:h.id,aim:f.pos,requestId:3}).ok).toBe(true);expect(h.basicAction?.stageIndex).toBe(0);
 for(let i=0;i<30;i++)step(s,.05);expect(command(s,{type:'basic',id:h.id,aim:f.pos,requestId:4}).ok).toBe(true);expect(h.basicAction?.stageIndex).toBe(0);
});
test.each(['companion-ai','order-auto'] as const)('%s uses the same Hunter definition and identity path',source=>{
 const {s,h,e}=setup('ai',742);expect(requestBasic(s,h,e.pos,77,source).ok).toBe(true);expect(h.basicAction?.definitionId).toBe('hunter-basic-v1');expect(h.basicAction?.requestSource).toBe(source);
 for(let i=0;i<9;i++)step(s,.05);expect(combatTraceSnapshot(s).some(r=>r.type==='attack-released'&&r.context?.actorId===h.id&&r.context.requestSource===source)).toBe(true);
});
test.each(['ai','order'])('real %s scheduler accepts Hunter BasicV1 without a second executor',kind=>{
 const {s,h,e}=setup('ai',742);let observed:typeof h.basicAction;
 if(kind==='order'){
  s.context='explorationBattle';e.encounterRoom=1;
  s.exploration!.definition.encounters=[{room:1,name:'AR04 engaged order fixture',tier:'strong',enemyIds:[e.id],center:{...e.pos},tacticalRadius:6.5}];
  expect(issueMoveOrder(s,h,{x:18,y:10},'command').ok).toBe(true);
 }
 for(let i=0;i<40;i++){step(s,.05);if(h.basicAction){observed=h.basicAction;break;}}
 expect(observed?.definitionId).toBe('hunter-basic-v1');expect(observed?.requestSource).toBe(kind==='ai'?'companion-ai':'order-auto');
 const id=observed?.combatContext?.actionId;expect(id).toBeDefined();for(let i=0;i<10;i++)step(s,.05);
 expect(combatTraceSnapshot(s).filter(r=>r.context?.actionId===id&&r.type==='attack-released')).toHaveLength(1);
});
test('Hunter sample release is cached, emits once and preserves attack recovery authority',()=>{
 const {s,h,e}=setup('loop',742);expect(command(s,{type:'basic',id:h.id,aim:e.pos,requestId:1}).ok).toBe(true);
 const a=h.basicAction!;expect(a.presentationId).toBe('hunter-shot-01');expect(a.releaseAt).toBeCloseTo(.4);
 for(let i=0;i<7;i++)step(s,.05);expect(a.released).toBe(false);
 for(let i=0;i<2;i++)step(s,.05);expect(a.released).toBe(true);expect(a.moveReady).toBe(true);expect(a.attackReady).toBe(false);
 expect(combatTraceSnapshot(s).filter(r=>r.type==='attack-released'&&r.context?.actorId===h.id)).toHaveLength(1);
});
