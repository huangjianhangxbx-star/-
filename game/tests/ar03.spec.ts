import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';

test('AR03 normal whiff reaches one Runtime Finish, then resets across worlds',async({page})=>{
 test.setTimeout(60000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('[data-journey="exploration"]').click();await page.locator('[data-companion="ranger"]').click();await page.locator('[data-action="carry"]').click();await page.locator('[data-action="pause"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.terrain.userData.loaded),{timeout:45000}).toBe(true);
 const point=await page.evaluate(()=>{const p=(window as any).prototype,h=p.state.units.find((u:any)=>u.id==='hunter');
  for(const tile of p.state.tiles){const d=Math.hypot(tile.x-h.pos.x,tile.y-h.pos.y);if(d<1||d>3||tile.obstacle)continue;
   const q=p.project(tile),hit=p.scene.pick(q.x,q.y);if(hit.tile&&!hit.unitId&&document.elementFromPoint(q.x,q.y)?.closest('#scene')&&!p.state.exploration.definition.points.some((a:any)=>Math.hypot(a.pos.x-tile.x,a.pos.y-tile.y)<1))return q;
  }throw Error('no free ground for real input');
 });
 await page.keyboard.press('Space');await page.mouse.click(point.x,point.y);
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.combatIdentity?.trace.some((r:any)=>r.type==='attack-released'&&r.context?.actorId==='hunter'))).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.combatIdentity?.trace.some((r:any)=>r.type==='action-finished'&&r.context?.actorId==='hunter'&&r.context?.kind==='basic')),{timeout:15000}).toBe(true);
 const terminal=await page.evaluate(()=>{const rows=(window as any).prototype.state.combatIdentity.trace,starts=rows.filter((r:any)=>r.type==='action-started'&&r.context.actorId==='hunter'),id=starts[0].context.actionId;return rows.filter((r:any)=>r.context?.actionId===id).map((r:any)=>r.type);});
 expect(terminal.filter((type:string)=>type==='action-started')).toHaveLength(1);expect(terminal.filter((type:string)=>type==='attack-released')).toHaveLength(1);expect(terminal.filter((type:string)=>type==='action-finished')).toHaveLength(1);expect(terminal.filter((type:string)=>type==='hit-outcome')).toHaveLength(0);
 await page.keyboard.press('Space');const paused=await page.evaluate(()=>(window as any).prototype.state.time);await page.waitForTimeout(150);expect(await page.evaluate(()=>(window as any).prototype.state.time)).toBe(paused);
 const snapshot=await page.evaluate(async()=>{const {combatTraceSnapshot}=await import('/src/core/combat-identity.ts' as string);return combatTraceSnapshot((window as any).prototype.state);});
 expect(snapshot.some((r:any)=>r.type==='action-started'&&r.context.requestSource==='player-input')).toBe(true);
 mkdirSync('../work/AR-03',{recursive:true});writeFileSync('../work/AR-03/browser-trace.json',JSON.stringify(snapshot,null,2));await page.screenshot({path:'../work/AR-03/main-smoke.png'});
 await page.locator('[data-action="debug"]').click();await page.locator('[data-action="end-expedition"]').click();await page.locator('[data-action="new"]').click();
 expect(await page.evaluate(()=>(window as any).prototype.state.combatIdentity?.trace.length??0)).toBe(0);
 // Tower controls remain the existing controls; no injected result or debug combat call.
 await page.locator('[data-journey="tower"]').click();await page.locator('[data-action="carry"]').click();await page.locator('[data-action="start"]').click();
 await page.locator('[data-action="abandon-battle"]').click();await page.locator('[data-action="confirm-economic"]').click();await page.locator('[data-action="continue"]').click();await page.locator('[data-node="1"]').click();
 expect(await page.evaluate(()=>(window as any).prototype.state.phase)).toBe('briefing');expect(await page.evaluate(()=>(window as any).prototype.state.combatIdentity?.trace.length??0)).toBe(0);expect(errors).toEqual([]);
});
