import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const snap=(page:Page)=>page.evaluate(()=>(window as any).AL03Snapshot());
async function start(page:Page,mode='ranged',build='base'){
 await page.goto('/action-lab.html');await expect(page.locator('#readiness')).toHaveText('原资源就绪');
 await page.locator('#encounter').selectOption(mode);await expect(page.locator('#al03-readiness')).toContainText('原骷髅弓');
 if(build!=='base'){await page.locator('#build').selectOption(build);await expect(page.locator('#al02-readiness')).toContainText('原冰柱');}
 await page.locator('#reset').click();
}
async function evidence(page:Page,name:string){await mkdir('../work/AL-03/browser',{recursive:true});await writeFile(`../work/AL-03/browser/${name}.json`,JSON.stringify(await snap(page),null,2));await page.screenshot({path:`../work/AL-03/browser/${name}.png`});}
async function pointer(page:Page,x:number,y:number){const b=(await page.locator('#arena').boundingBox())!,scale=Math.min(b.width/16,b.height/9);await page.mouse.move(b.x+b.width/2+x*scale,b.y+b.height/2-y*scale);}
async function waitShot(page:Page){await page.waitForFunction(()=>(window as any).AL03Snapshot().projectiles.length===3);}

test('AL03 A: real ranged mode emits visible native flight and stationary landing contact',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);await waitShot(page);
 await evidence(page,'A-flight');await expect(page.locator('#blue-hp')).not.toHaveText('100 / 100',{timeout:5000});
 const s=await snap(page),damage=s.events.find((e:any)=>e.eventKind==='damage'&&e.result==='landing-contact');
 expect(damage.actorId).toBe('ranged-1');expect(damage.targetId).toBe('blue');expect(damage.projectileId).toBeDefined();
 expect(damage.explosionId).toBeDefined();expect(errors).toEqual([]);await evidence(page,'A-contact');
});
test('AL03 B: WASD after the same shot leaves the landing region and explosion really misses',async({page})=>{
 await start(page);await waitShot(page);await page.keyboard.down('KeyW');await page.waitForTimeout(850);await page.keyboard.up('KeyW');
 await page.waitForFunction(()=>(window as any).AL03Snapshot().events.some((e:any)=>e.eventKind==='explosion-created'));
 expect((await snap(page)).blue.hp).toBe(100);await evidence(page,'B-move');
});
test('AL03 C: normal Space protects true explosion contact without deleting transports',async({page})=>{
 await start(page);await page.locator('#speed').selectOption('.25');await waitShot(page);
 const s=await snap(page),landing=s.projectiles[0].landing;
 // Aim within the primary landing; no movement key. Dodge contact happens before displacement escapes it.
 await pointer(page,landing.x,landing.y);
 await page.waitForFunction(()=>{const s=(window as any).AL03Snapshot();return s.projectiles.length&&s.projectiles[0].expiresAt-s.simTime<.018;});
 await page.keyboard.press('Space');await page.waitForFunction(()=>(window as any).AL03Snapshot().events.some((e:any)=>e.eventKind==='explosion-created'));
 const result=await snap(page);expect(result.events.some((e:any)=>e.eventKind==='evade'&&e.projectileId)).toBe(true);expect(result.blue.hp).toBe(100);await evidence(page,'C-evade');
});
test('AL03 D: mouse-facing guard blocks front origin and real reverse contact hurts',async({page})=>{
 for(const facing of ['front','back']){
  await start(page);await waitShot(page);const s=await snap(page),p=s.projectiles[0].landing;
  const dx=p.x-s.blue.x,dy=p.y-s.blue.y;
  await pointer(page,s.blue.x+dx*(facing==='front'?10:-10),s.blue.y+dy*(facing==='front'?10:-10));await page.mouse.down({button:'right'});
  await page.waitForFunction(()=>(window as any).AL03Snapshot().events.some((e:any)=>e.eventKind==='explosion-created'));await page.waitForTimeout(250);await page.mouse.up({button:'right'});
  const result=await snap(page);if(facing==='front'){expect(result.events.some((e:any)=>e.eventKind==='block'&&e.projectileId)).toBe(true);expect(result.frost).toBeLessThan(3);}else expect(result.blue.hp).toBeLessThan(100);
  await evidence(page,`D-${facing}`);
 }
});
test('AL03 E: normal melee input before Hit cancels that accepted ranged action with no projectiles',async({page})=>{
 await start(page);
 await page.waitForFunction(()=>{const s=(window as any).AL03Snapshot();return s.enemies[0].action&&s.enemies[0].action.time<.06;});
 const before=await snap(page);await pointer(page,before.enemies[0].x,before.enemies[0].y);
 await page.keyboard.down('KeyQ');await page.waitForTimeout(170);await page.keyboard.up('KeyQ');await page.waitForTimeout(550);
 await evidence(page,'E-attempt');const s=await snap(page),cancel=s.events.find((e:any)=>e.actorId==='ranged-1'&&e.eventKind==='cancel'&&e.result==='hurt'&&e.actionTime<.6333);
 expect(cancel).toBeDefined();expect(s.events.some((e:any)=>e.eventKind==='projectile-created'&&e.actionInstanceId===cancel.actionInstanceId)).toBe(false);await evidence(page,'E-interrupt');
});
test('AL03 F: normal attacks kill the archer after launch, admitted explosions still finish',async({page})=>{
 await start(page,'ranged','axe');await page.locator('#close').click();
 let s=await snap(page);await pointer(page,s.enemies[0].x,s.enemies[0].y);await page.mouse.down();await page.mouse.up();
 await page.waitForFunction(()=>(window as any).AL03Snapshot().enemies[0].hp<=40);
 await waitShot(page);s=await snap(page);const action=s.projectiles[0].sourceActionId;
 await pointer(page,s.enemies[0].x,s.enemies[0].y);await page.keyboard.down('KeyQ');await page.waitForTimeout(150);await page.keyboard.up('KeyQ');
 await page.waitForFunction(()=>(window as any).AL03Snapshot().enemies[0].hp===0);
 await page.waitForFunction(()=>{const s=(window as any).AL03Snapshot();return s.events.filter((e:any)=>e.eventKind==='explosion-created').length>=3;});
 s=await snap(page);const death=s.events.find((e:any)=>e.eventKind==='death'&&e.actorId==='ranged-1');
 const spawned=s.events.filter((e:any)=>e.eventKind==='projectile-created'&&e.actionInstanceId===action),exploded=s.events.filter((e:any)=>e.eventKind==='explosion-created'&&e.actionInstanceId===action);
 expect(spawned).toHaveLength(3);expect(exploded).toHaveLength(3);expect(death.simTime).toBeGreaterThan(spawned[0].simTime);expect(death.simTime).toBeLessThan(exploded[0].simTime);
 expect(s.events.some((e:any)=>e.eventKind==='accepted'&&e.actorId==='ranged-1'&&e.simTime>death.simTime)).toBe(false);await evidence(page,'F-owner-death');
});
test('AL03 G/H: normal B3 mixed combat kills both and identities stay separate',async({page})=>{
 test.setTimeout(90000);
 await start(page,'mixed','ice-axe');await waitShot(page);
 // Aim and approach living actors with normal keyboard / held attacks, never mutate authority HP.
 let held=false;
 for(let step=0;step<160;step++){
  const s=await snap(page);if(s.enemies.every((e:any)=>e.hp<=0))break;
  const enemy=s.enemies.find((e:any)=>e.hp>0),dx=enemy.x-s.blue.x,dy=enemy.y-s.blue.y;await pointer(page,enemy.x,enemy.y);
  const key=Math.abs(dx)>Math.abs(dy)?dx>0?'KeyD':'KeyA':dy>0?'KeyW':'KeyS';
  if(Math.hypot(dx,dy)>1.35){if(held){await page.mouse.up();held=false;}await page.keyboard.down(key);await page.waitForTimeout(150);await page.keyboard.up(key);}else {if(!held){await page.mouse.down();held=true;}await page.waitForTimeout(200);}
 }
 await page.mouse.up();await evidence(page,'G-H-attempt');const s=await snap(page);expect(s.blue.hp).toBeGreaterThan(0);expect(s.enemies.every((e:any)=>e.hp===0)).toBe(true);
 expect(new Set(s.events.filter((e:any)=>e.eventKind==='damage'&&e.actorId==='blue').map((e:any)=>e.targetId))).toEqual(new Set(['zombie','ranged-1']));
 const roots=s.events.filter((e:any)=>e.eventKind==='axe-created').map((e:any)=>e.attackEventId);expect(new Set(roots).size).toBe(roots.length);
 expect(s.events.some((e:any)=>e.eventKind==='ice-payment')).toBe(true);expect(s.events.some((e:any)=>e.eventKind==='explosion-created')).toBe(true);
 await evidence(page,'G-H-mixed-victory');
});
test('AL03 missing ranged resources disables only ranged encounters and base has no dependency',async({page})=>{
 const requests:string[]=[];page.on('request',r=>{if(r.url().includes('/ranged/'))requests.push(r.url());});
 await page.goto('/action-lab.html');await expect(page.locator('#readiness')).toHaveText('原资源就绪');expect(requests).toEqual([]);
 await page.route('**/ranged/unit.json',r=>r.abort());await page.locator('#encounter').selectOption('ranged');await expect(page.locator('#al03-readiness')).toContainText('缺失');
 expect((await snap(page)).encounter).toBe('melee');await expect(page.locator('#encounter option[value="mixed"]')).toHaveAttribute('disabled','');
 await page.locator('#close').click();await pointer(page,4,0);await page.mouse.down();await expect(page.locator('#enemy-hp')).not.toHaveText('110 / 110');await page.mouse.up();
});


test('AL03 time controls freeze transport and encounter reset retires the previous generation',async({page})=>{
 await start(page);await waitShot(page);await page.locator('#speed').selectOption('.25');
 const a=await snap(page);await page.waitForTimeout(200);const b=await snap(page);expect(b.simTime-a.simTime).toBeGreaterThan(.02);expect(b.simTime-a.simTime).toBeLessThan(.13);
 if(!(await snap(page)).paused)await page.locator('#pause').click();await expect(page.locator('#input-state')).toHaveText('暂停');const frozen=await snap(page);await page.waitForTimeout(200);expect((await snap(page)).projectiles).toEqual(frozen.projectiles);
 await page.locator('#encounter').selectOption('mixed');await page.waitForFunction(()=>(window as any).AL03Snapshot().encounter==='mixed');const reset=await snap(page);expect(reset.generation).toBeGreaterThan(frozen.generation);expect(reset.projectiles).toEqual([]);expect(reset.hazards).toEqual([]);expect(reset.enemies).toHaveLength(2);
 await evidence(page,'I-time-reset');
});
