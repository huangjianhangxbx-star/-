import {stock,corruptItem,changeTeamItems} from './inventory-fixture';
import {test,expect} from 'vitest';
import {command,createExplorationEntry,step,resolveHit} from '../src/core/engine';
import {continueWorld,leaveWorldArea} from '../src/core/world-session';
import {hunterState} from '../src/core/hunter-state';
import {inventoryQuantity} from '../src/core/world-inventory';
const farm:any=await import('../src/core/farming').catch(()=>({}));
function setup(){const s=createExplorationEntry();expect(command(s,{type:'carry',gold:0,vitality:0}).ok).toBe(true);s.context='explorationIdle';const h=s.units.find(u=>u.id==='hunter')!,al=s.units.find(u=>u.id==='ranger')!;h.pos={x:6,y:7};h.ready=0;hunterState(h);const b=s.world!.backpack!;b.hotbar[0]='sample-tool';b.hotbar[1]='sample-seed';b.selectedSlot=0;return {s,h,al,b};}
function req(s:any,index=0){const p=s.world.places[s.world.visit.placeId].farmPlots[index],b=s.world.backpack;return {worldId:s.world.id,visit:s.world.visit.generation,plotId:p.id,expectedRevision:p.revision,actorId:s.controlledBodyId,slot:b.selectedSlot,itemId:b.hotbar[b.selectedSlot]};}
const run=(s:any,r=req(s))=>command(s,{type:'farmAction',...r} as any);
function plant(s:any){expect(run(s).ok).toBe(true);s.world.backpack.selectedSlot=1;expect(run(s).ok).toBe(true);s.world.backpack.selectedSlot=0;}

