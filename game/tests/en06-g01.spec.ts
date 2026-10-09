import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const dir='../work/EN06-G01/browser';mkdirSync(dir,{recursive:true});test.setTimeout(150000);
async function ordinary(page:any){await page.goto('/');await page.locator('[data-journey=exploration]').click();await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();await expect.poll(()=>page.evaluate(()=>['hunter','ranger'].every(id=>(window as any).prototype.scene.unitVisuals.get(id)?.reference?.ready)),{timeout:30000}).toBe(true);}
async function snapshot(page:any,name:string){const result=await page.evaluate(()=>{const p=(window as any).prototype,s=p.state;return {wall:performance.now(),time:s.time,real:s.realTime,scale:p.effectiveTimeScale,generation:s.combatIdentity.generation,controlled:s.controlledBodyId,tactics:s.partyTactics,units:s.units.filter((u:any)=>['hunter','ranger'].includes(u.id)).map((u:any)=>({id:u.id,life:u.life,pos:u.pos,basic:u.basicAction,chain:u.basicChain,hunter:u.hunterCombat,al:u.alCombat,decision:u.companionCombat})),combat:s.combatIdentity.trace};});writeFileSync(dir+'/'+name+'.json',JSON.stringify({method:'natural mouse/keys, read-only state; no runtime or position injection',...result},null,2));return result;}
for(const role of ['hunter','ranger'])test(`ordinary ${role}: natural held loop respects terminal Finish and recovery`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ordinary(page);if(role==='ranger')await page.keyboard.press('z');
 const q=await page.evaluate(()=>{const p=(window as any).prototype,u=p.state.units.find((u:any)=>u.id===p.state.controlledBodyId);return p.project({x:u.pos.x+1,y:u.pos.y});});await page.mouse.move(q.x,q.y);await page.mouse.down();
 const count=role==='hunter'?4:3;await expect.poll(()=>page.evaluate((role:string)=>{const u=(window as any).prototype.state.units.find((u:any)=>u.id===role),h=u.hunterCombat??u.alCombat;return h?.trace.filter((r:any)=>r.kind==='accepted'&&r.stage!==undefined).length??0;},role),{timeout:70000}).toBeGreaterThan(count);await page.mouse.up();
 const r=await snapshot(page,role+'-held'),u=r.units.find((u:any)=>u.id===role),rows=(u.hunter??u.al).trace,end=rows.find((r:any)=>r.kind==='accepted'&&r.stage===count-1),finish=rows.find((r:any)=>r.action===end.action&&r.kind==='Finish'),next=rows.find((r:any)=>r.kind==='accepted'&&r.stage===0&&r.at>end.at);
 expect(finish).toBeDefined();expect(next.at-end.at).toBeGreaterThanOrEqual(role==='hunter'?1.0832:1.5166);expect(next.at-finish.at).toBeGreaterThan(.23);expect(errors).toEqual([]);await page.screenshot({path:dir+'/'+role+'-held.png'});
});
test('natural terminal gate freezes on pause, advances at wheel .1, and Reset drops old generation',async({page})=>{
 await ordinary(page);const q=await page.evaluate(()=>{const p=(window as any).prototype,u=p.state.units.find((u:any)=>u.id==='hunter');return p.project({x:u.pos.x+1,y:u.pos.y});});await page.mouse.move(q.x,q.y);await page.mouse.down();
 await expect.poll(()=>page.evaluate(()=>{const u=(window as any).prototype.state.units.find((u:any)=>u.id==='hunter');return u.basicAction?.stageIndex===3&&u.basicAction.released;}),{timeout:40000,intervals:[25]}).toBe(true);await page.mouse.up();await page.keyboard.press('Space');const paused=await snapshot(page,'gate-paused');await page.waitForTimeout(350);const same=await snapshot(page,'gate-still-paused');expect(same.time).toBe(paused.time);expect(same.units[0].hunter.finalRecoveryUntil).toBe(paused.units[0].hunter.finalRecoveryUntil);
 await page.keyboard.press('Space');await page.keyboard.down('g');await expect(page.locator('#tactic-wheel')).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.effectiveTimeScale)).toBe(.1);const slow=await snapshot(page,'gate-slow-before');await page.waitForTimeout(500);const later=await snapshot(page,'gate-slow-after');expect(later.time-slow.time).toBeLessThan(.08);expect(later.units[0].hunter.finalRecoveryUntil).toBe(slow.units[0].hunter.finalRecoveryUntil);await page.keyboard.press('Escape');await page.keyboard.up('g');
 await page.goto('/?enemies=v2&mode=four');await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.time??0),{timeout:30000}).toBeGreaterThan(0);const old=await snapshot(page,'four-before-reset');await page.locator('[data-v2=reset]').click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.time??0),{timeout:30000}).toBeGreaterThan(0);const reset=await snapshot(page,'four-after-reset');expect(reset.generation).toBe(old.generation+1);expect(reset.units.every((u:any)=>(u.hunter?.finalRecoveryUntil??u.al?.finalRecoveryUntil??0)===0)).toBe(true);
});
test('four-enemy natural G in both directions: actual Basic uses focused enemy',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const ai of ['ranger','hunter']){
  await page.goto('/?enemies=v2&mode=four');await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.time??0),{timeout:30000}).toBeGreaterThan(0);if(ai==='hunter')await page.keyboard.press('z');
  const hover=await page.evaluate(()=>{const p=(window as any).prototype,e=p.state.units.find((u:any)=>u.id==='v2-zombie'),q=p.project(e.pos);for(let dy=-70;dy<=30;dy+=5)for(let dx=-40;dx<=40;dx+=5){const x=q.x+dx,y=q.y+dy;if(document.elementFromPoint(x,y)?.closest('#scene')&&p.scene.pick(x,y).unitId===e.id)return {x,y,id:e.id};}throw Error('no visible original zombie hover');});
  await page.mouse.move(hover.x,hover.y);await page.keyboard.down('g');await expect(page.locator('#tactic-wheel')).toBeVisible();expect(await page.evaluate(()=>(window as any).prototype.wheel.targetId)).toBe(hover.id);const box=(await page.locator('#tactic-wheel').boundingBox())!;await page.mouse.move(box.x+box.width-25,box.y+box.height/2);await page.keyboard.up('g');
  await expect.poll(()=>page.evaluate((ai:string)=>(window as any).prototype.state.partyTactics?.[ai]?.targetId,ai)).toBe(hover.id);
  await expect.poll(()=>page.evaluate((ai:string)=>{const u=(window as any).prototype.state.units.find((u:any)=>u.id===ai);return u.companionCombat?.actualBasicTargetId;},ai),{timeout:40000}).toBe(hover.id);const r=await snapshot(page,ai+'-focus');const u=r.units.find((u:any)=>u.id===ai);expect(u.decision.targetId).toBe(hover.id);expect(u.decision.actualBasicTargetId).toBe(hover.id);
 }
 expect(errors).toEqual([]);
});

