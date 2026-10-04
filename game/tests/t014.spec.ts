import {test,expect} from '@playwright/test';
for(const width of [1440,1000])test(`pressure HUD shows independent gray life and posture at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');await page.locator('[data-action="carry"]').click();await page.getByRole('button',{name:'进入战斗',exact:true}).click();await page.locator('[data-action="pause"]').click();
 await page.evaluate(async()=>{const p=(window as any).prototype,s=p.state,{resolveHit}=await import('/src/core/engine.ts' as string);const u=s.units[0];u.dodge=0;resolveHit(s,u,{...u.weapons[0],postureDamage:45},70);});
 await page.locator('[data-unit="hunter"]').click();await expect(page.locator('#unit-numbers')).toContainText('虚血 70');await expect(page.locator('#posture-hunter')).toHaveAttribute('style',/50%/);await expect(page.locator('#gray-hunter')).toHaveAttribute('style',/100%/);
 const overlaps=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);expect(overlaps).toBe(false);
 await page.screenshot({path:`../记录/验证/T-014/pressure-${width}.png`});
 await page.evaluate(async()=>{const s=(window as any).prototype.state,{resolveHit}=await import('/src/core/engine.ts' as string),u=s.units[0],w={...u.weapons[0],postureDamage:45};resolveHit(s,u,w,0);resolveHit(s,u,w,0);});
 await expect(page.locator('#unit-numbers')).toContainText('硬直');await expect(page.locator('[data-skill="hunter"]').first()).toBeDisabled();await page.screenshot({path:`../记录/验证/T-014/stagger-${width}.png`});
});
test('enemy posture has contextual visibility and respects exploration fog',async({page})=>{
 await page.goto('/');await page.locator('[data-action="carry"]').click();await page.evaluate(()=>{const s=(window as any).prototype.state;s.completed.push(1);s.phase='nodes';});await page.locator('[data-node="4"]').click();await page.locator('[data-action="pause"]').click();
 const results=await page.evaluate(async()=>{const p=(window as any).prototype,s=p.state,{resolveHit}=await import('/src/core/engine.ts' as string),e=s.units.find((u:any)=>u.team==='enemy'),h=s.units[0];const o={selectedId:null,hover:null,path:[],range:[],deployTiles:[],targeting:false};
  p.scene.update(s,o,0,1);const hidden=!p.scene.unitVisuals.get(e.id)?.group.visible;e.pos={x:4,y:16};e.drawPos={...e.pos};const {updateVision}=await import('/src/core/visibility.ts' as string);updateVision(s,true);p.scene.update(s,o,0,1);const actor=p.scene.unitVisuals.get(e.id),alpha=()=>actor.barCanvas.getContext('2d').getImageData(35,64,1,1).data[3],idle=alpha();resolveHit(s,e,{...h.weapons[0],postureDamage:10},0,h);p.scene.update(s,o,0,1);const recent=alpha();return {hidden,idle,recent};});
 expect(results).toEqual({hidden:true,idle:0,recent:255});
});
