import {test,expect,type Page} from '@playwright/test';
async function enter(p:Page){await p.goto('/?scene2d=1');await p.locator('[data-action=carry]').click();await p.waitForTimeout(1200);await p.evaluate(()=>{const s=(window as any).prototype.state,n=s.units.find((u:any)=>u.npc),h=s.units.find((u:any)=>u.id===s.controlledBodyId),r=s.units.find((u:any)=>u.id==='ranger');h.pos={...n.pos,x:n.pos.x-1};h.drawPos={...h.pos};r.pos={...n.pos,x:n.pos.x-3};r.drawPos={...r.pos};});}
test('role menu gates actions, stops movement without stopping world, and opens dedicated shop',async({page:p})=>{
 await enter(p);await expect(p.locator('[data-role-prompt]')).toContainText('F');await p.keyboard.press('KeyF');
 await expect(p.locator('[data-role-menu]')).toBeVisible();await expect(p.locator('[data-role-action=shop]')).toBeEnabled();await expect(p.locator('[data-role-action=gift]')).toBeDisabled();
 const before=await p.evaluate(()=>{const s=(window as any).prototype.state,u=s.units.find((u:any)=>u.id===s.controlledBodyId);return {time:s.time,pos:{...u.pos}};});await p.keyboard.down('KeyD');await p.waitForTimeout(450);await p.keyboard.up('KeyD');
 const after=await p.evaluate(()=>{const s=(window as any).prototype.state,u=s.units.find((u:any)=>u.id===s.controlledBodyId);return {time:s.time,pos:{...u.pos}};});expect(after.time).toBeGreaterThan(before.time);expect(after.pos).toEqual(before.pos);
 await p.screenshot({path:'../work/UIX-ROLE-01/merchant-menu.png'});await p.locator('[data-role-action=shop]').click();await expect(p.locator('[data-shop-item]')).toHaveCount(10);await expect(p.locator('[data-role-menu]')).toBeHidden();await expect(p.locator('[data-inv-window=detail]')).toBeHidden();await p.keyboard.press('Escape');
 await p.keyboard.press('KeyF');await p.keyboard.press('Escape');await expect(p.locator('[data-role-menu]')).toBeHidden();await p.keyboard.press('KeyV');await expect.poll(()=>p.evaluate(()=>(window as any).prototype.state.explorationControl?.aim?.kind)).toBe('path');await p.keyboard.press('KeyV');
});
test('companion has four actions, empty stock, Z hint and menu closes on blank or lost range',async({page:p})=>{
 await enter(p);await p.evaluate(()=>{const s=(window as any).prototype.state,h=s.units.find((u:any)=>u.id===s.controlledBodyId),r=s.units.find((u:any)=>u.id==='ranger'),n=s.units.find((u:any)=>u.npc);r.pos={...h.pos};r.drawPos={...r.pos};s.world.backpack.inventory.merchantHome.pos.x+=10;n.pos.x+=10;});await p.keyboard.press('KeyF');await expect(p.locator('[data-role-action]:enabled')).toHaveCount(4);await p.screenshot({path:'../work/UIX-ROLE-01/companion-menu.png'});
 await p.locator('[data-role-action=gift]').click();await expect(p.locator('[data-role-message]')).toContainText('后续开放');await p.locator('[data-role-action=shop]').click();await expect(p.locator('[data-empty-shop]')).toBeVisible();await expect(p.locator('[data-shop-item]')).toHaveCount(0);await p.screenshot({path:'../work/UIX-ROLE-01/companion-shop.png'});await p.keyboard.press('Escape');
 await p.keyboard.press('KeyF');await p.mouse.click(800,150);await expect(p.locator('[data-role-menu]')).toBeHidden();await p.keyboard.press('KeyF');await p.evaluate(()=>{const s=(window as any).prototype.state;s.units.find((u:any)=>u.id==='ranger').pos.x+=20;});await expect(p.locator('[data-role-menu]')).toBeHidden();
 await p.keyboard.press('KeyZ');await expect(p.locator('[data-role-switch]')).toContainText('Z');await p.screenshot({path:'../work/UIX-ROLE-01/controlled-companion.png'});
});
test('nearby character click follows menu route at narrow and wide sizes',async({page:p})=>{
 await enter(p);
 for(const width of [1280,1920]){
  await p.setViewportSize({width,height:900});await p.waitForTimeout(150);
  const point=await p.evaluate(()=>{const a=(window as any).prototype,s=a.state,n=s.units.find((u:any)=>u.npc);return a.project(n.pos);});
  await p.mouse.click(point.x,point.y);await expect(p.locator('[data-role-menu]')).toBeVisible();await expect(p.locator('#backpack-panel')).toBeHidden();
  const box=await p.locator('[data-role-menu]').boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  await p.screenshot({path:`../work/UIX-ROLE-01/click-${width}.png`});await p.keyboard.press('Escape');
 }
});
test('edge menu flips with label anchored to target and switch hint tracks rendered body',async({page:p})=>{
 await enter(p);await p.evaluate(()=>{const a=(window as any).prototype,n=a.state.units.find((u:any)=>u.npc);a.scene.look.follow=false;a.scene.center={x:n.pos.x+(innerWidth/2-100)*16/innerHeight,y:n.pos.y};});
 await p.keyboard.press('KeyF');await expect(p.locator('[data-role-menu]')).toHaveAttribute('data-side','right');
 const target=await p.evaluate(()=>{const a=(window as any).prototype;return a.project(a.state.units.find((u:any)=>u.npc).pos);}),menu=await p.locator('[data-role-menu]').boundingBox(),label=await p.locator('[data-role-name]').boundingBox();expect(menu!.x).toBeGreaterThan(target.x+25);expect(Math.abs(label!.x-target.x)).toBeLessThan(45);await p.screenshot({path:'../work/UIX-ROLE-01/edge-menu.png'});
 await p.keyboard.press('Escape');await p.evaluate(()=>(window as any).prototype.scene.look.follow=true);await p.keyboard.press('KeyZ');
 await expect.poll(async()=>{const box=await p.locator('[data-role-switch]').boundingBox();const point=await p.evaluate(()=>{const a=(window as any).prototype,s=a.state;return a.project(s.units.find((u:any)=>u.id===s.controlledBodyId).pos);});return box?Math.abs(box.x-point.x-35)+Math.abs(box.y-point.y-26):999;}).toBeLessThan(3);
 await p.screenshot({path:'../work/UIX-ROLE-01/controlled-companion.png'});
});
