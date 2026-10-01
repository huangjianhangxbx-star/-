import {prepareRegression} from './browser-helpers';
import {fileURLToPath} from 'node:url';
import {test,expect} from '@playwright/test';
test('exploration fixture renders real enemies and ignores copy targets',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?scenario=exploration');await prepareRegression(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();await expect(page.getByText('探索交战验证 · 不含探索进度与结算')).toBeVisible();
 const result=await page.evaluate(async()=>{const api=(window as any).prototype;const {step}=await import('/src/core/engine.ts' as string);step(api.state,1);const e=api.state.units.find((u:any)=>u.id==='validation-enemy');return {rules:api.state.ruleset,target:e.pursuitTargetId,hasCopy:api.state.units.some((u:any)=>u.cloneOf)};});
 expect(result).toEqual({rules:'exploration',target:'hunter',hasCopy:true});expect(errors).toEqual([]);await page.screenshot({path:fileURLToPath(new URL('../../work/r1-exploration.png',import.meta.url))});
});
test('fractional selected model supports card targeting, circular preview and cancellation',async({page})=>{
 await page.goto('/');await prepareRegression(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();const p=await page.evaluate(()=>{const s=(window as any).prototype.state,h=s.units[0];h.pos={x:3.23,y:4.12};h.drawPos={...h.pos};h.hp=100;return (window as any).prototype.project(h.pos);});await page.mouse.click(p.x,p.y);await expect(page.locator('#range-caption')).toContainText('圆形');await page.screenshot({path:fileURLToPath(new URL('../../work/r1-tower-range.png',import.meta.url))});await page.mouse.click(p.x,p.y,{button:'right'});
 const id=await page.evaluate(()=>(window as any).prototype.state.cards.find((c:any)=>c.kind==='heal').id);await page.locator(`[data-card="${id}"]`).click();await page.mouse.click(p.x,p.y);await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.units[0].hp)).toBe(145);
});
