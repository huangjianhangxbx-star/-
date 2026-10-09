import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const dir='../work/NR-01/browser';mkdirSync(dir,{recursive:true});test.setTimeout(600000);
type Point={x:number;y:number};
async function snapshot(page:Page){return page.evaluate(()=>{const s=(window as any).prototype.state;return {world:s.world?.id,visit:s.world?.visit,phase:s.phase,time:s.time,resources:s.economy.carried,settled:s.economy.settled,rewards:s.economy.rewards,seen:s.exploration?.memory.seen,used:s.exploration?.memory.mechanisms,units:s.units.filter((u:any)=>u.id==='hunter'||u.id==='ranger').map((u:any)=>({id:u.id,hp:u.hp,gray:u.grayHp,posture:u.posture,life:u.life,pos:u.pos,weapons:u.weapons.map((w:any)=>({name:w.name,durability:w.durability})),hunter:u.hunterCombat&&{held:u.hunterCombat.held,frost:u.hunterCombat.frost,activeCooldown:u.hunterCombat.activeCooldown,finalRecoveryUntil:u.hunterCombat.finalRecoveryUntil},al:u.alCombat&&{held:u.alCombat.held,shotHeld:u.alCombat.shotHeld,ammo:u.alCombat.ammo,rocketCd:u.alCombat.rocketCd}})),dead:s.units.filter((u:any)=>u.team==='enemy'&&u.life==='dead').map((u:any)=>u.id),kills:s.kills};});}

// Read-only route planning; travel and attacks are actual keyboard/mouse events.
async function route(page:Page,to:Point){return page.evaluate((to)=>{const s=(window as any).prototype.state,h=s.units.find((u:any)=>u.id==='hunter'),key=(p:Point)=>p.x+','+p.y,open=new Set(s.tiles.filter((t:any)=>!t.obstacle).map(key)),start={x:Math.round(h.pos.x),y:Math.round(h.pos.y)},end={x:Math.round(to.x),y:Math.round(to.y)},queue=[start],prev=new Map<string,Point|undefined>([[key(start),undefined]]);for(let i=0;i<queue.length;i++){const p=queue[i];if(key(p)===key(end)){const path:Point[]=[];let q:Point|undefined=p;while(q){path.unshift(q);q=prev.get(key(q));}return path;}for(const d of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]){const n={x:p.x+d.x,y:p.y+d.y};if(open.has(key(n))&&!prev.has(key(n))){prev.set(key(n),p);queue.push(n);}}}return [];},to);}
async function walk(page:Page,to:Point){
 let way=await route(page,to);expect(way.length,'reachable route').toBeGreaterThan(0);let cursor=0;const held=new Set<string>();let stagnant=0,last:Point|undefined;
 const keys=async(next:string[])=>{for(const k of [...held])if(!next.includes(k)){await page.keyboard.up(k);held.delete(k);}for(const k of next)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}};
 for(let n=0;n<2200;n++){
  const data=await page.evaluate(async()=>{const {clearShot}=await import('/src/core/spatial.ts' as string),p=(window as any).prototype,s=p.state,h=s.units.find((u:any)=>u.id==='hunter'),e=s.units.filter((u:any)=>u.team==='enemy'&&u.life==='active'&&clearShot(s,h.pos,u.pos)).sort((a:any,b:any)=>Math.hypot(a.pos.x-h.pos.x,a.pos.y-h.pos.y)-Math.hypot(b.pos.x-h.pos.x,b.pos.y-h.pos.y))[0];return {pos:{...h.pos},life:h.life,hp:h.hp,enemy:e&&{id:e.id,d:Math.hypot(e.pos.x-h.pos.x,e.pos.y-h.pos.y),screen:p.project(e.pos)}};});
  if(n%30===0){console.log('real route',n,data.pos,data.hp,data.enemy?.id,data.enemy?.d);writeFileSync(dir+'/progress.json',JSON.stringify({n,data}));}
  expect(data.life,'hunter remains playable').toBe('active');
  if(data.enemy&&data.enemy.d<3.5){await keys([]);await page.mouse.move(data.enemy.screen.x,data.enemy.screen.y);if(data.enemy.d>1.65){const enemyPos=await page.evaluate(id=>{const e=(window as any).prototype.state.units.find((u:any)=>u.id===id);return {...e.pos};},data.enemy.id);const dx=enemyPos.x-data.pos.x,dy=enemyPos.y-data.pos.y;await keys([...(Math.abs(dx)>.2?[dx>0?'d':'a']:[]),...(Math.abs(dy)>.2?[dy>0?'s':'w']:[])]);}await page.mouse.down();await page.waitForTimeout(200);await page.mouse.up();await keys([]);way=await route(page,to);cursor=0;stagnant=0;continue;}
  while(cursor<way.length&&Math.hypot(way[cursor].x-data.pos.x,way[cursor].y-data.pos.y)<.3)cursor++;
  if(cursor===way.length){await keys([]);return;}
  const goal=way[cursor],dx=goal.x-data.pos.x,dy=goal.y-data.pos.y;
  // Shorten physical key holds near a waypoint: a fixed 110 ms at 2x can
  // overshoot it repeatedly. Keep the same arrival and lifecycle assertions.
  const next:string[]=[];if(Math.abs(dx)>.13)next.push(dx>0?'d':'a');if(Math.abs(dy)>.13)next.push(dy>0?'s':'w');await keys(next);await page.waitForTimeout(Math.min(110,Math.max(16,Math.hypot(dx,dy)*1000/24)));
  if(last&&Math.hypot(last.x-data.pos.x,last.y-data.pos.y)<.015)stagnant++;else stagnant=0;last=data.pos;
  if(stagnant>25){await keys([]);await page.screenshot({path:dir+'/blocked.png'});throw Error('real movement blocked at '+JSON.stringify(data));}
 }
 await keys([]);throw Error('natural route deadline');
}

