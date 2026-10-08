import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const evidence='../work/EN-01/browser';mkdirSync(evidence,{recursive:true});
async function snapshot(page:any,name:string,method:string){const data=await page.evaluate(()=>{const p=(window as any).prototype,s=p.state;return {time:s.time,controlled:s.controlledBodyId,units:s.units.filter((u:any)=>u.enemyV2||['hunter','ranger'].includes(u.id)).map((u:any)=>({id:u.id,hp:u.hp,life:u.life,pos:u.pos,basic:u.basicProfileId,enemy:u.enemyV2})),entities:s.enemyRuntime,legacy:{telegraphs:s.stats.telegraphsStarted??0},actors:p.scene.unitVisuals.size};});writeFileSync(evidence+'/'+name+'.json',JSON.stringify({method,...data},null,2));await page.screenshot({path:evidence+'/'+name+'.png'});return data;}
test.setTimeout(45000);
test('EN01 opt-in exposes one enemy in main exploration, controls and diagnostics',async({page})=>{
 await page.goto('/?en01=1');await expect(page.locator('#en01-panel')).toContainText('单敌动作验证');
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.filter((u:any)=>u.enemyV2).length)).toBe(1);
 await expect(page.locator('#en01-overlay')).toBeAttached();
 await page.locator('[data-en01="transport"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.enemyV2)?.enemyV2.profile.kind)).toBe('transport');
 await page.locator('[data-en01="reset"]').click();
 expect(await page.locator('#en01-panel a').getAttribute('href')).toBe('/');
});
test('EN01 natural main hit and Z switch preserve accepted actor, point and actual HP',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?en01=1&v=en01');
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.units.find((u:any)=>u.enemyV2)?.enemyV2.action?.context.actionId??0),{timeout:20000,intervals:[50]}).toBeLessThan(0);
 const cached=await page.evaluate(()=>structuredClone((window as any).prototype.state.units.find((u:any)=>u.enemyV2).enemyV2.action));
 await page.keyboard.press('z');
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.enemyV2).enemyV2.trace.filter((r:any)=>r.kind==='contact'&&r.hpLost>0).length)).toBeGreaterThan(0);
 const data=await snapshot(page,'A-hit-Z','Natural opt-in, wait; real Z keyboard switch. No state injection.');
 const e=data.units.find((u:any)=>u.enemy);expect(e.enemy.trace.find((r:any)=>r.kind==='accepted').targetId).toBe(cached.targetId);expect(cached.context.actorId).toBe(e.id);expect(data.legacy.telegraphs).toBe(0);expect(errors).toEqual([]);
});
test('EN01 real WASD escapes the locked sector, which still emits its release',async({page})=>{
 await page.goto('/?en01=1');await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.units.find((u:any)=>u.enemyV2)?.enemyV2.action?.context.actionId??0),{timeout:20000,intervals:[50]}).toBeLessThan(0);
 await page.keyboard.down('a');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.enemyV2).enemyV2.trace.some((r:any)=>r.event==='finish')),{timeout:20000,intervals:[50]}).toBe(true);await page.keyboard.up('a');
 const data=await snapshot(page,'B-whiff','Natural opt-in, real held A after acceptance.');const e=data.units.find((u:any)=>u.enemy);expect(e.enemy.trace.some((r:any)=>r.event==='attack')).toBe(true);expect(e.enemy.trace.filter((r:any)=>r.kind==='contact'&&r.targetId==='hunter')).toHaveLength(0);expect(data.units.find((u:any)=>u.id==='hunter').hp).toBe(360);
});
test('EN01 real right mouse directionally blocks in main exploration',async({page})=>{
 await page.goto('/?en01=1');await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.units.find((u:any)=>u.enemyV2)?.enemyV2.action?.context.actionId??0),{timeout:20000,intervals:[50]}).toBeLessThan(0);
 const p=await page.evaluate(()=>{const p=(window as any).prototype;return p.project(p.state.units.find((u:any)=>u.enemyV2).pos);});await page.mouse.move(p.x,p.y);await page.mouse.down({button:'right'});
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.enemyV2).enemyV2.trace.some((r:any)=>r.defense==='block'))).toBe(true);await page.mouse.up({button:'right'});
 const data=await snapshot(page,'D-guard','Natural opt-in, actual enemy projection; real RMB held toward enemy.');expect(data.units.find((u:any)=>u.id==='hunter').hp).toBe(360);
});
test('EN01 natural Al body receives the same main HP contact after keyboard positioning',async({page})=>{
 await page.goto('/?en01=1');await expect(page.locator('#en01-panel')).toBeVisible();await page.keyboard.press('z');
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.controlledBodyId)).toBe('ranger');
 await page.keyboard.down('w');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ranger').pos.y),{timeout:15000,intervals:[50]}).toBeLessThan(8.1);await page.keyboard.up('w');
 await page.keyboard.down('d');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ranger').pos.x),{timeout:15000,intervals:[50]}).toBeGreaterThan(6.6);await page.keyboard.up('d');
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ranger').hp),{timeout:20000}).toBeLessThan(260);
 const data=await snapshot(page,'A-Al-hit','Natural opt-in, real Z/W/D position Al beside enemy, then wait. No state injection.');expect(data.units.find((u:any)=>u.enemy).enemy.trace.some((r:any)=>r.targetId==='ranger'&&r.hpLost>0)).toBe(true);
});
test('EN01 main Reset clears generation and repeated switches do not grow views/listeners',async({page})=>{
 await page.goto('/?en01=1');await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.time)).toBeGreaterThan(0);const before=await page.evaluate(()=>(window as any).prototype.state.combatIdentity.generation);
 for(let i=0;i<12;i++){await page.locator('[data-en01="transport"]').click();await page.locator('[data-en01="reset"]').click();}
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.combatIdentity.generation)).toBe(before+24);
 expect(await page.locator('#en01-panel').count()).toBe(1);expect(await page.locator('#en01-overlay').count()).toBe(1);
 const data=await snapshot(page,'H-reset','Natural UI controls, 24 fixture re-entries; no state injection.');expect(data.entities?.entities??[]).toHaveLength(0);expect(data.actors).toBeLessThanOrEqual(5);
});
test('EN01 natural LMB kills the body after release while its delayed transport remains',async({page})=>{
 await page.goto('/?en01=1');await page.locator('[data-en01="transport"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.enemyRuntime?.entities.some((e:any)=>e.kind==='transport')??false),{timeout:20000,intervals:[50]}).toBe(true);
 const p=await page.evaluate(()=>{const p=(window as any).prototype;return p.project(p.state.units.find((u:any)=>u.enemyV2).pos);});await page.mouse.move(p.x,p.y);await page.mouse.down();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.enemyV2).life),{timeout:15000,intervals:[50]}).toBe('dead');await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.enemyV2).enemyV2.trace.some((r:any)=>r.kind==='land')),{timeout:12000}).toBe(true);
 const data=await snapshot(page,'G-death-after-release','Natural transport button, real held LMB after committed release. LMB lunge leaves the cached landing point, so retained landing may whiff. No state injection.');const e=data.units.find((u:any)=>u.enemy);expect(e.life).toBe('dead');expect(e.enemy.trace.some((r:any)=>r.kind==='land')).toBe(true);expect(data.legacy.telegraphs).toBe(0);
});
test('EN01 transport collides with an existing main-map wall in a labeled controlled fixture',async({page})=>{
 await page.goto('/?en01=1');await page.keyboard.press('Space');
 const placement=await page.evaluate(async()=>{const {commitEnemyRelease}=await import('/src/core/enemy-attack-entity.ts' as any),{allocateRuntimeAction,allocateRuntimeAttack}=await import('/src/core/combat-identity.ts' as any),{EN01_TRANSPORT}=await import('/src/core/en01-fixture.ts' as any);const s=(window as any).prototype.state,e=s.units.find((u:any)=>u.enemyV2),h=s.units.find((u:any)=>u.id==='hunter');
  const walls=s.tiles.filter((t:any)=>t.obstacle).sort((a:any,b:any)=>Math.hypot(a.x-h.pos.x,a.y-h.pos.y)-Math.hypot(b.x-h.pos.x,b.y-h.pos.y));let pair:any;
  for(const w of walls){for(const d of [{x:1,y:0},{x:0,y:1}]){const from={x:w.x-d.x,y:w.y-d.y},to={x:w.x+d.x,y:w.y+d.y};if([from,to].every(p=>s.tiles.some((t:any)=>t.x===p.x&&t.y===p.y&&!t.obstacle&&t.layer===0))){pair={wall:{x:w.x,y:w.y},from,to};break;}}if(pair)break;}if(!pair)throw Error('No existing wall pair');
  e.pos=e.drawPos=pair.from;h.pos=h.drawPos=pair.to;e.enemyV2.readyAt=s.time+20;const context=allocateRuntimeAction(s,e,{executedAbilityId:'controlled-wall'}),attack=allocateRuntimeAttack(s,context,s.time);commitEnemyRelease(s,{context,attack,profile:EN01_TRANSPORT,origin:pair.from,point:pair.to,facing:0});return pair;
 });
 await page.keyboard.press('Space');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.enemyV2).enemyV2.trace.some((r:any)=>r.kind==='blocked'&&r.reason==='wall')),{timeout:15000}).toBe(true);
 const data=await snapshot(page,'E-wall','Controlled injection: transport committed across existing obstacle; map geometry unmodified. Not natural AI qualification.');writeFileSync(evidence+'/E-wall-placement.json',JSON.stringify(placement));expect(data.units.find((u:any)=>u.id==='hunter').hp).toBe(360);
});
test('EN01 real pause, G slow-time and 2x reuse the main simulation clock',async({page})=>{
 await page.goto('/?en01=1');await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.time)).toBeGreaterThan(0);await page.keyboard.press('Space');const frozen=await page.evaluate(()=>(window as any).prototype.state.time);await page.waitForTimeout(400);expect(await page.evaluate(()=>(window as any).prototype.state.time)).toBe(frozen);await page.keyboard.press('Space');
 await page.mouse.move(720,400);await page.keyboard.down('g');await expect(page.locator('#tactic-wheel')).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.effectiveTimeScale)).toBe(.1);await page.keyboard.up('g');await page.keyboard.press('Alt');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.effectiveTimeScale)).toBe(2);await snapshot(page,'I-clock','Natural Space/G/Alt keyboard controls. Event equivalence additionally tested by deterministic simulation.');
});
