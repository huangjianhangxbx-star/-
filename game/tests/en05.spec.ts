import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const dir='../work/EN-05/browser';mkdirSync(dir,{recursive:true});test.setTimeout(120000);
test('six original-body group entry modes share the main clock and real reset',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [mode,count] of [['zombie',1],['ranged',1],['mix',2],['three',3],['four',4],['five',5]] as const){
  await page.goto('/?enemies=v2&mode='+mode);await expect(page.locator('[data-v2='+mode+']')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>{const p=(window as any).prototype;return p?.state.units.filter((u:any)=>u.enemyV2).length;})).toBe(count);
  await expect.poll(()=>page.evaluate(()=>{const p=(window as any).prototype;return p.state.units.filter((u:any)=>u.enemyV2).every((u:any)=>p.scene.unitVisuals.get(u.id)?.reference?.ready);}),{timeout:35000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.time),{timeout:35000}).toBeGreaterThan(0);await page.keyboard.down('s');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').pos.y),{timeout:10000,intervals:[100]}).toBeGreaterThan(8.05);await page.keyboard.up('s');await page.keyboard.press('z');await page.keyboard.press('Shift');await page.keyboard.press('Space');const start=await page.evaluate(()=>{const p=(window as any).prototype,s=p.state;return {time:s.time,generation:s.combatIdentity.generation,bodies:s.units.map((u:any)=>({id:u.id,pos:u.pos,visual:u.enemyVisualProfileId})),views:[...p.scene.unitVisuals.values()].map((v:any)=>({id:v.unit.id,ready:v.reference?.ready,failed:v.loadFailed}))};});
  expect(start.bodies.find((u:any)=>u.id==='hunter').pos.y).toBeGreaterThan(8);await page.waitForTimeout(120);expect(await page.evaluate(()=>(window as any).prototype.state.time)).toBe(start.time);await page.screenshot({path:dir+'/'+mode+'.png'});writeFileSync(dir+'/'+mode+'.json',JSON.stringify({method:'natural URL/UI; no state injection',...start},null,2));
  await page.locator('[data-v2=reset]').click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.combatIdentity.generation)).toBe(start.generation+1);
 }
 expect(errors).toEqual([]);
});