test('isolated xx preview and playable route remain outside the world lifecycle',async({page})=>{
 await page.goto('/xx-preview.html');await expect.poll(()=>page.evaluate(()=>!!(window as any).xxPreview?.visual.ready),{timeout:30000}).toBe(true);
 await page.goto('/?xx=1');await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('hunter')?.reference?.ready),{timeout:30000}).toBe(true);
 const p=await page.evaluate(()=>{const p=(window as any).prototype,h=p.state.units.find((u:any)=>u.id==='hunter');return p.project({x:h.pos.x+1,y:h.pos.y});});await page.mouse.move(p.x,p.y);await page.mouse.down();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='hunter').xxCombat.trace.filter((r:any)=>r.name==='accepted').length),{timeout:30000}).toBeGreaterThan(3);await page.mouse.up();await page.keyboard.press('z');expect(await page.evaluate(()=>(window as any).prototype.state.controlledBodyId)).toBe('ranger');await page.keyboard.press('z');expect(await page.evaluate(()=>(window as any).prototype.state.world??null)).toBeNull();await page.screenshot({path:dir+'/xx-isolation.png'});
});

for(const [width,height]of [[1440,900],[1280,720]])test(`ordinary world leave, continue, repeat and explicit reset ${width}`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height});await page.goto('/');await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();
 await expect.poll(()=>page.evaluate(()=>['hunter','ranger'].every(id=>(window as any).prototype.scene.unitVisuals.get(id)?.reference?.ready)),{timeout:30000}).toBe(true);
 await expect(page.locator('#world-status')).toContainText('world-1');await expect(page.locator('[data-action=abandon],[data-action=new],#cards,#hand-drawer')).toHaveCount(0);
 await page.locator('#exploration-objective summary').click();await page.locator('[data-exploration-point=campfire-1]').click();await expect(page.locator('[data-exploration-point=campfire-1]')).toBeDisabled();
 await page.keyboard.press('z');await expect(page.locator('#action-strip')).toContainText('四发射击');await page.keyboard.press('z');await page.keyboard.press('f');await page.keyboard.press('Escape');await page.keyboard.down('g');await page.keyboard.press('Escape');await page.keyboard.up('g');
 const started=await snapshot(page),end=await page.evaluate(()=>(window as any).prototype.state.exploration.definition.exit);
 await page.keyboard.press('AltLeft');await walk(page,end);await page.waitForTimeout(1500);
 await expect(page.locator('[data-action=exit-exploration]')).toBeEnabled({timeout:20000});await page.keyboard.press('Space');const before=await snapshot(page);await page.screenshot({path:dir+`/before-exit-${width}.png`});
 if(!await page.locator('#exploration-objective details').evaluate((e:HTMLDetailsElement)=>e.open))await page.locator('#exploration-objective summary').click();await page.locator('[data-action=exit-exploration]').click();await expect(page.locator('[data-action=continue-world]')).toBeVisible();const outside=await snapshot(page);await page.waitForTimeout(350);expect((await snapshot(page)).time).toBe(outside.time);expect(outside.world).toBe(started.world);expect(outside.phase).toBe('world');expect(outside.resources).toEqual(before.resources);expect(outside.settled).toBeNull();expect(outside.units).toEqual(before.units.map(u=>({...u,hunter:u.hunter&&{...u.hunter,held:false},al:u.al&&{...u.al,held:false,shotHeld:false}})));
 await page.screenshot({path:dir+`/outside-${width}.png`});await page.locator('[data-action=continue-world]').click();await page.keyboard.press('Space');const back=await snapshot(page);
 expect(back.world).toBe(started.world);expect(back.visit.generation).toBe(2);expect(back.resources).toEqual(before.resources);expect(back.rewards).toEqual(before.rewards);expect(back.dead).toEqual(before.dead);expect(back.seen.length).toBeGreaterThanOrEqual(before.seen.length);expect(back.used).toEqual(before.used);expect(back.units.map(u=>u.weapons)).toEqual(before.units.map(u=>u.weapons));
 for(let i=0;i<back.units.length;i++)expect(Math.abs(back.units[i].hp-before.units[i].hp)).toBeLessThan(.25);
 if(!await page.locator('#exploration-objective details').evaluate((e:HTMLDetailsElement)=>e.open))await page.locator('#exploration-objective summary').click();await expect(page.locator('[data-exploration-point=campfire-1]')).toBeDisabled();await page.screenshot({path:dir+`/continued-${width}.png`});
 await page.locator('[data-action=restart-world]').click();await expect(page.locator('#economy-confirm')).toContainText('这不是继续');await page.locator('[data-action=cancel-economic]').click();expect((await snapshot(page)).world).toBe(started.world);
 await page.locator('[data-action=restart-world]').click();await page.locator('[data-action=confirm-economic]').click();await expect(page.locator('[data-action=carry]')).toBeVisible();await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();expect((await snapshot(page)).world).toBe('world-2');await page.locator('#exploration-objective summary').click();await expect(page.locator('[data-exploration-point=campfire-1]')).toBeEnabled();
 writeFileSync(dir+`/lifecycle-${width}.json`,JSON.stringify({input:'real mouse/keyboard only; state reads only',started,before,outside,back,errors},null,2));expect(errors).toEqual([]);
});
