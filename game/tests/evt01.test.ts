import {test,expect} from 'vitest';
import {createExplorationEntry,command} from '../src/core/engine';
import {exitExploration} from '../src/core/exploration';
import {continueWorld} from '../src/core/world-session';
const eventId='sample-echo-event';
function setup(){const s=createExplorationEntry();command(s,{type:'carry',gold:0,vitality:0});return s;}
function record(s:any){return s.world.places[s.world.visit.placeId].sampleEvent;}
function request(s:any){return {worldId:s.world.id,visit:s.world.visit.generation,placeId:s.world.visit.placeId,eventId,actorId:s.controlledBodyId,controlRevision:s.controlRevision??0,expectedRevision:record(s)?.revision??0};}
function trigger(s:any,r=request(s)){return command(s,{type:'triggerSampleEvent',...r} as any);}
function choose(s:any,choiceId='salvage',extra={}){return command(s,{type:'chooseSampleEvent',...request(s),choiceId,...extra} as any);}
const quantity=(s:any)=>s.world.backpack.stacks.find(x=>x.itemId==='sample-al-regen')?.quantity??0;
test('offering and reopening never rewards; salvage adds exactly one team medicine, not Al or other authorities',()=>{
 const s=setup();expect(record(s)?.status).toBe('notStarted');const econ=structuredClone(s.economy),al=structuredClone(s.world!.backpack!.alReserve),quest=structuredClone(s.world!.places[18].quest),lamp=structuredClone(s.world!.sampleLight),r=request(s);expect(trigger(s,r).ok).toBe(true);expect(quantity(s)).toBe(2);expect(record(s).status).toBe('offered');const offered=structuredClone(record(s));expect(trigger(s).ok).toBe(true);expect(record(s)).toEqual(offered);expect(trigger(s,r).ok).toBe(false);expect(choose(s).ok).toBe(true);expect(quantity(s)).toBe(3);expect(record(s)).toMatchObject({status:'resolved',choiceId:'salvage'});expect(s.economy).toEqual(econ);expect(s.world!.backpack!.alReserve).toEqual(al);expect(s.world!.places[18].quest).toEqual(quest);expect(s.world!.sampleLight).toEqual(lamp);expect(s.exploration!.memory.objective).toBe(false);expect(s.exploration!.memory.mechanisms).toEqual([]);expect(choose(s,'listen').ok).toBe(false);expect(trigger(s).ok).toBe(false);expect(quantity(s)).toBe(3);
});
test('listen credits carried vitality once with one event reward source and leaves all stock/account alone',()=>{
 const s=setup(),bag=structuredClone(s.world!.backpack),account=structuredClone(s.economy.account);expect(trigger(s).ok).toBe(true);const r=request(s);expect(choose(s,'listen').ok).toBe(true);expect(s.fragments).toBe(10);expect(s.economy.account).toEqual(account);expect(s.world!.backpack).toEqual(bag);expect(s.economy.rewards.filter(k=>k.includes(':event:sample-echo-event'))).toHaveLength(1);expect(choose(s,'listen',r).ok).toBe(false);expect(choose(s,'salvage').ok).toBe(false);expect(s.fragments).toBe(10);
});
test('pure gates and acceptance reject stale identity, locked body, combat or bad choices without partial state',async()=>{
 const api=await import('../src/core/sample-event').catch(()=>null);expect(api).not.toBeNull();
 for(const change of [(s:any,r:any)=>r.worldId='old',(s:any,r:any)=>r.visit=0,(s:any,r:any)=>r.placeId=99,(s:any,r:any)=>r.eventId='wrong',(s:any,r:any)=>r.actorId='ranger',(s:any,r:any)=>r.controlRevision=999,(s:any,r:any)=>r.expectedRevision=999,(s:any)=>s.world.visit.active=false,(s:any)=>s.context='explorationBattle',(s:any)=>s.units.find(u=>u.id===s.controlledBodyId).basicAction={},(s:any)=>s.units.find(u=>u.id===s.controlledBodyId).life='dead',(s:any)=>s.explorationControl.aim={kind:'path'}]){
  const s=setup();expect(trigger(s).ok).toBe(true);const r={...request(s),choiceId:'salvage' as const};change(s,r);const before=structuredClone(s);expect(api!.querySampleEventChoice(s,r).ok).toBe(false);expect(api!.acceptSampleEventChoice(s,r).ok).toBe(false);expect(s).toEqual(before);
 }
 const s=setup(),before=structuredClone(s);expect(api!.querySampleEventTrigger(s,request(s)).ok).toBe(true);expect(s).toEqual(before);expect(api!.querySampleEventChoice(s,{...request(s),choiceId:'salvage'}).ok).toBe(false);expect(s).toEqual(before);expect(trigger(s).ok).toBe(true);const offered=structuredClone(s);expect(api!.querySampleEventChoice(s,{...request(s),choiceId:'bad'} as any).ok).toBe(false);expect(s).toEqual(offered);
});
test('salvage refuses duplicate or invalid medicine stacks and overflow; zero stock can receive one',async()=>{
 const api=await import('../src/core/sample-event').catch(()=>null);expect(api).not.toBeNull();
 for(const change of [(s:any)=>s.world.backpack.stacks.push({itemId:'sample-al-regen',quantity:1}),...( [NaN,-1,.5,Number.MAX_SAFE_INTEGER] ).map(n=>(s:any)=>s.world.backpack.stacks.find(x=>x.itemId==='sample-al-regen').quantity=n)]){
  const s=setup();trigger(s);change(s);const before=structuredClone(s);expect(api!.acceptSampleEventChoice(s,{...request(s),choiceId:'salvage'}).ok).toBe(false);expect(s).toEqual(before);
 }
 const s=setup();trigger(s);s.world!.backpack!.stacks=s.world!.backpack!.stacks.filter(x=>x.itemId!=='sample-al-regen');expect(choose(s).ok).toBe(true);expect(quantity(s)).toBe(1);
});
test('listen failure on overflow or duplicate reward key leaves offered record and balances unchanged',async()=>{
 const api=await import('../src/core/sample-event').catch(()=>null);expect(api).not.toBeNull();
 for(const change of [(s:any)=>s.fragments=Number.MAX_SAFE_INTEGER,(s:any)=>s.economy.rewards.push(s.world.id+':place:18:event:'+eventId)]){const s=setup();trigger(s);change(s);const before=structuredClone(s);expect(api!.acceptSampleEventChoice(s,{...request(s),choiceId:'listen'}).ok).toBe(false);expect(s).toEqual(before);}
});
test('offered and resolved persist across actual legal exit/continue; old visit refuses and new world resets',()=>{
 const s=setup();expect(trigger(s).ok).toBe(true);const old=request(s),w=s.world!;s.units=s.units.filter(u=>u.team==='ally');for(const u of s.units){u.pos={...s.exploration!.definition.exit};u.ready=0;}s.context='explorationIdle';expect(exitExploration(s,[],()=>{}).ok).toBe(true);expect(continueWorld(s,w.id,w.visit.generation).ok).toBe(true);expect(record(s).status).toBe('offered');expect(choose(s,'listen',old).ok).toBe(false);expect(choose(s,'listen').ok).toBe(true);const resolved=structuredClone(record(s));for(const u of s.units){u.pos={...s.exploration!.definition.exit};u.ready=0;}expect(exitExploration(s,[],()=>{}).ok).toBe(true);expect(continueWorld(s,w.id,w.visit.generation).ok).toBe(true);expect(record(s)).toEqual(resolved);expect(s.fragments).toBe(10);command(s,{type:'restartWorld',worldId:w.id});command(s,{type:'carry',gold:0,vitality:0});expect(record(s).status).toBe('notStarted');expect(quantity(s)).toBe(2);
});
