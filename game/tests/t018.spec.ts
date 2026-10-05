import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
test('standalone imported map, hand drawer, campfire restoration and exit victory',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text()+JSON.stringify(m.location()));});
 await page.goto('/');await page.locator('[data-journey="exploration"]').click();await page.locator('[data-companion="ines"]').click();await page.locator('[data-action="carry"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.phase)).toBe('battle');
 await page.locator('[data-action="pause"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.terrain.userData.loaded),{timeout:45000}).toBe(true);
 expect(await page.evaluate(()=>(window as any).prototype.scene.terrain.userData.importedInstances)).toBe(3275);
 await expect(page.locator('#tactical-hand')).toHaveAttribute('aria-hidden','true');await expect(page.locator('#personal-controls')).toBeHidden();
 const projection=()=>page.evaluate(()=>[...(window as any).prototype.scene.camera.projectionMatrix.elements]);const before=await projection();
 await page.keyboard.press('Tab');await expect(page.locator('#tactical-hand')).toHaveAttribute('aria-hidden','false');expect(await projection()).toEqual(before);
 await page.keyboard.press('Tab');await expect(page.locator('#tactical-hand')).toHaveAttribute('aria-hidden','true');
 await page.mouse.move(300,895);await expect(page.locator('#tactical-hand')).toHaveAttribute('aria-hidden','false');await page.mouse.move(700,350);await expect(page.locator('#tactical-hand')).toHaveAttribute('aria-hidden','true');
 await page.locator('[data-unit="hunter"]').click();await expect(page.locator('#personal-controls')).toBeVisible();const detail=await page.locator('#unit-detail').boundingBox(),controls=await page.locator('#personal-controls').boundingBox();expect(controls!.y).toBeGreaterThanOrEqual(detail!.y+detail!.height);expect(controls!.x).toBeLessThan(100);
 await page.evaluate(()=>{const s=(window as any).prototype.state,h=s.units.find((u:any)=>u.id==='hunter');h.hp=10;h.stress=65;h.posture=1;h.grayHp=20;h.skillCd=12;});
 await page.locator('[data-exploration-point="campfire-1"]').click();await expect(page.locator('[data-exploration-point="campfire-1"]')).toBeDisabled();
 expect(await page.evaluate(()=>{const h=(window as any).prototype.state.units.find((u:any)=>u.id==='hunter');return {hp:h.hp,stress:h.stress,cd:h.skillCd,gray:h.grayHp};})).toEqual({hp:190,stress:25,cd:0,gray:0});
 mkdirSync('../记录/验证/T-018',{recursive:true});await page.screenshot({path:'../记录/验证/T-018/entry-campfire.png'});
 await page.locator('[data-unit="ines"]').click();await expect(page.locator('#personal-controls')).toBeHidden();
 await page.evaluate(()=>{const s=(window as any).prototype.state;for(const u of s.units){if(u.team==='enemy')u.life='dead';else if(u.life==='active'){u.pos={...s.goal};u.drawPos={...u.pos};u.ready=0;}}s.context='explorationIdle';});
 await page.locator('[data-action="exit-exploration"]').click();await expect(page.getByRole('heading',{name:'暗牢探索胜利'})).toBeVisible();expect(await page.evaluate(()=>(window as any).prototype.state.economy.settled)).toBe('success');expect(errors).toEqual([]);
});
test('drawer locks for selected cards and imported corridors accept actual movement',async({page})=>{
 test.setTimeout(60000);await page.setViewportSize({width:1280,height:720});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.locator('[data-journey="exploration"]').click();await page.locator('[data-companion="ines"]').click();await page.locator('[data-action="carry"]').click();await page.locator('[data-action="pause"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.terrain.userData.loaded)).toBe(true);
 await page.keyboard.press('Tab');await page.locator('[data-card]').first().click();await page.keyboard.press('Tab');await page.mouse.move(650,350);await expect(page.locator('#tactical-hand')).toHaveAttribute('aria-hidden','false');await page.screenshot({path:'../记录/验证/T-018/hand-1280.png'});await page.keyboard.press('Escape');await expect(page.locator('#tactical-hand')).toHaveAttribute('aria-hidden','true');
 const movement=await page.evaluate(async()=>{const {command,step}=await import('/src/core/engine.ts' as string),{navigate}=await import('/src/core/navigation.ts' as string),p=(window as any).prototype,s=p.state,h=s.units.find((u:any)=>u.id==='hunter');s.units=s.units.filter((u:any)=>u.team==='ally');for(const u of s.units)if(u!==h)u.life='withdrawn';const target={x:38,y:10},route=navigate(s,h.pos,target);let accepted={ok:true};for(const waypoint of route){accepted=command(s,{type:'move',id:h.id,to:waypoint});if(!accepted.ok)break;for(let i=0;i<20&&Math.hypot(h.pos.x-waypoint.x,h.pos.y-waypoint.y)>.05;i++)step(s,.5);}h.drawPos={...h.pos};return {accepted,route:route.length,distance:Math.hypot(h.pos.x-target.x,h.pos.y-target.y),position:h.pos};});expect(movement.accepted).toEqual({ok:true});expect(movement.route).toBeGreaterThan(0);expect(movement.distance).toBeLessThan(.1);await page.waitForTimeout(400);await page.screenshot({path:'../记录/验证/T-018/room-02.png'});
});
