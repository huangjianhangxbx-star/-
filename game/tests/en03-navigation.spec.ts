import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
test('EN03 natural main-map retreat loses sight and the archer searches then returns',async({page})=>{
 test.setTimeout(90000);await page.goto('/?enemies=v2&mode=ranged');
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.scene.unitVisuals.get('v2-ranged')?.reference?.ready),{timeout:30000}).toBe(true);await page.keyboard.press('h');
 const path=await page.evaluate(async()=>{const p=(window as any).prototype,s=p.state,h=s.units.find((u:any)=>u.id==='hunter'),e=s.units.find((u:any)=>u.enemyV2),{navigate}=await import('/src/core/navigation.ts' as any);for(const t of s.tiles.filter((t:any)=>!t.obstacle&&Math.hypot(t.x-e.pos.x,t.y-e.pos.y)>13&&Math.hypot(t.x-h.pos.x,t.y-h.pos.y)<18).sort((a:any,b:any)=>Math.hypot(a.x-h.pos.x,a.y-h.pos.y)-Math.hypot(b.x-h.pos.x,b.y-h.pos.y))){const route=navigate(s,h.pos,t,false,false);if(route.length)return route;}throw Error('No existing main-map escape route');});
 const trace:any[]=[];let index=0,held:string[]=[];
 for(let i=0;i<250;i++){const f=await page.evaluate(()=>{const s=(window as any).prototype.state;return {time:s.time,h:s.units.find((u:any)=>u.id==='hunter').pos,e:s.units.find((u:any)=>u.enemyV2).pos,brain:s.units.find((u:any)=>u.enemyV2).enemyV2.brain};});trace.push(f);if(f.brain.decision==='return')break;
  while(index<path.length-1&&Math.hypot(path[index].x-f.h.x,path[index].y-f.h.y)<.4)index++;const goal=path[index],dx=goal.x-f.h.x,dy=goal.y-f.h.y,next:string[]=[];if(Math.abs(dx)>.15)next.push(dx>0?'d':'a');if(Math.abs(dy)>.15)next.push(dy>0?'s':'w');for(const k of held)if(!next.includes(k))await page.keyboard.up(k);for(const k of next)if(!held.includes(k))await page.keyboard.down(k);held=next;await page.waitForTimeout(100);
 }
 for(const k of held)await page.keyboard.up(k);mkdirSync('../work/EN-03/browser',{recursive:true});writeFileSync('../work/EN-03/browser/natural-return.json',JSON.stringify({method:'read-only route calculation, real WASD and H, no state writes',path,trace},null,2));await page.screenshot({path:'../work/EN-03/browser/natural-return.png'});
 expect(trace.some(f=>f.brain.decision==='search')).toBe(true);expect(trace.at(-1).brain.decision).toBe('return');
});
