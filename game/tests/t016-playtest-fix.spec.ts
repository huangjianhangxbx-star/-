import {test,expect} from '@playwright/test';

test('held WASD stops at broken posture and resumes only while physically held after recovery',async({page})=>{
 await page.goto('/');await page.locator('[data-action="carry"]').click();await page.locator('[data-action="start"]').click();
 const start=await page.evaluate(()=>{const s=(window as any).prototype.state,h=s.units[0];h.pos={x:4,y:4};h.drawPos={...h.pos};h.posture=0;h.postureDelay=4;return {...h.pos};});
 await page.keyboard.down('w');await expect(page.locator('#notice')).toContainText('架势崩溃');await page.waitForTimeout(200);
 expect(await page.evaluate(()=>(window as any).prototype.state.units[0].pos)).toEqual(start);
 await page.evaluate(()=>{const h=(window as any).prototype.state.units[0];h.posture=1;h.postureDelay=4;});
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units[0].pos.y)).toBeLessThan(start.y-.05);
 await page.keyboard.up('w');
});

test('shieldguard Brace is visible in the existing developer panel',async({page})=>{
 await page.goto('/');await page.locator('[data-action="carry"]').click();await page.locator('[data-action="start"]').click();await page.locator('[data-action="pause"]').click();await page.locator('[data-action="debug"]').click();
 await page.evaluate(async()=>{const s=(window as any).prototype.state,{step}=await import('/src/core/engine.ts' as string),g=s.units.find((u:any)=>u.id==='ines');s.waveState=null;s.waves=[];s.totalEnemies=999;g.life='active';g.ready=0;g.pos={x:4,y:4};g.drawPos={...g.pos};g.attackTimer=100;const e={...structuredClone(g),id:'brace-foe',team:'enemy',role:'melee',speed:0,block:0,pos:{x:4.7,y:4},drawPos:{x:4.7,y:4},route:[],path:[],enemyMotion:'route',ai:undefined};e.weapons=[{...e.weapons[0],remote:false,range:1,damage:0}];s.units.push(e);step(s,.1);});
 await expect(page.locator('#debug-readings')).toContainText('Brace 是');
 await expect(page.locator('#debug-readings')).toContainText('破势移动锁 否');
});