test('two legal fixed plots, pure views/queries, till plant mature harvest replant with one inventory',()=>{
 expect(farm.queryFarmAction).toBeTypeOf('function');const {s,b}=setup();const p=s.world!.places[18].farmPlots!;expect(p.map(x=>x.pos)).toEqual([{x:6,y:6,layer:0},{x:4,y:8,layer:0}]);expect(p.every(x=>x.state==='raw'&&x.revision===0&&x.harvestCount===0)).toBe(true);
 const before=structuredClone(s);expect(farm.queryFarmAction(s,req(s)).ok).toBe(true);farm.farmView(s);expect(s).toEqual(before);
 plant(s);expect(inventoryQuantity(b,'sample-seed')).toBe(4);expect(p[1].state).toBe('raw');const planted=structuredClone(s);expect(run(s).ok).toBe(false);expect(s).toEqual(planted);
 s.time=p[0].matureAt!-.001;expect(farm.farmView(s)[0].state).toBe('planted');s.time=p[0].matureAt!;expect(farm.farmView(s)[0].state).toBe('mature');const r=req(s);expect(run(s,r).ok).toBe(true);expect(inventoryQuantity(b,'sample-crop')).toBe(1);expect(inventoryQuantity(b,'sample-seed')).toBe(5);expect(inventoryQuantity(b,'sample-tool')).toBe(1);const done=structuredClone(s);expect(run(s,r).ok).toBe(false);expect(s).toEqual(done);expect(p[0].harvestCount).toBe(1);
 b.selectedSlot=1;expect(run(s).ok).toBe(true);expect(inventoryQuantity(b,'sample-seed')).toBe(4);b.companionFreeItem.itemId='sample-seed';expect(b.hotbar[1]).toBe(b.companionFreeItem.itemId);
});
test('stale world visit revision selection and identity fail without repairs or unrelated effects',()=>{
 expect(farm.queryFarmAction).toBeTypeOf('function');for(const extra of [{worldId:'old'},{visit:0},{expectedRevision:99},{plotId:'other'},{slot:1},{itemId:'sample-seed'},{actorId:'ranger'},{actorId:'clone'}]){const {s}=setup(),r={...req(s),...extra},before=structuredClone(s);expect(run(s,r).ok).toBe(false);expect(s).toEqual(before);}
 for(const change of [(s:any)=>s.phase='world',(s:any)=>s.sessionMode='legacy',(s:any)=>s.xxExperiment=true,(s:any)=>s.world.visit.active=false,(s:any)=>s.world.places[18].definition={...s.exploration.definition},(s:any)=>s.context='combat',(s:any)=>s.explorationControl={aim:{}},(s:any)=>s.explorationControl={commandFocusId:'ranger'},(s:any)=>s.world=undefined]){const {s}=setup(),r=req(s);change(s);const before=structuredClone(s);expect(run(s,r).ok).toBe(false);expect(s).toEqual(before);}
});
test('busy, dead, duplicate, shadow bodies, distance, wall and layer failures are pure',()=>{
 expect(farm.queryFarmAction).toBeTypeOf('function');for(const change of [(s:any,h:any)=>h.hp=0,(s:any,h:any)=>h.life='downed',(s:any,h:any)=>h.cloneOf='hunter',(s:any,h:any)=>h.shadowResident=true,(s:any,h:any)=>s.units.push(structuredClone(h)),(s:any,h:any)=>h.ready=.1,(s:any,h:any)=>h.stagger=.1,(s:any,h:any)=>h.forcedMotion={},(s:any,h:any)=>h.crossing={},(s:any,h:any)=>h.attackPending={},(s:any,h:any)=>h.basicAction={},(s:any,h:any)=>h.destination={x:6,y:6},(s:any,h:any)=>h.hunterCombat.hurtUntil=s.time+1,(s:any,h:any)=>h.hunterCombat.finalRecoveryUntil=s.time+1,(s:any,h:any)=>h.pos={x:6,y:8},(s:any,h:any)=>s.tiles.find((t:any)=>t.x===6&&t.y===6).obstacle=true,(s:any,h:any)=>s.tiles.find((t:any)=>t.x===6&&t.y===7).layer=1]){const {s,h}=setup();change(s,h);const before=structuredClone(s);expect(run(s).ok).toBe(false);expect(s).toEqual(before);}
});
test('atomic harvest preflight rejects overflow or malformed duplicate stacks, including zero seed refunds',()=>{
 expect(farm.queryFarmAction).toBeTypeOf('function');for(const corrupt of [(b:any)=>corruptItem(b,'sample-crop',Number.MAX_SAFE_INTEGER),(b:any)=>stock(b,'sample-seed',Number.MAX_SAFE_INTEGER),(b:any)=>corruptItem(b,'sample-seed',1),(b:any)=>corruptItem(b,'sample-crop',-1),(b:any)=>corruptItem(b,'sample-crop',1)]){const {s,b}=setup();plant(s);s.time+=6;corrupt(b);const before=structuredClone(s);expect(run(s).ok).toBe(false);expect(s).toEqual(before);}
 const {s,b}=setup();plant(s);stock(b,'sample-seed',0);s.time+=6;expect(run(s).ok).toBe(true);expect(inventoryQuantity(b,'sample-seed')).toBe(1);
});
test('two independent plots; no-stock and wrong-tool failures; simulation growth freezes on leave and new world resets',()=>{
 expect(farm.queryFarmAction).toBeTypeOf('function');const {s,h,b}=setup();plant(s);const p=s.world!.places[18].farmPlots!,t=s.time;const before=structuredClone(s);b.selectedSlot=1;expect(run(s).ok).toBe(false);b.selectedSlot=0;expect(s).toEqual(before);
 h.pos={x:5,y:8};expect(run(s,req(s,1)).ok).toBe(true);expect(p[0].state).toBe('planted');expect(p[1].state).toBe('tilled');b.selectedSlot=1;stock(b,'sample-seed',0);const empty=structuredClone(s);expect(run(s,req(s,1)).ok).toBe(false);expect(s).toEqual(empty);
 s.units=s.units.filter(u=>u.team==='ally');const w=s.world!,old=req(s,1);expect(leaveWorldArea(s).ok).toBe(true);for(let i=0;i<100;i++)step(s,.1);expect(s.time).toBe(t);expect(continueWorld(s,w.id,w.visit.generation).ok).toBe(true);expect(w.places[18].farmPlots).toBe(p);const continued=structuredClone(s);expect(run(s,old).ok).toBe(false);expect(s).toEqual(continued);
 expect(command(s,{type:'restartWorld',worldId:w.id}).ok).toBe(true);command(s,{type:'carry',gold:0,vitality:0});expect(s.world!.places[18].farmPlots!.every(x=>x.state==='raw')).toBe(true);expect(inventoryQuantity(s.world!.backpack,'sample-seed')).toBe(5);expect(inventoryQuantity(s.world!.backpack,'sample-crop')).toBe(0);
});

