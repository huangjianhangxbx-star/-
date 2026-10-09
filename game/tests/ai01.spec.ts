import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='../work/NIGHT-UI-20261010/AI-01/browser';mkdirSync(out,{recursive:true});
test.setTimeout(90000);
test('natural Al shot, Z and G show real pending native action, then complete rally',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();
 await expect.poll(()=>page.evaluate(()=>['hunter','ranger'].every(id=>(window as any).prototype.scene.unitVisuals.get(id)?.reference?.ready)),{timeout:30000}).toBe(true);await page.keyboard.press('z');
 const point=await page.evaluate(()=>{const p=(window as any).prototype,u=p.state.units.find((u:any)=>u.id==='ranger');return p.project({x:u.pos.x+2,y:u.pos.y});});await page.mouse.move(point.x,point.y);await page.mouse.down({button:'right'});
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ranger').alCombat.ammo),{intervals:[10]}).toBe(3);await page.mouse.up({button:'right'});await page.keyboard.press('z');await page.keyboard.down('g');
 const box=(await page.locator('#tactic-wheel').boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+20);await page.keyboard.up('g');
 const before=await page.evaluate(()=>{const s=(window as any).prototype.state,u=s.units.find((u:any)=>u.id==='ranger');return {time:s.time,tactic:s.partyTactics.ranger,action:u.alCombat.special,ammo:u.alCombat.ammo};});
 expect(before.action).toBeDefined();expect(before.tactic.execution).toBe('pending-body');expect(before.tactic.budget).toBe(0);await expect(page.locator('[data-body=ranger] .duo-condition')).toContainText('等待动作');await page.screenshot({path:out+'/native-pending.png'});
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.partyTactics?.ranger)).toBeUndefined();await expect(page.locator('#notice')).toContainText('已到达');
 const after=await page.evaluate(()=>{const s=(window as any).prototype.state,u=s.units.find((u:any)=>u.id==='ranger');return {time:s.time,ammo:u.alCombat.ammo,payments:u.alCombat.trace.filter((r:any)=>r.kind==='ammo-payment').length,control:s.controlledBodyId};});expect(after.payments).toBe(1);expect(after.control).toBe('hunter');expect(errors).toEqual([]);writeFileSync(out+'/native-pending.json',JSON.stringify({method:'natural input only; read-only state',before,after,errors},null,2));
});
