import {test,expect} from '@playwright/test';
async function open(page:any){await page.goto('/');await page.locator('[data-action="build"]').first().click();await page.locator('[data-build-unit="fiorre"]').click();await page.locator('[data-weapon-index="0"]').click();}
test('prebattle skill selection and in-battle purchases use normal UI',async({page})=>{
 await open(page);await page.locator('[data-config-skill="ward"]').click();await expect(page.locator('#build-panel')).toContainText('伤势');await page.locator('[data-action="close-build"]').click();await page.getByRole('button',{name:'进入战斗',exact:true}).click();
 await page.evaluate(()=>{const s=(window as any).prototype.state;s.fragments=200;s.waves.forEach((w:any)=>w.startAt+=1000);});
 await page.locator('[data-action="build"]').first().click();await page.locator('[data-build-unit="fiorre"]').click();await expect(page.locator('[data-config-skill="prayer"]')).toBeDisabled();
 await page.locator('[data-buy-stage]').click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.fragments)).toBe(176);
 const b=page.locator('[data-buy-branch]');await b.nth(0).click();await b.nth(1).click();await expect(b.nth(2)).toBeDisabled();await expect(page.locator('#build-panel')).toContainText('2 / 2');
 await page.mouse.click(20,100,{button:'right'});await expect(page.locator('#build-panel')).toBeHidden();
});
test('compact build panel is usable and blocks movement input',async({page})=>{
 await page.setViewportSize({width:1000,height:720});await open(page);const box=await page.locator('#build-panel').boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(1000);expect(box!.y+box!.height).toBeLessThanOrEqual(720);
 await page.locator('[data-action="close-build"]').click();await page.getByRole('button',{name:'进入战斗',exact:true}).click();await page.locator('[data-action="build"]').first().click();const before=await page.evaluate(()=>(window as any).prototype.state.units[0].pos.x);await page.keyboard.down('KeyD');await page.waitForTimeout(200);await page.keyboard.up('KeyD');expect(await page.evaluate(()=>(window as any).prototype.state.units[0].pos.x)).toBe(before);
});
test('prebattle dual professions preserve preferences, real battle swaps refresh the equipped skill',async({page})=>{
 await open(page);await page.locator('[data-config-skill="ward"]').click();await page.locator('[data-weapon-index="2"]').click();await expect(page.locator('#build-panel')).toContainText('霜镜使');
 await page.locator('[data-weapon-index="0"]').click();await expect(page.locator('[data-config-skill="ward"]')).toHaveClass(/chosen/);
 await page.locator('[data-action="close-build"]').click();await page.getByRole('button',{name:'进入战斗',exact:true}).click();await page.evaluate(()=>{const s=(window as any).prototype.state;s.units.find((u:any)=>u.id==='fiorre').ready=0;s.waves.forEach((w:any)=>w.startAt+=1000);});
 await page.locator('[data-unit="fiorre"]').click();const p=await page.evaluate(()=>(window as any).prototype.project({x:3,y:4}));await page.mouse.click(p.x,p.y);await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='fiorre').life)).toBe('active');
 await page.locator('[data-action="build"]').first().click();await page.locator('[data-build-unit="fiorre"]').click();await page.locator('[data-weapon-index="2"]').click();expect(await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='fiorre').weaponIndex)).toBe(0);
 await page.locator('[data-action="close-build"]').click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='fiorre').weaponIndex),{timeout:15000}).toBe(2);
 await page.keyboard.press('2');await expect(page.locator('#world-skill .skill-name')).toHaveText('霜镜钟声');
 await page.evaluate(()=>{(window as any).prototype.state.units.find((u:any)=>u.id==='fiorre').skillCd=0;});await page.keyboard.press('KeyE');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='fiorre').skillTime>0)).toBe(true);await expect(page.locator('#time-mode')).toHaveText('');
});
test('unlock presets enforce caps without discarding already purchased branches',async({page})=>{
 await page.goto('/');await page.locator('[data-action="debug"]').click();await page.locator('[data-unlock-preset="starter"]').click();await page.locator('[data-action="build"]').first().click();await page.locator('[data-build-unit="fiorre"]').click();await page.locator('[data-weapon-index="0"]').click();await page.locator('[data-buy-stage]').click();await expect(page.locator('[data-buy-stage]')).toBeDisabled();await expect(page.locator('[data-buy-branch="afterglow"]')).toContainText('局外上限');
 await page.locator('[data-action="close-build"]').click();await page.locator('[data-unlock-preset="expanded"]').click();await page.locator('[data-action="build"]').first().click();await page.locator('[data-build-unit="fiorre"]').click();await expect(page.locator('#build-panel')).toContainText('1 / 2');await expect(page.locator('[data-buy-branch="afterglow"]')).toBeEnabled();
});
test('changing the initial test mode does not refund purchases or erase configured skills',async({page})=>{
 await open(page);await page.locator('[data-config-skill="ward"]').click();await page.locator('[data-buy-stage]').click();await page.locator('[data-action="close-build"]').click();await page.locator('[data-mode="hunter"]').click();
 expect(await page.evaluate(()=>{const s=(window as any).prototype.state,u=s.units.find((u:any)=>u.id==='fiorre');return {id:u.skillId,stage:u.skillStates.ward?.stage,fragments:s.fragments};})).toEqual({id:'ward',stage:1,fragments:16});
});

