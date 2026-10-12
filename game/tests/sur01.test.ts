import {test,expect} from 'vitest';
import {createExplorationEntry,createGame,command,step} from '../src/core/engine';
import {positionVisible,positionKnown,previewState,updateVision} from '../src/core/visibility';
import {exitExploration} from '../src/core/exploration';
import {continueWorld} from '../src/core/world-session';
import {queryAlItemCandidates} from '../src/core/al-items';
const lamp='sample-field-lamp';
function setup(){const s=createExplorationEntry();command(s,{type:'carry',gold:0,vitality:0});return s;}
/** CORE POSITION FIXTURE, never claimed as natural movement. */
function dark(s:any){for(const u of s.units.filter(u=>u.team==='ally')){u.pos={x:10,y:16};u.drawPos={...u.pos};u.ready=0;}updateVision(s,true);}
function qty(s:any){return s.world.backpack.stacks.find(x=>x.itemId===lamp)?.quantity??0;}
function request(s:any){return {worldId:s.world.id,visit:s.world.visit.generation,actorId:s.controlledBodyId,controlRevision:s.controlRevision??0,expectedRevision:s.world.sampleLight?.revision??0};}
function use(s:any,r=request(s)){return command(s,{type:'useSampleLight',...r} as any);}
test('dark target loses ordinary 5m sight but a paid actual light reveals it until simulated expiry',()=>{
 const s=setup();dark(s);expect(positionVisible(s,{x:10,y:20})).toBe(false);expect(positionVisible(s,{x:10,y:15})).toBe(true);expect(qty(s)).toBe(2);expect(use(s).ok).toBe(true);expect(qty(s)).toBe(1);expect(s.lights).toHaveLength(1);expect(positionVisible(s,{x:10,y:20})).toBe(true);s.units=s.units.filter(u=>u.team==='ally');step(s,0);expect(s.lights[0].remaining).toBe(20);step(s,20.2);expect(s.lights).toHaveLength(0);expect(positionVisible(s,{x:10,y:20})).toBe(false);expect(qty(s)).toBe(1);expect(positionKnown(s,{x:10,y:20})).toBe(true);
});
test('one request cannot replay before or after expiry; fresh second use exhausts real stock',()=>{
 const s=setup();dark(s);const r=request(s);expect(use(s,r).ok).toBe(true);expect(use(s,r).ok).toBe(false);expect(use(s).ok).toBe(false);s.units=s.units.filter(u=>u.team==='ally');step(s,20.2);expect(use(s,r).ok).toBe(false);expect(qty(s)).toBe(1);expect(use(s).ok).toBe(true);expect(qty(s)).toBe(0);step(s,20.2);expect(use(s).ok).toBe(false);expect(s.lights).toHaveLength(0);
});
test('pure gates reject stale authority, outside, locked/dead actors and malformed inventory without writes',async()=>{
 const env=await import('../src/core/environment-sample').catch(()=>null);expect(env).not.toBeNull();
 for(const change of [(s:any,r:any)=>r.worldId='old',(s:any,r:any)=>r.visit=0,(s:any,r:any)=>r.expectedRevision=99,(s:any,r:any)=>r.controlRevision=99,(s:any,r:any)=>r.actorId='ranger',(s:any)=>s.world.visit.active=false,(s:any)=>s.units.find(u=>u.id===s.controlledBodyId).life='dead',(s:any)=>s.units.find(u=>u.id===s.controlledBodyId).basicAction={},(s:any)=>s.units.find(u=>u.id===s.controlledBodyId).pos={x:6,y:8},(s:any)=>s.world.backpack.stacks.push({itemId:lamp,quantity:1}),(s:any)=>s.world.backpack.stacks.find(x=>x.itemId===lamp).quantity=.5,(s:any)=>s.explorationControl.aim={kind:'path'}]){
  const s=setup();dark(s);const r=request(s);change(s,r);const before=structuredClone(s);expect(env!.querySampleLightUse(s,r).ok).toBe(false);expect(env!.acceptSampleLightUse(s,r).ok).toBe(false);expect(s).toEqual(before);
 }
 const s=setup();dark(s);const before=structuredClone(s);expect(env!.querySampleLightUse(s,request(s)).ok).toBe(true);expect(s).toEqual(before);
});
test('lamp never sees through walls or across target layer and memory does not reveal live enemies',()=>{
 const s=setup();dark(s);expect(use(s).ok).toBe(true);const target={x:10,y:20},tile=s.tiles.find(t=>t.x===10&&t.y===18)!;tile.obstacle=true;expect(positionVisible(s,target)).toBe(false);tile.obstacle=false;s.tiles.find(t=>t.x===10&&t.y===20)!.layer=1;expect(positionVisible(s,target)).toBe(false);s.tiles.find(t=>t.x===10&&t.y===20)!.layer=0;expect(positionVisible(s,target)).toBe(true);s.lights=[];const e=s.units.find(u=>u.team==='enemy')!;e.pos={...target};s.exploration!.memory.seen.push('10,20');expect(previewState(s).units.some(u=>u.id===e.id)).toBe(false);
});
test('legal unload consumes no extra stock and never rebuilds old light; new world resets',()=>{
 const s=setup();dark(s);expect(use(s).ok).toBe(true);const record=structuredClone((s.world as any).sampleLight);s.units=s.units.filter(u=>u.team==='ally');for(const u of s.units)u.pos={...s.exploration!.definition.exit};s.context='explorationIdle';const w=s.world!;expect(exitExploration(s,[],()=>{}).ok).toBe(true);expect(s.lights).toHaveLength(0);expect(qty(s)).toBe(1);const at=s.time;step(s,5);expect(s.time).toBe(at);expect(continueWorld(s,w.id,w.visit.generation).ok).toBe(true);expect((s.world as any).sampleLight).toEqual(record);expect(qty(s)).toBe(1);expect(s.lights).toHaveLength(0);command(s,{type:'restartWorld',worldId:w.id});command(s,{type:'carry',gold:0,vitality:0});expect(qty(s)).toBe(2);expect((s.world as any).sampleLight.revision).toBe(0);
});
test('ordinary region and Legacy retain sight; formal old light command stays prohibited and AL has no lamp consumer',()=>{
 const s=setup();expect(positionVisible(s,{x:9,y:8})).toBe(true);expect(command(s,{type:'item',item:'light',to:{x:10,y:16}}).ok).toBe(false);expect(s.lights).toHaveLength(0);expect(queryAlItemCandidates(s).candidates.some(c=>c.itemId===lamp)).toBe(false);const old=createGame();dark(old);expect(positionVisible(old,{x:10,y:20})).toBe(true);expect(use(old,{worldId:'legacy',visit:1,actorId:'hunter',controlRevision:0,expectedRevision:0}).ok).toBe(false);expect((old.world as any)?.sampleLight).toBeUndefined();
});

test('lamp transferred to Al remains inventory, not an autonomous consumer, and withdrawal restores player stock',()=>{
 const s=setup(),w=s.world!;const req={worldId:w.id,visit:w.visit.generation,ownerId:'ranger',source:'team',itemId:lamp,amount:1,expectedRevision:w.backpack!.alReserve.revision};expect(command(s,{type:'assignCompanionFreeItem',...req} as any).ok).toBe(true);expect(qty(s)).toBe(1);expect(w.backpack!.alReserve.slots.find(x=>x?.itemId===lamp)?.quantity).toBe(1);expect(queryAlItemCandidates(s).candidates.some(x=>x.itemId===lamp)).toBe(false);dark(s);expect(use(s).ok).toBe(true);expect(qty(s)).toBe(0);s.lights=[];expect(use(s).ok).toBe(false);expect(command(s,{type:'transferAlItem',...req,source:'reserve',expectedRevision:w.backpack!.alReserve.revision} as any).ok).toBe(true);expect(qty(s)).toBe(1);expect(use(s).ok).toBe(true);
});
