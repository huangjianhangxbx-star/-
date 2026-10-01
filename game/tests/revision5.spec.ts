import {prepareRegression} from './browser-helpers';
import {test,expect} from '@playwright/test';
async function start(page:any){await page.goto('/');await prepareRegression(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();await expect(page.locator('.briefing')).toHaveCount(0);}
test('selected model has operational world skill while detail is descriptive',async({page})=>{
 await start(page);await page.evaluate(()=>{(window as any).prototype.state.units[0].skillCd=0;});const p=await page.evaluate(()=>(window as any).prototype.project((window as any).prototype.state.units[0].pos));await page.mouse.click(p.x,p.y);
 await expect(page.locator('#world-skill [data-skill="hunter"]')).toBeVisible();await expect(page.locator('#unit-detail [data-skill]')).toHaveCount(0);await expect(page.locator('#unit-detail [data-skill-preview]')).toBeVisible();await page.locator('#world-skill [data-skill="hunter"]').click();await expect(page.locator('#time-mode')).toHaveText('');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units[0].skillTime)).toBeGreaterThan(0);
});
test('dash waits for a second directional choice without consuming on target selection',async({page})=>{
 await start(page);const id=await page.evaluate(()=>(window as any).prototype.state.cards.find((c:any)=>c.kind==='dash').id);await page.locator(`[data-card="${id}"]`).click();const p=await page.evaluate(()=>(window as any).prototype.project((window as any).prototype.state.units[0].pos));await page.mouse.click(p.x,p.y);await expect(page.locator('#dash-directions')).toBeVisible();expect(await page.evaluate(id=>(window as any).prototype.state.cards.some((c:any)=>c.id===id),id)).toBe(true);await page.locator('#dash-directions [data-dash="east"]').click();await expect(page.locator('#dash-directions')).toBeHidden();expect(await page.evaluate(id=>(window as any).prototype.state.cards.some((c:any)=>c.id===id),id)).toBe(false);
});

