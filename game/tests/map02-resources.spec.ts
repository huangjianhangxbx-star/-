import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
test('resource fixture: concurrent actor prepare shares ownership and cancellation rejects late compile',async({page})=>{
 test.setTimeout(45000);await page.goto('/?scene2d=1');await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.effectiveTimeScale),{timeout:20000}).toBeGreaterThan(0);
 expect(await page.evaluate(()=>{const v=(window as any).prototype.scene;return v.scene.children.filter((o:any)=>o.isMesh&&![...v.unitVisuals.values()].some((a:any)=>a.mesh===o)).length;})).toBe(0);
 await page.evaluate(async()=>{const w=window as any,p=w.prototype,{makePlace}=await import('/src/core/map-place.ts' as string),{MAPS}=await import('/src/core/map-definitions.ts' as string),u=makePlace(p.state,MAPS[102]).unloadedEnemies[0];u.id+=':lease-fixture';p.travel.phase='prepare';const view=p.scene,renderer=view.renderer,original=renderer.compileAsync.bind(renderer);w.__lease={id:u.id,calls:0,before:view.metrics,original};const gate=new Promise<void>(r=>w.__lease.release=r);renderer.compileAsync=()=>{w.__lease.calls++;return gate;};w.__lease.tasks=[view.prepareUnit(u),view.prepareUnit(u)];w.__lease.results=Promise.allSettled(w.__lease.tasks);});
 await expect.poll(()=>page.evaluate(()=>(window as any).__lease.calls),{timeout:15000}).toBeGreaterThan(0);expect(await page.evaluate(()=>(window as any).__lease.calls)).toBe(1);
 const result=await page.evaluate(async()=>{const w=window as any,p=w.prototype,l=w.__lease;p.scene.cancelPreparedUnit(l.id);l.release();const results=await l.results;p.scene.renderer.compileAsync=l.original;p.travel.phase='idle';return {statuses:results.map((r:any)=>r.status),actor:p.scene.unitVisuals.has(l.id),reference:p.scene.references.has(l.id),materialsBefore:l.before.materials,materialsAfter:p.scene.metrics.materials,partyReady:p.state.units.filter((u:any)=>u.id==='hunter'||u.id==='ranger').every((u:any)=>p.scene.actorReady(u.id))};});
 expect(result.statuses).toEqual(['rejected','rejected']);expect(result.actor).toBe(false);expect(result.reference).toBe(false);expect(result.materialsAfter).toBe(result.materialsBefore);expect(result.partyReady).toBe(true);
});
test('resource fixture: two run lifecycles keep GPU leases bounded and preserve old instance records',async({page})=>{
 test.setTimeout(120000);await page.goto('/?scene2d=1');await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.effectiveTimeScale),{timeout:20000}).toBeGreaterThan(0);
 const evidence=await page.evaluate(async()=>{
  const p=(window as any).prototype,s=p.state,{MAP_EDGES}=await import('/src/core/map-definitions.ts' as string),{ensureChallengeRun,mapEdges}=await import('/src/core/map-runs.ts' as string),{syncMapDeaths}=await import('/src/core/map-travel.ts' as string);await p.travel.request(MAP_EDGES[0]);
  const runs:any[]=[],world=s.world,bag=world.backpack,items=Object.keys(bag.inventory.items).sort();let firstFloor:any;
  for(let n=0;n<2;n++){
   const run=ensureChallengeRun(s,321+n);if(!firstFloor)firstFloor=world.places[run.floors[0]];
   const entry=mapEdges(s).find((e:any)=>e.challengeEntry);await p.travel.request(entry);
   const rows:any[]=[];
   for(let i=0;i<5;i++){
    // Explicit state fixture for resource/identity boundaries; this is NOT the natural five-floor story.
    for(const u of s.units)if(u.team==='enemy')u.life='dead';syncMapDeaths(s);await p.travel.request(mapEdges(s)[0]);
    rows.push({floor:i+1,debug:p.mapDebug,metrics:p.scene.metrics,references:p.scene.references.size,actorLoads:p.scene.actorLoads.size});
   }
   runs.push({id:run.id,seed:run.seed,counts:run.counts,floors:run.floors,status:run.status,rows,home:{metrics:p.scene.metrics,refs:p.scene.references.size,bars:document.querySelectorAll('[data-enemy-hp]').length}});
  }
  return {method:'explicit death/portal state fixture, not real combat or second-run completion evidence',runs,sameWorld:s.world===world,sameBag:s.world.backpack===bag,sameItems:JSON.stringify(Object.keys(bag.inventory.items).sort())===JSON.stringify(items),oldPlaceStillPresent:Object.values(world.places).includes(firstFloor),remainingRuns:Object.keys(world.mapRuns.runs).length};
 });
 mkdirSync('../work/MAP-02',{recursive:true});writeFileSync('../work/MAP-02/two-run-resources.json',JSON.stringify(evidence,null,2));expect(evidence.sameWorld&&evidence.sameBag&&evidence.sameItems&&evidence.oldPlaceStillPresent).toBe(true);expect(evidence.remainingRuns).toBe(2);expect(evidence.runs[0].id).not.toBe(evidence.runs[1].id);
 for(const run of evidence.runs){expect(run.status).toBe('completed');expect(run.rows.every((r:any)=>r.debug.resources.residentMaps<=3&&r.actorLoads===0)).toBe(true);}
 expect(evidence.runs[1].home.metrics.textures).toBe(evidence.runs[0].home.metrics.textures);expect(evidence.runs[1].home.refs).toBe(evidence.runs[0].home.refs);
});
