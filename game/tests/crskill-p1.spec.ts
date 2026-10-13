import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('../../work/CR-SKILL-01/browser-p1/',import.meta.url));mkdirSync(out,{recursive:true});
test.setTimeout(90000);
async function read(p:Page){return p.evaluate(()=>{const s=(window as any).prototype.state;return {control:s.controlledBodyId,time:s.time,units:s.units.filter(u=>u.team==='ally').map(u=>({id:u.id,hp:u.hp,life:u.life,pos:u.pos,basic:u.basicAction?.stageSpec,trial:u.equipment?.equipped.right.composition,special:u.hunterCombat?.special??u.alCombat?.special,left:u.equipment?.equipped.left,al:u.alCombat})),trace:s.combatIdentity.trace};});}
async function aim(p:Page){const screen=await p.evaluate(async()=>{const {clearShot}=await import('/src/core/spatial.ts' as string);const p=(window as any).prototype,s=p.state,u=s.units.find(u=>u.id===s.controlledBodyId);const target=[{x:u.pos.x+2,y:u.pos.y},{x:u.pos.x,y:u.pos.y+2},{x:u.pos.x-2,y:u.pos.y},{x:u.pos.x,y:u.pos.y-2}].find(x=>clearShot(s,u.pos,x))!;return p.project(target);});await p.mouse.move(screen.x,screen.y);}
async function idle(p:Page,id:string){await expect.poll(async()=>{const u=(await read(p)).units.find(u=>u.id===id)!;return !u.basic&&!u.special;}).toBe(true);}
test('four-chain UI: acquire/remove, real chisel, native charge, separate reload/shot and launch explosion',async({page:p})=>{
 const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('/?abilityTrial=1&trialPreset=p1&v=cr-p1');await p.locator('[data-action=carry]').click();
 await expect.poll(()=>p.evaluate(()=>['hunter','ranger'].every(id=>(window as any).prototype.scene.unitVisuals.get(id)?.reference?.ready)),{timeout:45000}).toBe(true);
 await expect(p.locator('#cr-trial-status')).toContainText('四链隔离实验');await p.keyboard.press('KeyV');await expect(p.locator('#right-skill-panel')).toContainText('凿冰');
 await p.locator('[data-trial-effect=chisel]').click();await expect(p.locator('[data-trial-effect=chisel]')).toContainText('未持有');await p.locator('[data-trial-effect=chisel]').click();const time=(await read(p)).time;await p.waitForTimeout(100);expect((await read(p)).time).toBe(time);await p.keyboard.press('Escape');
 await aim(p);await p.mouse.down();await expect.poll(async()=>(await read(p)).units[0].trial.facts.some(x=>x.kind==='column-created')).toBe(true);await p.mouse.up();await idle(p,'hunter');
 await aim(p);await p.keyboard.down('KeyE');await p.waitForTimeout(200);await p.keyboard.up('KeyE');await idle(p,'hunter');
 await p.keyboard.press('KeyZ');await expect.poll(async()=>(await read(p)).control).toBe('ranger');const before=(await read(p)).units.find(u=>u.id==='ranger')!;
 await aim(p);await p.keyboard.press('KeyQ');await expect.poll(async()=>(await read(p)).units.find(u=>u.id==='ranger')!.trial.magazine[0]).toBe('mortar');
 await p.mouse.down({button:'right'});await expect.poll(async()=>(await read(p)).units.find(u=>u.id==='ranger')!.trial.facts.some(x=>x.kind==='mortar-fired')).toBe(true);await p.mouse.up({button:'right'});await idle(p,'ranger');
 await aim(p);await p.keyboard.press('KeyE');await expect.poll(async()=>(await read(p)).units.find(u=>u.id==='ranger')!.trial.facts.some(x=>x.kind==='launch-explosion')).toBe(true);await idle(p,'ranger');
 const after=await read(p),al=after.units.find(u=>u.id==='ranger')!;expect(al.left.durability).toBe(before.left.durability);expect(al.al.ammo).toBe(before.al?.ammo??4);expect(errors).toEqual([]);
 await p.keyboard.press('Space');writeFileSync(out+'/natural-story.json',JSON.stringify({method:'natural keyboard and mouse; readonly observations; not original-game OBS',errors,state:after},null,2));await p.screenshot({path:out+'/natural-story.png'});
 await p.keyboard.press('Space');await p.setViewportSize({width:1280,height:720});await p.keyboard.press('KeyV');await expect(p.locator('#right-skill-panel')).toBeVisible();const box=await p.locator('[data-close-skills]').boundingBox();expect(box!.y+box!.height).toBeLessThan(720);await p.screenshot({path:out+'/panel-1280.png'});
});
