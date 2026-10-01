import {prepareRegression} from './browser-helpers';
import {test,expect} from '@playwright/test';
test('continuous mouse deployment and movement preserve the clicked surface point',async({page})=>{
 await page.goto('/');await prepareRegression(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();await page.evaluate(()=>{const s=(window as any).prototype.state;s.waves=[];s.totalEnemies=999;s.units.forEach((u:any)=>u.ready=0);});
 const dest={x:4.21,y:4.12};const p=await page.evaluate(p=>(window as any).prototype.project(p),dest);
 const b=await page.locator('[data-unit="ines"]').boundingBox();await page.mouse.move(b!.x+30,b!.y+75);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:10});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ines').life)).toBe('active');
 const actual=await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ines').pos);expect(actual.x).toBeCloseTo(dest.x,1);expect(actual.y).toBeCloseTo(dest.y,1);
 const q=await page.evaluate(()=>(window as any).prototype.project({x:3.2,y:3.8}));await page.mouse.click(p.x,p.y);await page.mouse.move(q.x,q.y);await expect(page.locator('#range-caption')).toContainText('圆形');await page.mouse.click(q.x,q.y);
 await page.evaluate(async()=>{const {step}=await import('/src/core/engine.ts' as string);step((window as any).prototype.state,4)});const moved=await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ines').pos);expect(moved.x).toBeCloseTo(3.2,1);expect(moved.y).toBeCloseTo(3.8,1);
});
