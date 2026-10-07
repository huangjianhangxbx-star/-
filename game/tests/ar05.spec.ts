import {test,expect} from '@playwright/test';
test('main Hunter Blue41 coexists with partner38 and uses native four stage input',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('[data-journey="exploration"]').click();await page.locator('[data-companion="ranger"]').click();await page.locator('[data-action="carry"]').click();await page.locator('[data-action="pause"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('hunter')?.reference?.ready),{timeout:12000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('ranger')?.spine?.names?.includes('attack_01'))).toBe(true);
 expect(await page.evaluate(()=>!!(window as any).spine.canvas)).toBe(true);
 const point=await page.evaluate(()=>{const p=(window as any).prototype,h=p.state.units.find((u:any)=>u.id==='hunter');for(const t of p.state.tiles){const d=Math.hypot(t.x-h.pos.x,t.y-h.pos.y);if(d<1||d>3||t.obstacle)continue;const q=p.project(t),hit=p.scene.pick(q.x,q.y);if(hit.tile&&!hit.unitId&&document.elementFromPoint(q.x,q.y)?.closest('#scene'))return q;}throw Error('no ground tile');});
 await page.keyboard.press('Space');await page.mouse.move(point.x,point.y);await page.mouse.down();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').hunterCombat?.trace.filter((r:any)=>r.kind==='accepted'&&r.stage!==undefined).length),{timeout:25000}).toBeGreaterThanOrEqual(4);await page.mouse.up();
 const stages=await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').hunterCombat.trace.filter((r:any)=>r.kind==='accepted'&&r.stage!==undefined).slice(0,4).map((r:any)=>r.stage));expect(stages).toEqual([0,1,2,3]);
 await page.keyboard.press('Space');const before=await page.evaluate(()=>(window as any).prototype.state.time);await page.waitForTimeout(150);expect(await page.evaluate(()=>(window as any).prototype.state.time)).toBe(before);expect(errors).toEqual([]);
 await page.screenshot({path:'../work/AR-05/main-hunter.png'});
});

test('E release, Shift dodge, RMB guard and switch preserve the native runtime without old skill slots',async({page})=>{
 test.setTimeout(60000);await page.goto('/');await page.locator('[data-journey="exploration"]').click();await page.locator('[data-companion="ranger"]').click();await page.locator('[data-action="carry"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('hunter')?.reference?.ready)).toBe(true);
 const point=await page.evaluate(()=>{const p=(window as any).prototype,h=p.state.units.find((u:any)=>u.id==='hunter');return p.project({x:h.pos.x+1,y:h.pos.y});});await page.mouse.move(point.x,point.y);await page.keyboard.down('e');
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').hunterCombat?.special?.kind)).toBe('prepare');await page.waitForTimeout(220);await page.keyboard.up('e');
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').hunterCombat?.activeCharge)).toBe(0);
 await page.keyboard.press('c');const actor=await page.evaluate(()=>(window as any).prototype.state.controlledBodyId);expect(actor).toBe('ranger');await page.keyboard.press('c');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').hunterCombat?.special),{timeout:10000}).toBeUndefined();
 await page.keyboard.press('Shift');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').hunterCombat?.dodgeCharges)).toBe(1);await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').hunterCombat?.special),{timeout:10000}).toBeUndefined();const guardPoint=await page.evaluate(()=>{const p=(window as any).prototype,h=p.state.units.find((u:any)=>u.id==='hunter');return p.project(h.pos);});await page.mouse.move(guardPoint.x,guardPoint.y);
 await page.mouse.down({button:'right'});await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').hunterCombat?.special?.kind)).toBe('guard');await page.mouse.up({button:'right'});
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').hunterCombat?.special)).toBeUndefined();
 expect(await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').skillSlots)).toEqual([null,null,null]);
 await page.keyboard.press('Space');await page.screenshot({path:'../work/AR-05/main-active-controls.png'});
});
test('missing native resources fail explicitly instead of falling back to Galore',async({page})=>{
 await page.route('**/__al01-assets/blue/unit.json',r=>r.fulfill({status:404,body:'unavailable'}));await page.goto('/');await page.locator('[data-journey="exploration"]').click();await page.locator('[data-companion="ranger"]').click();await page.locator('[data-action="carry"]').click();await expect(page.locator('#error')).toContainText('Hunter Reference assets unavailable');
 expect(await page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('hunter')?.spine)).toBeUndefined();
});
