import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const evidence='../work/NPC-HOME-02/evidence';
async function start(page:Page){
  await page.goto('/?scene2d=1&enemyPressure=baseline');
  await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();
  await page.getByRole('button',{name:'开始游戏',exact:true}).waitFor({state:'hidden',timeout:25000});
  await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.mapDebug.place)).toBe(101);
}
async function shot(page:Page,name:string){mkdirSync(evidence,{recursive:true});await page.screenshot({path:evidence+'/'+name+'.png'});}
async function pathTo(page:Page,target:{x:number;y:number}){
  const route=await page.evaluate(async target=>{const p=(window as any).prototype,s=p.state,u=s.units.find((u:any)=>u.id===s.controlledBodyId),m=await import('/src/core/navigation.ts');return m.navigate(s,u.pos,target);},target);
  expect(route.length).toBeGreaterThan(0);
  for(const step of route){
    const point=await page.evaluate(p=>(window as any).prototype.project(p),step);
    await page.keyboard.press('b');await page.mouse.move(point.x,point.y);await page.mouse.click(point.x,point.y);
    await expect.poll(()=>page.evaluate(p=>{const s=(window as any).prototype.state,u=s.units.find((u:any)=>u.id===s.controlledBodyId);return Math.hypot(u.pos.x-p.x,u.pos.y-p.y);},step),{timeout:18000}).toBeLessThan(.27);
  }
}
async function moveMap(page:Page,key:string,place:number){
  await page.keyboard.down(key);try{await expect.poll(()=>page.evaluate(()=>(window as any).prototype.mapDebug.place),{timeout:20000}).toBe(place);}finally{await page.keyboard.up(key);}
  await expect.poll(()=>page.evaluate(()=>(window as any).prototype.travel.busy)).toBe(false);
}

