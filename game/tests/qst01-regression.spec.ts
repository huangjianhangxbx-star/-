import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const dir='../work/NIGHT-UI-20261010/QST-01A/browser-regression';mkdirSync(dir,{recursive:true});test.setTimeout(120000);
test('retired Tower route offers a clear return and never boots a game fixture',async({page})=>{
 await page.goto('/?legacy=1');await expect(page.getByRole('heading',{name:'旧塔防入口已退休'})).toBeVisible();await expect(page.locator('[data-journey=tower],#cards,#build-panel,canvas')).toHaveCount(0);
 expect(await page.evaluate(()=>!!(window as any).prototype)).toBe(false);await page.getByRole('link',{name:'进入正式探索'}).click();await expect(page.getByRole('button',{name:'开始当前世界',exact:true})).toBeVisible();
});
for(const [width,height]of [[1440,900],[1280,720]])test(`old held inputs and real blur preserve modal ownership at ${width}`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height});await page.goto('/');
 await page.locator('.test-resources summary').click();await page.locator('#carry-gold').fill('1');await page.locator('[data-companion=ranger]').click();await expect(page.locator('[data-action=carry]')).toBeDisabled();await page.locator('#carry-gold').fill('0');await page.locator('[data-action=carry]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('hunter')?.reference?.ready),{timeout:30000}).toBe(true);await page.keyboard.press('Space');
 const read=()=>page.evaluate(()=>{const s=(window as any).prototype.state;return {world:s.world.id,time:s.time,resources:s.economy.carried,cards:s.cards,pending:s.economy.pending,party:s.units.filter((u:any)=>u.team==='ally').map((u:any)=>({id:u.id,life:u.life,hp:u.hp,posture:u.posture,shadow:u.shadowResident})),controlled:s.controlledBodyId,tactics:s.partyTactics};});
 const before=await read();for(const k of ['q','h','b','Tab','c','v','1','2','3','4']){await page.keyboard.down(k);await page.keyboard.down(k);await page.waitForTimeout(40);await page.keyboard.up(k);}expect(await read()).toEqual(before);
 await expect(page.locator('#cards,#hand-drawer,#selected-panel,#build-panel,#world-rescues,#card-chain,#dash-directions,[data-clone]')).toHaveCount(0);
 await page.locator('[data-action=help]').first().click();await page.keyboard.down('h');const other=await page.context().newPage();await other.goto('about:blank');await other.bringToFront();await page.bringToFront();await other.close();await page.keyboard.up('h');expect(await read()).toEqual(before);
 await page.keyboard.press('Escape');await page.keyboard.press('Space');await page.keyboard.press('z');await expect(page.locator('#action-strip')).toContainText('四发射击');await page.keyboard.press('z');await page.keyboard.press('f');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.explorationControl?.aim?.kind)).toBe('path');await page.keyboard.press('Escape');await page.keyboard.down('g');await expect(page.locator('#tactic-wheel')).toBeVisible();await page.keyboard.press('Escape');await page.keyboard.up('g');
 await page.screenshot({path:dir+`/input-${width}.png`});writeFileSync(dir+`/input-${width}.json`,JSON.stringify({before,errors},null,2));expect(errors).toEqual([]);
});

test('retained F confirms a real path and G issues rally cautious and free',async({page})=>{
 await page.goto('/');await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();await expect.poll(()=>page.evaluate(()=>['hunter','ranger'].every(id=>(window as any).prototype.scene.unitVisuals.get(id)?.reference?.ready)),{timeout:30000}).toBe(true);
 const start=await page.evaluate(()=>{const p=(window as any).prototype,u=p.state.units.find((u:any)=>u.id==='hunter');return {pos:{...u.pos},screen:p.project({x:u.pos.x+2,y:u.pos.y})};});
 await page.keyboard.press('f');await page.mouse.move(start.screen.x,start.screen.y);await expect(page.locator('#range-caption')).toContainText('左键确认');await page.mouse.click(start.screen.x,start.screen.y);await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.explorationControl?.aim)).toBeUndefined();
 await expect.poll(()=>page.evaluate((start:any)=>{const u=(window as any).prototype.state.units.find((u:any)=>u.id==='hunter');return Math.hypot(u.pos.x-start.x,u.pos.y-start.y);},start.pos),{timeout:15000}).toBeGreaterThan(1);
 const records:any[]=[];for(const [kind,dx,dy]of [['rally',0,-100],['cautious',0,100],['free',-100,0]] as const){await page.mouse.move(700,450);await page.keyboard.down('g');await expect(page.locator('#tactic-wheel')).toBeVisible();const box=(await page.locator('#tactic-wheel').boundingBox())!;await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy);await page.keyboard.up('g');await expect.poll(()=>page.evaluate((kind:string)=>{const s=(window as any).prototype.state;return kind==='free'?s.notice.includes('已接收 自由'):kind==='rally'?s.partyTactics?.ranger?.kind==='rally'||s.log.some((line:string)=>line.includes('阿尔')&&line.includes('已到达')):s.partyTactics?.ranger?.kind===kind;},kind)).toBe(true);records.push(await page.evaluate(()=>(window as any).prototype.state.partyTactics?.ranger));}
 writeFileSync(dir+'/path-and-tactics.json',JSON.stringify({method:'real F click and G wheel; read-only state',start,records},null,2));await page.screenshot({path:dir+'/path-and-tactics.png'});
});

test('Action Lab stays playable with its original actors and shooting cycle',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/action-lab.html');await expect(page.locator('#readiness')).toHaveText('原资源就绪');await page.locator('#player').selectOption('cannoneer');await expect(page.locator('#player-readiness')).toContainText('原魔弹射手骨架就绪');
 const b=(await page.locator('#arena').boundingBox())!,scale=Math.min(b.width/16,b.height/9);await page.mouse.move(b.x+b.width/2-6*scale,b.y+b.height/2);await page.mouse.down({button:'right'});await page.waitForFunction(()=>(window as any).AL03Snapshot().events.filter((e:any)=>e.eventKind==='resource-payment').length>=5);await page.mouse.up({button:'right'});
 const snapshot=await page.evaluate(()=>(window as any).AL03Snapshot()),payments=snapshot.events.filter((e:any)=>e.eventKind==='resource-payment');expect(snapshot.events.some((e:any)=>e.eventKind==='reload-complete')).toBe(true);expect(payments.length).toBeGreaterThanOrEqual(5);for(let i=1;i<4;i++)expect(payments[i].simTime-payments[i-1].simTime).toBeGreaterThanOrEqual(.39);
 writeFileSync(dir+'/action-lab.json',JSON.stringify({method:'natural character selection and RMB; no runtime changes',snapshot,errors},null,2));await page.screenshot({path:dir+'/action-lab.png'});expect(errors).toEqual([]);
});
