import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const evidence='../work/HOME-02-FIX01/evidence';
async function start(page:Page){
  await page.goto('/?scene2d=1&enemyPressure=baseline');
  await page.getByRole('button',{name:'点击屏幕开始'}).click();
  await page.getByRole('button',{name:'开始游戏',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.mapDebug?.place),{timeout:25000}).toBe(101);
  await expect.poll(()=>page.evaluate(()=>(window as any).prototype.effectiveTimeScale)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'开始游戏',exact:true}).waitFor({state:'hidden'});
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
async function moveToMap(page:Page,key:string,place:number){
  await page.keyboard.down(key);try{await expect.poll(()=>page.evaluate(()=>(window as any).prototype.mapDebug.place),{timeout:18000}).toBe(place);}finally{await page.keyboard.up(key);}
  await expect.poll(()=>page.evaluate(()=>(window as any).prototype.travel.busy),{timeout:18000}).toBe(false);
}

test('saved home profile survives reentry and does not leak to the field',async({page})=>{
  test.setTimeout(90000);await start(page);
  const home=await page.evaluate(()=>{const p=(window as any).prototype;return {mode:p.scene.look.mode,zoom:p.scene.look.zoom,lamps:structuredClone(p.scene.look.lamps),rootCount:p.scene.scene.children.filter((o:any)=>o.name==='').length};});
  expect(home.mode).toBe('DungeonLight');expect(home.zoom).toBe(1.3);await shot(page,'normal-default-R1');
  await page.evaluate(async()=>{const p=(window as any).prototype,m=await import('/src/core/map-definitions.ts');await p.travel.request(m.MAP_EDGES[0]);});
  expect(await page.evaluate(()=>(window as any).prototype.scene.look.mode)).toBe('Source');
  expect(await page.evaluate(()=>{let n=0;(window as any).prototype.scene.scene.traverseVisible((o:any)=>{if(o.name.startsWith('home-furniture:'))n++;});return n;})).toBe(0);await shot(page,'field-default');
  await page.evaluate(async()=>{const p=(window as any).prototype,m=await import('/src/core/map-definitions.ts');await p.travel.request(m.MAP_EDGES[1]);});
  expect(await page.evaluate(()=>{const l=(window as any).prototype.scene.look;return {mode:l.mode,zoom:l.zoom,lamps:l.lamps};})).toEqual({mode:home.mode,zoom:home.zoom,lamps:home.lamps});
  await page.reload();await page.getByRole('button',{name:'点击屏幕开始'}).click();await page.getByRole('button',{name:'开始游戏',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.scene?.look.mode),{timeout:25000}).toBe('DungeonLight');await page.getByRole('button',{name:'开始游戏',exact:true}).waitFor({state:'hidden'});await page.waitForTimeout(200);await shot(page,'default-after-reload');
});