async function sample(page:Page,name:string){const value=await page.evaluate(()=>{const p=(window as any).prototype,r=p.state.units.find((u:any)=>u.id==='ranger');return {home:p.home,pos:r.pos,place:p.mapDebug.place};});writeFileSync(evidence+'/'+name+'.json',JSON.stringify({fixture:name.startsWith('F10-')?'prototype-phase':false,...value},null,2));await shot(page,name);return value;}
async function videoStory(browser:any,name:string,body:(page:Page)=>Promise<void>){
 mkdirSync(evidence,{recursive:true});const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidence,size:{width:1440,height:900}}}),page=await context.newPage();
 try{await start(page);await body(page);}catch(error){await sample(page,name+'-failure');throw error;}finally{await context.close();await page.video()?.saveAs(evidence+'/'+name+'.webm');}
}
test('A natural kitchen preparation then dining completes one committed goal',async({browser})=>{
 test.setTimeout(180000);await videoStory(browser,'story-A',async page=>{
  await expect.poll(()=>page.evaluate(()=>(window as any).prototype.home.activity?.goalId)).toBe('prepare-meal');
  await expect.poll(()=>page.evaluate(()=>{const a=(window as any).prototype.home.activity;return a.stepIndex===1&&a.phase==='dwelling';}),{timeout:30000}).toBe(true);await sample(page,'A-prepare');
  await expect.poll(()=>page.evaluate(()=>{const a=(window as any).prototype.home.activity;return a.goalId==='prepare-meal'&&a.stepIndex===3&&a.phase==='dwelling';}),{timeout:70000}).toBe(true);await sample(page,'A-dine');
  await expect.poll(()=>page.evaluate(()=>(window as any).prototype.home.activity.history.some((e:any)=>e.kind==='completed'&&e.task==='prepare-meal')),{timeout:20000}).toBe(true);
  const end=await sample(page,'A-completed');expect(end.home.activity.history.filter((e:any)=>e.kind==='arrived'&&e.task==='prepare-meal').map((e:any)=>e.anchor)).toEqual(['prepare','dine']);
 });
});
test('B natural reading second station is interrupted by dialogue and resumes the same step',async({browser})=>{
 test.setTimeout(180000);await videoStory(browser,'story-B',async page=>{
  await pathTo(page,{x:14.9,y:5.3});
  await expect.poll(()=>page.evaluate(()=>{const a=(window as any).prototype.home.activity;return a.goalId==='quiet-reading'&&a.stepIndex===2&&a.phase==='moving';}),{timeout:70000}).toBe(true);
  await page.keyboard.press('f');await expect(page.locator('[data-role-menu]')).toBeVisible();
  const paused=await sample(page,'B-menu-stopped');expect(paused.home.activity.stepIndex).toBe(2);
  await page.locator('[data-role-action=dialogue]').click();await expect(page.locator('[data-dialogue]')).toBeVisible();
  const time=await page.evaluate(()=>(window as any).prototype.state.time);await page.waitForTimeout(1200);
  const during=await sample(page,'B-dialogue');expect(during.pos).toEqual(paused.pos);expect(during.home.activity.stepIndex).toBe(2);expect(during.home.activity.remaining).toBe(paused.home.activity.remaining);expect(await page.evaluate(()=>(window as any).prototype.state.time)).toBeGreaterThan(time);
  for(let i=0;i<12&&await page.locator('[data-dialogue]').isVisible();i++)await page.keyboard.press('f');await expect(page.locator('[data-dialogue]')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>{const a=(window as any).prototype.home.activity;return a.goalId==='quiet-reading'&&a.stepIndex===3&&a.phase==='dwelling';}),{timeout:25000}).toBe(true);
  const end=await sample(page,'B-resumed-rest');expect(end.home.activity.history.filter((e:any)=>e.kind==='arrived'&&e.task==='quiet-reading').map((e:any)=>e.anchor)).toEqual(['read','rest']);
 });
});
test('C natural garden route is cancelled by joining, then the same body fights outside',async({browser})=>{
 test.setTimeout(300000);await videoStory(browser,'story-C',async page=>{
  await page.evaluate(()=>{const p=(window as any).prototype;(window as any).homeGoalResident=p.state.units.find((u:any)=>u.id==='ranger');});
  await pathTo(page,{x:6.3,y:6.5});
  await expect.poll(()=>page.evaluate(()=>{const p=(window as any).prototype,a=p.home.activity,r=p.state.units.find((u:any)=>u.id==='ranger');return a.goalId==='garden-care'&&r.pos.x<4.5;}),{timeout:180000}).toBe(true);await sample(page,'C-outside-rear-door');
  await page.locator('[data-home-party]').click();await expect(page.locator('[data-home-party]')).toHaveText('已组队');const joined=await sample(page,'C-joined');expect(joined.home.activity.phase).toBe('cancelled');
  await pathTo(page,{x:16,y:7.5});await moveMap(page,'d',102);
  await page.keyboard.down('d');try{await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').pos.x),{timeout:20000}).toBeGreaterThan(7);}finally{await page.keyboard.up('d');}
  await expect.poll(()=>page.evaluate(()=>{const p=(window as any).prototype,r=p.state.units.find((u:any)=>u.id==='ranger');return !!r.companionCombat?.actualBasicTargetId&&p.state.units.some((u:any)=>u.team==='enemy'&&u.hp<u.maxHp);}),{timeout:60000}).toBe(true);
  const end=await sample(page,'C-field-combat');expect(end.home.activity.phase).toBe('cancelled');expect(end.home.activity.clock).toBe(joined.home.activity.clock);expect(await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ranger')===(window as any).homeGoalResident)).toBe(true);
 });
});
test('F10 prototype phase changes scores without preempting the committed goal',async({page})=>{
 await start(page);await expect.poll(()=>page.evaluate(()=>(window as any).prototype.home.activity.goalId)).toBe('prepare-meal');
 await page.keyboard.press('F10');await page.locator('[data-home-phase]').selectOption('night');await expect(page.locator('[data-home-diagnostic]')).toContainText('prototype-phase');
 expect(await page.evaluate(()=>(window as any).prototype.home.activity.goalId)).toBe('prepare-meal');expect(await page.evaluate(()=>(window as any).prototype.home.activity.scores[0].id)).toBe('quiet-reading');await sample(page,'F10-prototype-night');
});