test('four-enemy free AI starts ordinary Basic at its committed target in both roles',async({page})=>{
 const samples:any[]=[];
 for(const ai of ['ranger','hunter']){
  await page.goto('/?enemies=v2&mode=four');await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.time??0),{timeout:30000}).toBeGreaterThan(0);if(ai==='hunter')await page.keyboard.press('z');
  const seen=new Set<string>();
  await expect.poll(async()=>{const r=await page.evaluate((ai:string)=>{const s=(window as any).prototype.state,u=s.units.find((u:any)=>u.id===ai),a=u.basicAction;return {role:ai,time:s.time,action:a?.combatContext?.actionId,elapsed:a?.elapsed,target:a?.targetId,decision:u.companionCombat?.targetId,focus:s.partyTactics?.[ai]?.targetId,reason:u.companionCombat?.switchReason};},ai);
   if(r.action&&!seen.has(r.action)&&r.elapsed<.1){seen.add(r.action);samples.push(r);expect(r.focus).toBeUndefined();expect(r.target).toBeTruthy();expect(r.target).toBe(r.decision);}return seen.size;
  },{timeout:40000,intervals:[25]}).toBeGreaterThanOrEqual(2);
  await snapshot(page,ai+'-free-ai');
 }
 writeFileSync(dir+'/free-ai-acceptances.json',JSON.stringify({method:'natural Z only; read-only observation at Basic acceptance; no G, injected command or entity modification',samples},null,2));
});
