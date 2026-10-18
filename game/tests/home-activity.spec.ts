import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const evidence='../work/NPC-HOME-01/evidence';
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

test('natural resident activity, rear door, dialogue resume, join and existing field combat',async({browser})=>{
  test.setTimeout(240000);mkdirSync(evidence,{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidence,size:{width:1440,height:900}}}),page=await context.newPage();
  try{
    await start(page);
    await page.evaluate(()=>{const p=(window as any).prototype,s=p.state,r=s.units.find((u:any)=>u.id==='ranger');(window as any).npcOriginal={resident:r,weapon:r.equipment.equipped.right,world:s.world,bag:s.world.backpack,visit:s.world.visit.generation};(window as any).npcSamples=[];});
    await shot(page,'start-natural');await pathTo(page,{x:6.3,y:6.5});
    await expect.poll(()=>page.evaluate(()=>{const a=(window as any).prototype.home.activity;return new Set(a?.history.filter((e:any)=>e.kind==='arrived').map((e:any)=>e.task)).size;}),{timeout:70000}).toBeGreaterThanOrEqual(2);
    await expect.poll(()=>page.evaluate(()=>{const s=(window as any).prototype.state,a=s.world.homeResident.activity,r=s.units.find((u:any)=>u.id==='ranger');return a.taskId==='garden-inspect'&&a.phase==='moving'&&r.pos.x<7.4&&r.pos.x>5.6;}),{timeout:60000}).toBe(true);
    await shot(page,'walking-to-garden');await page.keyboard.press('f');await expect(page.locator('[data-role-menu]')).toBeVisible();
    expect(await page.evaluate(()=>(window as any).prototype.home.activity.phase)).toBe('interrupted');
    const paused=await page.evaluate(()=>{const s=(window as any).prototype.state,a=s.world.homeResident.activity,r=s.units.find((u:any)=>u.id==='ranger');return {pos:{...r.pos},task:a.taskId,remaining:a.remaining,time:s.time};});
    await page.locator('[data-role-action=dialogue]').click();await expect(page.locator('[data-dialogue]')).toBeVisible();await shot(page,'moving-dialogue-stopped');await page.waitForTimeout(1200);
    expect(await page.evaluate(()=>{const r=(window as any).prototype.state.units.find((u:any)=>u.id==='ranger');return r.pos;})).toEqual(paused.pos);
    expect(await page.evaluate(()=>(window as any).prototype.state.time)).toBeGreaterThan(paused.time);
    expect(await page.evaluate(()=>(window as any).prototype.home.activity.remaining)).toBe(paused.remaining);
    for(let i=0;i<12&&await page.locator('[data-dialogue]').isVisible();i++)await page.keyboard.press('f');await expect(page.locator('[data-dialogue]')).toBeHidden();
    await expect.poll(()=>page.evaluate(()=>(window as any).prototype.home.activity.phase)).toBe('moving');
    await expect.poll(()=>page.evaluate(()=>{const p=(window as any).prototype,a=p.home.activity,r=p.state.units.find((u:any)=>u.id==='ranger');return a.taskId==='garden-inspect'&&a.phase==='dwelling'&&r.pos.x<4.5;}),{timeout:25000}).toBe(true);
    await shot(page,'arrived-outside-garden');await page.keyboard.press('F10');await expect(page.locator('[data-home-diagnostic]')).toContainText('garden-inspect');await expect(page.locator('[data-home-diagnostic]')).toContainText('stand-placeholder');await shot(page,'F10-activity');await page.keyboard.press('F10');
    const beforeJoin=await page.evaluate(()=>{const p=(window as any).prototype,o=(window as any).npcOriginal,r=p.state.units.find((u:any)=>u.id==='ranger');return {activity:p.home.activity,original:r===o.resident&&r.equipment.equipped.right===o.weapon&&p.state.world===o.world&&p.state.world.backpack===o.bag&&p.state.world.visit.generation===o.visit};});expect(beforeJoin.original).toBe(true);
    await page.locator('[data-home-party]').click();await expect(page.locator('[data-home-party]')).toHaveText('已组队');expect(await page.evaluate(()=>(window as any).prototype.home.activity.phase)).toBe('cancelled');
    await pathTo(page,{x:16,y:7.5});await moveMap(page,'d',102);
    await page.keyboard.down('d');try{await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').pos.x),{timeout:20000}).toBeGreaterThan(7);}finally{await page.keyboard.up('d');}
    await expect.poll(()=>page.evaluate(()=>{const p=(window as any).prototype,r=p.state.units.find((u:any)=>u.id==='ranger');return !!r.companionCombat?.actualBasicTargetId&&p.state.units.some((u:any)=>u.team==='enemy'&&u.hp<u.maxHp);}),{timeout:60000}).toBe(true);
    await shot(page,'party-field-combat');const after=await page.evaluate(()=>{const p=(window as any).prototype,o=(window as any).npcOriginal,r=p.state.units.find((u:any)=>u.id==='ranger');return {sameResident:r===o.resident,activity:p.home.activity,place:p.mapDebug.place,companion:r.companionCombat};});expect(after.sameResident).toBe(true);expect(after.activity.phase).toBe('cancelled');
    writeFileSync(evidence+'/natural-story.json',JSON.stringify({fixture:false,paused,beforeJoin,after},null,2));
  }finally{await context.close();await page.video()?.saveAs(evidence+'/natural-story.webm');}
});

test('F10 exposes a bounded read-only activity summary without normal HUD AI fields',async({page})=>{
  await start(page);await expect.poll(()=>page.evaluate(()=>(window as any).prototype.home.activity?.taskId)).toBe('read');
  await page.keyboard.press('F10');const panel=page.locator('[data-home-diagnostic]');
  await expect(panel).toContainText('home-activity');await expect(panel).toContainText('anchorId');await expect(panel).toContainText('stand-placeholder');
  const bounds=await panel.boundingBox();expect(bounds!.height).toBeLessThan(450);await shot(page,'F10-final-summary');await page.keyboard.press('F10');await expect(panel).toHaveCount(0);
});
