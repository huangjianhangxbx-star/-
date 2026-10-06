import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
async function promote(page:Page){await page.evaluate(async()=>{const {command}=await import('/src/core/engine.ts' as string);command((window as any).prototype.state,{type:'promoteCommandFocus'});});}
async function begin(page:Page,id='ines'){
 await page.goto('/');await page.locator('[data-journey="exploration"]').click();await page.locator('[data-companion="'+id+'"]').click();await page.locator('[data-action="carry"]').click();await page.locator('[data-action="pause"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.terrain.userData.loaded),{timeout:45000}).toBe(true);
 await page.evaluate(()=>{const s=(window as any).prototype.state;for(const u of s.units)if(u.team==='enemy')u.life='dead';});
}
test('Shift follows actual C control, independent stock, pause and partner HUD',async({page})=>{
 test.setTimeout(90000);await begin(page);await page.keyboard.press('2');await promote(page);await expect(page.locator('#blink-button')).toContainText('踏步');await expect(page.locator('#blink-stock')).toHaveText('2 / 2');
 await page.keyboard.down('d');await page.keyboard.press('Shift');await page.keyboard.up('d');expect(await page.evaluate(()=>(window as any).prototype.state.stats.evadeUses||0)).toBe(0);
 await page.locator('[data-action="pause"]').click();await page.keyboard.down('d');await page.keyboard.press('Shift');await page.keyboard.up('d');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.stats.evadeUses)).toBe(1);await expect(page.locator('#blink-stock')).toHaveText('1 / 2');
 await page.keyboard.press('c');await promote(page);await expect(page.locator('#blink-button')).toContainText('瞬影');await expect(page.locator('#blink-stock')).toHaveText('10 / 10');await page.keyboard.down('d');await page.keyboard.press('Shift');await page.keyboard.up('d');await expect(page.locator('#blink-stock')).toHaveText('9 / 10');await page.keyboard.press('c');await promote(page);await expect(page.locator('#blink-stock')).toHaveText('1 / 2');
 mkdirSync('../记录/验证/T-021',{recursive:true});await page.screenshot({path:'../记录/验证/T-021/partner-evasion.png'});
});
test('ranger real stop-shot-WASD-stop cycle keeps attack period and plays movement',async({page})=>{
 test.setTimeout(90000);await begin(page,'ranger');await page.keyboard.press('2');await promote(page);
 await page.evaluate(async()=>{
  const p=(window as any).prototype,s=p.state,u=s.units.find((u:any)=>u.id==='ranger'),h=s.units[0];
  const {canStop}=await import('/src/core/spatial.ts' as string),{attackCommit}=await import('/src/core/exploration.ts' as string);
  h.life='withdrawn';const pos=[{x:u.pos.x+1.3,y:u.pos.y},{x:u.pos.x,y:u.pos.y+1.3}].find(p=>canStop(s,p,u));if(!pos)throw Error('no legal firing fixture');
  const e={...structuredClone(h),id:'ec03-target',name:'验证靶',team:'enemy',role:'melee',pos,drawPos:{...pos},life:'active',hp:100000,maxHp:100000,ready:100000,attackTimer:100000,pursuitTargetId:u.id,blink:undefined,shadowResident:false};s.units.push(e);attackCommit(s,e,u);u.facing=pos.x>u.pos.x?'east':'south';u.attackTimer=0;s.combatEvents=[];
 });
 await page.locator('[data-action="pause"]').click();
 const shots=()=>page.evaluate(()=>(window as any).prototype.state.combatEvents.filter((e:any)=>e.sourceId==='ranger'&&e.kind==='basic').map((e:any)=>e.at));
 await expect.poll(async()=>(await shots()).length).toBe(1);
 const before=await page.evaluate(()=>{const p=(window as any).prototype,u=p.state.units.find((u:any)=>u.id==='ranger');return {time:p.state.time,pos:{...u.pos},timer:u.attackTimer,period:u.weapons[u.weaponIndex].attackPeriod??u.attackPeriod};});
 await page.keyboard.down('s');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.unitVisuals.get('ranger').moving)).toBe(true);
 await expect.poll(()=>page.evaluate(time=>(window as any).prototype.state.time-time,before.time),{timeout:8000}).toBeGreaterThan(.7).catch(async()=>{throw Error('movement simulation did not advance');});
 const moved=await page.evaluate(()=>{const u=(window as any).prototype.state.units.find((u:any)=>u.id==='ranger');return {pos:u.pos,timer:u.attackTimer};});expect(moved.pos.y).toBeGreaterThan(before.pos.y+.1);expect(moved.timer).toBeLessThan(before.timer);await page.keyboard.up('s');
 await expect.poll(async()=>(await shots()).length,{timeout:15000}).toBeGreaterThanOrEqual(2);const times=await shots();expect(times[1]-times[0]).toBeGreaterThanOrEqual(before.period-.06);
 await page.locator('[data-action="pause"]').click();mkdirSync('../记录/验证/T-021',{recursive:true});writeFileSync('../记录/验证/T-021/walk-a.json',JSON.stringify({before,moved,times},null,2));await page.screenshot({path:'../记录/验证/T-021/walk-a.png'});
});
test('partner mouse aim, no battlefield direction and exclusive UI do not consume accidentally',async({page})=>{
 test.setTimeout(90000);await begin(page);await page.keyboard.press('2');await promote(page);await page.locator('[data-action="pause"]').click();
 await page.mouse.move(45,30);await page.keyboard.press('Shift');expect(await page.evaluate(()=>(window as any).prototype.state.stats.evadeUses||0)).toBe(0);
 await page.locator('#blink-button').click();await page.keyboard.press('c');await promote(page);expect(await page.evaluate(()=>(window as any).prototype.state.controlledBodyId)).toBe('ines');
 const point=await page.evaluate(()=>{const p=(window as any).prototype,u=p.state.units.find((u:any)=>u.id==='ines');return p.project({x:u.pos.x+1,y:u.pos.y});});await page.mouse.click(point.x,point.y);await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.stats.evadeUses)).toBe(1);
 await page.locator('[data-action="backpack"]').click();await page.keyboard.down('w');await page.keyboard.press('Shift');await page.keyboard.up('w');expect(await page.evaluate(()=>(window as any).prototype.state.stats.evadeUses)).toBe(1);await page.keyboard.press('Escape');
 const names=await page.evaluate(()=>{const p=(window as any).prototype;return [...p.scene.unitVisuals.values()].filter((a:any)=>['hunter','ines'].includes(a.unit.id)).map((a:any)=>({id:a.unit.id,names:a.spine?.names}));});mkdirSync('../记录/验证/T-021',{recursive:true});writeFileSync('../记录/验证/T-021/animation-names.json',JSON.stringify(names,null,2));
});
test('evasion feedback borrows live texture without disposing it and asset fallback is explicit',async({page})=>{
 test.setTimeout(90000);await begin(page);await page.keyboard.press('2');await promote(page);
 await page.evaluate(async()=>{const p=(window as any).prototype,{command}=await import('/src/core/engine.ts' as string);(window as any).evadeTextureDisposals=0;p.scene.unitVisuals.get('ines').spineTexture.addEventListener('dispose',()=>{(window as any).evadeTextureDisposals++;});const r=command(p.state,{type:'evade',id:'ines',direction:{x:1,y:0}});if(!r.ok)throw Error(r.reason);});
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype.scene.effectsGroup.children.some((o:any)=>o.isSprite))).toBe(true);
 await page.waitForTimeout(250);expect(await page.evaluate(()=>(window as any).evadeTextureDisposals)).toBe(0);
 const assets=await page.evaluate(async()=>{const {SpineVisual}=await import('/src/view/spine.ts' as string),s=(window as any).prototype.state,result=[];for(const id of ['ines','ranger','fiorre']){const u=s.units.find((u:any)=>u.id===id),v=await SpineVisual.load(u.asset);result.push({id,asset:u.asset,names:v.names,evade:v.names.filter((n:string)=>/dodge|roll|step|dash|avoid/i.test(n))});v.dispose();}return result;});mkdirSync('../记录/验证/T-021',{recursive:true});writeFileSync('../记录/验证/T-021/companion-animation-audit.json',JSON.stringify(assets,null,2));
});
