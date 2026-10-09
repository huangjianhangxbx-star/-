import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const before=!!process.env.R1_BEFORE,dir='../work/R1-CL01A/'+(before?'before':'after');mkdirSync(dir,{recursive:true});test.setTimeout(120000);
for(const [route,width,height] of [['/',1440,900],['/?enemies=v2&mode=ranged',1280,720]] as const)test(`A3 natural visual recovery ${width}`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto(route);
 if(route==='/'){const choose=page.locator('[data-journey=exploration]');if(await choose.count())await choose.click();await page.locator('[data-companion=ranger]').click();await page.locator('[data-action=carry]').click();}
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.scene.unitVisuals.get('ranger')?.reference?.ready),{timeout:30000}).toBe(true);await page.keyboard.press('z');
 const p=await page.evaluate(()=>{const p=(window as any).prototype,u=p.state.units.find((u:any)=>u.id==='ranger');return p.project({x:u.pos.x+1,y:u.pos.y});});await page.mouse.move(p.x,p.y);await page.mouse.down();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ranger').basicAction?.stageIndex),{timeout:40000,intervals:[20]}).toBe(2);
 const rows:any[]=[];
 for(const at of [.17,.30,.40,.60,.85,1.10,1.27,1.52]){
  await expect.poll(()=>page.evaluate(()=>{const u=(window as any).prototype.state.units.find((u:any)=>u.id==='ranger'),r=u.alCombat.trace.find((r:any)=>r.kind==='accepted'&&r.stage===2);return r?(window as any).prototype.state.time-r.at:0;}),{timeout:30000,intervals:[15]}).toBeGreaterThanOrEqual(at);
  const sample=await page.evaluate(()=>{const p=(window as any).prototype,s=p.state,u=s.units.find((u:any)=>u.id==='ranger'),v=p.scene.unitVisuals.get(u.id).reference;return {time:s.time,real:s.realTime,scale:p.effectiveTimeScale,hitstop:s.combatHitstop,action:u.basicAction,recovery:u.alCombat.finalRecoveryUntil,pose:v.lastPose,trackTime:v.track.trackTime,bones:v.skeleton.bones.slice(0,12).map((b:any)=>({name:b.data.name,x:b.worldX,y:b.worldY})),trace:u.alCombat.trace};});rows.push({at,...sample});
  await page.screenshot({path:dir+`/${width}-${at}.png`});
 }
 await page.mouse.up();writeFileSync(dir+`/${width}-samples.json`,JSON.stringify(rows,null,2));
 if(!before){const tail=rows.find(r=>r.at===.85);expect(tail.pose).toContain('_stand');const h=rows.at(-1).trace,a=h.find((r:any)=>r.kind==='accepted'&&r.stage===2),next=h.find((r:any)=>r.kind==='accepted'&&r.stage===0&&r.at>a.at);expect(next.at-a.at).toBeGreaterThanOrEqual(1.5166);}
});
