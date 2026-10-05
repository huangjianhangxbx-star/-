import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const evidence='../记录/验证/T-019';
async function choose(page:Page,id='ines'){await page.locator('[data-journey="exploration"]').click();await page.locator(`[data-companion="${id}"]`).click();await page.locator('[data-action="carry"]').click();await page.locator('[data-action="pause"]').click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.terrain.userData.loaded),{timeout:45000}).toBe(true);}
test('departure requires one companion and permits changing it before leaving',async({page})=>{
 await page.goto('/');await page.locator('[data-journey="exploration"]').click();await expect(page.locator('[data-companion]')).toHaveCount(3);await expect(page.locator('[data-action="carry"]')).toBeDisabled();
 await page.locator('[data-companion="fiorre"]').click();await page.locator('[data-companion="ines"]').click();await expect(page.locator('[data-companion][aria-pressed="true"]')).toHaveCount(1);await expect(page.locator('#companion-status')).toContainText('伊内丝');
 mkdirSync(evidence,{recursive:true});await page.screenshot({path:evidence+'/departure.png'});
 await page.locator('[data-journey="tower"]').click();await expect(page.locator('#exploration-companions')).toBeHidden();await expect(page.locator('[data-action="carry"]')).toBeEnabled();
});
test('two-person roster and clones survive a completed run and a different companion next run',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await choose(page);
 await expect(page.locator('#roster [data-unit]')).toHaveCount(2);await expect(page.locator('#roster [data-unit="ines"]')).toBeVisible();await page.keyboard.press('3');expect(await page.evaluate(()=>(window as any).prototype.interaction.selectedId)).not.toBe('ranger');
 // Fixture supplies earned currency; summoning and landing use actual UI input.
 await page.evaluate(()=>{(window as any).prototype.state.fragments=40;});await page.locator('[data-clone="hunter"]').click();
 const target=await page.evaluate(async()=>{const p=(window as any).prototype,{cloneTiles}=await import('/src/core/engine.ts' as string);const {queryClone}=await import('/src/core/clones.ts' as string);return cloneTiles(p.state,'hunter').map((q:any)=>p.project(q)).find((q:any)=>{const hit=p.scene.pick(q.x,q.y);return document.elementFromPoint(q.x,q.y)?.closest('#scene')&&hit.tile&&queryClone(p.state,'hunter',hit.tile).ok;});});expect(target).toBeTruthy();await page.mouse.click(target.x,target.y);
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.filter((u:any)=>u.cloneOf).length)).toBe(1);await expect(page.locator('#roster [data-unit]')).toHaveCount(2);
 await page.screenshot({path:evidence+'/two-bodies-and-clone.png'});
 await page.evaluate(()=>{const s=(window as any).prototype.state;for(const u of s.units){if(u.team==='enemy')u.life='dead';else if(!u.cloneOf&&u.life==='active'){u.pos={...s.goal};u.drawPos={...u.pos};}}s.context='explorationIdle';});await page.locator('[data-action="exit-exploration"]').click();await expect(page.getByRole('heading',{name:'暗牢探索胜利'})).toBeVisible();await page.locator('[data-action="new"]').click();
 await page.locator('[data-journey="exploration"]').click();await expect(page.locator('[data-action="carry"]')).toBeDisabled();await page.locator('[data-companion="ranger"]').click();await page.locator('[data-action="carry"]').click();await page.locator('[data-action="pause"]').click();await expect(page.locator('#roster [data-unit]')).toHaveCount(2);await expect(page.locator('#roster [data-unit="ranger"]')).toBeVisible();await expect(page.locator('#roster [data-unit="ines"]')).toHaveCount(0);await page.screenshot({path:evidence+'/ranger-next-run.png'});expect(errors).toEqual([]);
});
test('real-time WASD and seeded encounter debug evidence use EC01 tuning',async({page})=>{
 test.setTimeout(60000);await page.goto('/');await choose(page);await page.locator('[data-unit="hunter"]').click();
 const read=()=>page.evaluate(()=>{const s=(window as any).prototype.state;return {pos:{...s.units[0].pos},time:s.time};});
 await page.locator('[data-action="pause"]').click();await page.keyboard.down('d');const before=await read();await page.waitForTimeout(1000);const after=await read();await page.keyboard.up('d');await page.locator('[data-action="pause"]').click();const seconds=after.time-before.time,travel=Math.hypot(after.pos.x-before.pos.x,after.pos.y-before.pos.y);expect(seconds).toBeGreaterThan(.05);expect(travel/seconds).toBeCloseTo(2.4,1);
 const data=await page.evaluate(async()=>{const p=(window as any).prototype,{standaloneSummary}=await import('/src/core/standalone-summary.ts' as string);return {summary:standaloneSummary(p.state),encounters:p.state.exploration.definition.encounters,enemies:p.state.units.filter((u:any)=>u.team==='enemy').map((u:any)=>({id:u.id,role:u.role,hp:u.hp,maxHp:u.maxHp,posture:u.maxPosture,damage:u.damage,pos:u.pos}))};});expect(data.summary.enemies).toBe(44);expect(data.enemies.every((e:any)=>e.maxHp===(e.role==='heavy'?270:170))).toBe(true);writeFileSync(evidence+'/seed18.json',JSON.stringify({...data,movement:{seconds,travel,rate:travel/seconds}},null,2));
 await page.keyboard.press('Tab');await page.locator('[data-action="debug"]').click();await expect(page.locator('#ec01-readings')).toContainText('"allySpeed": 2.4');await page.screenshot({path:evidence+'/debug.png'});
});
