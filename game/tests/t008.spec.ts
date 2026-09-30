import {test,expect,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const evidence=fileURLToPath(new URL('../../记录/验证/T-008/',import.meta.url));
async function start(page:Page){await page.goto('/');await page.getByRole('button',{name:'进入战斗',exact:true}).click();await page.evaluate(()=>{const s=(window as any).prototype.state;s.waves=[];s.totalEnemies=999;s.units.forEach((u:any)=>u.ready=0);});}
const speed=(page:Page)=>page.locator('#speed-btn');
const slow=(page:Page)=>page.locator('#time-mode');
test('Fiorre source body is a readable ally size with feet fixed at the logical ground point',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'进入战斗',exact:true})).toBeEnabled();
 const rows=await page.evaluate(async()=>{const {BattleScene}=await import('/src/view/scene.ts' as string),{createGame}=await import('/src/core/engine.ts' as string);const host=document.createElement('div');Object.assign(host.style,{position:'fixed',inset:'0',zIndex:'100'});document.body.append(host);const scene=new BattleScene(host),s=createGame();s.phase='battle';s.waves=[];s.units.forEach((u:any,i:number)=>{u.life='active';u.pos={x:3+i*1.2,y:4};u.drawPos={...u.pos};});scene.update(s,{selectedId:null,hover:null,path:[],range:[],deployTiles:[],targeting:false},.01);const rows=[...scene.unitVisuals.values()].map((a:any)=>{const c=a.spine.canvas,px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let top=c.height,bottom=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(px[(y*c.width+x)*4+3]>80){top=Math.min(top,y);bottom=Math.max(bottom,y);}return {id:a.unit.id,asset:a.unit.asset,pixelHeight:bottom-top+1,worldHeight:(bottom-top+1)/c.height*a.sprite.scale.y,anchor:a.sprite.center.y,logical:{...a.unit.pos}};});scene.dispose();host.remove();return rows;});
 writeFileSync(evidence+'model-measurements.json',JSON.stringify(rows,null,2));
 const f=rows.find(r=>r.id==='fiorre')!;expect(f.worldHeight).toBeGreaterThanOrEqual(1.15);expect(f.worldHeight).toBeLessThanOrEqual(1.55);expect(f.anchor).toBe(.12109375);expect(f.logical).toEqual({x:4.2,y:4});
});
for(const action of ['cancel','move','direct','skill','blink','menu','reselect'] as const)test(`2x survives ${action} after temporary observation`,async({page})=>{
 await start(page);await speed(page).click();await expect(speed(page)).toHaveText('2×');await page.locator('[data-unit="hunter"]').click();await expect(slow(page)).toContainText('0.1');
 if(action==='cancel')await page.mouse.click(1000,300,{button:'right'});
 if(action==='move'){const p=await page.evaluate(()=>(window as any).prototype.project({x:3,y:4}));await page.mouse.click(p.x,p.y);}
 if(action==='direct'){await page.keyboard.down('d');await page.keyboard.up('d');}
 if(action==='skill'){await page.evaluate(()=>(window as any).prototype.state.units[0].skillCd=0);await page.keyboard.press('e');}
 if(action==='blink'){await page.keyboard.down('d');await page.keyboard.press('ShiftLeft');await page.keyboard.up('d');await expect(page.locator('#blink-stock')).toHaveText('9 / 10');}
 if(action==='menu'){await page.locator('[data-action="build"]').first().click();await page.locator('[data-action="close-build"]').click();}
 if(action==='reselect'){const p=await page.evaluate(()=>{const api=(window as any).prototype;return api.project(api.state.units[0].pos);});await page.mouse.click(p.x,p.y);}
 await expect(slow(page)).toHaveText('');await expect(speed(page)).toHaveText('2×');
});
test('removed targeting card ends observation without resetting 2x',async({page})=>{
 await start(page);await speed(page).click();const card=page.locator('[data-card]').first();const id=await card.getAttribute('data-card');await card.click();await expect(slow(page)).toContainText('0.1');await page.evaluate(id=>{const s=(window as any).prototype.state;s.cards=s.cards.filter((c:any)=>c.id!==id);},id);await expect(slow(page)).toHaveText('');await expect(speed(page)).toHaveText('2×');
});
test('left Alt toggles the preference once, keeps card aim and fixed 0.1x observation; right Alt is inert',async({page})=>{
 await start(page);await page.locator('[data-card]').first().click();await expect(slow(page)).toContainText('0.1');await page.keyboard.down('AltLeft');await expect(speed(page)).toHaveText('2×');await page.keyboard.down('AltLeft');await expect(speed(page)).toHaveText('2×');await page.keyboard.up('AltLeft');await expect(slow(page)).toContainText('0.1');await expect(page.locator('.tactic-card.chosen')).toHaveCount(1);await page.keyboard.press('AltRight');await expect(speed(page)).toHaveText('2×');await page.mouse.click(1000,300,{button:'right'});await expect(speed(page)).toHaveText('2×');await expect(slow(page)).toHaveText('');await page.keyboard.press('AltLeft');await expect(speed(page)).toHaveText('1×');
});
test('speed button and left Alt preserve paused observation and share the same setting',async({page})=>{
 await start(page);await page.locator('[data-unit="hunter"]').click();await speed(page).click();await expect(slow(page)).toContainText('0.1');expect(await page.evaluate(()=>(window as any).prototype.interaction.selectedId)).toBe('hunter');await page.keyboard.press('Space');const t=await page.evaluate(()=>(window as any).prototype.state.time);await page.keyboard.press('AltLeft');await expect(speed(page)).toHaveText('1×');await expect(slow(page)).toHaveText('战术暂停');await page.mouse.click(1000,300,{button:'right'});await expect(slow(page)).toHaveText('战术暂停');await page.waitForTimeout(120);expect(await page.evaluate(()=>(window as any).prototype.state.time)).toBe(t);await page.keyboard.press('Space');await expect(speed(page)).toHaveText('1×');
});
