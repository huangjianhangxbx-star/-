import {expect,test} from '@playwright/test';
test('native 4.1 units load on an isolated page and normal input hits a real target',async({page})=>{
 const requests:string[]=[],errors:string[]=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/action-lab.html');await expect(page.locator('#readiness')).toHaveText('原资源就绪');
 await page.getByRole('button',{name:'近身重置'}).click();
 const b=(await page.locator('#arena').boundingBox())!;await page.mouse.move(b.x+b.width*.6,b.y+b.height*.5);await page.mouse.down();
 await expect(page.locator('#enemy-hp')).not.toHaveText('110 / 110');await page.mouse.up();
 await expect(page.locator('#events')).toContainText('damage');
 expect(requests.some(r=>r.includes('spine-webgl-4.1.56'))).toBe(true);
 expect(requests.some(r=>r.includes('/src/main.ts')||r.includes('spine-canvas.js'))).toBe(false);expect(errors).toEqual([]);
});
test('whiff, pause and reset never manufacture HP changes or retain held input',async({page})=>{
 await page.goto('/action-lab.html');await expect(page.locator('#readiness')).toHaveText('原资源就绪');
 const b=(await page.locator('#arena').boundingBox())!;await page.mouse.move(b.x+b.width*.1,b.y+b.height*.5);await page.mouse.down();await page.waitForTimeout(300);await page.mouse.up();
 await expect(page.locator('#enemy-hp')).toHaveText('110 / 110');
 await page.getByRole('button',{name:'暂停',exact:true}).click();await expect(page.locator('#input-state')).toContainText('暂停');
 await page.getByRole('button',{name:'重置',exact:true}).click();await page.waitForTimeout(400);
 await expect(page.locator('#events')).not.toContainText('accepted');await expect(page.locator('#enemy-hp')).toHaveText('110 / 110');
});
test('normal held attack reaches death and reset restores two living actors',async({page})=>{
 await page.goto('/action-lab.html');await expect(page.locator('#readiness')).toHaveText('原资源就绪');await page.getByRole('button',{name:'近身重置'}).click();
 const b=(await page.locator('#arena').boundingBox())!;await page.mouse.move(b.x+b.width*.62,b.y+b.height*.5);await page.mouse.down();
 await expect(page.locator('#outcome')).toContainText('僵尸倒下',{timeout:15000});await page.mouse.up();await page.getByRole('button',{name:'重置',exact:true}).click();
 await expect(page.locator('#enemy-hp')).toHaveText('110 / 110');await expect(page.locator('#blue-hp')).toHaveText('100 / 100');
});
test('movement works after reset-button focus and blur cannot revive held attack',async({page})=>{
 await page.goto('/action-lab.html');await expect(page.locator('#readiness')).toHaveText('原资源就绪');await page.getByRole('button',{name:'重置',exact:true}).click();
 await expect(page.locator('#position')).toHaveText('-2.00, 0.00');
 const before=await page.locator('#position').textContent();await page.keyboard.down('KeyW');await page.waitForTimeout(180);await page.keyboard.up('KeyW');
 expect(await page.locator('#position').textContent()).not.toBe(before);
 const b=(await page.locator('#arena').boundingBox())!;await page.mouse.move(b.x+b.width*.1,b.y+b.height*.5);await page.mouse.down();
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();await expect(page.locator('#input-state')).toHaveText('暂停');
 await page.getByRole('button',{name:'重置',exact:true}).click();await page.waitForTimeout(350);await expect(page.locator('#events')).not.toContainText('accepted');
});
test('a missing native skeleton prevents play and reports the missing resource',async({page})=>{
 await page.route('**/__al01-assets/zombie/unit.json',route=>route.fulfill({status:404,body:'missing evaluation asset'}));
 await page.goto('/action-lab.html');await expect(page.locator('#readiness')).toHaveText('资源未就绪');
 await expect(page.locator('#outcome')).toContainText('unit.json');
 const b=(await page.locator('#arena').boundingBox())!;await page.mouse.click(b.x+b.width*.6,b.y+b.height*.5);await page.waitForTimeout(100);
 await expect(page.locator('#enemy-hp')).toHaveText('110 / 110');await expect(page.locator('#events')).toHaveText('');
});
