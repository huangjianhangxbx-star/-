import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
test('bounded five-body native encounter main-thread CPU observation without game writes',async({page,context})=>{
 test.setTimeout(60000);await page.goto('/?enemies=v2&mode=five');await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.time??0),{timeout:35000}).toBeGreaterThan(0);await page.keyboard.press('z');await page.mouse.move(900,400);await page.mouse.down({button:'right'});const cdp=await context.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');await page.waitForTimeout(10000);const result=await cdp.send('Profiler.stop');await page.mouse.up({button:'right'});mkdirSync('../work/EN-06/performance',{recursive:true});writeFileSync('../work/EN-06/performance/five-main-thread.cpuprofile',JSON.stringify(result.profile));await cdp.detach();expect(result.profile.samples.length).toBeGreaterThan(0);
});
