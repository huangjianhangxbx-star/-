import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
test('EN03 compatibility: existing XX preview still loads and responds through its own UI',async({page})=>{
 test.setTimeout(45000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/xx-preview.html');await expect.poll(()=>page.evaluate(()=>!!(window as any).xxPreview?.visual),{timeout:30000}).toBe(true);
 await page.locator('select').selectOption({index:1});await page.locator('#mirror').click();
 await expect(page.locator('#reading')).toContainText('AnimationName');
 mkdirSync('../work/EN-03/browser',{recursive:true});await page.screenshot({path:'../work/EN-03/browser/xx-compat.png'});
 writeFileSync('../work/EN-03/browser/xx-compat.json',JSON.stringify({method:'actual preview select and mirror clicks; no combat state writes',reading:await page.locator('#reading').textContent(),errors},null,2));expect(errors).toEqual([]);
});
