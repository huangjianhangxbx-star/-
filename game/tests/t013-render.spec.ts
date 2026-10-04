import {test,expect} from '@playwright/test';
test('exploration camera follows while paused and unknown cells cannot be picked',async({page})=>{
 await page.goto('/');await page.locator('[data-action="carry"]').click();await page.evaluate(()=>{const s=(window as any).prototype.state;s.completed.push(1);s.phase='nodes';});await page.locator('[data-node="4"]').click();await page.locator('[data-action="pause"]').click();
 const before=await page.evaluate(()=>(window as any).prototype.project({x:2,y:16}));
 await page.evaluate(()=>{const h=(window as any).prototype.state.units[0];h.pos={x:13,y:16};h.drawPos={...h.pos};});await page.waitForTimeout(900);
 await expect.poll(async()=>{const after=await page.evaluate(()=>(window as any).prototype.project({x:13,y:16}));return Math.abs(before.x-after.x);}).toBeLessThan(20);
 expect(await page.evaluate(()=>{const p=(window as any).prototype,q=p.project({x:24,y:3});return p.scene.pick(q.x,q.y).tile;})).toBeNull();
 await page.screenshot({path:'../记录/验证/T-013/exploration-camera-fog.png'});
});

test('returning to the node map does not expose unknown terrain through its background',async({page})=>{
 await page.goto('/');await page.locator('[data-action="carry"]').click();await page.evaluate(()=>{const s=(window as any).prototype.state;s.completed.push(1);s.phase='nodes';});await page.locator('[data-node="4"]').click();await page.locator('#exploration-exit').click();
 const pixels=await page.evaluate(()=>{const p=(window as any).prototype,s=p.state,scene=p.scene;scene.update(s,{selectedId:null,hover:null,path:[],range:[],deployTiles:[],targeting:false},0,1);const r=scene.renderer,gl=r.getContext(),canvas=r.domElement,q=scene.project({x:14,y:10}),bounds=canvas.getBoundingClientRect(),sample=new Uint8Array(4),background=new Uint8Array(4);gl.readPixels(Math.round((q.x-bounds.left)*canvas.width/bounds.width),canvas.height-1-Math.round((q.y-bounds.top)*canvas.height/bounds.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,sample);r.clear();gl.readPixels(Math.round((q.x-bounds.left)*canvas.width/bounds.width),canvas.height-1-Math.round((q.y-bounds.top)*canvas.height/bounds.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,background);scene.update(s,{selectedId:null,hover:null,path:[],range:[],deployTiles:[],targeting:false},0,0);return {inside:q.x>=bounds.left&&q.x<bounds.right&&q.y>=bounds.top&&q.y<bounds.bottom,sample:[...sample],background:[...background]};});expect(pixels.inside).toBe(true);expect(pixels.sample).toEqual(pixels.background);
});
