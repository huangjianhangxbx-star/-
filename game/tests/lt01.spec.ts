import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('../../work/LT-01-20261010/browser',import.meta.url));mkdirSync(out,{recursive:true});
test.setTimeout(150000);
test('ROST default entry and real Z F G retain fixed two-body HUD',async({page})=>{
 const removedRequests:string[]=[];page.on('request',r=>{if(/Charlotte|Rina_F_Summer/.test(r.url()))removedRequests.push(r.url());});
 await page.goto('/?enemyPressure=baseline&v=lt01-roster');await expect(page.locator('[data-companion]')).toHaveCount(0);await expect(page.locator('#exploration-companions')).toContainText('同行者：阿尔');await page.locator('[data-action=carry]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).prototype?.state.units.filter(u=>u.team==='ally'&&!u.cloneOf).map(u=>u.id))).toEqual(['hunter','ranger']);
 await page.locator('#scene').click({position:{x:500,y:300}});await page.keyboard.press('KeyZ');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.controlledBodyId)).toBe('ranger');
 await page.keyboard.press('KeyF');await expect.poll(()=>page.evaluate(()=>(window as any).prototype.state.explorationControl?.aim?.kind)).toBe('path');await page.keyboard.press('Escape');
 await page.keyboard.down('KeyG');await page.waitForTimeout(150);await page.keyboard.press('Escape');await page.keyboard.up('KeyG');
 expect(removedRequests).toEqual([]);expect(await page.locator('img[src="/assets/ui/portraits/al-user.png"]').count()).toBeGreaterThan(0);
 await page.screenshot({path:out+'/roster-entry.png'});writeFileSync(out+'/roster.json',JSON.stringify({removedRequests,ids:['hunter','ranger'],input:'Z F G actual keyboard'},null,2));
});