test('audited placement excludes illegal floor/events; no plots or inventory on named developer constructors',async()=>{
 const {standaloneDefinition}=await import('../src/core/standalone-exploration');for(const seed of [0,2739,999,123456]){const d=standaloneDefinition(seed);expect(farm.createFarmPlots(d)).toHaveLength(2);const before=structuredClone(d);farm.createFarmPlots(d);expect(d).toEqual(before);d.tiles.find(t=>t.x===6&&t.y===6)!.obstacle=true;expect(farm.createFarmPlots(d)).toEqual([]);}
 const {createEnemyPlaytest}=await import('../src/core/enemy-playtest');const s=createEnemyPlaytest();expect(farm.farmView(s)).toEqual([]);expect(s.world).toBeUndefined();
});
test('death wipe and legal campfire retain plots; actual legal exit/continue preserves remaining growth',()=>{
 const {s,h,al}=setup();plant(s);const p=s.world!.places[18].farmPlots!,b=s.world!.backpack!,enemy=s.units.find(u=>u.team==='enemy')!,old=structuredClone(p);s.units=s.units.filter(u=>u.team==='ally');
 resolveHit(s,h,{...enemy.weapons[0],subtype:'impact'},99999,enemy);resolveHit(s,al,{...enemy.weapons[0],subtype:'impact'},99999,enemy);for(let i=0;i<200;i++)step(s,.01);expect(p).toEqual(old);expect(inventoryQuantity(b,'sample-seed')).toBe(0);expect(Object.values(b.inventory!.items).filter(i=>i.definitionId==='sample-seed'&&i.location.container.startsWith('drop:')).reduce((n,i)=>n+i.quantity,0)).toBe(4);
 const c=s.exploration!.definition.points.find(p=>p.kind==='campfire')!;h.pos={...c.pos};al.pos={x:c.pos.x+.3,y:c.pos.y};h.ready=al.ready=0;expect(command(s,{type:'interactExploration',id:c.id}).ok).toBe(true);expect(p).toEqual(old);
 for(const u of [h,al]){u.pos={...s.exploration!.definition.exit,x:s.exploration!.definition.exit.x+(u===h?0:.8)};u.ready=0;}s.context='explorationIdle';expect(command(s,{type:'exitExploration'}).ok).toBe(true);const time=s.time;for(let i=0;i<100;i++)step(s,.1);expect(s.time).toBe(time);expect(p).toEqual(old);expect(continueWorld(s,s.world!.id,s.world!.visit.generation).ok).toBe(true);expect(s.world!.places[18].farmPlots).toBe(p);expect(inventoryQuantity(b,'sample-seed')).toBe(0);
});
test('duplicate plot IDs, crop selection and missing stock never debit; trace disabled transactions still de-duplicate',()=>{
 const {s,b}=setup();s.world!.places[18].farmPlots!.push(structuredClone(s.world!.places[18].farmPlots![0]));let before=structuredClone(s);expect(run(s).ok).toBe(false);expect(s).toEqual(before);
 const f=setup();changeTeamItems(f.b,[{definitionId:'sample-crop',quantity:1}]);f.b.hotbar[0]='sample-crop';before=structuredClone(f.s);expect(run(f.s).ok).toBe(false);expect(f.s).toEqual(before);f.b.hotbar[0]='sample-tool';stock(f.b,'sample-tool',0);before=structuredClone(f.s);expect(run(f.s).ok).toBe(false);expect(f.s).toEqual(before);
 const g=setup();g.s.combatIdentity!.enabled=false;const token=req(g.s);expect(run(g.s,token).ok).toBe(true);const once=structuredClone(g.s);expect(run(g.s,token).ok).toBe(false);expect(g.s).toEqual(once);
});
