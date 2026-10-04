import {prepareRegression} from './browser-helpers';
import {selectModel} from './browser-helpers';
import {test,expect} from '@playwright/test';
async function start(page:any){await page.goto('/');await prepareRegression(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();}
test('click move has no direction stage and blank click clears slow time',async({page})=>{
 await start(page);await selectModel(page,'hunter');const q=await page.evaluate(()=>(window as any).prototype.project({x:4,y:4}));await page.mouse.click(q.x,q.y);await expect(page.locator('#direction-panel')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).prototype.interaction.stage)).toBe('idle');
 await selectModel(page,'hunter');await page.mouse.click(1100,95);await expect(page.locator('#time-mode')).toHaveText('');
});
test('selected character shows portrait and clickable millisecond filled skill',async({page})=>{
 await start(page);await selectModel(page,'hunter');await expect(page.locator('#unit-detail .detail-portrait')).toBeVisible();
 const skill=page.locator('#world-skill-button');await expect(skill).toBeVisible();await skill.click();await expect(page.locator('#unit-detail')).toBeHidden();await selectModel(page,'hunter',false);await expect(page.locator('#world-skill-button .skill-clock')).toHaveText(/\d+\.\d{3}s/);await expect(page.locator('#world-skill-button .skill-fill')).toBeVisible();
});
test('pointing move at crystal no longer offers retired retreat',async({page})=>{
 await start(page);await selectModel(page,'hunter');const p=await page.evaluate(()=>(window as any).prototype.project((window as any).prototype.state.goal));await page.mouse.click(p.x,p.y);
 await expect(page.locator('#crystal-retreat')).toBeHidden();expect(await page.evaluate(()=>(window as any).prototype.state.units[0].life)).toBe('active');expect(await page.evaluate(()=>(window as any).prototype.state.units[0].intent)).not.toBe('gate');
});
test('card tray and skill controls are large enough to interact',async({page})=>{
 await start(page);const b=await page.locator('[data-card]').first().boundingBox();expect(b!.height).toBeGreaterThan(130);expect(b!.width).toBeGreaterThan(75);await selectModel(page,'hunter');const skill=await page.locator('#world-skill-button').boundingBox();expect(skill!.height).toBeGreaterThan(40);
});
test('new movement after pointing at crystal remains ordinary movement',async({page})=>{
 await start(page);await selectModel(page,'hunter');const g=await page.evaluate(()=>(window as any).prototype.project((window as any).prototype.state.goal));await page.mouse.click(g.x,g.y);await expect(page.locator('#crystal-retreat')).toBeHidden();await page.keyboard.press('1');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.interaction.selectedId)).toBe('hunter');
 const p=await page.evaluate(()=>(window as any).prototype.project({x:4,y:4}));await page.mouse.click(p.x,p.y);await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units[0].destination?.x)).toBeCloseTo(4,1);
});
test('refreshing away selected card releases orphaned slow targeting',async({page})=>{
 await start(page);const id=await page.evaluate(()=>(window as any).prototype.state.cards.find((c:any)=>c.group==='deck').id);await page.locator(`[data-card="${id}"]`).click();await page.getByRole('button',{name:'抽一张 · 10生命力',exact:true}).click();await expect(page.locator('#time-mode')).toHaveText('');
});
test('short support skill starts with a nearly full duration fill',async({page})=>{
 await start(page);await page.evaluate(()=>{const s=(window as any).prototype.state;const f=s.units.find((u:any)=>u.id==='fiorre');f.weaponIndex=0;f.skillId='prayer';f.life='active';f.ready=0;});await page.evaluate(()=>{const s=(window as any).prototype.state;const f=s.units.find((u:any)=>u.id==='fiorre');f.life='active';f.ready=0;f.pos={x:4,y:4};f.drawPos={...f.pos};});await selectModel(page,'fiorre');await page.locator('#world-skill-button').click();await selectModel(page,'fiorre',false);
 await expect(page.locator('#world-skill-button .skill-clock')).toHaveText(/\d+\.\d{3}s/);
 const ratio=await page.locator('#world-skill-button .skill-fill').evaluate(el=>el.getBoundingClientRect().height/el.parentElement!.getBoundingClientRect().height);expect(ratio).toBeGreaterThan(.8);
});

