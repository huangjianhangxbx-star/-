import {test,expect} from '@playwright/test';
for(const width of [1440,1000])test(`preparation tendency is actionable and fits at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');await page.locator('[data-action="carry"]').click();await page.getByRole('button',{name:'职业与构筑',exact:true}).click();await page.locator('[data-build-unit="ines"]').click();
 await page.locator('[data-ai-tendency="preserve"]').click();await expect(page.locator('[data-ai-tendency="preserve"]')).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>(window as any).prototype.state.units.find((u:any)=>u.id==='ines').aiTendency)).toBe('preserve');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:`../记录/验证/T-015/tendency-${width}.png`});
 await page.locator('[data-action="close-build"]').click();await page.getByRole('button',{name:'进入战斗',exact:true}).click();await page.locator('[data-action="pause"]').click();await page.locator('[data-unit="ines"]').click();await page.locator('[data-action="build"]').last().click();await expect(page.locator('[data-ai-tendency="aggressive"]')).toBeDisabled();
});
test('overlapping bodies use stable slot ordering and debug overlays release their resources',async({page})=>{
 await page.goto('/');await page.locator('[data-action="carry"]').click();await page.evaluate(()=>{const s=(window as any).prototype.state;s.completed.push(1);s.phase='nodes';});await page.locator('[data-node="4"]').click();await page.locator('[data-action="pause"]').click();
 const result=await page.evaluate(async()=>{const p=(window as any).prototype,s=p.state,{aiState}=await import('/src/core/autonomy.ts' as string),h=s.units[0],g=s.units.find((u:any)=>u.id==='ines');g.life='active';g.pos={...h.pos};g.drawPos={...h.pos};aiState(h).anchor={...h.pos};aiState(g).anchor={...g.pos};const o={selectedId:null,hover:null,path:[],range:[],deployTiles:[],targeting:false},orders:number[][]=[],counts:any[]=[],debugCounts:any[]=[];
  for(let i=0;i<6;i++){g.pos.y=h.pos.y+(i%2?1:-1)*.00001;g.drawPos={...g.pos};p.scene.update(s,{...o,debugAutonomy:true},0,1);debugCounts.push({...p.scene.renderer.info.memory});orders.push([p.scene.unitVisuals.get(h.id).sprite.renderOrder,p.scene.unitVisuals.get(g.id).sprite.renderOrder]);p.scene.update(s,{...o,debugAutonomy:false},0,1);counts.push({...p.scene.renderer.info.memory});}return {orders,counts,debugCounts};});
 expect(result.debugCounts.every((v,i)=>v.geometries>result.counts[i].geometries)).toBe(true);expect(result.orders.every(v=>v[0]<v[1])).toBe(true);expect(result.counts.every(v=>v.geometries===result.counts[0].geometries&&v.textures===result.counts[0].textures)).toBe(true);
});
