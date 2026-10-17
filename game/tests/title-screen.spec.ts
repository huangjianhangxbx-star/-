import {test,expect} from '@playwright/test';
test('title idle, keyboard menu, disabled placeholders and real start',async({page})=>{
 await page.goto('/?scene2d=1');
 await expect(page.locator('[data-title-screen]')).toBeVisible();
 await expect(page.getByText('点击屏幕开始',{exact:true})).toBeVisible();
 await page.keyboard.press('Enter');
 await expect(page.getByRole('button',{name:'读取游戏',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'画廊',exact:true})).toBeDisabled();
 await page.keyboard.press('Escape');
 await expect(page.getByText('点击屏幕开始',{exact:true})).toBeVisible();
 await page.mouse.click(400,400);
 await page.getByRole('button',{name:'开始游戏',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.phase)).toBe('battle');
 await expect(page.locator('[data-title-screen]')).toBeHidden();
});

test('F10 monitors the parent and still exposes the isolated debug entry',async({page})=>{
 await page.goto('/?scene2d=1');await page.keyboard.press('F10');
 await expect(page.getByText('F10 · 现场音频监控')).toBeVisible();
 await page.locator('[data-old-debug]').click();
 const debug=page.frameLocator('[data-title-debug]');
 await expect(debug.locator('[data-action=carry]')).toBeVisible();
 await debug.locator('.test-resources summary').click();
 await debug.locator('#carry-gold').fill('0');
 await debug.locator('[data-action=carry]').click();
 await expect.poll(()=>page.frames()[1].evaluate(()=>(window as any).prototype?.state.phase)).toBe('battle');
 await page.keyboard.press('F10');
 await expect(page.locator('[data-title-debug]')).toHaveCount(0);
 await expect(page.getByText('点击屏幕开始',{exact:true})).toBeVisible();
 await page.keyboard.press('Space');await page.getByRole('button',{name:'开始游戏',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.phase)).toBe('battle');
 const world=await page.evaluate(()=>(window as any).prototype.state.world.id);
 await page.keyboard.press('F10');await expect(page.getByText('F10 · 现场音频监控')).toBeVisible();
 await page.getByRole('button',{name:'关闭 · F10'}).click();
 expect(await page.evaluate(()=>(window as any).prototype.state.world.id)).toBe(world);
 await expect(page.locator('[data-title-screen]')).toBeHidden();
});

test('title artwork renders and stays inside narrow and wide viewports',async({page})=>{
 await page.goto('/?scene2d=1');
 for(const width of [1280,1920]){
  await page.setViewportSize({width,height:900});
  await expect(page.locator('[data-title-screen]')).toBeVisible();
  await page.screenshot({path:`docs/tasks/TITLE-01/implementation-idle-${width}.png`});
  await page.keyboard.press('Enter');
  const button=page.getByRole('button',{name:'开始游戏',exact:true});
  const box=await button.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  await page.screenshot({path:`docs/tasks/TITLE-01/implementation-menu-${width}.png`});
  await page.keyboard.press('Escape');
 }
});


test('F10 restores both paused and running sessions',async({page})=>{
 await page.goto('/?scene2d=1');await page.keyboard.press('Enter');await page.getByRole('button',{name:'开始游戏',exact:true}).click();
 await expect(page.locator('#pause-btn')).toHaveText('暂停');
 await page.keyboard.press('Space');await expect(page.locator('#pause-btn')).toHaveText('继续');
 await page.keyboard.press('F10');await expect(page.getByText('F10 · 现场音频监控')).toBeVisible();
 await page.locator('[data-old-debug]').click();await expect(page.frameLocator('[data-title-debug]').locator('[data-action=carry]')).toBeVisible();
 await page.screenshot({path:'docs/tasks/TITLE-01/implementation-debug.png'});
 await page.getByRole('button',{name:'返回 · F10'}).click();await expect(page.locator('#pause-btn')).toHaveText('继续');
 await page.keyboard.press('Space');await expect(page.locator('#pause-btn')).toHaveText('暂停');
 await page.keyboard.press('F10');await expect(page.locator('#pause-btn')).toHaveText('暂停');
 await page.getByRole('button',{name:'关闭 · F10'}).click();await expect(page.locator('#pause-btn')).toHaveText('暂停');
});