test('natural rear-door walk, dialogue, party and front-door round trip retain identities',async({browser})=>{
  test.setTimeout(180000);mkdirSync(evidence,{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidence,size:{width:1440,height:900}}});const page=await context.newPage();
  try{
    await start(page);await shot(page,'natural-start');
    await page.evaluate(()=>{const p=(window as any).prototype;(window as any).homeFixOriginal={world:p.state.world,resident:p.state.units.find((u:any)=>u.id==='ranger'),bag:p.state.world.backpack,visit:p.state.world.visit.generation};});
    const musicBefore=await page.evaluate(async()=>(await import('/src/game-audio/index.ts')).gameAudio().inspect().music);
    await pathTo(page,{x:6.3,y:6.5});
    await page.keyboard.down('a');try{await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').pos.x),{timeout:15000}).toBeLessThan(4.3);}finally{await page.keyboard.up('a');}
    expect(await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').pos.x)).toBeLessThan(4.5);
    expect(await page.evaluate(()=>{const p=(window as any).prototype,o=(window as any).homeFixOriginal;return p.state.world===o.world&&p.state.world.backpack===o.bag&&p.state.world.visit.generation===o.visit&&!p.travel.busy&&p.state.units.find((u:any)=>u.id==='ranger')===o.resident;})).toBe(true);
    await shot(page,'rear-garden');await pathTo(page,{x:4,y:8});await pathTo(page,{x:4,y:6.5});
    await page.keyboard.down('d');try{await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').pos.x),{timeout:15000}).toBeGreaterThan(5.9);}finally{await page.keyboard.up('d');}
    expect(await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').pos.x)).toBeGreaterThan(5.8);
    const musicAfterGarden=await page.evaluate(async()=>(await import('/src/game-audio/index.ts')).gameAudio().inspect().music);
    expect(musicAfterGarden.transportId).toBe(musicBefore.transportId);expect(musicAfterGarden.startCount).toBe(musicBefore.startCount);
    await pathTo(page,{x:14.9,y:5.3});await page.keyboard.press('f');await expect(page.locator('[data-role-menu]')).toBeVisible();
    await page.locator('[data-role-action=dialogue]').click();await expect(page.locator('[data-dialogue]')).toBeVisible();await shot(page,'resident-dialogue');
    for(let i=0;i<10&&await page.locator('[data-dialogue]').isVisible();i++)await page.keyboard.press('f');await expect(page.locator('[data-dialogue]')).toBeHidden();
    await page.locator('[data-home-party]').click();await expect(page.locator('[data-home-party]')).toHaveText('已组队');
    await pathTo(page,{x:6.3,y:6.5});await pathTo(page,{x:4,y:6.5});await page.waitForTimeout(800);
    await page.keyboard.press('z');expect(await page.evaluate(()=>(window as any).prototype.state.controlledBodyId)).toBe('ranger');
    await pathTo(page,{x:4,y:8});await pathTo(page,{x:4,y:6.5});await page.keyboard.down('d');try{await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ranger').pos.x),{timeout:15000}).toBeGreaterThan(5.9);}finally{await page.keyboard.up('d');}
    expect(await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ranger').pos.x)).toBeGreaterThan(5.8);await shot(page,'both-through-rear');
    await pathTo(page,{x:16,y:7.5});await moveToMap(page,'d',102);await moveToMap(page,'a',101);
    expect(await page.evaluate(()=>{const p=(window as any).prototype,o=(window as any).homeFixOriginal;return p.state.world===o.world&&p.state.world.backpack===o.bag&&p.state.units.filter((u:any)=>u.id==='ranger').length===1&&p.state.units.find((u:any)=>u.id==='ranger')===o.resident&&p.state.world.visit.generation===o.visit+2;})).toBe(true);
    await shot(page,'natural-return');writeFileSync(evidence+'/natural-story.json',JSON.stringify({musicBefore,musicAfterGarden,result:'same world, resident, bag; rear-door same visit; front-door +2 visits'},null,2));
  }finally{await context.close();await page.video()?.saveAs(evidence+'/natural-route.webm');}
});


test('required new prop and local wall failures keep the active home intact',async({page})=>{
  test.setTimeout(90000);await start(page);
  const before=await page.evaluate(()=>{const p=(window as any).prototype;(window as any).keptHome={world:p.state.world,bag:p.state.world.backpack,units:[...p.state.units],root:p.scene.maps.get(101).root};return p.scene.metrics.textures;});
  for(const [url,label,revision] of [['**/assets/home02-fix01/rug.png?v=fail-new','rug.png','fail-new'],['**/__scene2d-assets/home-wall/manifest.json','清单加载失败','fail-wall']]){
    await page.route(url,r=>r.abort());
    const error=await page.evaluate(async revision=>{const p=(window as any).prototype,d=structuredClone(p.state.exploration.definition);d.sceneLayout.revision=revision;try{await p.scene.prepareMap(d,p.state.units);return '';}catch(e){return String(e);}},revision);
    expect(error).toContain(label);expect(await page.evaluate(()=>{const p=(window as any).prototype,k=(window as any).keptHome;return p.state.world===k.world&&p.state.world.backpack===k.bag&&k.units.every((u:any)=>p.state.units.includes(u))&&p.scene.scene.children.includes(k.root);})).toBe(true);
    expect(await page.evaluate(()=>(window as any).prototype.scene.metrics.textures)).toBe(before);await page.unroute(url);
  }
});


test('marked home pursuer fixture moves around furniture and retains a live HP bar',async({page})=>{
  test.setTimeout(90000);await start(page);await page.locator('[data-home-party]').click();
  await page.evaluate(async()=>{const p=(window as any).prototype,m=await import('/src/core/map-definitions.ts');await p.travel.request(m.MAP_EDGES[0]);(window as any).homeEnemy=p.state.units.find((u:any)=>u.team==='enemy');await p.travel.request(m.MAP_EDGES[1]);const s=p.state,h=s.units.find((u:any)=>u.id==='hunter'),r=s.units.find((u:any)=>u.id==='ranger'),e=(window as any).homeEnemy;e.mapOwnerInstance=s.world.id+':101';s.units.push(e);h.pos={x:13,y:6};r.pos={x:13,y:7.5};e.pos={x:6.3,y:6};for(const u of [h,r,e]){u.drawPos={...u.pos};u.path=[];u.destination=null;u.hp=u.maxHp;}e.hp=e.maxHp=2000;e.enemyV2.brain.known={...h.pos};e.pursuitTargetId='hunter';s.context='explorationBattle';await p.scene.prepareUnit(e);});
  await expect.poll(()=>page.evaluate(()=>{const p=(window as any).prototype,e=(window as any).homeEnemy,r=p.state.units.find((u:any)=>u.id==='ranger');return e.hp<2000&&e.pos.x>7.8&&e.pos.y>7.3&&r.pos.x<11.2&&r.pos.y>7.3&&p.mapDebug.hpBars>0;}),{timeout:60000}).toBe(true);
  const sample=await page.evaluate(()=>{const p=(window as any).prototype,e=(window as any).homeEnemy;return {fixture:true,enemy:{id:e.id,hp:e.hp,maxHp:e.maxHp,pos:e.pos},companion:p.state.units.find((u:any)=>u.id==='ranger').pos,hpBars:p.mapDebug.hpBars};});writeFileSync(evidence+'/home-combat-fixture.json',JSON.stringify(sample,null,2));await shot(page,'home-combat-fixture');
});
