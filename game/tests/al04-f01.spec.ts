import {test,expect,type Page} from '@playwright/test';
const snap=(p:Page)=>p.evaluate(()=>(window as any).AL03Snapshot());
async function start(page:Page){await page.goto('/action-lab.html');await expect(page.locator('#readiness')).toHaveText('原资源就绪');await page.locator('#player').selectOption('cannoneer');await expect(page.locator('#player-readiness')).toContainText('原魔弹射手骨架就绪');}
async function pointer(page:Page,x:number,y=0){const b=(await page.locator('#arena').boundingBox())!,scale=Math.min(b.width/16,b.height/9);await page.mouse.move(b.x+b.width/2+x*scale,b.y+b.height/2-y*scale);}
test('F01 yellow RMB never plays the generic dagger slash recording',async({page})=>{
 await page.addInitScript(()=>{(window as any).playedBuffers=[];const original=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){(window as any).playedBuffers.push(this.buffer?.duration);return original.apply(this,args);};});
 await start(page);await pointer(page,-6);await page.mouse.down({button:'right'});await page.waitForTimeout(1000);await page.mouse.up({button:'right'});
 expect((await snap(page)).events.some((e:any)=>e.eventKind==='resource-payment')).toBe(true);
 const buffers:number[]=await page.evaluate(()=>(window as any).playedBuffers);
 expect(buffers.length).toBeGreaterThan(0);
 // Native release.wav is 匕首斩改, 0.1745833 seconds; shooting must not route into it.
 expect(buffers.some(n=>Math.abs(n-.17458333333333334)<.00001)).toBe(false);
});
test('F01 the first real click plays one gunshot while audio unlock completes',async({page})=>{
 await page.addInitScript(()=>{(window as any).playedBuffers=[];const original=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){(window as any).playedBuffers.push(this.buffer?.duration);return original.apply(this,args);};});
 await start(page);await pointer(page,-6);await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});await page.waitForTimeout(450);
 expect((await snap(page)).events.filter((e:any)=>e.eventKind==='resource-payment')).toHaveLength(1);
 const buffers:number[]=await page.evaluate(()=>(window as any).playedBuffers);
 expect(buffers.filter(n=>Math.abs(n-.3843958333333333)<.00001)).toHaveLength(1);
});
test('F01 real held response clears four ammo at the existing cadence and then reloads',async({page})=>{
 await start(page);await pointer(page,-6);await page.mouse.down({button:'right'});await page.waitForTimeout(2000);await page.mouse.up({button:'right'});
 const s=await snap(page),payments=s.events.filter((e:any)=>e.eventKind==='resource-payment'),fires=s.events.filter((e:any)=>e.eventKind==='yellow-fire');
 expect(payments).toHaveLength(4);expect(fires).toHaveLength(4);
 for(let i=1;i<4;i++)expect(payments[i].simTime-payments[i-1].simTime).toBeGreaterThanOrEqual(.39);
 expect(s.resources[0].value).toContain('0 / 4');
 await page.waitForFunction(()=>(window as any).AL03Snapshot().events.some((e:any)=>e.eventKind==='reload-complete'));
 expect((await snap(page)).resources[0].value).toBe('4 / 4');
});
test('F01 held input resumes only after completed reload; release does not queue future responses',async({page})=>{
 await start(page);await pointer(page,-6);await page.mouse.down({button:'right'});
 await page.waitForFunction(()=>(window as any).AL03Snapshot().events.filter((e:any)=>e.eventKind==='resource-payment').length>=5);
 await page.mouse.up({button:'right'});const count=(await snap(page)).events.filter((e:any)=>e.eventKind==='resource-payment').length;
 await page.waitForTimeout(500);expect((await snap(page)).events.filter((e:any)=>e.eventKind==='resource-payment')).toHaveLength(count);
});
for(const encounter of ['melee','ranged'])test(`F01 fast iron round contacts the actual ${encounter} target`,async({page})=>{
 await start(page);if(encounter==='ranged')await page.locator('#encounter').selectOption(encounter);await pointer(page,5);
 await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});
 await expect(page.locator('#enemy-hp')).toHaveText('78 / 110');
 const s=await snap(page),attack=s.events.find((e:any)=>e.eventKind==='attack-event'&&e.actorId==='yellow');
 expect(attack.executedSkillId).toBe('小黄远程');expect(attack.slotSkillId).toBe('小黄远程找子弹');
 expect(s.events.filter((e:any)=>e.eventKind==='damage'&&e.actorId==='yellow')).toHaveLength(1);
});
test('F01 reload pauses for the retained approved roll rule and safe Reset clears held shooting',async({page})=>{
 await start(page);await pointer(page,-6);await page.mouse.down({button:'right'});
 await page.waitForFunction(()=>(window as any).AL03Snapshot().events.some((e:any)=>e.eventKind==='reload-start'));await page.mouse.up({button:'right'});
 await page.locator('#speed').selectOption('.25');const before=(await snap(page)).resources[0].value;
 await page.keyboard.press('Space');await page.waitForTimeout(250);expect((await snap(page)).resources[0].value).toBe(before);
 await page.locator('#reset').click();await page.waitForTimeout(500);const s=await snap(page);expect(s.resources[0].value).toBe('4 / 4');expect(s.events.some((e:any)=>e.eventKind==='yellow-fire')).toBe(false);
});
