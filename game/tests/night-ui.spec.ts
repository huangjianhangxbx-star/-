import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='../work/NIGHT-UI-20261010/UI-01B/browser';mkdirSync(out,{recursive:true});
test.setTimeout(90000);
for(const [width,height] of [[1440,900],[1280,720],[1920,1080]])test(`real geometry HUD and fixed identity at ${width}`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height});await page.goto('/');await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();
 await expect.poll(()=>page.evaluate(()=>['hunter','ranger'].every(id=>(window as any).prototype?.scene.unitVisuals.get(id)?.reference?.ready)),{timeout:30000}).toBe(true);
 const hunter=page.locator('[data-body=hunter]'),al=page.locator('[data-body=ranger]');
 await expect(hunter.locator('[data-passive-level]')).toHaveCount(3);await expect(al.locator('[data-passive-level]')).toHaveCount(3);
 await expect(page.locator('#quick-reserved [data-slot]')).toHaveCount(10);
 const hb=(await hunter.boundingBox())!,ab=(await al.boundingBox())!;expect(hb.y).toBeLessThan(80);expect(ab.y).toBeGreaterThan(height/2);
 await page.keyboard.press('z');await expect(al).toHaveClass(/controlled/);await expect(page.locator('#action-strip')).toContainText('火箭弹射');await page.keyboard.press('z');await expect(hunter).toHaveClass(/controlled/);
 await page.keyboard.press('Space');
 const read=()=>page.evaluate(()=>{const s=(window as any).prototype.state;return {time:s.time,control:s.controlledBodyId,resources:s.economy.carried,hp:s.units.find((u:any)=>u.id==='hunter').hp,events:s.combatEvents.length};});
 const before=await read();for(const k of ['q','r','v','y','Tab','1','2','3','4','5','6','7','8','9','0'])await page.keyboard.press(k);
 await page.locator('[data-passive-level="1"]').first().click();expect(await read()).toEqual(before);
 const layout=await page.evaluate(()=>['[data-body=hunter]','[data-body=ranger]','#action-strip','#quick-reserved','#world-status'].map(selector=>{const b=document.querySelector(selector)!.getBoundingClientRect();return {selector,x:b.x,y:b.y,w:b.width,h:b.height};}));
 for(const b of layout){expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.w).toBeLessThanOrEqual(width+1);expect(b.y+b.h).toBeLessThanOrEqual(height+1);}
 const files=await page.evaluate(()=>performance.getEntriesByType('resource').map((x:any)=>x.name).filter((x:string)=>x.includes('/assets/ui/geometry/')));expect(files.length).toBeGreaterThanOrEqual(5);
 const sources=await page.evaluate(async()=>{const paths=['portrait/frame.png','bar/base.png','bar/frame.png','bar/fill_full.png','square/preview.png','diamond/preview.png'];return Promise.all(paths.map(async p=>{const im=new Image();im.src='/assets/ui/geometry/'+p;await im.decode();return {p,w:im.naturalWidth,h:im.naturalHeight};}));});expect(sources.every(s=>s.w>0&&s.h>0)).toBe(true);
 await page.screenshot({path:out+`/after-${width}.png`});writeFileSync(out+`/layout-${width}.json`,JSON.stringify({layout,files,sources,errors},null,2));expect(errors).toEqual([]);
});

test('missing geometry is diagnosed visibly without booting fake UI values',async({page})=>{
 await page.route('**/assets/ui/geometry/**',route=>route.abort());await page.goto('/');
 await expect(page.locator('#error')).toContainText('UI资源加载失败');
 await page.screenshot({path:out+'/missing-geometry.png'});await page.unroute('**/assets/ui/geometry/**');await page.reload();
 await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();
 await expect(page.locator('[data-body=hunter]')).toBeVisible();
 await page.keyboard.press('Space');
 const bars=await page.evaluate(()=>{const s=(window as any).prototype.state;return s.units.filter((u:any)=>['hunter','ranger'].includes(u.id)).map((u:any)=>{const card=document.querySelector(`[data-body="${u.id}"]`)!;return {id:u.id,hp:u.hp,maxHp:u.maxHp,hpClip:(card.querySelector('.duo-health') as HTMLElement).style.clipPath,posture:u.posture,maxPosture:u.maxPosture,postureClip:(card.querySelector('.duo-posture i') as HTMLElement).style.clipPath,text:card.querySelector('.duo-values')!.textContent};});});
 for(const b of bars){expect(parseFloat(b.hpClip.split(' ')[1])).toBeCloseTo(100-(2.15+b.hp/b.maxHp*95.7),3);expect(parseFloat(b.postureClip.split(' ')[1])).toBeCloseTo(100-(2.15+b.posture/b.maxPosture*95.7),3);expect(b.text).toContain(`生命 ${Math.ceil(b.hp)}/${b.maxHp}`);}
 writeFileSync(out+'/bars-state.json',JSON.stringify(bars,null,2));
});
