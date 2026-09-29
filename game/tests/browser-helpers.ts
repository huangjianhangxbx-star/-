import type {Page} from '@playwright/test';
/** Real model selection; skill readiness is explicit fixture setup, not an initial-state assumption. */
export async function selectModel(page:Page,id:string,ready=true){
 const p=await page.evaluate(({id,ready})=>{const s=(window as any).prototype.state;const u=s.units.find((u:any)=>u.id===id);if(ready)u.skillCd=0;return (window as any).prototype.project(u.pos);},{id,ready});
 await page.mouse.click(p.x,p.y);
}
