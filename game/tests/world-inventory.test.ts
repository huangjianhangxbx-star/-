import {test,expect} from 'vitest';
import {command,createExplorationEntry,createGame,resolveHit,step} from '../src/core/engine';
import {beginWorld,leaveWorldArea,continueWorld} from '../src/core/world-session';
import {setup as base} from './en01-fixture';
const fresh=()=>{const s=createExplorationEntry();command(s,{type:'carry',gold:0,vitality:0});return s;};
const setup=()=>{const f=base();f.s.sessionMode='exploration';beginWorld(f.s);f.s.context='explorationIdle';return f;};
const token=(s:any)=>({worldId:s.world.id,visit:s.world.visit.generation});
const assign=(s:any,itemId='sample-seed',slot=0,extra={})=>command(s,{type:'assignHotbar',...token(s),itemId,slot,...extra} as any);
const activate=(s:any,slot=0,extra={})=>command(s,{type:'activateHotbar',...token(s),slot,...extra} as any);
const clear=(s:any,slot=0)=>command(s,{type:'clearHotbar',...token(s),slot} as any);
const module=()=>import('../src/core/world-inventory').catch(()=>undefined);
test('ordinary world grants SAMPLE stock once, ten reference slots; no inventory before departure',()=>{
 const entry=createExplorationEntry();expect(entry.world).toBeUndefined();const s=fresh(),bag=(s.world as any).backpack;
 expect(bag).toEqual({alReserve:{slots:Array(5).fill(null),revision:0,useSerial:0,nextDecision:0,uses:[]},stacks:[{itemId:'sample-al-regen',quantity:2},{itemId:'sample-al-bomb',quantity:2},{itemId:'sample-seed',quantity:5},{itemId:'sample-tool',quantity:1}],hotbar:Array(10).fill(null),selectedSlot:null,companionFreeItem:{ownerId:'ranger',itemId:null}});
 beginWorld(s);expect((s.world as any).backpack).toBe(bag);
 const legacy=createGame();command(legacy,{type:'selectJourney',journey:'exploration'});command(legacy,{type:'carry',gold:0,vitality:0});beginWorld(legacy);expect((legacy.world as any)?.backpack).toBeUndefined();
 const xx=createExplorationEntry();xx.xxExperiment=true;command(xx,{type:'carry',gold:0,vitality:0});expect((xx.world as any)?.backpack).toBeUndefined();
});
test('pure query then assignments share stock, activation only selects, clear never consumes',async()=>{
 const {s}=setup(),m=await module();expect(m,'inventory API').toBeDefined();const before=structuredClone(s);
 expect(m!.queryAssignHotbar(s,{...token(s),itemId:'sample-seed',slot:0})).toMatchObject({ok:true});expect(s).toEqual(before);
 expect(assign(s).ok).toBe(true);expect(assign(s,'sample-seed',1).ok).toBe(true);expect(assign(s,'sample-tool',9).ok).toBe(true);
 const other={inventory:structuredClone(s.inventory),quickSlots:structuredClone(s.quickSlots),bottle:structuredClone(s.world!.healingBottle),activation:structuredClone(s.world!.activation),economy:structuredClone(s.economy),equipment:s.units.map(u=>structuredClone(u.equipment))};
 expect(activate(s).ok).toBe(true);expect((s.world as any).backpack.selectedSlot).toBe(0);expect(s.notice).toContain('靠近试验田，左键操作');
 expect(activate(s,9).ok).toBe(true);expect((s.world as any).backpack.stacks.map((x:any)=>x.quantity)).toEqual([2,2,5,1]);expect(clear(s,0).ok).toBe(true);expect((s.world as any).backpack.hotbar.slice(0,2)).toEqual([null,'sample-seed']);
 expect({inventory:s.inventory,quickSlots:s.quickSlots,bottle:s.world!.healingBottle,activation:s.world!.activation,economy:s.economy,equipment:s.units.map(u=>u.equipment)}).toEqual(other);
});
test('bad IDs, indices, corrupted counts and stale tokens reject atomically',()=>{
 for(const extra of [{itemId:'heal'},{itemId:'hunter'},{slot:-1},{slot:10},{slot:.5},{slot:NaN},{worldId:'old'},{visit:0}]){const {s}=setup(),before=structuredClone(s);expect(assign(s,'sample-seed',0,extra).ok).toBe(false);expect(s).toEqual(before);}
 for(const n of [0,-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){const {s}=setup();(s.world as any).backpack.stacks.find((x:any)=>x.itemId==='sample-seed').quantity=n;const before=structuredClone(s);expect(assign(s).ok).toBe(false);expect(s).toEqual(before);}
 const {s}=setup();assign(s);(s.world as any).backpack.stacks=[];const before=structuredClone(s);expect(activate(s).ok).toBe(false);expect(activate(s,9).ok).toBe(false);expect(s).toEqual(before);
});
test('wrong session, absent world, aim and invalid owner cannot mutate formal backpack',()=>{
 for(const alter of [(s:any)=>s.sessionMode='legacy',(s:any)=>s.xxExperiment=true,(s:any)=>s.world.visit.active=false,(s:any)=>s.phase='world',(s:any)=>s.controlledBodyId='missing',(s:any)=>s.explorationControl={commandFocusId:'ranger'},(s:any)=>s.explorationControl={commandFocusId:null,aim:{}},(s:any)=>s.world=undefined]){const {s}=setup(),req=token(s);alter(s);const before=structuredClone(s);expect(command(s,{type:'assignHotbar',...req,itemId:'sample-seed',slot:0} as any).ok).toBe(false);expect(s).toEqual(before);}
});
test('formal sessions cannot consume or configure retired inventory, even if stale callers supply stock',()=>{
 for(const make of [(s:any)=>({type:'equipQuick',item:'heal'}),(s:any)=>({type:'item',item:'heal',to:s.units[0].pos,targetId:s.units[0].id})]){const {s,h}=setup();h.hp=1;s.inventory.heal=2;const before=structuredClone(s);expect(command(s,make(s) as any).ok).toBe(false);expect(s).toEqual(before);}
});
test('same-world visits, Z, death/wipe and rest preserve bag; new world resets bag only',()=>{
 const {s,h,al,e}=setup();assign(s);assign(s,'sample-tool',9);activate(s,9);const w=s.world!,bag=(w as any).backpack,snapshot=structuredClone(bag),old=token(s);
 expect(command(s,{type:'controlBody',id:al.id} as any).ok).toBe(true);expect((w as any).backpack).toEqual(snapshot);
 s.units=s.units.filter(u=>u.team==='ally');expect(leaveWorldArea(s).ok).toBe(true);expect(continueWorld(s,w.id,w.visit.generation).ok).toBe(true);expect((w as any).backpack).toBe(bag);expect((w as any).backpack).toEqual(snapshot);
 const unchanged=structuredClone(s);expect(assign(s,'sample-seed',2,old).ok).toBe(false);expect(s).toEqual(unchanged);
 resolveHit(s,h,{...e.weapons[0],subtype:'impact'},99999,e);resolveHit(s,al,{...e.weapons[0],subtype:'impact'},99999,e);for(let i=0;i<200;i++)step(s,.01);expect((w as any).backpack).toEqual(snapshot);
 const p=s.exploration!.definition.points.find(p=>p.kind==='campfire')!;h.pos={...p.pos};al.pos={x:p.pos.x+.3,y:p.pos.y};h.ready=al.ready=0;expect(command(s,{type:'interactExploration',id:p.id}).ok).toBe(true);expect((w as any).backpack).toEqual(snapshot);
 const prepared=structuredClone(s.rightPreparation);expect(command(s,{type:'restartWorld',worldId:w.id}).ok).toBe(true);command(s,{type:'carry',gold:0,vitality:0});expect((s.world as any).backpack.hotbar).toEqual(Array(10).fill(null));expect((s.world as any).backpack.stacks.map((x:any)=>x.quantity)).toEqual([2,2,5,1]);expect(s.rightPreparation).toEqual(prepared);expect(assign(s,'sample-seed',0,old).ok).toBe(false);
});
