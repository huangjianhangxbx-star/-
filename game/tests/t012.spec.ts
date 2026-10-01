import {test,expect,type Page} from '@playwright/test';
async function enter(page:Page){await page.goto('/');await page.locator('[data-action="carry"]').click();await expect(page.getByRole('button',{name:'进入战斗',exact:true})).toBeEnabled();}
test('briefing identifies short content and battle abandon is distinct and cancellable',async({page})=>{
 await enter(page);await expect(page.locator('.brief-note')).toContainText('短塔防 · 3波');
 await page.locator('[data-action="abandon-battle"]').click();await expect(page.locator('#economy-confirm')).toBeVisible();await expect(page.locator('#economy-confirm-text')).toContainText('2 → 1');
 await page.locator('[data-action="cancel-economic"]').click();expect(await page.evaluate(()=>(window as any).prototype.state.retries)).toBe(2);
 await page.locator('[data-action="abandon-battle"]').click();await page.locator('[data-action="confirm-economic"]').click();await expect(page.locator('#phase-panel h2')).toHaveText('已放弃本场');expect(await page.evaluate(()=>(window as any).prototype.state.retries)).toBe(1);
});
test('batch preview and wave HUD share simulation timing and pause at the selected speed',async({page})=>{
 await enter(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();await page.locator('[data-action="speed"]').click();await page.locator('[data-action="pause"]').click();
 await page.evaluate(async()=>{const {step}=await import('/src/core/engine.ts' as string);step((window as any).prototype.state,14);});
 await expect(page.locator('#wave')).toContainText('1 / 3');await expect(page.locator('#batch-forecast [data-batch="short-1/batch-1"]')).toContainText('第1批');
 await page.evaluate(()=>{(window as any).forecastNode=document.querySelector('#batch-forecast [data-batch]');});
 const next=await page.evaluate(async()=>{const {step}=await import('/src/core/engine.ts' as string),s=(window as any).prototype.state;step(s,.2);return (18-s.time).toFixed(1)+'s';});
 await expect(page.locator('#batch-forecast strong')).toHaveText(next);
 expect(await page.evaluate(()=>(window as any).forecastNode===document.querySelector('#batch-forecast [data-batch]'))).toBe(true);
 const t=await page.evaluate(()=>(window as any).prototype.state.time);await page.waitForTimeout(250);expect(await page.evaluate(()=>(window as any).prototype.state.time)).toBe(t);
 await page.locator('[data-action="abandon-battle"]').click();await page.locator('[data-action="cancel-economic"]').click();await expect(page.locator('#speed-btn')).toHaveText('2×');await expect(page.locator('#pause-btn')).toHaveText('继续');
});
test('compact exit confirmation remains reachable with a full hand',async({page})=>{
 await page.setViewportSize({width:1000,height:720});await enter(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();await page.locator('[data-action="pause"]').click();
 await page.evaluate(async()=>{const {makeCard}=await import('/src/core/cards.ts' as string),{command}=await import('/src/core/engine.ts' as string),s=(window as any).prototype.state;s.cards=Array.from({length:8},()=>makeCard(s,'power'));s.fragments=200;for(const p of [{x:3,y:4},{x:4,y:4},{x:5,y:4},{x:6,y:4},{x:3,y:5},{x:4,y:5},{x:5,y:5},{x:6,y:5}])command(s,{type:'clone',id:'hunter',to:p});});
 await page.locator('[data-unit="hunter"]').click();await expect(page.locator('[data-copy-select]')).toHaveCount(8);
 await page.locator('[data-action="abandon-battle"]').click();await expect(page.locator('#economy-confirm')).toBeVisible();await expect(page.locator('[data-action="confirm-economic"]')).toBeInViewport();await expect(page.locator('[data-action="cancel-economic"]')).toBeInViewport();
 await page.screenshot({path:'../记录/验证/T-012/compact-exit.png'});
});

test('overlapping route previews stay static with reduced motion and release every replaced object',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await enter(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();await page.locator('[data-action="pause"]').click();
 await page.evaluate(()=>{const s=(window as any).prototype.state;s.waves[0].batches[1].offset=0;s.time=14;});
 await expect(page.locator('#batch-forecast [data-batch]')).toHaveCount(2);
 await expect(page.locator('#batch-forecast')).toHaveCSS('position','absolute');
 const bounds=await page.locator('#batch-forecast').boundingBox();expect(bounds!.y).toBeGreaterThan(76);expect(bounds!.x).toBeGreaterThan(300);
 const mode=await page.locator('#time-mode').boundingBox();expect(bounds!.y).toBeGreaterThan(mode!.y+mode!.height+6);
 await page.screenshot({path:'../记录/验证/T-012/dual-preview-1440.png'});
 const counts=await page.evaluate(async()=>{
  const {BattleScene}=await import('/src/view/scene.ts' as string),{createGame,command}=await import('/src/core/engine.ts' as string);
  const host=document.createElement('div');Object.assign(host.style,{width:'400px',height:'300px',position:'fixed'});document.body.append(host);
  const scene:any=new BattleScene(host),s=createGame();command(s,{type:'carry',gold:0,vitality:0});s.phase='battle';s.waves[0].batches[1].offset=0;
  let disposed=0;const rows=[],staticRows=[];
  try{for(let n=0;n<12;n++){
   s.waveState!.anchor=18+n*10;s.time=s.waveState!.anchor-4;scene.updateWaves(s);rows.push(scene.waveGroup.children.length);
   const old=scene.waveGroup.children.slice();for(const o of old){o.geometry.addEventListener('dispose',()=>disposed++);o.material.addEventListener('dispose',()=>disposed++);}
   const positions=scene.wavePreviews.flatMap((p:any)=>p.heads.map((h:any)=>h.position.toArray()));s.time+=1;scene.updateWaves(s);
   staticRows.push(JSON.stringify(positions)===JSON.stringify(scene.wavePreviews.flatMap((p:any)=>p.heads.map((h:any)=>h.position.toArray()))));
   s.time=s.waveState!.anchor;scene.updateWaves(s);rows.push(scene.waveGroup.children.length);
  }return {rows,staticRows,disposed};}finally{scene.dispose();host.remove();}
 });
 expect(counts.rows).toEqual(Array.from({length:12},()=>[8,0]).flat());expect(counts.staticRows).toEqual(Array(12).fill(true));expect(counts.disposed).toBe(192);
});
