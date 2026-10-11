import {test,expect} from 'vitest';
import {command,createExplorationEntry,resolveHit,step} from '../src/core/engine';
import {beginWorld,leaveWorldArea,continueWorld} from '../src/core/world-session';
import {setup as base} from './en01-fixture';
import * as inventory from '../src/core/world-inventory';
const api=inventory as any;
const setup=()=>{const f=base();f.s.sessionMode='exploration';beginWorld(f.s);f.s.context='explorationIdle';return f;};
const token=(s:any)=>({worldId:s.world.id,visit:s.world.visit.generation,ownerId:'ranger',expectedRevision:s.world.backpack.alReserve.revision});
const bind=(s:any,itemId='sample-seed',extra={})=>command(s,{type:'assignCompanionFreeItem',...token(s),itemId,...extra} as any);
const clear=(s:any)=>command(s,{type:'clearCompanionFreeItem',...token(s)} as any);
test('fixed Al empty reference; queries pure, team assignment gives one, stale assignment rejected, preference references Al stock',()=>{
 const {s}=setup(),bag=s.world!.backpack as any;expect(bag.companionFreeItem).toEqual({ownerId:'ranger',itemId:null});
 const before=structuredClone(s);expect(api.queryAssignCompanionFreeItem(s,{...token(s),itemId:'sample-seed'}).ok).toBe(true);expect(s).toEqual(before);
 expect(bind(s).ok).toBe(true);const stale=token(s),once=structuredClone(s);expect(bind(s,'sample-seed',{...stale,expectedRevision:0}).ok).toBe(false);expect(s).toEqual(once);
 expect(command(s,{type:'assignHotbar',worldId:s.world!.id,visit:s.world!.visit.generation,itemId:'sample-seed',slot:0} as any).ok).toBe(true);
 expect(bag.hotbar[0]).toBe(bag.companionFreeItem.itemId);expect(bind(s,'sample-tool').ok).toBe(true);expect(bag.companionFreeItem.itemId).toBe('sample-tool');expect(bag.stacks.map((x:any)=>x.quantity)).toEqual([2,4,0]);
 expect(bag.alReserve.slots.filter(Boolean)).toEqual([{itemId:'sample-seed',quantity:1},{itemId:'sample-tool',quantity:1}]);
});
test('bad owner/id/tokens/counts and duplicated stacks reject without mutation',()=>{
 for(const extra of [{ownerId:'hunter'},{ownerId:'clone'},{itemId:'heal'},{itemId:'bomb'},{itemId:'__proto__'},{worldId:'old'},{visit:0}]){const {s}=setup(),before=structuredClone(s);expect(bind(s,'sample-seed',extra).ok).toBe(false);expect(s).toEqual(before);}
 for(const n of [0,-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){const {s}=setup();s.world!.backpack!.stacks.find(x=>x.itemId==='sample-seed')!.quantity=n;const before=structuredClone(s);expect(bind(s).ok).toBe(false);expect(s).toEqual(before);}
 const {s}=setup();s.world!.backpack!.stacks.push({itemId:'sample-seed',quantity:1});const before=structuredClone(s);expect(bind(s).ok).toBe(false);expect(s).toEqual(before);
});
test('only formal fixed unique originals accepted; no aim/command/session/absent world repair',()=>{
 for(const change of [(s:any)=>s.sessionMode='legacy',(s:any)=>s.xxExperiment=true,(s:any)=>s.world.visit.active=false,(s:any)=>s.world=undefined,(s:any)=>s.phase='world',(s:any)=>s.units=s.units.filter((u:any)=>u.id!=='ranger'),(s:any)=>s.units.push(structuredClone(s.units.find((u:any)=>u.id==='ranger'))),(s:any)=>s.units.find((u:any)=>u.id==='ranger').shadowResident=true,(s:any)=>s.units.find((u:any)=>u.id==='ranger').team='enemy',(s:any)=>s.explorationCompanionId='other',(s:any)=>s.explorationControl={aim:{}},(s:any)=>s.explorationControl={commandFocusId:'ranger'}]){
  const {s}=setup(),req={type:'assignCompanionFreeItem',...token(s),itemId:'sample-seed'};change(s);const before=structuredClone(s);expect(command(s,req as any).ok).toBe(false);expect(s).toEqual(before);
 }
});
test('missing stock is unavailable without auto repair, but clear works without consuming',()=>{
 const {s}=setup();expect(bind(s).ok).toBe(true);s.world!.backpack!.stacks=[];const before=structuredClone(s);expect(api.queryAssignCompanionFreeItem(s,{...token(s),itemId:'sample-seed'}).ok).toBe(false);expect(api.queryClearCompanionFreeItem(s,token(s)).ok).toBe(true);expect(s).toEqual(before);expect(clear(s).ok).toBe(true);expect((s.world!.backpack as any).companionFreeItem.itemId).toBeNull();expect(s.world!.backpack!.stacks).toEqual([]);const once=structuredClone(s);expect(clear(s).ok).toBe(true);expect(s).toEqual(once);
});
test('Al death does not invalidate binding ownership; live Hunter can replace and clear',()=>{
 const {s,al}=setup();al.life='respawning';al.hp=0;expect(bind(s).ok).toBe(true);expect(clear(s).ok).toBe(true);
});
test('clear requests also reject stale visits and foreign owners without changing any state',()=>{
 for(const extra of [{ownerId:'hunter'},{worldId:'old'},{visit:0}]){const {s}=setup();expect(bind(s).ok).toBe(true);const request={...token(s),...extra},before=structuredClone(s);expect(api.queryClearCompanionFreeItem(s,request).ok).toBe(false);expect(command(s,{type:'clearCompanionFreeItem',...request} as any).ok).toBe(false);expect(s).toEqual(before);}
});
test('Z, same-world visits, wipe and rest preserve; confirmed new world empties reference',()=>{
 const {s,h,al,e}=setup();expect(bind(s).ok).toBe(true);const w=s.world!,bag=w.backpack!,snapshot=structuredClone(bag),old=token(s);
 expect(command(s,{type:'controlBody',id:al.id} as any).ok).toBe(true);expect(bag).toEqual(snapshot);
 s.units=s.units.filter(u=>u.team==='ally');expect(leaveWorldArea(s).ok).toBe(true);expect(continueWorld(s,w.id,w.visit.generation).ok).toBe(true);expect(w.backpack).toBe(bag);expect(bag).toEqual(snapshot);const unchanged=structuredClone(s);expect(bind(s,'sample-tool',old).ok).toBe(false);expect(s).toEqual(unchanged);
 resolveHit(s,h,{...e.weapons[0],subtype:'impact'},99999,e);resolveHit(s,al,{...e.weapons[0],subtype:'impact'},99999,e);for(let i=0;i<200;i++)step(s,.01);expect(bag).toEqual(snapshot);
 const p=s.exploration!.definition.points.find(p=>p.kind==='campfire')!;h.pos={...p.pos};al.pos={x:p.pos.x+.3,y:p.pos.y};h.ready=al.ready=0;expect(command(s,{type:'interactExploration',id:p.id}).ok).toBe(true);expect(bag).toEqual(snapshot);
 expect(command(s,{type:'restartWorld',worldId:w.id}).ok).toBe(true);command(s,{type:'carry',gold:0,vitality:0});expect((s.world!.backpack as any).companionFreeItem).toEqual({ownerId:'ranger',itemId:null});
});
