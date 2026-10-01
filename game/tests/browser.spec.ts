import {prepareRegression} from './browser-helpers';
import {selectModel} from './browser-helpers';
import {test,expect} from '@playwright/test';
test('start renders a battlefield and pause stops simulation',async({page})=>{
 await page.goto('/');await prepareRegression(page);
 await page.getByRole('button',{name:'进入战斗',exact:true}).click();
 await expect(page.locator('#battle-status')).toContainText('战斗');
 await expect(page.locator('#scene canvas').first()).toBeVisible();
 await page.getByRole('button',{name:'暂停',exact:true}).click();
 const before=await page.locator('#clock').innerText();
 await page.waitForTimeout(500);
 expect(await page.locator('#clock').innerText()).toBe(before);
});
test('click move submits without direction confirmation',async({page})=>{
 await page.goto('/');await prepareRegression(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();await selectModel(page,'hunter');
 const p=await page.evaluate(()=> (window as any).prototype.project({x:4,y:4}));await page.mouse.click(p.x,p.y);
 await expect(page.locator('#direction-panel')).toHaveCount(0);expect(await page.evaluate(()=> (window as any).prototype.interaction.stage)).toBe('idle');
});
test('deployment warmup then deploy and quick drag commits without direction dialog',async({page})=>{
 await page.goto('/');await prepareRegression(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();
 await page.evaluate(async()=>{const {step}=await import('/src/core/engine.ts' as string);step((window as any).prototype.state,6.1)});
 expect(await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ranger').ready)).toBe(0);
 await page.locator('[data-unit="ranger"]').click();
 const p=await page.evaluate(()=> (window as any).prototype.project({x:5,y:4}));await page.mouse.click(p.x,p.y);

 await expect.poll(()=>page.evaluate(()=> (window as any).prototype.state.units.find((u:any)=>u.id==='ranger').life)).toBe('active');
 await page.waitForTimeout(700);
 const from=await page.evaluate(()=> (window as any).prototype.project({x:5,y:4}));
 // Foot positions select unit using occupied tile even if alpha at exact foot is transparent.
 await page.mouse.move(from.x,from.y);await page.mouse.down();
 const to=await page.evaluate(()=> (window as any).prototype.project({x:6,y:4}));await page.mouse.move(to.x,to.y,{steps:12});await page.mouse.up();
 await expect(page.locator('#direction-panel')).toBeHidden();
 await expect.poll(()=>page.evaluate(()=> (window as any).prototype.state.units.find((u:any)=>u.id==='ranger').destination?.x)).toBeCloseTo(6,1);
});
test('refresh keeps scene and exclusive cards and invalid card use keeps hand',async({page})=>{
 await page.goto('/');await prepareRegression(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();
 const ids=await page.evaluate(()=> (window as any).prototype.state.cards.filter((c:any)=>c.group!=='deck').map((c:any)=>c.id));
 await page.getByRole('button',{name:'抽一张 · 10生命力',exact:true}).click();
 expect(await page.evaluate(()=> (window as any).prototype.state.cards.filter((c:any)=>c.group!=='deck').map((c:any)=>c.id))).toEqual(ids);
 await page.locator(`[data-card="${ids[0]}"]`).click();
 const p=await page.evaluate(()=> (window as any).prototype.project({x:11,y:7}));await page.mouse.click(p.x,p.y);
 expect(await page.evaluate((id)=> (window as any).prototype.state.cards.some((c:any)=>c.id===id),ids[0])).toBe(true);
});

test('node reentry preparation cannot reset the expedition through mode selection',async({page})=>{
 await page.goto('/');await prepareRegression(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();
 await page.evaluate(()=>{const s=(window as any).prototype.state;s.phase='briefing';s.node=3;s.retries=1;s.completed=[1,2];s.units[0].hp=17;});
 await expect(page.locator('[data-mode]')).toHaveCount(0);
 expect(await page.evaluate(()=> (window as any).prototype.state.units[0].hp)).toBe(17);
});
test('right click cancels interaction and returns the chosen double speed',async({page})=>{
 await page.goto('/');await prepareRegression(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();
 await page.locator('#speed-btn').click();await selectModel(page,'hunter');
 await page.mouse.click(800,400,{button:'right'});
 await expect(page.locator('#speed-btn')).toHaveText('2×');
 await expect(page.locator('#time-mode')).toHaveText('');
});
