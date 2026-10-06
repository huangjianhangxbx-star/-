import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const folder='../记录/验证/T-023';
async function begin(page:Page,companion='ranger'){
 await page.goto('/');await page.locator('[data-journey="exploration"]').click();await page.locator('[data-companion="'+companion+'"]').click();await page.locator('[data-action="carry"]').click();await page.locator('[data-action="pause"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.terrain.userData.loaded),{timeout:45000}).toBe(true);
 await page.evaluate(()=>{const s=(window as any).prototype.state;for(const u of s.units)if(u.team==='enemy')u.life='dead';});
}
test('real hunter attack, C handoff and Arl skill button produce push then wall pin',async({page})=>{
 test.setTimeout(90000);await begin(page);mkdirSync(folder,{recursive:true});
 await page.evaluate(async()=>{const s=(window as any).prototype.state,h=s.units[0],a=s.units.find((u:any)=>u.id==='ranger'),e=s.units.find((u:any)=>u.team==='enemy');const {surface}=await import('/src/core/spatial.ts' as string);
  const spot=s.tiles.filter((t:any)=>!t.obstacle&&t.layer===0&&surface(s,{x:t.x+1,y:t.y})?.obstacle&&[1,2].every(n=>{const q=surface(s,{x:t.x-n,y:t.y});return q&&!q.obstacle&&q.layer===0;})).sort((l:any,r:any)=>Math.hypot(l.x-h.pos.x,l.y-h.pos.y)-Math.hypot(r.x-h.pos.x,r.y-h.pos.y))[0];
  if(!spot)throw Error('No real dungeon wall fixture');const x=spot.x-.8,y=spot.y;h.pos={x,y};h.drawPos={...h.pos};
  h.weapons[h.weaponIndex].postureDamage=15;e.life='active';e.role='melee';e.pos={x:x+.8,y};e.drawPos={...e.pos};e.hp=e.maxHp=10000;e.posture=15;e.postureDelay=100;e.ready=0;e.path=[];e.attackTimer=100;e.stagger=0;e.statuses=[];e.enemySense.home={...e.pos};e.enemySense.patrol=[];e.enemyMotion='engaged';e.pursuitTargetId=h.id;
  a.pos={x:x-.4,y};a.drawPos={...a.pos};a.ai={...a.ai,commandUntil:s.time+100,moving:false,task:undefined};a.skillId='snipe';a.ready=0;a.attackTimer=100;h.ready=0;h.attackTimer=0;h.heading=0;h.facing='east';h.dodge=a.dodge=e.dodge=0;h.weapons[h.weaponIndex].weight=0;a.weapons[a.weaponIndex].weight=0;
 });
 await page.evaluate(async()=>{const {step}=await import('/src/core/engine.ts' as string);step((window as any).prototype.state,.3);});
 expect(await page.evaluate(()=>{const e=(window as any).prototype.state.units.find((u:any)=>u.team==='enemy'&&u.life==='active');return {posture:e.posture,stagger:e.stagger,motion:!!e.forcedMotion};})).toEqual({posture:0,stagger:0,motion:false});
 await page.keyboard.press('c');expect(await page.evaluate(()=>(window as any).prototype.state.controlledBodyId)).toBe('ranger');
 await page.locator('[data-world-skill]').click();
 expect(await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ranger').skillStates.snipe.enabled)).toBe(true);
 await page.evaluate(async()=>{const s=(window as any).prototype.state,a=s.units.find((u:any)=>u.id==='ranger');a.attackTimer=0;s.units[0].attackTimer=100;const {step}=await import('/src/core/engine.ts' as string);step(s,.3);});
 await page.evaluate(async()=>{const {step}=await import('/src/core/engine.ts' as string);step((window as any).prototype.state,.22);});
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.stats.wallPin||0)).toBe(1);
 await expect.poll(()=>page.evaluate(()=>{const p=(window as any).prototype,e=p.state.units.find((u:any)=>u.team==='enemy'&&u.life==='active');return p.scene.unitVisuals.get(e.id)?.lastBar?.includes('钉墙');})).toBe(true);
 const proof=await page.evaluate(()=>{const p=(window as any).prototype,s=p.state,e=s.units.find((u:any)=>u.team==='enemy'&&u.life==='active');return {controlled:s.controlledBodyId,posture:e.posture,stagger:e.stagger,wallPin:e.wallPin,position:e.pos,stats:s.stats,bar:p.scene.unitVisuals.get(e.id)?.lastBar};});
 expect(proof.wallPin).toBeDefined();expect(proof.stagger).toBeGreaterThan(.6);expect(proof.bar).toContain('钉墙');
 await page.screenshot({path:folder+'/dual-snipe-wall-pin.png'});writeFileSync(folder+'/dual-snipe.json',JSON.stringify(proof,null,2));
});
for(const phase of ['tracking','locked'])test('browser '+phase+' persists Broken and disappears at Break',async({page})=>{
 await begin(page);const result=await page.evaluate(async phase=>{const p=(window as any).prototype,s=p.state,h=s.units[0],e=s.units.find((u:any)=>u.team==='enemy');e.life='active';e.role='heavy';e.pos={x:h.pos.x-.8,y:h.pos.y};e.drawPos={...e.pos};e.path=[];e.stagger=0;e.statuses=[];e.posture=90;e.pursuitTargetId=h.id;e.enemyMotion='engaged';e.dodge=0;h.weapons[h.weaponIndex].weight=0;const {startIntent}=await import('/src/core/attack-intent.ts' as string);const {resolveHit}=await import('/src/core/engine.ts' as string);startIntent(s,e,h);e.attackIntent.phase=phase;resolveHit(s,e,h.weapons[h.weaponIndex],0,h,{postureDamage:999});const broken=e.attackIntent.phase;resolveHit(s,e,h.weapons[h.weaponIndex],0,h,{postureDamage:1,kind:'basic'});return {broken,after:!!e.attackIntent,breaks:s.stats.break,cancel:s.stats.telegraphsCancelled};},phase);
 expect(result).toEqual({broken:phase,after:false,breaks:1,cancel:1});await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.telegraphs.group.children.length)).toBe(0);
});
test('one real heavy intent pushes hunter farther than Ines and control recovers',async({page})=>{
 await begin(page,'ines');const result=await page.evaluate(async()=>{const s=(window as any).prototype.state,h=s.units[0],a=s.units.find((u:any)=>u.id==='ines'),e=s.units.find((u:any)=>u.team==='enemy'),x=h.pos.x,y=h.pos.y;
  for(const t of s.tiles)if(Math.abs(t.x-x)<4&&Math.abs(t.y-y)<4){t.obstacle=false;t.layer=0;}
  a.pos={x,y:y+.8};a.ai={...a.ai,commandUntil:s.time+100};a.drawPos={...a.pos};e.life='active';e.role='heavy';e.pos={x:x-.9,y};e.drawPos={...e.pos};e.hp=e.maxHp=10000;e.path=[];e.ready=0;e.posture=150;e.stagger=0;e.statuses=[];e.enemySense.home={...e.pos};e.enemySense.patrol=[];e.pursuitTargetId=h.id;e.enemyMotion='engaged';e.attackTimer=0;
  for(const u of [h,a]){u.hp=u.maxHp=10000;u.ready=0;u.posture=0;u.postureDelay=100;u.attackTimer=100;u.dodge=0;u.weapons[u.weaponIndex].weight=0;}
  const {startIntent}=await import('/src/core/attack-intent.ts' as string);const {step}=await import('/src/core/engine.ts' as string);startIntent(s,e,h);e.attackTimer=100;e.enemyCombat.armed=true;e.enemyCombat.abilityReadyAt=100;e.enemyCombat.reactionReadyAt=100;const from=[{...h.pos},{...a.pos}];step(s,1.1);const travel=[h,a].map((u,i)=>Math.hypot(u.pos.x-from[i].x,u.pos.y-from[i].y));step(s,.7);return {travel,posture:[h.posture,a.posture],hits:s.stats.telegraphHits};
 });expect(result.hits).toBe(2);expect(result.travel[0]).toBeCloseTo(.675);expect(result.travel[1]).toBeCloseTo(.36);expect(result.posture.every(x=>x>0)).toBe(true);
 await page.keyboard.press('c');expect(await page.evaluate(()=>(window as any).prototype.state.controlledBodyId)).toBe('ines');
 const accepted=await page.evaluate(async()=>{const s=(window as any).prototype.state;const {command}=await import('/src/core/engine.ts' as string);return command(s,{type:'direct',id:'ines',direction:{x:1,y:0}}).ok;});expect(accepted).toBe(true);mkdirSync(folder,{recursive:true});writeFileSync(folder+'/heavy-weight.json',JSON.stringify(result,null,2));
});
