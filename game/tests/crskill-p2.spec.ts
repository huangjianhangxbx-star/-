import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('../../work/CR-SKILL-01/browser-p2/',import.meta.url));mkdirSync(out,{recursive:true});
test.setTimeout(90000);
async function read(p:Page){return p.evaluate(()=>{const s=(window as any).prototype.state;return {control:s.controlledBodyId,time:s.time,units:s.units.filter(u=>u.team==='ally').map(u=>({id:u.id,hp:u.hp,life:u.life,pos:u.pos,basic:u.basicAction?.stageSpec,trial:u.equipment?.equipped.right.composition,special:u.hunterCombat?.special??u.alCombat?.special,left:u.equipment?.equipped.left,al:u.alCombat})),trace:s.combatIdentity.trace};});}
async function aim(p:Page){const screen=await p.evaluate(async()=>{const {clearShot}=await import('/src/core/spatial.ts' as string);const p=(window as any).prototype,s=p.state,u=s.units.find(u=>u.id===s.controlledBodyId);const target=[{x:u.pos.x+2,y:u.pos.y},{x:u.pos.x,y:u.pos.y+2},{x:u.pos.x-2,y:u.pos.y},{x:u.pos.x,y:u.pos.y-2}].find(x=>clearShot(s,u.pos,x))!;return p.project(target);});await p.mouse.move(screen.x,screen.y);}
async function idle(p:Page,id:string){await expect.poll(async()=>{const u=(await read(p)).units.find(u=>u.id===id)!;return !u.basic&&!u.special;}).toBe(true);}
test('P2 sources: own dormant rune, equip, replacement winner and reversible ownership',async({page:p})=>{
 const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('/?abilityTrial=1&trialPreset=p1&v=cr-p2');await p.locator('[data-action=carry]').click();
 await expect(p.locator('#cr-trial-status')).toBeVisible();await p.keyboard.press('KeyV');
 await p.locator('[data-trial-effect=root]').click();await p.locator('[data-trial-effect=frost-haste]').click();await expect(p.locator('[data-trial-effect=frost-haste]')).toContainText('休眠');
 await p.locator('[data-trial-effect=root]').click();await expect(p.locator('[data-trial-effect=frost-haste]')).toContainText('生效');
 await p.locator('[data-trial-effect=chisel-plus]').click();await expect(p.locator('[data-trial-effect=chisel]')).toContainText('覆盖');
 await p.locator('[data-trial-effect=chisel-plus]').click();await expect(p.locator('[data-trial-effect=chisel]')).toContainText('生效');await p.locator('[data-trial-effect=chisel-plus]').click();
 await p.locator('[data-trial-effect=root]').click();await expect(p.locator('[data-trial-effect=frost-haste]')).toContainText('休眠');await p.locator('[data-trial-effect=root]').click();
 await p.setViewportSize({width:1280,height:720});await p.screenshot({path:out+'/sources.png'}); await p.keyboard.press('Escape');await aim(p);await p.mouse.down();await expect.poll(async()=>(await read(p)).units.find(u=>u.id==='hunter')?.basic?.damage).toBe(40);await p.mouse.up();await idle(p,'hunter');
 await aim(p);await p.keyboard.down('KeyE');await p.waitForTimeout(150);await p.keyboard.up('KeyE');await idle(p,'hunter');
 expect(errors).toEqual([]);writeFileSync(out+'/story.json',JSON.stringify({errors,state:await read(p)},null,2));
});
