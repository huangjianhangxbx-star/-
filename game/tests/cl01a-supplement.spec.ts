import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const dir='../work/R1-CL01A/supplement';mkdirSync(dir,{recursive:true});test.setTimeout(120000);
test('six named enemy routes retain official capability, real duo and reset generation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const mode of ['zombie','ranged','mix','three','four','five']){
  await page.goto('/?enemies=v2&mode='+mode);await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.time??0),{timeout:30000}).toBeGreaterThan(0);
  await expect(page.locator('#duo-status [data-body]')).toHaveCount(2);await expect(page.locator('#developer-route')).toContainText('具名');await expect(page.locator('#cards,#selected-panel,#hand-drawer')).toHaveCount(0);
  const gen=await page.evaluate(()=>(window as any).prototype.state.combatIdentity.generation);await page.locator('[data-v2=reset]').click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.combatIdentity.generation)).toBe(gen+1);expect(await page.evaluate(()=>(window as any).prototype.state.sessionMode)).toBe('exploration');
  await page.screenshot({path:dir+'/'+mode+'.png'});
 }
 expect(errors).toEqual([]);
});
test('missing reference runtime surfaces a visible error without fallback claim',async({page})=>{
 await page.route('**/__al01-assets/vendor/spine-webgl-4.1.56.js',r=>r.abort());await page.goto('/');await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();await expect(page.locator('#error')).toBeVisible({timeout:30000});await expect(page.locator('#error')).toContainText(/资源|加载|Spine/);await page.screenshot({path:dir+'/missing-runtime.png'});
});
test('held directional guard is cleared by real blur, help and pause',async({page})=>{
 await page.goto('/');await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('hunter')?.reference?.ready),{timeout:30000}).toBe(true);
 const q=await page.evaluate(()=>{const p=(window as any).prototype,u=p.state.units.find((u:any)=>u.id==='hunter');return p.project({x:u.pos.x+1,y:u.pos.y});});await page.mouse.move(q.x,q.y);await page.mouse.down({button:'right'});await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').hunterCombat.special?.kind)).toBe('guard');
 // Opening another browser tab causes an actual window blur; no injected state or synthetic event.
 const other=await page.context().newPage();await other.goto('about:blank');await other.bringToFront();await page.bringToFront();await other.close();await page.mouse.up({button:'right'});await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').hunterCombat.special?.kind??'none')).toBe('none');
 await page.keyboard.press('Space');await page.locator('[data-action=help]').first().click();await expect(page.locator('#help')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#help')).toBeHidden();
});
