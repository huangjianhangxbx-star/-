import {test,expect} from '@playwright/test';
async function start(page:any){await page.goto('/');await page.getByRole('button',{name:'进入战斗',exact:true}).click();}
test('hand remains scene deck exclusive after appended scene cards',async({page})=>{
 await start(page);await page.evaluate(()=>{const s=(window as any).prototype.state;const c=s.cards[0];s.cards=[{...c,id:'e',group:'exclusive'},{...c,id:'d',group:'deck'},{...c,id:'s',group:'scene'}];});
 await expect(page.locator('#cards button small')).toHaveText(['临场','背包','专属']);
});
test('casting from selection exits slow mode and same tile second click cancels',async({page})=>{
 await start(page);await page.locator('[data-unit="hunter"]').click();await page.locator('#skill-hunter').click();await expect(page.locator('#time-mode')).toHaveText('');
 const p=await page.evaluate(()=>(window as any).prototype.project((window as any).prototype.state.units[0].pos));await page.mouse.click(p.x,p.y-15);await expect(page.locator('#time-mode')).toContainText('0.1');await page.mouse.click(p.x,p.y);await expect(page.locator('#time-mode')).toHaveText('');
});
test('manual draw consumes fragments and replaces four deck cards keeping other groups',async({page})=>{
 await start(page);const before=await page.evaluate(()=>{const s=(window as any).prototype.state;return {fragments:s.fragments,deck:s.cards.filter((c:any)=>c.group==='deck').map((c:any)=>c.id),other:s.cards.filter((c:any)=>c.group!=='deck').map((c:any)=>c.id)};});
 await page.getByRole('button',{name:'主动抽卡 · 20碎片',exact:true}).click();const after=await page.evaluate(()=>{const s=(window as any).prototype.state;return {fragments:s.fragments,deck:s.cards.filter((c:any)=>c.group==='deck').map((c:any)=>c.id),other:s.cards.filter((c:any)=>c.group!=='deck').map((c:any)=>c.id)};});
 expect(after.fragments).toBe(before.fragments-20);expect(after.deck).toHaveLength(4);expect(after.deck.some((id:string)=>before.deck.includes(id))).toBe(false);expect(after.other).toEqual(before.other);
});
test('switching to double speed exits selected slow mode and casting keeps double speed',async({page})=>{
 await start(page);await page.locator('[data-unit="hunter"]').click();await expect(page.locator('#time-mode')).toContainText('0.1');await page.locator('#speed-btn').click();await expect(page.locator('#time-mode')).toHaveText('');await expect(page.locator('#speed-btn')).toHaveText('2×');await page.locator('#skill-hunter').click();await expect(page.locator('#speed-btn')).toHaveText('2×');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units[0].skillTime)).toBeGreaterThan(0);
});
