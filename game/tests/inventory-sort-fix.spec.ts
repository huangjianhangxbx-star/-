import {test,expect} from '@playwright/test';
test('inventory sort is compact and repeated worker requests do not fail',async({page})=>{
 await page.addInitScript(()=>{const Base=window.Worker;(window as any).sortErrors=[];window.Worker=class extends Base{constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.addEventListener('error',e=>(window as any).sortErrors.push({message:e.message,file:e.filename,line:e.lineno}));}};});
 await page.goto('/?scene2d=1');await page.locator('[data-action=carry]').click();await page.keyboard.press('Tab');
 for(let i=0;i<3;i++){await page.locator('[data-pack=team]').click();await expect.poll(async()=>({text:await page.locator('[data-backpack-feedback]').textContent(),errors:await page.evaluate(()=>(window as any).sortErrors)}),{timeout:15000}).toMatchObject({text:'最优整理完成',errors:[]});}
 const occupied=await page.evaluate(()=>Object.values((window as any).prototype.state.world.backpack.inventory.items).filter((i:any)=>i.location.container==='team').map((i:any)=>i.location.y*5+i.location.x).sort((a,b)=>a-b));expect(occupied).toEqual(occupied.map((_,i)=>i));
});

test('sort still completes when the worker module cannot load',async({page})=>{
 await page.goto('/?scene2d=1');await page.locator('[data-action=carry]').click();await page.keyboard.press('Tab');
 const before=await page.evaluate(()=>Object.values((window as any).prototype.state.world.backpack.inventory.items).map((i:any)=>[i.id,i.quantity,i.weapon]));
 await page.route('**/*inventory-pack.worker*',route=>route.abort('failed'));
 await page.locator('[data-pack=team]').click();await expect(page.locator('[data-backpack-feedback]')).toHaveText(/^(最优)?整理完成/,{timeout:5000});
 const after=await page.evaluate(()=>Object.values((window as any).prototype.state.world.backpack.inventory.items).map((i:any)=>[i.id,i.quantity,i.weapon]));expect(after.sort()).toEqual(before.sort());
});

test('a stalled worker falls back and cancelling never commits its delayed result',async({page})=>{
 await page.goto('/?scene2d=1');await page.locator('[data-action=carry]').click();await page.keyboard.press('Tab');
 await page.route('**/*inventory-pack.worker*',()=>{});
 await page.locator('[data-pack=team]').click();await expect(page.locator('[data-backpack-feedback]')).toHaveText(/^(最优)?整理完成/,{timeout:5000});
 const before=await page.evaluate(()=>JSON.stringify((window as any).prototype.state.world.backpack.inventory));
 await page.locator('[data-pack=team]').click();await page.locator('[data-cancel-pack]').click();await page.waitForTimeout(1200);
 expect(await page.evaluate(()=>JSON.stringify((window as any).prototype.state.world.backpack.inventory))).toBe(before);await expect(page.locator('[data-backpack-feedback]')).toHaveText('已取消整理，库存保持');
});
