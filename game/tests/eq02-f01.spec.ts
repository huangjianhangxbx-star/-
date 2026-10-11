import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
test.setTimeout(80000);const out='../docs/tasks/EQ-02-F01/validation';mkdirSync(out,{recursive:true});
test('F01 actual bomb equip, C II, E prepare charge and left RMB still throws',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1920,height:1080});await page.goto('/?v=f01');await page.locator('[data-action=carry]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('hunter')?.reference?.ready),{timeout:40000}).toBe(true);
 await page.locator('[data-body=hunter] [data-hand=left]').click();await page.locator('[data-equipment-action=bomb]').click();await page.keyboard.press('Escape');await page.keyboard.press('KeyC');
 const aim=await page.evaluate(()=>{const p=(window as any).prototype,h=p.state.units.find(u=>u.id==='hunter');return p.project({x:h.pos.x,y:h.pos.y+2});});await page.mouse.move(aim.x,aim.y);
 const read=()=>page.evaluate(()=>{const s=(window as any).prototype.state,h=s.units.find(u=>u.id==='hunter');return {time:s.time,stamina:h.stamina,left:h.equipment.equipped.left,form:h.equipment.equipped.right.currentForm,native:h.hunterCombat,offhand:h.offhand};});
 await page.keyboard.down('KeyE');await expect.poll(async()=>(await read()).native.special?.kind).toBe('prepare');const prepared=await read();expect(prepared.left.cd).toBe(0);expect(prepared.stamina.lastAcceptedId).toBe(1);expect(prepared.form).toBe('II');
 await page.keyboard.up('KeyE');await expect.poll(async()=>(await read()).native.trace.some(t=>t.kind==='active-payment'),{timeout:10000}).toBe(true);await expect.poll(async()=>!(await read()).native.special,{timeout:10000}).toBe(true);const released=await read();expect(released.stamina.lastAcceptedId).toBe(1);expect(released.left.durability).toBe(100);
 const next=await page.evaluate(()=>{const p=(window as any).prototype,h=p.state.units.find(u=>u.id==='hunter');return p.project({x:h.pos.x+1,y:h.pos.y});});await page.mouse.move(next.x,next.y);await page.mouse.click(next.x,next.y,{button:'right'});await expect.poll(async()=>(await read()).left.durability).toBe(99);await page.keyboard.press('Space');await page.screenshot({path:out+'/bomb-E-II.png'});
 writeFileSync(out+'/real-input.json',JSON.stringify({method:'real mouse/keys, read-only state; no injection',prepared,released,afterBomb:await read(),errors},null,2));expect(errors).toEqual([]);expect(await page.locator('[data-skill-key=E]').getAttribute('title')).not.toContain('护盾');expect(await page.locator('[data-skill-key=E]').getAttribute('class')).not.toContain('equipment-disabled');
});
