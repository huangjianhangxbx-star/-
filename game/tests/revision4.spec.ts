import {prepareRegression} from './browser-helpers';
import {selectModel} from './browser-helpers';
import {test,expect} from '@playwright/test';
async function start(page:any){await page.goto('/');await prepareRegression(page);await page.getByRole('button',{name:'进入战斗',exact:true}).click();}
test('only detail skill hover changes attack preview to skill preview',async({page})=>{
 await start(page);await page.evaluate(()=>{const s=(window as any).prototype.state;const f=s.units.find((u:any)=>u.id==='fiorre');f.weaponIndex=0;f.skillId='prayer';f.life='active';f.ready=0;f.pos={x:4,y:4};f.drawPos={...f.pos};});await selectModel(page,'fiorre');await page.locator('#world-skill-button').hover();await expect(page.locator('#range-caption')).toContainText('普攻范围');await page.locator('#unit-detail [data-skill-preview="fiorre"]').hover();await expect(page.locator('#range-caption')).toContainText('技能范围');await expect(page.locator('#range-caption')).toContainText('生命祷告');await page.locator('#world-skill-button').hover();await expect(page.locator('#range-caption')).toContainText('普攻范围');
});
test('a real enemy death emits fragment flight and credits only once',async({page})=>{
 await start(page);const before=await page.evaluate(()=>{const s=(window as any).prototype.state;const e=structuredClone(s.units[0]);Object.assign(e,{id:'loot-test',team:'enemy',hp:1,maxHp:1,pos:{x:6,y:2},drawPos:{x:6,y:2},life:'active',speed:0,attackTimer:999,statuses:[{kind:'poison',remaining:1,power:200}]});s.units.push(e);return s.fragments;});
 await expect(page.locator('.loot-particle').first()).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.fragments)).toBe(before+4);await page.waitForTimeout(1500);await expect(page.locator('.loot-particle')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).prototype.state.fragments)).toBe(before+4);
});
