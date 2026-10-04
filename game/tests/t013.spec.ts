import {test,expect,type Page} from '@playwright/test';
async function nodeMap(page:Page){await page.goto('/');await page.locator('[data-action="carry"]').click();await page.evaluate(()=>{const s=(window as any).prototype.state;s.completed.push(1);s.phase='nodes';});}
for(const width of [1440,1000])test(`normal exploration entry exposes objectives and party controls at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:width===1000?720:900});await nodeMap(page);
 await expect(page.locator('[data-node="4"]')).toBeVisible();await page.locator('[data-node="4"]').click();
 await expect(page.locator('#exploration-status')).toBeVisible();await expect(page.locator('#exploration-exit')).toBeEnabled();
 await page.locator('[data-unit="hunter"]').click();await expect(page.locator('.crystal')).toBeHidden();await expect(page.locator('[data-party="recall"]')).toBeInViewport();
 await page.screenshot({path:`../记录/验证/T-013/exploration-entry-${width}.png`});
 await page.locator('#exploration-exit').click();await expect(page.locator('[data-node="4"]')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).prototype.state.completed.includes(4))).toBe(false);
});
test('party shortcut and click use normal control while modal cancellation preserves default speed',async({page})=>{
 await nodeMap(page);await page.locator('[data-node="4"]').click();await page.locator('[data-action="speed"]').click();
 await page.evaluate(async()=>{const {command}=await import('/src/core/engine.ts' as string),s=(window as any).prototype.state;s.units.find((u:any)=>u.id==='ines').ready=0;command(s,{type:'deploy',id:'ines',to:{x:4,y:16},facing:'east'});});
 await page.keyboard.press('h');expect(await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ines').life)).toBe('withdrawn');
 await page.evaluate(()=>{const s=(window as any).prototype.state,u=s.units.find((u:any)=>u.id==='ines');u.life='downed';u.hp=0;u.downTimer=45;u.pos={x:3,y:16};});
 await page.locator('#exploration-exit').click();await expect(page.locator('#exploration-exit-confirm')).toBeVisible();await expect(page.locator('#exploration-abandon-list')).toContainText('伊内丝');
 await page.locator('[data-action="cancel-exploration-exit"]').click();await expect(page.locator('#speed-btn')).toHaveText('2×');expect(await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ines').life)).toBe('downed');
});
