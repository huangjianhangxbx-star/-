import {test,expect} from '@playwright/test';
async function start(page:any){await page.goto('/');await page.getByRole('button',{name:'进入战斗',exact:true}).click();await page.getByRole('button',{name:'暂停',exact:true}).click();}
test('drag held shows planned route before release',async({page})=>{
 await start(page);await page.waitForTimeout(900);
 const a=await page.evaluate(()=>(window as any).prototype.project({x:2,y:4}));const b=await page.evaluate(()=>(window as any).prototype.project({x:5,y:4}));
 await page.mouse.move(a.x,a.y-20);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});
 await expect(page.locator('#move-route')).toHaveCSS('display','inline');await expect(page.locator('#move-route')).toHaveCSS('stroke-width','3px');await expect(page.locator('#move-route')).not.toHaveAttribute('d','');
 await page.mouse.up();await expect(page.locator('#direction-panel')).toBeHidden();
});
test('downed companion has nearby rescue that sends hunter',async({page})=>{
 await start(page);await page.evaluate(()=>{const u=(window as any).prototype.state.units.find((u:any)=>u.id==='guard');u.life='downed';u.hp=0;u.downTimer=40;u.pos={x:4,y:4};u.drawPos={...u.pos};});
 await expect(page.locator('[data-world-rescue="guard"]')).toBeVisible();await page.locator('[data-world-rescue="guard"]').click();
 expect(await page.evaluate(()=>(window as any).prototype.state.units[0].rescueTarget)).toBe('guard');
});
test('card chain follows cursor and cancels without consumption',async({page})=>{
 await start(page);await page.locator('[data-card]').first().click();await page.mouse.move(700,330);
 await expect(page.locator('#card-chain')).toBeVisible();await expect(page.locator('#card-chain')).not.toHaveAttribute('d','');
 const before=await page.locator('[data-card]').count();await page.mouse.click(700,330,{button:'right'});await expect(page.locator('#card-chain')).toBeHidden();expect(await page.locator('[data-card]').count()).toBe(before);
});


test('card resolves only the indicated target, not a stale selection',async({page})=>{
 await start(page);await page.locator('[data-unit="hunter"]').click();
 const id=await page.evaluate(()=>{const s=(window as any).prototype.state;s.units[0].hp=70;return s.cards.find((c:any)=>c.kind==='heal').id;});
 await page.locator(`[data-card="${id}"]`).click();const empty=await page.evaluate(()=>(window as any).prototype.project({x:5,y:4}));await page.mouse.click(empty.x,empty.y);
 expect(await page.evaluate(()=>(window as any).prototype.state.units[0].hp)).toBe(70);
 expect(await page.locator(`[data-card="${id}"]`).count()).toBe(1);
 await page.locator(`[data-card="${id}"]`).click();
 const ally=await page.evaluate(()=>(window as any).prototype.project({x:2,y:4}));await page.mouse.click(ally.x,ally.y-15);
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units[0].hp)).toBe(115);
 await expect(page.locator('#card-chain')).toBeHidden();
});
