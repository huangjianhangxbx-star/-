import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('AL02 four builds have native ice pose, independent axe, causal logs and safe base return',async({page})=>{
 const assets:string[]=[];page.on('request',request=>{if(request.url().includes('/effects/'))assets.push(request.url());});
 await page.goto('/action-lab.html');await expect(page.locator('#readiness')).toHaveText('原资源就绪');
 await page.locator('#build').selectOption('ice-axe');await expect(page.locator('#al02-readiness')).toContainText('原冰柱');
 await expect(page.locator('#al02-readiness')).toContainText('原冰柱');
 expect(assets.some(url=>url.endsWith('/effects/column.png'))).toBe(true);
 expect(assets.some(url=>url.endsWith('/effects/axe.png'))).toBe(true);
 const b=(await page.locator('#arena').boundingBox())!;
 await page.keyboard.press('Space');await page.waitForTimeout(350);await page.mouse.move(b.x+b.width*.9,b.y+b.height*.5);await page.mouse.down();
 await expect(page.locator('#events')).toContainText('column-created',{timeout:6000});await page.mouse.up();
 const pending=page.waitForEvent('download');await page.locator('#export').click();await(await pending).saveAs('../work/AL-02/normal-b3.json');
 const round=JSON.parse(await readFile('../work/AL-02/normal-b3.json','utf-8'));
 expect(round.events.some((e:any)=>e.eventKind==='dodge'&&e.result==='accepted')).toBe(true);
 expect(round.events.some((e:any)=>e.eventKind==='ice-payment')).toBe(true);
 expect(round.events.some((e:any)=>e.eventKind==='axe-created')).toBe(true);
 expect(round.events.some((e:any)=>e.eventKind==='attack-event'&&e.executedSkillId==='小蓝a4.8戳地')).toBe(true);
 await page.screenshot({path:'../work/AL-02/normal-b3.png',timeout:60000});
 await page.mouse.move(b.x+b.width*.05,b.y+b.height*.5);await page.mouse.down();await expect(page.locator('#enemy-hp')).toHaveText('0 / 110',{timeout:10000});await page.mouse.up();
 await page.screenshot({path:'../work/AL-02/normal-b3-victory.png',timeout:60000});
 await page.locator('#build').selectOption('base');await expect(page.locator('#axe-resource')).toContainText('未装备');
 for(let i=0;i<3;i++)await page.locator('#reset').click();
 await page.locator('#pause').click();await expect(page.locator('#input-state')).toHaveText('暂停');await page.locator('#pause').click();
 await page.mouse.down();await page.waitForTimeout(800);await page.mouse.up();await expect(page.locator('#events')).not.toContainText('axe-created');
});
test('normal movement times CD so actual third ice attack starts the B3 axe chain',async({page})=>{
 await page.goto('/action-lab.html');await expect(page.locator('#readiness')).toHaveText('原资源就绪');
 await page.locator('#build').selectOption('ice-axe');await expect(page.locator('#al02-readiness')).toContainText('原冰柱');await page.locator('#reset').click();
 const b=(await page.locator('#arena').boundingBox())!;
 await page.mouse.move(b.x+b.width*.05,b.y+b.height*.5);await page.mouse.down();await page.waitForTimeout(70);await page.mouse.up();
 await page.waitForTimeout(280);await page.keyboard.down('KeyA');await page.waitForTimeout(6800);await page.keyboard.up('KeyA');
 await page.keyboard.down('KeyD');await page.waitForTimeout(380);await page.keyboard.up('KeyD');
 await page.waitForFunction(()=>parseFloat(document.querySelector('#axe-resource')!.textContent!)<=.3);
 await page.mouse.move(b.x+b.width*.9,b.y+b.height*.5);await page.mouse.down();await page.waitForTimeout(1200);await page.mouse.up();
 const pending=page.waitForEvent('download');await page.locator('#export').click();await(await pending).saveAs('../work/AL-02/normal-b3-ice-axe-chain.json');
 const round=JSON.parse(await readFile('../work/AL-02/normal-b3-ice-axe-chain.json','utf-8'));
 const created=round.events.find((e:any)=>e.eventKind==='axe-created'&&e.executedSkillId==='小蓝a4.8戳地');
 expect(created).toBeDefined();const damage=round.events.find((e:any)=>e.eventKind==='damage'&&e.result==='axe-contact'&&e.attackEventId===created.attackEventId);
 expect(damage).toBeDefined();expect(damage.sourceSkillId).toBe('小蓝a4.8戳地');expect(damage.resourceDelta).toBeLessThan(0);
 await page.screenshot({path:'../work/AL-02/normal-b3-ice-axe-chain.png',timeout:60000});
});
test('missing axe disables only dependent builds and leaves original baseline playable',async({page})=>{
 await page.route('**/effects/axe.png',route=>route.abort());await page.goto('/action-lab.html');
 await expect(page.locator('#readiness')).toHaveText('原资源就绪');
 await page.locator('#build').selectOption('axe');await expect(page.locator('#al02-readiness')).toContainText('大斧');
 await expect(page.locator('#build option[value="axe"]')).toHaveAttribute('disabled','');
 await expect(page.locator('#build option[value="ice-axe"]')).toHaveAttribute('disabled','');
 await expect(page.locator('#build option[value="ice"]')).not.toHaveAttribute('disabled','');
 await page.locator('#build').selectOption('ice');await page.locator('#build').selectOption('base');
 await page.locator('#reset').click();await expect(page.locator('#blue-hp')).toContainText('100');
});
test('ordinary B0, B1 and B2 comparisons preserve old third attack and show new whiff/CD behavior',async({page})=>{
 await page.goto('/action-lab.html');await expect(page.locator('#readiness')).toHaveText('原资源就绪');
 for(const build of ['base','ice','axe']){
  await page.locator('#build').selectOption(build);if(build!=='base')await expect(page.locator('#al02-readiness')).toContainText('原冰柱');await page.locator('#reset').click();
  const b=(await page.locator('#arena').boundingBox())!;await page.mouse.move(b.x+b.width*.05,b.y+b.height*.5);await page.mouse.down();await page.waitForTimeout(950);await page.mouse.up();
  const pending=page.waitForEvent('download');await page.locator('#export').click();const file=`../work/AL-02/normal-${build}.json`;await(await pending).saveAs(file);
  const round=JSON.parse(await readFile(file,'utf-8'));expect(round.events.some((e:any)=>e.eventKind==='damage'&&e.actorId==='blue')).toBe(false);
  if(build==='base'){expect(round.events.some((e:any)=>e.eventKind==='attack-event'&&e.executedSkillId==='小蓝a3')).toBe(true);expect(round.events.some((e:any)=>e.eventKind==='ice-payment'||e.eventKind==='axe-created')).toBe(false);}
  if(build==='ice'){expect(round.events.some((e:any)=>e.eventKind==='column-created')).toBe(true);expect(round.events.some((e:any)=>e.eventKind==='ice-payment'&&e.resourceDelta===-1)).toBe(true);}
  if(build==='axe'){expect(round.events.filter((e:any)=>e.eventKind==='axe-created')).toHaveLength(1);expect(round.events.some((e:any)=>e.eventKind==='axe-rejected'&&e.result==='cooldown')).toBe(true);}
  await page.screenshot({path:`../work/AL-02/normal-${build}.png`,timeout:60000});
 }
});
test('base and old energy do not request optional AL02 sprites',async({page})=>{
 const requests:string[]=[];page.on('request',r=>{if(r.url().includes('/effects/'))requests.push(r.url());});
 await page.goto('/action-lab.html');await expect(page.locator('#readiness')).toHaveText('原资源就绪');await page.waitForTimeout(100);
 await page.locator('#build').selectOption('energy');await page.waitForTimeout(100);expect(requests).toEqual([]);
});
