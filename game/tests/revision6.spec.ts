import {prepareRegression} from './browser-helpers';
import {test,expect} from '@playwright/test';
async function start(page:any){await page.goto('/');await prepareRegression(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();await page.evaluate(()=>{const s=(window as any).prototype.state;s.units.forEach((u:any)=>u.ready=0);s.waveState.anchor+=1000;});}
test('all supplied ally skeletons load and render',async({page})=>{
 await page.goto('/');await prepareRegression(page);
 const results=await page.evaluate(async()=>{const {SpineVisual}=await import('/src/view/spine.ts' as string);const rows=[];for(const name of ['Galore','Livia','Arina','Cynthia']){try{const v=await SpineVisual.load(name);v.update(.1,'move',-1);const pixels=v.canvas.getContext('2d').getImageData(0,0,512,512).data;rows.push({name,ok:pixels.some((n:number,i:number)=>i%4===3&&n>50)});v.dispose();}catch(e){rows.push({name,ok:false,error:String(e)})}}return rows;});
 expect(results).toEqual(['Galore','Livia','Arina','Cynthia'].map(name=>({name,ok:true})));
});
test('direct roster drag deploys without a preceding click',async({page})=>{
 await start(page);const b=await page.locator('[data-unit="fiorre"]').boundingBox();const p=await page.evaluate(()=>(window as any).prototype.project({x:4,y:4}));
 await page.mouse.move(b!.x+30,b!.y+30);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:12});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='fiorre').life)).toBe('active');
 const pos=await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='fiorre').pos);expect(pos.x).toBeCloseTo(4,1);expect(pos.y).toBeCloseTo(4,1);
});
test('dash chooses a sector and confirms outside the arrow button',async({page})=>{
 await start(page);const id=await page.evaluate(()=>(window as any).prototype.state.cards.find((c:any)=>c.kind==='dash').id);await page.locator(`[data-card="${id}"]`).click();const p=await page.evaluate(()=>(window as any).prototype.project({x:2,y:4}));await page.mouse.click(p.x,p.y);await expect(page.locator('#dash-directions')).toBeVisible();await expect(page.locator('#card-chain')).toHaveCSS('display','none');await page.mouse.move(p.x+150,p.y);await page.mouse.click(p.x+150,p.y);
 await expect.poll(()=>page.evaluate(id=>(window as any).prototype.state.cards.some((c:any)=>c.id===id),id)).toBe(false);
 await page.waitForFunction(()=>!!document.querySelector('.card-ghost'));
 expect(await page.locator('#cards').evaluate(e=>e.getAnimations({subtree:true}).some(a=>a.id==='hand-layout'))).toBe(true);
 await expect(page.locator('.card-ghost')).toHaveCount(0,{timeout:2000});
});
test('right click cancels an avatar drag without deploying on release',async({page})=>{
 await start(page);const b=await page.locator('[data-unit="fiorre"]').boundingBox();const p=await page.evaluate(()=>(window as any).prototype.project({x:3,y:4}));
 await page.mouse.move(b!.x+30,b!.y+30);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:8});await page.mouse.click(p.x,p.y,{button:'right'});await page.mouse.up();
 await expect(page.locator('#time-mode')).toHaveText('');expect(await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='fiorre').life)).toBe('reserve');
});
test('reduced motion keeps drawing immediate without card flight',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await start(page);await page.locator('[data-action="draw"]').click();await expect(page.locator('#fragments')).toHaveText('30');
 expect(await page.locator('#cards').evaluate(e=>e.getAnimations({subtree:true}).length)).toBe(0);await expect(page.locator('.card-ghost')).toHaveCount(0);
});
test('draw preserves retained card nodes and animates the new hand',async({page})=>{
 await start(page);await page.evaluate(()=>{(window as any).__retained=document.querySelector('.tactic-card.scene');});await page.locator('[data-action="draw"]').click();
 expect(await page.evaluate(()=>(window as any).__retained===document.querySelector('.tactic-card.scene'))).toBe(true);
 await page.waitForFunction(()=>document.querySelector('#cards')!.getAnimations({subtree:true}).length>0);
 expect(await page.evaluate(()=>(window as any).__retained===document.querySelector('.tactic-card.scene'))).toBe(true);
});
test('immovable originals and clones never preview a movement arrow',async({page})=>{
 await start(page);
 await page.evaluate(()=>{const s=(window as any).prototype.state;const u=s.units.find((u:any)=>u.id==='fiorre');u.life='downed';u.downTimer=40;u.pos={x:3,y:4};u.drawPos={...u.pos};});
 const p=await page.evaluate(()=>(window as any).prototype.project({x:3,y:4}));await page.mouse.click(p.x,p.y);await page.mouse.move(p.x+80,p.y+20);await expect(page.locator('#move-route')).toHaveCSS('display','none');
 await page.mouse.click(p.x,p.y,{button:'right'});
 const b=await page.locator('[data-clone="hunter"]').boundingBox();const q=await page.evaluate(()=>(window as any).prototype.project({x:3,y:3}));await page.mouse.move(b!.x+30,b!.y+b!.height/2);await page.mouse.down();await page.mouse.move(q.x,q.y,{steps:10});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.filter((u:any)=>u.cloneOf).length)).toBe(1);
 await page.mouse.click(q.x,q.y);await page.mouse.move(q.x+90,q.y+20);await expect(page.locator('#move-route')).toHaveCSS('display','none');
});
test('prepared actors use real skeletons immediately and hide immovable direction markers',async({page})=>{
 await start(page);
 const result=await page.evaluate(async()=>{
  const {BattleScene}=await import('/src/view/scene.ts' as string),{createGame}=await import('/src/core/engine.ts' as string);
  const host=document.createElement('div');Object.assign(host.style,{position:'fixed',inset:'0'});document.body.append(host);
  const scene=new BattleScene(host),s=createGame();s.units.forEach((u:any)=>u.life='active');s.units[1].life='downed';s.units[2].cloneOf='original';
  scene.update(s,{selectedId:null,hover:null,path:[],range:[],deployTiles:[],targeting:false},.01);
  const result=[...scene.unitVisuals.values()].map((a:any)=>({id:a.unit.id,real:!!a.spine&&a.sprite.visible,arrow:a.arrow.visible}));scene.dispose();host.remove();return result;
 });
 expect(result).toEqual([{id:'hunter',real:true,arrow:true},{id:'fiorre',real:true,arrow:false},{id:'ines',real:true,arrow:false},{id:'ranger',real:true,arrow:true}]);
});
