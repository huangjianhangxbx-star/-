import {test,expect} from '@playwright/test';
test('direct movement renders run and blocked movement idles',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'进入战斗',exact:true}).click();
 const result=await page.evaluate(async()=>{
 const {BattleScene}=await import('/src/view/scene.ts' as string),{createGame}=await import('/src/core/engine.ts' as string);
 const host=document.createElement('div');Object.assign(host.style,{position:'fixed',inset:'0'});document.body.append(host);
 const scene=new BattleScene(host),s=createGame(),u=s.units[0],overlay={selectedId:null,hover:null,path:[],range:[],deployTiles:[],targeting:false};u.life='active';scene.update(s,overlay,.01);
 const a=scene.unitVisuals.get(u.id),actions:string[]=[];u.direct={direction:{x:1,y:0},trail:[]};u.pos.x+=.05;u.drawPos={...u.pos};scene.update(s,overlay,.016);actions.push(a.spine.action);
 scene.update(s,overlay,.016);actions.push(a.spine.action);
 u.direct=undefined;u.pos.x+=1;u.drawPos={...u.pos};scene.update(s,overlay,.016);actions.push(a.spine.action);scene.dispose();host.remove();return actions;
 });expect(result).toEqual(['run','stand','stand']);
});
test('avatar does not summon; summon strip supports drag and click',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'进入战斗',exact:true}).click();await page.evaluate(()=>{const s=(window as any).prototype.state;s.fragments=100;s.waves.forEach((w:any)=>w.startAt+=1000);});
 const target=async(x:number,y:number)=>page.evaluate(p=>(window as any).prototype.project(p),{x,y});
 const drag=async(selector:string,x:number,y:number)=>{const b=await page.locator(selector).boundingBox(),p=await target(x,y);await page.mouse.move(b!.x+b!.width/2,b!.y+b!.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:10});await page.mouse.up();};
 const copies=()=>page.evaluate(()=>(window as any).prototype.state.units.filter((u:any)=>u.cloneOf).length);
 await drag('[data-unit="hunter"]',3,3);expect(await copies()).toBe(0);
 await drag('[data-clone="hunter"]',3,3);await expect.poll(copies).toBe(1);
 await page.locator('[data-clone="hunter"]').click();const p=await target(3,4);await page.mouse.click(p.x,p.y);await expect.poll(copies).toBe(2);
});
